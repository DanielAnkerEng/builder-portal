// Scroll position is the state. No timers, animation queues, wheel handlers or storage.
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// Hold → move into the photograph → hold at full zoom → reveal the next scene.
export function zoomAt(phase, maximum = 1.35) {
  return 1 + (maximum - 1) * clamp((phase - .12) / .58);
}

// Narrow screens keep normal document scrolling; geometry never uses the scaled image.
export function mobilePhaseAt(top, viewport) {
  return viewport > 0 ? clamp((viewport * .8 - top) / (viewport * .68)) : 0;
}

export function sceneAt(progress) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const position = p * 3.7;
  const from = Math.min(3, Math.floor(position));
  const to = Math.min(3, from + 1);
  const mix = from === 3 ? 0 : Math.max(0, Math.min(1, (position - from - .78) / .22));
  return { from, to, mix, active: mix >= .5 ? to : from };
}

export function progressAt(top, height, viewport) {
  const distance = height - viewport;
  return distance > 0 ? Math.max(0, Math.min(1, -top / distance)) : 0;
}

export function installScenes(story, { window: win = window } = {}) {
  const track = story.querySelector('.scene-track');
  const scenes = [...story.querySelectorAll('[data-scene]')];
  const bars = [...story.querySelectorAll('.chapter-line i')];
  const count = story.querySelector('#chapterCount');
  const toggle = story.querySelector('#motionToggle');
  const media = win.matchMedia('(min-width: 900px) and (min-height: 640px)');
  const motion = win.matchMedia('(prefers-reduced-motion: no-preference)');
  let calm = false;
  let ready = false;
  let photosReady = false;
  let queued = false;
  let pinned = false;
  let mobileZoom = false;
  const navigationType = win.performance?.getEntriesByType('navigation')[0]?.type;
  const restoringPosition = navigationType === 'reload' || navigationType === 'back_forward';

  function prepare(index) {
    const image = scenes[index]?.querySelector('img[data-full-srcset]');
    if (!image || image.hasAttribute('srcset')) return;
    // Reserve source resolution for magnification, not just the unscaled viewport.
    image.setAttribute('sizes', '(max-width: 899px) 118vw, 100vw');
    image.setAttribute('srcset', image.getAttribute('data-full-srcset'));
    image.setAttribute('loading', 'eager');
  }
  function paint() {
    queued = false;
    if (!pinned) {
      if (!mobileZoom) return;
      scenes.forEach((scene, index) => {
        const mediaBox = scene.querySelector('.demo-hero-media');
        if (!mediaBox || index === 3) return;
        const rect = mediaBox.getBoundingClientRect();
        scene.style.setProperty('--scene-zoom', String(zoomAt(mobilePhaseAt(rect.top, win.innerHeight), 1.18)));
        if (rect.top < win.innerHeight * 1.5 && rect.bottom > 0) prepare(index);
      });
      return;
    }
    const rect = track.getBoundingClientRect();
    const progress = progressAt(rect.top, rect.height, win.innerHeight);
    const state = sceneAt(progress);
    scenes.forEach((scene, index) => {
      const visible = index === state.from || (state.mix > 0 && index === state.to);
      scene.classList.toggle('is-visible', visible);
      scene.classList.toggle('is-caption', index === state.active);
      scene.style.zIndex = index === state.to && state.mix > 0 ? '2' : '1';
      scene.style.setProperty('--mask', `${index === state.to && state.mix > 0 ? (1 - state.mix) * 100 : 0}%`);
      scene.style.setProperty('--scene-zoom', String(index < 3 ? zoomAt(progress * 3.7 - index) : 1));
      scene.setAttribute('aria-hidden', String(index !== state.active));
      scene.inert = index !== state.active;
    });
    count.textContent = `0${state.active + 1} / 04`;
    bars.forEach((bar, index) => bar.classList.toggle('is-current', index === state.active));
    if (rect.top < win.innerHeight * 1.5 && rect.bottom > 0) {
      prepare(state.active);
      prepare(Math.min(3, state.active + 1));
    }
  }
  function schedule() {
    if (!queued && (pinned || mobileZoom)) { queued = true; win.requestAnimationFrame(paint); }
  }
  function configure() {
    const animated = photosReady && motion.matches && !calm;
    pinned = ready && media.matches && animated;
    mobileZoom = !media.matches && animated;
    story.classList.toggle('is-scroll', pinned);
    story.classList.toggle('is-photo-zoom', pinned || mobileZoom);
    scenes.forEach(scene => scene.style.setProperty('--scene-zoom', '1'));
    if (!pinned) {
      scenes.forEach(scene => { scene.removeAttribute('aria-hidden'); scene.inert = false; });
    }
    schedule();
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    // Keep the control at the same viewport position when collapsing the long track.
    const before = toggle.getBoundingClientRect().top;
    calm = !calm;
    toggle.setAttribute('aria-pressed', String(calm));
    configure();
    win.scrollBy({ top: toggle.getBoundingClientRect().top - before, behavior: 'instant' });
  });
  media.addEventListener('change', configure);
  motion.addEventListener('change', configure);
  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  // Prime only the compact scene photographs. Higher-resolution assets are prepared
  // one scene ahead. Keep the stacked fallback if images fail or arrive after entry.
  const images = [...story.querySelectorAll('[data-scene-demo] .demo-hero img')];
  images.forEach(image => image.setAttribute('loading', 'eager'));
  Promise.all(images.map(image => image.decode())).then(() => {
    photosReady = true;
    ready = restoringPosition || track.getBoundingClientRect().top > win.innerHeight * .5;
    configure();
  }).catch(() => { photosReady = false; ready = false; configure(); });
  configure();
}
