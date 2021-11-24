var RLP = require("rlp");

calculateContractAddressFromAccountWithNonce = async (account, nonce, sha3) => {
  let expectedBankContractAddress =
    "0x" +
    sha3(RLP.encode([account, nonce]))
      .slice(12)
      .substring(14);
  return expectedBankContractAddress;
};

module.exports = {
  calculateContractAddressFromAccountWithNonce,
};
