/* ═══════════════════════════════════════════════════════
   Landing Page — Hero animations + Login logic
   ═══════════════════════════════════════════════════════ */

import { initScrollAnimations, createParticles, showToast } from './animations.js';
import { initAtmosphericScroll } from './landing-scroll.js';
import { api, setAuthSession } from './api.js';

let destroyScroll = null;
let landingUiReady = false;
let onLoginSuccessCallback = null;
let loginFormHandler = null;
let signupFormHandler = null;

const PORTAL_LOGIN_ROLES = new Set(['hr', 'master']);

export function resetLoginButton() {
  const loginBtn = document.getElementById('login-btn');
  if (!loginBtn) return;
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
  loginBtn.textContent = loginBtn.dataset.label || 'Sign In';
  loginBtn.style.background = '';
}

function setLoginButtonLoading(isLoading) {
  const loginBtn = document.getElementById('login-btn');
  if (!loginBtn) return;
  if (isLoading) {
    if (!loginBtn.dataset.label) {
      loginBtn.dataset.label = loginBtn.textContent.trim() || 'Sign In';
    }
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    loginBtn.textContent = '';
    loginBtn.style.background = '';
    return;
  }
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
}

function portalRoleAllowed(role) {
  return PORTAL_LOGIN_ROLES.has(String(role || '').toLowerCase());
}

function startAtmosphericScroll() {
  destroyScroll?.();
  destroyScroll = initAtmosphericScroll();
}

export function restartLandingScroll() {
  startAtmosphericScroll();
}

/** Ensure the sign-in card is visible (avoids opacity:0 when user has not scrolled yet). */
export function revealLoginCard() {
  const card = document.querySelector('.login-card');
  if (card) card.classList.add('in-view');
}

function initMobileScrollIndicator() {
  const indicator = document.querySelector('.scroll-indicator');
  const loginSection = document.getElementById('login-section');
  const mq = window.matchMedia('(max-width: 768px)');
  if (!indicator || !loginSection) return;

  const sync = () => {
    if (!mq.matches) {
      indicator.classList.remove('is-hidden');
      return;
    }
    const loginTop = loginSection.getBoundingClientRect().top;
    const hide = loginTop < window.innerHeight * 0.88;
    indicator.classList.toggle('is-hidden', hide);
  };

  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  mq.addEventListener('change', sync);
  sync();
}

