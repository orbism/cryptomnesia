// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Cryptomnesia} from "../src/Cryptomnesia.sol";

interface Vm {
    function prank(address) external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function parseJsonString(string calldata, string calldata) external pure returns (string memory);
    function parseJsonUint(string calldata, string calldata) external pure returns (uint256);
}

// takes what it is sent, and asks for one more each time, to see the cap hold against a mint from inside a mint
contract Greedy {
    Cryptomnesia c;

    constructor(Cryptomnesia c_) {
        c = c_;
    }

    function go() external payable {
        c.mint{value: 0.003 ether}(1, 1);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        if (address(this).balance >= 0.003 ether) c.mint{value: 0.003 ether}(1, 1);
        return this.onERC1155Received.selector;
    }
}

contract CryptomnesiaTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Cryptomnesia c;
    address reader = address(0xBEEF);
    bytes constant LANE = "lane|The Lane|Nine Lit|Lamplight|Start|The Stray|1|3";
    bytes constant HARROW = "harrow|Harrow|The End|Town|Ending||4|0";

    // a store of two pages as the contract wants it: how many, where each part ends, the parts
    function two(bytes memory a, bytes memory b) internal pure returns (bytes memory) {
        return abi.encodePacked(uint16(2), uint24(8 + a.length), uint24(8 + a.length + b.length), a, b);
    }

    function book() internal {
        c.add(0, hex"0102");
        c.add(0, hex"030405");
        c.add(1, two(hex"aabbcc", hex"ddee"));
        c.add(2, two(LANE, HARROW));
    }

    function setUp() public {
        c = new Cryptomnesia(0.003 ether, 2, address(this), address(this), 500);
        book();
        vm.deal(reader, 1 ether);
    }

    receive() external payable {}

    function testArtIsJoinedInOrder() public view {
        require(keccak256(c.art()) == keccak256(hex"0102030405"), "art");
    }

    function testPartsAreCutFromTheTable() public view {
        require(keccak256(c.part(1, 1)) == keccak256(hex"aabbcc") && keccak256(c.part(1, 2)) == keccak256(hex"ddee"), "stills");
        require(keccak256(c.part(2, 2)) == keccak256(HARROW), "names");
    }

    function testAPartCanRunOverTheJoin() public {
        c.clear(1);
        bytes memory full = new bytes(24575);
        full[1] = 0x02; // two pages
        full[4] = 0x08; // page 1 ends where the table does: it is empty
        full[6] = 0x60;
        full[7] = 0x01; // page 2 ends at 24577: two bytes into the next piece
        full[24574] = 0x11;
        c.add(1, full);
        c.add(1, hex"2233");
        bytes memory got = c.part(1, 2);
        require(got.length == 24569 && got[24566] == 0x11 && got[24567] == 0x22 && got[24568] == 0x33, "join");
        require(c.part(1, 1).length == 0, "empty");
        c.lock(); // and the two pieces make a whole store
    }

    function testUriIsJsonWithNameAndTraits() public view {
        string memory u = c.uri(1);
        string memory json = string(slice(bytes(u), 27));
        require(keccak256(bytes(u)) != keccak256(""), "uri");
        require(keccak256(bytes(vm.parseJsonString(json, ".name"))) == keccak256("The Lane"), "name");
        require(keccak256(bytes(vm.parseJsonString(json, ".attributes[3].value"))) == keccak256("The Stray"), "disposition");
        require(vm.parseJsonUint(json, ".attributes[5].value") == 3, "choices");
        json = string(slice(bytes(c.uri(2)), 27)); // no disposition: panels come fourth
        require(vm.parseJsonUint(json, ".attributes[3].value") == 4, "panels");
        json = string(slice(bytes(c.contractURI()), 27));
        require(keccak256(bytes(vm.parseJsonString(json, ".name"))) == keccak256("Cryptomnesia"), "collection");
    }

    function slice(bytes memory b, uint256 from) internal pure returns (bytes memory out) {
        out = new bytes(b.length - from);
        for (uint256 i; i < out.length; ++i) {
            out[i] = b[from + i];
        }
    }

    function testMintOpensAtLockAndStart() public {
        c.start();
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.NoSuchPage.selector);
        c.mint{value: 0.003 ether}(1, 1); // started, but not locked: nothing to mint
        require(c.minted().length == 0, "closed");
        c.pause();
        c.lock();
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.Paused.selector);
        c.mint{value: 0.003 ether}(1, 1); // locked, but paused
        c.start();
        vm.prank(reader);
        c.mint{value: 0.006 ether}(2, 2);
        uint256[] memory all = c.minted();
        require(c.balanceOf(reader, 2) == 2 && all.length == 2 && all[0] == 0 && all[1] == 2, "minted");
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.SoldOut.selector);
        c.mint{value: 0.003 ether}(2, 1);
    }

    function testMintRefusesWrongPriceNoneAndUnknownPage() public {
        c.lock();
        c.start();
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.WrongPrice.selector);
        c.mint{value: 0.002 ether}(1, 1);
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.NoSuchPage.selector);
        c.mint{value: 0.003 ether}(3, 1);
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.NoSuchPage.selector);
        c.mint{value: 0.003 ether}(0, 1);
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.NoneAsked.selector);
        c.mint(1, 0);
    }

    function testTheCapHoldsAgainstAMintFromInsideAMint() public {
        c.lock();
        c.start();
        Greedy g = new Greedy(c);
        vm.expectRevert(Cryptomnesia.SoldOut.selector);
        g.go{value: 0.009 ether}();
    }

    function testLockRefusesAnUnfinishedBook() public {
        Cryptomnesia d = new Cryptomnesia(0.003 ether, 0, address(this), address(this), 0);
        vm.expectRevert(Cryptomnesia.NotReady.selector);
        d.lock(); // nothing
        d.add(0, hex"01");
        d.add(2, two(LANE, HARROW));
        vm.expectRevert(Cryptomnesia.NotReady.selector);
        d.lock(); // no stills
        d.add(1, abi.encodePacked(uint16(1), uint24(6), hex"aa"));
        vm.expectRevert(Cryptomnesia.NotReady.selector);
        d.lock(); // stills for one page, names for two
        d.clear(1);
        d.add(1, abi.encodePacked(uint16(2), uint24(9), uint24(10), hex"aa"));
        vm.expectRevert(Cryptomnesia.NotReady.selector);
        d.lock(); // the last still is missing
        d.clear(1);
        d.add(1, abi.encodePacked(uint16(2), uint24(9), uint24(10), hex"aa"));
        d.add(1, hex"bb");
        vm.expectRevert(Cryptomnesia.NotReady.selector);
        d.lock(); // the first piece is short
        d.clear(1);
        d.add(1, two(hex"aa", hex"bb"));
        d.lock();
        require(d.pageCount() == 2, "locked");
    }

    function testLockFreezesEverything() public {
        c.lock();
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.add(0, hex"06");
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.clear(1);
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.clear(2);
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.lock();
    }

    function testPausedFromTheStartAndOnlyTheOwnerStartsOrPauses() public {
        require(c.paused(), "born paused");
        c.lock();
        require(c.paused(), "still paused once locked");
        bytes memory no = abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", reader);
        vm.prank(reader);
        vm.expectRevert(no);
        c.start();
        c.start();
        vm.prank(reader);
        c.mint{value: 0.003 ether}(1, 1);
        vm.prank(reader);
        vm.expectRevert(no);
        c.pause();
        c.pause();
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.Paused.selector);
        c.mint{value: 0.003 ether}(1, 1);
        c.start();
        vm.prank(reader);
        c.mint{value: 0.003 ether}(1, 1);
        require(c.balanceOf(reader, 1) == 2 && c.totalSupply(1) == 2, "minted twice, around a pause");
    }

    function testOnlyTheOwnerStores() public {
        bytes memory no = abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", reader);
        vm.prank(reader);
        vm.expectRevert(no);
        c.add(0, hex"06");
        vm.prank(reader);
        vm.expectRevert(no);
        c.lock();
        vm.prank(reader);
        vm.expectRevert(no);
        c.withdraw();
    }

    function testWithdrawPaysOwnerWhoCannotLeave() public {
        c.lock();
        c.start();
        vm.prank(reader);
        c.mint{value: 0.003 ether}(1, 1);
        uint256 before = address(this).balance;
        c.withdraw();
        require(address(this).balance == before + 0.003 ether, "paid");
        vm.expectRevert(Cryptomnesia.NeedsOwner.selector);
        c.renounceOwnership();
    }

    function testInterfacesAndRoyalty() public view {
        require(c.supportsInterface(0x01ffc9a7) && c.supportsInterface(0xd9b67a26) && c.supportsInterface(0x0e89341c), "1155");
        require(c.supportsInterface(0x2a55205a) && !c.supportsInterface(0xffffffff), "2981");
        (address to, uint256 amt) = c.royaltyInfo(1, 1 ether);
        require(to == address(this) && amt == 0.05 ether, "royalty");
    }
}
