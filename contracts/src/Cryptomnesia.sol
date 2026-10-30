// SPDX-License-Identifier: MIT
//                            . . . . . . . . .
//                   . ......:.:.:::::::::::.:.:.:.... .
//                . ....:.::::-:-:--- /\ :-:-:-:-::::.:.... .
//           . ..:.::::----=-=-===== /  \ ====-=-=----:-::.:....
//          ....::::----=-====+=+=+ /    \ =+=+====-=----:-::.:.. .
//       ....::::--=-====++++*+*+* /      \ ****+*++=+====----::.:.. .
//      ....::----====++++****#*# /        \ *#****+*++=+==-=--::::.. .
//   . ..::-:--====++*+**#*##### /          \ ######****++=+==-=--::.:..
//    ..::::--=-==++++**####### /            \ ######*#**++=+==----::.. .
//   ..::-:--==+=++**#*####### /              \ ########****++==-=--::....
//  ....::--=-==++****####### /                \ ########**++=+==--:-::..
// ....::--====++**#*####### /    _.--""--._    \ ########**++++==----::..
//  ..:.::--====++****##### /   .'   .--.   '.   \ ######**++++==--:-::.. .
// . ..::----==++*+**##### /   <    ( () )    >   \ ####*#**++====--::::..
//  . ..::----==++++**### /     '.   '--'   .'     \ ##****++====--::.:..
//   ..::::--=-==++*+**# /        '-.____.-'        \ *#**++=+==--:-::....
//    . ..::::--====++* /                            \ ++++==-=--::.:..
//     ....::-:--====+ /                              \ =+==-=--::::..
//        ..:.::-:--= /                                \ ----::::.. .
//         ....::::- /__________________________________\ :-::.:.. .
//            . ..:.::::-:----=-=-=-===-===-=-=----:-:-::::....
//               . ..:.:.::::-:-:-------------:-:-::::.:.... .
//                    . . ....:.:.:.:.:::.:.:.:.:.... .
//                         . . ............... . .
//
//                         C R Y P T O M N E S I A
//                 a choose-your-own-adventure horror story
//                         never forgotten on-chain
pragma solidity 0.8.30;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// Cryptomnesia: one ERC-1155 token per page of the book. Nothing lives off this chain.
/// The program that draws every page is stored here once, gzipped, as contract code. uri() hands back a web page
/// that unpacks it in the browser and draws the token's page, moving, exactly as the site does.
/// For places that show only a picture, a small still of every page is stored too, as PNG, and each page's name and traits.
/// The owner stores it all, then locks it: from then on nothing can change. Minting starts paused; the owner starts it, and can pause it again.
contract Cryptomnesia is ERC1155, ERC2981, Ownable {
    string public constant name = "Cryptomnesia";
    string public constant symbol = "CRYPT";
    string constant ABOUT = "Drawn by code held on chain, in the browser, every time it is opened.";
    uint256 public immutable price; // wei for one copy of one page
    uint256 public immutable cap; // most copies of any one page. 0 = no limit
    uint128 public pageCount; // 0 until lock(): minting is closed and the stores can still change
    bool public paused = true; // minting waits for start(). in pageCount's slot, so mint() reads both at once
    mapping(uint256 id => uint256) public totalSupply;
    // 0 = the drawing program, gzipped. 1 = a still of every page, PNG. 2 = every page's name and traits (see _fields).
    // each is a run of bytes in pieces, each piece held as a contract's code. 1 and 2 begin with two bytes saying how many pages,
    // then three for each page saying where its part ends, counted from the start; the parts follow in page order
    address[][3] stores;
    uint256 constant PIECE = 24575; // what every piece of 1 and 2 but the last must hold, and the most any may

    error Locked();
    error Paused();
    error NotReady();
    error NoSuchPage();
    error NoneAsked();
    error WrongPrice();
    error SoldOut();
    error NotPaid();
    error NotStored();
    error NeedsOwner();

    constructor(uint256 price_, uint256 cap_, address owner_, address royaltyTo, uint96 royaltyBps)
        ERC1155("")
        Ownable(owner_)
    {
        price = price_;
        cap = cap_;
        if (royaltyBps != 0) _setDefaultRoyalty(royaltyTo, royaltyBps);
    }

    // --- minting, once locked

    function mint(uint256 id, uint256 amount) external payable {
        uint256 n;
        bool p;
        assembly ("memory-safe") {
            let w := sload(pageCount.slot) // both from the one read
            n := and(w, 0xffffffffffffffffffffffffffffffff)
            p := and(shr(mul(paused.offset, 8), w), 0xff)
        }
        if (p) revert Paused();
        unchecked {
            if (id - 1 >= n) revert NoSuchPage(); // id 0 wraps round, and fails too
        }
        if (amount == 0) revert NoneAsked();
        if (msg.value != price * amount) revert WrongPrice();
        uint256 total = totalSupply[id] + amount;
        if (cap != 0 && total > cap) revert SoldOut();
        totalSupply[id] = total;
        _mint(msg.sender, id, amount, "");
    }

    function withdraw() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        if (!ok) revert NotPaid();
    }

    /// Stop minting, until start().
    function pause() external onlyOwner {
        paused = true;
    }

    /// Open minting, or open it again. Before lock() there is nothing to mint, whatever this says.
    function start() external onlyOwner {
        paused = false;
    }

    /// Never: with no owner, what has been paid in could not be withdrawn.
    function renounceOwnership() public pure override {
        revert NeedsOwner();
    }

    // --- putting the art on chain. owner only, and only until lock()

    modifier unlocked() {
        if (pageCount != 0) revert Locked();
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

    /// Store the next piece of a store.
    function add(uint256 store, bytes calldata data) external onlyOwner unlocked {
        stores[store].push(_keep(data));
    }

    /// Throw away a store, to upload it again.
    function clear(uint256 store) external onlyOwner unlocked {
        delete stores[store];
    }

    /// Irreversible. Only a whole book locks: the program there, the stills and the names for the same pages, every piece full but the last.
    function lock() external onlyOwner unlocked {
        uint256 n = _count(stores[2]);
        if (n == 0 || n != _count(stores[1]) || stores[0].length == 0 || !_whole(stores[1]) || !_whole(stores[2])) {
            revert NotReady();
        }
        pageCount = uint128(n);
    }

    // --- reading it back

    /// Where a store's pieces are held.
    function pieces(uint256 store) external view returns (address[] memory) {
        return stores[store];
    }

    /// How many copies of every page have been minted, page 1 first: the whole edition in one call.
    function minted() external view returns (uint256[] memory out) {
        out = new uint256[](pageCount);
        for (uint256 i; i < out.length; ++i) {
            out[i] = totalSupply[i + 1];
        }
    }

    /// The whole gzipped program, pieces joined.
    function art() public view returns (bytes memory out) {
        address[] storage s = stores[0];
        uint256 n = s.length;
        uint256 size;
        for (uint256 i; i < n; ++i) {
            size += s[i].code.length - 1;
        }
        out = new bytes(size);
        uint256 at = 32;
        for (uint256 i; i < n; ++i) {
            address c = s[i];
            uint256 len = c.code.length - 1;
            assembly {
                extcodecopy(c, add(out, at), 1, len)
            }
            at += len;
        }
    }

    /// How many pages a store holds parts for, from its first two bytes.
    function _count(address[] storage s) private view returns (uint256 n) {
        if (s.length == 0) return 0;
        address c = s[0];
        assembly ("memory-safe") {
            extcodecopy(c, 0, 1, 2)
            n := shr(240, mload(0))
        }
    }

    /// Where page id's part of a store ends, from the table at its head.
    function _end(address[] storage s, uint256 id) private view returns (uint256 v) {
        address c = s[0];
        assembly ("memory-safe") {
            extcodecopy(c, 0, add(3, mul(sub(id, 1), 3)), 3)
            v := shr(232, mload(0))
        }
    }

    /// Every piece full but the last, and the last part ending where the last piece does.
    function _whole(address[] storage s) private view returns (bool) {
        uint256 k = s.length;
        for (uint256 i; i + 1 < k; ++i) {
            if (s[i].code.length != PIECE + 1) return false;
        }
        return _end(s, _count(s)) == (k - 1) * PIECE + s[k - 1].code.length - 1;
    }

    /// Page id's part of store 1 (its still, a PNG) or 2 (its name and traits, as stored).
    function part(uint256 store, uint256 id) public view returns (bytes memory out) {
        address[] storage s = stores[store];
        uint256 n = _count(s);
        if (id == 0 || id > n) revert NoSuchPage();
        uint256 from = id == 1 ? 2 + n * 3 : _end(s, id - 1);
        uint256 len = _end(s, id) - from;
        out = new bytes(len);
        for (uint256 done; done < len;) {
            address c = s[(from + done) / PIECE];
            uint256 off = (from + done) % PIECE;
            uint256 m = PIECE - off < len - done ? PIECE - off : len - done;
            assembly {
                extcodecopy(c, add(add(out, 32), done), add(off, 1), m)
            }
            done += m;
        }
    }

    /// A page's name and traits, stored as text split by "|": key, name, chapter, setting, kind, disposition (empty on most pages),
    /// panels, choices. No quotes, backslashes, # or %: they go into JSON and a data: URI as they are.
    function _fields(uint256 id) private view returns (string[8] memory f) {
        bytes memory m = part(2, id);
        uint256 n;
        uint256 from;
        for (uint256 i; i <= m.length; ++i) {
            if (i < m.length && m[i] != "|") continue;
            bytes memory s = new bytes(i - from);
            for (uint256 j; j < s.length; ++j) {
                s[j] = m[from + j];
            }
            f[n++] = string(s);
            from = i + 1;
        }
    }

    /// The page as a self-contained web page: no links, no fetches. key is the page's name in the program.
    function _html(string memory key) private view returns (string memory) {
        return string.concat(
            '<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><title>',
            name,
            "</title>",
            "<style>body{margin:0;height:100vh;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}canvas{image-rendering:pixelated;width:min(100vw,75vh);height:auto}</style>",
            '<canvas id=c width=360 height=480></canvas><script>P="',
            key,
            '";Z="',
            Base64.encode(art()),
            '";(async()=>{const b=Uint8Array.from(atob(Z),c=>c.charCodeAt(0));(0,eval)(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text())})()</script>'
        );
    }

    function html(uint256 id) external view returns (string memory) {
        return _html(_fields(id)[0]);
    }

    /// The token's JSON, the way OpenSea and the rest read it. Plain text, not base64: there is nothing in it a data: URI minds.
    function uri(uint256 id) public view override returns (string memory) {
        string[8] memory f = _fields(id);
        string memory s = string.concat(
            'data:application/json;utf8,{"name":"',
            f[1],
            '","attributes":[{"trait_type":"Chapter","value":"',
            f[2],
            '"},{"trait_type":"Setting","value":"',
            f[3],
            '"},{"trait_type":"Kind","value":"',
            f[4],
            '"},'
        );
        if (bytes(f[5]).length != 0) s = string.concat(s, '{"trait_type":"Disposition","value":"', f[5], '"},');
        s = string.concat(
            s,
            '{"display_type":"number","trait_type":"Panels","value":',
            f[6],
            '},{"display_type":"number","trait_type":"Choices","value":',
            f[7],
            '}],"description":"A page of Cryptomnesia. ',
            ABOUT,
            '","image":"data:image/png;base64,'
        );
        return string.concat(
            s, Base64.encode(part(1, id)), '","animation_url":"data:text/html;base64,', Base64.encode(bytes(_html(f[0]))), '"}'
        );
    }

    /// The collection's own JSON, for marketplaces: its name, what it is, and the first page's still.
    function contractURI() external view returns (string memory) {
        return string.concat(
            'data:application/json;utf8,{"name":"Cryptomnesia","description":"A choose-your-own-adventure horror story, one token for every page. ',
            ABOUT,
            ' No IPFS, no server.","image":"data:image/png;base64,',
            Base64.encode(part(1, 1)),
            '"}'
        );
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
