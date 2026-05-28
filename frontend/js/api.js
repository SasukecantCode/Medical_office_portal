/* ═══════════════════════════════════════════════════════
   API Service Layer
   ═══════════════════════════════════════════════════════ */

const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg;
    try {
      const errData = await res.json();
      errMsg = errData.detail || JSON.stringify(errData);
    } catch {
      errMsg = await res.text();
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

  // Dashboard
  dashboard: () => request('/dashboard'),

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

  exportStaff: (format = 'xlsx') => {
    window.location.href = `${API_BASE}/hr/staff/export?format=${format}`;
  },

  // Profile photo (required JPEG)
  uploadProfilePhoto: async (staffId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/hr/staff/${staffId}/photo`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errMsg = await res.text();
      throw new Error(errMsg || `Photo upload failed: HTTP ${res.status}`);
    }

    return res.json();
  },

  // Attachments
  listAttachments: (staffId) =>
    request(`/hr/staff/${staffId}/attachments`),

  uploadAttachment: async (staffId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/hr/staff/${staffId}/attachments`, {
      method: 'POST',
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

  // HR Field Definitions (custom fields)
  listFieldDefs: () => request('/hr/agent/fields'),

  // Suggestions (autocomplete for form fields)
  suggestions: (field, q = '') => {
    const qs = new URLSearchParams({ field });
    if (q) qs.append('q', q);
    return request(`/hr/staff/suggestions?${qs.toString()}`);
  },
};
