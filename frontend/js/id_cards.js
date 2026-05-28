/* ═══════════════════════════════════════════════════════
   ID Cards Generation UI
   ═══════════════════════════════════════════════════════ */

import { api } from './api.js';
import { showToast } from './animations.js';

// --- Utility Functions ---
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) {
  return escHtml(str);
}
// -------------------------

import './id_card_modal_handlers.js';

export async function renderIdCardsPage(container) {
  let fieldDefs = [];
  try {
    fieldDefs = await api.listFieldDefs();
  } catch {
    fieldDefs = [];
  }

  container.innerHTML = `
    <div class="id-card-controls glass-panel" style="margin-bottom: 24px;">
      <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
        <div class="id-card-search-wrapper" style="flex:1; min-width:250px; position:relative;">
          <input type="text" id="id-card-search" placeholder="Search staff to generate ID..." class="form-input" autocomplete="off" />
          <div id="id-card-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button id="btn-download-id" class="btn btn-sm btn-ghost" disabled title="Download ID Card">↓ Download</button>
          <button id="btn-print-id" class="btn btn-primary" disabled title="Print ID Card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
        </div>
      </div>
    </div>

    <div id="id-card-preview-shell" class="glass-card" style="min-height:420px; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div id="id-card-preview-container" style="display:flex; gap:24px; flex-wrap:wrap; justify-content:center; align-items:flex-start;">
        <div style="color: #666; align-self: center;">Search and select a staff member to preview their ID card.</div>
      </div>
    </div>

    <!-- Fullscreen modal for large preview -->
    <div id="idcard-modal-backdrop" class="modal-backdrop" hidden>
      <div class="modal idcard-modal" role="dialog" aria-modal="true" style="max-width: 1200px; width: calc(100% - 64px);">
        <div class="modal-header">
          <h3 class="attachment-preview-title">ID Card Preview</h3>
          <div class="attachment-preview-controls">
            <button id="idcard-download-btn" class="btn btn-icon btn-ghost" title="Download">↓</button>
            <button id="idcard-print-btn" class="btn btn-icon btn-ghost" title="Print">🖨</button>
            <button id="idcard-close-btn" class="modal-close-btn" title="Close">✕</button>
          </div>
        </div>
        <div class="attachment-preview-body" id="idcard-modal-body" style="display:flex; gap:18px; padding:20px;">
          <!-- rendered cards inserted here -->
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('id-card-search');
  const dropdown = document.getElementById('id-card-dropdown');
  const previewContainer = document.getElementById('id-card-preview-container');
  const printBtn = document.getElementById('btn-print-id');
  const downloadBtn = document.getElementById('btn-download-id');
  const modalBackdrop = document.getElementById('idcard-modal-backdrop');
  const modalBody = document.getElementById('idcard-modal-body');
  const modalClose = document.getElementById('idcard-close-btn');
  const modalPrint = document.getElementById('idcard-print-btn');
  const modalDownload = document.getElementById('idcard-download-btn');

  let searchTimer;
  let currentStaff = null;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value.trim();
    if (val.length < 2) {
      dropdown.style.display = 'none';
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await api.listStaff({ q: val, limit: 10 });
        if (results.length === 0) {
          dropdown.innerHTML = '<div class="autocomplete-item">No matches found</div>';
        } else {
          dropdown.innerHTML = results.map(s => `
            <div class="autocomplete-item" data-id="${s.id}">
              <strong>${escHtml(s.full_name)}</strong> 
              <span style="font-size: 11px; color: var(--clr-text-subtle);">(${escHtml(s.designation || 'N/A')})</span>
            </div>
          `).join('');
        }
        dropdown.style.display = 'block';
      } catch (err) {
        console.error(err);
      }
    }, 300);
  });

  // Hide dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  dropdown.addEventListener('click', async (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item || !item.dataset.id) return;

    dropdown.style.display = 'none';
    searchInput.value = item.querySelector('strong').textContent;

    try {
      currentStaff = await api.getStaff(item.dataset.id);
      renderPreview(currentStaff, previewContainer, fieldDefs);
      printBtn.disabled = false;
      downloadBtn.disabled = false;
      // populate modal body when opened
      modalBody.innerHTML = '';
      modalBody.insertAdjacentHTML('beforeend', generateIdCardFront(currentStaff));
      modalBody.insertAdjacentHTML('beforeend', generateIdCardBack(currentStaff, fieldDefs));
      // expose for delegated handlers
      window.__medical_last_idcard_staff = currentStaff;
      window.__medical_field_defs = fieldDefs;
    } catch (err) {
      showToast('Failed to load staff details', 'error');
    }
  });

  printBtn.addEventListener('click', () => {
    if (!currentStaff) return;
    printIdCard();
  });
}

function renderPreview(staff, container, fieldDefs = []) {
  const frontHtml = generateIdCardFront(staff);
  const backHtml = generateIdCardBack(staff, fieldDefs);

  container.innerHTML = `
    <div class="id-card-wrapper">
      <div class="id-card-label">Front</div>
      ${frontHtml}
    </div>
    <div class="id-card-wrapper">
      <div class="id-card-label">Back</div>
      ${backHtml}
    </div>
  `;
}

function generateIdCardFront(staff) {
  const staffId = staff?.id ? `#${staff.id}` : '';
  const photo = staff.photo_url ? `<img src="${staff.photo_url}" style="width:100%; height:100%; object-fit:cover;" />` : '';

  const rows = [
    ['NAME', staff.full_name, true],
    ['GENDER', staff.gender],
    ['DESIGNATION', staff.designation],
    ['FACILITY NAME', staff.facility_name],
    ['POSTING PLACE', staff.posting_place || staff.block || ''],
    ['DISTRICT', staff.district],
  ];

  return `
    <div class="idc-card">
      <div class="idc-header">
        <div class="idc-header-left">
          IDENTITY<br/>CARD
        </div>
        <div class="idc-header-right">
          GOVT. OF ARUNACHAL PRADESH
        </div>
      </div>
      <div class="idc-body">
        <div class="idc-photo-section">
          <div class="idc-photo-box">
            ${photo}
          </div>
          <div class="idc-validity">
            <strong>Staff<br/>ID :</strong> <span>${escHtml(staffId)}</span>
          </div>
        </div>
        <div class="idc-details-section">
          <div class="idc-office-logo">
            <img src="/assets/logo.png" alt="Emblem" style="height: 40px; margin-bottom: 2px;" onerror="this.style.display='none'"/>
            <div class="idc-office-text">OFFICE OF THE DISTRICT MEDICAL OFFICER (DMO)<br/><span class="idc-office-namsai">— NAMSAI —</span></div>
          </div>
          <table class="idc-table">
            ${rows
              .map(
                ([label, value, highlight]) => `
                  <tr>
                    <td class="idc-lbl">${escHtml(label)}</td>
                    <td class="idc-sep">:</td>
                    <td class="idc-val ${highlight ? 'idc-name' : ''}">${escHtml(value || '')}</td>
                  </tr>
                `
              )
              .join('')}
          </table>
        </div>
      </div>
    </div>
  `;
}

