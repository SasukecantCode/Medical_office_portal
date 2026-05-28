/* ═══════════════════════════════════════════════════════
   Staff — CRUD UI (List, Create, Edit, Attachments)
   ═══════════════════════════════════════════════════════ */

import { api } from './api.js';
import { showToast } from './animations.js';

// ── State ──
let currentFilters = { q: '', district: '', designation: '', employment_type: '', limit: 50 };
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
        <input type="text" id="staff-search" placeholder="Search by name, designation, facility..." value="${currentFilters.q}" />
      </div>
      <select class="filter-select" id="filter-district">
        <option value="">All Districts</option>
      </select>
      <select class="filter-select" id="filter-designation">
        <option value="">All Designations</option>
      </select>
      <select class="filter-select" id="filter-employment">
        <option value="">All Types</option>
      </select>
    </div>

    <div class="data-table-wrapper">
      <table class="data-table" id="staff-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Photo</th>
            <th>Full Name</th>
            <th>Designation</th>
            <th>Facility</th>
            <th>District</th>
            <th>Employment</th>
            <th>Phone</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody id="staff-tbody">
          <tr><td colspan="9" style="text-align:center; padding:40px; color: var(--clr-text-subtle);">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Search with debounce
  let searchTimer;
  document.getElementById('staff-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentFilters.q = e.target.value;
      loadStaffTable();
    }, 350);
  });

  // Filter selects
  ['district', 'designation', 'employment'].forEach((key) => {
    const select = document.getElementById(`filter-${key}`);
    select.addEventListener('change', (e) => {
      const filterKey = key === 'employment' ? 'employment_type' : key;
      currentFilters[filterKey] = e.target.value;
      loadStaffTable();
    });
  });

  // Load initial data + populate filters
  await loadStaffTable();
  await populateFilters();
}

