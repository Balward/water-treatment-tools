const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const express=require('express'),register=require('../chemical-ledger-api');
const {createBrowserCheck,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
(async()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-browser-data-')),api=express();api.use(express.json({limit:'10mb'}));register(api,{directory,inventorySync:false,inventoryFetcher:async()=>({revision:1,records:['2026-07-01','2026-07-08'].map((date,i)=>({date,status:'complete',totals:Object.fromEntries(['naoh','hypochlorite','alum','polymer','permanganate'].map(k=>[k,{gallons:1000-i*100}]))}))})});let h,other;
async function until(browser,expression){for(let i=0;i<160;i++){if(await browser.evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression);}
const settled=browser=>until(browser,'document.getElementById("sharedStatusText").textContent.startsWith("Saved on gibbhub")');
async function reload(browser,recovery=false){await browser.evaluate('window.__ledgerReloadMarker=true');await browser.call('Page.reload');await until(browser,'!window.__ledgerReloadMarker&&document.readyState==="complete"');if(!recovery)await settled(browser);}
const read=browser=>browser.evaluate('fetch("/api/chemical-ledger").then(r=>r.json())');
try{
 h=await createBrowserCheck({apiHandler:api,acceptDialogs:true});const {call,evaluate,errors}=h;
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'http://127.0.0.1:8782/apps/chemical-ledger/index.html'});await settled(h);
 assert.equal(await evaluate('document.querySelectorAll(".metric").length'),4);assert.equal(await evaluate('document.querySelectorAll(".chemical").length'),5);
 await evaluate('document.fonts.ready');assert(await evaluate('document.fonts.check("16px Inter")'));
 assert.equal(await evaluate('document.querySelector(".site-header .brand img").naturalWidth>0'),true);
 assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),112);
 assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().width'),222);
 await evaluate('document.querySelector("[data-add=deliveries]").click()');
 assert.equal(await evaluate('document.getElementById("deliveryTotal").textContent'),'$0.00');
 assert.deepEqual(await evaluate('[...document.querySelector("select[name=supplier]").options].map(o=>o.value)'),['','PVS DX, INC','Harcros','Nalco','Chemtrade']);
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2026-02-01";f.elements.quantity.value="100";f.elements.receivedQuantity.value="10.392156862745098";f.elements.receivedDate.value="2026-02-02";f.elements.reference.value="TEST-001";f.elements.supplier.value="Harcros";f.elements.superfundTax.value="12.34";f.elements.energySurcharge.value="5.66";f.elements.energySurcharge.dispatchEvent(new Event("input",{bubbles:true}))})()');
 assert.equal(await evaluate('document.getElementById("deliveryTotal").textContent'),'$182.00');
 await evaluate('document.getElementById("recordForm").requestSubmit()');await settled(h);
 assert.equal((await read(h)).state.deliveries[0].supplier,'Harcros');assert.equal((await read(h)).state.deliveries[0].receivedDate,'2026-02-02');
 await evaluate('document.querySelector("[data-tab=deliveries]").click();document.querySelector("[data-edit]").click()');
 assert.equal(await evaluate('document.getElementById("recordForm").elements.superfundTax.value'),'12.34');
 assert.equal(await evaluate('document.getElementById("recordForm").elements.energySurcharge.value'),'5.66');
 await evaluate('document.getElementById("closeDialog").click();document.getElementById("exportCSV").click()');
 const csvPath=path.join(h.profile,'downloads','deliveries-2026.csv');for(let i=0;i<100&&!fs.existsSync(csvPath);i++)await new Promise(r=>setTimeout(r,50));
 const exported=fs.readFileSync(csvPath,'utf8');assert(exported.includes('"Superfund Excise Tax","Energy Surcharge","Delivery total"'));assert(exported.includes('"164","12.34","5.66","182"'));
 await evaluate('document.querySelector("[data-tab=usage]").click();document.querySelector("[data-add=usage]").click()');
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2025-12-31";f.elements.quantity.value="200";f.requestSubmit()})()');await settled(h);
 await evaluate('document.querySelector("[data-add=usage]").click()');
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2026-09-30";f.elements.quantity.value="300";f.requestSubmit()})()');await settled(h);
 await evaluate('fetch("/api/chemical-ledger").then(r=>r.json()).then(({state})=>{state.chemicals.find(c=>c.id==="alum").unit="dry lb";state.chemicals.find(c=>c.id==="polymer").name="Polymer";state.deliveries.push({id:"browser-work",date:"2026-11-19",chemical:"hydroxide",quantity:50,price:.36,reference:"WORK-IMPORT",notes:"",supplier:"Harcros"});localStorage.setItem("chemical-ledger-v1",JSON.stringify(state))})');
 await reload(h);
 assert.equal(await evaluate('document.getElementById("localImport").hidden'),false);assert.equal((await read(h)).state.deliveries.length,1,'Local records do not silently overwrite shared ledger');
 await evaluate('document.getElementById("importBrowser").click()');await settled(h);
 assert.equal((await read(h)).state.deliveries.length,2);assert.equal((await read(h)).state.usage.length,2);
 assert.equal(await evaluate('document.getElementById("localImport").hidden'),true);assert.equal(await evaluate('JSON.parse(localStorage.getItem("chemical-ledger-v1")).deliveries.length'),2,'Original browser backup is retained');
 assert.equal(await evaluate('document.querySelector(".metric strong").textContent'),'$200.00');
 await evaluate('document.querySelector("[data-tab=planner]").click()');
 await evaluate(`(()=>{const input=document.querySelector('[data-history="2026"][data-field=months]');input.value="9";input.dispatchEvent(new Event("change",{bubbles:true}))})()`);await settled(h);
 assert.match(await evaluate('document.querySelector(".planCard .pill").textContent'),/320 lb/);assert.match(await evaluate('document.querySelector(".planCard .cost").textContent'),/524\.80/);
 await evaluate('document.querySelector("[data-tab=inventory]").click()');await until(h,'document.getElementById("inventoryRefresh")&&!inventoryLoading');
 await evaluate('document.getElementById("inventoryRefresh").click()');await until(h,'document.querySelector("[data-approve-interval]")&&!inventoryLoading');
 assert.equal(await evaluate('document.querySelector("[data-receipts-confirm]").disabled'),false);
 assert.equal(await evaluate('document.querySelector("[data-approve-interval]").disabled'),true,'Approval waits for the checkbox');
 await evaluate('window.__originalNow=Date.now;Date.now=()=>window.__originalNow()+86400000;render()');
 assert.equal(await evaluate('document.querySelector("[data-receipts-confirm]").disabled'),false,'PC clock skew cannot disable server-ready review');
 async function clickConfirmation(){
  const point=await evaluate('(()=>{const el=document.querySelector("[data-receipts-confirm]");el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 }
 await clickConfirmation();
 assert.equal(await evaluate('document.querySelector("[data-receipts-confirm]").checked'),true,'Actual mouse click checks the box');
 assert.equal(await evaluate('document.querySelector("[data-approve-interval]").disabled'),false);
 await evaluate('loadInventoryReview()');await settled(h);
 assert.equal(await evaluate('document.querySelector("[data-receipts-confirm]").checked'),true,'Background refresh retains unchanged confirmation');
 await evaluate('inventoryViewData.candidates.find(r=>r.chemical===inventoryChemical).fingerprint="changed";render()');
 assert.equal(await evaluate('document.querySelector("[data-receipts-confirm]").checked'),false,'Changed records require a new confirmation');
 await evaluate('inventoryViewData.canApprove=false;render()');
 assert.equal(await evaluate('document.querySelector("[data-receipts-confirm]").disabled'),true);
 assert.match(await evaluate('document.querySelector("#content .alert").textContent'),/Refresh Inventory/);
 assert.equal(await evaluate('document.querySelector(".inventory-interval .pill").textContent'),'Refresh required');
 await evaluate('loadInventoryReview()');await settled(h);await clickConfirmation();
 await evaluate('Date.now=window.__originalNow;delete window.__originalNow;document.querySelector("[data-approve-interval]").click()');await until(h,'document.querySelector(".inventory-interval .pill").textContent==="Approved"');await settled(h);
 assert.equal((await read(h)).state.usage.find(r=>r.source).quantity,100);
 for(const width of [1440,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),width<=800?144:112);
  for(const view of ['overview','deliveries','usage','inventory','planner','settings']){await evaluate(`document.querySelector('[data-tab="${view}"]').click()`);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),view+' fits at '+width);}
  await evaluate('document.querySelector("[data-tab=inventory]").click()');
  if(width!==320){fs.mkdirSync('preview',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('preview/chemical-ledger-'+width+'.png',Buffer.from(shot.data,'base64'));}
  await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector("#opsAppMenu [aria-current=page]").dataset.opsDestination'),'chemical-ledger');await evaluate('document.querySelector(".ops-app-menu-close").click()');
 }
 other=await createBrowserCheck({port:8783,apiHandler:api,acceptDialogs:true});await other.call('Page.navigate',{url:'http://127.0.0.1:8783/apps/chemical-ledger/index.html'});await settled(other);
 assert.equal(await other.evaluate('localStorage.getItem("chemical-ledger-v1")'),null,'Second browser has no original local records');assert.equal(await other.evaluate('document.querySelector(".metric strong").textContent'),'$200.00','Second browser sees the shared deliveries');
 await other.evaluate('document.querySelector("[data-tab=settings]").click();const input=document.querySelector("[data-price=permanganate]");input.value="1.75";input.dispatchEvent(new Event("change",{bubbles:true}))');await settled(other);
 await evaluate('document.querySelector("[data-tab=deliveries]").click();[...document.querySelectorAll("[data-edit]")].find(b=>b.closest("tr").textContent.includes("TEST-001")).click();const f=document.getElementById("recordForm");f.elements.quantity.value="101";f.requestSubmit()');
 await until(h,'document.getElementById("sharedError").textContent.includes("Save conflict")');
 assert.equal((await read(other)).state.deliveries.find(r=>r.reference==='TEST-001').quantity,100,'Conflict never overwrites another computer');assert.equal(await evaluate('JSON.parse(localStorage.getItem("chemical-ledger-unsaved-v1")).state.deliveries.find(r=>r.reference==="TEST-001").quantity'),101);
 await reload(h,true);await until(h,'document.getElementById("sharedError").textContent.includes("recovered")');
 await evaluate('document.getElementById("refreshShared").click()');await settled(h);assert.equal(await evaluate('localStorage.getItem("chemical-ledger-unsaved-v1")'),null);
 await call('Network.enable');await call('Network.setBlockedURLs',{urls:['*/api/chemical-ledger']});
 await evaluate('document.querySelector("[data-tab=deliveries]").click();document.querySelector("[data-add=deliveries]").click();const f=document.getElementById("recordForm");f.elements.quantity.value="1";f.elements.date.value="2026-11-20";f.requestSubmit()');await until(h,'document.getElementById("sharedError").textContent.includes("Not saved to gibbhub")');
 assert.equal((await read(other)).state.deliveries.length,2,'Network failure is not reported as a successful save');
 await call('Network.setBlockedURLs',{urls:[]});await evaluate('document.getElementById("retrySharedSave").click()');await settled(h);assert.equal((await read(other)).state.deliveries.length,3,'Retry saves recovered entry once');
 await other.evaluate('localStorage.setItem("chemical-ledger-v1","{}")');await reload(other);
 assert.equal(await other.evaluate('document.getElementById("importBrowser").disabled'),true);assert.equal(await other.evaluate('document.getElementById("localImport").hidden'),false,'Unreadable old browser data does not block the shared ledger');
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(other.errors.length,0,JSON.stringify(other.errors));
 console.log('Shared Chemical Ledger browser checks passed: two isolated computers, safe browser import, invoices and CSVs, planning, mobile layouts, concurrent-edit conflicts, reload recovery, offline save failure and successful retry.');
}finally{if(other)await other.close();if(h)await h.close();await removeTemporaryDirectory(directory);}})().catch(e=>{console.error(e);process.exitCode=1});
