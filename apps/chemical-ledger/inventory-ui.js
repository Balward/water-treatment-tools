'use strict';
let inventoryViewData=null,inventoryChemical='hypochlorite',inventoryLoading=false;
const inventoryConfirmations=new Map();
async function loadInventoryReview(force=false){
 if(!sharedReady||sharedBusy||sharedDirty||inventoryLoading)return;inventoryLoading=true;sharedBusy=true;updateSharedStatus();
 try{const data=await ledgerRequest('/api/chemical-ledger/inventory'+(force?'/refresh':''),force?{method:'POST',body:'{}'}:{});inventoryViewData=data.inventory;acceptShared(data);}
 catch(e){sharedError=e.message;}
 finally{inventoryLoading=false;sharedBusy=false;updateSharedStatus();}
}
function inventoryReview(){
 if(!inventoryViewData){queueMicrotask(()=>loadInventoryReview());return '<div class="panel"><div class="empty"><h2>Loading Completed Inventories</h2><p>The inventory app remains the source of saved stock readings.</p><button id="inventoryRefresh">Refresh Inventory</button></div></div>';}
 const data=inventoryViewData,c=state.chemicals.find(c=>c.id===inventoryChemical),p=data.profiles[c.id],rows=data.candidates.filter(r=>r.chemical===c.id&&(r.start.startsWith(year+'-')||r.end.startsWith(year+'-'))).sort((a,b)=>b.end.localeCompare(a.end));
 const fresh=data.canApprove===true,stale=state.usage.filter(u=>u.chemical===c.id&&u.source?.status==='stale'&&(u.source.start.startsWith(year+'-')||u.date.startsWith(year+'-'))&&!rows.some(r=>r.id===u.id));
 for(const [id,fingerprint]of inventoryConfirmations){const row=data.candidates.find(r=>r.id===id);if(!fresh||!row?.ready||row.approved||row.fingerprint!==fingerprint)inventoryConfirmations.delete(id);}
 return `<div class="panel">${head('Wednesday Inventory Review','Purchased-stock withdrawal = previous stock + physical receipts − current stock.','<button id="inventoryRefresh">Refresh Inventory</button>')}<div class="callout"><label>Chemical<select id="inventoryChemical">${state.chemicals.map(c=>`<option value="${c.id}" ${c.id===inventoryChemical?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><p>${esc(p.description)}</p><p class="hint">${data.lastSuccess?'Last successful inventory sync: '+esc(new Date(data.lastSuccess).toLocaleString()):'No successful sync yet.'} · ${data.recordCount} completed inventories. Drafts are excluded. The first completed inventory establishes the starting balance.</p>${data.error?`<p class="alert">${esc(data.error)} Saved snapshots have been retained. Refresh before approving.</p>`:!fresh?'<p class="alert">Approval is paused until the inventory connection is refreshed. Select Refresh Inventory above.</p>':''}<p class="hint">Check that all receipts are recorded, including deliveries whose invoices have not arrived. Review is required before an interval contributes to usage. Approximate alum conversion is always marked as an estimate.</p></div></div>${rows.length?rows.map(r=>`<div class="panel inventory-interval" data-interval="${esc(r.id)}">${head(`${r.start} to ${r.end}`,`${r.days} elapsed days · ${c.name}`,`<span class="pill">${r.approved?'Approved':r.needsReview?'Changed — review again':r.ready?(fresh?'Ready for review':'Refresh required'):'Needs information'}</span>`)}<div class="tableWrap"><table><thead><tr><th>BEGINNING GAL</th><th>RECEIVED GAL</th><th>ENDING GAL</th><th>WITHDRAWN GAL</th><th>LEDGER USAGE (${esc(c.unit)})</th></tr></thead><tbody><tr>${[r.beginning,r.received,r.ending,r.rawGallons,r.quantity].map(v=>`<td>${v===null?'—':num(v)}</td>`).join('')}</tr></tbody></table></div><div class="inventory-details">${r.receipts.length?`<p><strong>Receipts in this interval</strong></p>${r.receipts.map(d=>`<p>${esc(d.date)} · ${esc(d.reference)||'No invoice reference'} · ${d.quantity===null?'Physical amount missing':num(d.quantity)+' '+esc(d.unit)}${d.timing!=='unknown'?' · '+esc(d.timing)+' count':''} <button data-receipt-edit="${esc(d.id)}" class="edit">Edit Receipt</button></p>`).join('')}`:'<p>No ledger deliveries are recorded in this interval. Confirm that none are missing before approving.</p>'}${r.blockers.length?`<ul class="inventory-blockers">${r.blockers.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}${r.warnings.length?`<ul class="hint">${r.warnings.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}${r.approved?'<p class="hint">This interval contributes to usage and PO planning. Changes to its stock readings or physical receipts require another review.</p>':`<label class="inventory-confirm"><input type="checkbox" data-receipts-confirm ${inventoryConfirmations.get(r.id)===r.fingerprint?'checked':''} ${!r.ready||!fresh?'disabled':''}>I checked the inventory dates, all physical receipts, and the conversion factor.</label><button class="primary" data-approve-interval="${esc(r.id)}" ${!r.ready||!fresh||inventoryConfirmations.get(r.id)!==r.fingerprint?'disabled':''}>Approve Usage</button>`}</div></div>`).join(''):'<div class="panel"><div class="empty">No comparable completed inventory pairs for this chemical and reporting year yet.</div></div>'}${stale.length?`<div class="panel">${head('Superseded Intervals','These earlier entries are retained for reference and excluded from totals. Review the new adjacent inventory intervals above.')}<div class="callout">${stale.map(u=>`<p>${esc(u.source.start)} to ${esc(u.source.end)} · ${num(u.quantity)} ${esc(c.unit)}</p>`).join('')}</div></div>`:''}`;
}
document.addEventListener('change',e=>{
 if(e.target.id==='inventoryChemical'){inventoryChemical=e.target.value;render();}
 if(e.target.matches('[data-receipts-confirm]')){
  const card=e.target.closest('.inventory-interval'),row=inventoryViewData?.candidates.find(r=>r.id===card.dataset.interval);
  if(!row)return;
  if(e.target.checked)inventoryConfirmations.set(row.id,row.fingerprint);else inventoryConfirmations.delete(row.id);
  card.querySelector('[data-approve-interval]').disabled=!e.target.checked||!row.ready||inventoryViewData.canApprove!==true;
 }
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='inventoryRefresh')await loadInventoryReview(true);
 if(b.dataset.receiptEdit){tab='deliveries';render();openRecord('deliveries',b.dataset.receiptEdit);}
 if(b.dataset.approveInterval){
  const row=inventoryViewData?.candidates.find(r=>r.id===b.dataset.approveInterval);if(!row||sharedBusy||sharedDirty)return;
  const confirmed=b.closest('.inventory-interval').querySelector('[data-receipts-confirm]').checked;if(!confirmed){toast('Confirm the stock dates, receipts, and conversion before approving.');return;}
  sharedBusy=true;updateSharedStatus();
  try{const data=await ledgerRequest('/api/chemical-ledger/inventory/approve',{method:'POST',body:JSON.stringify({revision:sharedRevision,id:row.id,fingerprint:row.fingerprint,receiptsConfirmed:true})});inventoryViewData=null;acceptShared(data);toast('Inventory usage approved and saved on gibbhub.');}
  catch(err){sharedError=err.message;}
  finally{sharedBusy=false;updateSharedStatus();await loadInventoryReview();}
 }
});
setInterval(()=>{if(tab==='inventory'&&!document.hidden&&!document.activeElement?.matches('input,select,textarea'))void loadInventoryReview();},30000);
