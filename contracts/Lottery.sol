// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Import this file to use console.log
import "hardhat/console.sol";

contract Lottery {

    bool private open = false;

    uint256 private round;
    address private owner;
    uint256 private ownerFee;
    uint256 private ticketPrice;

    uint256 private balance;

    uint256 private random;

    mapping(uint256 => mapping(address => bytes32)) registers;
    mapping(uint256 => mapping(address => bool)) revealers;
    mapping(uint256 => address[]) players;

    uint256 numBetters;
    uint256 numPlayers;

    constructor(uint256 price, uint256 fee) {
        require(fee > 0 && fee < 100, "Fee should be between 0 and 100.");
        require(price > 0, "Ticket price should be larger than zero.");

        round = 0;
        random = 0;
        balance = 0;
        numBetters = 0;
        numPlayers = 0;
        open = true;
        ownerFee = fee;
        owner = msg.sender;
        ticketPrice = price;
    }

    function placeBet(bytes32 hashed) external payable {
        require(open, "Bets are closed right now.");
        require(msg.value >= ticketPrice, "Minimum ticket price was not met.");
        registers[round][msg.sender] = hashed;
        revealers[round][msg.sender] = false;
        balance += msg.value;
        numBetters += 1;

        if (numBetters >= 10)
            __closeBets();
    }

    function reveal(uint256 N) external {
        require(!open, "Bets are still open.");
        require(registers[round][msg.sender] == __getHash(N, msg.sender), "Hash not registered.");
        require(!revealers[round][msg.sender], "Only allowed to reveal once.");

        revealers[round][msg.sender] = true;
        players[round].push(msg.sender);
        random = random ^ N;
        numPlayers += 1;

        if (numPlayers >= numBetters / 2)
            __awardPrize();
    }

    function __awardPrize() internal {
        require(numPlayers > 0, "At least one player must have revealed.");
        address winner = players[round][random % numPlayers];
        uint256 fees = balance * ownerFee / 100;
        payable(winner).transfer(balance - fees);
        payable(owner).transfer(fees);
        __resetRound();
    }

    function __resetRound() private {
        require(!open, "Bets are still open.");
        round += 1;
        random = 0;
        balance = 0;
        numBetters = 0;
        numPlayers = 0;
        open = true;
    }

    function __closeBets() internal {
        require(open, "Bets are already closed.");
        open = false;
    }

    function __getHash(uint256 N, address sender) internal pure returns (bytes32) {
        return keccak256(abi.encode(N, sender));
    }

    /* public getters */

    function getOwner() public view returns (address) {
        return owner;
    }

    function getFee() public view returns (uint256) {
        return ownerFee;
    }

    function getPrice() public view returns (uint256) {
        return ticketPrice;
    }

    function getBalance() public view returns (uint256) {
        return balance;
    }

    function isOpen() public view returns (bool) {
        return open;
    }

    /* public getters */

}
