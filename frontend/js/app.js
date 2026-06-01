/* ═══════════════════════════════════════════════════════
   App — Main SPA Router & Init
   ═══════════════════════════════════════════════════════ */

import { initLanding, resetLoginButton, restartLandingScroll, revealLoginCard } from './landing.js';
import { renderDashboardHome } from './dashboard.js';
import { renderAdminLogs } from './admin_logs.js';
import { renderStaffList, renderStaffForm, renderAttachments } from './staff.js';
import { renderIdCardsPage } from './id_cards.js';
import {
  showToast,
  animatePageTitle,
  initButtonRipples,
  showPageLoadingOverlay,
  hidePageLoadingOverlay,
  pageLoadDelay,
} from './animations.js';
import { initChat, closeChat } from './chat.js';
import { api, clearAuthSession, getAuthToken, getAuthUser, setAuthSession } from './api.js';

let currentPage = null;
let pageNavGeneration = 0;
/** Bumps when login/logout runs so in-flight api.me() cannot override the UI. */
let authBootstrapGeneration = 0;

function cancelPendingAuthBootstrap() {
  authBootstrapGeneration += 1;
}

let landingView = null;
let dashboardView = null;
let mainBody = null;
let pageTitle = null;

const NAV_PAGES = {
  'dashboard-home': { title: 'Dashboard', render: () => renderDashboardHome(mainBody) },
  'staff-list': { title: 'Staff Records', render: () => renderStaffList(mainBody) },
  'add-staff': { title: 'Add New Staff', render: () => renderStaffForm(mainBody) },
  'edit-staff': { title: 'Edit Staff', render: (params) => renderStaffForm(mainBody, params.staffId) },
  'attachments': { title: 'Document Vault', render: (params) => renderAttachments(mainBody, params.staffId, params.staffName, params.staffData) },
  'id-cards': { title: 'Generate ID Cards', render: () => renderIdCardsPage(mainBody) },
  'admin-logs': { title: 'Admin Logs', render: () => renderAdminLogs(mainBody) },
};

function isMasterRole(role) {
  return String(role || '').toLowerCase() === 'master';
}

function currentAuthRole() {
  const user = getAuthUser() || window.__currentUser;
  return user?.role;
}

function syncMasterNavigation(user) {
  const isMaster = isMasterRole(user?.role);
  document.querySelectorAll('.sidebar-master-only').forEach((link) => {
    link.hidden = !isMaster;
    link.classList.toggle('sidebar-link--hidden', !isMaster);
    link.setAttribute('aria-hidden', isMaster ? 'false' : 'true');
    if (!isMaster && link.classList.contains('active')) {
      link.classList.remove('active', 'sidebar-link-pulse');
    }
  });
}

function initHeaderClock() {
  const actions = document.querySelector('.main-header-actions');
  if (!actions || document.getElementById('header-clock')) return;

  const clock = document.createElement('span');
  clock.id = 'header-clock';
  clock.className = 'header-clock';
  clock.setAttribute('aria-live', 'polite');
  actions.insertBefore(clock, actions.firstChild);

  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  tick();
  setInterval(tick, 10000);
}

window._navigateTo = function navigateTo(pageKey, params = {}) {
  if (pageKey === 'admin-logs' && !isMasterRole(currentAuthRole())) {
    pageKey = 'dashboard-home';
  }

  const page = NAV_PAGES[pageKey];
  if (!page || !mainBody) return;

  const navGen = ++pageNavGeneration;
  currentPage = pageKey;

  if (pageTitle) {
    pageTitle.textContent = page.title;
    animatePageTitle(pageTitle);
  }

  const mainHeader = document.querySelector('.main-header');
  if (mainHeader) {
    mainHeader.style.display = pageKey === 'dashboard-home' ? 'none' : 'flex';
  }

  document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === pageKey);
  });

  // Slide active indicator
  const activeLink = document.querySelector('.sidebar-link.active');
  if (activeLink) {
    activeLink.classList.remove('sidebar-link-pulse');
    void activeLink.offsetWidth;
    activeLink.classList.add('sidebar-link-pulse');
  }

  closeChat();
  document.body.classList.remove('chat-open');

  showPageLoadingOverlay();
  mainBody.classList.remove('page-enter');
  mainBody.classList.add('page-exit');

  const loadStarted = Date.now();

  const finishNavigation = () => {
    if (navGen !== pageNavGeneration) return;
    hidePageLoadingOverlay();
    mainBody.classList.remove('is-page-loading', 'page-exit');
    mainBody.classList.add('page-enter');
    requestAnimationFrame(() => {
      mainBody.offsetHeight;
    });
  };

  const runRender = async () => {
    if (navGen !== pageNavGeneration) return;

    try {
      const renderResult = page.render(params);
      if (renderResult instanceof Promise) {
        await renderResult;
      }
      await pageLoadDelay(loadStarted);
    } catch (err) {
      console.error('Render error:', err);
      if (navGen !== pageNavGeneration) return;
      await pageLoadDelay(loadStarted);
      mainBody.innerHTML = `
        <div class="page-load-error glass-panel">
          <strong>Could not load this section</strong>
          <p>${err?.message || 'Something went wrong while loading the page.'}</p>
          <button type="button" class="btn btn-primary btn-sm" id="page-load-retry">Try again</button>
        </div>
      `;
      document.getElementById('page-load-retry')?.addEventListener('click', () => {
        window._navigateTo(pageKey, params);
      });
    }

    finishNavigation();
  };

  // Brief exit fade, then render (overlay stays on top the whole time)
  setTimeout(runRender, 120);
};

