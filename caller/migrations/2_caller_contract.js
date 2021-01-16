const CallerContract = artifacts.require("./CallerContract.sol");

module.exports = function (deployer) {
  deployer.deploy(CallerContract);
};
