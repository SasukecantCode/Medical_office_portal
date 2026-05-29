/* ═══════════════════════════════════════════════════════
   Document Vault — Profile-based file manager
   ═══════════════════════════════════════════════════════ */
import { api } from './api.js';
import { showToast } from './animations.js';

const CATEGORIES = ['Personal', 'Medical', 'Employment', 'Other'];

const ICON_SVG = {
  upload: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  rename: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  empty: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  zip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
};

let _sortField = 'category';
let _sortAsc = true;

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escA(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

function fileIconClass(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'img';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  return '';
}

function fileEmoji(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['doc', 'docx'].includes(ext)) return '📝';
  return '📎';
}

function sortDocs(docs) {
  const sorted = [...docs];
  sorted.sort((a, b) => {
    let va, vb;
    if (_sortField === 'name') { va = a.file_name.toLowerCase(); vb = b.file_name.toLowerCase(); }
    else if (_sortField === 'category') { va = a.category; vb = b.category; }
    else if (_sortField === 'size') { va = a.size; vb = b.size; }
    else if (_sortField === 'date') { va = a.updated_at || ''; vb = b.updated_at || ''; }
    else { va = a.file_name; vb = b.file_name; }
    if (va < vb) return _sortAsc ? -1 : 1;
    if (va > vb) return _sortAsc ? 1 : -1;
    return 0;
  });
  return sorted;
}