async function loadStaffTable() {
  const tbody = document.getElementById('staff-tbody');
  if (!tbody) return;

  try {
    const staff = await api.listStaff(currentFilters);

    if (staff.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="9" style="text-align:center; padding: 60px; color: var(--clr-text-subtle);">
          No staff records found. Add your first entry!
        </td></tr>
      `;
      return;
    }

    tbody.innerHTML = staff
      .map(
        (s) => `
      <tr data-id="${s.id}" style="cursor: pointer" class="staff-row">
        <td>${s.id}</td>
        <td>${staffAvatarHtml(s, 32)}</td>
        <td><strong>${escHtml(s.full_name)}</strong></td>
        <td>${escHtml(s.designation || '')}</td>
        <td>${escHtml(s.facility_name || '')}</td>
        <td>${escHtml(s.district || '')}</td>
        <td>${escHtml(s.employment_type || '')}</td>
        <td>${escHtml(s.phone || '-')}</td>
        <td>${formatDate(s.created_at)}</td>
      </tr>
    `
      )
      .join('');

    // Attach row action listeners for opening profile card
    tbody.querySelectorAll('.staff-row').forEach((row) => {
      row.addEventListener('click', () => showProfileCard(row.dataset.id));
    });
  } catch (err) {
    showToast(`Failed to load staff: ${err.message}`, 'error');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#DC2626;">Error loading data</td></tr>`;
  }
}

async function populateFilters() {
  try {
    const data = await api.dashboard();

    populateSelect('filter-district', data.by_district);
    populateSelect('filter-designation', data.by_designation);
    populateSelect('filter-employment', data.by_employment_type);
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
      { label: 'Designation', val: s.designation },
      { label: 'Facility', val: s.facility_name },
      { label: 'District', val: s.district },
      { label: 'Cadre', val: s.cadre },
      { label: 'Employment', val: s.employment_type },
      { label: 'Phone', val: s.phone },
      { label: 'Email', val: s.email },
      { label: 'Gender', val: s.gender },
      { label: 'DOB', val: s.date_of_birth },
    ];

    // Combine with dynamic extra fields
    const extraFields = Object.entries(s.extra || {}).map(([key, val]) => ({
      label: key.replace(/_/g, ' '),
      val: val
    }));

    const allFields = [...coreFields, ...extraFields].filter(f => f.val && String(f.val).trim() !== '');

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
          <div class="profile-card-avatar">
            ${s.photo_url ? `<img src="${s.photo_url}" alt="${escAttr(s.full_name)}" />` : `<span class="staff-avatar-initial">${s.full_name.charAt(0).toUpperCase()}</span>`}
          </div>
          <div class="profile-card-title">
            <h2>${escHtml(s.full_name)}</h2>
            <p>${escHtml(s.designation || 'Staff Member')} • ${escHtml(s.facility_name || 'N/A')}</p>
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
            <button class="btn-delete" data-action="delete" data-id="${s.id}" data-name="${escAttr(s.full_name)}">Delete</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

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
    window._navigateTo('attachments', { staffId: id, staffName: name });
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
  const photoRequired = !isEdit || !staffData.photo_url;

  container.innerHTML = `
    <div class="staff-form-container">
      <div class="staff-form-header">
        <h3>${isEdit ? 'Edit Staff Record' : 'Add New Staff'}</h3>
        <button class="btn btn-ghost" id="form-back-btn">← Back to List</button>
      </div>
      <form id="staff-form">
        <div class="staff-form-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Full Name <span class="required">*</span></label>
              <input class="form-input" name="full_name" required value="${escAttr(staffData.full_name || '')}" placeholder="Enter full name" />
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
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
            ${customFieldsHtml}
            <div class="form-group">
              <label class="form-label">Designation <span class="required">*</span></label>
              <input class="form-input" name="designation" required value="${escAttr(staffData.designation || '')}" placeholder="e.g., Doctor, Nurse" />
            </div>
            <div class="form-group">
              <label class="form-label">Cadre</label>
              <input class="form-input" name="cadre" value="${escAttr(staffData.cadre || '')}" placeholder="Cadre" />
            </div>
            <div class="form-group">
              <label class="form-label">Employment Type</label>
              <input class="form-input" name="employment_type" value="${escAttr(staffData.employment_type || '')}" placeholder="Regular / Contract / etc." />
            </div>
            <hr class="form-section-divider form-grid-full" />
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-input" name="phone" value="${escAttr(staffData.phone || '')}" placeholder="Phone number" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" name="email" type="email" value="${escAttr(staffData.email || '')}" placeholder="email@example.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Facility Name <span class="required">*</span></label>
              <input class="form-input" name="facility_name" required value="${escAttr(staffData.facility_name || '')}" placeholder="e.g., PHC Namsai" />
            </div>
            <div class="form-group">
              <label class="form-label">Facility Type</label>
              <input class="form-input" name="facility_type" value="${escAttr(staffData.facility_type || '')}" placeholder="PHC / CHC / DH / etc." />
            </div>
            <div class="form-group">
              <label class="form-label">District <span class="required">*</span></label>
              <input class="form-input" name="district" required value="${escAttr(staffData.district || '')}" placeholder="e.g., Namsai" />
            </div>
            <div class="form-group">
              <label class="form-label">Block</label>
              <input class="form-input" name="block" value="${escAttr(staffData.block || '')}" placeholder="Block name" />
            </div>
            <div class="form-group">
              <label class="form-label">Posting Place</label>
              <input class="form-input" name="posting_place" value="${escAttr(staffData.posting_place || '')}" placeholder="Posting place" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of Joining</label>
              <input class="form-input" name="date_of_joining" type="date" value="${staffData.date_of_joining || ''}" />
            </div>
            <div class="form-group form-grid-full">
              <label class="form-label">Remarks</label>
              <textarea class="form-input" name="remarks" rows="3" placeholder="Any additional remarks...">${escHtml(staffData.remarks || '')}</textarea>
            </div>
            <div class="form-group form-grid-full">
              <label class="form-label">Extra (JSON)</label>
              <textarea class="form-input" name="extra" rows="3" placeholder='{"key": "value"}'>${staffData.extra ? JSON.stringify(staffData.extra, null, 2) : ''}</textarea>
              <small style="color: var(--clr-text-subtle); font-size: 11px;">Must be valid JSON. Leave empty if not needed.</small>
            </div>

            <hr class="form-section-divider form-grid-full" />

            <div class="form-group form-grid-full">
              <label class="form-label">Profile Photo (JPEG) ${photoRequired ? '<span class="required">*</span>' : ''}</label>
              <div style="display:flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <div style="width:72px; height:72px; border-radius: 14px; overflow: hidden; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center;">
                  ${
                    staffData.photo_url
                      ? `<img src="${escAttr(staffData.photo_url)}" alt="Profile photo" style="width:100%; height:100%; object-fit: cover;" />`
                      : `<span style="color: var(--clr-text-subtle); font-size: 12px;">No photo</span>`
                  }
                </div>
                <div style="flex:1; min-width: 240px;">
                  <input class="form-input" id="profile-photo" type="file" accept="image/jpeg" ${photoRequired ? 'required' : ''} />
                  <small style="color: var(--clr-text-subtle); font-size: 11px;">JPEG only. ${isEdit ? 'Choose a file to replace the current photo.' : 'Required to create a record.'}</small>
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

    // Parse extra JSON
    if (payload.extra) {
      try {
        payload.extra = JSON.parse(payload.extra);
      } catch {
        showToast('Extra field must be valid JSON.', 'error');
        return;
      }
    }

    // Merge custom field values into `extra`
    const customValues = extractCustomFieldValues(fieldDefs, formData);
    if (Object.keys(customValues).length > 0) {
      const baseExtra = payload.extra && typeof payload.extra === 'object' && !Array.isArray(payload.extra) ? payload.extra : {};
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
        if (!photoFile) {
          throw new Error('Profile photo (JPEG) is required');
        }
        await api.uploadProfilePhoto(created.id, photoFile);

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
      const currentValue = extra && typeof extra === 'object' ? extra[name] : undefined;

      const inputName = `custom__${name}`;
      const requiredMark = required ? '<span class="required">*</span>' : '';

      if (dataType === 'number') {
        const v = currentValue === null || currentValue === undefined ? '' : String(currentValue);
        return `
          <div class="form-group">
            <label class="form-label">${escHtml(label)} ${requiredMark}</label>
            <input class="form-input" name="${escAttr(inputName)}" type="number" step="any" ${required ? 'required' : ''} value="${escAttr(v)}" />
          </div>
        `;
      }

      if (dataType === 'date') {
        const v = currentValue === null || currentValue === undefined ? '' : String(currentValue);
        return `
          <div class="form-group">
            <label class="form-label">${escHtml(label)} ${requiredMark}</label>
            <input class="form-input" name="${escAttr(inputName)}" type="date" ${required ? 'required' : ''} value="${escAttr(v)}" />
          </div>
        `;
      }

      if (dataType === 'boolean') {
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
    if (dataType === 'number') {
      const n = Number(text);
      if (!Number.isNaN(n)) out[name] = n;
      continue;
    }

    if (dataType === 'boolean') {
      const low = text.toLowerCase();
      if (low === 'true' || low === '1' || low === 'yes' || low === 'y') out[name] = true;
      else if (low === 'false' || low === '0' || low === 'no' || low === 'n') out[name] = false;
      else out[name] = text;
      continue;
    }

    // For date/string, store as string
    out[name] = text;
  }

  return out;
}

// ════════════════════════════════════════════
// Attachments Panel
// ════════════════════════════════════════════
export async function renderAttachments(container, staffId, staffName) {
  container.innerHTML = `
    <div class="attachments-shell">
      <div class="attachments-panel attachments-panel--list">
        <div class="attachments-header">
          <h3>Attachments — ${escHtml(staffName)}</h3>
          <button class="btn btn-ghost btn-sm" id="attach-back-btn">← Back to List</button>
        </div>

        <div class="upload-zone" id="upload-zone">
          ${ICONS.upload}
          <p>Drag & drop files here or click to browse</p>
          <input type="file" id="file-input" multiple style="display:none;" />
        </div>

        <div class="attachments-list" id="attachments-list">
          <div style="text-align:center; padding:20px; color: var(--clr-text-subtle);">Loading...</div>
        </div>
      </div>

      <div class="attachments-panel attachments-panel--preview" id="attachment-preview-panel" hidden>
        <div class="attachment-preview" id="attachment-preview" aria-label="Attachment preview">
          <div class="attachment-preview-empty">Click a file above to preview it here.</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('attach-back-btn').addEventListener('click', () => {
    clearActivePreviewObjectUrl();
    window._navigateTo('staff-list');
  });

  // Upload zone interactions
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(staffId, Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(staffId, Array.from(e.target.files));
    fileInput.value = '';
  });

  // Load existing
  await loadAttachments(staffId);

  let previewResizeTimer;
  const onPreviewResize = () => {
    clearTimeout(previewResizeTimer);
    previewResizeTimer = setTimeout(() => {
      const previewEl = document.getElementById('attachment-preview');
      if (!_activePreview || _activePreview.kind !== 'image' || !previewEl) return;
      if (_activePreview.zoom !== 1) return;
      _activePreview.baseFitScale = null;
      ensureImageFitScale(previewEl);
      renderImageInto(previewEl);
    }, 120);
  };
  window.addEventListener('resize', onPreviewResize);
}

