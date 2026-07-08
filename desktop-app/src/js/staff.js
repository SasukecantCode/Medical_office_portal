/* ═══════════════════════════════════════════════════════
   Staff — CRUD UI (List, Create, Edit, Attachments)
   ═══════════════════════════════════════════════════════ */

import { api, clearStaffPhotoCache, getStaffPhotoObjectUrl } from './api.js';
import { showToast } from './animations.js';
import { renderVault } from './vault.js';

// ── State ──
let currentFilters = { q: '', designation: '' };
let currentOffset = 0;
const PAGE_LIMIT = 45;
let isLoadingMore = false;
let hasMoreStaff = true;
let editingStaffId = null;

// ── SVG Icons ──
const ICONS = {
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  upload: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  file: `📎`,
};

// ════════════════════════════════════════════
// Staff List
// ════════════════════════════════════════════
export async function renderStaffList(container) {
    container.innerHTML = `
    <div class="table-controls">
      <div class="search-box">
        ${ICONS.search}
        <input type="text" id="staff-search" placeholder="Search by name, designation, posting place..." value="${currentFilters.q}" />
      </div>
      <select class="filter-select" id="filter-designation">
        <option value="">All Designations</option>
      </select>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-scroll">
        <table class="data-table" id="staff-table">
          <thead>
            <tr>
              <th>ID Number</th>
              <th>Photo</th>
              <th>Name</th>
              <th>Father's Name</th>
              <th>Mother's Name</th>
              <th>Sex</th>
              <th>Age</th>
              <th>Designation</th>
              <th>Mode of Service</th>
              <th>Head</th>
              <th>Present Posting Place</th>
              <th>Date of Birth</th>
              <th>Appt. Order No & Dated</th>
              <th>Date of Joining</th>
              <th>Total Yrs in Service</th>
              <th>Date of Retirement</th>
              <th>1st MACP</th>
              <th>2nd MACP</th>
              <th>3rd MACP</th>
              <th>Basic Pay/Salary</th>
              <th>Permanent Address</th>
              <th>Present Address</th>
              <th>Contact Number</th>
              <th>Email ID</th>
              <th>Aadhaar No.</th>
              <th>PAN No.</th>
            </tr>
          </thead>
          <tbody id="staff-tbody">
            <tr><td colspan="26" style="padding: 60px 24px; text-align: left;">
              <div style="position: sticky; left: 24px; color: var(--clr-text-subtle); font-size: 1.1rem;">Loading...</div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Search with debounce
  let searchTimer;
  document.getElementById('staff-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentFilters.q = e.target.value;
      loadStaffTable(false);
    }, 350);
  });

  // Filter selects
  ['designation'].forEach((key) => {
    const select = document.getElementById(`filter-${key}`);
    select.addEventListener('change', (e) => {
      currentFilters[key] = e.target.value;
      loadStaffTable(false);
    });
  });

  // Event delegation for row clicks
  const tbody = document.getElementById('staff-tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('.staff-row');
      if (row && row.dataset.id) {
        showProfileCard(row.dataset.id);
      }
    });

    // Infinite scroll listener
    const tableContainer = tbody.closest('.table-container') || window;
    tableContainer.addEventListener('scroll', () => {
      const el = tableContainer === window ? document.documentElement : tableContainer;
      // Fetch more when scrolled within 100px of bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        if (!isLoadingMore && hasMoreStaff) {
          loadStaffTable(true);
        }
      }
    });
  }

  // Load initial data + populate filters
  await loadStaffTable(false);
  await populateFilters();
}

async function loadStaffTable(append = false) {
  const tbody = document.getElementById('staff-tbody');
  if (!tbody) return;

  if (!append) {
    currentOffset = 0;
    hasMoreStaff = true;
    tbody.innerHTML = `<tr><td colspan="26" style="padding: 60px 24px; text-align: left;"><div style="position: sticky; left: 24px; color: var(--clr-text-subtle); font-size: 1.1rem;">Loading...</div></td></tr>`;
  }

  if (isLoadingMore || !hasMoreStaff) return;
  isLoadingMore = true;

  try {
    const filters = { ...currentFilters, skip: currentOffset, limit: PAGE_LIMIT };
    const staff = await api.listStaff(filters);

    if (staff.length < PAGE_LIMIT) {
      hasMoreStaff = false;
    }

    if (staff.length === 0 && !append) {
      const isSearching = currentFilters.q || currentFilters.designation;
      const emptyMsg = isSearching ? "Not found" : "No staff records found. Add your first entry!";
      tbody.innerHTML = `
        <tr><td colspan="26" style="padding: 60px 24px; text-align: left;">
          <div style="position: sticky; left: 24px; color: var(--clr-text-subtle); font-size: 1.1rem;">${emptyMsg}</div>
        </td></tr>
      `;
      isLoadingMore = false;
      return;
    }

    const html = staff
      .map(
        (s) => `
      <tr data-id="${s.id}" style="cursor: pointer" class="staff-row">
        <td data-label="ID Number">${escHtml(s.display_id || s.id)}</td>
        <td data-label="Photo">${staffAvatarHtml(s, 32)}</td>
        <td data-label="Name"><strong>${escHtml(s.full_name)}</strong></td>
        <td data-label="Father's Name">${escHtml(s.fathers_name || '-')}</td>
        <td data-label="Mother's Name">${escHtml(s.mothers_name || '-')}</td>
        <td data-label="Sex">${escHtml(s.gender || '-')}</td>
        <td data-label="Age">${s.age != null ? s.age : '-'}</td>
        <td data-label="Designation">${escHtml(s.designation || '')}</td>
        <td data-label="Mode of Service">${escHtml(s.mode_of_service || '-')}</td>
        <td data-label="Head">${escHtml(s.head || '-')}</td>
        <td data-label="Present Posting Place">${escHtml(s.present_posting_place || '-')}</td>
        <td data-label="Date of Birth">${formatDate(s.date_of_birth)}</td>
        <td data-label="Appt. Order">${escHtml(s.appointment_order_no || '-')}</td>
        <td data-label="Date of Joining">${formatDate(s.date_of_joining)}</td>
        <td data-label="Total Yrs">${s.total_years_in_service != null ? s.total_years_in_service : '-'}</td>
        <td data-label="Retirement">${formatDate(s.date_of_retirement)}</td>
        <td data-label="1st MACP">${formatDate(s.first_macp)}</td>
        <td data-label="2nd MACP">${formatDate(s.second_macp)}</td>
        <td data-label="3rd MACP">${formatDate(s.third_macp)}</td>
        <td data-label="Basic Pay">${escHtml(s.present_basic_pay || '-')}</td>
        <td data-label="Permanent Address">${escHtml(s.permanent_address || '-')}</td>
        <td data-label="Present Address">${escHtml(s.present_address || '-')}</td>
        <td data-label="Contact">${escHtml(s.phone || '-')}</td>
        <td data-label="Email">${escHtml(s.email || '-')}</td>
        <td data-label="Aadhaar">${escHtml(s.aadhaar_number || '-')}</td>
        <td data-label="PAN">${escHtml(s.pan_number || '-')}</td>
      </tr>
    `
      )
      .join('');

    if (append) {
      tbody.insertAdjacentHTML('beforeend', html);
    } else {
      tbody.innerHTML = html;
    }
    
    currentOffset += staff.length;

    await hydrateStaffPhotos(tbody);
  } catch (err) {
    showToast(`Failed to load staff: ${err.message}`, 'error');
    if (!append) {
      tbody.innerHTML = `<tr><td colspan="26" style="text-align:center; padding:40px; color:#DC2626;">Error loading data</td></tr>`;
    }
  } finally {
    isLoadingMore = false;
  }
}

async function populateFilters() {
  try {
    const data = await api.dashboard();

    populateSelect('filter-designation', data.by_designation);
  } catch {
    // Filters will just stay empty — non-critical
  }
}

function populateSelect(id, items) {
  const select = document.getElementById(id);
  if (!select || !items) return;

  items
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach((item) => {
      if (item.key === '(blank)') return;
      const opt = document.createElement('option');
      opt.value = item.key;
      opt.textContent = `${item.key} (${item.count})`;
      select.appendChild(opt);
    });
}

// ════════════════════════════════════════════
// Profile Card Modal
// ════════════════════════════════════════════
async function showProfileCard(staffId) {
  try {
    const s = await api.getStaff(staffId);
    
    // Remove any existing modal
    const existing = document.getElementById('profile-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'profile-modal-overlay';
    
    // Standard fields to display
    const coreFields = [
      { label: 'ID Number', val: s.display_id },
      { label: 'Father\'s Name', val: s.fathers_name },
      { label: 'Mother\'s Name', val: s.mothers_name },
      { label: 'Sex', val: s.gender },
      { label: 'Date of Birth', val: s.date_of_birth },
      { label: 'Age', val: s.age },
      { label: 'Designation', val: s.designation },
      { label: 'Mode of Service', val: s.mode_of_service },
      { label: 'Head', val: s.head },
      { label: 'Present Posting Place', val: s.present_posting_place },
      { label: 'Appointment Order No & Dated', val: s.appointment_order_no },
      { label: 'Date of Joining', val: s.date_of_joining },
      { label: 'Total Year in Service', val: s.total_years_in_service },
      { label: 'Date of Retirement', val: s.date_of_retirement },
      { label: 'Date of 1st MACP', val: s.first_macp },
      { label: 'Date of 2nd MACP', val: s.second_macp },
      { label: 'Date of 3rd MACP', val: s.third_macp },
      { label: 'Present Basic Pay/Salary', val: s.present_basic_pay },
      { label: 'Permanent Address', val: s.permanent_address },
      { label: 'Present Address', val: s.present_address },
      { label: 'Contact Number', val: s.phone },
      { label: 'Email ID', val: s.email },
      { label: 'Aadhaar Card Number', val: s.aadhaar_number },
      { label: 'PAN Card Number', val: s.pan_number },
    ];

    // Combine with dynamic extra fields
    const extraFields = Object.entries(s.extra || {}).map(([key, val]) => ({
      label: key.replace(/_/g, ' '),
      val: val
    }));

    const allFields = [...coreFields, ...extraFields].filter(f => f.val && String(f.val).trim() !== '');
    const mayHavePhoto = staffHasPhoto(s) || s.id;

    const fieldsHtml = allFields.map(f => `
      <div class="profile-field">
        <span class="profile-field-label">${escHtml(f.label)}</span>
        <span class="profile-field-value">${escHtml(String(f.val))}</span>
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="profile-card">
        <div class="profile-card-header">
          <button type="button" class="profile-card-close" aria-label="Close">✕</button>
          <div class="profile-card-avatar staff-avatar${mayHavePhoto ? ' staff-avatar--pending' : ''}" style="width:80px;height:80px;">
            <span class="staff-avatar-initial" aria-hidden="true">${s.full_name.charAt(0).toUpperCase()}</span>
          </div>
          <div class="profile-card-title">
            <h2>${escHtml(s.full_name)}</h2>
            <p>${escHtml(s.designation || 'Staff Member')} • ${escHtml(s.present_posting_place || 'N/A')}</p>
          </div>
        </div>
        <div class="profile-card-body">
          <div class="profile-grid">
            ${fieldsHtml}
          </div>
        </div>
        <div class="profile-card-footer">
          <div class="row-actions">
            <button class="btn-edit" data-action="edit" data-id="${s.id}">Edit Profile</button>
            <button class="btn-attach" data-action="attach" data-id="${s.id}" data-name="${escAttr(s.full_name)}">Files</button>
            <button class="btn-word" data-action="word" data-id="${s.id}" data-name="${escAttr(s.full_name)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Staff Correspondence File
            </button>
            <button class="btn-notesheet" data-action="notesheet" data-id="${s.id}" data-name="${escAttr(s.full_name)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; vertical-align:middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Notesheet
            </button>
            <button class="btn-delete" data-action="delete" data-id="${s.id}" data-name="${escAttr(s.full_name)}">Delete</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const avatarEl = modal.querySelector('.profile-card-avatar');
    if (avatarEl) {
      await applyStaffPhotoToElement(avatarEl, s);
    }

    // Animate in
    requestAnimationFrame(() => modal.classList.add('open'));

    // Event listeners
    const close = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.profile-card-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    // Attach row action listeners to the buttons in the footer
    modal.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        close();
        handleRowAction(e);
      });
    });

  } catch (err) {
    showToast(`Failed to load profile: ${err.message}`, 'error');
  }
}


