const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../apps/live-operations-dashboard/tv-refresh.js'), 'utf8');
const board = 'https://example.test/live-operations-dashboard/';

function start(query) {
  const timers = [];
  const requests = [];
  const reloads = [];
  const location = {
    href: board + query + '#equipment',
    search: query,
    reload() { reloads.push(this.href); },
  };

  class Request {
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(name, value) { this[name] = value; }
    getResponseHeader() { return 'text/html; charset=utf-8'; }
    send() { requests.push(this); }
  }

  vm.runInNewContext(script, {
    URL,
    URLSearchParams,
    location,
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    XMLHttpRequest: Request,
  });
  return { timers, requests, reloads };
}

test('the editable board never schedules a reload', () => {
  assert.equal(start('').timers.length, 0);
});

test('TV Mode checks the page after 15 minutes and reloads the current URL', () => {
  const query = '?mode=TV&header=hidden';
  const { timers, requests, reloads } = start(query);
  assert.equal(timers[0].delay, 15 * 60 * 1000);
  timers.shift().callback();
  const [request] = requests;
  assert.equal(request.method, 'HEAD');
  assert.equal(request.url, board + query);
  assert.equal(request['Cache-Control'], 'no-cache');
  request.responseURL = request.url;
  request.status = 200;
  request.onload();
  assert.deepEqual(reloads, [board + query + '#equipment']);
});

test('TV Mode keeps the page open and retries after timeout, HTTP error, or redirect', () => {
  const { timers, requests, reloads } = start('?mode=tv');
  timers.shift().callback();
  requests[0].ontimeout();
  assert.equal(timers[0].delay, 60 * 1000);
  timers.shift().callback();
  requests[1].responseURL = requests[1].url;
  requests[1].status = 503;
  requests[1].onload();
  assert.equal(timers[0].delay, 60 * 1000);
  timers.shift().callback();
  requests[2].responseURL = 'https://example.test/unavailable';
  requests[2].status = 200;
  requests[2].onload();
  assert.equal(timers[0].delay, 60 * 1000);
  assert.equal(reloads.length, 0);
  timers.shift().callback();
  requests[3].responseURL = requests[3].url;
  requests[3].status = 200;
  requests[3].onload();
  assert.equal(reloads.length, 1);
});
