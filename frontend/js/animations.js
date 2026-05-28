/* ═══════════════════════════════════════════════════════
   Animation Utilities
   ═══════════════════════════════════════════════════════ */

/**
 * IntersectionObserver for scroll-triggered animations
 */
export function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px 50px 0px',
    }
  );

  document.querySelectorAll('.anim-fade-up, .login-card').forEach((el) => {
    observer.observe(el);
  });

  const loginCard = document.querySelector('.login-card');
  if (loginCard) {
    const rect = loginCard.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      loginCard.classList.add('in-view');
    }
  }

  return observer;
}

/**
 * Observe progress bars and animate width on entry
 */
export function initProgressBars(root = document) {
  const bars = root.querySelectorAll('.progress-bar-fill[data-width]');
  if (!bars.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const targetWidth = el.getAttribute('data-width');
        requestAnimationFrame(() => {
          el.style.width = targetWidth;
          setTimeout(() => el.classList.add('shimmer-active'), 1000);
        });
        observer.unobserve(el);
      });
    },
    { threshold: 0.1 }
  );

  bars.forEach((bar) => observer.observe(bar));
}

/**
 * Create floating particles with varied size, drift, and gold/teal colors
 */
export function createParticles(container, count = 30) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    const isGold = i % 2 === 0;
    particle.className = `particle ${isGold ? 'particle-gold' : 'particle-teal'}`;
    const size = 1 + Math.random() * 2;
    const drift = `${-30 + Math.random() * 60}px`;
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.setProperty('--drift', drift);
    particle.style.animationDuration = `${10 + Math.random() * 14}s`;
    particle.style.animationDelay = `${Math.random() * 10}s`;
    particle.style.opacity = `${0.15 + Math.random() * 0.35}`;
    container.appendChild(particle);
  }
}

/**
 * Staggered counter animation (requestAnimationFrame + ease-out)
 */
export function animateCounter(element, target, duration = 800) {
  if (!element) return;

  const start = 0;
  const startTime = performance.now();
  const numericTarget = Number(target) || 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (numericTarget - start) * eased);
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = numericTarget.toLocaleString();
    }
  }

  requestAnimationFrame(update);
}

/**
 * Smooth page transition between views
 */
export function fadeTransition(hideEl, showEl, duration = 400) {
  return new Promise((resolve) => {
    if (hideEl) {
      hideEl.style.transition = `opacity ${duration / 2}ms var(--ease-smooth)`;
      hideEl.style.opacity = '0';
    }

    setTimeout(() => {
      if (hideEl) {
        hideEl.classList.remove('active', 'visible');
        hideEl.style.opacity = '';
        hideEl.style.transition = '';
      }

      if (showEl) {
        showEl.classList.add('active');
        showEl.offsetHeight;
        showEl.classList.add('visible');
      }

      resolve();
    }, hideEl ? duration / 2 : 0);
  });
}

/**
 * Animate page title on navigation
 */
export function animatePageTitle(titleEl) {
  if (!titleEl) return;
  titleEl.classList.remove('title-animate');
  titleEl.offsetHeight;
  titleEl.classList.add('title-animate');
}

const toastContainer = (() => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
})();

/**
 * Toast notification system with progress bar
 */
export function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    info: '💬',
    success: '✓',
    error: '✕',
  };

  toast.innerHTML = `
    <span style="font-size: 16px; flex-shrink: 0;">${icons[type] || icons.info}</span>
    <span style="flex: 1;">${message}</span>
    <button class="toast-close" type="button" aria-label="Dismiss">✕</button>
    <div class="toast-progress" aria-hidden="true">
      <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
    </div>
  `;

  const dismiss = () => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  };

  toast.querySelector('.toast-close')?.addEventListener('click', dismiss);
  toastContainer.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return toast;
}

/**
 * Ripple effect on buttons from click position
 */
export function initButtonRipples() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn, .login-btn, .sidebar-link, .row-actions button');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    btn.style.setProperty('--mouse-x', `${x}%`);
    btn.style.setProperty('--mouse-y', `${y}%`);
  });
}
