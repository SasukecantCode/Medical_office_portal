const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const API_BASE = 'http://localhost:8000/api';
let authToken = localStorage.getItem('desktop_auth_token');
let currentStaffId = null;

// UI Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const staffListEl = document.getElementById('staff-list');
const noSelection = document.getElementById('no-selection');
const vaultContent = document.getElementById('vault-content');
const draftsList = document.getElementById('drafts-list');
const staffNameTitle = document.getElementById('staff-name-title');

// Initialize
async function init() {
  // Listen for Tauri events
  await listen('upload-complete', (event) => {
    console.log("Upload complete", event.payload);
    // Find the button and flash it green briefly
    const card = document.querySelector(`.draft-card[data-id="${event.payload.draft_id}"]`);
    if (card) {
      const btn = card.querySelector('.edit-btn');
      const originalText = btn.textContent;
      btn.textContent = "Saved to Cloud!";
      btn.style.backgroundColor = "green";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = "";
      }, 3000);
    }
  });
  
  await listen('conflict', (event) => {
    alert(`Conflict Error: ${event.payload.message}`);
    loadDrafts(); // reload to get the latest version
  });
  
  await listen('edit-session-ended', (event) => {
    console.log("Session ended for", event.payload);
    loadDrafts();
  });

  if (authToken) {
    showMain();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.classList.add('active');
  mainView.classList.remove('active');
}

function showMain() {
  loginView.classList.remove('active');
  mainView.classList.add('active');
  loadStaff();
}

// Fetch Wrapper
async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  loginError.textContent = 'Logging in...';
  
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'hr', login: username, password })
    });
    authToken = data.access_token;
    localStorage.setItem('desktop_auth_token', authToken);
    showMain();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  authToken = null;
  localStorage.removeItem('desktop_auth_token');
  currentStaffId = null;
  staffListEl.innerHTML = '';
  showLogin();
});

// Load Staff Directory
async function loadStaff() {
  try {
    const data = await apiRequest('/hr/staff');
    const staffMembers = data.items || [];
    staffListEl.innerHTML = '';
    
    staffMembers.forEach(staff => {
      const li = document.createElement('li');
      li.textContent = `${staff.first_name} ${staff.last_name}`;
      li.onclick = () => selectStaff(staff.employee_id, li, staff);
      staffListEl.appendChild(li);
    });
  } catch (err) {
    console.error("Failed to load staff", err);
  }
}

// Select Staff
function selectStaff(id, liEl, staffData) {
  currentStaffId = id;
  document.querySelectorAll('#staff-list li').forEach(el => el.classList.remove('active'));
  liEl.classList.add('active');
  
  noSelection.style.display = 'none';
  vaultContent.style.display = 'block';
  staffNameTitle.textContent = `${staffData.first_name} ${staffData.last_name}'s Vault`;
  
  loadDrafts();
}

// Load Drafts
async function loadDrafts() {
  if (!currentStaffId) return;
  draftsList.innerHTML = '<p>Loading drafts...</p>';
  try {
    const data = await apiRequest(`/documents/drafts/${currentStaffId}`);
    renderDrafts(data.drafts || []);
  } catch (err) {
    draftsList.innerHTML = `<p class="error">Failed to load drafts: ${err.message}</p>`;
  }
}

function renderDrafts(drafts) {
  draftsList.innerHTML = '';
  if (drafts.length === 0) {
    draftsList.innerHTML = '<p>No drafts found.</p>';
    return;
  }
  
  drafts.forEach(draft => {
    const card = document.createElement('div');
    card.className = 'draft-card';
    card.setAttribute('data-id', draft.draft_id);
    card.innerHTML = `
      <h4>${draft.title}</h4>
      <p>Last edited: ${new Date(draft.updated_at).toLocaleString()}</p>
      <p>Version: ${draft.version}</p>
      <div class="draft-actions">
        <button class="edit-btn">Edit in Word</button>
      </div>
    `;
    
    card.querySelector('.edit-btn').onclick = (e) => {
      const btn = e.target;
      if (btn.textContent === 'Finish Editing') {
        endEditSession(draft.draft_id);
      } else {
        editInWord(draft.draft_id, draft.title, draft.version, btn);
      }
    };
    draftsList.appendChild(card);
  });
}

// Create Blank Draft
document.getElementById('new-draft-btn').addEventListener('click', async () => {
  const title = prompt("Enter draft title:");
  if (!title) return;
  
  try {
    await apiRequest('/documents/drafts/create', {
      method: 'POST',
      body: JSON.stringify({ employee_id: currentStaffId, title: title })
    });
    loadDrafts();
  } catch (err) {
    alert(`Failed to create draft: ${err.message}`);
  }
});

// Native Word Editing Flow
async function editInWord(draftId, title, version, btn) {
  const downloadUrl = `${API_BASE}/documents/drafts/${currentStaffId}/${draftId}/source`;
  const uploadUrl = `${API_BASE}/documents/drafts/${currentStaffId}/${draftId}/content`;
  
  btn.textContent = 'Finish Editing';
  btn.style.backgroundColor = '#ef4444'; // red indicating close session
  
  try {
    // Call the Rust backend to handle the native flow detached
    await invoke('edit_document', {
      employeeId: currentStaffId,
      draftId: draftId,
      filename: `${title}.docx`,
      downloadUrl: downloadUrl,
      uploadUrl: uploadUrl,
      token: authToken,
      expectedVersion: version
    });
  } catch (err) {
    alert(`Error editing document: ${err}`);
    loadDrafts();
  }
}

async function endEditSession(draftId) {
  try {
    await invoke('end_edit_session', { draftId });
  } catch(e) {
    console.error(e);
  }
}

init();
