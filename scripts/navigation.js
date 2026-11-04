const header = document.querySelector('header');
const navigationLinks = [...document.querySelectorAll('nav a[href^="#"]')];
const navigationTargets = navigationLinks.map(link => ({
  link,
  target: document.querySelector(link.getAttribute('href'))
}));
let selectedTarget;

function highlightNavigation(id) {
  if (id === 'enquiry') id = 'contact';
  for (const { link, target } of navigationTargets) {
    if (target.id === id) {
      const changed = !link.hasAttribute('aria-current');
      link.setAttribute('aria-current', 'location');
      if (changed) {
        const nav = link.parentElement;
        const bounds = link.getBoundingClientRect();
        const viewport = nav.getBoundingClientRect();
        if (bounds.left < viewport.left) nav.scrollLeft += bounds.left - viewport.left;
        else if (bounds.right > viewport.right) nav.scrollLeft += bounds.right - viewport.right;
      }
    }
    else link.removeAttribute('aria-current');
  }
}

function updateNavigation() {
  const offset = header.getBoundingClientRect().height + 24;
  // Keep an explicitly chosen anchor active while it is visible, including
  // anchors near the page end that cannot reach the top of the viewport.
  if (selectedTarget) {
    const bounds = selectedTarget.getBoundingClientRect();
    if (bounds.top < window.innerHeight && bounds.bottom > offset) {
      highlightNavigation(selectedTarget.id);
      return;
    }
    selectedTarget = null;
  }
  let current = 'home';
  for (const { target } of navigationTargets) {
    if (target.getBoundingClientRect().top <= offset) {
      current = target.id;
    }
  }
  if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    current = 'contact';
  }
  highlightNavigation(current);
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  selectedTarget = document.getElementById(link.hash.slice(1));
  if (selectedTarget) highlightNavigation(selectedTarget.id);
});

function selectHash() {
  selectedTarget = document.getElementById(location.hash.slice(1));
  updateNavigation();
}

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
  updateNavigation();
}).observe(header);
window.addEventListener('scroll', updateNavigation, { passive: true });
for (const eventName of ['wheel', 'touchmove']) {
  window.addEventListener(eventName, () => { selectedTarget = null; }, { passive: true });
}
window.addEventListener('keydown', event => {
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)
      && !event.target.closest('input, select, textarea, button')) {
    selectedTarget = null;
  }
});
window.addEventListener('hashchange', selectHash);
selectHash();

// Re-align deep links after images load and the responsive header is measured.
window.addEventListener('load', () => {
  if (location.hash) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
    selectHash();
  }
});