function showDashboard(user = null) {
  if (!landingView || !dashboardView) {
    console.error('Dashboard shell missing from the page.');
    showToast('Could not open the portal UI. Refresh the page.', 'error', 8000);
    return;
  }

  cancelPendingAuthBootstrap();
  window.dispatchEvent(new Event('landing-scroll-destroy'));
  if (user) {
    window.__currentUser = user;
  }
  syncMasterNavigation(user || getAuthUser() || window.__currentUser);

  document.body.classList.add('dashboard-active');
  landingView.style.pointerEvents = 'none';
  landingView.style.opacity = '0';
  landingView.style.display = 'none';

  dashboardView.classList.add('active', 'visible');
  window._navigateTo('dashboard-home');
}

function showLanding({ scrollToLogin = false } = {}) {
  cancelPendingAuthBootstrap();
  clearAuthSession();
  resetLoginButton();
  window.__currentUser = null;
  document.body.classList.remove('dashboard-active', 'sidebar-open', 'chat-open');
  dashboardView.classList.remove('visible', 'active');
  document.querySelectorAll('.sidebar-master-only').forEach((link) => {
    link.hidden = true;
  });

  if (landingView) {
    landingView.style.display = 'block';
    landingView.style.opacity = '1';
    landingView.removeAttribute('hidden');
  }

  revealLoginCard();

  const loginSection = document.getElementById('login-section');
  if (scrollToLogin && loginSection) {
    requestAnimationFrame(() => {
      loginSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setTimeout(() => restartLandingScroll(), 400);
}

document.addEventListener('DOMContentLoaded', () => {
  landingView = document.getElementById('landing-view');
  dashboardView = document.getElementById('dashboard-view');
  mainBody = document.getElementById('main-body');
  pageTitle = document.getElementById('page-title');

  if (!landingView || !dashboardView || !mainBody) {
    console.error('Portal shell elements missing from index.html');
    showToast('Portal failed to load. Refresh the page.', 'error', 10000);
    return;
  }

  initButtonRipples();
  initHeaderClock();
  initChat();

  const storedToken = getAuthToken();
  const storedUser = getAuthUser();

  function portalRoleAllowed(role) {
    const normalized = String(role || '').toLowerCase();
    return normalized === 'hr' || normalized === 'master';
  }

  const handleLoginSuccess = (result) => {
    try {
      if (!result?.user || !result?.access_token) return false;
      const authUser = result.user;
      const role = String(authUser.role || '').toLowerCase();
      if (!portalRoleAllowed(role)) {
        clearAuthSession();
        showToast('This account does not have access to the HR portal yet.', 'error', 6000);
        return false;
      }
      cancelPendingAuthBootstrap();
      setAuthSession({ token: result.access_token, user: { ...authUser, role } });
      syncMasterNavigation(authUser);
      showDashboard(authUser);
      return true;
    } catch (err) {
      console.error('Login handoff failed:', err);
      showToast(err.message || 'Could not open the dashboard.', 'error', 6000);
      return false;
    }
  };

  initLanding(handleLoginSuccess);

  if (storedToken) {
    const bootstrapGen = ++authBootstrapGeneration;
    api.me()
      .then((user) => {
        if (bootstrapGen !== authBootstrapGeneration) return;
        const role = String(user.role || '').toLowerCase();
        if (!portalRoleAllowed(role)) {
          clearAuthSession();
          showToast('This account is not enabled for the HR portal.', 'error', 6000);
          showLanding({ scrollToLogin: true });
          return;
        }
        setAuthSession({ user: { ...user, role } });
        syncMasterNavigation(user);
        showDashboard(user);
      })
      .catch(() => {
        if (bootstrapGen !== authBootstrapGeneration) return;
        if (getAuthToken()) return;
        clearAuthSession();
        showLanding({ scrollToLogin: true });
      });
  } else {
    if (storedUser) clearAuthSession();
    revealLoginCard();
    if (window.location.hash === '#login-section') {
      requestAnimationFrame(() => {
        document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  syncMasterNavigation(storedUser);

  function setSidebarOpen(isOpen) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.getElementById('sidebar-toggle');

    sidebar?.classList.toggle('open', isOpen);
    overlay?.classList.toggle('open', isOpen);
    toggle?.classList.toggle('open', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);

    if (toggle) {
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    }
    if (overlay) overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const page = link.dataset.page;
      if (page === 'admin-logs' && !isMasterRole(currentAuthRole())) {
        e.preventDefault();
        return;
      }
      if (page) window._navigateTo(page);
      setSidebarOpen(false);
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await api.logout().catch(() => clearAuthSession());
    showLanding({ scrollToLogin: true });
  });

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const isOpen = !document.querySelector('.sidebar')?.classList.contains('open');
    setSidebarOpen(isOpen);
  });

  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
    setSidebarOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.sidebar')?.classList.contains('open')) {
      setSidebarOpen(false);
    }
  });

  async function waitForBackend() {
    await new Promise((r) => setTimeout(r, 1000));
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await api.health();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    showToast('Backend not reachable. Ensure it\'s running on port 8000.', 'error', 8000);
  }

  waitForBackend();
});
