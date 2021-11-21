// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20Bank {
    IERC20 public tokenContract;
    address public bankOwner;

    constructor(address depositTokenContract, uint256 rewardPoolSize) {}
}
