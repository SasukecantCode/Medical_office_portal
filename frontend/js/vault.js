/* ═══════════════════════════════════════════════════════
   Document Vault — Profile-based file manager
   ═══════════════════════════════════════════════════════ */
import { api, getAuthHeaders } from './api.js';
import { showToast } from './animations.js';
import { applyStaffPhotoToElement } from './staff.js';

const CATEGORIES = ['Personal', 'Medical', 'Employment', 'Other'];

const ICON_SVG = {
  upload: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  rename: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  empty: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  zip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
  draft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
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
  const empIdRaw = `EMP${String(staffId).padStart(3, '0')}`;
  const safeName = (staffName || 'Unknown').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
  const empId = `${safeName}_${empIdRaw}`;
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
          <div class="vault-header-avatar staff-avatar staff-avatar--pending" style="width:56px;height:56px;">
            <span class="staff-avatar-initial">${initial}</span>
          </div>
          <div class="vault-header-info">
            <h3>${esc(staffName)}'s Files</h3>
            <p>Employee ${esc(empIdRaw)} — Document Vault</p>
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
        <div id="vault-upload-content" style="display: flex; flex-direction: column; align-items: center;">
          ${ICON_SVG.upload}
          <p>Drag & drop files here, or click to browse</p>
          <div class="upload-hint">PDF, JPG, PNG, DOC • Max 10 MB per file</div>
        </div>
        <div id="vault-upload-loader" style="display: none; flex-direction: column; align-items: center;">
          <div class="vault-spinner" style="margin-bottom: 1rem;"></div>
          <p id="vault-upload-loader-text">Uploading files...</p>
        </div>
        <input type="file" id="vault-file-input" multiple style="display:none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      </div>
    </div>

    <div class="attachments-panel drafts-card" id="vault-drafts-panel" style="margin-bottom: var(--space-lg);">
      <div class="drafts-card-header">
        <div class="drafts-card-header-left">
          <div class="drafts-card-icon">${ICON_SVG.draft}</div>
          <div>
            <h4 class="drafts-card-title">Document Drafts</h4>
            <p class="drafts-card-subtitle">Create and edit Word documents with ONLYOFFICE</p>
          </div>
        </div>
        <button class="btn-create-draft" id="vault-create-draft-btn" title="New Draft">
          ${ICON_SVG.plus}
          <span>New Draft</span>
        </button>
      </div>
      <div id="vault-drafts-list" class="drafts-list"></div>
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

  const vaultAvatar = container.querySelector('.vault-header-avatar');
  if (vaultAvatar) {
    await applyStaffPhotoToElement(vaultAvatar, { id: staffId, ...staffData });
  }

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

  // Create draft button
  document.getElementById('vault-create-draft-btn').addEventListener('click', async () => {
    const title = prompt('Draft title (leave blank for "Untitled Draft"):');
    if (title === null) return; // cancelled
    try {
      showToast('Creating draft…', 'info', 2000);
      await api.createDraft(empId, title || 'Untitled Draft');
      showToast('Draft created!', 'success');
      await loadDrafts(empId);
    } catch (err) {
      showToast(`Failed to create draft: ${err.message}`, 'error');
    }
  });

  // Initial load — create folder first (idempotent), then list
  try { await api.createDocumentFolder(empId); } catch { /* ok if exists */ }
  await Promise.all([loadVaultFiles(empId), loadDrafts(empId)]);
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
        <div class="vault-file-name-cell" style="cursor: pointer;" data-action="preview">
          <div class="vault-file-icon ${fileIconClass(d.file_name)}">${fileEmoji(d.file_name)}</div>
          <span class="vault-file-name" title="${escA(d.file_name)}">${esc(d.file_name)}</span>
        </div>
      </td>
      ${showCategory ? `<td><span class="vault-category-badge" data-cat="${escA(d.category)}">${esc(d.category)}</span></td>` : ''}
      <td class="vault-file-size">${fmtSize(d.size)}</td>
      <td class="vault-file-date">${fmtDate(d.updated_at)}</td>
      <td>
        <div class="vault-row-actions">
          <button class="vault-action-btn download" data-action="download" title="Download">${ICON_SVG.download}</button>
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

/**
 * Fetch a document with auth headers and return a blob URL.
 * This is necessary because <object>/<iframe>/<img> tags cannot send
 * Authorization headers, so we fetch via JS and create a local blob URL.
 */
async function fetchAuthenticatedBlobUrl(apiUrl) {
  const res = await fetch(apiUrl, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Trigger a download for a file behind auth. */
async function downloadWithAuth(apiUrl, filename) {
  try {
    const blobUrl = await fetchAuthenticatedBlobUrl(apiUrl);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    showToast(`Download failed: ${err.message}`, 'error');
  }
}

async function openPreviewModal(apiUrl, filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();

  // Build the overlay with a loader immediately
  const overlay = document.createElement('div');
  overlay.className = 'vault-preview-overlay';
  overlay.innerHTML = `
    <div class="vault-preview-card">
      <div class="vault-preview-header">
        <h3 title="${escA(filename)}">${esc(filename)}</h3>
        <div class="vault-preview-header-actions">
          <button class="vault-preview-open-btn" id="vault-preview-newtab" title="Open in new tab">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button class="vault-preview-download-btn" id="vault-preview-dl" title="Download">
            ${ICON_SVG.download}
          </button>
          <button class="vault-preview-close">&times;</button>
        </div>
      </div>
      <div class="vault-preview-body">
        <div class="vault-preview-loader"><div class="vault-spinner"></div></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  const closeBtn = overlay.querySelector('.vault-preview-close');
  const bodyEl = overlay.querySelector('.vault-preview-body');
  let _blobUrl = null;

  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.remove();
      if (_blobUrl) URL.revokeObjectURL(_blobUrl);
    }, 300);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  // Wire "Open in new tab" and "Download" buttons
  overlay.querySelector('#vault-preview-newtab').addEventListener('click', async () => {
    try {
      const url = _blobUrl || await fetchAuthenticatedBlobUrl(apiUrl);
      window.open(url, '_blank');
    } catch { showToast('Failed to open file', 'error'); }
  });
  overlay.querySelector('#vault-preview-dl').addEventListener('click', () => {
    downloadWithAuth(apiUrl, filename);
  });

  // Fetch the file content with auth
  try {
    const res = await fetch(apiUrl, { headers: getAuthHeaders() });
    if (!res.ok) {
      let errDetail = `HTTP ${res.status}`;
      try { const j = await res.json(); errDetail = j.detail || errDetail; } catch { /* ignore */ }
      throw new Error(errDetail);
    }
    const blob = await res.blob();
    _blobUrl = URL.createObjectURL(blob);
  } catch (err) {
    bodyEl.innerHTML = `<div class="preview-unsupported">
      ${ICON_SVG.empty}
      <p>Failed to load file: ${esc(err.message)}</p>
      <button class="btn btn-primary btn-sm" id="vault-preview-retry">Retry</button>
    </div>`;
    bodyEl.querySelector('#vault-preview-retry')?.addEventListener('click', () => {
      close();
      openPreviewModal(apiUrl, filename);
    });
    return;
  }

  // Render content using the blob URL
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    const img = document.createElement('img');
    img.className = 'preview-media';
    img.alt = filename;
    bodyEl.innerHTML = '';
    bodyEl.appendChild(img);

    img.onload = () => { /* rendered OK */ };
    img.onerror = () => {
      bodyEl.innerHTML = `<div class="preview-unsupported">
        ${ICON_SVG.empty}
        <p>Image failed to render</p>
        <button class="btn btn-primary btn-sm" id="vault-preview-open-fallback">Open in New Tab</button>
      </div>`;
      bodyEl.querySelector('#vault-preview-open-fallback')?.addEventListener('click', () => {
        window.open(_blobUrl, '_blank');
      });
    };
    img.src = _blobUrl;

  } else if (ext === 'pdf') {
    bodyEl.innerHTML = `
      <object data="${escA(_blobUrl)}" type="application/pdf" class="preview-media preview-pdf">
        <iframe src="${escA(_blobUrl)}" class="preview-media preview-pdf"></iframe>
      </object>`;

  } else {
    bodyEl.innerHTML = `<div class="preview-unsupported">
      ${ICON_SVG.empty}
      <p>Preview not available for .${esc(ext)} files</p>
      <button class="btn btn-primary" id="vault-preview-dl-unsupported">Download File</button>
    </div>`;
    bodyEl.querySelector('#vault-preview-dl-unsupported')?.addEventListener('click', () => {
      downloadWithAuth(apiUrl, filename);
    });
  }
}

function wireRowActions(listEl, empId) {
  listEl.querySelectorAll('[data-action="preview"]').forEach(el => {
    el.addEventListener('click', () => {
      const row = el.closest('tr');
      const path = row.dataset.path;
      const nameSpan = row.querySelector('.vault-file-name');
      const filename = nameSpan.textContent;
      const apiUrl = api.downloadDocumentUrl(empId, path);
      openPreviewModal(apiUrl, filename);
    });
  });

  listEl.querySelectorAll('[data-action="download"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      const path = row.dataset.path;
      const filename = path.split('/').pop();
      const apiUrl = api.downloadDocumentUrl(empId, path);
      downloadWithAuth(apiUrl, filename);
    });
  });

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
  const uploadContent = document.getElementById('vault-upload-content');
  const uploadLoader = document.getElementById('vault-upload-loader');
  const loaderText = document.getElementById('vault-upload-loader-text');

  if (uploadContent && uploadLoader) {
    uploadContent.style.display = 'none';
    uploadLoader.style.display = 'flex';
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (loaderText) {
      loaderText.textContent = `Uploading ${file.name} (${i + 1} of ${files.length})...`;
    }
    try {
      showToast(`Uploading ${file.name}...`, 'info', 2000);
      await api.uploadDocument(empId, category, file);
      showToast(`${file.name} uploaded!`, 'success');
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, 'error');
    }
  }

  if (uploadContent && uploadLoader) {
    uploadContent.style.display = 'flex';
    uploadLoader.style.display = 'none';
  }

  await loadVaultFiles(empId);
}

/* ═══════════════════════════════════════════════════════
   Draft management — dedicated Drafts card
   ═══════════════════════════════════════════════════════ */

async function loadDrafts(empId) {
  const listEl = document.getElementById('vault-drafts-list');
  if (!listEl) return;

  try {
    const data = await api.listDrafts(empId);
    const drafts = data.drafts || [];

    if (drafts.length === 0) {
      listEl.innerHTML = `
        <div class="drafts-empty">
          <div class="drafts-empty-icon">${ICON_SVG.draft}</div>
          <p>No drafts yet</p>
          <span>Click "New Draft" to create a blank Word document</span>
        </div>`;
      return;
    }

    listEl.innerHTML = drafts.map(d => `
      <div class="draft-item" data-draft-id="${escA(d.draft_id)}" data-emp-id="${escA(d.employee_id)}">
        <div class="draft-item-icon">📝</div>
        <div class="draft-item-info">
          <div class="draft-item-title">${esc(d.title)}</div>
          <div class="draft-item-meta">
            ${ICON_SVG.clock}
            <span>${fmtDate(d.updated_at)}</span>
            <span class="draft-meta-sep">•</span>
            <span>${fmtSize(d.size)}</span>
            <span class="draft-meta-sep">•</span>
            <span class="draft-version-badge">v${d.version}</span>
          </div>
        </div>
        <div class="draft-item-actions">
          <button class="draft-action-btn draft-action-rename" data-action="rename-draft" title="Rename Draft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="draft-action-btn draft-action-download" data-action="download-draft" title="Download DOCX">
            ${ICON_SVG.download}
          </button>
          <button class="draft-action-btn draft-action-delete" data-action="delete-draft" title="Delete Draft">
            ${ICON_SVG.trash}
          </button>
        </div>
      </div>
    `).join('');

    wireDraftActions(listEl, empId);
  } catch (err) {
    listEl.innerHTML = `
      <div class="drafts-empty">
        <p>Could not load drafts</p>
        <span>${esc(err.message)}</span>
      </div>`;
  }
}

function wireDraftActions(listEl, empId) {
  listEl.querySelectorAll('[data-action="rename-draft"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.draft-item');
      const draftId = item.dataset.draftId;
      const empIdVal = item.dataset.empId;
      const currentTitle = item.querySelector('.draft-item-title')?.textContent || 'Untitled Draft';

      const newTitle = prompt('Enter new document name:', currentTitle);
      if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;

      try {
        await api.renameDraft(empIdVal, draftId, newTitle.trim());
        showToast('Draft renamed successfully', 'success');
        loadDrafts(empId);
      } catch (err) {
        showToast(`Rename failed: ${err.message}`, 'error');
      }
    });
  });

  listEl.querySelectorAll('[data-action="download-draft"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.draft-item');
      const draftId = item.dataset.draftId;
      const empIdVal = item.dataset.empId;
      const title = item.querySelector('.draft-item-title')?.textContent || draftId;
      try {
        const apiUrl = `/api/documents/drafts/${empIdVal}/${draftId}/source`;
        downloadWithAuth(apiUrl, `${title}.docx`);
      } catch (err) {
        showToast(`Download failed: ${err.message}`, 'error');
      }
    });
  });

  listEl.querySelectorAll('[data-action="delete-draft"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.draft-item');
      const draftId = item.dataset.draftId;
      const empIdVal = item.dataset.empId;
      const title = item.querySelector('.draft-item-title')?.textContent || 'this draft';
      if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
      try {
        await api.deleteDraft(empIdVal, draftId);
        showToast('Draft deleted', 'success');
        item.classList.add('draft-item--removing');
        setTimeout(() => loadDrafts(empId), 300);
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
      }
    });
  });
}
