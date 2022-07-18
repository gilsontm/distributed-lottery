const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

function getHash(number, address) {
    return ethers.utils.solidityKeccak256(["uint256", "address"], [number, address]);
}


describe("Lottery", function () {

    async function deployEmptyLotteryFixture() {

        const [owner, otherAccount] = await ethers.getSigners();

        const fee = 5;
        const price = 100;

        const Lottery = await ethers.getContractFactory("Lottery");
        const lottery = await Lottery.deploy(price, fee);

        return { lottery, price, fee, owner, otherAccount };
    }

    describe("Basic parameters", function() {
        it("Should assign price, fee and owner correctly", async function() {
            const { lottery, price, fee, owner } = await loadFixture(deployEmptyLotteryFixture);

            expect(await lottery.getOwner()).to.equal(owner.address);
            expect(await lottery.getTicketPrice()).to.equal(price);
            expect(await lottery.getOwnerFee()).to.equal(fee);
        });

        it("Should start with open bets", async function() {
            const { lottery } = await loadFixture(deployEmptyLotteryFixture);
            expect(await lottery.isOpen()).to.equal(true);
        });
    });

    describe("Betting function", function () {

        it("Should have enough money to bet", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            const hash = getHash(0, otherAccount.address);
            await expect(lottery.connect(otherAccount).bet(hash, { value: price - 10 })).to.be.revertedWith(
                "Bet value must meet ticket price."
            );
        });

        it("Same player cannot bet twice", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            const hash = getHash(0, otherAccount.address);
            await lottery.connect(otherAccount).bet(hash, { value: price });

            expect(await lottery.isOpen()).to.equal(true);
            await expect(lottery.connect(otherAccount).bet(hash, { value: price })).to.be.revertedWith(
                "A previous bet must not exist."
            );
        });

        it("Should close after a certain number of bets", async function() {
            const { lottery, price, fee } = await loadFixture(deployEmptyLotteryFixture);

            expect(await lottery.isOpen()).to.equal(true);

            // Bet 10 times with different accounts
            const number = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(number, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.getPotBalance()).to.equal(price * 10 * (100 - fee) / 100);
            expect(await lottery.getFeeBalance()).to.equal(price * 10 * fee / 100);
            expect(await lottery.isOpen()).to.equal(false);
        });

        it("Cannot place bet when bets are closed", async function() {
            const { lottery, price, fee } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const number = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(number, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            // Bet once more
            const [ otherSigner ] = (await ethers.getSigners()).slice(11);
            const hash = getHash(number, otherSigner.address);
            expect(await lottery.isOpen()).to.equal(false);
            await expect(lottery.connect(otherSigner).bet(hash, { value: price })).to.be.revertedWith(
                "Bets must be open."
            );
        });

    });

    describe("Reveal function", function () {
        it("Cannot reveal when bets are still open", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet once
            const number = 0;
            const hash = getHash(number, otherAccount.address);
            await lottery.connect(otherAccount).bet(hash, { value: price })

            expect(await lottery.isOpen()).to.equal(true);
            await expect(lottery.connect(otherAccount).reveal(number)).to.be.revertedWith(
                "Bets must be closed."
            );
        });

        it("Can reveal with right number", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const rightNumber = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(rightNumber, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            // Reveal once with right number
            const [ signer ] = signers;
            await lottery.connect(signer).reveal(rightNumber);
        });

        it("Cannot reveal with wrong number", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const rightNumber = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(rightNumber, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            // Reveal once with wrong number
            const wrongNumber = 1;
            const [ signer ] = signers;
            await expect(lottery.connect(signer).reveal(wrongNumber)).to.be.revertedWith(
                "Number 'n' must match previous bet."
            );
        });

        it("Cannot reveal twice", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const rightNumber = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(rightNumber, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            // Reveal once with right number
            const [ signer ] = signers;
            await lottery.connect(signer).reveal(rightNumber);
            await expect(lottery.connect(signer).reveal(rightNumber)).to.be.revertedWith(
                "May reveal only once."
            );
        });
    });

    describe("Drawing a winner", function () {
        it("Cannot draw winner when bets are open", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            await expect(lottery.connect(otherAccount).draw_winner()).to.be.revertedWith(
                "Bets must be closed."
            );
        });

        it("Cannot draw winner when no numbers were revealed", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const rightNumber = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(rightNumber, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            await expect(lottery.connect(otherAccount).draw_winner()).to.be.revertedWith(
                "Must have at least one contender."
            );
        });

        it("Cannot draw winner when not enough time has passed", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const rightNumber = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(rightNumber, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            // Reveal once with right number
            const [ signer ] = signers;
            await lottery.connect(signer).reveal(rightNumber);

            await expect(lottery.connect(otherAccount).draw_winner()).to.be.revertedWith(
                "Must wait for 10 blocks after closed."
            );
        });

        it("Can draw winner when enough time has passed", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const rightNumber = 0;
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (const signer of signers) {
                const hash = getHash(rightNumber, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            // Reveal once with right number
            const [ signer ] = signers;
            await lottery.connect(signer).reveal(rightNumber);

            // Mine 10 blocks to advance network time
            for (let i = 0; i < 10; i++) {
                await ethers.provider.send('evm_mine');
            }

            // Winner will be the first because of chosen numbers
            const [ winner ] = signers;
            const previousBalance = (await winner.getBalance()).toBigInt();
            const potPrize = (await lottery.getPotBalance()).toBigInt();

            // Draw winner
            await lottery.connect(otherAccount).draw_winner();
            expect(await lottery.getPotBalance()).to.equal(0);
            expect((await winner.getBalance()).toBigInt() - previousBalance).to.equal(potPrize);
            expect(await lottery.getRound()).to.equal(1);
            expect(await lottery.isOpen()).to.equal(true);
        });

        it("Different numbers give different winners", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet 10 times with different accounts
            const signers = (await ethers.getSigners()).slice(0, 10);
            for (let i = 0; i < 10; i++) {
                const signer = signers[i];
                const hash = getHash(i, signer.address);
                await lottery.connect(signer).bet(hash, { value: price });
            }

            expect(await lottery.isOpen()).to.equal(false);

            // Reveal 5 numbers
            for (let i = 0; i < 5; i++) {
                const signer = signers[i];
                await lottery.connect(signer).reveal(i);
            }

            // Mine 10 blocks to advance network time
            for (let i = 0; i < 10; i++) {
                await ethers.provider.send('evm_mine');
            }

            // Winner will be the fourth because of chosen numbers
            const winner = signers[4];
            const previousBalance = (await winner.getBalance()).toBigInt();
            const potPrize = (await lottery.getPotBalance()).toBigInt();

            // Draw winner
            await lottery.connect(otherAccount).draw_winner();
            expect(await lottery.getPotBalance()).to.equal(0);
            expect((await winner.getBalance()).toBigInt() - previousBalance).to.equal(potPrize);
            expect(await lottery.getRound()).to.equal(1);
            expect(await lottery.isOpen()).to.equal(true);
        });
    });

    describe("Withdrawing fees", function () {
        it("Cannot withdraw when there are no fees", async function() {
            const { lottery, price, fee, owner } = await loadFixture(deployEmptyLotteryFixture);

            expect(await lottery.getFeeBalance()).to.equal(0);
            await expect(lottery.connect(owner).withdraw()).to.be.revertedWith(
                "There must be fees to withdraw."
            );
        });

        it("Can withdraw when there are fees", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet once
            const rightNumber = 0;
            const hash = getHash(rightNumber, otherAccount.address);
            await lottery.connect(otherAccount).bet(hash, { value: price });

            const expectedFee = price * fee / 100;

            expect(await lottery.getFeeBalance()).to.equal(expectedFee);

            const previousBalance = (await owner.getBalance()).toBigInt();
            const transaction = await lottery.connect(owner).withdraw();

            // Calculate gas spent
            const receipt = await transaction.wait();
            const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);

            expect(await lottery.getFeeBalance()).to.equal(0);
            expect((await owner.getBalance()).toBigInt() - previousBalance).to.equal(expectedFee - gasSpent);
        });

        it("Only owner can withdraw", async function() {
            const { lottery, price, fee, owner, otherAccount } = await loadFixture(deployEmptyLotteryFixture);

            // Bet once
            const rightNumber = 0;
            const hash = getHash(rightNumber, otherAccount.address);
            await lottery.connect(otherAccount).bet(hash, { value: price });

            await expect(lottery.connect(otherAccount).withdraw()).to.be.revertedWith(
                "Only owner can withdraw."
            );
        });
    });

});