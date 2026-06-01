/* ═══════════════════════════════════════════════════════
   Dashboard — New Glassmorphism Layout
   ═══════════════════════════════════════════════════════ */

import { api } from './api.js';
import { animateCounter, showToast, initProgressBars, initExportDropdown } from './animations.js';
import { staffAvatarHtml } from './staff.js';

export { renderAdminLogs } from './admin_logs.js';

export async function renderDashboardHome(container) {
  // Hide default main header to use our custom dashboard header
  const mainHeader = document.querySelector('.main-header');
  if (mainHeader) mainHeader.style.display = 'none';

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  container.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-greeting">
        <h3>Good Morning, Administrator</h3>
      </div>
      <div class="dashboard-actions">
        <div class="dashboard-date">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>01 Jan - ${dateString}</span>
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

    <!-- Top Row: Metrics -->
    <div class="dashboard-grid-row grid-cols-3">
      <!-- Card 1: Total Staff -->
      <div class="glass-panel panel-enter">
        <div class="panel-header">
          <span class="panel-title">Total Staff</span>
          <svg class="panel-action" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </div>
        <div class="total-staff-main">
          <div class="total-staff-count" id="stat-total">0</div>
          <div class="total-staff-trend">↗ Active</div>
        </div>
        <div class="staff-breakdown-row">
          <div class="staff-breakdown-item">
            <div class="staff-breakdown-val" id="stat-regular">0</div>
            <div class="staff-breakdown-lbl"><div class="dot dot-primary"></div> Regular</div>
          </div>
          <div class="staff-breakdown-item" style="align-items:flex-end;">
            <div class="staff-breakdown-val" id="stat-contract">0</div>
            <div class="staff-breakdown-lbl"><div class="dot dot-accent"></div> Contractual</div>
          </div>
        </div>
      </div>

      <!-- Card 2: Staff by District -->
      <div class="glass-panel panel-enter">
        <div class="panel-header">
          <span class="panel-title">Staff Distribution</span>
          <svg class="panel-action" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </div>
        <div class="dist-val" id="stat-dist-top">--</div>
        <div class="progress-list" id="district-progress-list">
          <!-- Filled by JS -->
        </div>
      </div>

      <!-- Card 3: Designations Gauge -->
      <div class="glass-panel panel-enter">
        <div class="panel-header">
          <span class="panel-title">Top Designations</span>
          <svg class="panel-action" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
        </div>
        <div class="gauge-container">
          <svg class="gauge-svg" viewBox="0 -8 200 108" overflow="visible">
            <path class="gauge-bg" d="M 10 90 A 90 90 0 0 1 190 90" />
            <path class="gauge-val-1" id="gauge-path-1" d="M 10 90 A 90 90 0 0 1 190 90" />
            <path class="gauge-val-2" id="gauge-path-2" d="M 10 90 A 90 90 0 0 1 190 90" />
            <path class="gauge-val-3" id="gauge-path-3" d="M 10 90 A 90 90 0 0 1 190 90" />
          </svg>
          <div class="gauge-center">
            <div class="gauge-center-val" id="stat-designations">0</div>
            <div class="gauge-center-lbl">Total Roles</div>
          </div>
        </div>
        <div class="legend-list" id="designation-legend-list">
          <!-- Filled by JS -->
        </div>
      </div>
    </div>

    <!-- Middle Row: Charts -->
    <div class="dashboard-grid-row grid-cols-3">
      <!-- Staff Allocation -->
      <div class="glass-panel chart-card panel-enter">
        <div class="panel-header">
          <span class="panel-title">Staff Allocation by Role</span>
          <span style="font-size:12px; color:rgba(255,255,255,0.5)">Showing top 4 roles</span>
        </div>
        <div class="h-chart-list" id="allocation-chart">
          <!-- Filled by JS -->
        </div>
      </div>

      <!-- Facility Ranking -->
      <div class="glass-panel chart-card panel-enter">
        <div class="panel-header">
          <span class="panel-title">Facility Ranking</span>
          <span style="font-size:12px; color:rgba(255,255,255,0.5)">By manpower</span>
        </div>
        <div class="h-chart-list" id="facility-chart">
          <!-- Filled by JS -->
        </div>
      </div>

      <!-- Growth / Historical -->
      <div class="glass-panel chart-card panel-enter">
        <div class="panel-header">
          <span class="panel-title">Department Growth</span>
          <span style="font-size:12px; color:rgba(255,255,255,0.5)">Monthly Trend ></span>
        </div>
        <div class="chart-content" id="growth-chart">
          <!-- Filled by JS -->
        </div>
      </div>
    </div>

    <!-- Bottom Row: Table -->
    <div class="dashboard-grid-row">
      <div class="glass-panel table-card panel-enter">
        <div class="table-header">
          <span class="panel-title">All Employees</span>
          <div class="table-filters">
            <div class="search-box" style="margin:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search Employee" id="dash-search">
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-view-all">View All</button>
          </div>
        </div>
        <div class="data-table-wrapper" style="border:none; border-radius:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>District</th>
                <th>Status</th>
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
  `;

  // Export dropdown
  const exportRoot = document.getElementById('export-dropdown-dash');
  if (exportRoot) {
    initExportDropdown(exportRoot, (format) => api.exportStaff(format));
  }

  document.getElementById('btn-view-all')?.addEventListener('click', () => window._navigateTo('staff-list'));

  try {
    // Fetch data
    const [dashboardData, staffData] = await Promise.all([
      api.dashboard(),
      api.listStaff()
    ]);

    // Populate Card 1: Total
    animateCounter(document.getElementById('stat-total'), dashboardData.totals?.staff || 0, 800);
    const empTypes = dashboardData.by_employment_type || [];
    const regular = empTypes.find(e => e.key.toLowerCase().includes('regular'))?.count || 0;
    const contract = empTypes.find(e => e.key.toLowerCase().includes('contract'))?.count || 0;
    animateCounter(document.getElementById('stat-regular'), regular, 800);
    animateCounter(document.getElementById('stat-contract'), contract, 800);

    // Populate Card 2: Districts
    const districts = (dashboardData.by_district || []).sort((a, b) => b.count - a.count);
    const topDistricts = districts.slice(0, 3);
    const totalDistrictsCount = dashboardData.totals?.staff || 1;
    
    document.getElementById('stat-dist-top').textContent = topDistricts[0] ? topDistricts[0].count : '0';

    const distList = document.getElementById('district-progress-list');
    distList.innerHTML = topDistricts.map((d, i) => {
      const pct = Math.round((d.count / totalDistrictsCount) * 100) + 15; // +15 just for visual weight
      const colors = ['#14B8A6', '#6366F1', '#C6973F'];
      return `
        <div class="progress-item">
          <div class="progress-header">
            <span><div class="dot dot-primary" style="display:inline-block; background:${colors[i]}; margin-right:4px;"></div> ${d.key}</span>
            <span>${d.count}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: 0%; background: ${colors[i]};" data-width="${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    initProgressBars(container);

    // Populate Card 3: Designations
    const desigs = (dashboardData.by_designation || []).sort((a, b) => b.count - a.count);
    const totalDesigs = dashboardData.by_designation?.length || 0;
    const totalStaff = dashboardData.totals?.staff || 1;
    animateCounter(document.getElementById('stat-designations'), totalDesigs, 800);

    const gaugeList = document.getElementById('designation-legend-list');
    const topDesigs = desigs.slice(0, 3);
    const gaugeColors = ['#6366F1', '#C6973F', '#10B981'];
    
    gaugeList.innerHTML = topDesigs.map((d, i) => `
      <div class="legend-item">
        <span class="legend-lbl"><div class="dot" style="background:${gaugeColors[i]}"></div> ${d.key}</span>
        <span class="legend-val">${d.count}</span>
      </div>
    `).join('');

    // Animate gauge — segmented arcs with rounded caps and gaps
    setTimeout(() => {
      const arcLength = 283; // half-circle arc (pi * r, r=90)
      const gap = 4; // px gap between segments for visual separation
      let accumulated = 0;

      topDesigs.forEach((d, i) => {
        const path = document.getElementById(`gauge-path-${i + 1}`);
        if (!path) return;

        // Proportional segment length, minus half a gap on each side
        const segLen = Math.max(4, (d.count / totalStaff) * arcLength - gap);
        path.style.strokeDasharray = `${segLen} ${arcLength - segLen}`;
        // Offset = accumulated full lengths (including gaps) so they don't overlap
        path.style.strokeDashoffset = -(accumulated + gap / 2);
        accumulated += segLen + gap;
      });
    }, 600);

    // Populate Allocation Chart (Middle Row)
    const allocChart = document.getElementById('allocation-chart');
    const topAllocRoles = desigs.slice(0, 4);
    allocChart.innerHTML = topAllocRoles.map((d, i) => {
      const colors = ['#6366F1', '#C6973F', '#14B8A6', '#10B981'];
      const maxCount = topAllocRoles[0]?.count || 1;
      const flexBasis = Math.max(10, (d.count / maxCount) * 100);
      return `
        <div class="h-chart-item">
          <div class="h-chart-label" title="${d.key}">${d.key}</div>
          <div class="h-chart-bars">
            <div class="h-bar-segment" style="width: ${flexBasis}%; background: ${colors[i]};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Populate Facility Ranking (Middle Row)
    const facilityChart = document.getElementById('facility-chart');
    const facilities = (dashboardData.by_facility || []).sort((a, b) => b.count - a.count);
    const topFacilities = facilities.slice(0, 4);
    facilityChart.innerHTML = topFacilities.map((d, i) => {
      const colors = ['#C6973F', '#14B8A6', '#6366F1', '#10B981'];
      const maxCount = topFacilities[0]?.count || 1;
      const flexBasis = Math.max(10, (d.count / maxCount) * 100);
      return `
        <div class="h-chart-item">
          <div class="h-chart-label" title="${d.key}">${d.key}</div>
          <div class="h-chart-bars">
            <div class="h-bar-segment" style="width: ${flexBasis}%; background: ${colors[i]};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Populate Growth Chart (Middle Row)
    const growthChart = document.getElementById('growth-chart');
    const monthlyData = (dashboardData.by_month || []).slice(-7); // take last 7 months
    if (monthlyData.length === 0) {
      growthChart.innerHTML = '<div style="color:rgba(255,255,255,0.5);text-align:center;width:100%;padding-top:2rem;">No historical data available</div>';
    } else {
      const maxCount = Math.max(...monthlyData.map(d => d.count), 1);
      
      const gridLinesHtml = `
        <div class="chart-grid-lines">
          <div class="chart-grid-line"></div>
          <div class="chart-grid-line"></div>
          <div class="chart-grid-line"></div>
          <div class="chart-grid-line"></div>
          <div class="chart-grid-line"></div>
        </div>`;
        
      const barsHtml = monthlyData.map((d, i) => {
        // e.g. "2024-05"
        const [yyyy, mm] = d.key.split('-');
        const dateObj = new Date(yyyy, mm - 1);
        const monthStr = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
        const yy = yyyy.substring(2);
        const monthLabel = `${monthStr} '${yy}`;
        const pct = Math.max(5, (d.count / maxCount) * 100);
        const isLatest = (i === monthlyData.length - 1);
        
        return `
          <div class="bar-col" title="${d.key}: ${d.count} staff">
            <div class="bar-wrap">
              <div class="bar-fill${isLatest ? ' highlight' : ''}" style="height:${pct}%"></div>
            </div>
            <span class="bar-label" style="${isLatest ? 'color:white; font-weight:600;' : ''}">${monthLabel}</span>
          </div>
        `;
      }).join('');
      
      growthChart.innerHTML = gridLinesHtml + barsHtml;
    }

    // Populate Bottom Table
    const tbody = document.getElementById('dash-table-body');
    const recentStaff = staffData.slice(0, 5); // Show first 5
    if (recentStaff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No staff found</td></tr>`;
    } else {
      tbody.innerHTML = recentStaff.map(s => {
        const isRegular = s.employment_type?.toLowerCase().includes('regular');
        const statusClass = isRegular ? 'status-regular' : 'status-contract';
        return `
          <tr>
            <td>
              <div class="staff-row-identity">
                ${staffAvatarHtml(s, 32)}
                <div class="staff-row-identity-text">
                  <span style="font-weight:500;">${s.full_name}</span>
                  <span class="staff-row-facility">${s.facility_name || ''}</span>
                </div>
              </div>
            </td>
            <td>${s.designation}</td>
            <td>${s.district}</td>
            <td><span class="status-pill ${statusClass}">${s.employment_type || 'Unknown'}</span></td>
            <td>
              <div class="row-actions">
                <button class="btn-edit" onclick="window._navigateTo('edit-staff', {staffId: ${s.id}})">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
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

  } catch (err) {
    showToast(`Failed to load dashboard data`, 'error');
    console.error(err);
  }
}
