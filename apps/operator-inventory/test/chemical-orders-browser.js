const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{createApp}=require('../server'),model=require('../public/chemical-math'),catalog=require('../catalog.json');
const {launchBrowser,removeTemporaryDirectory}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chemical-purchasing-browser-'));
  const item=catalog.items.find(item=>item.id==='s1-r35'),supplyId=randomUUID();
  fs.writeFileSync(path.join(dir,'inventories.json'),JSON.stringify({inventories:[],orderList:[{id:supplyId,item,quantity:1,orderUnit:'Each',notes:'',source:'manual'}],chemicalInventory:{revision:0,draftLifecycleVersion:1,records:[{date:'2026-10-28',operator:'Blaine',status:'complete',updatedAt:'2026-10-28T12:00:00Z',notes:'',readings:Object.fromEntries(model.fields.map(([id])=>[id,1]))}]}}));
  const server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await launchBrowser({acceptDialogs:true});const {call,evaluate}=browser;
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+expression);};
    await call('Page.navigate',{url:base});await until('!!document.querySelector("[data-worksheet]")');
    await evaluate('document.getElementById("nav-order-list").click()');await until('document.querySelectorAll(".chemical-order").length===5');
    assert.equal(await evaluate('document.querySelectorAll("#order-list-items .product-photo img").length'),1,'Supply photo remains alongside chemical cards');
    for(const width of [1440,390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);}
    await evaluate('document.querySelector("[data-order-filter=chemical]").click()');assert.equal(await evaluate('document.querySelectorAll("#order-list-items .report-item").length'),5);
    await evaluate('document.querySelector(".chemical-order [data-edit-order]").click()');
    assert.ok(await evaluate('!document.getElementById("chemical-order-fields").hidden'),'Chemical delivery controls appear');
    await evaluate('window.chemicalId=editingOrder.id;document.getElementById("chemical-order-supplier").value="Facility Chemical Supplier";document.getElementById("chemical-order-delivery").value="2026-11-04";document.getElementById("order-details-form").requestSubmit()');
    await until('!document.getElementById("order-details-dialog").open');
    await evaluate('[...document.querySelectorAll("[data-order-select]")].find(input=>input.dataset.orderSelect===window.chemicalId).click();document.querySelector("[data-order-filter=supply]").click();document.querySelector("[data-order-select]").click();document.getElementById("review-all-orders").click()');
    await until('!document.getElementById("order-review-view").hidden');
    assert.ok(await evaluate('document.getElementById("order-review-items").textContent.includes("Expected Delivery")'),'Review includes chemical delivery date');
    assert.equal(await evaluate('document.querySelectorAll("#order-review-items .product-photo img").length'),1,'Supply image survives combined purchase review');
    await evaluate('document.getElementById("order-review-back").click()');await until('!document.getElementById("order-list-view").hidden');
    await evaluate('document.getElementById("mark-selected-ordered").click();document.getElementById("ordered-by").value="Blaine";document.getElementById("ordered-date").value="2026-10-28";document.getElementById("ordered-form").requestSubmit()');
    await until('!document.getElementById("ordered-dialog").open&&orderList.orders.length===1');
    const saved=await(await fetch(base+'/api/order-list')).json();assert.equal(saved.orders[0].items.length,2);assert.equal(saved.items.length,4,'Recorded chemical stays out of the queue');
    await evaluate('document.getElementById("placed-orders-tab").click()');await until('!document.getElementById("order-history-view").hidden');assert.ok(await evaluate('document.getElementById("past-order-items").textContent.includes("Expected Delivery")'));
    assert.deepEqual(browser.errors,[]);console.log('Chemical purchasing browser passed: supply photos, filters, mobile widths, delivery edit, mixed review, placement and history.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));await removeTemporaryDirectory(dir);}
})().catch(error=>{console.error(error);process.exitCode=1;});
