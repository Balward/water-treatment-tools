const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server'),{launchBrowser,removeTemporaryDirectory}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chemical-settings-browser-')),server=createApp({dataDir:dir,chemicalHistory:[]});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await launchBrowser({acceptDialogs:true});const {call,evaluate}=browser;
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+expression);};
    await call('Page.navigate',{url:base});await until('!!document.querySelector("[data-worksheet]")');
    await evaluate('document.getElementById("nav-manage").click()');await until('!document.getElementById("item-manager").hidden');
    assert.equal(await evaluate('document.querySelectorAll(".management-tabs button").length'),3);
    await evaluate('document.getElementById("manager-search").value="LZY876";document.getElementById("manager-search").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.querySelectorAll("#manager-list .manager-card").length'),1,'Supply product-number search works');
    await evaluate('document.getElementById("manager-search").value="";document.getElementById("manager-search").dispatchEvent(new Event("input"));document.getElementById("chemical-settings-tab").click()');await until('!!document.getElementById("settings-supplier")');
    for(const width of [1440,390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Settings fit '+width);}
    fs.mkdirSync(path.resolve(__dirname,'../../../preview'),{recursive:true});
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.resolve(__dirname,'../../../preview/management-chemical-settings.png'),Buffer.from(shot.data,'base64'));
    await evaluate('OperationsUsers.choose=async()=>"Blaine Alward";document.getElementById("settings-choose-operator").click()');await until('document.getElementById("settings-operator").value==="Blaine Alward"');
    await evaluate('document.getElementById("settings-supplier").value="Facility Chemical Supplier";document.getElementById("settings-offset").value="500";document.getElementById("settings-offset").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("settings-reason").value="Adjusted fixed-volume offset";document.getElementById("settings-form").requestSubmit()');
    assert.ok(await evaluate('!document.getElementById("settings-preview").hidden&&!document.getElementById("settings-save").disabled'),'Preview is required before saving');
    assert.ok(await evaluate('document.getElementById("settings-preview").textContent.includes("1,743.06")'),'Preview reflects the changed calibration');
    await evaluate('document.getElementById("settings-save").click()');await until('document.getElementById("chemical-settings-status").textContent.includes("settings saved")');
    let config=await(await fetch(base+'/api/chemical-settings')).json();assert.equal(config.active.chemicals.naoh.offset,500);assert.equal(config.versions.length,2);
    await evaluate('document.getElementById("print-bin-cards-tab").click()');assert.ok(await evaluate('!document.getElementById("bin-cards-panel").hidden&&document.getElementById("chemical-settings-panel").hidden'),'Bin card task still opens');
    await evaluate('document.getElementById("chemical-settings-tab").click()');await until('document.getElementById("settings-offset").value==="500"');
    // A second browser changes the version while this editor is open.
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Denver'});const response=await fetch(base+'/api/chemical-settings',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({revision:config.revision,chemicalKey:'naoh',settings:config.active.chemicals.naoh,effectiveFrom:today,operator:'Carson Conlin',reason:'Concurrent edit'})});assert.ok(response.ok);
    await evaluate('document.getElementById("settings-choose-operator").click()');await until('document.getElementById("settings-operator").value==="Blaine Alward"');
    await evaluate('document.getElementById("settings-offset").value="600";document.getElementById("settings-offset").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("settings-reason").value="Conflicting change";document.getElementById("settings-form").requestSubmit();document.getElementById("settings-save").click()');await until('document.getElementById("chemical-settings-status").textContent.includes("changed elsewhere")');
    assert.equal(await evaluate('document.getElementById("settings-offset").value'),'600','Conflicting changes remain visible');
    await evaluate('document.getElementById("settings-reload").click()');await until('document.getElementById("settings-offset").value==="500"');
    await evaluate('document.getElementById("settings-chemical").value="permanganate";document.getElementById("settings-chemical").dispatchEvent(new Event("change"))');assert.equal(await evaluate('document.querySelectorAll("[data-setting-factor]").length'),1,'East batch cannot enter the full-strength formula');
    assert.deepEqual(browser.errors,[]);console.log('Chemical Settings browser passed: task navigation, supply search, responsive layout, operator selection, preview/save, reload, conflict recovery, and batch exclusion.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));await removeTemporaryDirectory(dir);}
})().catch(error=>{console.error(error);process.exitCode=1;});
