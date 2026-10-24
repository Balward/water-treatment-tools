(() => {
  const links = [...document.querySelectorAll('.sidebar a[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  function updateSection() {
    const offset = document.querySelector('.site-header').getBoundingClientRect().height + 48;
    const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const current = atBottom ? sections.at(-1) : sections.filter(section => section.getBoundingClientRect().top <= offset).at(-1) || sections[0];
    links.forEach((link, index) => {
      if (sections[index] === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', updateSection, { passive: true });
  window.addEventListener('resize', updateSection);
  updateSection();
  const result = document.getElementById('primaryDryAlum');
  const reflectEmptyResult = () => result.closest('.alum-strength-callout').classList.toggle('is-empty', result.textContent === '--');
  new MutationObserver(reflectEmptyResult).observe(result, { childList: true, characterData: true, subtree: true });
  reflectEmptyResult();
  // The banner's home destination follows the shared catalog in production and previews.
  if (window.Operations) document.querySelector('.site-header .brand').href = window.Operations.homeHref;
})();
