// Read-only checks against the deployed board. Never submits equipment or comment edits.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{

const wait=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
for(const mode of ['tv','edit']){
 await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'https://water.gibbhub.io/live-operations-dashboard/?v=20261023-comments2'+(mode==='tv'?'&mode=tv':'')});
 for(let i=0;i<150;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll(".equipment-card").length===27'))break;await new Promise(r=>setTimeout(r,50));}
 for(const [width,height]of [[1920,1080],[1920,900],[1366,768],[1280,600],[1024,600],[900,600]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait();
  assert.ok(await evaluate('document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth'),'Fits '+mode+' '+width+'x'+height);
  assert.ok(await evaluate('(()=>{const cards=[...document.querySelectorAll(".pump-groups-row .equipment-card")];return cards.length===8&&new Set(cards.map(c=>Math.round(c.getBoundingClientRect().top))).size===1})()'),'Eight pumps across');
  assert.ok(await evaluate('document.querySelector(".comments-board").clientHeight>=118&&document.querySelector(".comments-list").clientHeight>=60'),'Readable comments area');
  assert.ok(await evaluate('[...document.querySelectorAll(".equipment-name")].every(e=>e.getBoundingClientRect().bottom<=e.closest(".equipment-card").getBoundingClientRect().bottom+1)'),'All equipment names fit');
  if(mode==='edit')assert.ok(await evaluate('(()=>{const r=document.getElementById("openCommentDrawerButton").getBoundingClientRect(),p=document.querySelector(".comments-board").getBoundingClientRect();return r.height>0&&r.top>=p.top&&r.bottom<=p.bottom})()'),'Add Comment remains visible');
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Phone fits');assert.equal(await evaluate('document.querySelectorAll(".equipment-card").length'),27);
}
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Live board layout passed: eight pumps in one desktop row, all 27 names visible, expanded comments and visible Add Comment action, TV/edit modes at 900x600 through 1920x1080, and phone layout. No production data edited.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
