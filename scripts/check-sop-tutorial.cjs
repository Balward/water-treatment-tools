const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),express=require('express');
const {launchBrowser}=require('./lib/browser-check.cjs');
(async()=>{const app=express();app.use(express.static(path.resolve('.')));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let b;try{
  const assets=path.resolve('apps/sop-creator/tutorial-assets'),steps=JSON.parse(await fs.readFile(path.join(assets,'steps.json'),'utf8'));assert.equal(steps.length,12);assert.ok((await fs.stat(path.join(assets,'sop-creator-walkthrough.webm'))).size>100000);
  b=await launchBrowser({userGesture:true});await b.call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/apps/sop-creator/tutorial.html'});
  const until=async expression=>{for(let i=0;i<120;i++){if(await b.evaluate(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('Timed out: '+expression);};
  await until('document.getElementById("tutorial-step").options.length===12&&!document.getElementById("tutorial-step").disabled');
  for(let i=0;i<steps.length;i++){
    await b.evaluate(`document.getElementById('tutorial-step').value='${i}';document.getElementById('tutorial-step').dispatchEvent(new Event('change'))`);
    await until('document.getElementById("step-image").complete&&document.getElementById("step-image").naturalWidth===1440');
    assert.ok((await b.evaluate('document.getElementById("step-title").textContent')).includes(steps[i].title));
  }
  await b.evaluate('document.getElementById("previous-step").click()');assert.equal(await b.evaluate('document.getElementById("tutorial-step").value'),'10');
  await b.evaluate('document.getElementById("next-step").click()');assert.ok(await b.evaluate('document.getElementById("next-step").disabled'));
  for(const width of [1440,1024,390,320]){await b.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});assert.ok(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Tutorial fits '+width);}
  await b.evaluate('document.getElementById("tutorial-video").play()');await until('document.getElementById("tutorial-video").currentTime>0.2');
  assert.equal(await b.evaluate('document.getElementById("tutorial-video").videoWidth'),1280);
  await b.evaluate('document.getElementById("tutorial-video").pause();document.getElementById("watch-step").click()');await until('document.getElementById("tutorial-video").currentTime>=88');
  assert.equal(await b.evaluate('document.querySelectorAll("#tutorial-transcript li").length'),12);
  await b.evaluate('document.getElementById("tutorial-video").pause()');assert.deepEqual(b.errors,[]);console.log('Tutorial passed: all 12 screenshots, guide controls, mobile widths, video playback, chapter seeking and transcript.');
}finally{await b?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
