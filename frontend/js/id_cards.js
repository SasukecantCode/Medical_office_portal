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
    <div class="id-card-controls idcard-controls-plain" style="margin-bottom: 24px;">
      <div class="table-controls idcard-controls-bar">
        <div class="search-box id-card-search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" id="id-card-search" placeholder="Search staff to generate ID..." autocomplete="off" />
          <div id="id-card-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
        </div>
        <div class="idcard-actions">
          <button id="btn-download-id" class="btn btn-sm btn-ghost" disabled title="Download ID Card">↓ Download</button>
          <button id="btn-print-id" class="btn btn-primary" disabled title="Print ID Card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
        </div>
      </div>
    </div>

    <div id="id-card-preview-shell">
      <div id="id-card-preview-container" style="display:flex; gap:24px; flex-wrap:wrap; justify-content:center; align-items:flex-start; width: 100%;">
        <div style="color: rgba(255, 255, 255, 0.5); align-self: center; font-size: 14px;">Search and select a staff member to preview their ID card.</div>
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
  let currentDraft = null;

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
          dropdown.innerHTML = results.map(s => {
            const hasPhoto = s.photo_url && s.photo_url.trim();
            const initials = s.full_name ? s.full_name.charAt(0).toUpperCase() : '?';
            const avatarHtml = hasPhoto
              ? `<img class="item-avatar-img" src="${escAttr(s.photo_url)}" alt="" />`
              : `<span class="item-avatar">${escHtml(initials)}</span>`;

            return `
              <div class="autocomplete-item" data-id="${s.id}">
                ${avatarHtml}
                <div style="display:flex; flex-direction:column; line-height:1.2;">
                  <strong>${escHtml(s.full_name)}</strong> 
                  <span style="font-size: 11px; color: rgba(255,255,255,0.45);">${escHtml(s.designation || 'N/A')}</span>
                </div>
              </div>
            `;
          }).join('');
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
      currentDraft = cloneStaff(currentStaff);
      window.__idcard_draft = currentDraft;
      renderPreview(currentDraft, previewContainer, fieldDefs);
      printBtn.disabled = false;
      downloadBtn.disabled = false;
      // populate modal body when opened
      modalBody.innerHTML = '';
      modalBody.insertAdjacentHTML('beforeend', generateIdCardFront(currentDraft));
      modalBody.insertAdjacentHTML('beforeend', generateIdCardBack(currentDraft, fieldDefs));
      // expose for delegated handlers
      window.__medical_last_idcard_staff = currentDraft;
      window.__medical_field_defs = fieldDefs;
    } catch (err) {
      showToast('Failed to load staff details', 'error');
    }
  });

  printBtn.addEventListener('click', () => {
    if (!currentDraft) return;
    printIdCard();
  });
  
  // Click handler for flip and fullscreen
  previewContainer.addEventListener('click', (e) => {
    if (!currentDraft) return;
    
    // Fullscreen expand button
    if (e.target.closest('.id-card-expand-btn')) {
      const backdrop = document.getElementById('idcard-modal-backdrop');
      if (backdrop) {
        document.body.classList.add('idcard-open');
        backdrop.hidden = false;
        setTimeout(() => backdrop.classList.add('open'), 20);
      }
      return;
    }

    // Flip card
    const flipContainer = e.target.closest('.id-card-flip-container');
    if (flipContainer) {
      flipContainer.classList.toggle('flipped');
    }
  });

  previewContainer.addEventListener('input', (e) => {
    const input = e.target.closest('[data-idcard-key]');
    if (!input || !currentDraft) return;

    applyDraftValue(currentDraft, input.dataset.idcardKey, input.value);
    window.__idcard_draft = currentDraft;
    window.__medical_last_idcard_staff = currentDraft;

    const previewStage = previewContainer.querySelector('.idcard-preview-stage');
    if (previewStage) {
      previewStage.innerHTML = buildPreviewHtml(currentDraft, fieldDefs);
    }

  });

  previewContainer.addEventListener('keydown', async (e) => {
    const input = e.target.closest('[data-idcard-key]');
    if (!input || !currentDraft) return;
    if (e.key !== 'Enter') return;

    e.preventDefault();
    try {
      await api.updateStaff(currentDraft.id, currentDraft);
      showToast('Saved changes to staff record', 'success');
    } catch (err) {
      showToast('Failed to save changes', 'error');
      console.error(err);
    }
  });
}

