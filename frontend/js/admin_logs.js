import { api } from './api.js';
import { showToast } from './animations.js';

const INVITE_TOKEN_CACHE_KEY = 'medical_portal_invite_tokens';

function readInviteTokenCache() {
  try {
    return JSON.parse(sessionStorage.getItem(INVITE_TOKEN_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function cacheInviteToken(inviteId, token) {
  const cache = readInviteTokenCache();
  cache[String(inviteId)] = token;
  sessionStorage.setItem(INVITE_TOKEN_CACHE_KEY, JSON.stringify(cache));
}

function getCachedInviteToken(inviteId) {
  return readInviteTokenCache()[String(inviteId)] || null;
}

function removeCachedInviteToken(inviteId) {
  const cache = readInviteTokenCache();
  delete cache[String(inviteId)];
  sessionStorage.setItem(INVITE_TOKEN_CACHE_KEY, JSON.stringify(cache));
}

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

async function copyInviteKey(token, { missingMessage } = {}) {
  if (!token) {
    showToast(missingMessage || 'Full key is only available right after generation.', 'error', 4000);
    return;
  }
  const ok = await copyText(token);
  showToast(ok ? 'Invite key copied to clipboard.' : 'Could not copy invite key.', ok ? 'success' : 'error');
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function escAttr(text) {
  return (text ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function roleLabel(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'master') return 'Master Admin';
  if (value === 'vaccination') return 'Vaccination Admin';
  return 'HR Admin';
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(String(value));
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function userCard(user) {
  const initial = (user.full_name || user.username || '?').charAt(0).toUpperCase();
  return `
    <article class="glass-panel admin-user-card" data-admin-user-id="${user.id}">
      <div class="admin-user-card-header">
        <div class="admin-user-avatar">${esc(initial)}</div>
        <div class="admin-user-card-title">
          <h4>${esc(user.full_name)}</h4>
          <p>${esc(user.profile_handle)}</p>
        </div>
      </div>
      <div class="admin-user-meta">
        <span>${esc(roleLabel(user.role))}</span>
        <span>${user.is_email_verified ? 'Verified' : 'Pending'}</span>
      </div>
      <div class="admin-user-body">
        <div><strong>Username</strong><span>${esc(user.username)}</span></div>
        <div><strong>Email</strong><span>${esc(user.email)}</span></div>
        <div><strong>Last Login</strong><span>${esc(formatWhen(user.last_login_at))}</span></div>
      </div>
      <div class="admin-user-card-footer">
        <button
          type="button"
          class="btn btn-ghost btn-sm admin-user-delete"
          data-delete-admin-user="${user.id}"
          data-admin-name="${escAttr(user.full_name)}"
          aria-label="Delete admin account"
        >Delete Account</button>
      </div>
    </article>
  `;
}

function accessLogRow(log) {
  return `
    <div class="admin-access-log-item">
      <div class="admin-access-log-main">
        <strong>${esc(log.full_name)}</strong>
        <span>${esc(log.profile_handle)} · ${esc(roleLabel(log.role))}</span>
      </div>
      <div class="admin-access-log-time">${formatWhen(log.logged_in_at)}</div>
    </div>
  `;
}

export async function renderAdminLogs(container) {
  container.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-greeting">
        <p class="page-intro">
          Generate invite keys for new admins. Access logs appear after they sign up with a key and sign in.
          You can remove HR or Vaccination admins who have signed in.
        </p>
      </div>
      <div class="dashboard-actions">
        <button type="button" class="btn btn-primary btn-sm" id="refresh-admin-logs">Refresh</button>
      </div>
    </div>

    <div class="dashboard-grid-row grid-cols-3">
      <div class="glass-panel panel-enter admin-invite-panel">
        <div class="panel-header">
          <span class="panel-title">Generate Invite Key</span>
        </div>
        <form id="admin-invite-form" class="login-form">
          <div class="login-field">
            <label for="invite-role">Role</label>
            <select id="invite-role" class="form-input-dark">
              <option value="hr">HR</option>
              <option value="vaccination">Vaccination</option>
            </select>
          </div>
          <div class="login-field">
            <label for="invite-note">Note</label>
            <input id="invite-note" class="form-input-dark" type="text" placeholder="Who is this for?" />
          </div>
          <div class="login-field">
            <label for="invite-days">Expires In Days</label>
            <input id="invite-days" class="form-input-dark" type="number" min="1" max="365" value="30" />
          </div>
          <button type="submit" class="login-btn" id="generate-invite-btn">Generate Key</button>
        </form>
        <div class="admin-invite-result" id="admin-invite-result"></div>
      </div>

      <div class="glass-panel panel-enter admin-invite-panel" style="grid-column: span 2;">
        <div class="panel-header">
          <span class="panel-title">Issued Invite Keys</span>
        </div>
        <div class="admin-invite-list" id="admin-invite-list"></div>
      </div>
    </div>

    <div class="dashboard-grid-row">
      <div class="glass-panel panel-enter">
        <div class="panel-header">
          <span class="panel-title">Access Logs</span>
        </div>
        <p class="admin-logs-hint" id="admin-access-logs-hint"></p>
        <div class="admin-access-log-list" id="admin-access-log-list"></div>
      </div>
    </div>

    <div class="dashboard-grid-row">
      <div class="glass-panel panel-enter">
        <div class="panel-header">
          <span class="panel-title">Admins Who Signed In</span>
        </div>
        <div class="admin-user-grid" id="admin-user-grid"></div>
      </div>
    </div>
  `;

  const inviteResult = document.getElementById('admin-invite-result');
  const inviteList = document.getElementById('admin-invite-list');
  const userGrid = document.getElementById('admin-user-grid');
  const accessLogList = document.getElementById('admin-access-log-list');
  const accessLogHint = document.getElementById('admin-access-logs-hint');

  const emptyAccessLogs = `
    <div class="admin-logs-empty">
      No access logs yet. Generate an invite key, have the admin complete signup with that key,
      then sign in — their first login will appear here.
    </div>
  `;

  const emptyProfiles = `
    <div class="admin-logs-empty">
      No admin profiles yet. Profiles appear here after an invite-based signup and first sign-in.
    </div>
  `;

  async function loadAdminData() {
    try {
      const [usersResp, invites, logsResp] = await Promise.all([
        api.listAdminUsers(),
        api.listAdminInvites(),
        api.listAdminAccessLogs(),
      ]);

      const logs = logsResp.logs || [];
      const users = usersResp.users || [];

      inviteList.innerHTML = (invites || []).map((invite) => {
        const isUsed = Boolean(invite.redeemed_at);
        return `
        <div class="admin-invite-item" data-invite-id="${invite.id}">
          <div>
            <strong>${esc(roleLabel(invite.role))}</strong>
            <div>${esc(invite.note || 'No note')}</div>
          </div>
          <button
            type="button"
            class="admin-invite-token admin-invite-token-copy"
            data-copy-invite="${invite.id}"
            title="Click to copy full invite key"
          >${esc(invite.token_preview)}</button>
          <div class="admin-invite-status">${isUsed ? 'Used' : 'Active'}</div>
          ${isUsed ? '' : `
            <button
              type="button"
              class="btn btn-ghost btn-sm admin-invite-delete"
              data-delete-invite="${invite.id}"
              aria-label="Delete invite key"
            >Delete</button>
          `}
        </div>
      `;
      }).join('') || '<div class="admin-logs-empty">No invite keys yet. Generate one above.</div>';

      if (logs.length === 0) {
        accessLogHint.textContent = 'Waiting for the first sign-in with a generated invite key.';
        accessLogList.innerHTML = emptyAccessLogs;
      } else {
        accessLogHint.textContent = `${logs.length} sign-in event${logs.length === 1 ? '' : 's'} recorded.`;
        accessLogList.innerHTML = logs.map(accessLogRow).join('');
      }

      userGrid.innerHTML = users.map(userCard).join('') || emptyProfiles;
    } catch (err) {
      showToast(err.message || 'Could not load admin logs.', 'error');
      accessLogList.innerHTML = emptyAccessLogs;
      userGrid.innerHTML = emptyProfiles;
    }
  }

  userGrid?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete-admin-user]');
    if (!btn) return;
    const userId = Number(btn.dataset.deleteAdminUser);
    const adminName = btn.dataset.adminName || 'this admin';
    if (!userId) return;
    if (
      !window.confirm(
        `Delete the account for ${adminName}? They will no longer be able to sign in. This cannot be undone.`,
      )
    ) {
      return;
    }

    btn.disabled = true;
    try {
      await api.deleteAdminUser(userId);
      showToast(`Deleted account for ${adminName}.`, 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err.message || 'Could not delete admin account.', 'error');
      btn.disabled = false;
    }
  });

  inviteList?.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy-invite]');
    if (copyBtn) {
      const inviteId = copyBtn.dataset.copyInvite;
      await copyInviteKey(getCachedInviteToken(inviteId), {
        missingMessage: 'Full key is only shown once when generated. Generate a new key if needed.',
      });
      return;
    }

    const btn = e.target.closest('[data-delete-invite]');
    if (!btn) return;
    const inviteId = Number(btn.dataset.deleteInvite);
    if (!inviteId) return;
    if (!window.confirm('Delete this invite key? It can no longer be used for signup.')) return;

    btn.disabled = true;
    try {
      await api.deleteAdminInvite(inviteId);
      removeCachedInviteToken(inviteId);
      showToast('Invite key deleted.', 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err.message || 'Could not delete invite key.', 'error');
      btn.disabled = false;
    }
  });

  document.getElementById('refresh-admin-logs')?.addEventListener('click', loadAdminData);
  document.getElementById('admin-invite-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('invite-role').value;
    const note = document.getElementById('invite-note').value.trim();
    const expires_in_days = Number(document.getElementById('invite-days').value || 30);
    const btn = document.getElementById('generate-invite-btn');
    btn.disabled = true;
    try {
      const result = await api.createAdminInvite({ role, note: note || null, expires_in_days });
      cacheInviteToken(result.invite.id, result.token);
      inviteResult.innerHTML = `
        <div class="admin-invite-created">
          <div>${esc(result.message)}</div>
          <button type="button" class="admin-invite-key admin-invite-key-copy" id="latest-invite-key-copy">
            ${esc(result.token)}
          </button>
          <div class="admin-invite-key-hint">Click the key to copy (4 words and 5 numbers). Share it on signup under “Admin Invite Key”.</div>
        </div>
      `;
      document.getElementById('latest-invite-key-copy')?.addEventListener('click', () => {
        copyInviteKey(result.token);
      });
      showToast('Invite key generated. Click it to copy.', 'success');
      await loadAdminData();
    } catch (err) {
      inviteResult.textContent = err.message || 'Could not generate invite key.';
      showToast(inviteResult.textContent, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  await loadAdminData();
}
