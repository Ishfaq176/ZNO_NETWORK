const menu = document.getElementById('menu');
const links = document.getElementById('links');
function setMenu(open) {
  links.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  menu.textContent = open ? '✕' : '☰';
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('click', event => { if (!event.target.closest('.nav')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
});
matchMedia('(min-width:1201px)').addEventListener('change', () => setMenu(false));
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('show'); observer.unobserve(entry.target); }
  }), {threshold:0.05});
  document.querySelectorAll('.reveal').forEach(element => {
    const siblings = [...element.parentElement.children].filter(child => child.classList.contains('reveal'));
    element.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(element), 3) * 75}ms`);
    observer.observe(element);
  });
}
const navigation = document.querySelector('.nav');
const sectionLinks = [...links.querySelectorAll('a[href^="#"]')];
function updateActive() {
  navigation?.classList.toggle('scrolled', window.scrollY > 12);
  let active = null;
  sectionLinks.forEach(link => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section && section.getBoundingClientRect().top <= 160) active = link;
  });
  sectionLinks.forEach(link => {
    link.classList.toggle('active', link === active);
    if (link === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('scroll', updateActive, {passive:true});
updateActive();
const copy = document.getElementById('copy');
let copyTimer;
if (copy) {
  const status = document.getElementById('copied');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  copy.addEventListener('click', async () => {
    const address = document.getElementById('contract').textContent.trim();
    let success = false;
    try { await navigator.clipboard.writeText(address); success = true; }
    catch {
      const field = document.createElement('textarea');
      field.value = address;
      field.style.cssText = 'position:fixed;top:0;left:-9999px';
      document.body.appendChild(field);
      field.select();
      try { success = document.execCommand('copy'); } catch { success = false; }
      field.remove();
      copy.focus();
    }
    clearTimeout(copyTimer);
    status.textContent = success ? '✓ Address copied' : 'Copy unavailable. Please select and copy the address above.';
    status.style.display = 'block';
    copyTimer = setTimeout(() => { status.style.display = 'none'; }, success ? 2500 : 8000);
  });
}
