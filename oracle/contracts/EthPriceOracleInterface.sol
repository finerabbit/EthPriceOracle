pragma solidity >=0.5.0 <0.6.0;

interface EthPriceOracleInterface {
    function getLatestEthPrice() external returns (uint256);
}