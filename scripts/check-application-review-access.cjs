const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),express=require('express');
const auth=require('../application-review-auth'),registerAPI=require('../application-review-api');
const {launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'review-access-browser-'));let browser,server,now=Date.now();
  try{
    const app=express(),passphrase='Browser Test Access Phrase!';auth.register(app,{verifier:await auth.makePassphraseHash(passphrase),secureCookies:false,directory:path.join(directory,'access'),now:()=>now});
    app.use(express.json());registerAPI(app,{directory:path.join(directory,'reviews')});
    for(const folder of ['assets','shared'])app.use('/'+folder,express.static(path.resolve(__dirname,'..',folder)));
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),browser=await launchBrowser({acceptDialogs:true});
    const {call,evaluate}=browser,base='http://127.0.0.1:'+server.address().port;
    const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+expression+' '+await evaluate('JSON.stringify({path:location.pathname,text:document.body.innerText.slice(0,400)})'));};
    await call('Page.navigate',{url:base+'/application-review/?hiringReview=review-original'});await until('!!document.querySelector("input[name=passphrase]")');
    assert.ok(await evaluate('location.pathname==="/application-review-access"&&!document.getElementById("applicants")'),'Unauthenticated visitor receives only the access screen');
    for(const width of [1440,390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth&&parseFloat(getComputedStyle(document.querySelector("input[name=passphrase]")).fontSize)>=16'),'Access form fits and avoids input zoom at '+width);}
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await fs.mkdir('preview',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('preview/application-review-access.png',Buffer.from(shot.data,'base64'));
    await evaluate('document.querySelector("input[name=passphrase]").value="Wrong Test Phrase";document.querySelector("form").requestSubmit()');await until('!!document.querySelector("[role=alert]")');
    await evaluate('document.querySelector("input[name=passphrase]").value='+JSON.stringify(passphrase)+';document.querySelector("form").requestSubmit()');await until('document.getElementById("main")?.dataset.reviewLoaded==="true"');
    assert.ok(await evaluate('new URL(location.href).searchParams.get("hiringReview")==="review-original"'),'Original review link survives login');
    await until('!document.getElementById("access-signout").hidden');assert.ok(await evaluate('!document.cookie.includes("applicationReviewDev")'),'Session cookie is inaccessible to JavaScript');
    assert.equal(await evaluate('(async()=>{const current=await(await fetch("/api/application-review")).json();const response=await fetch("/api/application-review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"applicant",revision:current.revision,name:"Synthetic Private Applicant",state:"CO",wage:null,licenses:""})});return response.status;})()'),200,'Authenticated app can save through the protected API');
    await call('Page.reload');await until('document.getElementById("main")?.dataset.reviewLoaded==="true"');assert.equal(await evaluate('location.pathname'),'/application-review/','F5 preserves the remembered session');
    now+=auth.SESSION_MS+1;await evaluate('document.getElementById("refresh").click()');await until('!document.getElementById("access-expired").hidden');
    await evaluate('document.getElementById("access-signin").click()');await until('!!document.querySelector("input[name=passphrase]")');
    await evaluate('document.querySelector("input[name=passphrase]").value='+JSON.stringify(passphrase)+';document.querySelector("form").requestSubmit()');await until('document.getElementById("main")?.dataset.reviewLoaded==="true"');await until('!document.getElementById("access-signout").hidden');
    await evaluate('document.getElementById("access-signout").click()');await until('location.pathname==="/application-review-access"&&!!document.querySelector("input[name=passphrase]")');
    await call('Page.navigate',{url:base+'/apps/application-review/index.html'});await until('location.pathname==="/application-review-access"&&!!document.querySelector("input[name=passphrase]")');
    assert.deepEqual(browser.errors,[]);console.log('Access browser checks passed: private login page, mobile layout, deep links, HttpOnly sessions, F5, three-day expiry, sign-out, and alternate URL protection.');
  }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await removeTemporaryDirectory(directory);}
})().catch(error=>{console.error(error);process.exitCode=1;});
