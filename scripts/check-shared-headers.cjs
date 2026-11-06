const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{const {createApp}=require("../apps/operator-inventory/server");const inventory=createApp({dataDir:path.join(profile,"data")});harness.addCleanup(()=>new Promise(r=>inventory.close(r)));await new Promise(r=>inventory.listen(0,"127.0.0.1",r));

for(const width of [1920,1440,1024,900,899,850,768,390,320]){
 const measurements=[];
 for(const [name,url] of [['home','http://127.0.0.1:8782/'],['inventory','http://127.0.0.1:'+inventory.address().port],['inventory-live-server','http://127.0.0.1:8782/apps/operator-inventory/public/index.html'],['rounds','http://127.0.0.1:8782/apps/plant-rounds/index.html'],['alum','http://127.0.0.1:8782/apps/alum-hydrometer-conversion/index.html'],['plant-production','http://127.0.0.1:8782/apps/plant-flow/index.html']]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url});
  for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelector(".site-header,.topbar")'))break;await new Promise(r=>setTimeout(r,50));}
  await evaluate('document.fonts.ready');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const m=await evaluate('(()=>{const header=document.querySelector(".site-header,.topbar"),logo=header.querySelector("img"),button=header.querySelector("[data-ops-menu]"),context=header.querySelector(".facility,.facility-name");const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100)};return{viewport:document.documentElement.clientWidth,header:rect(header),logo:rect(logo),button:rect(button),context:rect(context),font:getComputedStyle(context).font}})()');m.name=name;measurements.push(m);
  if(name.startsWith('plant-')){
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Plant preview fits '+width);
    if(width===1440){
      assert.equal(await evaluate('document.getElementById("total").textContent'),'28h 9m');
      assert.equal(await evaluate('document.querySelectorAll("[data-unit]").length'),16);
      const target=await evaluate('(()=>{const r=document.querySelector("[data-timeline-stage]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',...target});
      assert.equal(await evaluate('document.getElementById("timeline-detail").hidden'),false,'Hover opens stage travel details');
      assert.equal(await evaluate('document.querySelector("#timeline-detail h3").textContent'),'Rapid Mix');
      assert.equal(await evaluate('document.querySelectorAll("#timeline-detail dd")[0].textContent'),'2.4 min');
      assert.equal(await evaluate('document.querySelectorAll("#timeline-detail dd")[3].textContent'),'Not Yet Injected');
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});
      assert.equal(await evaluate('document.getElementById("timeline-detail").hidden'),true,'Hover details dismiss on leave');
      await evaluate('document.querySelectorAll("[data-timeline-stage]")[4].focus()');
      assert.equal(await evaluate('document.querySelectorAll("#timeline-detail dd")[3].textContent'),'2h 16m','Travel accumulates from injection through the selected stage');
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
      assert.equal(await evaluate('document.getElementById("timeline-detail").hidden'),true,'Escape dismisses focused details');
      await evaluate('document.querySelector("[data-unit=f1]").click()');
      assert.equal(await evaluate('document.getElementById("online-count").textContent'),'15 / 16');
      await evaluate('document.getElementById("flow-number").value="0";document.getElementById("flow-number").dispatchEvent(new Event("input"))');
      assert.equal(await evaluate('document.getElementById("total").textContent'),'Flow Stopped');
      assert.equal(await evaluate('document.querySelectorAll("[data-timeline-stage]").length'),0,'No stale stage details when flow stops');
      await evaluate('document.getElementById("flow-number").value="";document.getElementById("flow-number").dispatchEvent(new Event("input"))');
      assert.equal(await evaluate('document.getElementById("flow-number").getAttribute("aria-invalid")'),'true');
      await evaluate('document.getElementById("reset").click()');assert.equal(await evaluate('document.getElementById("online-count").textContent'),'16 / 16');
      assert.equal(await evaluate('document.querySelectorAll("#chemical-rows tr").length'),5);
    }
    if(width===390){await evaluate('document.querySelectorAll("[data-timeline-stage]")[5].click()');assert.equal(await evaluate('document.querySelector("#timeline-detail h3").textContent'),'Clearwells','Tap opens stage details');assert.ok(await evaluate('(()=>{const r=document.getElementById("timeline-detail").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()'),'Stage details fit on phones');await evaluate('document.body.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');assert.equal(await evaluate('document.getElementById("timeline-detail").hidden'),true);}
    if(width===1440||width===390){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.resolve('preview/plant-flow-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  }
  if(width===1440){
    assert.ok(await evaluate('document.querySelector(".brand").href.includes("?v=operations-home-")'),'Logo links to Operations Home');
    if(name!=='home'){
      await evaluate('document.addEventListener("operations:before-navigate",e=>{window.__logoDestination=e.detail.url;e.preventDefault()},{once:true});document.querySelector(".brand").click();new Promise(r=>setTimeout(r,50))');
      assert.ok(await evaluate('window.__logoDestination.includes("?v=operations-home-")'),'Logo uses guarded cross-app navigation');
    }
  }
  if(name==='alum'){
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Alum fits '+width);
    assert.ok(await evaluate('document.fonts.check("16px Inter")'),'Alum loads Inter');
    if(width===1440){
      const initial=await evaluate('document.getElementById("primaryDryAlum").textContent');assert.equal(initial,'48.21%','Existing default conversion is preserved');
      assert.equal(await evaluate('document.querySelectorAll("#referenceTableBody tr").length'),39);
      await evaluate('document.getElementById("densityInput").value="1.1";document.getElementById("densityInput").dispatchEvent(new Event("input"))');
      assert.ok(await evaluate('document.querySelector(".alum-strength-callout").classList.contains("is-alert")'));
      await evaluate('document.getElementById("tempInput").value="";document.getElementById("tempInput").dispatchEvent(new Event("input"))');
      assert.equal(await evaluate('document.getElementById("primaryDryAlum").textContent'),'--');
      await evaluate('document.getElementById("resetButton").click()');assert.equal(await evaluate('document.getElementById("primaryDryAlum").textContent'),initial);
      await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),'alum');
      assert.equal(await evaluate('document.querySelectorAll(".ops-app-menu [data-ops-destination]").length'),18);
      await evaluate('document.querySelector(".ops-app-menu-close").click()');
      await evaluate('document.querySelectorAll(".sidebar a")[2].click();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert.equal(await evaluate('document.querySelector(".sidebar [aria-current]").getAttribute("href")'),'#reference','Section navigation follows the visible reference section');
      await evaluate('window.scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    }
    if(width===1440||width===390){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync(path.resolve('preview'),{recursive:true});fs.writeFileSync(path.resolve('preview/alum-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  }
  if(width>=900){m.sidebar=await evaluate('(()=>{const sidebar=document.querySelector(".sidebar,.bottom-nav"),button=sidebar.querySelector("button,a.nav-item"),icon=button.querySelector("svg"),sr=sidebar.getBoundingClientRect(),br=button.getBoundingClientRect(),ir=icon.getBoundingClientRect();return{width:sr.width,rowWidth:br.width,rowHeight:br.height,inset:br.left-sr.left,topInset:br.top-sr.top,padding:getComputedStyle(button).padding,gap:getComputedStyle(sidebar.querySelector("nav")||sidebar).gap,font:getComputedStyle(button).font,icon:[ir.width,ir.height,ir.left-br.left]}})()');}
  else assert.equal(await evaluate('document.querySelector(".ops-sidebar-caption")?getComputedStyle(document.querySelector(".ops-sidebar-caption")).display:"none"'),'none','Sidebar caption stays out of mobile navigation');
  if(width>=900 && !name.startsWith('inventory')){
    const initialTop=await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top');
    for(const offset of [200,800]){
      await evaluate(`window.scrollTo(0,${offset});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      assert.ok(Math.abs(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top')-initialTop)<1,name+' sidebar stays below the header while scrolling');
      assert.ok(Math.abs(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().bottom')-1080)<1,name+' sidebar fills the remaining viewport');
    }
    await evaluate('window.scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    if(width===1440){
      await call('Emulation.setDeviceMetricsOverride',{width,height:320,deviceScaleFactor:1,mobile:false});
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      if(name!=='rounds')assert.ok(await evaluate('document.querySelector(".sidebar").scrollHeight>document.querySelector(".sidebar").clientHeight'),name+' long menu can scroll in a short window');
      await evaluate('document.querySelector(".sidebar nav").lastElementChild.scrollIntoView({block:"nearest"})');
      assert.ok(await evaluate('(()=>{const last=document.querySelector(".sidebar nav").lastElementChild.getBoundingClientRect();return last.top>=112 && last.bottom<=320})()'),name+' last navigation item remains reachable');
      await call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
      await evaluate('document.querySelector(".sidebar").scrollTop=0;window.scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    }
  }
 }
 for(const m of measurements){assert.equal(m.header[0],0,m.name+' banner starts at viewport edge');assert.equal(m.header[2],m.viewport,m.name+' banner fills viewport');const relative={height:m.header[3],logo:m.logo,button:[Math.round((m.header[2]-m.button[0]-m.button[2])*100)/100,...m.button.slice(1)],context:m.context.slice(0,2).concat(m.context[3]),font:m.font};m.relative=relative;}
 for(const m of measurements.slice(1))assert.deepEqual(m.relative,measurements[0].relative,m.name+' banner dimensions match Home at '+width);
 if(width>=900){for(const m of measurements.slice(1))assert.deepEqual(m.sidebar,measurements[0].sidebar,m.name+' sidebar matches Home at '+width);assert.equal(measurements[0].sidebar.width,222);assert.equal(measurements[0].sidebar.rowHeight,54);}
 console.log('Matching headers'+(width>=900?' and sidebars':' with mobile navigation preserved')+' at '+width+'px');
}
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
