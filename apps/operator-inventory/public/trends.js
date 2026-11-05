(() => {
  const $ = id => document.getElementById(id);
  let loaded = false, loading = false;
  async function loadChemicals() {
    if (loaded || loading) return;
    loading = true;
    $('trend-status').textContent = 'Loading chemical history…';
    $('reload-trend-chemicals').hidden = true;
    try {
      const response = await fetch('/api/chemicals', {cache:'no-store'});
      if (!response.ok) throw new Error('Could not load chemical history. Please try again.');
      const data = await response.json();
      ChemicalTrends.render(data.records);
      loaded = true;
    } catch (error) {
      $('trend-status').textContent = error.message;
      $('reload-trend-chemicals').hidden = false;
    } finally { loading = false; }
  }
  function select(view, focus = false) {
    const chemicals = view === 'chemicals';
    for (const name of ['supplies', 'chemicals']) {
      const selected = (name === 'chemicals') === chemicals;
      $(name + '-tab').setAttribute('aria-selected', String(selected));
      $(name + '-tab').tabIndex = selected ? 0 : -1;
      $(name + '-panel').hidden = !selected;
    }
    $('chemical-trends').hidden = !chemicals;
    const url = new URL(location.href);
    url.searchParams.set('view', chemicals ? 'chemicals' : 'supplies');
    history.replaceState(null, '', url);
    if (focus) $(chemicals ? 'chemicals-tab' : 'supplies-tab').focus();
    if (chemicals) loadChemicals();
  }
  for (const name of ['supplies', 'chemicals']) {
    $(name + '-tab').addEventListener('click', () => select(name));
    $(name + '-tab').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      select(event.key === 'Home' ? 'supplies' : event.key === 'End' ? 'chemicals' : name === 'supplies' ? 'chemicals' : 'supplies', true);
    });
  }
  $('reload-trend-chemicals').addEventListener('click', loadChemicals);
  document.addEventListener('chemical:open-inventory', event => {
    location.assign('./chemical-inventory.html?' + new URLSearchParams({date:event.detail.date, view:'report'}));
  });
  select(new URLSearchParams(location.search).get('view'));
})();
