// Presentation only. Workbook import, filters, calculations and charts use ../script.js unchanged.
(() => {
  if (window.Chart) {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = '#576b77';
  }
  const links = [...document.querySelectorAll('.sidebar a')];
  const sections = links.map(link => document.querySelector(link.hash));
  const sync = () => {
    const offset = document.querySelector('.site-header').offsetHeight + 48;
    const active = sections.filter(section => section.getBoundingClientRect().top <= offset).at(-1) || sections[0];
    links.forEach((link, index) => {
      if (sections[index] === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();
})();
