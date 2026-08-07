(() => {
  const header = document.querySelector('header');
  if (!header) return;
  const navRow = header.querySelector('.nav');
  if (!navRow) return;
  const menu = navRow.querySelector('nav') || navRow.querySelector('.links');
  if (!menu) return;
  menu.classList.add('site-nav-target');
  const button = document.createElement('button');
  button.className = 'site-menu-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open navigation menu');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span></span>';
  const actions = navRow.querySelector('.nav-actions');
  if (actions) navRow.insertBefore(button, actions);
  else navRow.appendChild(button);
  const close = () => { menu.classList.remove('site-nav-open'); button.setAttribute('aria-expanded','false'); button.setAttribute('aria-label','Open navigation menu'); };
  button.addEventListener('click', () => {
    const open = menu.classList.toggle('site-nav-open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  });
  menu.addEventListener('click', (event) => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
})();
