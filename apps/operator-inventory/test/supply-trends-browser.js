const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server'),catalog=require('../catalog.json'),packs=require('../public/pack-sizes'),{launchBrowser,removeTemporaryDirectory}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'supply-trends-browser-')),items=catalog.items.filter(i=>i.sourceSheet===1).map(packs.normalize);
  const inventories=['2026-09-01','2026-09-08','2026-09-15','2026-09-22','2026-09-29'].map((date,index)=>({id:'record-'+index,worksheet:'operating',date,operator:'Blaine Alward',status:'complete',revision:0,createdAt:date+'T12:00:00Z',updatedAt:date+'T12:00:00Z',items,counts:Object.fromEntries(items.map(item=>[item.id,20-index*2]))}));
  fs.writeFileSync(path.join(dir,'inventories.json'),JSON.stringify({inventories}));
  const server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
  try {
    browser=await launchBrowser();const {call,evaluate}=browser;
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+expression);};
    await call('Page.navigate',{url:base+'/supply-trends.html'});await until('document.querySelectorAll("#supply-review tr").length===40');
    // Keep this fixture independent of the day the test is run.
    await evaluate('document.getElementById("supply-window").value="all";document.getElementById("supply-window").dispatchEvent(new Event("input",{bubbles:true}))');
    assert.ok(await evaluate('!!document.querySelector("#supply-chart svg")'));
    assert.ok(await evaluate('!document.getElementById("save-supply-par").hidden'));
    for(const width of [1440,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('document.fonts.ready');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);
      assert.equal(await evaluate('getComputedStyle(document.getElementById("supply-item")).fontSize'),'16px');
    }
    const selected=await evaluate('document.getElementById("supply-item").value');
    await evaluate('document.getElementById("save-supply-par").click()');await until('document.getElementById("supply-status").textContent.startsWith("Saved PAR")');
    const updated=await(await fetch(base+'/api/catalog')).json(),saved=updated.items.find(item=>item.id===selected);
    assert.equal(saved.par,6);assert.equal(saved.description,items.find(item=>item.id===selected).description);
    const history=await(await fetch(base+'/api/supply-trends')).json();assert.equal(history[0].items.find(item=>item.id===selected).par,items.find(item=>item.id===selected).par);
    assert.deepEqual(browser.errors,[]);console.log('Supply trends browser passed: charts, PAR calculation and save, preserved snapshots, desktop and mobile layout.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));await removeTemporaryDirectory(dir);}
})().catch(error=>{console.error(error);process.exitCode=1;});
