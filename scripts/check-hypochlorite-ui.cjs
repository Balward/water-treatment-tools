const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{

const wait=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:process.env.OPS_PUBLIC?'https://water.gibbhub.io/sodium-hypochlorite-calculator/?v=20261022-hypo1':'http://127.0.0.1:8782/apps/sodium-hypochlorite-calculator/index.html'});
for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&!!window.Operations&&!!window.HypochloriteMath'))break;await new Promise(r=>setTimeout(r,40));}
await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")'));
assert.equal(await evaluate('document.body.dataset.opsApp'),'hypo');assert.equal(await evaluate('document.getElementById("doseForm").checkValidity()'),false);
await evaluate('document.getElementById("residualIncrease").value=1;document.getElementById("doseForm").requestSubmit()');
assert.equal(await evaluate('document.getElementById("result").hidden'),false);assert.equal(await evaluate('document.getElementById("emptyResult").hidden'),true);assert.equal(await evaluate('document.getElementById("dosageGallons").textContent'),'0.3379');assert.equal(await evaluate('document.getElementById("dosageMl").textContent'),'1,279 mL');
assert.ok(await evaluate('document.getElementById("step3").textContent.includes("70.906")'));assert.ok(await evaluate('document.getElementById("solutionWeight").textContent.endsWith("lb solution")&&document.getElementById("chlorineWeight").textContent.endsWith("lb as Cl2")'));
for(const [basis,value]of [['chlorine-weight','0.3218'],['trade','0.354']]){
 await evaluate('document.getElementById("strengthBasis").value="'+basis+'";document.getElementById("strengthBasis").dispatchEvent(new Event("change",{bubbles:true}))');assert.equal(await evaluate('document.getElementById("result").hidden'),true);assert.equal(await evaluate('document.getElementById("step4").textContent'),'Calculate an addition to see your values.');await evaluate('document.getElementById("doseForm").requestSubmit()');assert.equal(await evaluate('document.getElementById("dosageGallons").textContent'),value);
}
await evaluate('document.getElementById("specificGravity").value=0;document.getElementById("specificGravity").dispatchEvent(new Event("input",{bubbles:true}))');assert.equal(await evaluate('document.getElementById("doseForm").checkValidity()'),false);assert.equal(await evaluate('document.getElementById("result").hidden'),true);
await evaluate('document.getElementById("resetDefaults").click()');assert.equal(await evaluate('document.getElementById("basinVolume").value'),'35400');assert.equal(await evaluate('document.getElementById("residualIncrease").value'),'');assert.equal(await evaluate('document.getElementById("strengthBasis").value'),'naocl-weight');assert.equal(await evaluate('document.getElementById("specificGravity").value'),'1.10');
await evaluate('document.getElementById("basinVolume").value=1;document.getElementById("residualIncrease").value=.01;document.getElementById("doseForm").requestSubmit()');assert.ok(await evaluate('Number(document.getElementById("dosageGallons").textContent)>0'));
await evaluate('document.getElementById("resetDefaults").click();document.getElementById("residualIncrease").value=1');await evaluate('document.getElementById("residualIncrease").focus()');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await evaluate('document.getElementById("result").hidden'),false);
await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),'hypo');await evaluate('document.querySelector(".ops-app-menu-close").click()');
for(const width of [1920,1440,1024,900,768,390,320]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);assert.equal(await evaluate('document.querySelector(".site-header").offsetHeight'),width>800?112:144);
 if(width>=900){assert.equal(await evaluate('document.querySelector(".sidebar").offsetWidth'),222);await evaluate('window.scrollTo(0,500)');await wait();assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top'),112);}
 await evaluate('window.scrollTo(0,0)');if(width===1440||width===390){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync(path.resolve('preview'),{recursive:true});fs.writeFileSync(path.resolve('preview/hypo-'+width+'.png'),Buffer.from(shot.data,'base64'));}
}
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Hypochlorite UI passed: three strength bases, sample outputs, steps, weight labels, invalid input, stale-result clearing, reset, small additions, Enter submission, shared menu/header/sidebar, and phone/desktop widths.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
