const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Lottery", function () {

    async function deployOneLotteryFixture() {

        const [owner, otherAccount] = await ethers.getSigners();

        const fee = 5;
        const price = 100;

        const Lottery = await ethers.getContractFactory("Lottery");
        const lottery = await Lottery.deploy(price, fee);

        return { lottery, price, fee, owner, otherAccount };
    }

    describe("Price, fee and owner", function() {
        it("Should assign price, fee and owner correctly", async function() {
            const { lottery, price, fee, owner } = await loadFixture(deployOneLotteryFixture);

            expect(await lottery.getOwner()).to.equal(owner.address);
            expect(await lottery.getPrice()).to.equal(price);
            expect(await lottery.getFee()).to.equal(fee);
        });

        it("Should start with open bets", async function() {
            const { lottery } = await loadFixture(deployOneLotteryFixture);
            expect(await lottery.isOpen()).to.equal(true);
        });
    });

    describe("Enough money to close bets", function () {
        it ("Should close after a number of bets", async function() {
            const { lottery, price, fee, owner } = await loadFixture(deployOneLotteryFixture);

            expect(await lottery.isOpen()).to.equal(true);

            // Bet 10 times with different accounts
            const number = 0;
            const signers = await ethers.getSigners().slice(0, 10);
            for (const signer of signers) {
                const hash = ethers.utils.solidityKeccak256(["uint256", "address"], [number, signer.address]);
                await lottery.connect(signer).placeBet(hash, { value: price });
            }

            expect(await lottery.getBalance()).to.equal(price * 10);
            expect(await lottery.isOpen()).to.equal(false);
        });
    });


});