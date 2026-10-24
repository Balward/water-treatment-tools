// Shared infrastructure for local browser checks. App-specific assertions live in each check.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const legacyHome = '<html><head><title>Cached Legacy Home</title><link rel="stylesheet" href="/dashboard.css"></head><body><nav class="global-nav">Treatment Operations &amp; Training Portal</nav><a class="app-button" href="/robojar-analyzer/">RoboJar Analyzer</a></body></html>';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

async function removeTemporaryDirectory(directory) {
  const target = path.resolve(directory);
  const relative = path.relative(os.tmpdir(), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Refusing to remove a directory outside the temporary workspace: ' + target);
  }
  await fs.promises.rm(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

async function launchBrowser({ acceptDialogs = false, userGesture = false } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-browser-check-'));
  const chromePath = process.env.CHROME_PATH || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket, session, closed = false, nextId = 0;
  const pending = new Map(), errors = [];
  const exit = new Promise(resolve => {
    chrome.once('exit', resolve);
    chrome.once('error', resolve);
  });
  async function close() {
    if (closed) return;
    closed = true;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Browser check closed'));
    }
    pending.clear();
    // Ask Chrome to shut down its children before removing the profile.
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: ++nextId, method: 'Browser.close' }));
      socket.close();
    } else chrome.kill();
    let timer;
    await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => { chrome.kill(); resolve(); }, 5000); })]);
    clearTimeout(timer);
    await removeTemporaryDirectory(profile);
  }
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Chrome startup timed out; set CHROME_PATH if Chrome is not installed at the default location.')), 20000);
      const fail = error => { clearTimeout(timer); reject(error); };
      chrome.once('error', fail);
      chrome.once('exit', code => fail(new Error('Chrome exited during startup: ' + code)));
      chrome.stderr.on('data', chunk => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (acceptDialogs && message.method === 'Page.javascriptDialogOpening') {
        socket.send(JSON.stringify({ id: ++nextId, method: 'Page.handleJavaScriptDialog', params: { accept: true }, sessionId: session }));
      }
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('DevTools timed out: ' + method)); }, 45000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
    });
    const target = await call('Target.createTarget', { url: 'about:blank' });
    session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
    await call('Page.enable');
    await call('Runtime.enable');
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    return { call, evaluate, errors, profile, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function createBrowserCheck({ port = 8782, serveLegacyHome = false } = {}) {
  const context = { root, serveLegacyHome };
  const server = http.createServer((request, response) => {
    let pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/' && context.serveLegacyHome) {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=31536000, immutable' });
      response.end(legacyHome);
      return;
    }
    if (pathname === '/dashboard.css') pathname = '/apps/dashboard/dashboard.css';
    if (pathname === '/' || pathname === '/dashboard/') pathname = '/apps/dashboard/dashboard.html';
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(pathname)); }
    catch { response.writeHead(400); response.end(); return; }
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      response.writeHead(403); response.end(); return;
    }
    fs.readFile(file, (error, body) => {
      response.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      response.end(error ? 'Not found' : body);
    });
  });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    browser = await launchBrowser();
    Object.assign(context, browser);
    const cleanups = [];
    context.addCleanup = cleanup => cleanups.push(cleanup);
    context.close = async () => {
      try {
        await browser.close();
      } finally {
        try { for (const cleanup of cleanups.reverse()) await cleanup(); }
        finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      }
    };
    return context;
  } catch (error) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    throw error;
  }
}

module.exports = { createBrowserCheck, launchBrowser, removeTemporaryDirectory };
