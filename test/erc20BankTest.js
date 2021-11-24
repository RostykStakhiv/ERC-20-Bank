const contractAddressCalculator = require("../utils/contract_address_calculator.js");
const utils = require("../utils/utils.js");
const truffleAssert = require("truffle-assertions");

const ERC20Bank = artifacts.require("ERC20Bank");
const MockToken = artifacts.require("MockERC20Token");

contract("ERC20Bank", async (accounts) => {
  var bankContract;
  var erc20Token;
  let contractDeployer = accounts[0];

  let tokenDecimals = new web3.utils.BN(10).pow(new web3.utils.BN(18));
  let rewardPoolSize = new web3.utils.BN(1000).mul(tokenDecimals);
  let userTokenPoolSize = new web3.utils.BN(8000).mul(tokenDecimals);
  let mockTokenSupply = rewardPoolSize.add(userTokenPoolSize);
  const T = 3600;
  const smallTimeOffset = T / 100;

  beforeEach(async () => {
    erc20Token = await MockToken.new(mockTokenSupply, {
      from: contractDeployer,
    });

    let nonce = await web3.eth.getTransactionCount(contractDeployer);
    let nonceWhenDeployingBankContract = nonce + 1;

    let bankContractAddress =
      await contractAddressCalculator.calculateContractAddressFromAccountWithNonce(
        contractDeployer,
        nonceWhenDeployingBankContract,
        web3.utils.sha3,
      );
    await erc20Token.approve(bankContractAddress, rewardPoolSize, {
      from: contractDeployer,
    });

    let tokenContractAddress = await erc20Token.address;

    bankContract = await ERC20Bank.new(
      tokenContractAddress,
      rewardPoolSize,
      T,
      { from: contractDeployer }
    );
  });

  it("it is assigned an address after deployment", () => {
    assert(bankContract.address != null);
  });

  it("its owner becomes the address that deployed the contract", async () => {
    let ownerAddress = await bankContract.owner.call();

    assert.equal(ownerAddress, contractDeployer);
  });

  it("its token balance is equal to the reward pool size after bank contract deployment", async () => {
    let bankTokenBalance = await erc20Token.balanceOf(bankContract.address);
    assert.equal(bankTokenBalance.eq(rewardPoolSize), true);
  });

  describe("Deposit functionality:", function () {
    let user = accounts[1];

    beforeEach(async () => {
      await erc20Token.transfer(user, userTokenPoolSize, {
        from: contractDeployer,
      });

      let userBalance = await erc20Token.balanceOf(user);
      assert.equal(
        userBalance > new web3.utils.BN(0),
        true,
        "User balance is 0. Failed to provide user with tokens to test staking"
      );

      await erc20Token.approve(bankContract.address, userBalance, {
        from: user,
      });
    });

    it("contract's balance gets increased by the deposit amount after user has deposited", async () => {
      let bankTokenBalance = await erc20Token.balanceOf(bankContract.address);
      let userBalance = await erc20Token.balanceOf(user);

      await bankContract.deposit(userBalance, { from: user });

      let updatedBankTokenBalance = await erc20Token.balanceOf(
        bankContract.address
      );

      assert.equal(
        updatedBankTokenBalance > bankTokenBalance,
        true,
        "Tokens have not been transfered from user to the contract"
      );
    });

    it("user's stake gets increased by the deposited amount", async () => {
      let userBalance = await erc20Token.balanceOf(user);

      let userStakeBeforeDeposit = await bankContract.stakeOf(user);
      await bankContract.deposit(userBalance, { from: user });

      let userStake = await bankContract.stakeOf(user);

      let expactedUserStake = userStakeBeforeDeposit.add(userBalance);
      assert.equal(expactedUserStake.eq(userStake), true);
    });

    it("user can stake multiple times", async () => {
      let userBalance = await erc20Token.balanceOf(user);
      let userStake1 = userBalance.div(new web3.utils.BN(2));
      let userStake2 = userBalance.sub(userStake1);

      let userStakeBeforeDeposits = await bankContract.stakeOf(user);
      await bankContract.deposit(userStake1, { from: user });

      let userStakeBalanceAfterStake1 = await bankContract.stakeOf(user);

      assert.equal(
        userStakeBalanceAfterStake1.eq(userStakeBeforeDeposits.add(userStake1)),
        true,
        "User stake balance after stake #1 is incorrect"
      );

      await bankContract.deposit(userStake2, { from: user });

      let userStake = await bankContract.stakeOf(user);

      let expactedUserStake = userStakeBeforeDeposits
        .add(userStake1)
        .add(userStake2);
      assert.equal(expactedUserStake.eq(userStake), true);
    });

    it("users cannot deposit after T time has passed since contract deployment", async () => {
      await utils.advanceTimeAndBlock(T);
      let userBalance = await erc20Token.balanceOf(user);
      await truffleAssert.reverts(
        bankContract.deposit(userBalance, { from: user })
      );
    });
  });

  describe("Withdraw functionality", function () {
    let user = accounts[1];
    let initialUserBalance;

    beforeEach(async () => {
      await erc20Token.transfer(user, userTokenPoolSize, {
        from: contractDeployer,
      });

      initialUserBalance = userTokenPoolSize;

      await erc20Token.approve(bankContract.address, initialUserBalance, {
        from: user,
      });
    });

    it("Users cannot withdraw tokens before 2T time has passed since contract deployment", async () => {
      await bankContract.deposit(initialUserBalance, { from: user });
      await truffleAssert.reverts(bankContract.withdraw({ from: user }));
    });

    it("Users cannot withdraw if they haven't deposited", async () => {
      await truffleAssert.reverts(bankContract.withdraw({ from: user }));
    });

    it("Users cannot withdraw if they have already withdrawn", async () => {
      let userStake = new web3.utils.BN(100).mul(tokenDecimals);
      await bankContract.deposit(userStake, { from: user });
      await utils.advanceTimeAndBlock(2 * T + smallTimeOffset);

      await bankContract.withdraw({ from: user });
      await truffleAssert.reverts(bankContract.withdraw({ from: user }));
    });

    describe("Reward calculation and withdrawal", function () {
      let userStake = new web3.utils.BN(100).mul(tokenDecimals);
      let userBalanceBeforeStake;
      let userBalanceAfterWithdrawal;
      let stakePoolSize;

      let R1InitialSize = rewardPoolSize.div(new web3.utils.BN(5));
      let R3InitialSize = rewardPoolSize.div(new web3.utils.BN(2));
      let R2InitialSize = rewardPoolSize.sub(R1InitialSize).sub(R3InitialSize);

      beforeEach(async () => {
        userBalanceBeforeStake = await erc20Token.balanceOf(user);
        console.log(
          "User Balance before stake:",
          userBalanceBeforeStake.div(tokenDecimals).toString()
        );

        console.log("User's stake:", userStake.div(tokenDecimals).toString());

        await bankContract.deposit(userStake, { from: user });
        stakePoolSize = await bankContract.stakePoolSize();

        console.log(
          "Stake Pool Size: ",
          stakePoolSize.div(tokenDecimals).toString()
        );
      });

      it("User can withdraw only R1 reward if they decide to withdraw in time period from 2T to 3T", async () => {
        console.log("R1 size: ", R1InitialSize.div(tokenDecimals).toString());

        await utils.advanceTimeAndBlock(2 * T + smallTimeOffset);
        await bankContract.withdraw({ from: user });

        userBalanceAfterWithdrawal = await erc20Token.balanceOf(user);
        console.log(
          "User balance after withdrawal: ",
          userBalanceAfterWithdrawal.div(tokenDecimals).toString()
        );

        let expectedUserReward = userStake
          .mul(R1InitialSize)
          .div(stakePoolSize);

        console.log(
          "Expected user reward: ",
          expectedUserReward.div(tokenDecimals).toString()
        );
        let expectedUserBalance =
          userBalanceBeforeStake.add(expectedUserReward);

        assert.equal(expectedUserBalance.eq(userBalanceAfterWithdrawal), true);
      });

      it("User can withdraw R1 and R2 reward if they decide to withdraw in time period from 3T to 4T", async () => {
        console.log("R1 size: ", R1InitialSize.div(tokenDecimals).toString());
        console.log("R2 size: ", R2InitialSize.div(tokenDecimals).toString());

        await utils.advanceTimeAndBlock(3 * T + smallTimeOffset);
        await bankContract.withdraw({ from: user });

        userBalanceAfterWithdrawal = await erc20Token.balanceOf(user);
        console.log(
          "User Balance after withdrawal:",
          userBalanceAfterWithdrawal.div(tokenDecimals).toString()
        );
        let R1expectedUserReward = userStake
          .mul(R1InitialSize)
          .div(stakePoolSize);
        let R2expectedUserReward = userStake
          .mul(R2InitialSize)
          .div(stakePoolSize);

        let expectedUserReward = R1expectedUserReward.add(R2expectedUserReward);
        console.log(
          "Expected user reward: ",
          expectedUserReward.div(tokenDecimals).toString()
        );

        let expectedUserBalance =
          userBalanceBeforeStake.add(expectedUserReward);
        assert.equal(expectedUserBalance.eq(userBalanceAfterWithdrawal), true);
      });

      it("User can withdraw R1, R2 and R3 reward if they decide to withdraw in time period after 4T", async () => {
        console.log("R1 size: ", R1InitialSize.div(tokenDecimals).toString());
        console.log("R2 size: ", R2InitialSize.div(tokenDecimals).toString());
        console.log("R3 size: ", R3InitialSize.div(tokenDecimals).toString());

        await utils.advanceTimeAndBlock(4 * T + smallTimeOffset);
        await bankContract.withdraw({ from: user });

        userBalanceAfterWithdrawal = await erc20Token.balanceOf(user);
        console.log(
          "User Balance after withdrawal:",
          userBalanceAfterWithdrawal.div(tokenDecimals).toString()
        );
        let R1expectedUserReward = userStake
          .mul(R1InitialSize)
          .div(stakePoolSize);
        let R2expectedUserReward = userStake
          .mul(R2InitialSize)
          .div(stakePoolSize);
        let R3expectedUserReward = userStake
          .mul(R3InitialSize)
          .div(stakePoolSize);

        let expectedUserReward =
          R1expectedUserReward.add(R2expectedUserReward).add(
            R3expectedUserReward
          );
        console.log(
          "Expected user reward: ",
          expectedUserReward.div(tokenDecimals).toString()
        );

        let expectedUserBalance =
          userBalanceBeforeStake.add(expectedUserReward);
        assert.equal(expectedUserBalance.eq(userBalanceAfterWithdrawal), true);
      });

      it("Only bank owner can withdraw the remaining reward pool", async () => {
        await utils.advanceTimeAndBlock(4 * T + smallTimeOffset);

        //user is not bank owner so this call should fail
        await truffleAssert.reverts(
          bankContract.withdrawRemainingRewardPool({ from: user }),
          _,
          "Account that is not a bank owner has been able to withdraw remaining reward pool"
        );
      });

      it("Bank owner is able to withdraw the remaining reward pool after 4T has passed", async () => {
        await utils.advanceTimeAndBlock(4 * T + smallTimeOffset);

        let bankOwnerBalanceBeforeRewardPoolWithdrawal =
          await erc20Token.balanceOf(contractDeployer);

        console.log(
          "Bank contract owner's balance before withdrawal: ",
          bankOwnerBalanceBeforeRewardPoolWithdrawal
            .div(tokenDecimals)
            .toString()
        );

        await bankContract.withdrawRemainingRewardPool({
          from: contractDeployer,
        });

        let bankOwnerBalanceAfterRewardPoolWithdrawal =
          await erc20Token.balanceOf(contractDeployer);

        console.log(
          "Bank contract owner's balance after withdrawal: ",
          bankOwnerBalanceAfterRewardPoolWithdrawal
            .div(tokenDecimals)
            .toString()
        );

        let expectedBankOwnerBalance =
          bankOwnerBalanceBeforeRewardPoolWithdrawal.add(rewardPoolSize);

        assert.equal(
          expectedBankOwnerBalance.cmp(
            bankOwnerBalanceAfterRewardPoolWithdrawal
          ),
          0,
          "Bank owner should only be able to withdraw the remaining reward pool"
        );
      });

      it("Bank owner cannot withdraw remaining reward pool until 4T time has passed if some users have not withdrawn yet", async () => {
        await truffleAssert.reverts(
          bankContract.withdrawRemainingRewardPool({ from: contractDeployer }),
          _,
          "Bank owner IS ABLE TO WITHDRAW reward pool even if SOME USERS HAVE NOT WITHDRAWN yet"
        );

        await utils.advanceTimeAndBlock(2 * T + smallTimeOffset);
        await bankContract.withdraw({ from: user });

        await bankContract.withdrawRemainingRewardPool({
          from: contractDeployer,
        });
      });
    });
  });
});
