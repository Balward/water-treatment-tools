const assert=require('node:assert/strict'),fs=require('node:fs');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
(async()=>{const h=await createBrowserCheck();const {call,evaluate,errors}=h;
try{
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'http://127.0.0.1:8782/apps/chemical-ledger/index.html'});
 for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".metric").length===4'))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate('document.querySelectorAll(".metric").length'),4);
 assert.equal(await evaluate('document.querySelectorAll(".chemical").length'),5);
 await evaluate('document.fonts.ready');
 assert(await evaluate('document.fonts.check("16px Inter")'));
 assert.equal(await evaluate('document.querySelector(".site-header .brand img").naturalWidth>0'),true);
 assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),112);
 assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().width'),222);
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".primary")).backgroundColor'),'rgb(0, 103, 127)');
 await evaluate('document.querySelector("[data-add=deliveries]").click()');
 assert.equal(await evaluate('document.getElementById("recordDialog").open'),true);
 assert.deepEqual(await evaluate('[...document.querySelector("select[name=supplier]").options].map(o=>o.value)'),['','PVS DX, INC','Harcros','Nalco','Chemtrade']);
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2026-02-01";f.elements.quantity.value="100";f.elements.reference.value="TEST-001";f.elements.supplier.value="Harcros";f.requestSubmit()})()');
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("chemical-ledger-v1")).deliveries[0].price'),1.64);
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("chemical-ledger-v1")).deliveries[0].supplier'),'Harcros');
 await evaluate('document.querySelector("[data-tab=deliveries]").click();document.querySelector("[data-edit]").click()');
 assert.equal(await evaluate('document.getElementById("recordForm").elements.supplier.value'),'Harcros');
 await evaluate('document.getElementById("closeDialog").click()');
 await evaluate('document.querySelector("[data-tab=usage]").click();document.querySelector("[data-add=usage]").click()');
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2025-12-31";f.elements.quantity.value="200";f.requestSubmit()})()');
 await evaluate('document.querySelector("[data-add=usage]").click()');
 await evaluate('(()=>{const f=document.getElementById("recordForm");f.elements.date.value="2026-09-30";f.elements.quantity.value="300";f.requestSubmit()})()');
 await call('Page.reload');
 for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".metric").length===4'))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("chemical-ledger-v1")).usage.length'),2,'Records survive reload');
 await evaluate('document.querySelector("[data-tab=planner]").click()');
 await evaluate(`(()=>{const input=document.querySelector('[data-history="2026"][data-field=months]');input.value="9";input.dispatchEvent(new Event("change",{bubbles:true}))})()`);
 assert.match(await evaluate('document.querySelector(".planCard .pill").textContent'),/320 lb/);
 assert.match(await evaluate('document.querySelector(".planCard .cost").textContent'),/524\.80/);
 for(const width of [1440,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),width<=800?144:112);
  for(const view of ['overview','deliveries','usage','planner','settings']){
   await evaluate(`document.querySelector('[data-tab="${view}"]').click()`);
   assert.equal(await evaluate('document.querySelector(".sidebar [aria-current=page]").dataset.tab'),view);
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),view+' fits at '+width);
  }
  await evaluate('document.querySelector("[data-tab=overview]").click()');
  if(width!==320){fs.mkdirSync('preview',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('preview/chemical-ledger-'+width+'.png',Buffer.from(shot.data,'base64'));}
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No page overflow at '+width);
  await evaluate('document.querySelector("[data-ops-menu]").click()');
  assert.equal(await evaluate('document.querySelector("#opsAppMenu [aria-current=page]").dataset.opsDestination'),'chemical-ledger');
  assert.equal(await evaluate('new URL(document.querySelector("#opsAppMenu [data-ops-destination=chemical-ledger]").href).pathname'),'/chemical-ledger/');
  await evaluate('document.querySelector(".ops-app-menu-close").click()');
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Chemical Ledger passed: five chemicals, invoice entry, historical usage, reload persistence, weighted partial-year PO forecast, suite navigation, desktop and phone layouts.');
}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1});
