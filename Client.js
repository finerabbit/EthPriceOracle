//const common = require('./utils/common.js')
const Web3 = require('web3');
require('dotenv').config();
const CallerJSON = require('./caller/build/contracts/CallerContract.json');
const OracleJSON = require('./oracle/build/contracts/EthPriceOracle.json');
const Tx = require('ethereumjs-tx').Transaction;

async function getCallerContract (web3js) {
  return new web3js.eth.Contract(CallerJSON.abi, process.env.CALLERADDRESS);
}

async function filterEvents (callerContract) {
  callerContract.events.priceUpdatedEvent({ filter: { } }, async (err, event) => {
    if (err) console.error('Error on event', err);
    console.log('* New PriceUpdated event. ethPrice: ' + event.returnValues.ethPrice);
  });
  callerContract.events.receivedNewRequestIdEvent({ filter: { } }, async (err, event) => {
    if (err) console.error('Error on event', err);
  });
}

async function init () {
  //const { ownerAddress, web3js, client } = common.loadAccount(PRIVATE_KEY_FILE_NAME);
  const web3js = new Web3("wss://goerli.infura.io/ws/v3/" + process.env.API_KEY);
  const ownerAddress = process.env.OWNERADDRESS;
  const callerContract = await getCallerContract(web3js);
  filterEvents(callerContract);
  return { callerContract, ownerAddress, web3js };
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

(async () => {
  const { callerContract, ownerAddress, web3js } = await init();
  
  const privateKey = Buffer.from(process.env.PRIVATE_KEY, 'hex');
  //await callerContract.methods.setOracleInstanceAdddress(process.env.ORACLEADDRESS).send({ from: ownerAddress });
  // upon methods couldn't operate in infura... So we have to replace it to below one.
  let nounceTx = await web3js.eth.getTransactionCount(ownerAddress);
  let extraData = callerContract.methods.setOracleInstanceAdddress(process.env.ORACLEADDRESS).encodeABI();
  await sendSignedTransaction(privateKey, extraData, nounceTx, process.env.CALLERADDRESS, web3js);

/*  
  let nounceTx = await web3js.eth.getTransactionCount(ownerAddress, (err, txCount) => {
    //const Tx = require('ethereumjs-tx').Transaction;
    //const privateKey1 = Buffer.from(process.env.PRIVATE_KEY, 'hex');
    let extraData = callerContract.methods.setOracleInstanceAdddress(process.env.ORACLEADDRESS);
    extraData = extraData.encodeABI();  
    const txObject = {
      nonce:    web3js.utils.toHex(txCount),
      gasLimit: web3js.utils.toHex(800000), // Raise the gas limit to a much higher amount
      gasPrice: web3js.utils.toHex(web3js.utils.toWei('10', 'gwei')),
      to: process.env.CALLERADDRESS,
      data: extraData
    };
    let tx = new Tx(txObject, { 'chain' : 'goerli' });
    tx.sign(privateKey1);
    let serializedTx = tx.serialize();
    let raw = '0x' + serializedTx.toString('hex');
    web3js.eth.sendSignedTransaction(raw, (err, txHash) => {
      console.log('err:', err, 'txHash:', txHash);
      // Use this txHash to find the contract on Etherscan!
    });
  });*/

  console.log("after", nounceTx);
  extraData = callerContract.methods.updateEthPrice().encodeABI();
  setInterval( async () => {
    //await callerContract.methods.updateEthPrice().send({ from: ownerAddress });
    nounceTx++;
    await sendSignedTransaction(privateKey, extraData, nounceTx, process.env.CALLERADDRESS, web3js);
  }, 5000);
})()
