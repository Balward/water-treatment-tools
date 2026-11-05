const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server');
const {launchBrowser,removeTemporaryDirectory}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-trends-'));
  const server=createApp({dataDir,chemicalHistory:[]});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser=await launchBrowser();const {call,evaluate}=browser;
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression);};
    await call('Page.navigate',{url:base+'/'});
    await until('!!document.querySelector(".chemical-worksheet")');
    await evaluate('document.getElementById("nav-trends").click()');
    await until('location.pathname==="/trends.html"&&document.querySelectorAll("#supply-review tr").length>0');
    assert.equal(await evaluate('document.querySelector(".bottom-nav [aria-current=page]").textContent.trim()'),'Trends');
    await evaluate('document.getElementById("chemicals-tab").click()');
    await until('document.getElementById("trend-status").textContent.includes("No ")');
    assert.equal(await evaluate('document.querySelectorAll("#trend-item option").length'),7);
    assert.ok(await evaluate('!document.getElementById("chemicals-panel").hidden&&document.getElementById("supplies-panel").hidden'));
    assert.equal((await (await fetch(base+'/api/chemicals')).json()).records.length,0,'Opening trends never creates an inventory');
    for(const width of [1920,1280,900,899,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await evaluate('document.fonts.ready');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Chemical trends fit '+width);
      assert.equal(await evaluate('document.querySelectorAll(".bottom-nav a").length'),5);
      assert.ok(await evaluate('(()=>{const nav=document.querySelector(".bottom-nav");return nav.scrollWidth<=nav.clientWidth})()'),'All five navigation items fit '+width);
      await evaluate('document.getElementById("supplies-tab").click()');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Supply trends fit '+width);
      await evaluate('document.getElementById("chemicals-tab").click()');
    }
    await evaluate('document.getElementById("chemicals-tab").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true}))');
    assert.equal(await evaluate('document.activeElement.id'),'supplies-tab');
    await call('Page.navigate',{url:base+'/trends.html?view=chemicals'});
    await until('!!document.getElementById("chemicals-panel")&&!document.getElementById("chemicals-panel").hidden');
    await evaluate('[...document.querySelectorAll(".bottom-nav a")].find(a=>a.href.endsWith("?view=history")).click()');
    await until('document.getElementById("nav-history")?.getAttribute("aria-current")==="page"');
    assert.ok(await evaluate('document.getElementById("home-view").hidden'));
    await evaluate('document.getElementById("nav-order-list").click()');
    await until('!document.getElementById("order-list-view").hidden');
    assert.ok(await evaluate('!document.getElementById("orders-navigation").hidden'));
    await evaluate('document.getElementById("placed-orders-tab").click()');
    await until('!document.getElementById("order-history-view").hidden');
    assert.equal(await evaluate('document.getElementById("nav-order-list").getAttribute("aria-current")'),'page');
    await evaluate('document.getElementById("to-order-tab").click()');
    await until('!document.getElementById("order-list-view").hidden');
    await call('Page.navigate',{url:base+'/?view=manage'});
    await until('document.querySelectorAll(".manager-card").length>0');
    assert.deepEqual(browser.errors,[]);
    console.log('Unified trends browser passed: direct menu access, tabs, empty chemicals, no inventory creation, keyboard access, history/management return links, and responsive widths.');
  } finally {
    await browser?.close();await new Promise(resolve=>server.close(resolve));await removeTemporaryDirectory(dataDir);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
