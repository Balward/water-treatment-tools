const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server'),model=require('../public/chemical-math');
const {launchBrowser}=require('../../../scripts/lib/browser-check.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'nwos-browser-'));
 const readings=Object.fromEntries(model.fields.map(([id])=>[id,id==='nwos'?216710:0]));
 fs.writeFileSync(path.join(dataDir,'inventories.json'),JSON.stringify({inventories:[],chemicalInventory:{revision:0,draftLifecycleVersion:1,records:[{date:'2026-11-04',operator:'Operator',status:'complete',notes:'',readings},{date:'2026-11-11',operator:'Operator',status:'draft',notes:'',readings:{}}]}}));
 const server=createApp({dataDir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await launchBrowser();const {call,evaluate}=browser;
  const ready=async()=>{for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("nwos-pump-off")&&!document.getElementById("nwos-pump-off").disabled'))return;await wait(50);}throw Error('Editor unavailable');};
  await call('Page.navigate',{url:base+'/chemical-inventory.html?date=2026-11-11'});await ready();
  assert.equal(await evaluate('document.querySelectorAll("[data-reading][aria-describedby]").length'),16);
  assert.match(await evaluate('document.getElementById("previous-naohEast").textContent'),/Previous: 0 in.*Nov 4, 2026/);
  assert.equal(await evaluate('document.getElementById("reading-naohEast").value'),'','References never prefill chemical levels');
  await evaluate('document.getElementById("nwos-pump-off").click()');
  assert.equal(await evaluate('document.getElementById("reading-nwos").value'),'216710');
  assert.equal(await evaluate('document.getElementById("reading-nwos").readOnly'),true);
  for(let i=0;i<100;i++){const state=await(await fetch(base+'/api/chemicals')).json();if(state.records[0].nwosPumpOff)break;await wait(50);}
  await call('Page.reload');await wait(250);await ready();
  assert.equal(await evaluate('document.getElementById("nwos-pump-off").checked'),true);
  assert.equal(await evaluate('document.getElementById("reading-nwos").value'),'216710');
  for(const width of [1440,390,320]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);
  }
  await evaluate('document.getElementById("chemical-report").click()');
  for(let i=0;i<100;i++){if(await evaluate('!document.getElementById("chemical-summary").hidden'))break;await wait(50);}
  assert.match(await evaluate('document.getElementById("chemical-summary-content").textContent'),/Pump off; carried forward from Nov 4, 2026/);
  await evaluate('document.getElementById("summary-edit").click();document.getElementById("nwos-pump-off").click()');
  assert.equal(await evaluate('document.getElementById("reading-nwos").readOnly'),false);
  assert.equal(await evaluate('document.getElementById("reading-nwos").value'),'','Unchecking requests a fresh reading');
  await evaluate('document.getElementById("reading-nwos").value="216720";document.getElementById("reading-nwos").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("chemical-form").requestSubmit()');
  for(let i=0;i<100;i++){const state=await(await fetch(base+'/api/chemicals')).json();if(state.records[0].readings.nwos===216720&&!state.records[0].nwosPumpOff)break;await wait(50);}
  const state=await(await fetch(base+'/api/chemicals')).json();assert.equal(state.records[0].readings.nwos,216720);assert.equal(state.records[0].nwosPumpOff,false);assert.equal(state.records[0].nwosUsed,10000);
  assert.deepEqual(browser.errors,[]);
  console.log('Passed: previous readings, zero references, pump-off autosave/reload/report, fresh readings and 320–1440px layouts.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
