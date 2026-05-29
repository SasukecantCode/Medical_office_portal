/* ═══════════════════════════════════════════════════════
   App — Main SPA Router & Init
   ═══════════════════════════════════════════════════════ */

import { initLanding } from './landing.js';
import { renderDashboardHome } from './dashboard.js';
import { renderStaffList, renderStaffForm, renderAttachments } from './staff.js';
import { renderIdCardsPage } from './id_cards.js';
import { showToast, animatePageTitle, initButtonRipples } from './animations.js';
import { initChat } from './chat.js';
import { api } from './api.js';

let currentPage = null;

const landingView = document.getElementById('landing-view');
const dashboardView = document.getElementById('dashboard-view');
const mainBody = document.getElementById('main-body');
const pageTitle = document.getElementById('page-title');

const NAV_PAGES = {
  'dashboard-home': { title: 'Dashboard', render: () => renderDashboardHome(mainBody) },
  'staff-list': { title: 'Staff Records', render: () => renderStaffList(mainBody) },
  'add-staff': { title: 'Add New Staff', render: () => renderStaffForm(mainBody) },
  'edit-staff': { title: 'Edit Staff', render: (params) => renderStaffForm(mainBody, params.staffId) },
  'attachments': { title: 'Document Vault', render: (params) => renderAttachments(mainBody, params.staffId, params.staffName, params.staffData) },
  'id-cards': { title: 'Generate ID Cards', render: () => renderIdCardsPage(mainBody) },
};

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
  const page = NAV_PAGES[pageKey];
  if (!page) return;

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

  mainBody.classList.remove('page-enter');
  mainBody.classList.add('page-exit');

  setTimeout(() => {
    page.render(params);
    mainBody.classList.remove('page-exit');
    mainBody.classList.add('page-enter');
    requestAnimationFrame(() => {
      mainBody.offsetHeight;
    });
  }, 150);
};

function showDashboard() {
  landingView.style.transition = 'opacity 0.6s var(--ease-smooth)';
  landingView.style.opacity = '0';

  setTimeout(() => {
    landingView.style.display = 'none';
    document.body.classList.add('dashboard-active');
    dashboardView.classList.add('active');
    requestAnimationFrame(() => {
      dashboardView.classList.add('visible');
    });
    window._navigateTo('dashboard-home');
  }, 600);
}

function showLanding() {
  sessionStorage.removeItem('hr_portal_auth');
  document.body.classList.remove('dashboard-active');
  dashboardView.classList.remove('visible', 'active');
  landingView.style.display = '';
  requestAnimationFrame(() => {
    landingView.style.opacity = '1';
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  initButtonRipples();
  initHeaderClock();
  initChat();

  if (sessionStorage.getItem('hr_portal_auth') === 'true') {
    landingView.style.display = 'none';
    document.body.classList.add('dashboard-active');
    dashboardView.classList.add('active', 'visible');
    window._navigateTo('dashboard-home');
  } else {
    initLanding(showDashboard);
  }

  document.querySelectorAll('.sidebar-link').forEach((link) => {
    link.addEventListener('click', () => {
      const page = link.dataset.page;
      if (page) window._navigateTo(page);
      document.querySelector('.sidebar')?.classList.remove('open');
      document.querySelector('.sidebar-overlay')?.classList.remove('open');
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', showLanding);

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('open');
  });

  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('open');
  });

  document.getElementById('export-xlsx')?.addEventListener('click', () => api.exportStaff('xlsx'));
  document.getElementById('export-csv')?.addEventListener('click', () => api.exportStaff('csv'));

  api.health().catch(() => {
    showToast('Backend not reachable. Ensure it\'s running on port 8000.', 'error', 8000);
  });
});