let _activePreviewObjectUrl = null;
let _activePreview = null;

function setAttachmentsPreviewOpen(isOpen) {
  document.querySelector('.attachments-shell')?.classList.toggle('attachments-shell--preview-open', isOpen);
}

function clearActivePreviewObjectUrl() {
  if (_activePreviewObjectUrl) {
    try {
      URL.revokeObjectURL(_activePreviewObjectUrl);
    } catch {
      // ignore
    }
    _activePreviewObjectUrl = null;
  }
  _activePreview = null;
}

async function loadAttachments(staffId) {
  const listEl = document.getElementById('attachments-list');
  if (!listEl) return;

  const previewPanelEl = document.getElementById('attachment-preview-panel');
  const previewEl = document.getElementById('attachment-preview');
  if (previewPanelEl) previewPanelEl.hidden = true;
  setAttachmentsPreviewOpen(false);
  if (previewEl) {
    previewEl.innerHTML = `<div class="attachment-preview-empty">Click a file above to preview it here.</div>`;
  }

  try {
    const attachments = await api.listAttachments(staffId);

    if (attachments.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 40px;">
          <p>No attachments yet. Upload files above.</p>
        </div>
      `;

      clearActivePreviewObjectUrl();
      if (previewPanelEl) previewPanelEl.hidden = true;
      return;
    }

    listEl.innerHTML = attachments
      .map(
        (att) => `
      <div class="attachment-item" role="button" tabindex="0" data-attachment-url="${escAttr(att.url)}" data-attachment-name="${escAttr(
          att.original_filename
        )}" data-attachment-type="${escAttr(att.content_type || '')}">
        <div class="attachment-icon">${ICONS.file}</div>
        <div class="attachment-info">
          <div class="attachment-name">${escHtml(att.original_filename)}</div>
          <div class="attachment-meta">${att.content_type || 'file'} · ${formatDate(att.created_at)}</div>
        </div>
        <a href="${att.url}" class="attachment-download" target="_blank" download>Download</a>
      </div>
    `
      )
      .join('');

    // Wire click-to-preview
    listEl.querySelectorAll('.attachment-item').forEach((item) => {
      const downloadLink = item.querySelector('.attachment-download');
      if (downloadLink) {
        downloadLink.addEventListener('click', (e) => {
          // keep download behavior; don't trigger preview selection
          e.stopPropagation();
        });
      }

      const open = () => {
        if (previewPanelEl) previewPanelEl.hidden = false;
        setAttachmentsPreviewOpen(true);
        listEl.querySelectorAll('.attachment-item.is-selected').forEach((el) => el.classList.remove('is-selected'));
        item.classList.add('is-selected');

        const url = item.dataset.attachmentUrl;
        const name = item.dataset.attachmentName;
        const contentType = item.dataset.attachmentType;
        previewAttachment({ url, original_filename: name, content_type: contentType });
      };

      item.addEventListener('click', open);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  } catch (err) {
    showToast(`Failed to load attachments: ${err.message}`, 'error');
  }
}

function guessContentTypeFromName(name) {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return '';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function updateZoomLabel(previewEl) {
  const label = previewEl.querySelector('#attachment-preview-zoom');
  if (!label || !_activePreview) return;
  if (_activePreview.kind === 'pdf') {
    label.textContent = `${_activePreview.zoomPercent}%`;
  } else if (_activePreview.kind === 'image') {
    label.textContent = `${Math.round(_activePreview.zoom * 100)}%`;
  } else {
    label.textContent = '';
  }
}

function getPreviewBodyLimits(body) {
  const w = body.clientWidth || body.getBoundingClientRect().width;
  const h = body.clientHeight || body.getBoundingClientRect().height;
  return {
    maxW: Math.max(120, w),
    maxH: Math.max(120, h),
  };
}

function ensureImageFitScale(previewEl) {
  if (!_activePreview || _activePreview.kind !== 'image') return;
  const body = previewEl.querySelector('.attachment-preview-body');
  if (!body) return;

  const { maxW, maxH } = getPreviewBodyLimits(body);
  const nw = _activePreview.naturalWidth || 1;
  const nh = _activePreview.naturalHeight || 1;

  // Scale up or down so the image fills the preview body (no letterboxing at 100%)
  _activePreview.baseFitScale = Math.min(maxW / nw, maxH / nh);
}

function renderImageInto(previewEl) {
  const body = previewEl.querySelector('.attachment-preview-body');
  if (!body || !_activePreview) return;

  if (_activePreview.baseFitScale == null) {
    ensureImageFitScale(previewEl);
  }

  const scale = (_activePreview.baseFitScale || 1) * (_activePreview.zoom || 1);
  const w = Math.max(1, Math.round((_activePreview.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((_activePreview.naturalHeight || 1) * scale));

  body.innerHTML = `
    <div class="attachment-preview-viewport">
      <div class="attachment-preview-canvas" id="attachment-preview-canvas" style="width:${w}px;height:${h}px;">
        <img class="attachment-preview-image" alt="${escAttr(_activePreview.name || 'image')}" src="${escAttr(
          _activePreview.objectUrl
        )}" draggable="false" />
      </div>
    </div>
  `;
}

function renderPdfInto(previewEl) {
  const body = previewEl.querySelector('.attachment-preview-body');
  if (!body || !_activePreview) return;
  const src = `${_activePreview.objectUrl}#zoom=${_activePreview.zoomPercent}`;
  body.innerHTML = `
    <iframe class="attachment-preview-pdf" title="${escAttr(_activePreview.name || 'PDF')}" src="${escAttr(src)}"></iframe>
  `;
}

