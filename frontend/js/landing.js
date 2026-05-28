/* ═══════════════════════════════════════════════════════
   Landing Page — Hero animations + Login logic
   ═══════════════════════════════════════════════════════ */

import { initScrollAnimations, createParticles, showToast } from './animations.js';

export function initLanding(onLoginSuccess) {
  // Init scroll animations for login card
  initScrollAnimations();

  // Create particles in login section
  const particlesContainer = document.getElementById('login-particles');
  if (particlesContainer) {
    createParticles(particlesContainer, 25);
  }

  // CTA button → scroll to login
  const ctaBtn = document.getElementById('hero-cta-btn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-section').scrollIntoView({
        behavior: 'smooth',
      });
      // Force show login card without waiting for observer
      setTimeout(() => {
        document.querySelector('.login-card')?.classList.add('in-view');
      }, 400);
    });
  }

  // If page loaded with #login-section in URL, show card immediately
  if (window.location.hash === '#login-section') {
    setTimeout(() => {
      document.querySelector('.login-card')?.classList.add('in-view');
    }, 100);
  }

  // Login form
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';

      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value.trim();

      if (!username || !password) {
        loginError.textContent = 'Please enter both username and password.';
        return;
      }

      // Animate button
      loginBtn.classList.add('loading');
      loginBtn.dataset.label = loginBtn.textContent;
      loginBtn.textContent = '';

      // Simulate brief delay for feel, then check credentials
      await new Promise((r) => setTimeout(r, 800));

      if (username === 'admin' && password === 'admin') {
        loginBtn.textContent = '✓ Welcome!';
        loginBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';

        // Brief success state
        await new Promise((r) => setTimeout(r, 600));

        // Store auth state
        sessionStorage.setItem('hr_portal_auth', 'true');

        // Trigger transition to dashboard
        if (onLoginSuccess) onLoginSuccess();
      } else {
        loginBtn.classList.remove('loading');
        loginBtn.textContent = loginBtn.dataset.label || 'Sign In';
        loginBtn.style.background = '';
        loginError.textContent = 'Invalid credentials. Use admin / admin';
        
        // Shake animation
        const card = document.querySelector('.login-card');
        card.style.animation = 'shake 0.5s ease';
        setTimeout(() => { card.style.animation = ''; }, 500);
      }
    });
  }

  // Add shake keyframe dynamically
  if (!document.getElementById('shake-keyframe')) {
    const style = document.createElement('style');
    style.id = 'shake-keyframe';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
  }
}
