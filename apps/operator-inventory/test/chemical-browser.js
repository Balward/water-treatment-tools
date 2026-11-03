const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server');
const {launchBrowser,removeTemporaryDirectory}=require('../../../scripts/lib/browser-check.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'chemical-browser-'));
  let server=createApp({dataDir,chemicalHistory:[]});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await launchBrowser({acceptDialogs:true});const {call,evaluate,errors}=browser;
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await call('Page.navigate',{url:base+'/'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".chemical-worksheet")'))break;await wait(50);}
    assert.ok(await evaluate('document.querySelector(".chemical-worksheet").textContent.includes("Chemical Inventory")'),'Home exposes a separate chemical inventory worksheet');
    await evaluate('history()');
    assert.ok(await evaluate('document.querySelector(".chemical-worksheet").textContent.includes("No saved readings yet")'),'Chemical card explains an empty history');
    await evaluate('document.querySelector(".chemical-worksheet").click()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("new-dialog").open'))break;await wait(50);}
    assert.ok(await evaluate('document.getElementById("new-dialog").open&&document.getElementById("new-worksheet-title").textContent==="Chemical Inventory"'),'Chemical category opens the shared new inventory popup');
    assert.equal(await evaluate('document.getElementById("inventory-date").value'),new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10),'Popup defaults to today');
    await evaluate('document.getElementById("inventory-date").value="2026-10-21";document.getElementById("operator-name").value="Blaine";document.getElementById("new-form").requestSubmit()');
    for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("save-chemical")&&!document.getElementById("save-chemical").disabled'))break;await wait(50);}
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate('document.querySelectorAll("[data-reading]").length'),16);
    assert.equal(await evaluate('document.getElementById("chemical-date").value'),'2026-10-21','Worksheet preserves the popup date');
    assert.equal(await evaluate('document.getElementById("chemical-operator").value'),'Blaine','Worksheet preserves the popup operator');
    const started=(await(await fetch(base+'/api/chemicals')).json()).records[0];
    assert.equal(started.status,'draft');assert.equal(started.counted,0,'Starting immediately saves an empty resumable draft');
    await evaluate('document.getElementById("chemical-date").value="2026-10-21";document.getElementById("chemical-date").dispatchEvent(new Event("change"));document.getElementById("chemical-operator").value="Blaine";document.getElementById("reading-naohEast").value="6";document.getElementById("reading-naohEast").dispatchEvent(new Event("input",{bubbles:true}))');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("chemical-status").textContent==="All changes saved"'))break;await wait(50);}
    const partial=(await(await fetch(base+'/api/chemicals')).json()).records[0];assert.equal(partial.status,'draft');assert.equal(partial.counted,1,'A single reading automatically saves as a draft');
    await call('Page.navigate',{url:base+'/'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector("[data-chemical-resume]")'))break;await wait(50);}
    assert.ok(await evaluate('document.querySelector("[data-chemical-resume]").textContent.includes("View")'),'Chemical and supply cards share the View button');
    await evaluate('document.querySelector(".chemical-worksheet").click()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("reading-naohEast")?.value==="6"'))break;await wait(50);}
    assert.equal(await evaluate('document.getElementById("reading-naohEast").value'),'6','Category click resumes the existing draft without another setup popup');
    assert.ok(await evaluate('document.getElementById("complete-chemical").disabled'),'A partial inventory cannot be completed');
    await evaluate('document.getElementById("chemical-date").value="2026-10-21";document.getElementById("chemical-date").dispatchEvent(new Event("change"));document.getElementById("chemical-operator").value="Blaine";for(const [id,value]of Object.entries({naohEast:6,naohCentral:6,naohWest:79,hypoEast:129,hypoWest:75,alumEast:6,alumNorth:3,alumSouth:48,alumWest:130,polymerTank:15,polymerInventory:530,permEast:31.3,permWest:12.3,permInventory:530,salt:.5,nwos:216710})){const input=document.getElementById("reading-"+id);input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));}');
    assert.ok(await evaluate('!document.querySelector("#chemical-entry .chemical-result")&&!document.querySelector("#chemical-entry details")'),'Entry stays focused on readings, without totals or calculation details');
    assert.equal(await evaluate('document.querySelectorAll("[id^=received-]").length'),0,'No delivery or chemical usage workflow');
    await evaluate('document.getElementById("chemical-report").click()');
    for(let i=0;i<80;i++){if(await evaluate('!document.getElementById("chemical-summary").hidden'))break;await wait(50);}
    assert.ok(await evaluate('document.getElementById("chemical-status").textContent.includes("All changes saved")'),'Readings save through the real API');
    assert.ok(await evaluate('!document.getElementById("chemical-summary").hidden&&!document.getElementById("chemical-saved-banner").hidden&&document.getElementById("chemical-entry").hidden'), 'Saving opens a confirmed final inventory view');
    assert.ok(await evaluate('document.getElementById("chemical-summary-content").textContent.includes("614.15")&&document.getElementById("chemical-summary-title").textContent.includes("2026")'), 'Final inventory shows saved server-calculated totals and date');
    assert.ok(await evaluate('document.querySelector(".chemical-report-details").textContent.includes("25 bags")&&document.querySelector(".chemical-report-details").textContent.includes("530 gal")'),'Saved report retains entered levels, tote conversions and salt equivalents');
    assert.ok(await evaluate('document.querySelector(".chemical-report-readings").textContent.includes("31.3 in")&&document.querySelector(".chemical-report-readings").textContent.includes("530 gal")&&!document.querySelector(".chemical-report-readings").closest("details")'),'Report shows inch readings and stored gallons without expanding details');
    assert.equal(await evaluate('document.querySelectorAll("[data-order-chemical]").length'),5,'Report includes order guidance for each chemical');
    assert.ok(await evaluate('[...document.querySelectorAll("[data-order-chemical]")].find(el=>el.dataset.orderChemical==="alum").textContent.includes("Order Now")'),'Report flags alum below its reorder level');
    for(const width of [1440,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait(80);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Tank readings and order report fit without horizontal overflow at '+width);
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate('window.scrollY<100'), 'Saving returns to the visible confirmation at the top');
    await call('Page.navigate',{url:base+'/'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".chemical-worksheet time")'))break;await wait(50);}
    assert.equal(await evaluate('document.querySelector(".chemical-worksheet time").dateTime'),'2026-10-21','Home card shows the saved chemical reading date');
    await call('Page.navigate',{url:base+'/chemical-inventory.html'});await wait(150);
    await call('Page.reload');await wait(150);for(let i=0;i<80;i++){if(await evaluate('document.readyState==="complete"&&!!document.querySelector("[data-edit-date]")&&!document.getElementById("save-chemical").disabled'))break;await wait(50);}
    await evaluate('document.getElementById("history-tab").click();document.querySelector("[data-edit-date]").click()');
    assert.equal(await evaluate('document.getElementById("reading-salt").value'),'0.5','History restores saved values');
    for(const width of [1440,900,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait(100);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No horizontal overflow at '+width);
      assert.ok(await evaluate('document.getElementById("chemical-entry").getBoundingClientRect().width>=Math.min(document.documentElement.clientWidth-50,1000)'), 'Chemical worksheet uses the available width at '+width);
      assert.ok(await evaluate('parseFloat(getComputedStyle(document.getElementById("reading-naohEast")).fontSize)>=16'),'Phone inputs avoid focus zoom');
      await evaluate('document.activeElement?.blur();window.scrollTo(0,0)');
      await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:Math.round(width*.8),y:500,deltaX:0,deltaY:800});await wait(150);
      assert.ok(await evaluate('window.scrollY>0'),'Real wheel scrolling reaches fields below NaOH at '+width);
      await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:Math.round(width*.8),y:500,deltaX:0,deltaY:100000});await wait(150);
      assert.ok(await evaluate('(()=>{const r=document.getElementById("save-chemical").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()'),'Save button is reachable by scrolling at '+width);
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    fs.mkdirSync(path.resolve(__dirname,'../../../preview'),{recursive:true});
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.resolve(__dirname,'../../../preview/chemical-inventory-desktop.png'),Buffer.from(shot.data,'base64'));
    await evaluate('document.getElementById("complete-chemical").click()');
    for(let i=0;i<80;i++){if(await evaluate('document.getElementById("chemical-summary-title").textContent.includes("Completed Inventory")'))break;await wait(50);}
    assert.ok(await evaluate('!document.getElementById("summary-edit").hidden&&document.getElementById("chemical-summary-title").textContent.includes("Completed Inventory")'),'Completed report offers Edit');
    await call('Page.navigate',{url:base+'/'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector("[data-chemical-edit]")'))break;await wait(50);}
    assert.ok(await evaluate('document.querySelector("[data-chemical-view]").textContent.includes("View")&&!!document.querySelector("[data-chemical-delete].trash-button")'),'Chemical history cards have matching View, Edit and Delete controls');
    await evaluate('document.querySelector("[data-chemical-edit]").click()');
    for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("reading-naohEast")&&!document.getElementById("chemical-entry").hidden&&!document.getElementById("reading-naohEast").disabled'))break;await wait(50);}
    assert.ok(await evaluate('!document.getElementById("reading-naohEast").disabled'),'Completed readings can be corrected');
    await evaluate('document.getElementById("reading-naohEast").value="7";document.getElementById("reading-naohEast").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("chemical-form").requestSubmit()');
    for(let i=0;i<100;i++){const data=await(await fetch(base+'/api/chemicals')).json();if(data.records[0].readings.naohEast===7)break;await wait(50);}
    const corrected=(await(await fetch(base+'/api/chemicals')).json()).records[0];assert.equal(corrected.readings.naohEast,7);assert.equal(corrected.status,'complete','Correction preserves completion');
    await call('Page.navigate',{url:base+'/'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".chemical-worksheet")'))break;await wait(50);}
    await evaluate('document.querySelector(".chemical-worksheet").click()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("new-dialog").open'))break;await wait(50);}
    await evaluate('document.getElementById("inventory-date").value="2026-10-21";document.getElementById("operator-name").value="Carson";document.getElementById("new-form").requestSubmit()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("form-error").textContent.includes("already exists")'))break;await wait(50);}
    assert.ok(await evaluate('document.getElementById("new-dialog").open&&document.getElementById("form-error").textContent.includes("already exists")'),'Duplicate dates stay in the setup popup with a visible explanation');
    assert.equal(await evaluate('document.getElementById("operator-name").value'),'Carson','Validation preserves entered operator');
    await evaluate('document.getElementById("cancel-new").click()');
    assert.equal((await(await fetch(base+'/api/chemicals')).json()).records.length,1,'Cancel and duplicate attempts create no extra inventory');
    await evaluate('document.querySelector("[data-chemical-delete]").click()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("delete-dialog").open'))break;await wait(50);}
    assert.ok(await evaluate('document.getElementById("delete-copy").textContent.includes("Chemical Inventory")'),'Chemical delete uses the shared confirmation dialog');
    await evaluate('document.getElementById("cancel-delete").click()');
    assert.equal((await(await fetch(base+'/api/chemicals')).json()).records.length,1,'Cancelling deletion preserves the saved inventory');
    await evaluate('document.querySelector("[data-chemical-delete]").click()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("delete-dialog").open'))break;await wait(50);}
    await evaluate('document.getElementById("confirm-delete").click()');
    for(let i=0;i<100;i++){if(await evaluate('!document.getElementById("delete-dialog").open&&!document.querySelector("[data-chemical-delete]")'))break;await wait(50);}
    assert.equal((await(await fetch(base+'/api/chemicals')).json()).records.length,0,'Main history Delete removes the chemical inventory');
    await new Promise(r=>server.close(r));server=createApp({dataDir});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
    await call('Page.navigate',{url:base+'/chemical-inventory.html'});
    for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll("[data-view-date]").length===41'))break;await wait(50);}
    await evaluate('document.getElementById("history-tab").click();[...document.querySelectorAll("[data-view-date]")].find(b=>b.dataset.viewDate==="2026-01-08").click()');
    assert.ok(await evaluate('!document.getElementById("chemical-summary").hidden&&document.getElementById("chemical-summary-content").textContent.includes("4,226.95")'),'Historical summary shows original January gallons');
    assert.ok(await evaluate('!document.getElementById("summary-edit").hidden&&document.getElementById("chemical-summary-content").textContent.includes("without recalculating")'),'Imported snapshots also offer Edit without recalculating old tank readings');
    const imported=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.resolve(__dirname,'../../../preview/chemical-inventory-imported.png'),Buffer.from(imported.data,'base64'));
    await evaluate('document.getElementById("trends-tab").click()');await wait(100);
    assert.equal(await evaluate('document.querySelectorAll("#trend-item option").length'),7,'Each chemical, salt, and NWOS has its own trend');
    assert.equal(await evaluate('document.querySelectorAll("[data-trend-point]").length'),41,'All imported chemical inventories appear in the trend');
    assert.ok(await evaluate('!!document.querySelector(".trend-forecast-line")&&document.getElementById("trend-forecast-summary").textContent.includes("Recent net drawdown")'), 'Recent inventory readings produce a labeled forecast line');
    await evaluate('document.getElementById("trend-forecast-enabled").click()');
    assert.ok(await evaluate('!document.querySelector(".trend-forecast-line")'), 'Forecast can be hidden');
    await evaluate('document.getElementById("trend-forecast-enabled").click();document.getElementById("trend-forecast-days").value="60";document.getElementById("trend-forecast-days").dispatchEvent(new Event("change"))');
    assert.ok(await evaluate('!!document.querySelector(".trend-forecast-line")'), 'Forecast horizon can be changed');
    const chartBounds=await evaluate('(()=>{const r=document.getElementById("trend-chart").getBoundingClientRect();return{x:r.right-20,y:r.top+80}})()');
    await evaluate('document.getElementById("trend-chart").dispatchEvent(new PointerEvent("pointermove",{clientX:'+chartBounds.x+',clientY:'+chartBounds.y+',bubbles:true}))');
    assert.ok(await evaluate('document.getElementById("trend-point-date").textContent.includes("Forecast")&&document.getElementById("trend-open-inventory").hidden'), 'Projected dates are labeled as forecasts and cannot open a nonexistent inventory');
    for(const key of ['hypochlorite','alum','polymer','permanganate','naoh']){
      await evaluate('document.getElementById("trend-item").value='+JSON.stringify(key)+';document.getElementById("trend-item").dispatchEvent(new Event("change"))');
      assert.equal(await evaluate('document.querySelectorAll("[data-trend-point]").length'),41,'Recorded gallons trend independently for '+key);
      assert.ok(await evaluate('!!document.querySelector(".trend-reorder-line")&&document.getElementById("trend-order-plan").textContent.includes("Lead time: 7 days")'),'Reorder line and facility order assumptions appear for '+key);
    }
    assert.ok(await evaluate('document.getElementById("trend-order-plan").textContent.includes("1,250 gal remaining")'),'Caustic planning explains the full-load capacity constraint');
    await evaluate('[...document.querySelectorAll("[data-trend-point]")].find(p=>p.getAttribute("tabindex")==="0").dispatchEvent(new KeyboardEvent("keydown",{key:"Home",bubbles:true}))');
    assert.ok(await evaluate('document.getElementById("trend-point-value").textContent.includes("4,226.95")'),'Keyboard selection shows the original January gallon total');
    await evaluate('document.getElementById("trend-open-inventory").click()');
    assert.ok(await evaluate('!document.getElementById("chemical-summary").hidden&&document.getElementById("chemical-summary-title").textContent.includes("Jan 8")'),'A chart reading opens its saved inventory');
    await evaluate('document.getElementById("trends-tab").click();document.getElementById("trend-from").value="2026-10-01";document.getElementById("trend-through").value="2026-10-21";document.getElementById("trend-through").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-trend-point]").length'),3,'Custom date ranges filter individual charts');
    await evaluate('document.getElementById("trend-range").value="all";document.getElementById("trend-range").dispatchEvent(new Event("change"));document.getElementById("trend-item").value="salt";document.getElementById("trend-item").dispatchEvent(new Event("change"))');
    assert.ok(await evaluate('document.getElementById("trend-chart-panel").hidden&&document.getElementById("trend-status").textContent.includes("No salt counts")'),'Missing salt history is explained rather than charted as zero');
    assert.ok(await evaluate('document.getElementById("trend-order-plan").hidden'),'No invented salt ordering assumptions');
    const beforeSalt=await(await fetch(base+'/api/chemicals')).json();
    assert.ok((await fetch(base+'/api/chemicals/records/2026-10-27',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:beforeSalt.revision,operator:'Trend check',readings:{salt:.5},notes:''})})).ok);
    await call('Page.reload');await wait(150);for(let i=0;i<80;i++){if(await evaluate('document.querySelectorAll("[data-view-date]").length===42'))break;await wait(50);}
    await evaluate('document.getElementById("trends-tab").click();document.getElementById("trend-item").value="salt";document.getElementById("trend-item").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-trend-point]").length'),1,'A single saved pallet count produces a valid chart');
    assert.ok(await evaluate('document.getElementById("trend-point-value").textContent.includes("0.5 pallets")'),'Salt chart uses pallet units');
    assert.ok(await evaluate('!document.querySelector(".trend-forecast-line")&&document.getElementById("trend-forecast-summary").textContent.includes("Forecast needs")'), 'A single salt reading does not fabricate a usage forecast');
    await evaluate('document.getElementById("trend-item").value="nwos";document.getElementById("trend-item").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-trend-point]").length'),40,'NWOS water used retains genuine zero readings');
    await evaluate('document.getElementById("trend-measure").value="meter";document.getElementById("trend-measure").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("[data-trend-point]").length'),41,'NWOS counter readings are independently selectable');
    for(const width of [1440,900,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait(150);
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Trends fit without horizontal overflow at '+width);
      assert.ok(await evaluate('document.querySelectorAll("[data-trend-point]").length===41&&!document.getElementById("trend-chart").innerHTML.includes("NaN")'),'Trend chart remains valid after resizing');
    }
    await evaluate('document.getElementById("trend-item").value="permanganate";document.getElementById("trend-item").dispatchEvent(new Event("change"))');await wait(100);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.getElementById("trend-order-plan").textContent.includes("East 10% batch excluded")'),'Ordering panel fits a phone and excludes diluted permanganate');
    const trendShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.resolve(__dirname,'../../../preview/chemical-inventory-trends-phone.png'),Buffer.from(trendShot.data,'base64'));
    // Starting another inventory must remain possible when today's report exists.
    let state=await(await fetch(base+'/api/chemicals')).json();
    for(const record of state.records.filter(record=>record.status==='draft'))state=await(await fetch(base+'/api/chemicals/records/'+record.date,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision})})).json();
    const todayDate=await evaluate('new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)');
    const emptyReadings=await evaluate('Object.fromEntries(ChemicalInventory.fields.map(([id])=>[id,0]))');
    assert.ok((await fetch(base+'/api/chemicals/records/'+todayDate,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,status:'complete',operator:'Completed today',readings:emptyReadings,notes:''})})).ok);
    await call('Page.navigate',{url:base+'/chemical-inventory.html?view=new'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("chemical-history")&&!document.getElementById("chemical-history").hidden&&document.querySelectorAll("[data-view-date]").length===42'))break;await wait(50);}
    assert.ok(await evaluate('document.getElementById("chemical-entry").hidden&&document.getElementById("entry-tab").hidden'),'A direct or old New Inventory link shows history without creating an entry form');
    assert.ok(await evaluate('!document.getElementById("summary-new")'),'Reports contain no New Inventory button');
    await call('Page.navigate',{url:base+'/chemical-inventory.html?date='+todayDate+'&view=report'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("chemical-summary")&&!document.getElementById("chemical-summary").hidden'))break;await wait(50);}
    assert.ok(await evaluate('[...document.querySelectorAll("button")].every(button=>!button.textContent.includes("New Inventory"))'),'Existing inventories contain no New Inventory action');
    await call('Page.navigate',{url:base+'/'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".chemical-worksheet")'))break;await wait(50);}
    await evaluate('document.querySelector(".chemical-worksheet").click()');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("new-dialog").open'))break;await wait(50);}
    await evaluate('document.getElementById("inventory-date").value="2026-10-22";document.getElementById("operator-name").value="Next inventory";document.getElementById("new-form").requestSubmit()');
    for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("reading-naohEast")&&!document.getElementById("reading-naohEast").disabled'))break;await wait(50);}
    await evaluate('document.getElementById("reading-naohEast").value="7";document.getElementById("reading-naohEast").dispatchEvent(new Event("input",{bubbles:true}))');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("chemical-status").textContent==="All changes saved"'))break;await wait(50);}
    state=await(await fetch(base+'/api/chemicals')).json();assert.equal(state.records.find(record=>record.date==='2026-10-22').status,'draft');assert.equal(state.records.find(record=>record.date===todayDate).operator,'Completed today','Home setup creates a new draft without changing historical records');
    await evaluate('document.getElementById("history-tab").click();document.getElementById("entry-tab").click()');await wait(100);
    assert.equal(await evaluate('document.getElementById("reading-naohEast").value'),'7','Inventory tab returns to the selected draft');
    await call('Page.navigate',{url:base+'/chemical-inventory.html?date=2026-01-08&view=edit'});
    for(let i=0;i<100;i++){if(await evaluate('!!document.getElementById("snapshot-naoh")&&!document.getElementById("chemical-snapshot-fields").hidden&&!document.getElementById("snapshot-naoh").disabled'))break;await wait(50);}
    assert.ok(await evaluate('document.getElementById("chemical-fields").hidden'),'Imported edit uses original gallons instead of modern tank inputs');
    await evaluate('document.getElementById("snapshot-naoh").value="4300";document.getElementById("snapshot-naoh").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("chemical-form").requestSubmit()');
    for(let i=0;i<100;i++){const data=await(await fetch(base+'/api/chemicals')).json();if(data.records.find(record=>record.date==="2026-01-08").totals.naoh.gallons===4300)break;await wait(50);}
    const snapshot=(await(await fetch(base+'/api/chemicals')).json()).records.find(record=>record.date==='2026-01-08');
    assert.equal(snapshot.totals.naoh.gallons,4300);assert.equal(snapshot.readings.naohEast,null);assert.equal(snapshot.source.type,'workbook');
    assert.deepEqual(errors,[]);
    console.log('Passed: chemical worksheet entry, live formulas, save/reload/history/delete, and 320–1440px responsive layouts.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));await removeTemporaryDirectory(dataDir);}
})().catch(error=>{console.error(error);process.exitCode=1;});
