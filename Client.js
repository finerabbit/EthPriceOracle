//const common = require('./utils/common.js')
const Web3 = require('web3');
require('dotenv').config();
const CallerJSON = require('./caller/build/contracts/CallerContract.json')
const OracleJSON = require('./oracle/build/contracts/EthPriceOracle.json')

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

(async () => {
  const { callerContract, ownerAddress, web3js } = await init();
/*  process.on( 'SIGINT', () => {
    console.log('Calling client.disconnect()');
    client.disconnect();
    process.exit( );
  })
  const networkId = await web3js.eth.net.getId();
  const oracleAddress =  OracleJSON.networks[networkId].address;*/

  console.log("before");



  // Transfer some tokens
  web3js.eth.getTransactionCount(ownerAddress, (err, txCount) => {

    const Tx = require('ethereumjs-tx').Transaction;
    const privateKey1 = Buffer.from(process.env.PRIVATE_KEY, 'hex');
    const txObject = {
      nonce:    web3js.utils.toHex(txCount),
      gasLimit: web3js.utils.toHex(800000), // Raise the gas limit to a much higher amount
      gasPrice: web3js.utils.toHex(web3js.utils.toWei('10', 'gwei')),
      to: process.env.CALLERADDRESS,
      data: callerContract.methods.setOracleInstanceAdddress(process.env.ORACLEADDRESS).send({ from: ownerAddress })
    };

    const tx = new Tx(txObject, { 'chain' : 'goerli' });
    tx.sign(privateKey1);

    const serializedTx = tx.serialize();
    const raw = '0x' + serializedTx.toString('hex');

    web3js.eth.sendSignedTransaction(raw, (err, txHash) => {
      console.log('err:', err, 'txHash:', txHash)
      // Use this txHash to find the contract on Etherscan!
    });
  });


  //await callerContract.methods.setOracleInstanceAdddress(process.env.ORACLEADDRESS).send({ from: ownerAddress });
  console.log("after");
  setInterval( async () => {
    await callerContract.methods.updateEthPrice().send({ from: ownerAddress });
  }, 3000);
})()