async function handleRowAction(e) {
  const action = e.currentTarget.dataset.action;
  const id = parseInt(e.currentTarget.dataset.id);
  const name = e.currentTarget.dataset.name;

  if (action === 'edit') {
    window._navigateTo('edit-staff', { staffId: id });
  } else if (action === 'delete') {
    showDeleteConfirm(id, name);
  } else if (action === 'attach') {
    // Fetch full staff data for the vault header (photo, etc.)
    let staffData = {};
    try { staffData = await api.getStaff(id); } catch { /* ok */ }
    window._navigateTo('attachments', { staffId: id, staffName: name, staffData });
  } else if (action === 'word' || action === 'notesheet') {
    const docTitle = action === 'word' ? 'Staff Correspondence File' : 'Notesheet';
    try {
      showToast(`Opening ${docTitle}...`, 'info', 2000);
      // Determine employee dynamically
      const safeName = (name || 'Unknown').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
      const empIdRaw = `EMP${String(id).padStart(3, '0')}`;
      const empId = `${safeName}_${empIdRaw}`;
      
      const data = await api.listDrafts(empId);
      let draftId;
      if (data && data.drafts && data.drafts.length > 0) {
        // Look for existing draft by title
        const existingDraft = data.drafts.find(d => d.title === docTitle);
        if (existingDraft) {
          draftId = existingDraft.draft_id;
        }
      }
      
      if (!draftId) {
        const title = docTitle;
        const draft = await api.createDraft(empId, title);
        draftId = draft.draft_id;
      }
      
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core || window.__TAURI__.tauri || window.__TAURI__;
        const downloadUrl = `http://127.0.0.1:8000/api/documents/drafts/${encodeURIComponent(empId)}/${encodeURIComponent(draftId)}/source`;
        const uploadUrl = `http://127.0.0.1:8000/api/documents/drafts/${encodeURIComponent(empId)}/${encodeURIComponent(draftId)}/content`;
        
        await invoke('edit_document', {
          employeeId: empId,
          draftId: draftId,
          filename: `${docTitle.replace(/\s+/g, '_')}.docx`,
          downloadUrl,
          uploadUrl
        });
      } else {
        showToast('Document ready! Open in Desktop App to edit.', 'success');
      }
    } catch (err) {
      showToast(`Failed to open document: ${err.message}`, 'error');
    }
  }
}