export async function renderVault(container, staffId, staffName, staffData) {
  const empId = `EMP${String(staffId).padStart(3, '0')}`;
  const photoUrl = staffData?.photo_url || '';
  const initial = (staffName || '?').charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="attachments-panel" style="margin-bottom: var(--space-lg);">
      <div class="vault-breadcrumb">
        <span class="vault-breadcrumb-link" id="vault-back-staff">Staff Records</span>
        <span class="vault-breadcrumb-sep">›</span>
        <span class="vault-breadcrumb-link" id="vault-back-profile">${esc(staffName)}</span>
        <span class="vault-breadcrumb-sep">›</span>
        <span class="vault-breadcrumb-current">Document Vault</span>
      </div>
      <div class="vault-header">
        <div class="vault-header-left">
          <div class="vault-header-avatar">
            ${photoUrl ? `<img src="${escA(photoUrl)}" alt="" />` : initial}
          </div>
          <div class="vault-header-info">
            <h3>${esc(staffName)}'s Files</h3>
            <p>Employee ${esc(empId)} — Document Vault</p>
          </div>
        </div>
        <div class="vault-header-actions">
          <a class="btn btn-ghost btn-sm" id="vault-download-all" title="Download all as ZIP">📦 Download All</a>
          <button class="btn btn-ghost btn-sm" id="vault-back-btn">← Back</button>
        </div>
      </div>
    </div>

    <div class="attachments-panel" style="margin-bottom: var(--space-lg); padding: var(--space-lg);">
      <div class="vault-upload-row">
        <label for="vault-cat-select">Category:</label>
        <select class="vault-category-select" id="vault-cat-select">
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="vault-upload-card" id="vault-upload-zone">
        ${ICON_SVG.upload}
        <p>Drag & drop files here, or click to browse</p>
        <div class="upload-hint">PDF, JPG, PNG, DOC • Max 10 MB per file</div>
        <input type="file" id="vault-file-input" multiple style="display:none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      </div>
    </div>

    <div class="attachments-panel" id="vault-list-panel">
      <div class="vault-toolbar">
        <div class="vault-toolbar-left">
          ${ICON_SVG.folder}
          <span class="vault-doc-count" id="vault-doc-count">Loading...</span>
        </div>
        <div class="vault-toolbar-left">
          <button class="vault-sort-btn active" data-sort="category">Category</button>
          <button class="vault-sort-btn" data-sort="name">Name</button>
          <button class="vault-sort-btn" data-sort="size">Size</button>
          <button class="vault-sort-btn" data-sort="date">Date</button>
        </div>
      </div>
      <div id="vault-file-list"></div>
    </div>
  `;

  // Wire navigation
  document.getElementById('vault-back-btn').addEventListener('click', () => window._navigateTo('staff-list'));
  document.getElementById('vault-back-staff').addEventListener('click', () => window._navigateTo('staff-list'));
  document.getElementById('vault-back-profile').addEventListener('click', () => {
    window._navigateTo('staff-list');
  });
  document.getElementById('vault-download-all').href = api.downloadAllDocumentsUrl(empId);

  // Sort buttons
  document.querySelectorAll('.vault-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (_sortField === field) { _sortAsc = !_sortAsc; }
      else { _sortField = field; _sortAsc = true; }
      document.querySelectorAll('.vault-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadVaultFiles(empId);
    });
  });

  // Upload zone
  const uploadZone = document.getElementById('vault-upload-zone');
  const fileInput = document.getElementById('vault-file-input');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    uploadFiles(empId, Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener('change', e => {
    uploadFiles(empId, Array.from(e.target.files));
    fileInput.value = '';
  });

  // Initial load — create folder first (idempotent), then list
  try { await api.createDocumentFolder(empId); } catch { /* ok if exists */ }
  await loadVaultFiles(empId);
}

async function loadVaultFiles(empId) {
  const listEl = document.getElementById('vault-file-list');
  const countEl = document.getElementById('vault-doc-count');
  if (!listEl) return;

  try {
    const data = await api.listDocuments(empId);
    const docs = sortDocs(data.documents || []);

    if (countEl) countEl.textContent = `${docs.length} document${docs.length !== 1 ? 's' : ''}`;

    if (docs.length === 0) {
      listEl.innerHTML = `
        <div class="vault-empty">
          <div class="vault-empty-icon">${ICON_SVG.empty}</div>
          <h4>No documents yet</h4>
          <p>Upload files using the drop zone above. Documents will be organized by category.</p>
        </div>`;
      return;
    }

    // Group by category if sorted by category
    let html = '';
    if (_sortField === 'category') {
      const groups = {};
      docs.forEach(d => {
        const cat = d.category || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(d);
      });
      for (const cat of CATEGORIES) {
        if (!groups[cat] || groups[cat].length === 0) continue;
        html += `<div class="vault-category-group">${esc(cat)} <span class="group-count">(${groups[cat].length})</span></div>`;
        html += buildTable(groups[cat], empId, false);
      }
    } else {
      html = buildTable(docs, empId, true);
    }

    listEl.innerHTML = html;
    wireRowActions(listEl, empId);
  } catch (err) {
    if (countEl) countEl.textContent = 'Error loading';
    listEl.innerHTML = `<div class="vault-empty"><h4>Could not load documents</h4><p>${esc(err.message)}</p></div>`;
  }
}

function buildTable(docs, empId, showCategory) {
  const rows = docs.map(d => `
    <tr data-path="${escA(d.file_path)}">
      <td>
        <div class="vault-file-name-cell">
          <div class="vault-file-icon ${fileIconClass(d.file_name)}">${fileEmoji(d.file_name)}</div>
          <span class="vault-file-name" title="${escA(d.file_name)}">${esc(d.file_name)}</span>
        </div>
      </td>
      ${showCategory ? `<td><span class="vault-category-badge" data-cat="${escA(d.category)}">${esc(d.category)}</span></td>` : ''}
      <td class="vault-file-size">${fmtSize(d.size)}</td>
      <td class="vault-file-date">${fmtDate(d.updated_at)}</td>
      <td>
        <div class="vault-row-actions">
          <a class="vault-action-btn download" href="${escA(api.downloadDocumentUrl(empId, d.file_path))}" download title="Download">${ICON_SVG.download}</a>
          <button class="vault-action-btn rename" data-action="rename" title="Rename">${ICON_SVG.rename}</button>
          <button class="vault-action-btn delete" data-action="delete" title="Delete">${ICON_SVG.trash}</button>
        </div>
      </td>
    </tr>`).join('');

  return `<table class="vault-file-table">
    <thead><tr>
      <th>Name</th>
      ${showCategory ? '<th>Category</th>' : ''}
      <th>Size</th>
      <th>Updated</th>
      <th>Actions</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function wireRowActions(listEl, empId) {
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const path = row.dataset.path;
      const name = path.split('/').pop();
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
      try {
        await api.deleteDocument(empId, path);
        showToast(`Deleted ${name}`, 'success');
        loadVaultFiles(empId);
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
      }
    });
  });

  listEl.querySelectorAll('[data-action="rename"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      const path = row.dataset.path;
      const nameSpan = row.querySelector('.vault-file-name');
      const oldName = nameSpan.textContent;
      const category = path.split('/')[0];

      const input = document.createElement('input');
      input.className = 'vault-rename-input';
      input.value = oldName;
      nameSpan.replaceWith(input);
      input.focus();
      input.select();

      const commit = async () => {
        const newName = input.value.trim();
        if (!newName || newName === oldName) {
          input.replaceWith(Object.assign(document.createElement('span'), {
            className: 'vault-file-name',
            textContent: oldName,
            title: oldName,
          }));
          return;
        }
        try {
          await api.renameDocument(empId, path, `${category}/${newName}`);
          showToast(`Renamed to ${newName}`, 'success');
          loadVaultFiles(empId);
        } catch (err) {
          showToast(`Rename failed: ${err.message}`, 'error');
          input.replaceWith(Object.assign(document.createElement('span'), {
            className: 'vault-file-name',
            textContent: oldName,
          }));
        }
      };

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') {
          input.replaceWith(Object.assign(document.createElement('span'), {
            className: 'vault-file-name',
            textContent: oldName,
          }));
        }
      });
      input.addEventListener('blur', commit);
    });
  });
}

async function uploadFiles(empId, files) {
  const category = document.getElementById('vault-cat-select')?.value || 'Other';
  for (const file of files) {
    try {
      showToast(`Uploading ${file.name}...`, 'info', 2000);
      await api.uploadDocument(empId, category, file);
      showToast(`${file.name} uploaded!`, 'success');
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    }
  }
  await loadVaultFiles(empId);
}
