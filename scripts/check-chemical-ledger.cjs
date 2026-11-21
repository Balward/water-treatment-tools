const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const express=require('express'),register=require('../chemical-ledger-api');
const {createBrowserCheck,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
(async()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-browser-data-')),api=express();let inventoryRequests=0;api.use(express.json({limit:'10mb'}));api.use('/api/chemical-ledger/inventory',(req,res,next)=>{inventoryRequests++;next();});register(api,{directory});let h,other;
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
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2026-02-01";f.elements.quantity.value="100";f.elements.reference.value="TEST-001";f.elements.supplier.value="Harcros";f.elements.superfundTax.value="12.34";f.elements.energySurcharge.value="5.66";f.elements.energySurcharge.dispatchEvent(new Event("input",{bubbles:true}))})()');
 assert.equal(await evaluate('document.getElementById("deliveryTotal").textContent'),'$182.00');
 await evaluate('document.getElementById("recordForm").requestSubmit()');await settled(h);
 assert.equal((await read(h)).state.deliveries[0].supplier,'Harcros');
 await evaluate('document.querySelector("[data-tab=deliveries]").click();document.querySelector("[data-edit]").click()');
 assert.equal(await evaluate('document.getElementById("recordForm").elements.superfundTax.value'),'12.34');
 assert.equal(await evaluate('document.getElementById("recordForm").elements.energySurcharge.value'),'5.66');
 await evaluate('document.getElementById("closeDialog").click();document.getElementById("exportCSV").click()');
 const csvPath=path.join(h.profile,'downloads','deliveries-2026.csv');for(let i=0;i<100&&!fs.existsSync(csvPath);i++)await new Promise(r=>setTimeout(r,50));
 const exported=fs.readFileSync(csvPath,'utf8');assert(exported.includes('"Superfund Excise Tax","Energy Surcharge","Delivery total"'));assert(exported.includes('"164","12.34","5.66","182"'));
 await evaluate('fetch("/api/chemical-ledger").then(r=>r.json()).then(({state})=>{state.chemicals.find(c=>c.id==="alum").unit="dry lb";state.chemicals.find(c=>c.id==="polymer").name="Polymer";state.usage.push({id:"archived-usage",date:"2025-12-31",chemical:"polymer",quantity:999999});state.deliveries.push({id:"browser-work",date:"2026-11-19",chemical:"hydroxide",quantity:50,price:.36,reference:"WORK-IMPORT",notes:"",supplier:"Harcros"});localStorage.setItem("chemical-ledger-v1",JSON.stringify(state))})');
 await reload(h);
 assert.equal(await evaluate('document.getElementById("localImport").hidden'),false);assert.equal((await read(h)).state.deliveries.length,1,'Local records do not silently overwrite shared ledger');
 await evaluate('document.getElementById("importBrowser").click()');await settled(h);
 assert.equal((await read(h)).state.deliveries.length,2);assert.equal((await read(h)).state.usage.length,1);
 assert.equal(await evaluate('document.getElementById("localImport").hidden'),true);assert.equal(await evaluate('JSON.parse(localStorage.getItem("chemical-ledger-v1")).deliveries.length'),2,'Original browser backup is retained');
 assert.equal(await evaluate('document.querySelector(".metric strong").textContent'),'$200.00');
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".sidebar [data-tab]")].map(b=>b.dataset.tab)'),['overview','deliveries','settings']);
 assert.equal(await evaluate('document.querySelector("[name=receivedQuantity]")'),null);
 assert.equal(await evaluate('document.querySelector("[name=periodStart]")'),null);
 assert.equal(await evaluate('document.body.innerText.includes("Estimated usage")'),false);
 for(const width of [1440,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),width<=800?144:112);
  for(const view of ['overview','deliveries','settings']){await evaluate(`document.querySelector('[data-tab="${view}"]').click()`);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),view+' fits at '+width);}
  await evaluate('document.querySelector("[data-tab=overview]").click()');
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
 assert.equal(inventoryRequests,0,'Invoice app never requests the retired inventory API');assert.equal((await read(other)).state.usage[0].quantity,999999,'Archived usage survives invoice saves');assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(other.errors.length,0,JSON.stringify(other.errors));
 console.log('Shared Chemical Ledger browser checks passed: two isolated computers, safe browser import, invoice totals and CSVs, archived-data preservation, no inventory requests, mobile layouts, concurrent-edit conflicts, reload recovery, offline save failure and successful retry.');
}finally{if(other)await other.close();if(h)await h.close();await removeTemporaryDirectory(directory);}})().catch(e=>{console.error(e);process.exitCode=1});
