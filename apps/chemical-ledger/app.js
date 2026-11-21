'use strict';
const $=s=>document.querySelector(s);
const money=n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const num=n=>n.toLocaleString('en-US',{maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='chemical-ledger-v1';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const currentYear=Number(today.slice(0,4));
let state=Ledger.initial(),year=currentYear,tab='overview',filter='';

function validBackup(s){return Ledger.validState(s)&&(!s.history||typeof s.history==='object'&&!Array.isArray(s.history)&&Object.entries(s.history).every(([y,h])=>/^\d{4}$/.test(y)&&h&&Number.isFinite(h.months)&&h.months>0&&h.months<=12&&Number.isFinite(h.weight)&&h.weight>=0));}
function save(){return saveSharedLedger();}
function toast(message){$('#notice').textContent=message;$('#notice').hidden=false;}
function years(){return [...new Set([currentYear,currentYear-1,currentYear-2,year,...state.deliveries.map(r=>Number(r.date.slice(0,4)))])].sort((a,b)=>b-a);}
function yearOptions(){$('#year').innerHTML=years().map(y=>`<option ${y===year?'selected':''}>${y}</option>`).join('')+'<option value="add">Add historical year…</option>';}
function chip(c){return `<div class="chemical"><span class="dot" style="background:${esc(c.color)}"></span><span>${esc(c.name)}<span class="unit">${esc(c.unit)}</span></span></div>`;}
function metric(label,value,note){return `<div class="metric"><div class="label">${label}</div><strong>${value}</strong><small>${note}</small></div>`;}
function head(title,desc,actions=''){return `<div class="panelHead"><div><h2>${title}</h2><p>${desc}</p></div><div class="actions">${actions}</div></div>`;}
function addButton(){return '<button class="primary" data-add="deliveries">+ Record delivery</button>';}
function yearDeliveries(){return state.deliveries.filter(r=>r.date.startsWith(year+'-')&&(year!==currentYear||r.date<=today));}

function overview(){
 const rows=Ledger.totals(state,year,year===currentYear?today:undefined);
 const spend=rows.reduce((s,r)=>s+r.spend,0),count=rows.reduce((s,r)=>s+r.deliveries,0);
 const subtotal=rows.reduce((s,r)=>s+r.chemicalSubtotal,0),charges=rows.reduce((s,r)=>s+r.superfundTax+r.energySurcharge,0);
 const max=Math.max(1,...rows.map(c=>c.spend));
 const suppliers=new Map();
 for(const r of yearDeliveries()){const name=r.supplier||'Supplier not specified',s=suppliers.get(name)||{count:0,spend:0};s.count++;s.spend+=Ledger.deliveryCost(r).total;suppliers.set(name,s);}
 return `<div class="metrics">${metric('Delivery spend',money(spend),'Chemical subtotal + tax + energy surcharge')}${metric('Deliveries recorded',num(count),'One record per chemical delivery')}${metric('Chemical subtotal',money(subtotal),'Quantities × recorded invoice prices')}${metric('Taxes & surcharges',money(charges),'Superfund Excise Tax + Energy Surcharge')}</div>
 <div class="panel">${head('Chemical purchases',`${year} invoiced quantities in each chemical’s billing unit.`,addButton())}<div class="tableWrap"><table><thead><tr><th>CHEMICAL</th><th class="num">INVOICED QUANTITY</th><th class="num">DELIVERIES</th><th class="num">DELIVERY SPEND</th><th class="num">AVG. INVOICE UNIT PRICE</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${chip(c)}</td><td class="num">${num(c.received)}</td><td class="num">${c.deliveries}</td><td class="num"><strong>${money(c.spend)}</strong></td><td class="num">${c.deliveries?money(c.averagePrice):'—'}<span class="unit">per ${esc(c.unit)}</span></td></tr>`).join('')}</tbody></table></div><p class="hint">Average unit price = chemical subtotal ÷ invoiced quantity, excluding tax and surcharges. Current-year totals exclude future-dated invoices.</p></div>
 <div class="split"><div class="panel">${head('Delivery spend by chemical','Recorded invoice totals, including tax and surcharges.')}<div class="chart">${rows.map(c=>`<div class="chartRow"><span>${esc(c.name)}</span><div class="track"><div class="bar" style="width:${c.spend/max*100}%;background:${esc(c.color)}"></div></div><strong class="num">${money(c.spend)}</strong></div>`).join('')}</div></div>
 <div class="panel">${head('Purchases by supplier',`${year} recorded deliveries and invoice spending.`)}${suppliers.size?`<div class="tableWrap"><table><thead><tr><th>SUPPLIER</th><th class="num">DELIVERIES</th><th class="num">DELIVERY SPEND</th></tr></thead><tbody>${[...suppliers].sort((a,b)=>b[1].spend-a[1].spend).map(([name,s])=>`<tr><td>${esc(name)}</td><td class="num">${s.count}</td><td class="num">${money(s.spend)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Add invoices to see supplier totals.</div>'}</div></div>`;
}

function log(){
 const rows=state.deliveries.filter(r=>r.date.startsWith(year+'-')&&(!filter||r.chemical===filter)).sort((a,b)=>b.date.localeCompare(a.date));
 return `<div class="toolbar"><select id="chemicalFilter" aria-label="Filter by chemical"><option value="">All chemicals</option>${state.chemicals.map(c=>`<option value="${c.id}" ${filter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><div class="actions"><button id="exportCSV">Export CSV</button>${addButton()}</div></div>
 <div class="panel">${head('Delivery & invoice register','Record the billed quantity, unit price, and charges from each invoice.')}${rows.length?`<div class="tableWrap"><table><thead><tr><th>INVOICE DATE</th><th>CHEMICAL</th><th class="num">QUANTITY</th><th class="num">UNIT PRICE</th><th class="num">CHEMICAL SUBTOTAL</th><th class="num">SUPERFUND TAX</th><th class="num">ENERGY SURCHARGE</th><th class="num">DELIVERY TOTAL</th><th>INVOICE / SUPPLIER</th><th>NOTES</th><th></th></tr></thead><tbody>${rows.map(r=>{const c=state.chemicals.find(c=>c.id===r.chemical),cost=Ledger.deliveryCost(r);return `<tr><td>${esc(r.date)}</td><td>${chip(c)}</td><td class="num">${num(r.quantity)}<span class="unit">${esc(c.unit)}</span></td><td class="num">${money(r.price)}</td><td class="num">${money(cost.chemical)}</td><td class="num">${money(cost.superfundTax)}</td><td class="num">${money(cost.energySurcharge)}</td><td class="num"><strong>${money(cost.total)}</strong></td><td>${esc(r.reference)||'—'}<span class="unit">${esc(r.supplier)}</span></td><td class="invoice-notes">${esc(r.notes)||'—'}</td><td><button class="edit" data-edit="${esc(r.id)}">Edit</button></td></tr>`;}).join('')}</tbody></table></div>`:`<div class="empty"><h3>No deliveries for ${year}${filter?' with this filter':''}</h3><p>Add an invoice to track quantities, supplier charges, and spending. Select a previous reporting year to enter historical invoices.</p>${addButton()}</div>`}<p class="hint">Delivery total = chemical subtotal + Superfund Excise Tax + Energy Surcharge. Enter charges as dollar amounts; allocate invoice-wide charges once across chemical records.</p></div>`;
}

function settings(){return `<div class="panel">${head('Chemical Pricing','Default rates for new invoices. Existing invoices retain their recorded prices.')}<div class="pricing">${state.chemicals.map(c=>`<div class="priceRow">${chip(c)}<label>Current unit price ($)<input data-price="${c.id}" type="number" min="0" step="any" value="${c.price}"></label><span class="unit">per ${esc(c.unit)}</span></div>`).join('')}</div><p class="hint">Aluminum sulfate is billed per dry US ton (2,000 dry pounds), starting at $661. Saved quantities and prices are preserved; review older alum entries if they were entered as pounds.</p></div><div class="panel">${head('Your invoice records','Saved centrally on gibbhub and shared across computers.')}<div class="callout"><p>Track each delivery in its invoice billing unit with its supplier, invoice reference, tax, and surcharge. Use the reporting year to view or add historical invoices.</p><p>CSV exports provide a readable invoice register. Download JSON backups regularly. Import Backup adds records while keeping existing invoices; conflicting record IDs require review.</p></div></div>`;}

function render(){
 yearOptions();const titles={overview:['Annual Overview','Your chemical invoices, deliveries, and spending.'],deliveries:['Deliveries & Invoices','Track billed quantities, suppliers, and delivery charges.'],settings:['Chemical Pricing','Five chemicals. Five clearly defined billing rates.']};
 if(!titles[tab])tab='overview';$('#pageTitle').textContent=titles[tab][0];$('#subtitle').textContent=titles[tab][1];
 document.querySelectorAll('.sidebar [data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('#content').innerHTML=tab==='overview'?overview():tab==='settings'?settings():log();
}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function csv(rows){return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');}
function updateDeliveryTotal(){const f=$('#recordForm'),values=Object.fromEntries(['quantity','price','superfundTax','energySurcharge'].map(k=>[k,Number(f.elements[k].value)])),valid=Object.values(values).every(v=>Number.isFinite(v)&&v>=0),cost=Ledger.deliveryCost(values);$('#chemicalSubtotal').textContent=valid&&Number.isFinite(cost.total)?money(cost.chemical):'—';$('#deliveryTotal').textContent=valid&&Number.isFinite(cost.total)?money(cost.total):'—';}
$('#recordForm').addEventListener('input',updateDeliveryTotal);

function openRecord(k,id){
 if(k!=='deliveries')return;
 const f=$('#recordForm'),r=id?state.deliveries.find(r=>r.id===id):null;f.reset();
 const suppliers=[...new Set(['PVS DX, INC','Harcros','Nalco','Chemtrade',...state.deliveries.map(entry=>entry.supplier)].filter(Boolean))];
 f.elements.supplier.innerHTML='<option value="">Select Supplier</option>'+suppliers.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
 f.elements.id.value=r?.id||'';f.elements.chemical.innerHTML=state.chemicals.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');f.elements.chemical.value=r?.chemical||filter||state.chemicals[0].id;
 f.elements.date.value=r?.date||(year===currentYear?today:`${year}-12-31`);
 ['superfundTax','energySurcharge'].forEach(field=>f.elements[field].value=r?.[field]??0);
 ['quantity','reference','supplier','notes'].forEach(field=>f.elements[field].value=r?.[field]??'');
 f.elements.price.value=r?.price??state.chemicals.find(c=>c.id===f.elements.chemical.value).price;
 $('#deleteRecord').hidden=!r;$('#dialogTitle').textContent=r?'Edit delivery':'Record delivery';
 $('#quantityUnit').textContent='('+state.chemicals.find(c=>c.id===f.elements.chemical.value).unit+')';
 $('#recordHint').textContent='Enter invoice charges in dollars, not percentages. Allocate shared charges once when an invoice includes multiple chemicals.';
 updateDeliveryTotal();$('#recordDialog').showModal();
}

document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.tab||b.dataset.go){tab=b.dataset.tab||b.dataset.go;filter='';render();}
 if(b.dataset.add)openRecord(b.dataset.add);
 if(b.dataset.edit)openRecord('deliveries',b.dataset.edit);
 if(b.id==='closeDialog')$('#recordDialog').close();
 if(b.id==='backup')download(JSON.stringify(state,null,2),`chemical-ledger-backup-${today}.json`,'application/json');
 if(b.id==='deleteRecord'&&confirm('Delete this delivery record?')){state.deliveries=state.deliveries.filter(r=>r.id!==$('#recordForm').elements.id.value);$('#recordDialog').close();render();if(await save())toast('Record deleted from gibbhub.');}
 if(b.id==='exportCSV'){
  const rows=[['Date','Chemical','Quantity','Billing unit','Unit price','Chemical subtotal','Superfund Excise Tax','Energy Surcharge','Delivery total','Invoice','Supplier','Notes'],...state.deliveries.filter(r=>r.date.startsWith(year+'-')&&(!filter||filter===r.chemical)).sort((a,b)=>b.date.localeCompare(a.date)).map(r=>{const c=state.chemicals.find(c=>c.id===r.chemical),cost=Ledger.deliveryCost(r);return [r.date,c.name,r.quantity,c.unit,r.price,cost.chemical,cost.superfundTax,cost.energySurcharge,cost.total,r.reference,r.supplier,r.notes];})];
  download(csv(rows),`deliveries-${year}.csv`,'text/csv');
 }
});

document.addEventListener('change',async e=>{
 const el=e.target;
 if(el.id==='year'){
  if(el.value==='add'){const value=prompt('Historical year (1900–'+currentYear+')');if(value&&/^\d{4}$/.test(value)&&Number(value)>=1900&&Number(value)<=currentYear){year=Number(value);tab='deliveries';}else if(value)alert('Enter a year between 1900 and '+currentYear+'.');}else year=Number(el.value);render();
 }
 if(el.id==='chemicalFilter'){filter=el.value;render();}
 if(el.name==='chemical'&&el.closest('#recordForm')){const c=state.chemicals.find(c=>c.id===el.value);$('#quantityUnit').textContent='('+c.unit+')';$('#recordForm').elements.price.value=c.price;updateDeliveryTotal();}
 if(el.dataset.price){if(!el.checkValidity()||el.value===''){el.reportValidity();return;}const value=Number(el.value);if(!Number.isFinite(value))return;state.chemicals.find(c=>c.id===el.dataset.price).price=value;await save();}
});

$('#recordForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target;
 // Retain earlier optional receipt metadata when an existing invoice is edited.
 const previous=state.deliveries.find(r=>r.id===f.elements.id.value);
 const r={...previous,id:f.elements.id.value||crypto.randomUUID(),date:f.elements.date.value,chemical:f.elements.chemical.value,quantity:Number(f.elements.quantity.value),price:Number(f.elements.price.value),reference:f.elements.reference.value,supplier:f.elements.supplier.value,superfundTax:Number(f.elements.superfundTax.value),energySurcharge:Number(f.elements.energySurcharge.value),notes:f.elements.notes.value};
 const candidate={...state,deliveries:[...state.deliveries.filter(x=>x.id!==r.id),r]};
 if(!validBackup(candidate)){alert('Check the date and numeric values.');return;}
 state=candidate;year=Number(r.date.slice(0,4));$('#recordDialog').close();render();if(await save())toast('Invoice saved to gibbhub.');
});
$('#restore').addEventListener('change',async e=>{try{const file=e.target.files[0];if(file)await importSharedState(JSON.parse(await file.text()));}catch(err){alert(err.message);}finally{e.target.value='';}});
const ledgerIcons={overview:'<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-8"/>',deliveries:'<path d="M4 3h16v18H4ZM8 7h8M8 11h8M8 15h4"/>',settings:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="17" r="2"/>'};
document.querySelectorAll('.sidebar [data-tab]').forEach(button=>{const text=document.createElement('span');text.textContent=button.textContent;button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ledgerIcons[button.dataset.tab]+'</svg>';button.append(text);});
startSharedLedger();
