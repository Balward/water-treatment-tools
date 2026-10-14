const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {resetHistory}=require('../reset-history');
test('history reset clears operational records and preserves catalog configuration and a backup',t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-reset-'));
 t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const original={inventories:[{id:'run'}],orderList:[{id:'pending'}],orderHistory:[{id:'order'}],queuedInventoryIds:['run'],orderListRevision:4,catalogRevision:7,catalogItems:[{id:'custom',description:'Configured item',itemNumber:'MODEL-123',productUrl:'https://example.com/product',caseSize:'4 L / bottle'}],otherConfiguration:{keep:true}};
 const file=path.join(dataDir,'inventories.json');fs.writeFileSync(file,JSON.stringify(original));
 const result=resetHistory(dataDir),saved=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const field of ['inventories','orderList','orderHistory','queuedInventoryIds'])assert.deepEqual(saved[field],[]);
 assert.deepEqual(saved.catalogItems,original.catalogItems);assert.equal(saved.catalogRevision,7);assert.deepEqual(saved.otherConfiguration,{keep:true});assert.equal(saved.orderListRevision,5);
 assert.deepEqual(JSON.parse(fs.readFileSync(result.backup,'utf8')),original);
 assert.deepEqual([result.clearedInventories,result.clearedPendingItems,result.clearedOrders],[1,1,1]);
 fs.writeFileSync(file,'invalid');assert.throws(()=>resetHistory(dataDir));assert.equal(fs.readFileSync(file,'utf8'),'invalid','Invalid data is not overwritten');
});
