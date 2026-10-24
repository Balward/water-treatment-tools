const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
const vm=require('vm');const input={raw_mn:0.045,raw_fe:0.02,raw_toc:2.5,raw_ph:7.3,raw_temp:8,rainfall:0.3,month:10};const outputs=['script.js','operations.js'].map(file=>{const math=Object.create(Math);math.random=()=>.5;const context=vm.createContext({document:{addEventListener(){}},Math:math,Date});vm.runInContext(fs.readFileSync('apps/dose-predictor/'+file,'utf8'),context);return vm.runInContext('JSON.stringify({presets:SEASONAL_PRESETS,prediction:simulatePrediction('+JSON.stringify(input)+').predicted_dose})',context)});assert.equal(outputs[0],outputs[1],'Preserve presets and calculation');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{

const wait=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
const pageURL=process.env.OPS_PUBLIC?'https://water.gibbhub.io/dose-predictor/?v=20261022-dose1':'http://127.0.0.1:8782/apps/dose-predictor/index.html';
await call('Page.navigate',{url:pageURL});
for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&!!window.Operations'))break;await new Promise(r=>setTimeout(r,40));}
assert.equal(await evaluate('document.body.dataset.opsApp'),'permanganate');assert.ok(await evaluate('document.querySelector(".model-note").textContent.includes("Simulation Mode")'));
await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")'));
for(const season of ['spring','summer','fall','winter']){await evaluate('document.querySelector("[data-season='+season+']").click()');await wait();assert.equal(await evaluate('selectedPreset'),season);assert.equal(await evaluate('Number(document.getElementById("rawMn").value)===SEASONAL_PRESETS["'+season+'"].raw_mn'),true);assert.equal(await evaluate('document.querySelectorAll(".preset-btn[aria-pressed=true]").length'),1);}
await evaluate('document.querySelector("[data-season=spring]").click();document.getElementById("rawMn").value="1"');assert.equal(await evaluate('document.getElementById("parametersForm").checkValidity()'),false);assert.equal(await evaluate('validateInputs({raw_mn:1}).valid'),false);
await evaluate('document.querySelector("[data-season=spring]").click();document.getElementById("parametersForm").requestSubmit()');assert.ok(await evaluate('document.getElementById("predictBtn").disabled'));
for(let i=0;i<80;i++){if(await evaluate('!document.getElementById("predictBtn").disabled'))break;await new Promise(r=>setTimeout(r,50));}
await wait();assert.ok(await evaluate('document.getElementById("resultsSection").style.display==="block"&&document.getElementById("emptyResult").hidden'));
assert.ok(await evaluate('Number(document.getElementById("predictionValue").textContent)>0'));
await evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>window.copiedEstimate=text}});document.getElementById("copyBtn").click()');await wait();assert.ok(await evaluate('window.copiedEstimate.includes("Simulated Dose Estimate")&&!window.copiedEstimate.includes("Confidence")'));
assert.ok(await evaluate('JSON.parse(localStorage.getItem("dosePredictor_lastValues")).rawMn==="0.045"'));
await call('Page.reload');for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.getElementById("rawMn").value==="0.045"'))break;await new Promise(r=>setTimeout(r,40));}
assert.equal(await evaluate('document.getElementById("rawMn").value'),'0.045');
await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),'permanganate');await evaluate('document.querySelector(".ops-app-menu-close").click()');
for(const width of [1920,1440,1024,900,768,390,320]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);assert.equal(await evaluate('document.querySelector(".site-header").offsetHeight'),width>800?112:144);
 if(width>=900){assert.equal(await evaluate('document.querySelector(".sidebar").offsetWidth'),222);await evaluate('window.scrollTo(0,500)');await wait();assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top'),112);}
 await evaluate('window.scrollTo(0,0)');if(width===1440||width===390){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync(path.resolve('preview'),{recursive:true});fs.writeFileSync(path.resolve('preview/dose-'+width+'.png'),Buffer.from(shot.data,'base64'));}
}
await evaluate('document.getElementById("resetBtn").click()');await wait();assert.equal(await evaluate('document.getElementById("rawMn").value'),'');assert.equal(await evaluate('localStorage.getItem("dosePredictor_lastValues")'),null);assert.equal(await evaluate('document.getElementById("emptyResult").hidden'),false);
await evaluate('document.querySelector(".sidebar a[href=\\\"#guide\\\"]").click()');assert.equal(await evaluate('document.getElementById("guide").open'),true);
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Dose predictor passed: unchanged calculation and presets, validation, loading/result states, clipboard, saved inputs, reset, Apps menu, sticky sidebar, and 320px–1920px layouts.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
