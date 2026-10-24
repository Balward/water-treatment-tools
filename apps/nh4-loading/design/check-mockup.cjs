// Compare original loading app and isolated mockup with the same workbook and filters.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{const harness=await createBrowserCheck({port:8783});const {call,evaluate,errors,root,profile}=harness;try{


const wait=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
const until=async expression=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression)};
const snapshot=()=>evaluate('JSON.stringify({summary:[...document.querySelectorAll(".summary-value,.summary-detail,.threshold-highlight__value,#thresholdValue,#thresholdPercent,#exceedanceSummary,#dateRangeHint")].map(e=>e.textContent),hours:hourTableBody.textContent,preview:previewTableBody.textContent,charts:["timeSeriesChart","hourlyBarChart"].map(id=>{const c=Chart.getChart(id);return c?{labels:c.data.labels,datasets:c.data.datasets.map(d=>({label:d.label,data:d.data}))}:null})})');
const results=[];
for(const page of ['index.html','design/mockup.html']){
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:8783/apps/nh4-loading/'+page});
 await until('document.readyState==="complete"&&typeof XLSX!=="undefined"&&typeof Chart!=="undefined"&&!!Chart.getChart("timeSeriesChart")');
 await evaluate('useDemoButton.click()');await until('/Loaded \\d+ demo records/.test(loadStatus.textContent)');
 const cases=[await snapshot()];
 await evaluate('baseAverageSelect.value="weekday";baseAverageSelect.dispatchEvent(new Event("change"));thresholdNumber.value="1.35";thresholdNumber.dispatchEvent(new Event("change"));weekendToggle.click()');cases.push(await snapshot());
 await evaluate('weekendToggle.click();weekdayToggle.click();thresholdSlider.value="1.5";thresholdSlider.dispatchEvent(new Event("input"))');cases.push(await snapshot());
 await evaluate('weekdayToggle.click();startDateInput.value=startDateInput.min;endDateInput.value=startDateInput.min;endDateInput.dispatchEvent(new Event("change"))');cases.push(await snapshot());
 await evaluate('resetDateRange.click();resetZoomButton.click()');cases.push(await snapshot());
 // Exercise the real Excel file picker, not a synthetic call into app internals.
 const dom=await call('DOM.getDocument');const input=await call('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#fileInput'});await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path.resolve('sample-data/NH3 Loading - Original.xlsx')]});
 await until('/Loaded \\d+ records/.test(loadStatus.textContent)');cases.push(await snapshot());results.push(cases);
 if(page.startsWith('design')){
  await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")'));
  await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),'loading');await evaluate('document.querySelector(".ops-app-menu-close").click()');
  for(const width of [1920,1440,1024,900,768,390,320]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await wait();
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);assert.equal(await evaluate('document.querySelector(".site-header").offsetHeight'),width>800?112:144);
   if(width>=900){assert.equal(await evaluate('document.querySelector(".sidebar").offsetWidth'),222);await evaluate('window.scrollTo(0,700)');await wait();assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top'),112)}
   if(width===1440||width===390){await evaluate('window.scrollTo(0,0)');await wait();let shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.resolve('apps/nh4-loading/design/preview-'+width+'.png'),Buffer.from(shot.data,'base64'));await evaluate('document.querySelector("#charts").scrollIntoView({block:"start"})');await wait();await evaluate('new Promise(r=>setTimeout(r,700))');shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.resolve('apps/nh4-loading/design/charts-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  }
 }
}
assert.deepEqual(results[0],results[1],'All summary values, tables and chart data match the original for demo, workbook upload and filter scenarios');assert.equal(errors.length,0,JSON.stringify(errors));console.log('NH3 mockup passed: identical original-script summary, tables and chart data for demo, workbook upload, base average, threshold, weekday/weekend and date filters; shared navigation and 320px-1920px layouts.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
