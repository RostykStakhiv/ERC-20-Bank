var RLP = require("rlp");
let contractAddressCalculator = require("../utils/contract_address_calculator.js");

const ERC20Bank = artifacts.require("ERC20Bank");
const ERC20 = artifacts.require("ERC20");
const RinkebyTRACContractAddress =
  "0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882";
const RinkebyRUSDContractAddress = "0x78052C14713a1fd5861c2Fd63A441ea2145BD76c";
const RopstenRUSDContractAddress = "0x8f84903e119cd09637BD897a7524E93Bef8904D3";
const rewardPoolSize = BigInt(1000 * 10 ** 18);
const T = 3600;

module.exports = async function (deployer, network, accounts) {
  let erc20TokenContractAddress;
  let contractDeployer = accounts[0];

  if (network == "development") {
    return;
  } else if (network == "rinkeby") {
    erc20TokenContractAddress = RinkebyTRACContractAddress;
  } else if (network == "ropsten") {
    erc20TokenContractAddress = RopstenRUSDContractAddress;
  }

  let erc20Instance = await ERC20.at(erc20TokenContractAddress);

  let nonce = await web3.eth.getTransactionCount(contractDeployer);
  let nonceWhenDeployingBankContract = nonce + 1;

  let expectedBankContractAddress =
    await contractAddressCalculator.calculateContractAddressFromAccountWithNonce(
      contractDeployer,
      nonceWhenDeployingBankContract,
      web3.utils.sha3
    );
  console.log(
    "Expected bank Contract address: ",
    expectedBankContractAddress.toString()
  );

  await erc20Instance.approve(expectedBankContractAddress, rewardPoolSize, {
    from: contractDeployer,
  });
  await deployer.deploy(
    ERC20Bank,
    erc20TokenContractAddress,
    rewardPoolSize,
    3600,
    {
      from: contractDeployer,
    }
  );

  let bankContract = await ERC20Bank.deployed();
  let actualBankContractAddress = bankContract.address;

  console.log(
    "Actual bank Contract address: ",
    actualBankContractAddress.toString()
  );
};
