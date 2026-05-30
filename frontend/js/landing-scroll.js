/* ═══════════════════════════════════════════════════════
   Landing — Background parallax on scroll
   ═══════════════════════════════════════════════════════ */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function initAtmosphericScroll() {
  const landing = document.getElementById('landing-view');
  const hero = document.getElementById('hero-section');

  if (!landing || !hero) return () => {};

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  document.body.classList.add('landing-scroll-active');

  let running = true;
  let lastScrollY = window.scrollY;
  let smoothScroll = lastScrollY;
  let velocity = 0;
  let drift = 0;
  let rafId = 0;

  const setVar = (name, value) => {
    document.documentElement.style.setProperty(name, String(value));
  };

  const tick = () => {
    if (!running) return;

    const scrollY = window.scrollY;
    const rawVelocity = scrollY - lastScrollY;
    lastScrollY = scrollY;

    smoothScroll = lerp(smoothScroll, scrollY, 0.075);
    velocity = lerp(velocity, rawVelocity, 0.08);

    const heroHeight = hero.offsetHeight || window.innerHeight;
    const progress = clamp(smoothScroll / heroHeight, 0, 1);
    const driftTarget = clamp(velocity / 45, -1, 1);
    drift = lerp(drift, driftTarget, 0.1);

    setVar('--landing-scroll-progress', progress.toFixed(4));
    setVar('--landing-scroll-drift', drift.toFixed(4));

    rafId = requestAnimationFrame(tick);
  };

  const destroy = () => {
    running = false;
    cancelAnimationFrame(rafId);
    document.body.classList.remove('landing-scroll-active');
    window.removeEventListener('landing-scroll-destroy', destroy);
    document.documentElement.style.removeProperty('--landing-scroll-progress');
    document.documentElement.style.removeProperty('--landing-scroll-drift');
  };

  window.addEventListener('landing-scroll-destroy', destroy);
  rafId = requestAnimationFrame(tick);

  return destroy;
}
