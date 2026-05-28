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

export async function renderIdCardsPage(container) {
  container.innerHTML = `
    <div class="id-card-controls glass-panel" style="margin-bottom: 24px;">
      <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px; position: relative;">
          <input type="text" id="id-card-search" placeholder="Search staff to generate ID..." class="form-input" autocomplete="off" />
          <div id="id-card-dropdown" class="autocomplete-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 100;"></div>
        </div>
        <button id="btn-print-id" class="btn btn-primary" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print ID Card
        </button>
      </div>
    </div>

    <div id="id-card-preview-container" style="display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; align-items: flex-start; padding: 24px; background: #f0f2f5; border-radius: 12px; min-height: 400px;">
      <div style="color: #666; align-self: center;">Search and select a staff member to preview their ID card.</div>
    </div>
  `;

  const searchInput = document.getElementById('id-card-search');
  const dropdown = document.getElementById('id-card-dropdown');
  const previewContainer = document.getElementById('id-card-preview-container');
  const printBtn = document.getElementById('btn-print-id');

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
      renderPreview(currentStaff, previewContainer);
      printBtn.disabled = false;
    } catch (err) {
      showToast('Failed to load staff details', 'error');
    }
  });

  printBtn.addEventListener('click', () => {
    if (!currentStaff) return;
    printIdCard();
  });
}

function renderPreview(staff, container) {
  const frontHtml = generateIdCardFront(staff);
  const backHtml = generateIdCardBack(staff);

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
  // Extract custom fields if any
  const fatherName = staff.extra?.Father_Name || staff.extra?.['Son of Late'] || staff.extra?.['Son/Daughter/Wife of'] || '';
  const department = staff.extra?.Department || 'Health & Family Welfare';
  const identificationMark = staff.extra?.Identification_Mark || staff.extra?.['Identification Mark'] || staff.extra?.['Mark of Identification'] || '';
  const validUpto = staff.extra?.Valid_Upto || staff.extra?.['Valid Upto'] || '31/12/2030';
  
  const photo = staff.photo_url ? `<img src="${staff.photo_url}" style="width:100%; height:100%; object-fit:cover;" />` : '';

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
            <strong>Valid<br/>upto :</strong> <span>${escHtml(validUpto)}</span>
          </div>
        </div>
        <div class="idc-details-section">
          <div class="idc-office-logo">
            <img src="/assets/logo.png" alt="Emblem" style="height: 40px; margin-bottom: 2px;" onerror="this.style.display='none'"/>
            <div class="idc-office-text">OFFICE OF THE DISTRICT MEDICAL OFFICER (DMO)<br/><span class="idc-office-namsai">— NAMSAI —</span></div>
          </div>
          <table class="idc-table">
            <tr><td class="idc-lbl">NAME</td><td class="idc-sep">:</td><td class="idc-val idc-name">${escHtml(staff.full_name)}</td></tr>
            <tr><td class="idc-lbl">SON OF LATE</td><td class="idc-sep">:</td><td class="idc-val">${escHtml(fatherName)}</td></tr>
            <tr><td class="idc-lbl">DEPARTMENT</td><td class="idc-sep">:</td><td class="idc-val">${escHtml(department)}</td></tr>
            <tr><td class="idc-lbl">DESIGNATION</td><td class="idc-sep">:</td><td class="idc-val">${escHtml(staff.designation || '')}</td></tr>
            <tr><td class="idc-lbl">POSTING PLACE</td><td class="idc-sep">:</td><td class="idc-val">${escHtml(staff.facility_name || '')}</td></tr>
            <tr><td class="idc-lbl">IDENTIFICATION MARK</td><td class="idc-sep">:</td><td class="idc-val">${escHtml(identificationMark)}</td></tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

function generateIdCardBack(staff) {
  const height = staff.extra?.Height || '';
  const bloodGroup = staff.extra?.Blood_Group || staff.extra?.['Blood Group'] || '';
  const colorOfEye = staff.extra?.Color_of_Eye || staff.extra?.['Color of eye'] || '';
  const txId = staff.extra?.Tx_ID || staff.extra?.['Tx ID'] || staff.extra?.HRMS_ID || '';
  const dob = staff.date_of_birth ? new Date(staff.date_of_birth).toLocaleDateString('en-GB') : '';
  const dobWords = staff.extra?.DOB_in_words || staff.extra?.['DOB in words'] || '';
  const dateOfIssue = staff.extra?.Date_of_Issue || staff.extra?.['Date of Issue'] || '';
  const memoNo = staff.extra?.Memo_No || staff.extra?.['Memo No'] || '';
  const dated = staff.extra?.Dated || '';
  const village = staff.extra?.Village || '';
  const po = staff.extra?.Post_Office || staff.extra?.['Post Office'] || '';
  const ps = staff.extra?.Police_Station || staff.extra?.['Police Station'] || '';
  const dist = staff.district || '';

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
              <div class="idc-field"><span class="idc-f-lbl">Height:</span> <span class="idc-line">${escHtml(height)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Blood Group:</span> <span class="idc-line">${escHtml(bloodGroup)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Color of eye:</span> <span class="idc-line">${escHtml(colorOfEye)}</span></div>
            </div>
            <div class="idc-col">
              <div class="idc-field" style="justify-content: flex-end;"><span class="idc-f-lbl">Tx ID:</span> <span class="idc-line" style="width:120px;">${escHtml(txId)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">DOB:</span> <span class="idc-line">${escHtml(dob)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">DOB in words:</span> <span class="idc-line">${escHtml(dobWords)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Date of Issue:</span> <span class="idc-line">${escHtml(dateOfIssue)}</span></div>
            </div>
          </div>
          
          <!-- Middle Row -->
          <div class="idc-row idc-row-mid">
            <div class="idc-col">
              <div class="idc-section-title">Appointment Details:</div>
              <div class="idc-field"><span class="idc-f-lbl">Memo No:</span> <span class="idc-line">${escHtml(memoNo)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Dated:</span> <span class="idc-line">${escHtml(dated)}</span></div>
            </div>
            <div class="idc-col">
              <div class="idc-section-title" style="text-align: center;">PERMANENT ADDRESS</div>
              <div class="idc-line" style="width:100%; margin-top:10px;"></div>
              <div class="idc-line" style="width:100%; margin-top:16px;"></div>
            </div>
          </div>

          <!-- Bottom Row -->
          <div class="idc-row idc-row-bot">
            <div class="idc-col">
              <div class="idc-field"><span class="idc-f-lbl">Village:</span> <span class="idc-line">${escHtml(village)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Post Office:</span> <span class="idc-line">${escHtml(po)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">Police Station:</span> <span class="idc-line">${escHtml(ps)}</span></div>
              <div class="idc-field"><span class="idc-f-lbl">District:</span> <span class="idc-line">${escHtml(dist)}</span></div>
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
