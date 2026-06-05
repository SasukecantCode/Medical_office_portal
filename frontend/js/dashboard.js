/* ═══════════════════════════════════════════════════════
   Dashboard — New Glassmorphism Layout
   ═══════════════════════════════════════════════════════ */

import { api } from './api.js';
import { animateCounter, showToast, initProgressBars, initExportDropdown } from './animations.js';
import { staffAvatarHtml, hydrateStaffPhotos } from './staff.js';

export { renderAdminLogs } from './admin_logs.js';

export async function renderDashboardHome(container) {
  // Hide default main header to use our custom dashboard header
  const mainHeader = document.querySelector('.main-header');
  if (mainHeader) mainHeader.style.display = 'none';

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const hours = today.getHours();
  const greeting = hours < 12 ? 'Good Morning' : hours < 17 ? 'Good Afternoon' : 'Good Evening';

  container.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-greeting">
        <h3>${greeting}, Administrator</h3>
      </div>
      <div class="dashboard-actions">
        <div class="dashboard-date">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>${dateString}</span>
        </div>
        <!-- Notification Bell -->
        <div style="position:relative;" id="notif-bell-wrapper">
          <button id="notif-bell-btn" type="button" style="position:relative; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:white; cursor:pointer; width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            <span id="notif-badge" style="display:none; position:absolute; top:-4px; right:-4px; background:#ef4444; color:white; font-size:10px; font-weight:700; min-width:18px; height:18px; border-radius:9px; display:flex; align-items:center; justify-content:center; padding:0 4px;">0</span>
          </button>
          <!-- Notification Dropdown Panel -->
          <div id="notif-dropdown" style="display:none; position:absolute; top:calc(100% + 8px); right:0; width:380px; max-height:480px; background:rgba(15,23,42,0.97); border:1px solid rgba(255,255,255,0.1); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); z-index:200; overflow:hidden; backdrop-filter:blur(20px);">
            <div style="padding:16px 18px 12px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:15px; font-weight:600; color:var(--clr-text-white);">Notifications</span>
              <span id="notif-mark-all" style="font-size:12px; color:var(--clr-accent); cursor:pointer; font-weight:500;">Mark all read</span>
            </div>
            <div style="display:flex; gap:0; border-bottom:1px solid rgba(255,255,255,0.06);">
              <button class="notif-tab active" data-notif-tab="UNREAD" style="flex:1; padding:10px; font-size:12px; font-weight:600; background:none; border:none; color:var(--clr-accent); cursor:pointer; border-bottom:2px solid var(--clr-accent);">Active</button>
              <button class="notif-tab" data-notif-tab="ACKNOWLEDGED" style="flex:1; padding:10px; font-size:12px; font-weight:500; background:none; border:none; color:var(--clr-text-subtle); cursor:pointer; border-bottom:2px solid transparent;">Archived</button>
            </div>
            <div id="notif-list" style="overflow-y:auto; max-height:360px; padding:4px 0;">
              <div style="padding:32px 16px; text-align:center; color:var(--clr-text-subtle); font-size:13px;">Loading...</div>
            </div>
          </div>
        </div>
        <div class="export-dropdown" id="export-dropdown-dash">
          <button type="button" class="btn btn-primary btn-sm" data-export-trigger aria-haspopup="true" aria-expanded="false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export Data
            <svg class="export-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="export-dropdown-menu" role="menu">
            <button type="button" class="export-dropdown-item" data-export-format="xlsx" role="menuitem">
              <span class="export-dropdown-icon">📊</span>
              <span>
                <strong>Export Excel</strong>
                <small>.xlsx with photos</small>
              </span>
            </button>
            <button type="button" class="export-dropdown-item" data-export-format="csv" role="menuitem">
              <span class="export-dropdown-icon">📄</span>
              <span>
                <strong>Export CSV</strong>
                <small>Comma-separated values</small>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .dash-row { display: grid; gap: 1.5rem; }
      @media(min-width: 1024px) {
        .dash-row-top { grid-template-columns: 1.5fr 1fr; }
        .dash-row-bot { grid-template-columns: 1fr 1fr 1fr; }
      }
      @media(max-width: 1023px) {
        .dash-row-top, .dash-row-bot { grid-template-columns: 1fr; }
      }
      .badge { font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
      .badge-light { background: rgba(255,255,255,0.1); color: white; }
      .rank-circle { width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; margin-right: 8px; color: var(--clr-text-white); }
    </style>

    <!-- Top Row: Overview & Categories -->
    <div class="dash-row dash-row-top">
      <!-- Card 1: Workforce Overview -->
      <div class="glass-panel panel-enter" style="display: flex; flex-direction: column; background: linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%);">
        <div class="panel-header" style="border-bottom: none;">
          <span class="panel-title" style="font-size: 1.2rem; font-weight: 600; color: var(--clr-text-white);">Workforce Overview</span>
        </div>
        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: space-around; gap: 2rem; padding: 1rem;">
          
          <div style="text-align: center;">
            <div class="total-staff-count" id="stat-total" style="font-size: 4rem; font-weight: 800; line-height: 1; text-shadow: 0 4px 20px rgba(0,0,0,0.3); color: var(--clr-text-white);">0</div>
            <div style="font-size: 0.8rem; color: var(--clr-text-subtle); text-transform: uppercase; letter-spacing: 2px; margin-top: 0.5rem;">Total Staff</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; flex: 1; max-width: 250px;">
            <div style="display: flex; justify-content: space-between; background: rgba(16,185,129,0.05); padding: 0.75rem 1rem; border-radius: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);">
              <span style="font-size: 0.85rem; color: var(--clr-text-subtle);">Active Profiles</span>
              <span id="stat-active" style="font-weight: 700; color: var(--clr-text-white);">0</span>
            </div>
            <div style="display: flex; justify-content: space-between; background: rgba(198,151,63,0.05); padding: 0.75rem 1rem; border-radius: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);">
              <span style="font-size: 0.85rem; color: var(--clr-text-subtle);">Incomplete</span>
              <span id="stat-incomplete" style="font-weight: 700; color: var(--clr-accent);">0</span>
            </div>
            <div style="display: flex; justify-content: space-between; background: rgba(20,105,111,0.05); padding: 0.75rem 1rem; border-radius: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);">
              <span style="font-size: 0.85rem; color: var(--clr-text-subtle);">Completeness</span>
              <span id="stat-completeness" style="font-weight: 700; color: var(--clr-text-white);">0%</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Card 2: Staff by Head -->
      <div class="glass-panel panel-enter" style="display: flex; flex-direction: column;">
        <div class="panel-header" style="border-bottom: none;">
          <span class="panel-title" style="font-size: 1.1rem; font-weight: 600; color: var(--clr-text-white);">Staff by Head</span>
        </div>
        <div id="head-chart-container" style="flex-grow: 1; margin-top: 0.5rem; display: flex; flex-direction: column; justify-content: center;">
          <!-- Filled by JS -->
        </div>
      </div>
    </div>

    <!-- Second Row: Top Items -->
    <div class="dash-row dash-row-bot" style="margin-top: 1.5rem;">
      
      <!-- Card 3: Staff by Facility Type -->
      <div class="glass-panel panel-enter" style="display: flex; flex-direction: column;">
        <div class="panel-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
          <span class="panel-title" style="font-size: 1.1rem; font-weight: 600; color: var(--clr-text-white);">Distribution by Facility Type</span>
        </div>
        <div id="facility-type-progress-list" style="flex-grow: 1; margin-top: 1rem;">
          <!-- Filled by JS -->
        </div>
      </div>

      <!-- Card 4: Top Facilities -->
      <div class="glass-panel panel-enter" style="display: flex; flex-direction: column;">
        <div class="panel-header" style="justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
          <span class="panel-title" style="font-size: 1.1rem; font-weight: 600; color: var(--clr-text-white);">Top Facilities by Manpower</span>
          <button class="btn btn-secondary btn-sm" id="btn-view-all-facilities" style="padding: 2px 8px; font-size: 11px;">View All</button>
        </div>
        <div id="district-progress-list" style="flex-grow: 1; margin-top: 1rem;">
          <!-- Filled by JS (Leaderboard) -->
        </div>
      </div>

      <!-- Card 5: Staff by Designation -->
      <div class="glass-panel panel-enter" style="display: flex; flex-direction: column;">
        <div class="panel-header" style="justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
          <span class="panel-title" style="font-size: 1.1rem; font-weight: 600; color: var(--clr-text-white);">Top Designations by Manpower</span>
          <button class="btn btn-secondary btn-sm" id="btn-view-all-designations" style="padding: 2px 8px; font-size: 11px;">View All</button>
        </div>
        <div id="designation-progress-list" style="flex-grow: 1; margin-top: 1rem;">
          <!-- Filled by JS (Badges) -->
        </div>
      </div>
    </div>

    <!-- Bottom Row: Table -->
    <div class="dashboard-grid-row" style="margin-top: 1.5rem;">
      <div class="glass-panel table-card panel-enter">
        <div class="table-header">
          <span class="panel-title">Incomplete Entries Alerts <span id="dash-incomplete-badge" style="font-size:12px; font-weight:normal; background:#ef4444; color:white; padding:2px 8px; border-radius:12px; margin-left:8px; display:none;">Action Required</span></span>
          <div class="table-filters">
            <div class="search-box" style="margin:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search Employee" id="dash-search">
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-view-all">View All</button>
          </div>
        </div>
        <div class="data-table-wrapper" id="dash-scroll-container" style="border:none; border-radius:0; max-height: 400px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Missing Information</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="dash-table-body">
              <tr><td colspan="5" style="text-align:center; padding: 24px;">Loading staff...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>



    <!-- Modal: All Facilities Overlay -->
    <div id="modal-all-facilities" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
      <div class="glass-panel" style="width: 100%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.2rem;">All Facilities</h3>
          <button id="close-modal-facilities" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.5rem;">&times;</button>
        </div>
        <div class="search-box" style="margin-bottom: 1rem; width: 100%;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Search Facilities..." id="search-all-facilities" style="width: 100%;">
        </div>
        <div id="list-all-facilities" style="overflow-y: auto; flex-grow: 1; padding-right: 8px;"></div>
      </div>
    </div>

    <!-- Modal: All Designations Overlay -->
    <div id="modal-all-designations" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
      <div class="glass-panel" style="width: 100%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.2rem;">All Designations</h3>
          <button id="close-modal-designations" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.5rem;">&times;</button>
        </div>
        <div class="search-box" style="margin-bottom: 1rem; width: 100%;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Search Designations..." id="search-all-designations" style="width: 100%;">
        </div>
        <div id="list-all-designations" style="overflow-y: auto; flex-grow: 1; padding-right: 8px;"></div>
      </div>
    </div>
    </div>
  `;

  // Export dropdown
  const exportRoot = document.getElementById('export-dropdown-dash');
  if (exportRoot) {
    initExportDropdown(exportRoot, (format) => api.exportStaff(format));
  }

  document.getElementById('btn-view-all')?.addEventListener('click', () => window._navigateTo('staff-list'));

  try {
    // Fetch data
    const [dashboardData, staffData, fieldDefs] = await Promise.all([
      api.dashboard(),
      api.listStaff(),
      api.listFieldDefs().catch(() => [])
    ]);

    // Calculate facility types
    const districts = (dashboardData.by_facility || []).sort((a, b) => b.count - a.count);
    const totalDistrictsCount = dashboardData.totals?.staff || 1;

    const byFacilityType = {};
    districts.forEach(d => {
      let ftype = 'Other';
      const k = d.key.toLowerCase();
      if (k.includes('dh') || k.includes('district hospital')) ftype = 'DH';
      else if (k.includes('chc')) ftype = 'CHC';
      else if (k.includes('phc')) ftype = 'PHC';
      else if (k.includes('hwc') || k.includes('sub center') || k.includes('sub centre') || k.includes('sc')) ftype = 'HWC';
      else if (k.includes('dmo')) ftype = 'DMO Office';
      
      byFacilityType[ftype] = (byFacilityType[ftype] || 0) + d.count;
    });
    const facilityTypes = Object.entries(byFacilityType).map(([key, count]) => ({key, count})).sort((a,b) => b.count - a.count);

    // Calculate Incomplete Staff for metrics
    const tbody = document.getElementById('dash-table-body');
    const essentialFields = [
      { key: 'designation', label: 'Designation' },
      { key: 'date_of_birth', label: 'DOB' },
      { key: 'date_of_joining', label: 'DOJ' },
      { key: 'phone', label: 'Contact Number' },
      { key: 'present_posting_place', label: 'Posting Place' },
      { key: 'aadhaar_number', label: 'Aadhaar' },
      { key: 'pan_number', label: 'PAN' },
      { key: 'fathers_name', label: "Father's Name" },
      { key: 'mothers_name', label: "Mother's Name" }
    ];
    (fieldDefs || []).forEach(fd => {
      essentialFields.push({ key: `custom__${fd.name}`, label: fd.label || fd.name });
    });
    const incompleteStaff = staffData.map(s => {
      const missing = essentialFields.filter(f => {
        if (f.key.startsWith('custom__')) {
          const rawKey = f.key.replace('custom__', '');
          const extra = s.extra || {};
          return extra[rawKey] == null || String(extra[rawKey]).trim() === '';
        }
        return s[f.key] == null || String(s[f.key]).trim() === '';
      });
      return { ...s, missing };
    }).filter(s => s.missing.length > 0).sort((a, b) => b.missing.length - a.missing.length);

    // Card 1: Workforce Overview
    const completeCount = totalDistrictsCount - incompleteStaff.length;
    const completenessPct = Math.round((completeCount / totalDistrictsCount) * 100);
    animateCounter(document.getElementById('stat-total'), dashboardData.totals?.staff || 0, 800);
    document.getElementById('stat-active').textContent = dashboardData.totals?.active || dashboardData.totals?.staff || 0;
    document.getElementById('stat-incomplete').textContent = incompleteStaff.length;
    document.getElementById('stat-completeness').textContent = `${completenessPct}%`;

    // Generic list renderer (Used only for View All Modals now)
    function renderGenericList(containerId, dataList) {
      const el = document.getElementById(containerId);
      if(!el) return;
      el.innerHTML = dataList.map((d, i) => {
        const pct = Math.max(2, (d.count / totalDistrictsCount) * 100);
        const colors = ['#14B8A6', '#6366F1', '#C6973F', '#10B981', '#F43F5E', '#8B5CF6', '#F59E0B', '#3B82F6'];
        const c = colors[i % colors.length];
        return `
          <div class="progress-item" style="margin-bottom: 12px;">
            <div class="progress-header" style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
              <span title="${d.key}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;"><div class="dot" style="display:inline-block; background:${c}; margin-right:4px;"></div> ${d.key}</span>
              <span style="font-weight: 600;">${d.count}</span>
            </div>
            <div class="progress-bar-bg" style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 4px; overflow: hidden;">
              <div class="progress-bar-fill" style="width: 0%; height: 100%; background: ${c}; transition: width 1s ease;" data-width="${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Card 2: Staff by Head (Segmented Bar)
    const heads = (dashboardData.by_head || []).sort((a, b) => b.count - a.count);
    const headColors = ['var(--clr-primary-light)', 'var(--clr-accent)', 'var(--clr-text-muted)', '#385A64', 'var(--clr-accent-light)', 'var(--clr-success)'];
    const headContainer = document.getElementById('head-chart-container');
    if (headContainer) {
      let segmentsHtml = '';
      let legendsHtml = '';
      heads.forEach((h, i) => {
        const pct = (h.count / totalDistrictsCount) * 100;
        const c = headColors[i % headColors.length];
        segmentsHtml += `<div style="width: ${Math.max(0.5, pct)}%; background: ${c};" title="${h.key}: ${h.count} (${pct.toFixed(1)}%)"></div>`;
        legendsHtml += `
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${c};"></div>
            <span style="color: var(--clr-text-white); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 50px;">${h.key}</span>
            <span style="font-weight: 600; margin-left: auto; color: var(--clr-text-white);">${h.count} Staff</span>
            <span style="font-weight: 600; color: var(--clr-text-subtle); margin-left: 12px; width: 40px; text-align: right;">${pct.toFixed(1)}%</span>
          </div>
        `;
      });
      headContainer.innerHTML = `
        <div style="width: 100%; height: 24px; display: flex; border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
          ${segmentsHtml}
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem;">
          ${legendsHtml}
        </div>
      `;
    }

    // Card 3: Staff by Facility Type (Horizontal Proportional)
    const facilityTypeContainer = document.getElementById('facility-type-progress-list');
    if (facilityTypeContainer) {
      facilityTypeContainer.innerHTML = facilityTypes.map((d, i) => {
        const pct = (d.count / totalDistrictsCount) * 100;
        return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
              <span style="font-weight: 600; color: var(--clr-text-white);">${d.key}</span>
              <span>
                <span style="font-weight: 700; color: var(--clr-text-white);">${d.count} Staff</span> 
                <span style="color: var(--clr-text-subtle); font-weight: 600; font-size: 0.75rem; margin-left: 8px;">${pct.toFixed(1)}%</span>
              </span>
            </div>
            <div style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.max(2, pct)}%; height: 100%; background: var(--clr-primary-light); transition: width 1s ease;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Card 4: Top Facilities (Leaderboard)
    const topFacilitiesContainer = document.getElementById('district-progress-list');
    if (topFacilitiesContainer) {
      topFacilitiesContainer.innerHTML = districts.slice(0, 5).map((d, i) => {
        return `
          <div style="display: flex; align-items: center; margin-bottom: 12px; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div class="rank-circle">${i+1}</div>
            <div style="flex-grow: 1; margin-right: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; font-weight: 600; color: var(--clr-text-white);">
              ${d.key}
            </div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--clr-text-white);">${d.count} Staff</div>
          </div>
        `;
      }).join('');
    }
    renderGenericList('list-all-facilities', districts);

    // Card 5: Staff by Designation (Leaderboard)
    const desigs = (dashboardData.by_designation || []).sort((a, b) => b.count - a.count);
    const topDesigsContainer = document.getElementById('designation-progress-list');
    if (topDesigsContainer) {
      topDesigsContainer.innerHTML = desigs.slice(0, 5).map((d, i) => {
        return `
          <div style="display: flex; align-items: center; margin-bottom: 12px; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div class="rank-circle">${i+1}</div>
            <div style="flex-grow: 1; margin-right: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; font-weight: 600; color: var(--clr-text-white);">
              ${d.key}
            </div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--clr-text-white);">${d.count} Staff</div>
          </div>
        `;
      }).join('');
    }
    renderGenericList('list-all-designations', desigs);

    // Bind Modals & Search
    document.getElementById('btn-view-all-facilities')?.addEventListener('click', () => {
      document.getElementById('modal-all-facilities').style.display = 'flex';
      setTimeout(() => initProgressBars(document.getElementById('modal-all-facilities')), 50);
    });
    document.getElementById('close-modal-facilities')?.addEventListener('click', () => {
      document.getElementById('modal-all-facilities').style.display = 'none';
    });
    document.getElementById('search-all-facilities')?.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase();
      const filtered = districts.filter(d => d.key.toLowerCase().includes(val));
      renderGenericList('list-all-facilities', filtered);
      setTimeout(() => initProgressBars(document.getElementById('modal-all-facilities')), 10);
    });

    document.getElementById('btn-view-all-designations')?.addEventListener('click', () => {
      document.getElementById('modal-all-designations').style.display = 'flex';
      setTimeout(() => initProgressBars(document.getElementById('modal-all-designations')), 50);
    });
    document.getElementById('close-modal-designations')?.addEventListener('click', () => {
      document.getElementById('modal-all-designations').style.display = 'none';
    });
    document.getElementById('search-all-designations')?.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase();
      const filtered = desigs.filter(d => d.key.toLowerCase().includes(val));
      renderGenericList('list-all-designations', filtered);
      setTimeout(() => initProgressBars(document.getElementById('modal-all-designations')), 10);
    });

    initProgressBars(container);

    const dashAlertBadge = document.getElementById('dash-incomplete-badge');
    const navDashAlert = document.getElementById('nav-dash-alert');

    if (incompleteStaff.length === 0) {
      if (dashAlertBadge) dashAlertBadge.style.display = 'none';
      if (navDashAlert) navDashAlert.style.display = 'none';
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:32px; color:var(--clr-text-subtle);">All records are complete.</td></tr>`;
    } else {
      if (dashAlertBadge) dashAlertBadge.style.display = 'inline-block';
      if (navDashAlert) navDashAlert.style.display = 'inline-block';

      let currentDashOffset = 0;
      const DASH_LIMIT = 45;
      let isDashLoadingMore = false;

      const renderDashRows = (append = false) => {
        const slice = incompleteStaff.slice(currentDashOffset, currentDashOffset + DASH_LIMIT);
        if (slice.length === 0) return;

        const html = slice.map(s => {
          const missingLabels = s.missing.map(m => `<span style="background:rgba(239,68,68,0.15); color:#fca5a5; border:1px solid rgba(239,68,68,0.3); font-size:11px; padding:2px 6px; border-radius:4px; margin:2px; display:inline-block;">${m.label}</span>`).join('');
          return `
            <tr>
              <td>
                <div class="staff-row-identity">
                  ${staffAvatarHtml(s, 32)}
                  <div class="staff-row-identity-text">
                    <span style="font-weight:500;">${s.full_name}</span>
                    <span class="staff-row-facility">${s.display_id || s.id}</span>
                  </div>
                </div>
              </td>
              <td>
                <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:400px; padding: 4px 0;">
                  ${missingLabels}
                </div>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn-edit" onclick="window._navigateTo('edit-staff', {staffId: ${s.id}})" title="Complete Entry">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        if (append) {
          tbody.insertAdjacentHTML('beforeend', html);
        } else {
          tbody.innerHTML = html;
        }

        currentDashOffset += slice.length;
        hydrateStaffPhotos(tbody).catch(console.error);
      };

      // Initial render
      renderDashRows(false);

      // Infinite scroll listener
      const dashTableContainer = document.getElementById('dash-scroll-container');
      if (dashTableContainer) {
        dashTableContainer.addEventListener('scroll', () => {
          if (dashTableContainer.scrollTop + dashTableContainer.clientHeight >= dashTableContainer.scrollHeight - 100) {
            if (!isDashLoadingMore && currentDashOffset < incompleteStaff.length) {
              isDashLoadingMore = true;
              renderDashRows(true);
              isDashLoadingMore = false;
            }
          }
        });
      }
    }

    // Search filter for dash table
    document.getElementById('dash-search')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });

    // ── Notification Dropdown Panel ──
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const notifBadge = document.getElementById('notif-badge');
    const notifList = document.getElementById('notif-list');

    let _notifDropdownOpen = false;

    const renderNotifItems = (notifs, status) => {
      if (!notifList) return;
      if (!notifs || notifs.length === 0) {
        notifList.innerHTML = `<div style="padding:40px 16px; text-align:center; color:var(--clr-text-subtle); font-size:13px;">No ${status === 'UNREAD' ? 'active' : 'archived'} notifications.</div>`;
        return;
      }
      const todayDate = new Date();
      notifList.innerHTML = notifs.map(n => {
        const isRet = n.type === 'RETIREMENT';
        const iconBg = isRet ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
        const iconClr = isRet ? '#ef4444' : '#f59e0b';
        const label = isRet ? 'Retirement Approaching' : 'MACP Due Soon';
        const targetDate = new Date(n.target_date);
        const days = Math.ceil((targetDate - todayDate) / (1000*60*60*24));
        const dateStr = targetDate.toLocaleDateString('en-US', { day:'2-digit', month:'short', year:'numeric' });
        const daysText = days > 0 ? `${days} days remaining` : 'Date passed';

        const ackBtn = status === 'UNREAD' ? `<button onclick="event.stopPropagation(); window._ackNotifDrop(${n.id})" style="background:none; border:none; color:#10b981; cursor:pointer; padding:4px;" title="Acknowledge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></button>` : '';

        return `
          <div id="notif-item-${n.id}" style="display:flex; align-items:flex-start; gap:12px; padding:12px 18px; cursor:pointer; transition:background 0.15s; border-bottom:1px solid rgba(255,255,255,0.04);" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='none'" onclick="window._navigateTo('edit-staff', {staffId: ${n.staff_id}})">
            <div style="width:36px; height:36px; border-radius:10px; background:${iconBg}; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;">
              ${isRet
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconClr}" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
                : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconClr}" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
              }
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:600; color:var(--clr-text-white); margin-bottom:2px;">${label}</div>
              <div style="font-size:12px; color:var(--clr-text-subtle);">${n.staff_name || 'Unknown'} · ${n.staff_display_id || ''}</div>
              <div style="font-size:11px; color:${days <= 30 ? '#ef4444' : 'var(--clr-text-subtle)'}; margin-top:3px;">${dateStr} · ${daysText}</div>
            </div>
            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
              ${ackBtn}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-subtle)" stroke-width="2" style="opacity:0.4;"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>`;
      }).join('');
    };

    // Load & show badge
    try {
      api.generateNotifications().catch(() => {});
      const notifs = await api.getNotifications('UNREAD');
      const count = notifs ? notifs.length : 0;
      if (notifBadge) {
        if (count > 0) {
          notifBadge.textContent = count;
          notifBadge.style.display = 'flex';
        } else {
          notifBadge.style.display = 'none';
        }
      }
      // Pre-render list
      renderNotifItems(notifs, 'UNREAD');
    } catch (err) {
      console.error("Notif load err", err);
      if (notifBadge) notifBadge.style.display = 'none';
      renderNotifItems([], 'UNREAD');
    }

    // Bell toggle
    if (bellBtn && dropdown) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _notifDropdownOpen = !_notifDropdownOpen;
        dropdown.style.display = _notifDropdownOpen ? 'block' : 'none';
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (_notifDropdownOpen && !dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
          _notifDropdownOpen = false;
          dropdown.style.display = 'none';
        }
      });
    }

    // Tab switching
    document.querySelectorAll('[data-notif-tab]').forEach(tab => {
      tab.addEventListener('click', async (e) => {
        document.querySelectorAll('[data-notif-tab]').forEach(t => {
          t.style.color = 'var(--clr-text-subtle)';
          t.style.fontWeight = '500';
          t.style.borderBottomColor = 'transparent';
        });
        e.target.style.color = 'var(--clr-accent)';
        e.target.style.fontWeight = '600';
        e.target.style.borderBottomColor = 'var(--clr-accent)';
        const status = e.target.dataset.notifTab;
        notifList.innerHTML = `<div style="padding:32px 16px; text-align:center; color:var(--clr-text-subtle); font-size:13px;">Loading...</div>`;
        try {
          const notifs = await api.getNotifications(status);
          renderNotifItems(notifs, status);
        } catch { renderNotifItems([], status); }
      });
    });

    // Acknowledge from dropdown
    window._ackNotifDrop = async (id) => {
      try {
        await api.acknowledgeNotification(id);
        const item = document.getElementById(`notif-item-${id}`);
        if (item) { item.style.opacity='0'; setTimeout(() => item.remove(), 200); }
        const badge = document.getElementById('notif-badge');
        if (badge) {
          const cur = parseInt(badge.textContent) - 1;
          if (cur <= 0) { badge.style.display = 'none'; }
          else { badge.textContent = cur; }
        }
        showToast('Notification acknowledged', 'success');
      } catch (err) {
        showToast('Failed to acknowledge', 'error');
      }
    };

    // Mark all read
    document.getElementById('notif-mark-all')?.addEventListener('click', async () => {
      try {
        const notifs = await api.getNotifications('UNREAD');
        if (notifs) {
          for (const n of notifs) { await api.acknowledgeNotification(n.id); }
        }
        renderNotifItems([], 'UNREAD');
        if (notifBadge) notifBadge.style.display = 'none';
        showToast('All notifications acknowledged', 'success');
      } catch { showToast('Failed', 'error'); }
    });

  } catch (err) {
    showToast(`Failed to load dashboard data`, 'error');
    console.error(err);
  }
}
