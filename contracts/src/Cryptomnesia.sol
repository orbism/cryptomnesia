// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// Cryptomnesia: one ERC-1155 token per page of the book. Nothing lives off this chain.
/// The program that draws every page is stored here once, gzipped, as contract code. uri() hands back a web page
/// that unpacks it in the browser and draws the token's page, moving, exactly as the site does.
/// For places that show only a picture, a small still of every page is stored too, as PNG.
contract Cryptomnesia is ERC1155, ERC2981, Ownable {
    string public name;
    string public symbol;
    uint256 public immutable price; // wei for one copy of one page
    uint256 public immutable cap; // most copies of any one page. 0 = no limit
    bool public locked; // once set, the art and the page list can never change
    address[] public chunks; // the drawing program, gzipped, in pieces, each held as a contract's code
    address[] public covers; // a still of every page, PNG, one after another behind a table of where each ends, in pieces as above
    string[] public pages; // token id n is pages[n - 1]
    uint256 constant PIECE = 24575; // what every stored piece but the last must hold
    mapping(uint256 id => uint256) public totalSupply;

    error Locked();
    error NoSuchPage();
    error WrongPrice();
    error SoldOut();
    error NotPaid();
    error NotStored();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 price_,
        uint256 cap_,
        address owner_,
        address royaltyTo,
        uint96 royaltyBps
    ) ERC1155("") Ownable(owner_) {
        name = name_;
        symbol = symbol_;
        price = price_;
        cap = cap_;
        if (royaltyBps != 0) _setDefaultRoyalty(royaltyTo, royaltyBps);
    }

    // --- minting

    function mint(uint256 id, uint256 amount) external payable {
        if (id == 0 || id > pages.length) revert NoSuchPage();
        if (msg.value != price * amount) revert WrongPrice();
        uint256 minted = totalSupply[id] + amount;
        if (cap != 0 && minted > cap) revert SoldOut();
        totalSupply[id] = minted;
        _mint(msg.sender, id, amount, "");
    }

    function withdraw() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        if (!ok) revert NotPaid();
    }

    // --- putting the art on chain. owner only, and only until lock()

    modifier unlocked() {
        if (locked) revert Locked();
        _;
    }

    /// Deploy a contract whose code is a STOP byte followed by the data (the SSTORE2 pattern): code is the cheapest place to keep bytes.
    function _keep(bytes calldata data) private returns (address at) {
        bytes memory init = abi.encodePacked(hex"600B5981380380925939F300", data);
        assembly {
            at := create(0, add(init, 32), mload(init))
        }
        if (at == address(0)) revert NotStored();
    }

    /// Store the next piece of the gzipped program. A piece may be at most 24575 bytes.
    function addChunk(bytes calldata data) external onlyOwner unlocked {
        chunks.push(_keep(data));
    }

    /// Store the next piece of the stills. Every piece but the last must be exactly 24575 bytes.
    /// The whole begins with three bytes for each page, the offset at which that page's PNG ends; the PNGs follow in page order.
    function addCover(bytes calldata data) external onlyOwner unlocked {
        covers.push(_keep(data));
    }

    /// Throw away what has been stored so far, to start an upload again.
    function clearChunks() external onlyOwner unlocked {
        delete chunks;
    }

    function clearCovers() external onlyOwner unlocked {
        delete covers;
    }

    function setPages(string[] calldata list) external onlyOwner unlocked {
        delete pages;
        for (uint256 i; i < list.length; ++i) {
            pages.push(list[i]);
        }
    }

    /// Irreversible.
    function lock() external onlyOwner {
        locked = true;
    }

    // --- reading it back

    function pageCount() external view returns (uint256) {
        return pages.length;
    }

    function chunkCount() external view returns (uint256) {
        return chunks.length;
    }

    function coverCount() external view returns (uint256) {
        return covers.length;
    }

    /// The whole gzipped program, pieces joined.
    function art() public view returns (bytes memory out) {
        uint256 n = chunks.length;
        uint256 size;
        for (uint256 i; i < n; ++i) {
            size += chunks[i].code.length - 1;
        }
        out = new bytes(size);
        uint256 at = 32;
        for (uint256 i; i < n; ++i) {
            address c = chunks[i];
            uint256 len = c.code.length - 1;
            assembly {
                extcodecopy(c, add(out, at), 1, len)
            }
            at += len;
        }
    }

    /// The page as a self-contained web page: no links, no fetches.
    function html(uint256 id) public view returns (string memory) {
        if (id == 0 || id > pages.length) revert NoSuchPage();
        return string.concat(
            '<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><title>',
            name,
            "</title>",
            "<style>body{margin:0;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}canvas{image-rendering:pixelated;width:min(100vw,75vh);height:auto}</style>",
            '<canvas id=c width=360 height=480></canvas><script>P="',
            pages[id - 1],
            '";Z="',
            Base64.encode(art()),
            '";(async()=>{const b=Uint8Array.from(atob(Z),c=>c.charCodeAt(0));(0,eval)(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text())})()</script>'
        );
    }

    /// Where page id's still ends, read from the table at the head of the stills.
    function _end(uint256 id) private view returns (uint256 v) {
        address c = covers[0];
        assembly {
            extcodecopy(c, 0, add(1, mul(sub(id, 1), 3)), 3)
            v := shr(232, mload(0))
        }
    }

    /// A still of the page, half size, as a PNG: for places that only show a picture. Empty until the stills are stored.
    function cover(uint256 id) public view returns (bytes memory out) {
        if (id == 0 || id > pages.length) revert NoSuchPage();
        if (covers.length == 0) return out;
        uint256 from = id == 1 ? pages.length * 3 : _end(id - 1);
        uint256 len = _end(id) - from;
        out = new bytes(len);
        for (uint256 done; done < len;) {
            address c = covers[(from + done) / PIECE];
            uint256 off = (from + done) % PIECE;
            uint256 n = PIECE - off < len - done ? PIECE - off : len - done;
            assembly {
                extcodecopy(c, add(add(out, 32), done), add(off, 1), n)
            }
            done += n;
        }
    }

    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(
                bytes(
                    string.concat(
                        '{"name":"',
                        name,
                        ": ",
                        pages[id - 1],
                        '","description":"A page of ',
                        name,
                        '. Drawn by code held on chain, in the browser, every time it is opened.","image":"data:image/png;base64,',
                        Base64.encode(cover(id)),
                        '","animation_url":"data:text/html;base64,',
                        Base64.encode(bytes(html(id))),
                        '"}'
                    )
                )
            )
        );
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
