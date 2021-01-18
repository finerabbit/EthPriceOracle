const axios = require('axios');
const BN = require('bn.js');
//const common = require('./utils/common.js');
const Web3 = require('web3');
const OracleJSON = require('./oracle/build/contracts/EthPriceOracle.json');
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
    while (pendingRequests.length > 0 && processRequests < 3) { //CHUNK_SIZE) {
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
            await SetLatestEthPrice(oracleContract, callerAddress, ownerAddress, ethPrice, id);
            return;
        } catch (error) {
            if (retries === 2) { ///MAX_RETRIES - 1) {
                await SetLatestEthPrice(oracleContract, callerAddress, ownerAddress, '0', id);
                return;
            }
            retries++;
        }
    }
}

async function setLatestEthPrice(oracleContract, callerAddress, ownerAddress, ethPrice, id) {
    const ethPriceInt = (new BN(parseInt(ethPrice), 10)).mul(multiplier);
    const idInt = new BN(parseInt(id));
    try {
        await oracleContract.methods.setLatestEthPrice(ethPriceInt.toString(), callerAddress, idInt.toString()).send({ from: ownerAddress });
    } catch (error) {
        console.log('Error encountered while calling setLatestEthPrice.');
    }
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
    }, 1000);
})()