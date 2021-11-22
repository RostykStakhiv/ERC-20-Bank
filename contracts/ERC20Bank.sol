// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ERC20Bank
 * @notice This smart contract enables anyone to deposit an amount X of ERC-20 tokens to their savings (staking) account.
 * The bank smart contract also contains an additional token reward pool of R ERC-20 tokens, deposited to the contract by the contract owner (bank owner)
 * at contract deployment.
 */
contract ERC20Bank is Ownable {
    ///uint128 is a VERY BIG number for the timestamp that should cover our needs for sure, even uint64 would be enough, but if we use
    ///uint64 then those 2 variables will take only 128 bits of a 256 bit slot and because all other variables are uint256 they will not fit into the half-empty slot anyway
    uint128 public T;
    uint128 public T0;

    uint256 private R1;
    uint256 private R2;
    uint256 private R3;

    uint256 public stakePoolSize;

    mapping(address => uint256) private stakes;

    ERC20 public tokenContract;

    /**
     * @param depositTokenContract The addrss of the ERC-20 contract tokens of which users will stake into the bank
     * @param rewardPoolSize The amount of ERC-20 tokens that the bank owner transfers to the reward pool at bank contract deployment
     * @param t Time constant which is going to be used for calculations like reward amount, tokens lock period, etc.
     *
     * @notice IMPORTANT: The smart contract assumes that creator has called 'approve' method of 'depositTokenContract' ERC-20 contract with amount
     * greater than or equal to the 'rewardPoolSize' to be able to transfer reward pool to the bank contract.
     */
    constructor(
        address depositTokenContract,
        uint256 rewardPoolSize,
        uint128 t
    ) {
        tokenContract = ERC20(depositTokenContract);
        tokenContract.transferFrom(msg.sender, address(this), rewardPoolSize);

        T0 = uint128(block.timestamp);
        T = t;
        R3 = rewardPoolSize / 2; //50% of reward pool
        R1 = rewardPoolSize / 5; //20% of reward pool
        R2 = rewardPoolSize - R1 - R3; // Reward pool - R1 - R3 equals R2
    }

    function withdrawRemainingRewardPool() public onlyOwner {
        /// Overflow here is handled by solidityy as starting from solidity 0.8.0 all operations are checked by default
        /// We should handle overflow here to avoid the case where contract owner can potentially manipulate the contract in the following way:
        /// If contract owner passes T big enough that it will overflow when we calculate T0 + 4*T they will be able to withdraw reward pool before 4T has passed or before
        /// every user has withdrawn their reward
        bool hasDepositPeriodPassed = block.timestamp > T0 + T;

        require(
            hasDepositPeriodPassed,
            "Owner cannot withdraw before the end of deposit period"
        );

        bool has4Tpassed = block.timestamp > T0 + 4 * T;
        bool haveAllUsersWithdrawn = stakePoolSize == 0;
        bool canOwnerWithdraw = has4Tpassed || haveAllUsersWithdrawn;

        require(
            canOwnerWithdraw,
            "Bank owner cannot withdraw before 4T has passed or before all users have withdrawn"
        );

        tokenContract.transfer(owner(), tokenContract.balanceOf(address(this)));
    }

    function deposit(uint256 amount) public {
        uint256 depositPeriodClosingTime = T0 + T;
        require(
            block.timestamp < depositPeriodClosingTime,
            "Deposit time period ended"
        );
        require(amount > 0, "Deposit should be greater than 0");

        tokenContract.transferFrom(msg.sender, address(this), amount);

        stakes[msg.sender] = stakes[msg.sender] + amount;
        stakePoolSize += amount;
    }

    function withdraw() public {
        require(!_areTokensLocked(), "Tokens are locked");

        uint256 stake = stakes[msg.sender];
        require(stake > 0, "Your staking account is empty");

        uint256 stakingRewardFromR1;
        uint256 stakingRewardFromR2;
        uint256 stakingRewardFromR3;

        if (block.timestamp > T0 + 4 * T) {
            stakingRewardFromR1 = _calculateStakingRewardFromRewardPool(R1);
            stakingRewardFromR2 = _calculateStakingRewardFromRewardPool(R2);
            stakingRewardFromR3 = _calculateStakingRewardFromRewardPool(R3);

            R1 -= stakingRewardFromR1;
            R2 -= stakingRewardFromR2;
            R3 -= stakingRewardFromR3;
        } else if (block.timestamp > T0 + 3 * T) {
            stakingRewardFromR1 = _calculateStakingRewardFromRewardPool(R1);
            stakingRewardFromR2 = _calculateStakingRewardFromRewardPool(R2);

            R1 -= stakingRewardFromR1;
            R2 -= stakingRewardFromR2;
        } else if (block.timestamp > T0 + 2 * T) {
            stakingRewardFromR1 = _calculateStakingRewardFromRewardPool(R1);

            R1 -= stakingRewardFromR1;
        }

        uint256 stakingReward = stakingRewardFromR1 +
            stakingRewardFromR2 +
            stakingRewardFromR3;

        tokenContract.transfer(msg.sender, stake + stakingReward);
    }

    function stakeOf(address account) public view returns (uint256) {
        return stakes[account];
    }

    function _areTokensLocked() private view returns (bool) {
        ///According to the requirements "From moment t0+T to t0+2T, users cannot withdraw their tokens" and "If the user tries to remove tokens before T time has elapsed
        ///since they have deposited, the transaction should fail". That means that user should not be able to
        ///withdraw their funds up until t0 + 2*T has passed
        uint256 lockPeriodEndTime = T0 + 2 * T;
        return block.timestamp < lockPeriodEndTime;
    }

    function _calculateStakingRewardFromRewardPool(uint256 rewardPool)
        private
        view
        returns (uint256)
    {
        uint256 stake = stakes[msg.sender];
        return (stake * rewardPool) / stakePoolSize;
    }
}
