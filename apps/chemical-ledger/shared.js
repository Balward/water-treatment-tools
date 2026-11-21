'use strict';
let sharedReady=false,sharedBusy=false,sharedDirty=false,sharedRevision=0,sharedUpdated=null,pendingSave=null,legacyState=null,legacyRaw=null,sharedError='';
const pendingKey='chemical-ledger-unsaved-v1',importMarker='chemical-ledger-imported-v1';
function localGet(k){try{return localStorage.getItem(k);}catch{return null;}}
function localSet(k,v){try{localStorage.setItem(k,v);}catch{}}
function localRemove(k){try{localStorage.removeItem(k);}catch{}}
function updateSharedStatus(){
  $('#sharedStatusText').textContent=sharedBusy?'Saving or loading shared ledger…':sharedDirty?'Unsaved changes on this computer':sharedReady?'Saved on gibbhub'+(sharedUpdated?' · '+new Date(sharedUpdated).toLocaleString():''):'Shared ledger unavailable';
  $('#sharedStatusText').classList.toggle('unsaved',sharedDirty||!sharedReady);
  $('#sharedError').textContent=sharedError;$('#sharedError').hidden=!sharedError;
  $('#retrySharedSave').hidden=!sharedDirty;$('#refreshShared').disabled=sharedBusy;
  $('#retrySharedSave').disabled=sharedBusy;$('#backup').disabled=!sharedReady||sharedBusy;
  const blocked=!sharedReady||sharedBusy||sharedDirty;
  $('#content').inert=blocked;$('.sidebar nav').inert=blocked;$('#year').disabled=blocked;$('#recordForm').inert=sharedBusy;
  $('#restore').disabled=blocked;
  const needed=legacyRaw&&(!legacyState||localGet(importMarker)!==legacyRaw||sharedRevision===0);
  $('#localImport').hidden=!needed;
  $('#localImportText').textContent=legacyState?`This browser has ${legacyState.deliveries.length} local delivery records. Import them to make them available on your other computers.`:'An older browser backup could not be read. Download it before making changes to browser storage.';
  $('#importBrowser').disabled=blocked||!legacyState;
  $('#downloadLocal').disabled=sharedBusy;
}
async function ledgerRequest(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(url,{cache:'no-store',...options,signal:controller.signal,headers:{'Content-Type':'application/json','X-Chemical-Ledger':'1',...(options.headers||{})}});const body=await response.json();if(!response.ok)throw Object.assign(new Error(body.error||'Unable to reach the shared ledger.'),{status:response.status});if(!Number.isSafeInteger(body.revision)||!validBackup(body.state))throw Error('The server returned an invalid ledger. Existing records have been kept.');return body;}
  finally{clearTimeout(timer);}
}
function acceptShared(data,{clearPending=true}={}){state=Ledger.migrateState(data.state);sharedRevision=data.revision;sharedUpdated=data.updatedAt;sharedReady=true;sharedDirty=false;pendingSave=null;sharedError='';if(clearPending)localRemove(pendingKey);render();}
async function loadSharedLedger({silent=false,discard=false,preserveRecovery=false}={}){
  if(sharedBusy||sharedDirty&&!discard)return;
  if(silent&&($('#recordDialog').open||document.activeElement?.matches('input,select,textarea')||document.hidden))return;
  sharedBusy=true;updateSharedStatus();
  try{const data=await ledgerRequest('/api/chemical-ledger');if(silent&&sharedReady&&data.revision===sharedRevision){sharedError='';sharedUpdated=data.updatedAt;}else acceptShared(data,{clearPending:!preserveRecovery});}
  catch(e){sharedError='Unable to load gibbhub: '+e.message;if(!sharedReady)$('#content').innerHTML='<div class="panel"><div class="empty"><h2>Shared Ledger Unavailable</h2><p>Use Refresh Shared Ledger to reconnect. No empty ledger has been saved over your records.</p></div></div>';}
  finally{sharedBusy=false;updateSharedStatus();}
}
async function saveSharedLedger(){
  if(!sharedReady||sharedBusy)return false;
  sharedDirty=true;pendingSave||={revision:sharedRevision,mutationId:crypto.randomUUID(),state:structuredClone(state)};
  localSet(pendingKey,JSON.stringify(pendingSave));sharedBusy=true;sharedError='';updateSharedStatus();
  try{const data=await ledgerRequest('/api/chemical-ledger',{method:'PUT',body:JSON.stringify(pendingSave)});acceptShared(data);return true;}
  catch(e){sharedError=(e.status===409?'Save conflict. ':'Not saved to gibbhub. ')+e.message+' Use Download Backup to protect your unsaved entries.';return false;}
  finally{sharedBusy=false;updateSharedStatus();}
}
async function importSharedState(incoming,fromBrowser=false){
  if(!sharedReady||sharedBusy||sharedDirty)return;
  incoming=Ledger.migrateState(incoming);if(!validBackup(incoming))throw Error('This is not a valid Chemical Ledger backup.');
  if(!confirm(`Add ${incoming.deliveries.length} delivery records to the shared ledger? Existing shared records will be kept. Duplicate IDs are skipped; conflicting records stop the import. Existing shared pricing is retained once the shared ledger is in use.${incoming.alumUnitCorrected?' Alum now uses dry US tons; imported quantities and prices are kept unchanged. Review any alum quantities entered as pounds.':''}`))return;
  sharedBusy=true;sharedError='';updateSharedStatus();
  try{const data=await ledgerRequest('/api/chemical-ledger/import',{method:'POST',body:JSON.stringify({revision:sharedRevision,mutationId:crypto.randomUUID(),state:incoming})});acceptShared(data);if(fromBrowser)localSet(importMarker,legacyRaw);toast(`Imported ${data.imported?.deliveries||0} delivery records to gibbhub.`);}
  catch(e){sharedError=e.message+' The source backup and existing shared records were kept.';}
  finally{sharedBusy=false;updateSharedStatus();}
}
async function startSharedLedger(){
  const recoveryRaw=localGet(pendingKey);
  legacyRaw=localGet(key);
  if(legacyRaw){try{legacyState=Ledger.migrateState(JSON.parse(legacyRaw));if(!validBackup(legacyState))legacyState=null;}catch{legacyState=null;}if(legacyState&&!legacyState.deliveries.length&&!legacyState.usage.length&&!Object.keys(legacyState.plans).length&&!Object.keys(legacyState.history||{}).length&&legacyState.chemicals.every(c=>c.price===Ledger.initial().chemicals.find(x=>x.id===c.id).price))legacyRaw=null;}
  $('#content').innerHTML='<div class="panel"><div class="empty">Loading shared ledger from gibbhub…</div></div>';
  await loadSharedLedger({preserveRecovery:true});
  const raw=recoveryRaw;
  if(raw&&sharedReady){try{const pending=JSON.parse(raw);if(validBackup(pending.state)&&Number.isSafeInteger(pending.revision)&&typeof pending.mutationId==='string'){const remote=await ledgerRequest('/api/chemical-ledger');if(remote.lastMutationId===pending.mutationId)acceptShared(remote);else{pendingSave=pending;state=Ledger.migrateState(pending.state);sharedRevision=pending.revision;sharedDirty=true;sharedError='Unsaved changes from an earlier session were recovered. Retry saving, or download a backup before reloading shared records.';render();}}}catch{sharedError='A saved recovery copy could not be loaded. Keep this browser storage and contact support before clearing it.';}updateSharedStatus();}
  setInterval(()=>loadSharedLedger({silent:true}),15000);
  window.addEventListener('focus',()=>loadSharedLedger({silent:true}));
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='refreshShared'){if(sharedDirty&&!confirm('Discard the unsaved changes shown here and reload gibbhub? Download Backup first if you need to keep them.'))return;await loadSharedLedger({discard:true});}
  if(b.id==='retrySharedSave')await saveSharedLedger();
  if(b.id==='importBrowser')try{await importSharedState(legacyState,true);}catch(err){sharedError=err.message;updateSharedStatus();}
  if(b.id==='downloadLocal'&&legacyRaw)download(legacyRaw,`chemical-ledger-browser-backup-${today}.json`,'application/json');
});
document.addEventListener('operations:before-navigate',e=>{if(sharedDirty||pendingSave)e.preventDefault();});
window.addEventListener('beforeunload',e=>{if(sharedDirty||pendingSave){e.preventDefault();e.returnValue='';}});
