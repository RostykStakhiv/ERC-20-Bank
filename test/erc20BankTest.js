var RLP = require("rlp");

const ERC20Bank = artifacts.require("ERC20Bank");
const MockToken = artifacts.require("MockERC20Token");

contract("ERC20Bank", async (accounts) => {
  var bankContract;
  var erc20Token;
  let contractDeployer = accounts[0];

  const mockTokenSupply = BigInt(10000 * 10 ** 18);

  const rewardPoolSize = mockTokenSupply / BigInt(10);
  const T = 3600;

  beforeEach(async () => {
    let nonce = await web3.eth.getTransactionCount(contractDeployer);
    let nonceWhenDeployingBankContract = nonce + 2; //Accounts nonce will be current nonce + 2 because one transaction will take to deploy Test ERC20 contract
    //and one transaction will be made to approve the address of future bank contract to use particular amount of tokens that will be sent to the reward pool
    let bankContractAddress =
      "0x" +
      web3.utils
        .sha3(RLP.encode([contractDeployer, nonceWhenDeployingBankContract]))
        .slice(12)
        .substring(14);

    erc20Token = await MockToken.new(mockTokenSupply, {
      from: contractDeployer,
    });
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
    assert.equal(bankTokenBalance, rewardPoolSize);
  });
});
