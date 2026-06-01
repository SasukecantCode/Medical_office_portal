/* ═══════════════════════════════════════════════════════
   Staff — CRUD UI (List, Create, Edit, Attachments)
   ═══════════════════════════════════════════════════════ */

import { api, clearStaffPhotoCache, getStaffPhotoObjectUrl } from './api.js';
import { showToast } from './animations.js';
import { renderVault } from './vault.js';

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
        <td data-label="ID">${s.id}</td>
        <td data-label="Photo">${staffAvatarHtml(s, 32)}</td>
        <td data-label="Full Name"><strong>${escHtml(s.full_name)}</strong></td>
        <td data-label="Designation">${escHtml(s.designation || '')}</td>
        <td data-label="Facility">${escHtml(s.facility_name || '')}</td>
        <td data-label="District">${escHtml(s.district || '')}</td>
        <td data-label="Employment">${escHtml(s.employment_type || '')}</td>
        <td data-label="Phone">${escHtml(s.phone || '-')}</td>
        <td data-label="Created">${formatDate(s.created_at)}</td>
      </tr>
    `
      )
      .join('');

    await hydrateStaffPhotos(tbody);

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
  const photoRequired = !isEdit || !hasExistingPhoto;

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
              <input class="form-input" name="phone" type="tel" inputmode="numeric" pattern="\+91\d*" value="${escAttr(staffData.phone || '')}" placeholder="+91XXXXXXXXXX" />
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
                <div id="form-photo-preview" class="staff-avatar" style="width:72px; height:72px; border-radius: 14px;"${hasExistingPhoto ? ` data-photo-staff-id="${staffId}" data-photo-version="${staffData.updated_at ? new Date(staffData.updated_at).getTime() : staffId}"` : ''}>
                  <span class="staff-avatar-initial" style="font-size:12px; color: var(--clr-text-subtle);">${hasExistingPhoto ? '' : 'No photo'}</span>
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

  attachPhonePrefixHandlers(container);

  const formPreview = document.getElementById('form-photo-preview');
  if (formPreview?.dataset.photoStaffId) {
    await hydrateStaffPhotos(formPreview);
  }

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

    if (payload.phone) {
      payload.phone = normalizePhoneValue(payload.phone);
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
        if (!photoFile) {
          throw new Error('Profile photo (JPEG) is required');
        }
        await api.uploadProfilePhoto(created.id, photoFile);
        clearStaffPhotoCache();

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
