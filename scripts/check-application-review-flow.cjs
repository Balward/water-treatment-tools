const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),express=require('express');
const register=require('../application-review-api'),model=require('../apps/application-review/model');
const {launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'review-flow-')),app=express();
  app.use(express.json());register(app,{directory});app.use(express.static(path.resolve(__dirname,'..')));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});let browser;
  try{
    browser=await launchBrowser({acceptDialogs:true});const {call,evaluate}=browser;
    const until=async expr=>{for(let i=0;i<150;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+expr);};
    const url='http://127.0.0.1:'+server.address().port+'/apps/application-review/';
    await call('Page.navigate',{url});await until('document.getElementById("main").dataset.reviewLoaded==="true"');
    let fixture=model.blank();fixture.reviewers=['Reviewer One','Reviewer Two','',''];
    for(let i=0;i<12;i++)fixture=model.apply(fixture,{type:'applicant',firstName:'Test',lastName:'Applicant '+String(i).padStart(2,'0'),country:'US',state:'CO',wage:null,licenses:'Water Treatment A'});
    for(const id of ['APP-001','APP-002'])fixture=model.apply(fixture,{type:'review',id,slot:0,vote:'Yes',notes:'Saved answer '+id});
    fixture=model.apply(fixture,{type:'review',id:'APP-003',slot:1,vote:'No',notes:'Private peer comment'});
    await evaluate(`(async()=>{const old=await(await fetch('/api/application-review')).json();const r=await fetch('/api/application-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'import',revision:old.revision,state:${JSON.stringify(fixture)}})});if(!r.ok)throw Error(await r.text());})()`);
    const reload=async()=>{await call('Page.navigate',{url});await until('document.getElementById("main").dataset.reviewLoaded==="true"');};
    const choose=async slot=>evaluate(`document.getElementById('my-reviewer').value='${slot}';document.getElementById('my-reviewer').dispatchEvent(new Event('change'))`);
    const open=async id=>evaluate(`document.querySelector('#my-list [data-open="${id}"]').click()`);
    const close=async()=>evaluate('document.querySelector("#review-dialog [data-close]").click()');
    await reload();await choose(0);await open('APP-003');
    await evaluate('document.getElementById("review-notes").value="Draft on this device";document.getElementById("review-notes").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[name=vote][value=Maybe]").click()');
    assert.ok(await evaluate('!document.getElementById("draft-status").hidden&&document.getElementById("detail-score").hidden'),'Draft does not reveal peer votes');
    assert.ok(await evaluate('(async()=>!(await(await fetch("/api/application-review")).json()).applicants[2].reviews[0])()'),'Draft is not posted to shared storage');
    await close();await open('APP-003');assert.equal(await evaluate('document.getElementById("review-notes").value'),'Draft on this device');
    await reload();await open('APP-003');assert.equal(await evaluate('document.getElementById("review-notes").value'),'Draft on this device','Draft survives refresh');
    await close();await choose(1);await open('APP-003');assert.equal(await evaluate('document.getElementById("review-notes").value'),'Private peer comment','Draft scoped to reviewer');
    await close();await choose(0);await open('APP-004');assert.equal(await evaluate('document.getElementById("review-notes").value'),'','Draft scoped to applicant');await close();
    // Simulate a separate device saving the same reviewer answer.
    await evaluate('(async()=>{const old=await(await fetch("/api/application-review")).json();await fetch("/api/application-review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"review",revision:old.revision,id:"APP-003",slot:0,vote:"Yes",notes:"Newer saved answer"})});})()');
    await reload();await open('APP-003');assert.equal(await evaluate('document.getElementById("review-notes").value'),'Newer saved answer');
    assert.ok(await evaluate('!document.getElementById("restore-draft").hidden'),'Stale draft requires explicit restoration');
    await evaluate('document.getElementById("restore-draft").click();document.getElementById("save-review").click()');await until('document.getElementById("review-error").textContent==="Review Saved."');
    assert.ok(await evaluate('document.getElementById("draft-status").hidden&&Object.keys(localStorage).every(k=>!k.startsWith("northglenn-review-draft-v1:"))'),'Successful save clears draft');
    await close();await open('APP-001');assert.ok(await evaluate('document.getElementById("previous-answer").disabled&&!document.getElementById("next-answer").disabled'));
    await evaluate('document.getElementById("next-answer").click()');assert.equal(await evaluate('document.getElementById("detail-id").textContent'),'APP-002');
    await evaluate('document.getElementById("previous-answer").click()');assert.equal(await evaluate('document.getElementById("detail-id").textContent'),'APP-001');
    for(const width of [1440,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:false});
      await evaluate('document.getElementById("review-notes").style.height="600px";document.querySelector("#review-dialog .dialog-content").scrollTop=10000');
      assert.ok(await evaluate('(()=>{const f=document.getElementById("review-footer").getBoundingClientRect(),b=document.getElementById("save-review").getBoundingClientRect();return f.bottom<=innerHeight+1&&b.bottom<=innerHeight&&b.top>=0&&document.documentElement.scrollWidth<=innerWidth})()'),'Save action remains visible at '+width);
    }
    await close();await choose(1);await evaluate('document.querySelector("[data-view=overview]").click();document.querySelector(".completion-details").open=true');
    assert.ok(await evaluate('document.querySelector(".completion-details").textContent.includes("Reviewer One")&&document.querySelector(".completion-details").textContent.includes("Not Finished")&&!document.querySelector(".completion-details").textContent.includes("Yes")'),'Completion details reveal no recommendation');
    for(const width of [1440,1024,700,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No page overflow at '+width);
      if(width<=700)assert.ok(await evaluate('(()=>{const w=document.querySelector(".results-view .table-wrap"),r=document.querySelector(".applicant-summary-row");return w.scrollWidth<=w.clientWidth+1&&getComputedStyle(r).display==="grid"})()'),'Mobile results use cards without sideways scrolling');
      else{
        await evaluate('document.querySelector(".results-view .table-wrap").scrollTop=300');
        assert.ok(await evaluate('(()=>{const w=document.querySelector(".results-view .table-wrap").getBoundingClientRect(),h=document.querySelector(".results-view th").getBoundingClientRect();return Math.abs(w.top-h.top)<2})()'),'Table header stays visible');
      }
      if(width===390){await evaluate('document.getElementById("applicants-heading").scrollIntoView()');const shot=await call('Page.captureScreenshot',{format:'png'});await fs.mkdir('preview',{recursive:true});await fs.writeFile('preview/application-review-mobile-flow.png',Buffer.from(shot.data,'base64'));}
    }
    assert.deepEqual(browser.errors,[]);console.log('Review flow passed: draft recovery and isolation, stale draft handling, explicit saves, saved-answer navigation, fixed save actions, completion privacy, sticky headings, and mobile result cards.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));await removeTemporaryDirectory(directory);}
})().catch(error=>{console.error(error);process.exitCode=1;});
