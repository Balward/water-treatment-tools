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
    await evaluate('document.fonts.ready');
    assert.ok(await evaluate('document.fonts.check("16px Inter")&&getComputedStyle(document.body).fontFamily.startsWith("Inter")'));
    const font=await fetch(base+'/shared/operations/Inter-VariableFont_opsz,wght.ttf');assert.ok(font.ok);assert.equal(font.headers.get('content-type'),'font/ttf');
    for(const width of [320,390,430,1024]){
      await viewport(width);await evaluate('document.querySelector("[data-ops-menu]").click()');
      assert.equal(await evaluate('document.querySelector(".topbar").getBoundingClientRect().height'),width<=800?144:112,'Common banner height at '+width);
      assert.ok(await evaluate('document.getElementById("opsAppMenu").open'));
      assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current=page]").dataset.opsDestination'),'inventory');
      assert.equal(await evaluate('document.querySelectorAll(".ops-app-menu [data-ops-destination]").length'),17);
      assert.equal(await evaluate('document.querySelector(".ops-app-menu [data-ops-destination=home]").href'),'https://water.gibbhub.io/?v=operations-home-20261021');
      assert.ok(await evaluate('(()=>{const b=document.getElementById("opsAppMenu").getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top===0&&b.bottom<=innerHeight})()'),'Shared menu fits '+width);
      await evaluate('document.querySelector(".ops-app-menu-close").click();new Promise(r=>requestAnimationFrame(r))');
    }
    await viewport(390);

    assert.ok(await evaluate('document.querySelector(".facility-name").textContent.includes("Water Treatment Facility")'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".welcome")).backgroundColor'),'rgb(255, 255, 255)','Light design is the default');
    assert.equal(await evaluate('document.getElementById("theme-toggle")'),null,'Theme switching has been removed');
    assert.equal(await evaluate('getComputedStyle(document.documentElement).colorScheme'),'light');
    await evaluate('localStorage.setItem("inventory-theme","dark");window.__reloadPending=true');
    await call('Page.reload');
    await until('window.__reloadPending !== true && document.querySelectorAll("[data-worksheet]").length === 3');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".welcome")).backgroundColor'),'rgb(255, 255, 255)','Old saved preferences cannot restore dark mode');
    assert.equal(await evaluate('document.documentElement.hasAttribute("data-theme")'),false);
    assert.equal(await evaluate('document.querySelectorAll(".bottom-nav button").length'),5);
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
        await until(`!document.body.classList.contains('keyboard-open') && document.getElementById('operator-name').readOnly`);
        await evaluate(`delete visualViewport.height;document.activeElement.blur();visualViewport.dispatchEvent(new Event('resize'))`);
        await until(`!document.body.classList.contains('keyboard-open')`);
      }
      await evaluate(`document.getElementById('inventory-date').value='2026-10-08'; document.getElementById('operator-name').value='Mobile test'; document.getElementById('new-form').requestSubmit()`);
      await until(`!document.getElementById('workspace').hidden && document.getElementById('stat-remaining').textContent === '${total}'`);
    }
    await start('janitorial',18);
    const firstDraftId=await evaluate('run.id');
    await evaluate('document.getElementById("nav-home").click()');await until('!document.getElementById("home-view").hidden');
    await evaluate('document.querySelector("[data-worksheet=janitorial]").click()');await until('!document.getElementById("workspace").hidden');
    assert.equal(await evaluate('run.id'),firstDraftId,'Choosing a type with unfinished work resumes the same inventory');
    assert.equal(await evaluate('document.getElementById("new-dialog").open'),false,'Resume does not offer a duplicate inventory form');
    assert.equal(await evaluate('document.querySelectorAll("[data-adjust], [data-use-previous], #arrow-step").length'),0,'Entry controls are keyboard-only');
    assert.equal(await evaluate('document.querySelector("#workspace input[type=search]")'),null,'Counting screens do not have item search');
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

    await evaluate("var countField=document.querySelector('[data-id]');countField.value='-1';countField.dispatchEvent(new Event('input',{bubbles:true}));");
    assert.equal(await evaluate("(async()=>{const waits=[];document.dispatchEvent(new CustomEvent('operations:before-navigate',{cancelable:true,detail:{url:'https://water.gibbhub.io/',waitUntil:p=>waits.push(p)}}));return (await Promise.all(waits)).every(value=>value!==false)})()"),false,'Invalid counts block cross-app navigation');
    await evaluate(`const field=document.querySelector('[data-id]');field.focus();field.value='0.5';field.dispatchEvent(new Event('input',{bubbles:true}));field.blur()`);
    assert.equal(await evaluate("(async()=>{const waits=[];document.dispatchEvent(new CustomEvent('operations:before-navigate',{cancelable:true,detail:{url:'https://water.gibbhub.io/',waitUntil:p=>waits.push(p)}}));return (await Promise.all(waits)).every(value=>value!==false)})()"),true,'Cross-app navigation waits for valid counts to save');
    assert.ok(await evaluate("Object.keys(pending).length===0&&!saving"));

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
    await evaluate('window.__reloadPending = true'); await call('Page.reload'); await until('window.__reloadPending !== true && document.readyState === "complete"'); await loaded; await until(`document.querySelector('[data-open]') !== null`);
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
    assert.match(emailRequests[0].report.text,/Dewatering Supplies/);
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
    await until(`document.getElementById('history-title').textContent==='Inventory History'`);
    await until(`document.querySelector('.history-card:has([data-report]) .history-top strong')?.textContent==='Operating Supplies'`);
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
    await evaluate('document.getElementById("nav-manage").click()');
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
    // Isolate the backlog fixture after earlier worksheet completion checks.
    await evaluate("(async()=>{await refreshOrderList();for(const entry of [...orderList.items])orderList=await api('/api/order-list/'+entry.id,{method:'DELETE',body:JSON.stringify({revision:orderList.revision})});run=await api('/api/inventories/'+run.id,{method:'PATCH',body:JSON.stringify({revision:run.revision,status:'complete',counts:Object.fromEntries(run.items.map(item=>[item.id,item.id==='s1-r7'?0:999]))})});renderOrderReport(run)})()");
    await until("!document.getElementById('order-report').hidden && document.querySelector('[data-open-order-list]')");
    assert.ok(await evaluate("document.querySelector('#report-items .product-photo img') !== null"),'Order Needed cards show product photos');
    await evaluate("document.querySelector('[data-open-order-list]').click()");
    await until("!document.getElementById('order-list-view').hidden");
    assert.ok(await evaluate("document.getElementById('order-list-items').textContent.includes('HACH')"));
    assert.ok(await evaluate("document.querySelector('#order-list-items .product-photo img') !== null"));
    for(const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    assert.equal(await evaluate('orderList.items.length'),1,'Completion automatically queues low-stock items');
    await evaluate("document.querySelector('[data-order-select]').click()");
    await evaluate("document.getElementById('review-all-orders').click()");
    await until("!document.getElementById('order-review-view').hidden");
    assert.ok(await evaluate("document.getElementById('print-order-review').disabled"),'Review blocks printing while purchase quantities are missing');
    await evaluate("document.getElementById('order-review-back').click()");
    await until("!document.getElementById('order-list-view').hidden");
    await evaluate("document.querySelector('[data-edit-order]').click()");
    await until("document.getElementById('order-details-dialog').open");
    assert.equal(await evaluate("document.getElementById('order-quantity').value"),'','Purchase quantities start blank');
    await evaluate("document.getElementById('order-quantity').value='3';document.getElementById('order-unit').value='Box';document.getElementById('order-notes').value='Check with maintenance before ordering.';document.getElementById('order-details-form').requestSubmit()");
    await until("!document.getElementById('order-details-dialog').open && orderList.items[0].quantity === 3 && !listBusy");
    await evaluate("document.querySelector('[data-review-supplier]').click()");
    await until("!document.getElementById('order-review-view').hidden");
    assert.equal(await evaluate("document.getElementById('order-review-title').textContent"),'HACH order');
    assert.equal(await evaluate("document.querySelector('.review-quantity').textContent"),'3');
    assert.ok(await evaluate("!document.getElementById('print-order-review').disabled"));
    assert.ok(await evaluate("document.getElementById('order-review-items').textContent.includes('Check with maintenance before ordering.')"));
    for(const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390); await screenshot('purchase-review-mobile');
    const purchasePdf=await call('Page.printToPDF',{printBackground:true});
    fs.writeFileSync(path.join(__dirname,'..','preview','purchase-review.pdf'),Buffer.from(purchasePdf.data,'base64'));
    await evaluate("document.getElementById('order-review-back').click()");
    await until("!document.getElementById('order-list-view').hidden");
    await viewport(390); await screenshot('order-list-mobile');
    await evaluate('window.__reloadPending = true'); await call('Page.reload'); await until('window.__reloadPending !== true && document.readyState === "complete"');
    await until("document.querySelectorAll('[data-worksheet]').length === 3");
    await evaluate("document.getElementById('nav-order-list').click()");
    await until("!document.getElementById('order-list-view').hidden && document.querySelector('[data-remove-list]')");
    assert.equal(await evaluate('orderList.items[0].quantity'),3,'Saved purchase details survive reload');
    await evaluate("(async()=>{const source=(await api('/api/inventories')).find(record=>record.worksheet==='janitorial' && record.status==='draft');const inventory=await api('/api/inventories/'+source.id);const item=inventory.items.find(item=>typeof inventory.counts[item.id]==='number' && inventory.counts[item.id]<=item.par);orderList=await api('/api/order-list',{method:'POST',body:JSON.stringify({revision:orderList.revision,inventoryId:inventory.id,inventoryRevision:inventory.revision,itemId:item.id})});renderOrderList()})()");
    await evaluate("const pick=orderList.items.find(entry=>entry.item.id==='s1-r7');document.querySelector('[data-order-select=\"'+pick.id+'\"]').click();document.getElementById('mark-selected-ordered').click()");
    await until("document.getElementById('ordered-dialog').open");
    await evaluate("document.getElementById('ordered-by').value='Buyer';document.getElementById('ordered-reference').value='HACH-123';document.getElementById('ordered-form').requestSubmit()");
    await until("!document.getElementById('ordered-dialog').open && orderList.orders.length===1 && !listBusy");
    assert.equal(await evaluate('orderList.items.length'),1,'Unselected purchases remain in the backlog');
    assert.ok(await evaluate("orderList.items.every(entry=>entry.item.id!=='s1-r7')"),'Only the selected purchase leaves the active list');
    assert.ok(await evaluate("document.getElementById('past-order-items').textContent.includes('HACH-123')"));
    await evaluate("document.getElementById('placed-orders-tab').click()");
    await until("!document.getElementById('order-history-view').hidden");
    assert.ok(await evaluate("document.getElementById('history-view').hidden && document.getElementById('order-list-view').hidden"),'Order History is separate from Inventory History and the backlog');
    for(const width of [320,390,430]) { await viewport(width); await checkWidth(); }
    await viewport(390);await screenshot('order-history-mobile');
    await evaluate("document.querySelector('[data-delete-order]').click()");
    await until("document.getElementById('delete-order-dialog').open");
    await evaluate("document.getElementById('cancel-delete-order').click()");
    assert.equal(await evaluate('orderList.orders.length'),1,'Cancel preserves order history');
    await evaluate("document.querySelector('[data-delete-order]').click();document.getElementById('confirm-delete-order').click()");
    await until("orderList.orders.length===0 && !listBusy");
    assert.equal(await evaluate('orderList.items.length'),1,'Deleting an order does not restore or remove backlog items');
    await evaluate("document.getElementById('nav-order-list').click()");
    await until("!document.getElementById('order-list-view').hidden");


    await evaluate("document.querySelector('[data-remove-list]').click()");
    await until("document.getElementById('remove-list-dialog').open");
    await evaluate("document.getElementById('cancel-remove-list').click()");
    assert.equal(await evaluate('orderList.items.length'),1,'Cancel preserves the list item');
    await evaluate("document.querySelector('[data-remove-list]').click();document.getElementById('confirm-remove-list').click()");
    await until("orderList.items.length === 0 && !listBusy");
    // Desktop workspace and phone detection, including wide phone landscape.
    const desktopAgent=await evaluate('navigator.userAgent');
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});
    await call('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('window.__reloadPending=true'); await evaluate('window.__reloadPending = true'); await call('Page.reload'); await until('window.__reloadPending !== true && document.readyState === "complete"');
    await until('window.__reloadPending !== true && document.querySelectorAll("[data-worksheet]").length === 3');
    assert.equal(await evaluate('document.documentElement.dataset.layout'),'desktop',JSON.stringify(await evaluate('({ua:navigator.userAgent,uaMobile:navigator.userAgentData?.mobile,touch:navigator.maxTouchPoints,width:innerWidth,screenWidth:screen.width,screenHeight:screen.height,phoneDevice})')));
    assert.ok(await evaluate('document.querySelector(".phone-app").getBoundingClientRect().width > 1200'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".worksheet-list")).gridTemplateColumns.split(" ").length'),2);
    await checkWidth(); await screenshot('home-desktop');
    await evaluate("document.querySelector('[data-worksheet=\"operating\"]').click()");
    await until("document.getElementById('new-dialog').open");
    assert.ok(await evaluate("(() => {const r=document.getElementById('new-dialog').getBoundingClientRect();return Math.abs(r.top+r.height/2-innerHeight/2)<2 && r.width===520})()"),'Desktop dialogs are centered');
    await evaluate("document.getElementById('cancel-new').click()");
    await start('operating',40);
    await evaluate("selectLocation('Under Stairwell')");
    await until("document.querySelector('.product-photo img').complete && document.querySelector('.product-photo img').naturalWidth > 0");
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".item-list")).gridTemplateColumns.split(" ").length'),3);
    await checkWidth(); await screenshot('inventory-desktop');
    await evaluate("var desktopInput=document.querySelector('[data-id]');desktopInput.focus();desktopInput.value='0';desktopInput.dispatchEvent(new Event('input',{bubbles:true}));desktopInput.blur()");
    await until("run.counts['s1-r6'] === 0 || document.getElementById('unusual-dialog').open");
    await evaluate("if(document.getElementById('unusual-dialog').open)document.getElementById('confirm-unusual').click()");
    await until("run.counts['s1-r6'] === 0 && !saving");
    await evaluate("renderOrderReport(run)");
    await until("!document.getElementById('order-report').hidden");
    await checkWidth(); await screenshot('report-desktop');
    await evaluate("(async()=>{run=await api('/api/inventories/'+run.id,{method:'PATCH',body:JSON.stringify({revision:run.revision,status:'complete',counts:Object.fromEntries(run.items.map(item=>[item.id,item.id==='s1-r6'?0:999]))})});await refreshOrderList()})()");
    await until("orderList.items.length === 1 && !listBusy");
    await evaluate("document.getElementById('nav-order-list').click()");
    await until("!document.getElementById('order-list-view').hidden");
    await checkWidth(); await screenshot('order-list-desktop');
    await evaluate("showMode('editor')");
    await call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
    await until('getComputedStyle(document.querySelector(".item-list")).gridTemplateColumns.split(" ").length === 2');
    await checkWidth();
    await call('Emulation.setDeviceMetricsOverride',{width:700,height:768,deviceScaleFactor:1,mobile:false});
    await until('document.documentElement.dataset.layout === "mobile"');
    await checkWidth();
    await call('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
    await viewport(1024,430);
    await evaluate('window.__reloadPending=true'); await evaluate('window.__reloadPending = true'); await call('Page.reload'); await until('window.__reloadPending !== true && document.readyState === "complete"');
    await until('window.__reloadPending !== true && document.querySelectorAll("[data-worksheet]").length === 3');
    assert.equal(await evaluate('document.documentElement.dataset.layout'),'mobile','A phone stays mobile even with a wide landscape viewport');
    assert.equal(await evaluate('document.querySelector(".phone-app").getBoundingClientRect().width'),1024,'Phone landscape retains mobile navigation with a full-width banner');
    await call('Emulation.setUserAgentOverride',{userAgent:desktopAgent});
    // The same picker adds above-PAR catalog items to the backlog or an existing order.
    await viewport(390);
    await evaluate("document.getElementById('nav-order-list').click()");
    await until("!document.getElementById('order-list-view').hidden");
    const pendingBeforeManual=await evaluate('orderList.items.length');
    await evaluate("document.getElementById('add-manual-item').click()");
    await until("document.getElementById('add-purchase-dialog').open");
    await evaluate("document.getElementById('purchase-search').value='2770220';document.getElementById('purchase-search').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('purchase-item').value='s1-r8';document.getElementById('purchase-item').dispatchEvent(new Event('change'));document.getElementById('purchase-quantity').value='2';document.getElementById('purchase-notes').value='Order early';document.getElementById('add-purchase-form').requestSubmit()");
    await until("!document.getElementById('add-purchase-dialog').open && !listBusy");
    assert.equal(await evaluate('orderList.items.length'),pendingBeforeManual+1,'Manual additions are independent of PAR');
    assert.ok(await evaluate("orderList.items.some(entry=>entry.item.id==='s1-r8' && entry.source==='manual' && entry.quantity===2)"));
    await evaluate("selectedOrders.clear();renderOrderList();var pick=orderList.items.find(entry=>entry.item.id==='s1-r8');document.querySelector('[data-order-select=\"'+pick.id+'\"]').click();document.getElementById('mark-selected-ordered').click()");
    await until("document.getElementById('ordered-dialog').open");
    await evaluate("document.getElementById('ordered-by').value='Browser buyer';document.getElementById('ordered-reference').value='MANUAL-TEST';document.getElementById('ordered-form').requestSubmit()");
    await until("!document.getElementById('ordered-dialog').open && !listBusy");
    await evaluate("document.getElementById('placed-orders-tab').click()");
    await until("!document.getElementById('order-history-view').hidden");
    await evaluate("document.querySelector('[data-add-history-item]').click()");
    await until("document.getElementById('add-purchase-dialog').open");
    assert.ok(await evaluate("document.getElementById('purchase-quantity').required"),'Recorded order additions require a purchase quantity');
    await evaluate("document.getElementById('purchase-search').value='BDH5050';document.getElementById('purchase-search').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('purchase-item').value='s1-r9';document.getElementById('purchase-item').dispatchEvent(new Event('change'));document.getElementById('purchase-quantity').value='1';document.getElementById('purchase-notes').value='Missing original line item'");
    await screenshot('add-item-to-order-mobile');
    await evaluate("document.getElementById('add-purchase-form').requestSubmit()");
    await until("!document.getElementById('add-purchase-dialog').open && !listBusy");
    assert.equal(await evaluate('orderList.orders[0].items.length'),2);
    assert.equal(await evaluate('orderList.items.length'),pendingBeforeManual,'Adding to recorded history does not change the active backlog');
    await evaluate("notifySuccess('Saved for notification check')");
    assert.equal(await evaluate("document.getElementById('notice').dataset.kind"),'success');
    await until("document.getElementById('notice').hidden");
    await evaluate("notifySuccess('Earlier success');notify('Save failed. Retry needed.');window.noticeTestWait=new Promise(resolve=>setTimeout(resolve,5200))");
    await evaluate('window.noticeTestWait');
    assert.ok(await evaluate("!document.getElementById('notice').hidden && document.getElementById('notice').textContent.includes('Save failed')"),'A success timer must not dismiss a newer error');
    await evaluate("document.querySelector('.dismiss-notice').click()");
    assert.ok(await evaluate("document.getElementById('notice').hidden"),'Notification can be dismissed manually');
    // Latest completion is specific to each worksheet, independent of drafts.
    await evaluate("window.originalRecords=records;records=[{worksheet:'operating',status:'complete',date:'2026-10-10',updatedAt:'2026-10-10T12:00:00Z'},{worksheet:'operating',status:'complete',date:'2026-10-14',updatedAt:'2026-10-14T12:00:00Z'},{worksheet:'operating',status:'draft',date:'2026-10-15',updatedAt:'2026-10-15T12:00:00Z'},{worksheet:'janitorial',status:'complete',date:'2026-10-11',updatedAt:'2026-10-11T12:00:00Z'}];renderHome()");
    assert.equal(await evaluate("document.querySelector('[data-worksheet=\"operating\"] time').dateTime"),'2026-10-14');
    assert.equal(await evaluate("document.querySelector('[data-worksheet=\"janitorial\"] time').dateTime"),'2026-10-11');
    assert.equal(await evaluate("document.querySelector('[data-worksheet=\"dewatering\"] .worksheet-last-count').textContent"),'No completed inventory yet');
    await evaluate('window.originalChemicalRecords=chemicalRecords;chemicalRecords=[{date:"2026-10-16",status:"draft",operator:"Test Operator",counted:3,total:16,updatedAt:"2026-10-16T12:00:00Z"}];showMode("home");renderHome()');
    for(const width of [390,1366]){
      await viewport(width);await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert.equal(await evaluate('document.querySelectorAll("#history-list .history-card").length'),4,'Recent inventories shows four cards');
      assert.ok(await evaluate('(()=>{const cards=[...document.querySelectorAll("#history-list .history-card")],heights=cards.map(card=>card.getBoundingClientRect().height),widths=cards.map(card=>card.getBoundingClientRect().width);return Math.max(...heights)-Math.min(...heights)<1&&Math.max(...widths)-Math.min(...widths)<1})()'),'Mixed chemical/supply recent cards have equal dimensions at '+width);
      assert.ok(await evaluate('!!document.querySelector("#history-list [data-chemical-resume]")'),'Unfinished chemical inventory remains in the recent cards');
      assert.ok(await evaluate('(()=>{const cards=[...document.querySelectorAll("#history-list .history-card")];return cards.every(card=>card.querySelector(".history-order-summary")&&card.querySelector(".report-button")&&card.querySelectorAll(".history-controls button").length===3)})()'),'Chemical and supply cards share status, action and report slots');
      assert.ok(await evaluate('document.querySelector("[data-inventory-type=chemical] .report-button").textContent.includes("Draft")'),'An incomplete chemical inventory does not claim no order is needed');
    }
    await evaluate('chemicalRecords.push({...chemicalRecords[0],date:"2026-01-08",status:"complete",updatedAt:"2030-01-01T12:00:00Z",source:{type:"workbook"}});showMode("history")');
    assert.ok(await evaluate('(()=>{const rows=[...document.querySelectorAll("#history-list .history-card p")];return ["2026-10-16","2026-10-15","2026-10-14","2026-10-11","2026-10-10","2026-01-08"].every((date,i)=>rows[i].textContent.includes(prettyDate(date)))})()'),'History sorts by inventory date even when old workbook entries were imported later');
    assert.equal(await evaluate('document.getElementById("history-title").textContent'),'Inventory History');
    for(const [type,count]of [['chemical',2],['operating',3],['janitorial',1],['dewatering',0]]){
      await evaluate('document.getElementById("history-type").value='+JSON.stringify(type)+';document.getElementById("history-type").dispatchEvent(new Event("change"))');
      assert.equal(await evaluate('document.querySelectorAll("#history-list .history-card").length'),count,'History filters '+type);
      await evaluate('renderHistory()');
      assert.equal(await evaluate('document.getElementById("history-type").value'),type,'Refresh preserves the selected type');
    }
    assert.ok(await evaluate('document.querySelector("#history-list .empty").textContent.includes("this inventory type")'),'Empty filter explains that there are no matching inventories');
    await evaluate('showMode("home")');
    assert.ok(await evaluate('document.getElementById("history-filters").hidden&&document.querySelectorAll("#history-list .history-card").length===4'),'Home recent cards include all types regardless of the history filter');
    await evaluate('showMode("history");document.getElementById("history-type").value="all";document.getElementById("history-type").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("#history-list .history-card").length'),6,'All Inventory Types restores the full history');
    await evaluate('records=window.originalRecords;chemicalRecords=window.originalChemicalRecords;renderHistory();renderHome()');
    await evaluate('showMode("history");window.correctionId=records.find(record=>record.status==="complete").id;[...document.querySelectorAll("[data-edit]")].find(button=>button.dataset.edit===window.correctionId).click()');
    await until('!document.getElementById("workspace").hidden&&!navigating');
    assert.ok(await evaluate('!document.querySelector("[data-id]").disabled'),'Edit opens completed supply counts for correction');
    await evaluate('window.correctionItem=document.querySelector("[data-id]").dataset.id;const field=document.querySelector("[data-id]");field.value="1.25";field.dispatchEvent(new Event("input",{bubbles:true}));approvedCounts.set(window.correctionItem,1.25);field.blur()');
    await until('document.getElementById("save-status").textContent==="All changes saved"');
    assert.ok(await evaluate('run.status==="complete"&&run.counts[window.correctionItem]===1.25'),'Corrected supply inventory remains completed');
    await evaluate('document.getElementById("nav-history").click()');await until('!document.getElementById("history-view").hidden');
    await evaluate('[...document.querySelectorAll("[data-open]")].find(button=>button.dataset.open===window.correctionId).click()');
    await until('!document.getElementById("workspace").hidden&&!navigating');
    assert.ok(await evaluate('document.querySelector("[data-id]").disabled'),'View keeps completed supply inventories read-only');
    assert.equal(errors.length,0,'No browser runtime exceptions');
    console.log('Browser checks passed: mobile 320/390/430px, desktop 1024/1366px, narrow-window adaptation, phone landscape detection, inventory and order-list workflows.');
  } finally {
    if (socket) socket.close();
    chrome.kill();
    await new Promise(resolve => server.close(resolve));
    // Chrome may need time to release its temporary profile on Windows.
    await new Promise(resolve => setTimeout(resolve,500));
    try {
      fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    } catch (error) {
      // A lingering Chrome process can lock its profile; preserve any test failure.
      if (!['EPERM','EBUSY'].includes(error.code)) throw error;
      console.warn('Chrome still has the temporary browser profile locked; cleanup skipped.');
    }
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
