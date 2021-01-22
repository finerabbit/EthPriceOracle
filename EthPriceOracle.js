const axios = require('axios');
const BN = require('bn.js');
//const common = require('./utils/common.js');
const Web3 = require('web3');
const OracleJSON = require('./oracle/build/contracts/EthPriceOracle.json');
const Tx = require('ethereumjs-tx').Transaction;
require('dotenv').config();
var pendingRequests = [];

async function getOracleContract(web3js) {
    return new web3js.eth.Contract(OracleJSON.abi, process.env.ORACLEADDRESS);
}

async function retrieveLatestEthPrice() {
    const resp = await axios({
        url: 'https://api.binance.com/api/v3/ticker/price',
        params: {
            symbol: 'ETHUSDT'
        },
        method: 'get'
    });
    return resp.data.price;
}

async function filterEvents(oracleContract, web3js) {
    oracleContract.events.GetLatestEthPriceEvent(async (err, event) => {
        if (err) {
            console.error('Error on event', err);
            return;
        }
        console.log("GetLatestEthPriceEvent emitted!");
        await addRequestToQueue(event);
    });

    oracleContract.events.SetLatestEthPriceEvent(async (err, event) => {
        if (err) {
            console.error('Error on event', err);
        }
    });
}

async function addRequestToQueue(event) {
    const callerAddress = event.returnValues.callerAddress;
    const id = event.returnValues.id;
    pendingRequests.push({callerAddress, id});
}

async function processQueue(oracleContract, ownerAddress) {
    let processedRequests = 0;
    while (pendingRequests.length > 0 && processedRequests < 3) { //CHUNK_SIZE) {
        const req = pendingRequests.shift();
        await processRequest(oracleContract, ownerAddress, req.id, req.callerAddress);
        processedRequests++;
    }
}

async function processRequest(oracleContract, ownerAddress, id, callerAddress) {
    let retries = 0;
    while (retries < 3) { //MAX_RETRIES) {
        try {
            const ethPrice = await retrieveLatestEthPrice();
            await setLatestEthPrice(oracleContract, callerAddress, ownerAddress, ethPrice, id);
            return;
        } catch (error) {
            if (retries === 2) { ///MAX_RETRIES - 1) {
                await setLatestEthPrice(oracleContract, callerAddress, ownerAddress, '0', id);
                return;
            }
            retries++;
        }
    }
}

async function setLatestEthPrice(oracleContract, callerAddress, ownerAddress, ethPrice, id) {
    ethPrice = ethPrice.replace('.', '');
    const multiplier = new BN(10**10, 10);
    const ethPriceInt = (new BN(parseInt(ethPrice), 10)).mul(multiplier);
    const idInt = new BN(parseInt(id));
    try {
        //await oracleContract.methods.setLatestEthPrice(ethPriceInt.toString(), callerAddress, idInt.toString()).send({ from: ownerAddress });
        const privateKey = Buffer.from(process.env.PRIVATE_KEY, 'hex');
        const web3js = new Web3("wss://goerli.infura.io/ws/v3/" + process.env.API_KEY);
        let nounceTx = await web3js.eth.getTransactionCount(ownerAddress);
        let extraData = oracleContract.methods.SetLatestEthPrice(ethPriceInt.toString(), callerAddress, idInt.toString()).encodeABI();
        console.log("before");
        await sendSignedTransaction(privateKey, extraData, nounceTx, process.env.ORACLEADDRESS, web3js);
        console.log("after");
    } catch (error) {
        console.log('Error encountered while calling setLatestEthPrice.');
    }
}

async function sendSignedTransaction(privateKey, extraData, nounceTx, contractAddress, web3js) {
    const txObject = {
      nonce:    web3js.utils.toHex(nounceTx),
      gasLimit: web3js.utils.toHex(800000), // Raise the gas limit to a much higher amount
      gasPrice: web3js.utils.toHex(web3js.utils.toWei('100', 'gwei')),
      to: contractAddress,
      data: extraData
    };
    let tx = new Tx(txObject, { 'chain' : 'goerli' });
    tx.sign(privateKey);
    let serializedTx = tx.serialize();
    let raw = '0x' + serializedTx.toString('hex');
    web3js.eth.sendSignedTransaction(raw, (err, txHash) => {
      console.log('err:', err, 'txHash:', txHash);
      // Use this txHash to find the contract on Etherscan!
    });
  }

async function init() {
    //const { ownerAddress, web3js, client } = common.loadAccount(0x00);// PRIVATE_KEY_FILE_NAME);
    /*
    if (window.ethereum) {
        window.web3 = new Web3(ethereum);
        try {
            await ethereum.enable();
        } catch (error) {
            // User denied account access...
        }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
        window.web3 = new Web3(web3.currentProvider);
        // Acccounts always exposed
    }
        // Non-dapp browsers...
    else {
        console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    }*/

    //const web3js = new Web3("https://goerli.infura.io/v3/a8b0ea6cac0b4b9da8882578ffb2ff8d");
    const web3js = new Web3("wss://goerli.infura.io/ws/v3/" + process.env.API_KEY);
    const ownerAddress = "0x97c7ce63299EE389C3f73C44C56f3E0C3aB48D25";
    const oracleContract = await getOracleContract(web3js);
    filterEvents(oracleContract, web3js);
    return {oracleContract, ownerAddress};
}

(async () => {
    //const { oracleContract, ownerAddress, client } = await init();
    const { oracleContract, ownerAddress } = await init();
/*    process.on('SIGINT', () => {
        console.log('Calling client.disconnect()');
        client.disconnect();
        process.exit();
    });
*/
    setInterval(async () => {
        await processQueue(oracleContract, ownerAddress);
    }, 10000);
})()