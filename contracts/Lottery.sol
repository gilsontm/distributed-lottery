// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Import this file to use console.log
import "hardhat/console.sol";

struct Player {
    bool    exists;     /* "Exists?" flag       */
    uint256 serial;     /* Unique player id     */
    address address_;   /* Player address       */
    uint256 value;      /* Value that was bet   */
    bytes32 hash_;      /* Hash that was sent   */
    bool    revealed;   /* "Has revealed?" flag */
}

contract Lottery {

    enum State { OPEN, CLOSED }

    State private state;                                                        /* Lottery is open or closed? */

    uint256 private round;                                                      /* Current round number */
    uint256 private random;                                                     /* Partial random number used to choose winner */
    uint256 private fee_balance;                                                /* Accumulated fees that belong to the owner */
    uint256 private pot_balance;                                                /* Accumulated round prize */

    address private owner;                                                      /* Owner's address */
    uint256 private owner_fee;                                                  /* Number between 1 and 100, indicates fee percentage */
    uint256 private ticket_price;                                               /* Ticket price */

    uint256 private block_when_closed;                                          /* Number of block when lottery last closed */

    uint256 private number_bettors;                                             /* Number of bettors in the current round */
    uint256 private number_contenders;                                          /* Number of contenders in the current round */

    mapping(uint256 => mapping(address => Player)) private bettors;
    mapping(uint256 => address[]) private contenders;

    constructor(uint256 price, uint256 fee) {
        require(fee > 0 && fee < 100,                       "Owner fee must lie between 0 and 100.");
        require(price > 0,                                  "Ticket price must be larger than zero.");

        // Initialize parametrized variables
        owner = msg.sender;
        owner_fee = fee;
        ticket_price = price;

        // Initialize basic control variables
        round = 0;
        random = 0;
        fee_balance = 0;
        pot_balance = 0;
        state = State.OPEN;
        number_bettors = 0;
        number_contenders = 0;
        block_when_closed = 0;
    }

    /* ========= MAIN PUBLIC FUNCTIONS ================== */

    function bet(bytes32 hash_) external payable {
        require(state == State.OPEN,                        "Bets must be open.");
        require(msg.value >= ticket_price,                  "Bet value must meet ticket price.");

        Player storage player = bettors[round][msg.sender];

        require(player.exists == false,                     "A previous bet must not exist.");

        // Write player data to storage
        player.address_ = msg.sender;
        player.value = msg.value;
        player.revealed = false;
        player.exists = true;
        player.hash_ = hash_;
        number_bettors++;

        // Update balances
        uint256 fee = msg.value * owner_fee / 100;
        fee_balance += fee;
        pot_balance += msg.value - fee;

        if (number_bettors >= 10)
            __close_round();
    }

    function reveal(uint256 n) external {
        require(state == State.CLOSED,                      "Bets must be closed.");

        Player storage player = bettors[round][msg.sender];

        require(player.exists == true,                      "A previous bet must exist.");
        require(player.revealed == false,                   "May reveal only once.");
        require(player.hash_ == __get_hash(n, msg.sender),  "Number 'n' must match previous bet.");

        player.revealed = true;
        random = random ^ n;
        contenders[round].push(msg.sender);
        number_contenders++;
    }

    function draw_winner() public {
        require(state == State.CLOSED,                      "Bets must be closed.");
        require(number_contenders > 0,                      "Must have at least one contender.");
        require(block.number >= block_when_closed + 10,     "Must wait for 10 blocks after closed.");

        uint256 winner_number = random % number_contenders;
        address winner = contenders[round][winner_number];
        payable(winner).transfer(pot_balance);

        __reset_round();
    }

    function withdraw() external {
        require(fee_balance > 0,                            "There must be fees to withdraw.");
        require(msg.sender == owner,                        "Only owner can withdraw.");
        payable(owner).transfer(fee_balance);
        fee_balance = 0;
    }

    /* ========= INTERNAL HELPER FUNCTIONS ============== */

    function __close_round() internal {
        require(state == State.OPEN,                        "Bets must be open.");
        state = State.CLOSED;
        block_when_closed = block.number;
    }

    function __reset_round() internal {
        require(state == State.CLOSED,                      "Bets must be closed.");
        round += 1;
        random = 0;
        pot_balance = 0;
        state = State.OPEN;
        number_bettors = 0;
        number_contenders = 0;
    }

    function __get_hash(uint256 n, address sender) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(n, sender));
    }

    /* ========= PUBLIC GETTERS ========================= */

    function isOpen() public view returns (bool) {
        return state == State.OPEN;
    }

    function getRound() public view returns (uint256) {
        return round;
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function getOwnerFee() public view returns (uint256) {
        return owner_fee;
    }

    function getTicketPrice() public view returns (uint256) {
        return ticket_price;
    }

    function getPotBalance() public view returns (uint256) {
        return pot_balance;
    }

    function getFeeBalance() public view returns (uint256) {
        return fee_balance;
    }

}
