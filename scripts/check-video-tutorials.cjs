const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
const originalVideoScript=fs.readFileSync(path.resolve('apps/video-tutorials/script.js'),'utf8');
assert.ok(fs.readFileSync(path.resolve('apps/video-tutorials/operations.js'),'utf8').startsWith(originalVideoScript.slice(0,originalVideoScript.indexOf('function getAccentColor'))),'Preserve every original lesson, filename, category, and duration');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{

await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:'http://127.0.0.1:8782/apps/video-tutorials/index.html'});
for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll(".video-card").length===38'))break;await new Promise(r=>setTimeout(r,50));}
assert.equal(await evaluate('document.querySelectorAll(".video-card").length'),38);
await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")'));
assert.equal(await evaluate('document.querySelector(".sidebar").offsetWidth'),222);
for(const [category,count]of [['basics',13],['processes',17],['advanced',6],['management',2]]){
 await evaluate('document.querySelector("[data-category='+category+']").click()');assert.equal(await evaluate('document.querySelectorAll(".video-card").length'),count);
}
await evaluate('document.getElementById("lessonSearch").value="no-such-lesson";document.getElementById("lessonSearch").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.getElementById("emptyState").hidden'),false);
await evaluate('document.getElementById("emptyReset").click();document.getElementById("lessonSearch").value="Unit Conversions";document.getElementById("lessonSearch").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.querySelectorAll(".video-card").length'),1);
await evaluate('document.querySelector(".watch-lesson").click()');assert.equal(await evaluate('document.getElementById("videoModal").open'),true);
assert.equal(await evaluate('document.getElementById("modalTitle").textContent'),'1 - Unit Conversions');assert.ok(await evaluate('document.getElementById("modalVideo").src.endsWith("/Videos/1%20-%20Unit%20Conversions.mp4")&&document.getElementById("modalVideo").controls'));
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await evaluate('new Promise(r=>setTimeout(r,50))');assert.equal(await evaluate('document.getElementById("videoModal").open'),false);assert.equal(await evaluate('document.getElementById("modalVideo").hasAttribute("src")'),false);assert.ok(await evaluate('document.activeElement.matches(".watch-lesson")'));
await evaluate('document.getElementById("clearFilters").click();document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),'videos');assert.equal(await evaluate('document.querySelectorAll(".ops-app-menu [data-ops-destination]").length'),14);await evaluate('document.querySelector(".ops-app-menu-close").click()');
for(const width of [1920,1440,1024,900,768,390,320]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);assert.equal(await evaluate('document.querySelector(".site-header").offsetHeight'),width>800?112:144);
 if(width>=900){await evaluate('window.scrollTo(0,800);new Promise(r=>requestAnimationFrame(r))');assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top'),112);await evaluate('window.scrollTo(0,0)');}
 if(width===1440||width===390){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync(path.resolve('preview'),{recursive:true});fs.writeFileSync(path.resolve('preview/videos-'+width+'.png'),Buffer.from(shot.data,'base64'));}
}
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Videos passed: 38 lessons, categories, search/empty/reset, native player, Escape/focus return, shared header/menu, sticky sidebar, desktop/mobile widths.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