function generateIdCardBack(staff, fieldDefs = []) {
  const dob = formatDateValue(staff.date_of_birth);
  const dateOfJoining = formatDateValue(staff.date_of_joining);
  const customRows = getCustomFieldRows(staff, fieldDefs);

  return `
    <div class="idc-card">
      <div class="idc-back-container">
        <div class="idc-vertical-text">
          <span>The Holder of this Card is an Employee under the Govt. of Arunachal Pradesh.</span>
        </div>
        <div class="idc-back-content">
          <!-- Top Row -->
          <div class="idc-row idc-row-top">
            <div class="idc-col">
              <div class="idc-field"><span class="idc-f-lbl">Cadre:</span> <span class="idc-line">${escHtml(staff.cadre || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Employment Type:</span> <span class="idc-line">${escHtml(staff.employment_type || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Facility Type:</span> <span class="idc-line">${escHtml(staff.facility_type || '')}</span></div>
            </div>
            <div class="idc-col">
              <div class="idc-field" style="justify-content: flex-end;"><span class="idc-f-lbl">Staff ID:</span> <span class="idc-line" style="width:120px;">${escHtml(String(staff.id || ''))}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">DOB:</span> <span class="idc-line">${escHtml(dob)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Date of Joining:</span> <span class="idc-line">${escHtml(dateOfJoining)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Phone:</span> <span class="idc-line">${escHtml(staff.phone || '')}</span></div>
            </div>
          </div>
          
          <!-- Middle Row -->
          <div class="idc-row idc-row-mid">
            <div class="idc-col">
              <div class="idc-section-title">SERVICE DETAILS</div>
              <div class="idc-field"><span class="idc-f-lbl">Designation:</span> <span class="idc-line">${escHtml(staff.designation || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Facility Name:</span> <span class="idc-line">${escHtml(staff.facility_name || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Posting Place:</span> <span class="idc-line">${escHtml(staff.posting_place || '')}</span></div>
            </div>
            <div class="idc-col">
              <div class="idc-section-title" style="text-align: center;">LOCATION</div>
              <div class="idc-field"><span class="idc-f-lbl">Block:</span> <span class="idc-line">${escHtml(staff.block || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">District:</span> <span class="idc-line">${escHtml(staff.district || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Email:</span> <span class="idc-line">${escHtml(staff.email || '')}</span></div>
            </div>
          </div>

          ${
            customRows.length
              ? `
          <div class="idc-custom-section">
            <div class="idc-section-title">ADDITIONAL FIELDS</div>
            <div class="idc-custom-grid">
              ${customRows
                .map(
                  ({ label, value }) => `
                    <div class="idc-field">
                      <span class="idc-f-lbl">${escHtml(label)}:</span>
                      <span class="idc-line">${escHtml(value)}</span>
                    </div>
                  `
                )
                .join('')}
            </div>
          </div>
          `
              : ''
          }

          <!-- Bottom Row -->
          <div class="idc-row idc-row-bot">
            <div class="idc-col">
              <div class="idc-field"><span class="idc-f-lbl">Facility Name:</span> <span class="idc-line">${escHtml(staff.facility_name || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Facility Type:</span> <span class="idc-line">${escHtml(staff.facility_type || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Email:</span> <span class="idc-line">${escHtml(staff.email || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">District:</span> <span class="idc-line">${escHtml(staff.district || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">State: ARUNACHAL PRADESH</span></div>
            </div>
            <div class="idc-col" style="justify-content: flex-end; align-items: center; padding-bottom: 5px;">
              <div style="border-top: 1px solid #002266; width: 120px; text-align: center; font-size: 10px; color: #cc0000; padding-top: 4px;">Issuing Authority</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getExtraData(staff) {
  if (!staff || typeof staff.extra !== 'object' || Array.isArray(staff.extra)) {
    return {};
  }
  return staff.extra || {};
}

function getExtraValue(extra, keys) {
  for (const key of keys) {
    if (key in extra) {
      const value = extra[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }
  }
  return '';
}

function getCustomFieldRows(staff, fieldDefs) {
  const extra = getExtraData(staff);
  if (!Array.isArray(fieldDefs) || fieldDefs.length === 0) return [];

  return fieldDefs
    .filter((fieldDef) => fieldDef && fieldDef.name)
    .map((fieldDef) => ({
      label: fieldDef.label || fieldDef.name,
      value: getExtraValue(extra, [fieldDef.name]),
    }))
    .filter((row) => String(row.value ?? '').trim() !== '')
    .slice(0, 6);
}

function formatDateValue(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB');
  } catch {
    return String(value);
  }
}

function printIdCard() {
  const container = document.getElementById('id-card-preview-container');
  const printWindow = window.open('', '_blank');
  
  // Create a print-friendly document
  printWindow.document.write(`
    <html>
      <head>
        <title>Print ID Card</title>
        <style>
          @page { margin: 0; size: A4 portrait; }
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Copy ID Card CSS here */
          .idc-card {
            width: 86mm; /* Standard ID card size (landscape: 86x54, scaled up slightly for print maybe? Or exact.) */
            height: 54mm;
            border: 2px solid #002b80;
            border-radius: 4px;
            box-sizing: border-box;
            background: white;
            position: relative;
            overflow: hidden;
            font-family: Arial, sans-serif;
            color: #002b80;
            padding: 2px;
            page-break-inside: avoid;
          }

          /* We will include the full ID card CSS from dashboard.css */
        </style>
        <link rel="stylesheet" href="/css/id_card.css">
      </head>
      <body>
        <div style="margin-bottom: 20px;">
          ${container.innerHTML}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              // window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
