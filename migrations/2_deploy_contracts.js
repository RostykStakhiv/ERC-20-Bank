const ERC20Bank = artifacts.require('ERC20Bank');

module.exports = function (deployer) {
    deployer.deploy(ERC20Bank, "0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882", 1000);
}