pragma solidity >=0.5.0 <0.6.0;

contract CallerContractInterface {
    function callback(uint256 _ethPrice, uint256 _id) public;
}