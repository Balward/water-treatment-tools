(() => {
  const mode = new URLSearchParams(location.search).get('mode');
  if (!mode || mode.toLowerCase() !== 'tv') return;

  const refreshInterval = 15 * 60 * 1000;
  const retryInterval = 60 * 1000;

  function checkPageAndReload() {
    const page = new URL(location.href);
    page.hash = '';
    const request = new XMLHttpRequest();
    request.open('HEAD', page.href);
    request.timeout = 10000;
    request.setRequestHeader('Cache-Control', 'no-cache');
    request.onload = () => {
      const isBoardPage = request.responseURL === page.href
        && /^text\/html\b/i.test(request.getResponseHeader('Content-Type') || '');
      if (request.status === 200 && isBoardPage) {
        location.reload();
      } else {
        retry();
      }
    };
    request.onerror = retry;
    request.ontimeout = retry;
    request.send();
  }

  function retry() {
    setTimeout(checkPageAndReload, retryInterval);
  }

  setTimeout(checkPageAndReload, refreshInterval);
})();
