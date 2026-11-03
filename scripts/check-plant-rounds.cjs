const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),express=require('express');
const register=require('../plant-rounds-api'),{launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),root=path.resolve(__dirname,'..');
(async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'plant-rounds-browser-'));let browser,pm,server,offline=false;
  const app=express();app.use(express.json());app.use('/api/plant-rounds',(req,res,next)=>offline?res.status(503).json({error:'Test connection interruption'}):next());register(app,{directory:temp});
  for(const dir of ['shared','assets'])app.use('/'+dir,express.static(path.join(root,dir)));
  app.use('/plant-rounds',express.static(path.join(root,'apps/plant-rounds')));
  try{
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
    const api=async(url,body,method='POST')=>{const r=await fetch(base+'/api/plant-rounds'+url,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,await r.clone().text());return r.json();};
    async function until(browser,expression){for(let i=0;i<120;i++){if(await browser.evaluate(expression))return;await wait(75);}assert.fail('Timed out: '+expression+' '+JSON.stringify(await browser.evaluate('({error:document.getElementById("errorText").textContent,save:document.getElementById("saveStatus").textContent,hidden:document.getElementById("roundsView").hidden,name:document.getElementById("operatorName").value,conflicts:document.getElementById("conflicts").textContent})'))) ;}
    async function input(browser,id,value){await browser.evaluate(`(()=>{const n=document.getElementById(${JSON.stringify(id)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}))})()`);}
    browser=await launchBrowser({userGesture:true,acceptDialogs:true});
    await browser.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
    await browser.call('Page.navigate',{url:base+'/plant-rounds/'});await until(browser,'!document.getElementById("startButton").disabled');
    const date=await browser.evaluate('document.getElementById("roundsDate").value');
    assert.equal(date,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver'}).format(new Date()),'Home defaults to the facility date');
    assert.ok(await browser.evaluate('!!document.getElementById("referenceButton").getAttribute("aria-label")'),'Icon-only reference button has an accessible name');
    await input(browser,'operatorName','Blaine Alward');await browser.evaluate('document.getElementById("startButton").click()');await until(browser,'!document.getElementById("roundsView").hidden');
    assert.equal(await browser.evaluate('document.getElementById("locationSelect").options.length'),19);
    await input(browser,'entry-B7','12.5');await input(browser,'entry-B10','0');await browser.evaluate('document.getElementById("entry-B12-No").click();document.getElementById("entry-B39").click()');
    await until(browser,'document.getElementById("saveStatus").textContent==="All Changes Saved"');
    let day=await api('/'+date);assert.equal(day.shifts.AM.entries.B7.value,12.5);assert.equal(day.shifts.AM.entries.B10.value,0);assert.equal(day.shifts.AM.entries.B12.value,false);assert.equal(day.shifts.AM.entries.B39.value,true);
    await browser.evaluate('document.getElementById("notesButton").click()');await input(browser,'noteText','AM handoff: inspect the north waste pump.');await browser.evaluate('document.getElementById("saveNote").click()');await until(browser,'!document.getElementById("notesDialog").open&&document.getElementById("noteText").value===""');
    pm=await launchBrowser({userGesture:true,acceptDialogs:true});await pm.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});await pm.call('Page.navigate',{url:base+'/plant-rounds/'});await until(pm,'!document.getElementById("startButton").disabled');
    await input(pm,'operatorName','Kyle Heckman');await pm.evaluate('document.querySelector("[name=shift][value=PM]").click();document.getElementById("startButton").click()');await until(pm,'!document.getElementById("roundsView").hidden');
    assert.ok(await pm.evaluate('document.querySelector("[data-am-field=B7]").textContent.includes("12.5")'));
    assert.equal(await pm.evaluate('document.getElementById("entry-B7")'),null,'AM-only task has no PM input');
    assert.ok(await pm.evaluate('document.querySelector("[data-am-field=B10]").textContent.startsWith("0")'),'Numeric zero survives handoff');
    await input(pm,'entry-B10','2');await until(pm,'document.getElementById("saveStatus").textContent==="All Changes Saved"');
    day=await api('/'+date);assert.equal(day.shifts.AM.entries.B10.value,0);assert.equal(day.shifts.PM.entries.B10.value,2);
    await browser.evaluate('document.getElementById("referenceButton").click()');await until(browser,'!document.getElementById("saveReference").disabled');
    await input(browser,'ref-influentFlow','4.5');await input(browser,'ref-filterFlow','4.2');await input(browser,'ref-alum','125.5');await input(browser,'ref-polymer','0');await input(browser,'ref-hypochlorite','42.75');await input(browser,'ref-permanganate','7.1');
    await browser.evaluate('document.getElementById("saveReference").click()');await until(browser,'document.getElementById("referenceStatus").textContent.startsWith("Last updated by")&&!document.getElementById("saveReference").disabled');
    assert.ok(await browser.evaluate('document.getElementById("referenceDialog").open'),'Saved values remain visible for drawdowns');
    await browser.evaluate('document.getElementById("closeReference").click()');
    await pm.evaluate('document.getElementById("referenceButton").click()');await until(pm,'!document.getElementById("saveReference").disabled');
    assert.equal(await pm.evaluate('document.getElementById("ref-alum").value'),'','PM starts without AM values');assert.equal(await pm.evaluate('document.getElementById("ref-polymer").value'),'');assert.equal(await pm.evaluate('document.getElementById("ref-naoh").value'),'');
    assert.ok(await pm.evaluate('document.getElementById("referenceContext").textContent.includes("PM Rounds")'));
    await input(pm,'ref-alum','80');await input(pm,'ref-polymer','0');await pm.evaluate('document.getElementById("saveReference").click()');await until(pm,'document.getElementById("referenceStatus").textContent.startsWith("Last updated by")&&!document.getElementById("saveReference").disabled');
    assert.equal((await api('/'+date+'/AM/drawdown-reference')).values.alum,125.5);assert.equal((await api('/'+date+'/PM/drawdown-reference')).values.alum,80);
    await input(pm,'ref-alum','126');
    const shared=await api('/'+date+'/PM/drawdown-reference');await api('/'+date+'/PM/drawdown-reference',{operator:'Gene Hutson',revision:shared.revision,values:{...shared.values,alum:130}},'PUT');
    await pm.evaluate('document.getElementById("saveReference").click()');await until(pm,'!document.getElementById("referenceError").hidden');assert.equal(await pm.evaluate('document.getElementById("ref-alum").value'),'126','A stale save keeps the local values');
    await pm.evaluate('window.confirm=()=>true;document.getElementById("reloadReference").click()');await until(pm,'document.getElementById("ref-alum").value==="130"&&!document.getElementById("saveReference").disabled');
    await input(pm,'ref-polymer','0.5');await pm.evaluate('document.getElementById("closeReference").click();document.getElementById("referenceButton").click()');
    await until(pm,'document.getElementById("ref-polymer").value==="0.5"&&!document.getElementById("saveReference").disabled');assert.ok(await pm.evaluate('document.getElementById("referenceStatus").textContent.includes("draft restored")'),'Reference draft survives closing and reopening');
    await pm.evaluate('document.getElementById("reloadReference").click()');await until(pm,'document.getElementById("ref-polymer").value==="0"&&!document.getElementById("saveReference").disabled');
    for(const width of [320,390,1440]){await pm.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await wait(100);assert.ok(await pm.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.getElementById("referenceDialog").scrollWidth<=document.getElementById("referenceDialog").clientWidth'),'Reference panel fits at '+width);}
    const referenceShot=await pm.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync(path.join(root,'preview'),{recursive:true});fs.writeFileSync(path.join(root,'preview/plant-rounds-drawdown.png'),Buffer.from(referenceShot.data,'base64'));
    await pm.evaluate('document.getElementById("closeReference").click()');
    await pm.evaluate('document.getElementById("notesButton").click()');assert.ok(await pm.evaluate('document.getElementById("notesList").textContent.includes("AM handoff")'));
    await pm.evaluate('document.querySelector("[data-note-edit]").click()');
    assert.equal(await pm.evaluate('document.getElementById("noteFormTitle").textContent'),'Edit AM Note');
    await input(pm,'noteText','Updated handoff after PM inspection.');await pm.evaluate('document.getElementById("saveNote").click()');await until(pm,'!document.getElementById("notesDialog").open');
    day=await api('/'+date);assert.equal(day.notes[0].text,'Updated handoff after PM inspection.');assert.equal(day.notes[0].shift,'AM');assert.equal(day.notes[0].updatedBy,'Kyle Heckman');
    await pm.evaluate('document.getElementById("notesButton").click();window.confirm=()=>false;document.querySelector("[data-note-delete]").click()');assert.equal((await api('/'+date)).notes.length,1,'Canceling delete preserves the note');
    await pm.evaluate('window.confirm=()=>true;document.querySelector("[data-note-delete]").click()');await until(pm,'document.getElementById("noteCount").textContent==="0"');
    assert.equal((await api('/'+date)).notes.length,0);assert.ok(await pm.evaluate('document.getElementById("notesDialog").open'),'Deleting keeps the notes window available');await pm.evaluate('document.getElementById("closeNotes").click()');
    for(const [location,ids] of [['floc-vault',['F33','F37']],['streaming-current',['F40']],['east-clarifier',['J3','J4']],['west-clarifier',['J13','J14']],['waste-reclaim',['J36','J37']],['dewatering',['N22']],['gravity-thickener',['N25']]]){
      await pm.evaluate(`document.getElementById('locationSelect').value=${JSON.stringify(location)};document.getElementById('locationSelect').dispatchEvent(new Event('change'))`);
      for(const id of ids)assert.ok(await pm.evaluate(`(()=>{const row=document.getElementById('label-${id}').parentElement;return !!row.querySelector('[data-am-field="${id}"]')&&!row.querySelector('input,textarea')&&row.textContent.includes('No PM Entry Needed')})()`),'Audited AM-only check is read-only in PM: '+id);
    }
    await pm.evaluate("document.getElementById('locationSelect').value='ops-area';document.getElementById('locationSelect').dispatchEvent(new Event('change'))");
    assert.ok(await pm.evaluate('!!document.getElementById("entry-N19")'),'OPS flow check is available in PM');
    await pm.evaluate('document.getElementById("locationSelect").value="other";document.getElementById("locationSelect").dispatchEvent(new Event("change"))');assert.ok(await pm.evaluate('document.getElementById("entry-J39")!==null'),'PM-only lights check is present');
    fs.mkdirSync(path.join(root,'preview'),{recursive:true});
    for(const [width,height] of [[1440,1080],[900,800],[768,1024],[390,844],[320,800]]){
      await pm.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait(100);
      assert.ok(await pm.evaluate('document.documentElement.scrollWidth<=innerWidth'),'No horizontal overflow at '+width);
      await pm.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');assert.ok(await pm.evaluate('(()=>{const r=document.getElementById("notesButton").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth})()'),'Notes is always available at '+width);
      assert.ok(await pm.evaluate('(()=>{const r=document.getElementById("referenceButton").getBoundingClientRect(),notes=document.getElementById("notesButton").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth&&notes.right<r.left})()'),'Reference button stays visible beside Notes at '+width);
      await pm.evaluate('window.scrollTo(0,0)');
      if(width===1440 || width===390){
        await pm.evaluate('document.getElementById("locationSelect").value="chemical-building";document.getElementById("locationSelect").dispatchEvent(new Event("change"))');await wait(100);
        for(const title of ['Alum','Hypochlorite']){
          await pm.evaluate(`(()=>{const section=[...document.querySelectorAll('.checklist-section')].find(s=>s.querySelector('h3').textContent===${JSON.stringify(title)}),bar=document.querySelector('.location-toolbar');window.scrollTo(0,scrollY+section.getBoundingClientRect().top-parseFloat(getComputedStyle(bar).top)-bar.getBoundingClientRect().height+60)})()`);await wait(100);
          assert.ok(await pm.evaluate(`(()=>{const section=[...document.querySelectorAll('.checklist-section')].find(s=>s.querySelector('h3').textContent===${JSON.stringify(title)}),h=section.querySelector('h3').getBoundingClientRect(),bar=document.querySelector('.location-toolbar').getBoundingClientRect();return Math.abs(h.top-bar.bottom)<2&&h.bottom<section.getBoundingClientRect().bottom})()`),title+' sticks immediately below the location bar at '+width);
          if(title==='Alum'){const shot=await pm.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/plant-rounds-sticky-'+width+'.png'),Buffer.from(shot.data,'base64'));}
        }
        await pm.evaluate('window.scrollTo(0,0)');const shot=await pm.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/plant-rounds-pm-'+width+'.png'),Buffer.from(shot.data,'base64'));
      }
    }
    // Exercise a real failed save, reload recovery, and a remote conflict.
    offline=true;await input(browser,'entry-B10','15');await until(browser,'document.getElementById("saveStatus").textContent.includes("Not Saved")');
    assert.ok(await browser.evaluate(`JSON.parse(localStorage.getItem('plant-rounds-draft:${date}:AM')).B10.value===15`));
    offline=false;await browser.call('Page.reload');await wait(200);await until(browser,'document.readyState==="complete"&&!document.getElementById("homeView").hidden&&!document.getElementById("startButton").disabled');await browser.evaluate('document.getElementById("startButton").click()');await until(browser,'!document.getElementById("roundsView").hidden&&document.getElementById("saveStatus").textContent==="All Changes Saved"');
    day=await api('/'+date);assert.equal(day.shifts.AM.entries.B10.value,15,'Reload recovered unsaved local draft');
    await api(`/${date}/AM/entries/B10`,{value:16,revision:day.shifts.AM.entries.B10.revision,operator:'Carson Conlin'},'PUT');
    await input(browser,'entry-B10','17');await until(browser,'!document.getElementById("conflicts").hidden');await browser.evaluate('document.querySelector("#conflicts button").click()');await wait(100);
    assert.equal(await browser.evaluate('document.getElementById("entry-B10").value'),'16','Conflict can preserve the other operator’s saved value');
    // Capture the new-tab navigation while exercising the real save-before-preview path.
    await browser.evaluate('window.originalOpen=window.open;window.open=()=>({opener:null,document:{body:{}},location:{replace:url=>window.pdfTarget=url},closed:false,close(){}})');
    await input(browser,'entry-B11','3.2');await browser.evaluate('document.querySelector("#roundsView [data-view-pdf]").click()');await until(browser,'!!window.pdfTarget');
    assert.equal(await browser.evaluate('window.pdfTarget'),'report.html?date='+date);assert.equal((await api('/'+date)).shifts.AM.entries.B11.value,3.2,'PDF preview saves current entries without requiring completed rounds');
    await browser.evaluate('window.open=window.originalOpen');
    await browser.evaluate('document.getElementById("homeNav").click()');await until(browser,'!document.getElementById("homeView").hidden&&!document.getElementById("startButton").disabled');
    for(const width of [320,390,1440]){
      await browser.call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);
      assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Home PDF controls fit at '+width);
    }
    const homeShot=await browser.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/plant-rounds-home.png'),Buffer.from(homeShot.data,'base64'));
    await browser.evaluate('document.getElementById("historyNav").click()');
    // History uses a separate read-only page; avoid the rounds-specific wait diagnostics.
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("historyStatus")?.textContent.includes("Saved")'))break;await wait(75);}
    assert.ok(await browser.evaluate('document.querySelector(".calendar-day.has-record")!==null'));
    assert.equal(await browser.evaluate('document.getElementById("historyMonth").value'),date.slice(0,7));
    assert.ok(await browser.evaluate('document.getElementById("historyRecords").textContent.includes("Blaine Alward")'));
    assert.equal(await browser.evaluate(`document.querySelector('[data-date="${date}"]').getAttribute('href')`),'report.html?date='+date);
    for(const width of [320,390,1440]){
      await browser.call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);
      assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Calendar fits at '+width);
    }
    const historyShot=await browser.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/plant-rounds-history.png'),Buffer.from(historyShot.data,'base64'));
    await browser.evaluate(`(()=>{const link=document.querySelector('[data-date="${date}"]');link.target='_self';link.click()})()`);
    await until(browser,'document.getElementById("reportMessage")?.textContent.startsWith("PDF ready")');
    assert.equal(await browser.evaluate('document.getElementById("downloadPdf").download'),'plant-rounds-'+date+'.pdf');
    assert.ok(await browser.evaluate('document.getElementById("pdfPreview").src.startsWith("blob:")&&!document.getElementById("pdfPreview").hidden'));
    assert.ok(await browser.evaluate('fetch(document.getElementById("downloadPdf").href).then(r=>r.arrayBuffer()).then(b=>new TextDecoder().decode(b.slice(0,5))==="%PDF-")'),'Preview/download use actual PDF bytes');
    await browser.evaluate('document.getElementById("refreshReport").click()');await until(browser,'!document.getElementById("refreshReport").disabled&&document.getElementById("reportMessage").textContent.startsWith("PDF ready")');
    for(const width of [320,390,1440]){
      await browser.call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);
      assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'PDF preview controls fit at '+width);
    }
    await browser.call('Page.navigate',{url:base+'/plant-rounds/manage.html'});
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("newItem")?.disabled===false'))break;await wait(75);}
    assert.equal(await browser.evaluate('document.getElementById("newItem").disabled'),false);
    await input(browser,'managerName','Gene Hutson');await browser.evaluate('document.querySelector("#itemList button").click()');
    assert.equal(await browser.evaluate('document.getElementById("itemLabel").value'),'West Tank Level');assert.equal(await browser.evaluate('document.getElementById("itemUnit").value'),'in','Existing units are editable separately from the item name');
    await browser.evaluate('document.getElementById("cancelItem").click();document.getElementById("newItem").click()');
    assert.ok(await browser.evaluate("[...document.getElementById('itemSection').options].some(option=>option.value==='Alum')"),'Existing sections are selectable for this location');
    await browser.evaluate("document.getElementById('itemSection').value='Alum';document.getElementById('itemSection').dispatchEvent(new Event('change'))");
    assert.ok(await browser.evaluate('document.getElementById("newSectionLabel").hidden'),'Existing section requires no new name');
    await browser.evaluate("document.getElementById('itemSection').value='';document.getElementById('itemSection').dispatchEvent(new Event('change'))");
    assert.ok(await browser.evaluate('!document.getElementById("newSectionLabel").hidden&&document.getElementById("newSectionName").required'));
    await input(browser,'itemLabel','Browser Tank Reading');await input(browser,'newSectionName','Custom Checks');await input(browser,'itemUnit','ft');
    await browser.evaluate("document.getElementById('itemType').value='number';document.getElementById('itemType').dispatchEvent(new Event('change'));document.getElementById('itemPM').checked=false;document.getElementById('saveItem').click()");
    for(let i=0;i<120;i++){if(await browser.evaluate('!document.getElementById("itemDialog").open'))break;await wait(75);}
    let catalog=await api('/template');const custom=catalog.fields.find(f=>f.label==='Browser Tank Reading');assert.ok(custom);assert.equal(custom.unit,'ft');assert.deepEqual(custom.shifts,['AM']);
    assert.ok(!(await api('/'+date)).template.fields.some(f=>f.id===custom.id),'Existing date keeps original checklist');
    for(const width of [320,390,1440]){await browser.call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Manage Items fits at '+width);}
    const manageShot=await browser.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/plant-rounds-manage.png'),Buffer.from(manageShot.data,'base64'));
    await browser.call('Page.navigate',{url:base+'/plant-rounds/?date=2099-01-01'});await until(browser,'!document.getElementById("startButton").disabled');
    assert.equal(await browser.evaluate('document.getElementById("roundsDate").value'),'2099-01-01');
    await browser.evaluate('document.getElementById("startButton").click()');await until(browser,'!document.getElementById("roundsView").hidden');
    assert.ok(await browser.evaluate(`document.getElementById('label-${custom.id}').textContent.includes('(ft)')`),'Managed unit displays beside reading');
    await input(browser,'entry-'+custom.id,'2.4');await until(browser,'document.getElementById("saveStatus").textContent==="All Changes Saved"');
    await browser.evaluate('document.getElementById("manageNav").click()');
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("newItem")?.disabled===false'))break;await wait(75);}
    await input(browser,'searchItems','Browser Tank Reading');await browser.evaluate("document.querySelector('#itemList button').click();document.getElementById('itemType').value='yesno';document.getElementById('itemAM').checked=false;document.getElementById('itemPM').checked=true;document.getElementById('itemRequired').checked=false;document.getElementById('saveItem').click()");
    for(let i=0;i<120;i++){if(await browser.evaluate('!document.getElementById("itemDialog").open'))break;await wait(75);}
    catalog=await api('/template');assert.equal(catalog.fields.find(f=>f.id===custom.id).type,'yesno');assert.deepEqual(catalog.fields.find(f=>f.id===custom.id).shifts,['PM']);
    assert.equal((await api('/2099-01-01')).template.fields.find(f=>f.id===custom.id).type,'number');
    await browser.evaluate('window.confirm=()=>true;document.querySelector("#itemList .delete-item").click()');
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("itemList").textContent.includes("No items match")'))break;await wait(75);}
    assert.ok(!(await api('/template')).fields.some(f=>f.id===custom.id));assert.equal((await api('/2099-01-01')).shifts.AM.entries[custom.id].value,2.4);
    await browser.call('Page.navigate',{url:base+'/plant-rounds/users.html'});
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("addUser")?.disabled===false'))break;await wait(75);}
    assert.equal(await browser.evaluate('document.querySelectorAll("#userList article").length'),7);
    await browser.evaluate('document.getElementById("addUser").click()');await input(browser,'firstName','Pat');
    assert.equal(await browser.evaluate('document.getElementById("userForm").checkValidity()'),false,'First and last name are both required');
    await input(browser,'lastName','Rounds');await browser.evaluate('document.getElementById("saveUser").click()');
    for(let i=0;i<120;i++){if(await browser.evaluate('!document.getElementById("userDialog").open'))break;await wait(75);}
    const person=(await api('/users')).users.find(user=>user.name==='Pat Rounds');assert.ok(person);
    for(const width of [320,390,1440]){await browser.call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Users page fits at '+width);}
    const usersShot=await browser.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/plant-rounds-users.png'),Buffer.from(usersShot.data,'base64'));
    await browser.call('Page.navigate',{url:base+'/plant-rounds/?date=2099-02-01'});await until(browser,'!document.getElementById("startButton").disabled');
    assert.ok(await browser.evaluate("[...document.getElementById('operatorName').options].some(option=>option.value==='Pat Rounds')"));
    await input(browser,'operatorName','Pat Rounds');await browser.evaluate('document.getElementById("startButton").click()');await until(browser,'!document.getElementById("roundsView").hidden');
    await input(browser,'entry-B10','3');await until(browser,'document.getElementById("saveStatus").textContent==="All Changes Saved"');
    assert.equal((await api('/2099-02-01')).shifts.AM.entries.B10.updatedById,person.id);
    await browser.call('Page.navigate',{url:base+'/plant-rounds/users.html'});
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("addUser")?.disabled===false'))break;await wait(75);}
    await browser.evaluate("window.confirm=()=>true;[...document.querySelectorAll('#userList article')].find(row=>row.querySelector('h3').textContent==='Pat Rounds').querySelector('.delete-item').click()");
    for(let i=0;i<120;i++){if(await browser.evaluate("!document.getElementById('userList').textContent.includes('Pat Rounds')"))break;await wait(75);}
    assert.equal((await api('/users')).users.find(user=>user.id===person.id).active,false);
    await browser.call('Page.navigate',{url:base+'/plant-rounds/'});await until(browser,'!document.getElementById("startButton").disabled');
    assert.ok(await browser.evaluate("![...document.getElementById('operatorName').options].some(option=>option.value==='Pat Rounds')"),'Inactive user is not selectable');
    assert.equal((await api('/2099-02-01')).shifts.AM.operator,'Pat Rounds','Inactive user attribution is preserved');
    await browser.call('Page.navigate',{url:base+'/plant-rounds/users.html'});
    for(let i=0;i<120;i++){if(await browser.evaluate('document.getElementById("addUser")?.disabled===false'))break;await wait(75);}
    await browser.evaluate("document.getElementById('showInactive').click();[...document.querySelectorAll('#userList article')].find(row=>row.querySelector('h3').textContent==='Pat Rounds').querySelectorAll('button')[1].click()");
    for(let i=0;i<120;i++){if(await browser.evaluate("[...document.querySelectorAll('#userList article')].find(row=>row.querySelector('h3').textContent==='Pat Rounds')?.querySelector('p').textContent==='Active'"))break;await wait(75);}
    assert.equal((await api('/users')).users.find(user=>user.id===person.id).active,true);
    // The final required reading can be entered at any location, not just the last.
    const prepared=await api('/2099-03-01');prepared.shifts.AM.operator='Blaine Alward';prepared.shifts.AM.startedAt=new Date().toISOString();
    for(const field of prepared.template.fields.filter(field=>field.required && field.shifts.includes('AM')))prepared.shifts.AM.entries[field.id]={value:'na',revision:1,updatedBy:'Blaine Alward',updatedAt:prepared.shifts.AM.startedAt};
    prepared.shifts.AM.entries.B10.value=null;fs.writeFileSync(path.join(temp,'2099-03-01.json'),JSON.stringify(prepared));
    await browser.call('Page.navigate',{url:base+'/plant-rounds/?date=2099-03-01'});await until(browser,'!document.getElementById("startButton").disabled');
    await input(browser,'operatorName','Blaine Alward');await browser.evaluate('document.getElementById("startButton").click()');await until(browser,'!document.getElementById("roundsView").hidden');
    assert.equal(await browser.evaluate('document.getElementById("completeRounds").disabled'),true);
    await input(browser,'entry-B10','1.8');await until(browser,'!document.getElementById("completeRounds").disabled');
    assert.equal(await browser.evaluate('document.getElementById("locationSelect").selectedIndex'),0);assert.equal(await browser.evaluate('document.getElementById("completeRounds").hidden'),false);
    offline=true;await browser.evaluate('document.getElementById("completeRounds").click()');await until(browser,'!document.getElementById("errorBanner").hidden&&!document.getElementById("completeRounds").disabled');
    assert.equal(await browser.evaluate('document.getElementById("roundsView").hidden'),false,'A failed completion keeps the operator in rounds');assert.equal(await browser.evaluate('document.getElementById("completionNotice").hidden'),true);
    offline=false;assert.equal((await api('/2099-03-01')).shifts.AM.completedAt,null);
    await browser.evaluate('document.getElementById("completeRounds").click();document.getElementById("completeRounds").click()');await until(browser,'!document.getElementById("homeView").hidden&&!document.getElementById("completionNotice").hidden');
    assert.ok(await browser.evaluate('document.getElementById("completionText").textContent.includes("AM rounds")&&document.getElementById("completionText").textContent.includes("completed")'));
    assert.ok(await browser.evaluate('document.getElementById("shiftSummaries").textContent.includes("Completed")'));assert.equal(await browser.evaluate('document.getElementById("roundsNav").disabled'),true);
    const completed=await api('/2099-03-01');assert.ok(completed.shifts.AM.completedAt);assert.equal(completed.history.filter(event=>event.action==='complete').length,1,'Double-clicking only completes once');
    for(const width of [320,390,1440]){await browser.call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);assert.ok(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Completion notice fits at '+width);}
    await browser.evaluate('document.getElementById("dismissCompletion").click()');assert.equal(await browser.evaluate('document.getElementById("completionNotice").hidden'),true);
    await browser.evaluate('document.getElementById("referenceButton").click()');await until(browser,'!document.getElementById("saveReference").disabled');
    assert.equal(await browser.evaluate('document.getElementById("ref-alum").value'),'','A different date starts blank');
    await input(browser,'ref-alum','77');await browser.evaluate('document.getElementById("closeReference").click();document.querySelector("[name=shift][value=PM]").click();document.getElementById("referenceButton").click()');
    await until(browser,'!document.getElementById("saveReference").disabled');assert.equal(await browser.evaluate('document.getElementById("ref-alum").value'),'','AM draft does not carry into PM');
    await browser.evaluate('document.getElementById("closeReference").click();document.querySelector("[name=shift][value=AM]").click();document.getElementById("referenceButton").click()');await until(browser,'document.getElementById("ref-alum").value==="77"&&!document.getElementById("saveReference").disabled');
    await browser.evaluate('document.getElementById("closeReference").click()');await input(browser,'roundsDate','2099-03-02');await browser.evaluate('document.getElementById("roundsDate").dispatchEvent(new Event("change"))');await until(browser,'!document.getElementById("startButton").disabled');
    await browser.evaluate('document.getElementById("referenceButton").click()');await until(browser,'!document.getElementById("saveReference").disabled');assert.equal(await browser.evaluate('document.getElementById("ref-alum").value'),'','AM draft does not carry into the next day');await browser.evaluate('document.getElementById("closeReference").click()');
    assert.deepEqual(browser.errors,[]);assert.deepEqual(pm.errors,[]);
    console.log('Passed: today/AM/PM workflow, two-device handoff, 19 locations, independent shift entries, shared notes, responsive layouts, always-visible notes, local draft recovery and concurrent-edit resolution.');
  }finally{await browser?.close();await pm?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await removeTemporaryDirectory(temp);}
})().catch(error=>{console.error(error);process.exitCode=1;});
