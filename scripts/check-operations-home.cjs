const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
(async()=>{const harness=await createBrowserCheck({serveLegacyHome:true,});const {call,evaluate,errors,root,profile}=harness;try{
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:8782/'});
for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.title==="Cached Legacy Home"'))break;await new Promise(r=>setTimeout(r,50));}
assert.equal(await evaluate('document.title'),'Cached Legacy Home');
assert.equal(await evaluate('getComputedStyle(document.querySelector(".app-button")).display'),'flex','Cached legacy HTML retains its compatible stylesheet');
harness.serveLegacyHome=false;
assert.ok(await evaluate('fetch("/",{cache:"force-cache"}).then(r=>r.text()).then(text=>text.includes("Cached Legacy Home"))'),'Regression setup has cached old HTML');
await call('Page.navigate',{url:'http://127.0.0.1:8782/?v=operations-home-20261021'});
for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll(".app-card").length===14'))break;await new Promise(r=>setTimeout(r,50));}
assert.equal(await evaluate('document.querySelectorAll(".app-card").length'),14);
assert.equal(await evaluate('document.querySelectorAll(".app-card.is-under-construction").length'),0);
assert.equal(await evaluate('document.querySelector("[data-category=water] .nav-count").textContent'),'6');
await evaluate('document.getElementById("toolSearch").value="chemical ledger";document.getElementById("toolSearch").dispatchEvent(new Event("input"))');
assert.equal(await evaluate('document.querySelectorAll(".app-card").length'),0);
await evaluate('document.getElementById("showConstruction").click()');
assert.equal(await evaluate('document.querySelector(".app-card").dataset.app'),'chemical-ledger');
await evaluate('document.getElementById("resetFilters").click()');
await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")&&getComputedStyle(document.body).fontFamily.startsWith("Inter")'));
assert.equal(await evaluate('document.querySelectorAll(".app-card").length'),18);assert.ok(await evaluate('document.querySelector(".ops-app-menu-home").href.includes("v=operations-home-20261021")'));assert.ok(await evaluate('[...document.querySelectorAll("link[rel=stylesheet]")].some(link=>link.href.includes("operations-home.css"))'));
assert.ok(await evaluate('[...document.images].every(image=>image.complete&&image.naturalWidth>0)'));
assert.equal(await evaluate('document.querySelector(".app-card[data-app=inventory]").href'),'https://inventory.gibbhub.io/');
assert.equal(await evaluate('document.querySelector(".app-card[data-app=equipment]").pathname'),'/live-operations-dashboard/');
assert.equal(await evaluate('document.querySelector(".app-card[data-app=work-orders]")'),null);
assert.equal(await evaluate('document.querySelector(".app-card[data-app=chemical-ledger]").pathname'),'/chemical-ledger/');
assert.equal(await evaluate('document.querySelector(".app-card[data-app=digital-twin]").pathname'),'/apps/digital-twin/index.html');
for(const id of ['digital-twin','sops','chemical-ledger','rounds']){
 const selector=JSON.stringify('.app-card[data-app='+id+'] .construction-banner');
 assert.equal(await evaluate('document.querySelector('+selector+').textContent'),'Under Construction');
}
assert.equal(await evaluate('document.body.textContent.includes("Design Preview")'),false);
await evaluate('document.querySelector("[data-category=water]").click()');assert.equal(await evaluate('document.querySelectorAll(".app-card").length'),8);
await evaluate('document.getElementById("toolSearch").value="hydrometer";document.getElementById("toolSearch").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.querySelectorAll(".app-card").length'),1);
await evaluate('document.getElementById("toolSearch").value="not-a-real-tool";document.getElementById("toolSearch").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.getElementById("emptyState").hidden'),false);
await evaluate('document.getElementById("resetEmpty").click()');assert.equal(await evaluate('document.querySelectorAll(".app-card").length'),18);
fs.mkdirSync(path.resolve('preview'),{recursive:true});
for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844],['small',320,800]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),width<=800?144:112,'Common banner height at '+width);
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),name+' no overflow');
 if(name!=='small'){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:await evaluate('document.documentElement.scrollHeight'),scale:1}});fs.writeFileSync(path.resolve('preview/operations-home-'+name+'.png'),Buffer.from(shot.data,'base64'));}
 await evaluate('document.querySelector("[data-ops-menu]").click()');assert.ok(await evaluate('document.getElementById("opsAppMenu").open'));
 assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current=page]").dataset.opsDestination'),'home');
 assert.equal(await evaluate('document.querySelectorAll(".ops-app-menu [data-ops-destination]").length'),21);
 assert.ok(await evaluate('(()=>{const b=document.getElementById("opsAppMenu").getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight})()'));
 for(const id of ['digital-twin','sops']){
  const selector=JSON.stringify('[data-ops-destination='+id+'] .ops-app-menu-construction');
  assert.equal(await evaluate('document.querySelector('+selector+').textContent'),'Under Construction');
 }
 assert.equal(await evaluate('document.querySelector("[data-ops-destination=digital-twin]").pathname'),'/apps/digital-twin/index.html');
 assert.equal(await evaluate('document.querySelector("[data-ops-destination=chemical-ledger]").pathname'),'/chemical-ledger/');
 assert.ok(await evaluate('(()=>{const card=document.querySelector(".app-card[data-app=digital-twin]");return card.querySelector(".card-icon").getBoundingClientRect().top>=card.querySelector(".construction-banner").getBoundingClientRect().bottom})()'));
 await evaluate('document.querySelector(".ops-app-menu-close").click();new Promise(r=>requestAnimationFrame(r))');
}
await evaluate('document.querySelector("[data-ops-menu]").click()');
await evaluate('document.querySelector("[data-ops-destination=digital-twin]").click(); true');
for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".stage").length===7'))break;await new Promise(r=>setTimeout(r,50));}
assert.match(await evaluate('document.title'),/Plant Digital Twin/);
assert.equal(await evaluate('document.querySelectorAll(".stage").length'),7);
assert.equal(await evaluate('document.querySelector(".construction-status").textContent'),'Under Construction');
for(const width of [1440,1024,768,390,320]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:980,deviceScaleFactor:1,mobile:false});
 assert.equal(await evaluate('document.querySelector(".site-header").getBoundingClientRect().height'),width<=800?144:112);
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Digital Twin overflow at '+width);
}
await evaluate('document.querySelector(".sidebar .nav-item:last-child").click(); new Promise(requestAnimationFrame)');
assert.equal(await evaluate('document.querySelector(".sidebar [aria-current]").hash'),'#data');
const originalReading=await evaluate('document.getElementById("settled").textContent');
await evaluate('(()=>{const slider=document.getElementById("alum");slider.value=36;slider.dispatchEvent(new Event("input",{bubbles:true}));})()');
assert.notEqual(await evaluate('document.getElementById("settled").textContent'),originalReading);
await evaluate('document.querySelector("[data-ops-menu]").click()');
assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current=page]").dataset.opsDestination'),'digital-twin');
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Operations Home cached-HTML migration and normal checks passed: 18 applications, correct inventory/equipment/digital twin/chemical ledger destinations, shared font and menu, search/filter/reset, desktop/mobile/320px layouts, no runtime errors.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
