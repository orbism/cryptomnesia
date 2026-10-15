// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Cryptomnesia} from "../src/Cryptomnesia.sol";

interface Vm {
    function prank(address) external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
}

contract CryptomnesiaTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Cryptomnesia c;
    address reader = address(0xBEEF);

    function setUp() public {
        c = new Cryptomnesia("Cryptomnesia", "CRYPT", 0.003 ether, 2, address(this), address(this), 500);
        string[] memory p = new string[](2);
        p[0] = "lane";
        p[1] = "harrow";
        c.setPages(p);
        c.addChunk(hex"0102");
        c.addChunk(hex"030405");
        // two stills, three bytes and two: the table says the first ends at 9 and the second at 11. sent as two pieces, the first padded out to a full one
        bytes memory head = abi.encodePacked(hex"00000900000b", hex"aabbcc", hex"ddee");
        bytes memory full = new bytes(24575);
        for (uint256 i; i < head.length; ++i) {
            full[i] = head[i];
        }
        c.addCover(full);
        c.addCover(hex"ff");
        vm.deal(reader, 1 ether);
    }

    receive() external payable {}

    function testArtIsJoinedInOrder() public view {
        require(keccak256(c.art()) == keccak256(hex"0102030405"), "art");
    }

    function testStillsAreCutFromTheTable() public view {
        require(
            keccak256(c.cover(1)) == keccak256(hex"aabbcc") && keccak256(c.cover(2)) == keccak256(hex"ddee"), "cover"
        );
    }

    function testAStillCanRunOverTheJoin() public {
        c.clearCovers();
        bytes memory full = new bytes(24575);
        full[2] = 0x06; // page 1 ends at 6: it is empty
        full[3] = 0x00;
        full[4] = 0x60;
        full[5] = 0x01; // page 2 ends at 24577: two bytes into the next piece
        full[24574] = 0x11;
        c.addCover(full);
        c.addCover(hex"2233");
        bytes memory got = c.cover(2);
        require(got.length == 24571 && got[24568] == 0x11 && got[24569] == 0x22 && got[24570] == 0x33, "join");
    }

    function testMintTakesExactPriceAndCounts() public {
        vm.prank(reader);
        c.mint{value: 0.006 ether}(2, 2);
        require(c.balanceOf(reader, 2) == 2 && c.totalSupply(2) == 2, "minted");
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.SoldOut.selector);
        c.mint{value: 0.003 ether}(2, 1);
    }

    function testMintRefusesWrongPriceAndUnknownPage() public {
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.WrongPrice.selector);
        c.mint{value: 0.002 ether}(1, 1);
        vm.prank(reader);
        vm.expectRevert(Cryptomnesia.NoSuchPage.selector);
        c.mint{value: 0.003 ether}(3, 1);
    }

    function testLockFreezesArtAndPages() public {
        c.lock();
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.addChunk(hex"06");
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.clearChunks();
        vm.expectRevert(Cryptomnesia.Locked.selector);
        c.addCover(hex"06");
    }

    function testWithdrawPaysOwner() public {
        vm.prank(reader);
        c.mint{value: 0.003 ether}(1, 1);
        uint256 before = address(this).balance;
        c.withdraw();
        require(address(this).balance == before + 0.003 ether, "paid");
    }

    function testUriIsAJsonDataUri() public view {
        bytes memory u = bytes(c.uri(1));
        require(u.length > 29 && u[0] == "d" && u[5] == "a", "uri");
        (address to, uint256 amt) = c.royaltyInfo(1, 1 ether);
        require(to == address(this) && amt == 0.05 ether, "royalty");
    }
}
