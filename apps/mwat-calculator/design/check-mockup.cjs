// Compare the unchanged live UI and isolated mockup using identical CSV inputs. Run from the repository root.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('../../../scripts/lib/browser-check.cjs');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{

const wait=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
const files=['sample-data/UST1A-03112025_2025-04-16_11_55_34_MDT_(Data_MDT).csv','sample-data/UST1A-04162025_2025-05-16_12_19_32_MDT_(Data_MDT).csv'].map(f=>path.resolve(f));
const results=[];
for(const page of ['index.html','design/mockup.html']){
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:8782/apps/mwat-calculator/'+page});
 for(let i=0;i<150;i++){if(await evaluate('document.readyState==="complete"&&document.getElementById("monthSelect").options.length===13'))break;await new Promise(r=>setTimeout(r,40));}
 const dom=await call('DOM.getDocument');
 for(let i=0;i<2;i++){const input=await call('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#csvFile'+(i+1)});await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[files[i]]})}
 const cases=[];
 for(const [location,discharge]of [['UST1A',null],['001','continuous'],['007','intermittent']]){
  await evaluate('monthSelect.value="3";monthSelect.dispatchEvent(new Event("change"));locationSelect.value="'+location+'";locationSelect.dispatchEvent(new Event("change"))');
  if(discharge){assert.equal(await evaluate('dischargeTypeContainer.classList.contains("hidden")'),false);await evaluate('document.querySelector("input[name=dischargeType][value='+discharge+']").click()');}
  if(discharge==='intermittent'){
   assert.equal(await evaluate('processButton.disabled'),true);await evaluate('periodStartInput.value="2025-04-01T00:00";periodEndInput.value="2025-04-30T23:59";addPeriodButton.click()');assert.equal(await evaluate('dischargePeriods.length'),1);
  }
  assert.equal(await evaluate('processButton.disabled'),false);await evaluate('processFiles()');
  assert.ok(await evaluate('!resultsSection.classList.contains("hidden")&&exportPayload!==null'),'Results for '+page+' '+location);
  cases.push(await evaluate('JSON.stringify({count:recordCount.textContent,days:dayCount.textContent,range:dateRange.textContent,mwat:mwatValue.textContent,weeklyRange:mwatRange.textContent,daily:dailyMaxValue.textContent,dailyRange:dailyMaxRange.textContent,windows:windowTableContainer.textContent,dailyTable:dailyTableContainer.textContent})'));
  if(discharge==='intermittent'){await evaluate('document.querySelector(".period-list__remove").click()');assert.equal(await evaluate('processButton.disabled'),true);}
 }
 results.push(cases);
 if(page.startsWith('design')){
  await evaluate('locationSelect.value="UST1A";locationSelect.dispatchEvent(new Event("change"));processFiles()');
  await evaluate('window.jspdf.jsPDF.API.save=function(name){window.savedPDF={name,bytes:this.output("arraybuffer").byteLength};return this};exportPdfButton.click()');assert.ok(await evaluate('window.savedPDF.bytes>5000&&window.savedPDF.name.endsWith(".pdf")'));
  await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")'));
  await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),'mwat');await evaluate('document.querySelector(".ops-app-menu-close").click()');
  for(const width of [1920,1440,1024,900,768,390,320]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await wait();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Fits '+width);assert.equal(await evaluate('document.querySelector(".site-header").offsetHeight'),width>800?112:144);
   if(width>=900){assert.equal(await evaluate('document.querySelector(".sidebar").offsetWidth'),222);await evaluate('window.scrollTo(0,700)');await wait();assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top'),112)}
   if(width===1440||width===390){await evaluate('window.scrollTo(0,0)');await wait();let shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.resolve('apps/mwat-calculator/design/preview-'+width+'.png'),Buffer.from(shot.data,'base64'));await evaluate('resultsSection.scrollIntoView({block:"start"})');await wait();shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.resolve('apps/mwat-calculator/design/results-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  }
 }
}
assert.deepEqual(results[0],results[1],'Mockup matches existing results, ranges, and every detail-table value for all three workflows');assert.equal(errors.length,0,JSON.stringify(errors));console.log('MWAT mockup passed: identical live-script results/tables for UST1A, continuous and intermittent discharge; real CSV selection, period add/remove, PDF export, shared header/sidebar, and 320px–1920px layouts.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
