'use strict';
// Run only while the inventory server is stopped.
const fs = require('node:fs');
const path = require('node:path');
function resetHistory(dataDir) {
  const file = path.join(path.resolve(dataDir),'inventories.json');
  if (!fs.existsSync(file)) throw new Error('No saved data file found; nothing was reset.');
  const original = fs.readFileSync(file,'utf8'), state = JSON.parse(original);
  if (!state || typeof state !== 'object' || Array.isArray(state) || !Array.isArray(state.inventories)) throw new Error('Unrecognized data format; nothing was reset.');
  const backupDir = path.join(path.dirname(file),'backups');
  fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  const backup = path.join(backupDir,'before-history-reset-' + new Date().toISOString().replace(/[:.]/g,'-') + '.json');
  fs.writeFileSync(backup,original,{flag:'wx',mode:0o600});
  const next = {...state,inventories:[],orderList:[],orderHistory:[],queuedInventoryIds:[],orderListRevision:(state.orderListRevision || 0) + 1};
  const temporary = file + '.reset.tmp';
  const fd = fs.openSync(temporary,'wx',0o600);
  try { fs.writeFileSync(fd,JSON.stringify(next,null,2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary,file);
  return {backup,clearedInventories:state.inventories.length,clearedPendingItems:(state.orderList || []).length,clearedOrders:(state.orderHistory || []).length,preservedCatalogItems:state.catalogItems?.length ?? null};
}
if (require.main === module) {
  const args = process.argv.slice(2), index = args.indexOf('--data-dir');
  if (!args.includes('--confirm-reset') || index < 0 || !args[index + 1]) {
    console.error('Usage (server stopped): node reset-history.js --data-dir /data --confirm-reset');process.exitCode = 1;
  } else {
    try { console.log(JSON.stringify(resetHistory(args[index + 1]))); }
    catch (error) { console.error(error.message);process.exitCode = 1; }
  }
}
module.exports = {resetHistory};
