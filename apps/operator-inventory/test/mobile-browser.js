// Optional real-browser smoke check. Run with: node test/mobile-browser.js
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-mobile-'));
  const emailRequests = [];
  const server = createApp({ dataDir:path.join(temp,'data'), mailer:{enabled:true,defaultTo:'staff@example.com',send:async(to,report)=>{emailRequests.push({to,report});}} });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${path.join(temp,'profile')}`,'about:blank'], { windowsHide:true, stdio:['ignore','ignore','pipe'] });
  let socket;
  try {
    const browserUrl = await new Promise((resolve,reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Chrome startup timed out')),20000);
      chrome.on('error',reject);
      chrome.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    });
    socket = new WebSocket(browserUrl);
    await new Promise((resolve,reject) => { socket.addEventListener('open',resolve); socket.addEventListener('error',reject); });
    let sequence = 0, sessionId;
    const requests = new Map(), errors = [];
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails);
      if (requests.has(data.id)) { const {resolve,reject} = requests.get(data.id); requests.delete(data.id); data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result); }
    });
    function call(method, params = {}, session = sessionId) {
      const id = ++sequence;
      return new Promise((resolve,reject) => { requests.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params,...(session ? {sessionId:session} : {})})); });
    }
    const target = await call('Target.createTarget',{url:'about:blank'});
    sessionId = (await call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
    await call('Page.enable'); await call('Runtime.enable');
    async function evaluate(expression) {
      const result = await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function until(expression) {
      for (let i=0;i<100;i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve,100)); }
      throw new Error('Timed out: '+expression+' State: '+JSON.stringify(await evaluate(`({mode,notice:document.getElementById('notice').textContent,deleteError:document.getElementById('delete-error').textContent,dialog:document.getElementById('delete-dialog').open,records:document.querySelectorAll('[data-open]').length,navigating,deleting})`)));
    }
    async function viewport(width, height=844) { await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true}); }
    async function checkWidth() { assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Phone layout must not scroll horizontally'); }
    async function screenshot(name) {
      const dir = path.join(__dirname,'..','preview'); fs.mkdirSync(dir,{recursive:true});
      const result = await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(result.data,'base64'));
    }
    await viewport(390); await call('Page.navigate',{url:base});
    await until('document.querySelectorAll("[data-worksheet]").length === 3');
    await until('document.querySelector(".city-logo").complete && document.querySelector(".city-logo").naturalWidth > 0');
    assert.ok(await evaluate('document.querySelector(".facility-name").textContent.includes("Water Treatment Facility")'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".welcome")).backgroundColor'),'rgb(32, 40, 47)','Dark stylesheet loaded');
    await evaluate('document.getElementById("theme-toggle").click()');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".welcome")).backgroundColor'),'rgb(255, 255, 255)');
    await call('Page.reload');
    await until('document.querySelectorAll("[data-worksheet]").length === 3');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'light','Theme survives reload');
    await evaluate('document.getElementById("theme-toggle").click()');
    assert.equal(await evaluate('document.documentElement.dataset.theme'),'dark');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".bottom-nav")).position'),'static','Navigation belongs to the app layout');
    async function checkDockOnScroll() {
      const top = await evaluate('document.querySelector(".bottom-nav").getBoundingClientRect().top');
      const counterTop = await evaluate('document.getElementById("count-status").getBoundingClientRect().top');
      assert.ok(await evaluate('Math.abs(document.querySelector(".bottom-nav").getBoundingClientRect().bottom-innerHeight)<1'),'Dock fills the bottom of the available viewport');
      assert.ok(await evaluate('document.querySelector(".bottom-nav").getBoundingClientRect().height<=85'),'Dock has no oversized blank padding');
      for (const offset of [500,1500,250,0]) {
        await evaluate(`document.getElementById('app-scroll').scrollTop=${offset}; new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
        assert.equal(await evaluate('document.querySelector(".bottom-nav").getBoundingClientRect().top'),top,'Dock stays in place while content scrolls');
        assert.equal(await evaluate('window.scrollY'),0,'The document itself does not scroll');
        assert.equal(await evaluate('document.getElementById("count-status").getBoundingClientRect().top'),counterTop,'Counters stay locked while content scrolls');
        if (offset >= 500 && await evaluate(`!document.getElementById('workspace').hidden`)) {
          assert.ok(await evaluate(`Math.abs(document.querySelector('.location-toolbar').getBoundingClientRect().top-document.getElementById('count-status').getBoundingClientRect().bottom)<1`),'Pinned location bar sits directly against counters without a see-through gap');
          assert.ok(await evaluate(`Math.abs(document.querySelector('.location-toolbar').getBoundingClientRect().width-document.querySelector('.phone-app').getBoundingClientRect().width)<1`),'Location bar masks scrolling cards across the full phone width');
        }
      }
    }
    await checkDockOnScroll();
    for (const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390); await screenshot('home-mobile');
    async function start(worksheet, total) {
      await evaluate(`document.querySelector('[data-worksheet="${worksheet}"]').click()`);
      await until('document.getElementById("new-dialog").open');
      if (worksheet === 'janitorial') {
        await evaluate(`document.getElementById('operator-name').focus();Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>480});visualViewport.dispatchEvent(new Event('resize'))`);
        await until(`document.body.classList.contains('keyboard-open') && document.getElementById('operator-name').getBoundingClientRect().bottom<=480`);
        await evaluate(`delete visualViewport.height;document.activeElement.blur();visualViewport.dispatchEvent(new Event('resize'))`);
        await until(`!document.body.classList.contains('keyboard-open')`);
      }
      await evaluate(`document.getElementById('inventory-date').value='2026-10-08'; document.getElementById('operator-name').value='Mobile test'; document.getElementById('new-form').requestSubmit()`);
      await until(`!document.getElementById('workspace').hidden && document.getElementById('stat-remaining').textContent === '${total}'`);
    }
    await start('janitorial',18);
    assert.equal(await evaluate('document.querySelectorAll("[data-adjust], [data-use-previous], #arrow-step").length'),0,'Entry controls are keyboard-only');
    assert.equal(await evaluate('document.querySelector("input[type=search]")'),null,'Search removed');
    assert.equal(await evaluate('document.querySelector("[data-id]").dataset.id'),'s2-r5','Items stay in worksheet order');
    assert.equal(await evaluate('document.querySelectorAll(".item-card").length'),9);
    await checkDockOnScroll();
    // Simulate an OS keyboard that resizes the layout viewport (Firefox Android).
    await evaluate(`document.querySelectorAll('[data-id]')[6].focus()`);
    await viewport(390,480);
    await until(`document.body.classList.contains('keyboard-open')`);
    const fieldVisible = `(() => { const r=document.activeElement.getBoundingClientRect();const s=document.getElementById('app-scroll').getBoundingClientRect();return r.top>=s.top+12 && r.bottom<=Math.min(s.bottom,visualViewport.height+visualViewport.offsetTop)-12 })()`;
    await until(fieldVisible);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".bottom-nav")).display'),'none');
    await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
    await until(`document.activeElement.dataset.id === 's2-r12'`);
    await until(fieldVisible);
    await evaluate('document.activeElement.blur()'); await viewport(390);
    await until(`!document.body.classList.contains('keyboard-open')`);
    await checkDockOnScroll();
    // Simulate a keyboard overlay shrinking only the VisualViewport.
    await evaluate(`document.querySelectorAll('[data-id]')[8].focus();Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>480});visualViewport.dispatchEvent(new Event('resize'))`);
    await until(`document.body.classList.contains('keyboard-open')`);
    await until(fieldVisible);
    assert.equal(await evaluate('document.querySelector(".phone-app").getBoundingClientRect().height'),480);
    await screenshot('keyboard-mobile');
    // Safari also pans its visible area upward when focusing a lower field.
    await evaluate(`Object.defineProperty(visualViewport,'offsetTop',{configurable:true,get:()=>160});visualViewport.dispatchEvent(new Event('scroll'))`);
    await until(`document.querySelector('.phone-app').getBoundingClientRect().top === 160`);
    await until(fieldVisible);
    assert.equal(await evaluate('document.querySelector(".phone-app").getBoundingClientRect().bottom'),640);
    await evaluate(`delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('scroll'))`);
    await evaluate(`delete visualViewport.height;document.activeElement.blur();visualViewport.dispatchEvent(new Event('resize'))`);
    await until(`!document.body.classList.contains('keyboard-open')`);
    await checkDockOnScroll();
    await evaluate(`const field=document.querySelector('[data-id]');field.focus();field.value='0.5';field.dispatchEvent(new Event('input',{bubbles:true}));field.blur()`);
    await until(`document.getElementById('save-status').textContent === 'All changes saved'`);
    assert.equal(await evaluate(`document.getElementById('stat-counted').textContent`),'1');
    await evaluate(`document.getElementById('location-select').value='Kitchen';document.getElementById('location-select').dispatchEvent(new Event('change',{bubbles:true}))`);
    assert.equal(await evaluate('document.querySelectorAll(".item-card").length'),9);
    for (const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390);
    await evaluate(`document.getElementById('back-home').click()`);
    await until(`!document.getElementById('home-view').hidden`);
    const loaded = new Promise(resolve => {
      const listener = event => { const message = JSON.parse(event.data); if (message.method === 'Page.loadEventFired' && message.sessionId === sessionId) { socket.removeEventListener('message',listener); resolve(); } };
      socket.addEventListener('message',listener);
    });
    await call('Page.reload'); await loaded; await until(`document.querySelector('[data-open]') !== null`);
    await evaluate(`document.querySelector('[data-open]').click()`);
    await until(`!document.getElementById('workspace').hidden`);
    assert.equal(await evaluate('document.querySelector("[data-id]").value'),'0.5');
    await screenshot('count-mobile');
    await evaluate(`document.getElementById('location-select').value='Basement';document.getElementById('location-select').dispatchEvent(new Event('change'));document.querySelectorAll('[data-id]').forEach(field=>{if(field.value===''){field.value='0';field.dispatchEvent(new Event('input',{bubbles:true}))}});document.getElementById('location-select').value='Kitchen';document.getElementById('location-select').dispatchEvent(new Event('change'));document.querySelectorAll('[data-id]').forEach(field=>{field.value='0';field.dispatchEvent(new Event('input',{bubbles:true}))})`);
    await until(`document.getElementById('save-status').textContent === 'All changes saved'`);
    await evaluate(`document.getElementById('complete').click()`);
    await until(`document.getElementById('worksheet-label').textContent === 'COMPLETED WORKSHEET'`);
    await evaluate(`document.getElementById('nav-home').click()`); await until(`!document.getElementById('home-view').hidden`);
    await start('janitorial',18);
    assert.equal(await evaluate('document.querySelector("[data-id]").value'),'','New quantity is blank');
    assert.ok(await evaluate('document.querySelector("[data-previous]").textContent.includes("0.5")'),'Previous quantity shown on card');
    assert.equal(await evaluate('document.getElementById("stat-counted").textContent'),'0');
    assert.equal(await evaluate('document.getElementById("stat-remaining").textContent'),'18');
    await evaluate(`const field=document.querySelector('[data-id]');field.value='0.75';field.dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.equal(await evaluate('document.querySelector("[data-id]").value'),'0.75','Fractional keyboard entry');
    assert.equal(await evaluate('document.getElementById("stat-counted").textContent'),'1');
    await until(`document.getElementById('save-status').textContent === 'All changes saved'`);
    await evaluate(`document.getElementById('nav-home').click()`); await until(`!document.getElementById('home-view').hidden`);
    await start('dewatering',14);
    assert.equal(await evaluate('document.querySelectorAll(".item-card").length'),14);
    await evaluate(`document.querySelectorAll('[data-id]').forEach(field=>{field.value='0';field.dispatchEvent(new Event('input',{bubbles:true}))})`);
    await until(`document.getElementById('save-status').textContent === 'All changes saved'`);
    await evaluate(`document.getElementById('complete').click()`);
    await until(`document.getElementById('worksheet-label').textContent === 'COMPLETED WORKSHEET'`);
    assert.equal(await evaluate('document.querySelectorAll("[data-id]:disabled").length'),14);
    await until("!document.getElementById('order-report').hidden");
    assert.equal(emailRequests.length,0,'Completing inventory never sends mail automatically');
    assert.equal(await evaluate(`document.getElementById('report-recipient').value`),'staff@example.com','Configured recipient is prefilled');
    await evaluate(`document.getElementById('report-recipient').focus()`); await viewport(390,480); await until(fieldVisible);
    await evaluate(`document.activeElement.blur()`); await viewport(390); await until(`!document.body.classList.contains('keyboard-open')`);
    await evaluate(`document.getElementById('email-report-form').requestSubmit()`);
    await until(`document.getElementById('report-email-status').textContent.includes('Email accepted')`);
    assert.equal(emailRequests.length,1,'Explicit button press emails report through mocked server sender');
    assert.equal(emailRequests[0].to,'staff@example.com');
    assert.match(emailRequests[0].report.text,/Dewatering Inventory/);
    assert.match(emailRequests[0].report.text,/13 items at or below PAR/);
    assert.equal(await evaluate("document.querySelectorAll('#report-items .report-item').length"),13,'Completion automatically opens order report for numeric PAR items');
    assert.equal(await evaluate("document.querySelectorAll('#report-review .report-item').length"),1,'As-needed item has a separate review section');
    assert.ok(await evaluate("document.getElementById('report-review').textContent.includes('White Rags')"));
    for (const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390); await screenshot('order-needed-mobile');
    // Boundary examples using a saved inventory snapshot: zero, fractional equality,
    // above PAR, uncounted, and manual replenishment.
    await evaluate("renderOrderReport({...run,items:[{id:'zero',description:'Empty stock',location:'Shelf',countSize:'Case',par:1},{id:'equal',description:'At threshold',location:'Shelf',countSize:'Case',par:0.5},{id:'above',description:'Enough stock',location:'Shelf',countSize:'Box',par:2},{id:'blank',description:'Uncounted item',location:'Shelf',countSize:'Box',par:2},{id:'manual',description:'Manual check',location:'Shelf',countSize:'Bag',par:null,parNote:'Fill As Needed'}],counts:{zero:0,equal:0.5,above:2.5,manual:0},status:'draft'})");
    assert.equal(await evaluate("document.querySelectorAll('#report-items .report-item').length"),2,'Only zero stock and equality at fractional PAR need ordering');
    assert.ok(await evaluate("document.getElementById('report-items').textContent.includes('At threshold')"));
    assert.ok(await evaluate("!document.getElementById('report-items').textContent.includes('Enough stock') && !document.getElementById('report-items').textContent.includes('Uncounted item')"));
    assert.ok(await evaluate("document.getElementById('report-note').textContent.includes('1 item still uncounted')"));
    await evaluate("document.getElementById('report-back').click()");
    await until("!document.getElementById('history-view').hidden");
    await evaluate("document.querySelector('.history-card:has(.badge.ok) [data-report]').click()");
    await until("!document.getElementById('order-report').hidden");
    assert.equal(await evaluate("document.querySelectorAll('#report-items .report-item').length"),13,'History report uses persisted inventory counts');

    await evaluate(`document.getElementById('nav-home').click()`); await until(`!document.getElementById('home-view').hidden`);
    await start('operating',40);
    assert.equal(await evaluate('document.getElementById("location-select").options.length'),5);
    assert.ok(await evaluate('productPhoto(catalog.items.find(item => item.id === "s1-r5")).includes("/images/s1-r5.jpg")'),'User-selected Methyl Purple photo is enabled');
    await evaluate(`document.getElementById('next-location').click()`);
    assert.equal(await evaluate('document.getElementById("location-select").value'),'Under Stairwell');
    assert.equal(await evaluate('document.querySelectorAll(".product-photo img").length'),7,'Workbook photos and user-selected photos are visible');
    for (let photoIndex = 0; photoIndex < 7; photoIndex++) {
      await evaluate(`document.querySelectorAll('.product-photo img')[${photoIndex}].scrollIntoView({block:'center'})`);
      await until(`document.querySelectorAll('.product-photo img')[${photoIndex}].complete && document.querySelectorAll('.product-photo img')[${photoIndex}].naturalWidth > 0`);
    }
    assert.ok(await evaluate('Array.from(document.querySelectorAll(".product-photo img")).some(img => img.getAttribute("src") === "/images/s1-r9.jpg")'),'User-selected pH 7 buffer photo loads');
    assert.equal(await evaluate('productPhoto(catalog.items.find(item => item.id === "s3-r14"))'),'', 'Additional product-number search photos remain hidden');
    assert.equal(await evaluate('document.getElementById("stat-counted").textContent'),'0');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.item-name')).fontSize"),'22px');
    for (const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390); await checkDockOnScroll();
    await evaluate("document.querySelector('[data-id]').focus()"); await viewport(390,480); await until(fieldVisible);
    await evaluate('document.activeElement.blur()'); await viewport(390);
    await until("!document.body.classList.contains('keyboard-open')");
    await evaluate(`document.getElementById('nav-history').click()`);
    await until(`document.getElementById('history-title').textContent==='Inventory history'`);
    await until(`document.querySelector('.history-card .history-top strong')?.textContent==='Operating Supplies'`);
    await evaluate(`document.querySelector('[data-report]').click()`);
    await until(`!document.getElementById('order-report').hidden`);
    assert.equal(await evaluate(`document.querySelectorAll('#report-items .report-item').length`),0,'Blank draft counts are not treated as zero stock');
    assert.ok(await evaluate(`document.getElementById('report-note').textContent.includes('40 items still uncounted')`));
    assert.ok(await evaluate(`document.getElementById('report-summary').textContent.includes('No counted items')`));
    await evaluate(`document.getElementById('report-back').click()`);
    await until(`!document.getElementById('history-view').hidden`);
    const beforeDelete = await evaluate(`document.querySelectorAll('[data-open]').length`);
    await evaluate(`document.querySelector('[data-delete]').click()`);
    await until(`document.getElementById('delete-dialog').open`);
    assert.ok(await evaluate(`document.getElementById('delete-copy').textContent.includes('Operating Supplies')`),'Confirmation identifies the worksheet');
    assert.equal(await evaluate(`document.activeElement.id`),'cancel-delete','Cancel receives focus by default');
    for (const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390); await screenshot('delete-inventory-mobile');
    await evaluate(`document.getElementById('cancel-delete').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('[data-open]').length`),beforeDelete,'Cancel keeps the inventory');
    const deletedId = await evaluate(`document.querySelector('[data-delete]').dataset.delete`);
    await evaluate(`document.querySelector('[data-delete]').click()`);
    await until(`document.getElementById('delete-dialog').open`);
    await evaluate(`document.getElementById('confirm-delete').click()`);
    await until(`!document.getElementById('delete-dialog').open && document.querySelectorAll('[data-open]').length===${beforeDelete-1}`);
    assert.equal(await evaluate(`fetch('/api/inventories/${deletedId}').then(r=>r.status)`),404,'Draft deletion reaches persisted server state');
    await evaluate(`document.querySelector('.history-card:has(.badge.ok) [data-delete]').click()`);
    await until(`document.getElementById('delete-dialog').open`);
    assert.ok(await evaluate(`document.getElementById('delete-copy').textContent.includes('Completed')`));
    await evaluate(`document.getElementById('confirm-delete').click()`);
    await until(`!document.getElementById('delete-dialog').open && document.querySelectorAll('[data-open]').length===${beforeDelete-2}`);
    await evaluate('document.getElementById("nav-home").click()');
    await until('!document.getElementById("home-view").hidden');
    await evaluate('document.getElementById("manage-items").click()');
    await until('!document.getElementById("item-manager").hidden');
    for (const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390);
    await evaluate('document.getElementById("add-item").click()');
    await until('document.getElementById("item-dialog").open');
    assert.equal(await evaluate('document.getElementById("item-location").tagName'),'SELECT');
    assert.ok(await evaluate('Array.from(document.getElementById("item-location").options).some(option=>option.value==="Under Stairwell")'));
    assert.ok(await evaluate('document.getElementById("new-location-field").hidden'));
    await evaluate('document.getElementById("item-location").value="__new_location__";document.getElementById("item-location").dispatchEvent(new Event("change"))');
    assert.ok(await evaluate('!document.getElementById("new-location-field").hidden && document.getElementById("item-new-location").required'));
    await evaluate('document.getElementById("item-description").value="New test supply";document.getElementById("item-new-location").value="New shelf";document.getElementById("item-countSize").value="Case";document.getElementById("item-par").value="0.5";document.getElementById("item-form").requestSubmit()');
    await until('!document.getElementById("item-dialog").open && document.getElementById("manager-list").textContent.includes("New test supply")');
    const customId = await evaluate('catalog.items.find(i=>i.description==="New test supply").id');
    await evaluate(`document.querySelector('[data-edit-item="${customId}"]').click()`);
    await until('document.getElementById("item-dialog").open');
    assert.equal(await evaluate('document.getElementById("item-location").value'),'New shelf','New location becomes a selectable existing location');
    assert.ok(await evaluate('document.getElementById("new-location-field").hidden && document.getElementById("item-new-location").disabled'));
    await evaluate('document.getElementById("item-description").value="Updated supply";document.getElementById("item-form").requestSubmit()');
    await until('!document.getElementById("item-dialog").open && document.getElementById("manager-list").textContent.includes("Updated supply")');
    await screenshot('manage-items-mobile');
    await evaluate(`document.querySelector('[data-remove-item="${customId}"]').click()`);
    await until('document.getElementById("remove-item-dialog").open');
    await evaluate('document.getElementById("cancel-remove-item").click()');
    assert.ok(await evaluate('catalog.items.some(i=>i.description==="Updated supply")'),'Cancel preserves item');
    await evaluate(`document.querySelector('[data-remove-item="${customId}"]').click()`);
    await until('document.getElementById("remove-item-dialog").open');
    await evaluate('document.getElementById("confirm-remove-item").click()');
    await until('!document.getElementById("remove-item-dialog").open && !catalog.items.some(i=>i.description==="Updated supply")');
    // Review large changes before saving, allowing both correction and confirmation.
    await evaluate("document.getElementById('manager-back').click()");
    await until("!document.getElementById('home-view').hidden");
    await start('operating',40);
    assert.deepEqual(await evaluate('[unusualCount(2,20),unusualCount(20,2),unusualCount(0,10),unusualCount(1,2),unusualCount(undefined,20),unusualCount(2,3)]'),[true,true,true,false,false,false]);
    const reviewId=await evaluate("document.querySelector('[data-id]').dataset.id");
    await evaluate("run.previousCounts[document.querySelector('[data-id]').dataset.id]=2;var input=document.querySelector('[data-id]');input.focus();input.value='20';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur()");
    await until("document.getElementById('unusual-dialog').open");
    assert.equal(await evaluate("run.counts[document.querySelector('[data-id]').dataset.id] ?? null"),null,'Unconfirmed count is not saved');
    await evaluate("document.getElementById('edit-unusual').click()");
    await until("document.activeElement.dataset.id === '"+reviewId+"'");
    await evaluate("var input=document.activeElement;input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur()");
    await until("run.counts['"+reviewId+"'] === 3 && !saving");
    await evaluate("run.previousCounts[document.querySelector('[data-id]').dataset.id]=2;var input=document.querySelector('[data-id]');input.focus();input.value='20';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur()");
    await until("document.getElementById('unusual-dialog').open");
    await evaluate("document.getElementById('confirm-unusual').click()");
    await until("run.counts['"+reviewId+"'] === 20 && !saving");
    assert.equal(errors.length,0,'No browser runtime exceptions');
    console.log('Mobile browser checks passed: 320/390/430px widths, all worksheets, count saving, reload/resume, completion, location navigation.');
  } finally {
    if (socket) socket.close();
    chrome.kill();
    await new Promise(resolve => server.close(resolve));
    // Chrome may need time to release its temporary profile on Windows.
    await new Promise(resolve => setTimeout(resolve,500));
    fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
