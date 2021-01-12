pragma solidity >=0.0.5 <0.6.0;

import "./EthPriceOracleInterface.sol";
import "./Ownable.sol";

contract CallerContract is Ownable {
    
    uint256 private ethPrice;
    address private oracleAddress;
    EthPriceOracleInterface private oracleInterface;
    mapping(uint256 => bool) myRequests;
    
    event newOracleAddressEvent(address oracleAddress);
    event receivedNewRequestIdEvent(uint256 id);
    event priceUpdatedEvent(uint256 price, uint256 id);
    
    function setOracleInstanceAdddress(address _address) public onlyOwner {
        oracleAddress = _address;
        oracleInterface = EthPriceOracleInterface(oracleAddress);
        emit newOracleAddressEvent(oracleAddress);
    }
    
    function updateEthPrice() public {
        uint256 id = oracleInterface.getLatestEthPrice();
        myRequests[id] = true;
        emit receivedNewRequestIdEvent(id);
    }
    
    function callback(uint256 _ethPrice, uint256 _id) public onlyOracle {
        require(myRequests[_id], "This request is not in my pending list.");
        ethPrice = _ethPrice;
        delete myRequests[_id];
        emit priceUpdatedEvent(_ethPrice, _id);
    }
    
    modifier onlyOracle {
        require(msg.sender == oracleAddress, "You are not authorized to call this function.");
        _;
    }
}