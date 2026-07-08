/* ═══════════════════════════════════════════════════════
   API Service Layer
   ═══════════════════════════════════════════════════════ */

const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'medical_portal_auth_token';
const AUTH_USER_KEY = 'medical_portal_auth_user';

function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  return Boolean(navigator.userAgentData?.mobile) || window.matchMedia?.('(pointer: coarse)')?.matches;
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthUser() {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession({ token, user }) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  clearStaffPhotoCache();
}

export function getAuthHeaders(extra = {}) {
  const headers = { ...(extra || {}) };
  const token = getAuthToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

const staffPhotoObjectUrlCache = new Map();

export function clearStaffPhotoCache() {
  for (const url of staffPhotoObjectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  staffPhotoObjectUrlCache.clear();
}

/** Fetch staff JPEG with Bearer auth; returns a blob object URL for img elements. */
export async function getStaffPhotoObjectUrl(staffId, cacheKey = '') {
  if (!staffId) return null;
  const key = `${staffId}:${cacheKey}`;
  const cached = staffPhotoObjectUrlCache.get(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/hr/staff/${staffId}/photo`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;

  const blob = await res.blob();
  if (!blob.size) return null;

  const objectUrl = URL.createObjectURL(blob);
  staffPhotoObjectUrlCache.set(key, objectUrl);
  return objectUrl;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

function formatApiErrorDetail(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item);
        const field = Array.isArray(item.loc)
          ? item.loc.filter((part) => part !== 'body').join('.')
          : '';
        const msg = item.msg || 'Invalid value';
        return field ? `${field}: ${msg}` : msg;
      })
      .join(' ');
  }
  if (typeof detail === 'object') {
    try {
      return JSON.stringify(detail);
    } catch {
      return 'Request failed';
    }
  }
  return String(detail);
}

async function request(url, options = {}) {
  const { headers: optionHeaders, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...restOptions } = options;
  const headers = {
    ...(optionHeaders || {}),
  };

  if (!(restOptions.body instanceof FormData) && restOptions.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  Object.assign(headers, getAuthHeaders(headers));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      headers,
      ...restOptions,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Is the backend running on port 8000?');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errMsg;
    const errText = await res.text();
    try {
      const errData = JSON.parse(errText);
      errMsg = formatApiErrorDetail(errData.detail) || JSON.stringify(errData);
    } catch {
      errMsg = errText;
    }
    throw new Error(errMsg || `HTTP ${res.status}`);
  }

  // Handle no-content responses
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }

  return res.json();
}

export const api = {
  // Health
  health: () => request('/health'),

  // Auth
  checkUsername: (role, username) =>
    request(`/auth/check-username?role=${encodeURIComponent(role)}&username=${encodeURIComponent(username)}`),

  signup: (payload) =>
    request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyOtp: (payload) =>
    request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resendOtp: (payload) =>
    request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request('/auth/me'),

  listAdminUsers: () => request('/auth/admin-users'),

  deleteAdminUser: (userId) =>
    request(`/auth/admin-users/${userId}`, {
      method: 'DELETE',
    }),

  listAdminAccessLogs: () => request('/auth/admin-access-logs'),

  listAdminInvites: () => request('/auth/admin-invites'),

  createAdminInvite: (payload) =>
    request('/auth/admin-invites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAdminInvite: (inviteId) =>
    request(`/auth/admin-invites/${inviteId}`, {
      method: 'DELETE',
    }),

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearAuthSession();
    }
  },

  // Dashboard
  dashboard: () => request('/dashboard'),

  // Notifications
  generateNotifications: () => request('/hr/notifications/generate', { method: 'POST' }),
  getNotifications: (status) => request(`/hr/notifications?status=${status}`),
  acknowledgeNotification: (id) => request(`/hr/notifications/${id}/acknowledge`, { method: 'PATCH' }),

  // HR Staff
  listStaff: (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== null && v !== undefined) {
        qs.append(k, v);
      }
    }
    const query = qs.toString();
    return request(`/hr/staff${query ? `?${query}` : ''}`);
  },

  getStaff: (id) => request(`/hr/staff/${id}`),

  createStaff: (data) =>
    request('/hr/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStaff: (id, data) =>
    request(`/hr/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteStaff: (id) =>
    request(`/hr/staff/${id}`, {
      method: 'DELETE',
    }),

  exportStaff: async (format = 'xlsx') => {
    const exportUrl = `${API_BASE}/hr/staff/export?format=${encodeURIComponent(format)}`;

    if (isLikelyMobileDevice()) {
      const a = document.createElement('a');
      a.href = exportUrl;
      a.rel = 'noopener';
      a.target = '_self';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    const res = await fetch(exportUrl, { headers: getAuthHeaders() });
    if (!res.ok) {
      let errMsg = `Export failed (HTTP ${res.status})`;
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        errMsg = data.detail || errMsg;
      } catch {
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/i);
    const filename = match?.[1] || `staff_export.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // Profile photo (required JPEG)
  uploadProfilePhoto: async (staffId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/hr/staff/${staffId}/photo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      const errMsg = await res.text();
      throw new Error(errMsg || `Photo upload failed: HTTP ${res.status}`);
    }

    return res.json();
  },

  deleteProfilePhoto: (staffId) =>
    request(`/hr/staff/${staffId}/photo`, {
      method: 'DELETE',
    }),

  // Attachments
  listAttachments: (staffId) =>
    request(`/hr/staff/${staffId}/attachments`),

  uploadAttachment: async (staffId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/hr/staff/${staffId}/attachments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      const errMsg = await res.text();
      throw new Error(errMsg || `Upload failed: HTTP ${res.status}`);
    }

    return res.json();
  },

  getAttachmentUrl: (staffId, attachmentId) =>
    `${API_BASE}/hr/staff/${staffId}/attachments/${attachmentId}`,

  // ── Document Vault (GCS-backed) ──
  listDocuments: (employeeId) =>
    request(`/documents/${employeeId}`),

  uploadDocument: async (employeeId, category, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const qs = new URLSearchParams({ employee_id: employeeId, category });
    const res = await fetch(`${API_BASE}/documents/upload?${qs.toString()}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      let errMsg;
      const text = await res.text();
      try { const d = JSON.parse(text); errMsg = d.detail || JSON.stringify(d); } catch { errMsg = text; }
      throw new Error(errMsg || `Upload failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  downloadDocumentUrl: (employeeId, filePath) => {
    const qs = new URLSearchParams({ employee_id: employeeId, file_path: filePath });
    return `${API_BASE}/documents/download?${qs.toString()}`;
  },

  downloadAllDocumentsUrl: (employeeId) =>
    `${API_BASE}/documents/download-all/${employeeId}`,

  deleteDocument: (employeeId, filePath) =>
    request('/documents/delete', {
      method: 'DELETE',
      body: JSON.stringify({ employee_id: employeeId, file_path: filePath }),
    }),

  renameDocument: (employeeId, oldPath, newPath) =>
    request('/documents/rename', {
      method: 'PUT',
      body: JSON.stringify({ employee_id: employeeId, old_path: oldPath, new_path: newPath }),
    }),

  createDocumentFolder: (employeeId) =>
    request('/documents/create-folder', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId }),
    }),

  // ── Document Drafts (ONLYOFFICE) ──
  createDraft: (employeeId, title) =>
    request('/documents/drafts/create', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, title: title || null }),
    }),

  listDrafts: (employeeId) =>
    request(`/documents/drafts/${encodeURIComponent(employeeId)}`),

  getDraft: (employeeId, draftId) =>
    request(`/documents/drafts/${encodeURIComponent(employeeId)}/${encodeURIComponent(draftId)}`),


  deleteDraft: (employeeId, draftId) =>
    request(`/documents/drafts/${encodeURIComponent(employeeId)}/${encodeURIComponent(draftId)}`, {
      method: 'DELETE',
    }),

  renameDraft: (employeeId, draftId, newTitle) =>
    request(`/documents/drafts/${encodeURIComponent(employeeId)}/${encodeURIComponent(draftId)}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ title: newTitle }),
    }),

  downloadDraftSourceUrl: (employeeId, draftId, token) => {
    const qs = new URLSearchParams({ token });
    return `${API_BASE}/documents/drafts/${encodeURIComponent(employeeId)}/${encodeURIComponent(draftId)}/source?${qs.toString()}`;
  },

  // HR Agent (chat / import)
  agentChat: (body) =>
    request('/hr/agent/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  agentParse: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/hr/agent/parse`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      let errMsg;
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        errMsg = formatApiErrorDetail(data.detail) || JSON.stringify(data);
      } catch {
        errMsg = text;
      }
      throw new Error(errMsg || `Parse failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  agentImport: async (file, mapping) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    const res = await fetch(`${API_BASE}/hr/agent/import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      let errMsg;
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        errMsg = formatApiErrorDetail(data.detail) || JSON.stringify(data);
      } catch {
        errMsg = text;
      }
      throw new Error(errMsg || `Import failed: HTTP ${res.status}`);
    }
    return res.json();
  },

  // HR Field Definitions (custom fields)
  listFieldDefs: () => request('/hr/agent/fields'),

  // Suggestions (autocomplete for form fields)
  suggestions: (field, q = '') => {
    const qs = new URLSearchParams({ field });
    if (q) qs.append('q', q);
    return request(`/hr/staff/suggestions?${qs.toString()}`);
  },
};
