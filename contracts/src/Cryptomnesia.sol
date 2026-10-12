// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// Cryptomnesia: one ERC-1155 token per page of the book. Nothing lives off this chain.
/// The program that draws every page is stored here once, gzipped, as contract code. uri() hands back a web page
/// that unpacks it in the browser and draws the token's page, moving, exactly as the site does.
contract Cryptomnesia is ERC1155, ERC2981, Ownable {
    string public name;
    string public symbol;
    uint256 public immutable price; // wei for one copy of one page
    uint256 public immutable cap; // most copies of any one page. 0 = no limit
    bool public locked; // once set, the art and the page list can never change
    address[] public chunks; // the drawing program, gzipped, in pieces, each held as a contract's code
    string[] public pages; // token id n is pages[n - 1]
    mapping(uint256 id => uint256) public totalSupply;

    error Locked();
    error NoSuchPage();
    error WrongPrice();
    error SoldOut();
    error NotPaid();
    error NotStored();

    constructor(string memory name_, string memory symbol_, uint256 price_, uint256 cap_, address owner_, address royaltyTo, uint96 royaltyBps)
        ERC1155("")
        Ownable(owner_)
    {
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

    /// Store the next piece of the gzipped program. A piece may be at most 24575 bytes.
    function addChunk(bytes calldata data) external onlyOwner unlocked {
        // deploy a contract whose code is a STOP byte followed by the data (the SSTORE2 pattern): code is the cheapest place to keep bytes
        bytes memory init = abi.encodePacked(hex"600B5981380380925939F300", data);
        address at;
        assembly {
            at := create(0, add(init, 32), mload(init))
        }
        if (at == address(0)) revert NotStored();
        chunks.push(at);
    }

    /// Throw away what has been stored so far, to start an upload again.
    function clearChunks() external onlyOwner unlocked {
        delete chunks;
    }

    function setPages(string[] calldata list) external onlyOwner unlocked {
        delete pages;
        for (uint256 i; i < list.length; ++i) pages.push(list[i]);
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

    /// The whole gzipped program, pieces joined.
    function art() public view returns (bytes memory out) {
        uint256 n = chunks.length;
        uint256 size;
        for (uint256 i; i < n; ++i) size += chunks[i].code.length - 1;
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
            '<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><title>', name, "</title>",
            "<style>body{margin:0;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}canvas{image-rendering:pixelated;width:min(100vw,75vh);height:auto}</style>",
            '<canvas id=c width=360 height=480></canvas><script>P="', pages[id - 1], '";Z="', Base64.encode(art()),
            '";(async()=>{const b=Uint8Array.from(atob(Z),c=>c.charCodeAt(0));(0,eval)(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text())})()</script>'
        );
    }

    /// A still card for places that only show a picture: the title and the page's name, as SVG.
    function card(uint256 id) public view returns (string memory) {
        if (id == 0 || id > pages.length) revert NoSuchPage();
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480"><rect width="360" height="480" fill="#06080b"/>',
            '<rect x="12.5" y="12.5" width="335" height="455" fill="none" stroke="#b3122e"/>',
            '<text x="180" y="228" fill="#d3ccba" font-family="Georgia,serif" font-size="30" text-anchor="middle">', name, "</text>",
            '<text x="180" y="266" fill="#b3122e" font-family="monospace" font-size="16" text-anchor="middle">', pages[id - 1], "</text></svg>"
        );
    }

    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(
                bytes(
                    string.concat(
                        '{"name":"', name, ": ", pages[id - 1],
                        '","description":"A page of ', name, '. Drawn by code held on chain, in the browser, every time it is opened.","image":"data:image/svg+xml;base64,',
                        Base64.encode(bytes(card(id))),
                        '","animation_url":"data:text/html;base64,', Base64.encode(bytes(html(id))), '"}'
                    )
                )
            )
        );
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
