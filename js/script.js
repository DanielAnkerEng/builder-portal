import { resolveDemo } from './demo-data.mjs';
import { renderDemo } from './demo-renderer.mjs';
import { installScenes } from './marketing-scenes.mjs';

for (const root of document.querySelectorAll('[data-scene-demo], [data-tile]')) {
  const demo = resolveDemo(root.dataset.sceneDemo || root.dataset.tile);
  renderDemo(root, demo, { preview: true, imageMode: 'compact', previewContent: root.classList.contains('responsive-demo') });
}
// Exhibition tiles are scaled desktop compositions, not a separate mock design.
const tiles = [...document.querySelectorAll('[data-tile]')];
function sizeTiles() {
  tiles.forEach(tile => tile.style.setProperty('--tile-scale', String(tile.clientWidth / 1000)));
}
sizeTiles();
if ('ResizeObserver' in window) {
  const sizes = new ResizeObserver(sizeTiles);
  tiles.forEach(tile => sizes.observe(tile));
} else {
  window.addEventListener('resize', sizeTiles, { passive: true });
}
installScenes(document.getElementById('utstillingen'));

const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('mainNav');
toggle.hidden = false;
document.body.classList.add('has-public-js');
function closeMenu() {
  toggle.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
});
nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeMenu(); toggle.focus(); }
});