function applyZoom(previewEl, direction) {
  if (!_activePreview) return;

  if (_activePreview.kind === 'image') {
    const step = 0.25;
    if (direction === 'in') _activePreview.zoom = clamp(_activePreview.zoom + step, 0.25, 5);
    if (direction === 'out') _activePreview.zoom = clamp(_activePreview.zoom - step, 0.25, 5);
    if (direction === 'reset') {
      _activePreview.zoom = 1;
      _activePreview.baseFitScale = null;
      ensureImageFitScale(previewEl);
    }
    renderImageInto(previewEl);
    updateZoomLabel(previewEl);
    return;
  }

  if (_activePreview.kind === 'pdf') {
    const step = 25;
    if (direction === 'in') _activePreview.zoomPercent = clamp(_activePreview.zoomPercent + step, 50, 300);
    if (direction === 'out') _activePreview.zoomPercent = clamp(_activePreview.zoomPercent - step, 50, 300);
    if (direction === 'reset') _activePreview.zoomPercent = 100;
    renderPdfInto(previewEl);
    updateZoomLabel(previewEl);
  }
}

async function previewAttachment(att) {
  const previewEl = document.getElementById('attachment-preview');
  if (!previewEl) return;

  clearActivePreviewObjectUrl();
  const downloadName = att.original_filename || 'download';
  previewEl.innerHTML = `
    <div class="attachment-preview-header">
      <div class="attachment-preview-title">Preview: ${escHtml(downloadName)}</div>
      <div class="attachment-preview-controls" aria-label="Preview controls">
        <button type="button" class="attachment-preview-btn" data-zoom="out" title="Zoom out">−</button>
        <span class="attachment-preview-zoom" id="attachment-preview-zoom">100%</span>
        <button type="button" class="attachment-preview-btn" data-zoom="in" title="Zoom in">+</button>
        <button type="button" class="attachment-preview-btn" data-zoom="reset" title="Reset zoom">Reset</button>
        <a
          href="${escAttr(att.url)}"
          class="attachment-preview-btn attachment-preview-download"
          id="attachment-preview-download"
          download="${escAttr(downloadName)}"
          title="Download file"
        >↓ Download</a>
      </div>
    </div>
    <div class="attachment-preview-body">
      <div class="attachment-preview-loading">Loading preview...</div>
    </div>
  `;

  previewEl.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyZoom(previewEl, btn.dataset.zoom);
    });
  });

  const bodyEl = previewEl.querySelector('.attachment-preview-body');
  if (bodyEl) {
    bodyEl.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        applyZoom(previewEl, e.deltaY < 0 ? 'in' : 'out');
      },
      { passive: false }
    );
  }

  try {
    const res = await fetch(att.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    _activePreviewObjectUrl = objectUrl;

    const downloadLink = previewEl.querySelector('#attachment-preview-download');
    if (downloadLink) {
      downloadLink.href = objectUrl;
      downloadLink.download = downloadName;
    }

    const contentType = blob.type || att.content_type || guessContentTypeFromName(att.original_filename);
    const body = previewEl.querySelector('.attachment-preview-body');
    if (!body) return;

    if ((contentType || '').startsWith('image/')) {
      _activePreview = {
        kind: 'image',
        name: downloadName,
        objectUrl,
        downloadUrl: att.url,
        zoom: 1,
        baseFitScale: null,
        naturalWidth: 0,
        naturalHeight: 0,
      };

      const img = new Image();
      img.onload = () => {
        if (!_activePreview || _activePreview.objectUrl !== objectUrl) return;
        _activePreview.naturalWidth = img.naturalWidth || 1;
        _activePreview.naturalHeight = img.naturalHeight || 1;
        _activePreview.baseFitScale = null;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ensureImageFitScale(previewEl);
            renderImageInto(previewEl);
            updateZoomLabel(previewEl);
          });
        });
      };
      img.src = objectUrl;

      // quick initial paint
      body.innerHTML = `<div class="attachment-preview-loading">Preparing image...</div>`;
      return;
    }

    if (contentType === 'application/pdf') {
      _activePreview = {
        kind: 'pdf',
        name: downloadName,
        objectUrl,
        downloadUrl: att.url,
        zoomPercent: 100,
      };
      renderPdfInto(previewEl);
      updateZoomLabel(previewEl);
      return;
    }

    // Unknown type
    _activePreview = { kind: 'other' };
    updateZoomLabel(previewEl);

    body.innerHTML = `
      <div class="attachment-preview-unsupported">
        <div style="margin-bottom: 6px;">No inline preview available for this file type.</div>
        <a href="${escAttr(att.url)}" target="_blank" rel="noopener">Open / Download</a>
      </div>
    `;
  } catch (err) {
    const body = previewEl.querySelector('.attachment-preview-body');
    if (body) {
      body.innerHTML = `
        <div class="attachment-preview-unsupported">
          <div style="margin-bottom: 6px;">Failed to load preview: ${escHtml(err.message)}</div>
          <a href="${escAttr(att.url)}" target="_blank" rel="noopener">Open / Download</a>
        </div>
      `;
    }
  }
}

async function handleFiles(staffId, files) {
  for (const file of files) {
    try {
      showToast(`Uploading ${file.name}...`, 'info', 2000);
      await api.uploadAttachment(staffId, file);
      showToast(`${file.name} uploaded!`, 'success');
    } catch (err) {
      showToast(`Upload failed for ${file.name}: ${err.message}`, 'error');
    }
  }
  // Reload list
  await loadAttachments(staffId);
}

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

/** Circular avatar: profile JPEG when uploaded, otherwise initial letter */
export function staffAvatarHtml(staff, size = 32) {
  const name = staff?.full_name || '';
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const px = `${size}px`;
  const photo = staff?.photo_url;

  const img = photo
    ? `<img src="${escAttr(photo)}" alt="" loading="lazy" onerror="this.remove()" />`
    : '';

  return `
    <span class="staff-avatar" style="width:${px};height:${px};" data-initial="${escAttr(initial)}" title="${escAttr(name)}">
      <span class="staff-avatar-initial" aria-hidden="true">${escHtml(initial)}</span>
      ${img}
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
