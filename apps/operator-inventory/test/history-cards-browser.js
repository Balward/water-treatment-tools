const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {createApp}=require('../server'),catalog=require('../catalog.json'),{launchBrowser,removeTemporaryDirectory}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'history-cards-'));
  const high={naohEast:100,naohCentral:100,naohWest:100,hypoEast:100,hypoWest:100,alumEast:100,alumNorth:100,alumSouth:100,alumWest:100,polymerTank:40,polymerInventory:530,permEast:30,permWest:30,permInventory:530,salt:1,nwos:200000};
  const records=['2026-10-08','2026-10-15','2026-10-22','2026-10-29'].map(date=>({date,operator:'Blaine Alward',notes:'',status:'complete',updatedAt:date+'T12:00:00Z',readings:date==='2026-10-29'?{...high,naohEast:0,naohCentral:0,naohWest:30,alumEast:5,alumNorth:30,alumSouth:30,alumWest:30}:high}));
  const items=catalog.items.filter(item=>item.sourceSheet===1),lowItems=items.filter(item=>typeof item.par==='number').slice(0,2);
  const inventories=['2026-10-22','2026-10-29'].map(date=>({id:randomUUID(),worksheet:'operating',date,operator:'Blaine Alward',status:'complete',revision:0,createdAt:date+'T11:00:00Z',updatedAt:date+'T11:00:00Z',items,counts:Object.fromEntries(items.map(item=>[item.id,date==='2026-10-29'&&lowItems.includes(item)?0:999])),previousCounts:{}}));
  fs.writeFileSync(path.join(dir,'inventories.json'),JSON.stringify({inventories,chemicalInventory:{revision:0,draftLifecycleVersion:1,records}}));
  const server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await launchBrowser();const {call,evaluate}=browser;
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+expression);};
    await call('Page.navigate',{url:base});await until('document.querySelectorAll(".history-card").length===4');
    await evaluate('document.fonts.ready');
    for(const width of [1440,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);
      assert.equal(await evaluate('document.querySelectorAll(".report-button[data-order-state=due]").length'),2);
      assert.equal(await evaluate('document.querySelectorAll(".report-button[data-order-state=none]").length'),2);
      assert.ok(await evaluate('[...document.querySelectorAll(".history-card")].every(card=>card.querySelector(".history-order-summary")&&card.querySelector(".history-controls").children.length===3&&card.querySelector(".report-button"))'));
      if(width===1440){assert.ok(await evaluate('(()=>{const cards=[...document.querySelectorAll(".history-card")],a=cards[0].querySelector(".history-bottom").getBoundingClientRect(),b=cards[1].querySelector(".history-bottom").getBoundingClientRect();return Math.abs(a.top-b.top)<1})()'),'Chemical and supply actions align');}
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await evaluate('document.getElementById("history-view").scrollIntoView({block:"start"})');
    fs.mkdirSync(path.resolve(__dirname,'../../../preview'),{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.resolve(__dirname,'../../../preview/matching-inventory-cards.png'),Buffer.from(shot.data,'base64'));
    await evaluate('document.querySelector("[data-inventory-type=chemical] .report-button").click()');await until('!!document.getElementById("chemical-summary")&&!document.getElementById("chemical-summary").hidden');assert.ok(await evaluate('location.search.includes("2026-10-29")&&location.search.includes("view=report")'),'Chemical status bar opens its own dated report');
    await call('Page.navigate',{url:base});await until('document.querySelectorAll(".history-card").length===4');
    await evaluate('document.getElementById("nav-history").click();document.getElementById("history-type").value="chemical";document.getElementById("history-type").dispatchEvent(new Event("change"))');
    assert.ok(await evaluate('!!document.querySelector(".report-button[data-order-state=review]")'),'Sparse early history asks for review rather than claiming no order');
    assert.deepEqual(browser.errors,[]);console.log('History cards passed: matching slots, due/no-order bars, dated chemical report, sparse history, desktop alignment and mobile widths.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));await removeTemporaryDirectory(dir);}
})().catch(error=>{console.error(error);process.exitCode=1;});