export function initLanding(onLoginSuccess) {
  onLoginSuccessCallback = onLoginSuccess;

  if (!landingUiReady) {
    landingUiReady = true;
    startAtmosphericScroll();
    initScrollAnimations();
    initMobileScrollIndicator();

    const particlesContainer = document.getElementById('login-particles');
    if (particlesContainer) {
      createParticles(particlesContainer, 25);
    }

    const ctaBtn = document.getElementById('hero-cta-btn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
        document.querySelector('.scroll-indicator')?.classList.add('is-hidden');
        setTimeout(() => {
          document.querySelector('.login-card')?.classList.add('in-view');
        }, 400);
      });
    }

    if (window.location.hash === '#login-section') {
      setTimeout(() => {
        document.querySelector('.login-card')?.classList.add('in-view');
      }, 100);
    }
  }

  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authMessage = document.getElementById('auth-message');
  const authTabs = Array.from(document.querySelectorAll('[data-auth-tab]'));
  const authPanels = Array.from(document.querySelectorAll('[data-auth-panel]'));

  const loginForm = document.getElementById('login-form');
  const loginRole = document.getElementById('login-role');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');

  const signupForm = document.getElementById('signup-form');
  const signupFullName = document.getElementById('signup-full-name');
  const signupEmail = document.getElementById('signup-email');
  const signupPhone = document.getElementById('signup-phone');
  const signupRole = document.getElementById('signup-role');
  const signupUsername = document.getElementById('signup-username');
  const signupPassword = document.getElementById('signup-password');
  const signupInviteToken = document.getElementById('signup-invite-token');
  const signupBtn = document.getElementById('signup-btn');
  const signupUsernameStatus = document.getElementById('signup-username-status');
  const profileHandlePreview = document.getElementById('profile-handle-preview');

  const state = {
    activeMode: 'login',
    usernameCheckTimer: null,
  };

  const modeCopy = {
    login: {
      title: 'Portal Access',
      subtitle: 'Sign in with your role-based profile',
    },
    signup: {
      title: 'Create Profile',
      subtitle: 'Register with a master admin invite key, then sign in',
    },
  };

  function setMessage(text = '', tone = 'neutral') {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.classList.remove('is-success', 'is-neutral');
    if (tone === 'success') {
      authMessage.classList.add('is-success');
    } else if (tone === 'neutral') {
      authMessage.classList.add('is-neutral');
    }
  }

  function setFieldStatus(el, text = '', tone = 'neutral') {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('is-error', 'is-success');
    if (tone === 'error') el.classList.add('is-error');
    if (tone === 'success') el.classList.add('is-success');
  }

  function setMode(mode, { clearMessage = true } = {}) {
    state.activeMode = mode;
    authTabs.forEach((tab) => {
      const active = tab.dataset.authTab === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    authPanels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.authPanel === mode);
    });
    if (authTitle) authTitle.textContent = modeCopy[mode]?.title || 'Portal Access';
    if (authSubtitle) authSubtitle.textContent = modeCopy[mode]?.subtitle || '';
    if (clearMessage) setMessage('', 'neutral');
  }

  function profileHandleFromSignup() {
    const role = signupRole?.value || 'hr';
    const username = (signupUsername?.value || '').trim().toLowerCase().replace(/\s+/g, '');
    return `admin.${role}.${username || 'username'}`;
  }

  function updateProfilePreview() {
    if (profileHandlePreview) {
      profileHandlePreview.textContent = profileHandleFromSignup();
    }
  }

  async function checkUsernameAvailability() {
    const role = signupRole?.value;
    const username = (signupUsername?.value || '').trim();

    if (!role || !username) {
      setFieldStatus(signupUsernameStatus, '', 'neutral');
      updateProfilePreview();
      return;
    }

    if (username.length < 3) {
      setFieldStatus(signupUsernameStatus, 'Username must be at least 3 characters.', 'error');
      updateProfilePreview();
      return;
    }

    clearTimeout(state.usernameCheckTimer);
    state.usernameCheckTimer = setTimeout(async () => {
      try {
        setFieldStatus(signupUsernameStatus, 'Checking availability...', 'neutral');
        const result = await api.checkUsername(role, username);
        if (result.available) {
          setFieldStatus(signupUsernameStatus, 'Username is available.', 'success');
        } else {
          setFieldStatus(signupUsernameStatus, 'Username is not available for this role.', 'error');
        }
      } catch (err) {
        setFieldStatus(signupUsernameStatus, err.message || 'Could not check username.', 'error');
      } finally {
        updateProfilePreview();
      }
    }, 300);
  }

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab || 'login'));
  });

  loginRole?.addEventListener('change', () => setMessage('', 'neutral'));
  signupRole?.addEventListener('change', () => {
    checkUsernameAvailability();
  });
  signupUsername?.addEventListener('input', checkUsernameAvailability);
  signupUsername?.addEventListener('blur', checkUsernameAvailability);
  signupUsername?.addEventListener('input', updateProfilePreview);
  signupRole?.addEventListener('change', updateProfilePreview);

  if (loginForm) {
    if (loginFormHandler) {
      loginForm.removeEventListener('submit', loginFormHandler);
    }

    loginFormHandler = async (e) => {
      e.preventDefault();
      setMessage('', 'neutral');

      const role = loginRole?.value || 'hr';
      const username = loginUsername?.value.trim() || '';
      const password = loginPassword?.value || '';

      if (!username || !password) {
        setMessage('Please enter your role, username, and password.', 'neutral');
        return;
      }

      if (!portalRoleAllowed(role)) {
        const blocked =
          'Only HR and Master accounts can use this portal. Select HR or Master as your role.';
        setMessage(blocked, 'neutral');
        showToast(blocked, 'error', 6000);
        return;
      }

      setLoginButtonLoading(true);
      let enteredDashboard = false;

      try {
        const result = await api.login({ login: username, role, password });
        if (!result?.access_token || !result?.user) {
          throw new Error('Sign-in response was incomplete. Try again.');
        }

        setAuthSession({ token: result.access_token, user: result.user });
        setLoginButtonLoading(false);
        if (loginBtn) {
          loginBtn.textContent = '✓ Welcome!';
          loginBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        }
        setMessage(`Signed in as ${result.user.profile_handle}`, 'success');
        await new Promise((r) => setTimeout(r, 450));

        if (onLoginSuccessCallback) {
          const allowed = await onLoginSuccessCallback(result);
          if (allowed !== true) {
            resetLoginButton();
            return;
          }
        } else {
          showToast('Portal UI failed to initialize. Refresh the page.', 'error', 8000);
          resetLoginButton();
          return;
        }
        enteredDashboard = true;
      } catch (err) {
        const message =
          err.name === 'AbortError'
            ? 'Request timed out. Is the backend running on port 8000?'
            : err.message || 'Invalid credentials.';
        setMessage(message, 'neutral');
        showToast(message, 'error', 6000);
        const card = document.querySelector('.login-card');
        if (card) {
          card.style.animation = 'shake 0.5s ease';
          setTimeout(() => {
            card.style.animation = '';
          }, 500);
        }
      } finally {
        if (!enteredDashboard) {
          resetLoginButton();
        }
      }
    };

    loginForm.addEventListener('submit', loginFormHandler);
  }

  if (signupForm) {
    if (signupFormHandler) {
      signupForm.removeEventListener('submit', signupFormHandler);
    }

    signupFormHandler = async (e) => {
      e.preventDefault();
      setMessage('', 'neutral');

      const payload = {
        full_name: signupFullName?.value.trim(),
        email: signupEmail?.value.trim(),
        phone_number: signupPhone?.value.trim() || null,
        role: signupRole?.value || 'hr',
        username: signupUsername?.value.trim(),
        password: signupPassword?.value.trim(),
        invite_token: signupInviteToken?.value.trim() || null,
      };

      if (!payload.full_name || !payload.email || !payload.username || !payload.password || !payload.invite_token) {
        setMessage('Please fill in all fields, including the invite key from your master admin.', 'neutral');
        return;
      }

      if (payload.password.length < 4) {
        setMessage('Password must be at least 4 characters.', 'neutral');
        return;
      }

      if (payload.username.length < 3) {
        setMessage('Username must be at least 3 characters.', 'neutral');
        return;
      }

      signupBtn.classList.add('loading');
      signupBtn.dataset.label = signupBtn.textContent;
      signupBtn.textContent = '';

      try {
        const result = await api.signup(payload);
        showToast(
          result.message || `Account ${result.profile_handle} created. Signing you in…`,
          'success',
          5000,
        );

        try {
          const loginResult = await api.login({
            login: payload.username,
            role: payload.role,
            password: payload.password,
          });
          setAuthSession({ token: loginResult.access_token, user: loginResult.user });
          if (onLoginSuccessCallback) {
            const allowed = await Promise.resolve(onLoginSuccessCallback(loginResult));
            if (allowed === false) {
              setMode('login', { clearMessage: false });
              setMessage('Account created but this role cannot access the portal.', 'neutral');
              return;
            }
          }
          return;
        } catch (loginErr) {
          if (loginUsername) loginUsername.value = payload.username;
          if (loginRole) loginRole.value = payload.role;
          if (loginPassword && signupPassword) loginPassword.value = signupPassword.value;
          setMode('login', { clearMessage: false });
          setMessage(
            loginErr.message || `Account ${result.profile_handle} created. Sign in below.`,
            'success',
          );
        }
      } catch (err) {
        const message = err.message || 'Signup failed.';
        setMessage(message, 'neutral');
        showToast(message, 'error', 6000);
      } finally {
        signupBtn.classList.remove('loading');
        signupBtn.textContent = signupBtn.dataset.label || 'Create Account';
        signupBtn.style.background = '';
      }
    };

    signupForm.addEventListener('submit', signupFormHandler);
  }

  setMode('login');
  updateProfilePreview();

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

  window.addEventListener('landing-scroll-destroy', () => {
    destroyScroll?.();
    destroyScroll = null;
  });

  return destroyScroll;
}