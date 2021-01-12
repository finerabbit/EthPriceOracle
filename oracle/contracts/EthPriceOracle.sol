pragma solidity >=0.5.0 <0.6.0;

import "./CallerContractInterface.sol";
import "./Ownable.sol";

contract EthPriceOracle is Ownable {
    
    uint private randNonce = 0;
    uint private modulus = 1000;
    mapping(uint256 => bool) pendingRequests;
    
    event GetLatestEthPriceEvent(address callerAddress, uint id);
    event SetLatestEthPriceEvent(uint256 ethPrice, address callerAddress);
    
    function GetLatestEthPrice() public returns(uint256) {
        randNonce++;
        uint id = uint(keccak256(abi.encodePacked(now, msg.sender, randNonce))) % modulus;
        pendingRequests[id] = true;
        emit GetLatestEthPriceEvent(msg.sender, id);
        return id;
    }
    
    function SetLatestEthPrice(uint256 _ethPrice, address _callerAddress, uint256 _id) public onlyOwner {
        require(pendingRequests[_id], "This request is not in my pending list.");
        delete pendingRequests[_id];
        CallerContractInterface callerInterface = CallerContractInterface(_callerAddress);
        callerInterface.callback(_ethPrice, _id);
        delete pendingRequests[_id];
        emit SetLatestEthPriceEvent(_ethPrice, _callerAddress);
    }
}