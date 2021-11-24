# ERC-20 Bank

This project contains ERC-20 Bank contract and the infrustructure needed to deploy it to Rinkeby or Ropsten ethereum testnet. ERC20Bank contract extends OpenZeppelin's `Ownable` contract to make use of the owner functionality. It also uses `ERC20` contract to call ERC-20 related methods on the token address passed to the bank constructor by the contract deployer.

## Getting Started

To deploy the contract yourself you will need to perform the following steps:

1. in the root project directory create a `.secrets.json` file and fill it like this:

```
{
    "walletPrivateKey": "YOUR_WALLET_PRIVATE_KEY",
    "rinkebyNodeUrl": "YOUR_RINKEBY_NODE_URL", // if you plan to deploy to rinkeby
    "rinkebyWSNodeUrl": "YOUR_RINKEBY_WEB_SOCKET_URL", // if you plan to use web-sockets instead of https
    "ropstenNodeUrl": "YOUR_ROPSTEN_NODE_URL" // if you plan to deploy to ropsten
 }
```

2.  Run `npm install`.
3.  Go to the `migrations/2_deploy_contracts.js` script. You can configure parameters like `rewardPoolSize`, `T`, and inside the if statements where network is being checked you can define the address of the ERC-20 token you want bank contract to work with. IMPORTANT NOTE: Wallet that will be used to deploy bank contract should have enough ERC-20 tokens on its balance to deploy bank contract as tokens are being deposited to the contract at the time of deployment. Transaction will fail if wallet does not have enough tokens and bank contract will not be deployed.
4.  Run `truffle test` if you want to test the contract before deploying it.
5.  Run `truffle deploy --network <NETWORK_NAME>`
    Allowed `NETWORK_NAM` values:

- rinkeby
- ropsten

Deploy script pre-calculates the address of the bank contract to make sure ERC-20's token contract `approve` method gets called before bank contract starts deploying to make sure bank contract is allowed to transfer tokens from contract owner to the bank at deploy time.


Bank Contract deployed to the Rinkeby network can be found [here](https://rinkeby.etherscan.io/address/0x8f84903e119cd09637BD897a7524E93Bef8904D3):