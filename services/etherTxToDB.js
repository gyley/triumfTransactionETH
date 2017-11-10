let Log = require('../services/logToFile'),
    db = require('../services/db'),
    Web3 = require('web3');

module.exports = {
    web3: null,
    connect:function(){
        if (this.web3 !== null) {
            this.web3 = new Web3(this.web3.currentProvider);
        } else {
            this.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
        }
        return this.web3.isConnected();
    },
    transactionsToDB:function(next){
        db.get('etherTransactions').find({},{sort:{blockNumber:-1},limit:1},(err,tx)=>{
            if(err) Log.log(err.message);
            else {
                if(!this.connect()) {Log.log('Geth connection error!');next();}
                else{
                    let web3 = this.web3;
                    web3.eth.getBlock('latest',(err,latestBlock)=>{
                        Log.log('Block [' + latestBlock.number + ']');
                        if(err){Log.log('Web3.eth.getBlock error!');next();}
                        else this.fillDB(tx[0].blockNumber,latestBlock.number,next);
                    });
                }
            }
        });

    },
    fillDB:function(blockFinish,blockStart,next){
        let web3 = this.web3;
        web3.eth.getBlock(blockStart,(err,b)=>{
            if(err && blockStart > blockFinish) this.fillDB(blockFinish,
                (blockStart - 1),next);
            else if(blockFinish === blockStart) next();
            else {
                ftl = (txList, index, nx) => {
                    if (index === txList.length) nx();
                    else web3.eth.getTransaction(txList[index], (err, tx) => {
                        if (err) ftl(txList, ++index, nx);
                        else if(!tx.to)ftl(txList, ++index, nx);
                        else{
                            tx.timestamp = b.timestamp;
                            db.get('etherTransactions').update({
                                hash: tx.hash
                            },tx,{upsert:true},(err,t)=>{//console.dir(t);
                                Log.log('Block: '+ blockStart + ' TxN: '
                                    + index);
                                ftl(txList, ++index, nx);
                            })
                        }
                    })
                };
                ftl(b.transactions,0,()=>{
                    this.fillDB(blockFinish,(blockStart - 1), next)
                })
            }
        })
    }
};