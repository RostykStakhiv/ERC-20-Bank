const ERC20Bank = artifacts.require("ERC20Bank");
const RinkebyATRACContractAddress =
  "0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882";
const rewardPoolSize = BigInt(1000 * 10 ** 18);
const T = 3600;

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    return;
  } else if (network == "rinkeby") {
    await deployer.deploy(
      ERC20Bank,
      RinkebyATRACContractAddress,
      rewardPoolSize,
      3600,
      {
        from: sender,
      }
    );
  }
};
