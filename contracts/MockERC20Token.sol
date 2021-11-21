// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20Token is ERC20 {
    constructor(uint256 supply) ERC20('Mock', 'MCK') {
        _mint(msg.sender, supply);
    }
}