// ════════════════════════════════════════════
// Delete Confirmation Modal
// ════════════════════════════════════════════
function showDeleteConfirm(id, name) {
  // Remove existing
  const existing = document.getElementById('delete-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'delete-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Confirm Delete</h3>
        <button type="button" class="modal-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <p>Are you sure you want to delete <strong>${escHtml(name)}</strong>? This action cannot be easily undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="delete-cancel">Cancel</button>
        <button class="btn btn-danger" id="delete-confirm">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Close handlers
  const close = () => {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.modal-close-btn').addEventListener('click', close);
  document.getElementById('delete-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.getElementById('delete-confirm').addEventListener('click', async () => {
    try {
      await api.deleteStaff(id);
      showToast(`${name} has been deleted.`, 'success');
      close();
      loadStaffTable();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  });
}

// ════════════════════════════════════════════
// Staff Form (Create / Edit)
// ════════════════════════════════════════════
export async function renderStaffForm(container, staffId = null) {
  editingStaffId = staffId;
  let staffData = {};

  let fieldDefs = [];
  try {
    fieldDefs = await api.listFieldDefs();
    fieldDefs = Array.isArray(fieldDefs) ? fieldDefs : [];
  } catch {
    fieldDefs = [];
  }

  if (staffId) {
    try {
      staffData = await api.getStaff(staffId);
    } catch (err) {
      showToast(`Failed to load staff data: ${err.message}`, 'error');
      return;
    }
  }

  const customFieldsHtml = renderCustomFieldsHtml(fieldDefs, staffData?.extra || {});

  const isEdit = !!staffId;
  const hasExistingPhoto = staffHasPhoto(staffData);
  const photoRequired = false; // Profile photo is no longer mandatory

  let selectedSpan = 60;
  if (staffData.date_of_birth && staffData.date_of_retirement) {
    const d1 = new Date(staffData.date_of_birth);
    const d2 = new Date(staffData.date_of_retirement);
    const diff = d2.getFullYear() - d1.getFullYear();
    if (diff === 62) {
      selectedSpan = 62;
    }
  }

  container.innerHTML = `
    <div class="staff-form-container">
      <div class="staff-form-header">
        <h3>${isEdit ? 'Edit Staff Record' : 'Add New Staff'}</h3>
        <button class="btn btn-ghost" id="form-back-btn">← Back to List</button>
      </div>
      <form id="staff-form">
        <div class="staff-form-body">
          <div class="form-grid">
            <!-- Personal Info -->
            <div class="form-group">
              <label class="form-label">Name <span class="required">*</span></label>
              <input class="form-input" name="full_name" required value="${escAttr(staffData.full_name || '')}" placeholder="Enter full name" />
            </div>
            <div class="form-group">
              <label class="form-label">Father's Name</label>
              <input class="form-input" name="fathers_name" value="${escAttr(staffData.fathers_name || '')}" placeholder="Enter father's name" />
            </div>
            <div class="form-group">
              <label class="form-label">Mother's Name</label>
              <input class="form-input" name="mothers_name" value="${escAttr(staffData.mothers_name || '')}" placeholder="Enter mother's name" />
            </div>
            <div class="form-group">
              <label class="form-label">Sex</label>
              <select class="form-input" name="gender">
                <option value="">Select...</option>
                <option ${staffData.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option ${staffData.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option ${staffData.gender === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date of Birth</label>
              <input class="form-input" name="date_of_birth" type="date" value="${staffData.date_of_birth || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Age</label>
              <input class="form-input" name="age" value="${staffData.age != null ? staffData.age : ''}" readonly tabindex="-1" style="opacity:0.7; cursor:default;" />
            </div>

            <!-- Service Details -->
            <hr class="form-section-divider form-grid-full" />
            <div class="form-group">
              <label class="form-label">Designation <span class="required">*</span></label>
              <input class="form-input" name="designation" required value="${escAttr(staffData.designation || '')}" placeholder="e.g., Doctor, Nurse" />
            </div>
            <div class="form-group">
              <label class="form-label">Mode of Service</label>
              <select class="form-input" name="mode_of_service">
                <option value="">Select...</option>
                <option ${staffData.mode_of_service === 'Regular' ? 'selected' : ''}>Regular</option>
                <option ${staffData.mode_of_service === 'Contractual' ? 'selected' : ''}>Contractual</option>
                <option ${staffData.mode_of_service === 'Contigency' ? 'selected' : ''}>Contigency</option>
                <option ${staffData.mode_of_service === 'MLA Led' ? 'selected' : ''}>MLA Led</option>
                <option ${staffData.mode_of_service === 'Temporary' ? 'selected' : ''}>Temporary</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Head</label>
              <select class="form-input" name="head">
                <option value="">Select...</option>
                <option ${staffData.head === 'Plan' ? 'selected' : ''}>Plan</option>
                <option ${staffData.head === 'Non Plan' ? 'selected' : ''}>Non Plan</option>
                <option ${staffData.head === 'NHM' ? 'selected' : ''}>NHM</option>
                <option ${staffData.head === 'IDSP' ? 'selected' : ''}>IDSP</option>
                <option ${staffData.head === 'NVBDCP' ? 'selected' : ''}>NVBDCP</option>
                <option ${staffData.head === 'NTEP' ? 'selected' : ''}>NTEP</option>
                <option ${staffData.head === 'NCD' ? 'selected' : ''}>NCD</option>
                <option ${staffData.head === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Present Posting Place</label>
              <input class="form-input" name="present_posting_place" value="${escAttr(staffData.present_posting_place || '')}" placeholder="Posting place" />
            </div>
            <div class="form-group form-grid-full">
              <label class="form-label">Appointment Order No & Dated</label>
              <input class="form-input" name="appointment_order_no" value="${escAttr(staffData.appointment_order_no || '')}" placeholder="Order number and date" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of Joining</label>
              <input class="form-input" name="date_of_joining" type="date" value="${staffData.date_of_joining || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Total Year in Service</label>
              <input class="form-input" name="total_years_in_service" value="${staffData.total_years_in_service != null ? staffData.total_years_in_service : ''}" readonly tabindex="-1" style="opacity:0.7; cursor:default;" />
            </div>

            <!-- Auto-Calculated Dates -->
            <hr class="form-section-divider form-grid-full" />
            <div class="form-group">
              <label class="form-label">Span of Service</label>
              <select class="form-input" id="form-service-span">
                <option value="60" ${selectedSpan === 60 ? 'selected' : ''}>60 years service</option>
                <option value="62" ${selectedSpan === 62 ? 'selected' : ''}>62 years service</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date of Retirement</label>
              <input class="form-input" name="date_of_retirement" type="date" value="${staffData.date_of_retirement || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of 1st MACP</label>
              <input class="form-input" name="first_macp" type="date" value="${staffData.first_macp || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of 2nd MACP</label>
              <input class="form-input" name="second_macp" type="date" value="${staffData.second_macp || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of 3rd MACP</label>
              <input class="form-input" name="third_macp" type="date" value="${staffData.third_macp || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Present Basic Pay / Salary</label>
              <input class="form-input" name="present_basic_pay" value="${escAttr(staffData.present_basic_pay || '')}" placeholder="e.g., 56100" />
            </div>

            <!-- Address & Contact -->
            <hr class="form-section-divider form-grid-full" />
            <div class="form-group form-grid-full">
              <label class="form-label">Permanent Address</label>
              <textarea class="form-input" name="permanent_address" rows="2" placeholder="Permanent address...">${escHtml(staffData.permanent_address || '')}</textarea>
            </div>
            <div class="form-group form-grid-full">
              <label class="form-label">Present Address</label>
              <textarea class="form-input" name="present_address" rows="2" placeholder="Present address...">${escHtml(staffData.present_address || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Number</label>
              <input class="form-input" name="phone" type="tel" inputmode="numeric" value="${escAttr(staffData.phone || '')}" placeholder="+91XXXXXXXXXX" />
            </div>
            <div class="form-group">
              <label class="form-label">Email ID</label>
              <input class="form-input" name="email" type="email" value="${escAttr(staffData.email || '')}" placeholder="email@example.com" />
            </div>

            <!-- Identity Documents -->
            <hr class="form-section-divider form-grid-full" />
            <div class="form-group">
              <label class="form-label">Aadhaar Card Number</label>
              <input class="form-input" name="aadhaar_number" value="${escAttr(staffData.aadhaar_number || '')}" placeholder="XXXX XXXX XXXX" maxlength="14" />
            </div>
            <div class="form-group">
              <label class="form-label">PAN Card Number</label>
              <input class="form-input" name="pan_number" value="${escAttr(staffData.pan_number || '')}" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase;" />
            </div>

            <!-- Remarks -->
            <div class="form-group form-grid-full">
              <label class="form-label">Remarks</label>
              <textarea class="form-input" name="remarks" rows="2" placeholder="Any additional remarks...">${escHtml(staffData.remarks || '')}</textarea>
            </div>
            ${customFieldsHtml ? `<div class="form-group form-grid-full">${customFieldsHtml}</div>` : ''}


            <hr class="form-section-divider form-grid-full" />

            <div class="form-group form-grid-full">
              <label class="form-label">Profile Photo (JPEG) ${photoRequired ? '<span class="required">*</span>' : ''}</label>
              <div style="display:flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <div id="form-photo-preview" class="staff-avatar" style="width:72px; height:72px; border-radius: 14px;"${hasExistingPhoto ? ` data-photo-staff-id="${staffId}" data-photo-version="${staffData.updated_at ? new Date(staffData.updated_at).getTime() : staffId}"` : ''}>
                  <span class="staff-avatar-initial" style="font-size:12px; color: var(--clr-text-subtle);">${hasExistingPhoto ? '' : 'No photo'}</span>
                </div>
                <div style="flex:1; min-width: 240px; display:flex; flex-direction:column; gap:8px;">
                  <input class="form-input" id="profile-photo" type="file" accept="image/jpeg" ${photoRequired ? 'required' : ''} />
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <small style="color: var(--clr-text-subtle); font-size: 11px;">JPEG only. ${isEdit ? 'Choose a file to replace the current photo.' : 'Optional.'}</small>
                    ${hasExistingPhoto ? `<button type="button" class="btn btn-ghost" id="delete-photo-btn" style="color: #ef4444; padding: 4px 8px; font-size: 11px; height: auto;">Delete Photo</button>` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group form-grid-full">
              <label class="form-label">Documents (optional)</label>
              <input class="form-input" id="doc-files" type="file" multiple />
              <small style="color: var(--clr-text-subtle); font-size: 11px;">Uploads after the record is saved.</small>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="form-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-teal" id="form-submit-btn">${isEdit ? 'Update Record' : 'Create Record'}</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('form-back-btn').addEventListener('click', () => window._navigateTo('staff-list'));
  document.getElementById('form-cancel-btn').addEventListener('click', () => window._navigateTo('staff-list'));

  container.querySelectorAll('.form-group').forEach((group) => {
    const input = group.querySelector('input, select, textarea');
    if (!input) return;
    input.addEventListener('focus', () => group.classList.add('focused'));
    input.addEventListener('blur', () => group.classList.remove('focused'));
  });

  attachPhonePrefixHandlers(container);

  const formPreview = document.getElementById('form-photo-preview');
  if (formPreview?.dataset.photoStaffId) {
    await hydrateStaffPhotos(formPreview.parentElement);
  }

  const deletePhotoBtn = document.getElementById('delete-photo-btn');
  if (deletePhotoBtn) {
    deletePhotoBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete the profile photo?')) return;
      deletePhotoBtn.disabled = true;
      try {
        await api.deleteProfilePhoto(staffId);
        clearStaffPhotoCache();
        showToast('Profile photo deleted.', 'success');
        
        // Remove the visual preview
        if (formPreview) {
          const img = formPreview.querySelector('img');
          if (img) img.remove();
          formPreview.classList.remove('has-photo');
          const initial = formPreview.querySelector('.staff-avatar-initial');
          if (initial) initial.textContent = 'No photo';
          delete formPreview.dataset.photoStaffId;
          delete formPreview.dataset.photoVersion;
        }
        deletePhotoBtn.remove();
      } catch (err) {
        showToast(`Failed to delete photo: ${err.message}`, 'error');
        deletePhotoBtn.disabled = false;
      }
    });
  }

  // Live auto-calculation
  function calculateAutoFields() {
    const form = document.getElementById('staff-form');
    if (!form) return;

    const dob = form.querySelector('[name="date_of_birth"]').value;
    const doj = form.querySelector('[name="date_of_joining"]').value;
    const spanSelect = form.querySelector('#form-service-span').value;

    const ageField = form.querySelector('[name="age"]');
    const totalYearsField = form.querySelector('[name="total_years_in_service"]');
    const firstMacpField = form.querySelector('[name="first_macp"]');
    const secondMacpField = form.querySelector('[name="second_macp"]');
    const thirdMacpField = form.querySelector('[name="third_macp"]');
    const retirementField = form.querySelector('[name="date_of_retirement"]');

    const today = new Date();

    if (dob) {
      const d = new Date(dob);
      let age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
      ageField.value = age;

      const retAge = parseInt(spanSelect, 10) || 60;
      const retDate = new Date(d);
      retDate.setFullYear(d.getFullYear() + retAge);
      retirementField.value = retDate.toISOString().split('T')[0];
    } else {
      ageField.value = '';
      retirementField.value = '';
    }

    if (doj) {
      const j = new Date(doj);
      let years = today.getFullYear() - j.getFullYear();
      const m = today.getMonth() - j.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < j.getDate())) years--;
      totalYearsField.value = years;

      const m1 = new Date(j); m1.setFullYear(j.getFullYear() + 10);
      firstMacpField.value = m1.toISOString().split('T')[0];

      const m2 = new Date(m1); m2.setFullYear(m1.getFullYear() + 10);
      secondMacpField.value = m2.toISOString().split('T')[0];

      const m3 = new Date(m2); m3.setFullYear(m2.getFullYear() + 10);
      thirdMacpField.value = m3.toISOString().split('T')[0];
    } else {
      totalYearsField.value = '';
      firstMacpField.value = '';
      secondMacpField.value = '';
      thirdMacpField.value = '';
    }
  }

  container.querySelector('[name="date_of_birth"]').addEventListener('input', calculateAutoFields);
  container.querySelector('[name="date_of_joining"]').addEventListener('input', calculateAutoFields);
  const spanEl = container.querySelector('#form-service-span');
  if (spanEl) spanEl.addEventListener('change', calculateAutoFields);

  document.getElementById('staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {};

    for (const [k, v] of formData.entries()) {
      if (k.startsWith('custom__')) continue;
      const val = v.toString().trim();
      if (val === '') continue;
      payload[k] = val;
    }

    if (payload.phone) {
      payload.phone = normalizePhoneValue(payload.phone);
    }

    // Merge custom field values into `extra`
    const customValues = extractCustomFieldValues(fieldDefs, formData);
    const baseExtra = staffData?.extra && typeof staffData.extra === 'object' && !Array.isArray(staffData.extra) ? staffData.extra : {};
    if (Object.keys(customValues).length > 0 || Object.keys(baseExtra).length > 0) {
      payload.extra = { ...baseExtra, ...customValues };
    }

    const submitBtn = document.getElementById('form-submit-btn');
    const submitLabel = submitBtn.textContent;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      if (isEdit) {
        await api.updateStaff(staffId, payload);

        const photoFile = document.getElementById('profile-photo')?.files?.[0];
        if (photoFile) {
          await api.uploadProfilePhoto(staffId, photoFile);
          clearStaffPhotoCache();
        }

        const docInput = document.getElementById('doc-files');
        const docs = docInput?.files ? Array.from(docInput.files) : [];
        for (const file of docs) {
          await api.uploadAttachment(staffId, file);
        }

        showToast('Staff record updated successfully.', 'success');
      } else {
        const created = await api.createStaff(payload);

        const photoFile = document.getElementById('profile-photo')?.files?.[0];
        if (photoFile) {
          await api.uploadProfilePhoto(created.id, photoFile);
          clearStaffPhotoCache();
        }

        const docInput = document.getElementById('doc-files');
        const docs = docInput?.files ? Array.from(docInput.files) : [];
        for (const file of docs) {
          await api.uploadAttachment(created.id, file);
        }

        showToast('Staff record created successfully.', 'success');
      }
      window._navigateTo('staff-list');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
      submitBtn.classList.remove('loading');
      submitBtn.textContent = submitLabel;
      submitBtn.disabled = false;
    }
  });
}

function renderCustomFieldsHtml(fieldDefs, extra) {
  if (!Array.isArray(fieldDefs) || fieldDefs.length === 0) return '';

  const defs = [...fieldDefs]
    .filter((d) => d && d.name)
    .sort((a, b) => {
      const ao = Number.isFinite(a.sort_order) ? a.sort_order : 0;
      const bo = Number.isFinite(b.sort_order) ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.label || a.name).localeCompare(String(b.label || b.name));
    });

  return defs
    .map((def) => {
      const name = String(def.name);
      const label = String(def.label || def.name);
      const required = !!def.required;
      const dataType = String(def.data_type || 'string');
      const isEmergency = isEmergencyContactField(name, label);
      const effectiveType = dataType === 'phone' || isEmergency ? 'phone' : dataType;
      const currentValue = extra && typeof extra === 'object' ? extra[name] : undefined;

      const inputName = `custom__${name}`;
      const requiredMark = required ? '<span class="required">*</span>' : '';

      if (effectiveType === 'number') {
        const v = currentValue === null || currentValue === undefined ? '' : String(currentValue);
        return `
          <div class="form-group">
            <label class="form-label">${escHtml(label)} ${requiredMark}</label>
            <input class="form-input" name="${escAttr(inputName)}" type="number" step="any" ${required ? 'required' : ''} value="${escAttr(v)}" />
          </div>
        `;
      }

      if (effectiveType === 'date') {
        const v = currentValue === null || currentValue === undefined ? '' : String(currentValue);
        return `
          <div class="form-group">
            <label class="form-label">${escHtml(label)} ${requiredMark}</label>
            <input class="form-input" name="${escAttr(inputName)}" type="date" ${required ? 'required' : ''} value="${escAttr(v)}" />
          </div>
        `;
      }

      if (effectiveType === 'boolean') {
        const val = currentValue === true ? 'true' : currentValue === false ? 'false' : '';
        return `
          <div class="form-group">
            <label class="form-label">${escHtml(label)} ${requiredMark}</label>
            <select class="form-input" name="${escAttr(inputName)}" ${required ? 'required' : ''}>
              <option value="">Select...</option>
              <option value="true" ${val === 'true' ? 'selected' : ''}>Yes</option>
              <option value="false" ${val === 'false' ? 'selected' : ''}>No</option>
            </select>
          </div>
        `;
      }

      if (effectiveType === 'phone') {
        const v = currentValue === null || currentValue === undefined ? '' : normalizePhoneValue(String(currentValue));
        return `
          <div class="form-group">
            <label class="form-label">${escHtml(label)} ${requiredMark}</label>
            <input class="form-input" name="${escAttr(inputName)}" type="tel" inputmode="numeric" pattern="\+91\d*" data-phone-prefix="true" ${required ? 'required' : ''} value="${escAttr(v)}" />
          </div>
        `;
      }

      // Default: string
      const v = currentValue === null || currentValue === undefined ? '' : String(currentValue);
      return `
        <div class="form-group">
          <label class="form-label">${escHtml(label)} ${requiredMark}</label>
          <input class="form-input" name="${escAttr(inputName)}" ${required ? 'required' : ''} value="${escAttr(v)}" />
        </div>
      `;
    })
    .join('');
}

function extractCustomFieldValues(fieldDefs, formData) {
  const out = {};
  if (!Array.isArray(fieldDefs) || fieldDefs.length === 0) return out;

  for (const def of fieldDefs) {
    if (!def || !def.name) continue;
    const name = String(def.name);
    const inputName = `custom__${name}`;
    const raw = formData.get(inputName);
    if (raw == null) continue;
    const text = raw.toString().trim();
    if (text === '') continue;

    const dataType = String(def.data_type || 'string');
    const label = String(def.label || def.name || '');
    const isEmergency = isEmergencyContactField(name, label);
    const effectiveType = dataType === 'phone' || isEmergency ? 'phone' : dataType;
    if (effectiveType === 'number') {
      const n = Number(text);
      if (!Number.isNaN(n)) out[name] = n;
      continue;
    }

    if (effectiveType === 'boolean') {
      const low = text.toLowerCase();
      if (low === 'true' || low === '1' || low === 'yes' || low === 'y') out[name] = true;
      else if (low === 'false' || low === '0' || low === 'no' || low === 'n') out[name] = false;
      else out[name] = text;
      continue;
    }

    if (effectiveType === 'phone') {
      out[name] = normalizePhoneValue(text);
      continue;
    }

    // For date/string, store as string
    out[name] = text;
  }

  return out;
}

function attachPhonePrefixHandlers(container) {
  if (!container) return;
  const inputs = container.querySelectorAll('input[name="phone"], input[data-phone-prefix="true"]');
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      const normalized = normalizePhoneValue(input.value || '');
      if (normalized) {
        input.value = normalized;
      }
    });
    input.addEventListener('blur', () => {
      const normalized = normalizePhoneValue(input.value || '');
      if (normalized) {
        input.value = normalized;
      }
    });
  });
}

function normalizePhoneValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const digitsOnly = raw.replace(/\D+/g, '');
  const withoutPrefix = digitsOnly.replace(/^91/, '');
  if (!withoutPrefix) return '+91';
  return `+91${withoutPrefix}`;
}

function isEmergencyContactField(name, label) {
  const joined = `${name} ${label}`.toLowerCase();
  return (joined.includes('emergency') || joined.includes('emergancy')) && joined.includes('contact');
}

// ════════════════════════════════════════════
// Attachments / Document Vault
// ════════════════════════════════════════════
export async function renderAttachments(container, staffId, staffName, staffData) {
  return renderVault(container, staffId, staffName, staffData);
}



// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

export function staffHasPhoto(staff) {
  return Boolean(staff?.photo_url || staff?.profile_photo_stored_filename);
}

function staffPhotoCacheKey(staff) {
  if (!staff?.id) return '';
  return staff.updated_at ? String(new Date(staff.updated_at).getTime()) : String(staff.id);
}

function loadImageFromUrl(img, url) {
  return new Promise((resolve) => {
    if (img.src === url && img.complete && img.naturalWidth > 0) {
      resolve(true);
      return;
    }
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Load authenticated profile photos into elements marked with data-photo-staff-id. */
export async function hydrateStaffPhotos(root = document) {
  const nodes = root.querySelectorAll('[data-photo-staff-id]');
  await Promise.all(
    [...nodes].map(async (el) => {
      const staffId = el.dataset.photoStaffId;
      if (!staffId) return;

      const objectUrl = await getStaffPhotoObjectUrl(staffId, el.dataset.photoVersion || '');
      if (!objectUrl) return;

      let img = el.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = el.getAttribute('title') || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        el.appendChild(img);
      }

      const ok = await loadImageFromUrl(img, objectUrl);
      if (ok) {
        el.classList.add('has-photo');
        el.classList.remove('staff-avatar--pending');
      } else {
        img.remove();
        el.classList.remove('has-photo', 'staff-avatar--pending');
      }
    })
  );
}

/** Profile modal / large avatars — always try fetch when we have a staff id. */
export async function applyStaffPhotoToElement(el, staff) {
  if (!el || !staff?.id) return false;

  const version = staffPhotoCacheKey(staff);
  el.dataset.photoStaffId = String(staff.id);
  el.dataset.photoVersion = version;

  const objectUrl = await getStaffPhotoObjectUrl(staff.id, version);
  if (!objectUrl) return false;

  let img = el.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = staff.full_name || '';
    el.appendChild(img);
  }

  const ok = await loadImageFromUrl(img, objectUrl);
  if (ok) {
    el.classList.add('has-photo');
    el.classList.remove('staff-avatar--pending');
    return true;
  }

  img.remove();
  el.classList.remove('has-photo', 'staff-avatar--pending');
  return false;
}

/** Authenticated blob URL for ID cards / print (not for raw img src without hydrate). */
export async function resolveStaffPhotoObjectUrl(staff) {
  if (!staffHasPhoto(staff) || !staff?.id) return null;
  return getStaffPhotoObjectUrl(staff.id, staffPhotoCacheKey(staff));
}

/** @deprecated Use hydrateStaffPhotos; kept for callers that check presence only */
export function resolveStaffPhotoUrl(staff) {
  return staffHasPhoto(staff) ? `staff:${staff.id}` : null;
}

/** Circular avatar: profile JPEG when uploaded, otherwise initial letter */
export function staffAvatarHtml(staff, size = 32) {
  const name = staff?.full_name || '';
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const px = `${size}px`;
  const hasPhoto = staffHasPhoto(staff);
  const photoAttrs = hasPhoto
    ? ` data-photo-staff-id="${staff.id}" data-photo-version="${escAttr(staffPhotoCacheKey(staff))}"`
    : '';

  return `
    <span class="staff-avatar${hasPhoto ? ' staff-avatar--pending' : ''}" style="width:${px};height:${px};"${photoAttrs} data-initial="${escAttr(initial)}" title="${escAttr(name)}">
      <span class="staff-avatar-initial" aria-hidden="true">${escHtml(initial)}</span>
    </span>
  `;
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoStr.replace('T', ' ').slice(0, 16);
  }
}
