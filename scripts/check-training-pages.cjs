const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createBrowserCheck}=require('./lib/browser-check.cjs');
const original=fs.readFileSync('apps/water-treatment-flashcards/script.js','utf8');assert.ok(fs.readFileSync('apps/water-treatment-flashcards/operations.js','utf8').startsWith(original.slice(0,original.indexOf('// Flashcard Application Class'))),'Preserve original deck');
(async()=>{const harness=await createBrowserCheck({});const {call,evaluate,errors,root,profile}=harness;try{

const wait=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
for(const appName of ['water-treatment-flashcards','regulation-100-study']){
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:process.env.OPS_PUBLIC?'https://water.gibbhub.io/'+appName+'/?v=20261022-reg100-2':'http://127.0.0.1:8782/apps/'+appName+'/index.html'});
 for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll("#studyNav button").length>0'))break;await new Promise(r=>setTimeout(r,50));}
 await evaluate('document.fonts.ready');assert.ok(await evaluate('document.fonts.check("16px Inter")'));
 const cards=appName==='water-treatment-flashcards';
 assert.equal(await evaluate('document.querySelectorAll("#studyNav button").length'),cards?8:15);
 if(cards){
  await evaluate('document.querySelector(".book-card.available").click()');assert.ok(await evaluate('!document.getElementById("chapterSelection").classList.contains("hidden")'));
  await evaluate('document.querySelector(".chapter-card[data-chapter=basic-microbiology-chemistry]").click()');assert.equal(await evaluate('app.currentCards.length'),13);
  await evaluate('document.getElementById("flashcard").click()');await wait();assert.ok(await evaluate('app.isFlipped&&document.querySelector(".card-front").inert&&!document.querySelector(".card-back").inert'));
  await evaluate('document.getElementById("nextCard").click()');assert.equal(await evaluate('app.currentCardIndex'),1);assert.equal(await evaluate('app.isFlipped'),false);
  await evaluate('document.getElementById("prevCard").click();document.getElementById("prevCard").click()');assert.equal(await evaluate('app.currentCardIndex'),12);
  await evaluate('document.querySelector("#studyNav [data-chapter=all]").click()');assert.equal(await evaluate('app.currentCards.length'),114);
  const deck=await evaluate('app.currentCards.map(c=>c.term).sort()');await evaluate('document.getElementById("shuffleBtn").click()');assert.deepEqual(await evaluate('app.currentCards.map(c=>c.term).sort()'),deck);
  await evaluate('window.confirm=()=>true;document.getElementById("resetBtn").click()');assert.equal(await evaluate('app.currentCards.length'),114);
  assert.ok(await evaluate('document.querySelector("#studyNav [data-chapter=all]").getAttribute("aria-pressed")==="true"'));
 }else{
  assert.equal(await evaluate('document.querySelectorAll(".knowledge-check").length'),15);
  for(let n=1;n<=15;n++){
   await evaluate('studyGuide.goToSlide('+n+')');
   assert.ok(await evaluate('document.querySelector(".slide.active .lesson-source a").href.startsWith("https://www.law.cornell.edu/")'));
   await evaluate('document.querySelectorAll(".slide.active .answer-option")[0].click()');
   await evaluate('document.querySelectorAll(".slide.active .answer-option")[reg100Lessons['+(n-1)+'].correct].click()');
   assert.ok(await evaluate('document.querySelector(".slide.active .answer-feedback").textContent.startsWith("Correct.")'));
  }
  await evaluate('studyGuide.goToSlide(1);document.querySelector(".slide.active .review-lesson").click()');
  assert.ok(await evaluate('document.getElementById("reviewProgress").textContent.startsWith("1 Of 15")'));
  await call('Page.reload');for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&window.studyGuide&&document.querySelectorAll("#studyNav button").length===15'))break;await new Promise(r=>setTimeout(r,30));}
  assert.ok(await evaluate('document.querySelector(".slide.active .review-lesson").getAttribute("aria-pressed")==="true"'));
  await evaluate('document.querySelector(".slide.active .review-lesson").click()');
  await evaluate('document.getElementById("lessonSearch").value="restoration";document.getElementById("lessonSearch").dispatchEvent(new Event("input"))');assert.equal(await evaluate('document.querySelectorAll(".search-result").length'),1);
  await evaluate('document.querySelector(".search-result").click()');assert.equal(await evaluate('studyGuide.currentSlide'),13);
  await evaluate('document.getElementById("lessonSearch").value="no-topic-exists";document.getElementById("lessonSearch").dispatchEvent(new Event("input"))');assert.ok(await evaluate('document.getElementById("searchResults").textContent.includes("No Matching Lessons")'));
  await evaluate('document.getElementById("lessonSearch").value="";document.getElementById("lessonSearch").dispatchEvent(new Event("input"));window.print=()=>window.printRequested=true;document.getElementById("printGuide").click()');assert.ok(await evaluate('window.printRequested'));
  await call('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await evaluate('Array.from(document.querySelectorAll(".slide")).filter(e=>getComputedStyle(e).display!=="none").length'),15);await call('Emulation.setEmulatedMedia',{media:''});
  await evaluate('studyGuide.goToSlide(1)');
  assert.equal(await evaluate('studyGuide.totalSlides'),15);assert.ok(await evaluate('document.getElementById("prevBtn").disabled'));
  await evaluate('document.getElementById("nextBtn").click()');assert.equal(await evaluate('studyGuide.currentSlide'),2);
  await evaluate('document.querySelectorAll("#studyNav button")[14].click()');assert.equal(await evaluate('studyGuide.currentSlide'),15);assert.ok(await evaluate('document.getElementById("nextBtn").disabled'));
  await evaluate('document.activeElement.blur();document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Home",bubbles:true}))');assert.equal(await evaluate('studyGuide.currentSlide'),1);
 }
 await evaluate('document.querySelector("[data-ops-menu]").click()');assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current]").dataset.opsDestination'),cards?'flashcards':'reg100');
 const previous=await evaluate(cards?'app.currentCardIndex':'studyGuide.currentSlide');await evaluate('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');assert.equal(await evaluate(cards?'app.currentCardIndex':'studyGuide.currentSlide'),previous);await evaluate('document.querySelector(".ops-app-menu-close").click()');
 for(const width of [1920,1440,1024,900,768,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await wait();
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),appName+' fits '+width);assert.equal(await evaluate('document.querySelector(".site-header").offsetHeight'),width>800?112:144);
  if(width>=900){assert.equal(await evaluate('document.querySelector(".sidebar").offsetWidth'),222);await evaluate('window.scrollTo(0,500)');await wait();assert.equal(await evaluate('document.querySelector(".sidebar").getBoundingClientRect().top'),112);await evaluate('window.scrollTo(0,0)');}
  if(!cards){for(let n=1;n<=15;n++){await evaluate('studyGuide.goToSlide('+n+')');assert.ok(await evaluate('document.querySelector(".slide.active").offsetHeight>0'),'Active slide content visible');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Slide '+n+' fits '+width)}await evaluate('studyGuide.goToSlide(4)');}
  if(width===1440||width===390){await evaluate('new Promise(r=>setTimeout(r,500))');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.mkdirSync(path.resolve('preview'),{recursive:true});fs.writeFileSync(path.resolve('preview/'+appName+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
}
assert.equal(errors.length,0,JSON.stringify(errors));console.log('Training pages passed: preserved 114-card deck, chapter selection, flip/next/previous/shuffle/reset, 15 sourced lessons, answer feedback, saved review marks, search, print, direct chapter navigation, menu/keyboard isolation, shared header, sticky sidebar, all slides fit 320px through 1920px.');
}finally{await harness.close();}})().catch(e=>{console.error(e);process.exitCode=1});