function renderPreview(staff, container, fieldDefs = []) {
  container.innerHTML = `
    <div class="idcard-live-layout">
      <section class="idcard-editor-panel staff-form-container">
        <div class="idcard-editor-header staff-form-header">
          <div>
            <h3 class="idcard-editor-title">Edit Card</h3>
          </div>
          <span class="idcard-editor-badge">Live</span>
        </div>
        <div class="idcard-editor-sections">
          ${renderEditorSections(staff, fieldDefs)}
        </div>
      </section>
      <section class="idcard-preview-panel staff-form-container">
        <div class="idcard-preview-header staff-form-header">
          <div>
            <h3 class="idcard-preview-title">ID Card Preview</h3>
          </div>
          <span class="idcard-preview-badge">Preview</span>
        </div>
        <div class="idcard-preview-stage">
          ${buildPreviewHtml(staff, fieldDefs)}
        </div>
      </section>
    </div>
  `;
}

function buildPreviewHtml(staff, fieldDefs = []) {
  const frontHtml = generateIdCardFront(staff);
  const backHtml = generateIdCardBack(staff, fieldDefs);

  return `
    <div class="id-card-flip-wrapper idcard-shift-right">
      <button class="id-card-expand-btn" title="View Fullscreen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
      <div class="id-card-flip-hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.35 3.35"/></svg>
        Click card to flip
      </div>
      <div class="id-card-flip-container">
        <div class="id-card-flipper">
          <div class="id-card-front">
            ${frontHtml}
          </div>
          <div class="id-card-back">
            ${backHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEditorSections(draft, fieldDefs = []) {
  const groups = [
    {
      title: 'Core Identity',
      fields: [
        ['full_name', 'Full Name'],
        ['designation', 'Designation'],
        ['cadre', 'Cadre'],
        ['employment_type', 'Employment Type'],
      ],
    },
    {
      title: 'Work Location',
      fields: [
        ['facility_name', 'Facility Name'],
        ['facility_type', 'Facility Type'],
        ['posting_place', 'Posting Place'],
        ['block', 'Block'],
        ['district', 'District'],
      ],
    },
    {
      title: 'Contact',
      fields: [
        ['phone', 'Phone'],
        ['email', 'Email'],
      ],
    },
    {
      title: 'Personal',
      fields: [
        ['gender', 'Gender'],
        ['date_of_birth', 'Date of Birth'],
        ['date_of_joining', 'Date of Joining'],
      ],
    },
  ];

  const extraFields = [];
  if (Array.isArray(fieldDefs)) {
    fieldDefs.forEach((fieldDef) => {
      if (!fieldDef || !fieldDef.name) return;
      extraFields.push([`extra.${fieldDef.name}`, fieldDef.label || fieldDef.name]);
    });
  }

  const extraData = getExtraData(draft);
  Object.keys(extraData)
    .filter((key) => !extraFields.some(([fieldKey]) => fieldKey === `extra.${key}`))
    .forEach((key) => extraFields.push([`extra.${key}`, key]));

  if (extraFields.length) {
    groups.push({
      title: 'Additional Fields',
      fields: extraFields,
    });
  }

  return groups
    .map((group) => renderEditorSection(group.title, group.fields, draft))
    .join('');
}

function renderEditorSection(title, fields, draft) {
  const fieldHtml = fields
    .map(([key, label]) => editorInput(label, key, getDraftValue(draft, key)))
    .join('');

  return `
    <div class="idcard-editor-section">
      <div class="idcard-editor-section-title">${escHtml(title)}</div>
      <div class="idcard-editor-section-grid">
        ${fieldHtml}
      </div>
    </div>
  `;
}

function editorInput(label, key, value) {
  return `
    <label class="idcard-editor-field">
      <span>${escHtml(label)}</span>
      <input type="text" data-idcard-key="${escAttr(key)}" value="${escAttr(value || '')}" />
    </label>
  `;
}

function getDraftValue(draft, key) {
  if (!draft) return '';
  if (key.startsWith('extra.')) {
    const extraKey = key.slice(6);
    return getExtraData(draft)[extraKey] || '';
  }
  return draft[key] || '';
}

function applyDraftValue(draft, key, value) {
  if (!draft) return;
  if (key.startsWith('extra.')) {
    const extraKey = key.slice(6);
    if (!draft.extra || typeof draft.extra !== 'object') {
      draft.extra = {};
    }
    draft.extra[extraKey] = value;
    return;
  }
  draft[key] = value;
}

function cloneStaff(staff) {
  try {
    return JSON.parse(JSON.stringify(staff || {}));
  } catch {
    return { ...(staff || {}) };
  }
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
          <!-- Top & Mid Combined Row -->
          <div class="idc-row">
            <!-- Left Column -->
            <div class="idc-col">
              <div class="idc-field"><span class="idc-f-lbl">Cadre:</span> <span class="idc-line">${escHtml(staff.cadre || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Employment Type:</span> <span class="idc-line">${escHtml(staff.employment_type || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Facility Type:</span> <span class="idc-line">${escHtml(staff.facility_type || '')}</span></div>
              
              <div class="idc-section-title" style="margin-top: 6px;">SERVICE DETAILS</div>
              <div class="idc-field"><span class="idc-f-lbl">Designation:</span> <span class="idc-line">${escHtml(staff.designation || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Facility Name:</span> <span class="idc-line">${escHtml(staff.facility_name || '')}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Posting Place:</span> <span class="idc-line">${escHtml(staff.posting_place || '')}</span></div>
            </div>
            
            <!-- Right Column -->
            <div class="idc-col">
              <div class="idc-field" style="justify-content: flex-end;"><span class="idc-f-lbl">Staff ID:</span> <span class="idc-line" style="width:120px;">${escHtml(String(staff.id || ''))}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">DOB:</span> <span class="idc-line">${escHtml(dob)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Date of Joining:</span> <span class="idc-line">${escHtml(dateOfJoining)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Phone:</span> <span class="idc-line">${escHtml(staff.phone || '')}</span></div>
              
              <div class="idc-section-title" style="margin-top: 6px; text-align: center;">LOCATION</div>
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
          <div class="idc-row idc-row-bot" style="flex: 1; border-top: 1px solid #002b80;">
            <div class="idc-col" style="justify-content: flex-end; border-right: none;">
              <div class="idc-field"><span class="idc-f-lbl" style="font-size: 9px; padding-bottom: 2px;">State: ARUNACHAL PRADESH</span></div>
            </div>
            <div class="idc-col" style="justify-content: flex-end; align-items: flex-end; padding-bottom: 6px; padding-right: 12px; border-left: none;">
              <div style="border-top: 1px solid #002b80; width: 100px; text-align: center; font-size: 9px; color: #002b80; padding-top: 2px;">Issuing Authority</div>
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
  const draft = window.__idcard_draft || window.__medical_last_idcard_staff;
  const fieldDefs = window.__medical_field_defs || [];
  
  if (!draft) return;

  const frontHtml = generateIdCardFront(draft);
  const backHtml = generateIdCardBack(draft, fieldDefs);

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
          
          /* Make sure the front and back cards are centered and have proper spacing */
          .print-card-wrapper {
            margin-bottom: 24px;
            page-break-inside: avoid;
          }

          .idc-card {
            width: 86mm; /* Standard ID card size */
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
          }

          .idc-card * {
            color: #002b80 !important;
          }

          .idc-header-left,
          .idc-header-right {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
        <link rel="stylesheet" href="/css/id_card.css">
      </head>
      <body>
        <div class="print-card-wrapper">
          ${frontHtml}
        </div>
        <div class="print-card-wrapper">
          ${backHtml}
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

window.printIdCard = printIdCard;

import html2canvas from 'html2canvas';
import JSZip from 'jszip';

/** Styles for off-screen html2canvas capture (print uses native layout). */
function getIdCardExportStyles() {
  return `
    .html2canvas-wrapper .idc-card {
      width: 86mm !important;
      height: 54mm !important;
      border: 2px solid #002b80 !important;
      border-radius: 4px !important;
      box-sizing: border-box !important;
      background: white !important;
      position: relative !important;
      overflow: hidden !important;
      font-family: Arial, sans-serif !important;
      color: #002b80 !important;
      padding: 2px !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    .html2canvas-wrapper .idc-vertical-text span {
      width: 50mm !important;
    }
    .html2canvas-wrapper .idc-field {
      align-items: flex-end !important;
    }
    .html2canvas-wrapper .idc-line {
      display: block !important;
      border-bottom: none !important;
      padding-bottom: 0 !important;
      line-height: 1.2 !important;
      min-height: 9px !important;
    }
    .html2canvas-wrapper .idc-line::after {
      content: '' !important;
      display: block !important;
      width: 100% !important;
      margin-top: 2px !important;
      border-bottom: 1px solid #002b80 !important;
    }
    .html2canvas-wrapper .idc-custom-grid .idc-line::after {
      margin-top: 1px !important;
    }
  `;
}

function buildIdCardExportMarkup(frontHtml, backHtml) {
  return `
    <style>${getIdCardExportStyles()}</style>
    <div class="print-wrapper html2canvas-wrapper" style="padding: 10px; background: white;">
      ${frontHtml}
    </div>
    <div class="print-wrapper html2canvas-wrapper" style="padding: 10px; background: white;">
      ${backHtml}
    </div>
  `;
}

async function captureIdCardImage(container, scale = 3) {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return html2canvas(container, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
}

window.downloadIdCardJpeg = async function() {
  const draft = window.__idcard_draft || window.__medical_last_idcard_staff;
  const fieldDefs = window.__medical_field_defs || [];
  
  if (!draft) return;

  const frontHtml = generateIdCardFront(draft);
  const backHtml = generateIdCardBack(draft, fieldDefs);

  // Create an off-screen container to render the cards perfectly flat
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.background = 'white';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '20px';
  
  container.innerHTML = buildIdCardExportMarkup(frontHtml, backHtml);
  
  document.body.appendChild(container);
  
  try {
    const canvas = await captureIdCardImage(container, 3);
    
    const url = canvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (draft.full_name || 'idcard').replace(/[^A-Za-z0-9_\- ]+/g, '');
    a.download = `${safeName}_IDCard.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch(err) {
    console.error("Failed to generate JPEG:", err);
  } finally {
    container.remove();
  }
};

function normalizeFileName(name) {
  return String(name || 'idcard')
    .replace(/[^A-Za-z0-9_\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'idcard';
}

export async function generateIdCardsZip(staffList, fieldDefs = [], opts = {}) {
  const items = Array.isArray(staffList) ? staffList : [];
  const scale = Number.isFinite(opts.scale) ? opts.scale : 3;
  if (!items.length) {
    return { blob: null, count: 0, skipped: 0 };
  }

  const zip = new JSZip();
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.background = 'white';
  container.style.padding = '20px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '20px';

  document.body.appendChild(container);

  let created = 0;
  let skipped = 0;

  try {
    for (const staff of items) {
      if (!staff || !staff.full_name) {
        skipped += 1;
        continue;
      }

      const frontHtml = generateIdCardFront(staff);
      const backHtml = generateIdCardBack(staff, fieldDefs);

      container.innerHTML = buildIdCardExportMarkup(frontHtml, backHtml);

      const canvas = await captureIdCardImage(container, scale);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.95);
      });

      if (!blob) {
        skipped += 1;
        continue;
      }

      const buffer = await blob.arrayBuffer();
      const safeName = normalizeFileName(staff.full_name || `staff_${staff.id || created + 1}`);
      const suffix = staff.id ? `_${staff.id}` : '';
      zip.file(`${safeName}${suffix}_IDCard.jpg`, buffer);
      created += 1;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, count: created, skipped };
  } finally {
    container.remove();
  }
}
