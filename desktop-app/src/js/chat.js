/**
 * Chat Assistant Module
 * Handles the import assistant chat panel with file upload and API communication.
 * Enhanced agent mode supports all portal actions: CRUD, bulk ID cards, exports, navigation.
 */

import { api } from './api.js';
import { generateIdCardsZip } from './id_cards.js';

// DOM references
const chatPanel = document.getElementById('chat-panel');
const chatToggle = document.getElementById('chat-toggle');
const chatClose = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatFileInput = document.getElementById('chat-file-input');
const chatUploadBtn = document.getElementById('chat-upload-btn');
const chatModeSelect = document.getElementById('chat-mode-select');
const chatThreadSelect = document.getElementById('chat-thread-select');
const chatNewThreadBtn = document.getElementById('chat-new-thread-btn');

const CHAT_STORE_KEY = 'import_assistant_chat_store_v1';
const LEGACY_STORAGE_KEY = 'import_assistant_chat_v1';
const MODE_STORAGE_KEY = 'import_assistant_chat_mode_v1';
const DEFAULT_THREAD_TITLE = 'New chat';
const WELCOME_TEXT = "👋 Hi! I'm your DMO Office AI assistant. Upload a CSV or XLSX file to get started.";

// Chat state
let currentFile = null;
let parseResult = null;
let mappingInProgress = false;

function safeJsonParse(str, fallback) {
  try {
    const val = JSON.parse(str);
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(str) {
  return (str ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdownSafe(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function createConversation(title = DEFAULT_THREAD_TITLE) {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    title,
    messages: [{ text: WELCOME_TEXT, isUser: false, ts: Date.now() }],
  };
}

function loadChatStore() {
  const raw = localStorage.getItem(CHAT_STORE_KEY);
  const parsed = safeJsonParse(raw, null);
  if (
    parsed &&
    Array.isArray(parsed.conversations) &&
    parsed.conversations.length > 0
  ) {
    return parsed;
  }

  // Migration: older builds stored a single flat messages array.
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  const legacyItems = safeJsonParse(legacyRaw, null);
  if (Array.isArray(legacyItems) && legacyItems.length > 0) {
    const convo = createConversation();
    convo.title = 'Imported chat';
    convo.messages = legacyItems;
    return {
      activeId: convo.id,
      conversations: [convo],
    };
  }

  const conversation = createConversation();
  return {
    activeId: conversation.id,
    conversations: [conversation],
  };
}

function saveChatStore(store) {
  try {
    localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota / private mode
  }
}

function getActiveConversation(store) {
  return store.conversations.find((c) => c.id === store.activeId) || store.conversations[0];
}

function setActiveConversation(id) {
  const store = loadChatStore();
  const exists = store.conversations.some((c) => c.id === id);
  if (!exists) return;
  store.activeId = id;
  saveChatStore(store);
}

function deleteActiveConversation() {
  const store = loadChatStore();
  store.conversations = store.conversations.filter(c => c.id !== store.activeId);
  
  if (store.conversations.length === 0) {
    const convo = createConversation();
    store.conversations.push(convo);
  }
  
  store.activeId = store.conversations[0].id;
  saveChatStore(store);
  renderThreadOptions();
  restoreMessages();
}

function getStoredMessages() {
  const store = loadChatStore();
  const convo = getActiveConversation(store);
  return Array.isArray(convo.messages) ? convo.messages : [];
}

function storeMessages(items) {
  const store = loadChatStore();
  const convo = getActiveConversation(store);
  convo.messages = items.slice(-200);
  saveChatStore(store);
}

function persistMessage(text, isUser, opts = {}) {
  const store = loadChatStore();
  const convo = getActiveConversation(store);
  const items = Array.isArray(convo.messages) ? convo.messages : [];
  items.push({
    text: text ?? '',
    isUser: !!isUser,
    ts: Date.now(),
    html: opts.html || null,
  });
  convo.messages = items.slice(-200);

  if (isUser && convo.title === DEFAULT_THREAD_TITLE) {
    const trimmed = (text || '').trim();
    if (trimmed) {
      convo.title = trimmed.length > 28 ? `${trimmed.slice(0, 28)}...` : trimmed;
    }
  }

  saveChatStore(store);
  renderThreadOptions();
}

function restoreMessages() {
  const stored = getStoredMessages();
  if (!stored.length) {
    chatMessages.innerHTML = '';
    return false;
  }

  chatMessages.innerHTML = '';
  stored.forEach((m) => {
    addMessage(m.text, !!m.isUser, { persist: false, html: m.html || null });
  });
  return true;
}

function renderThreadOptions() {
  if (!chatThreadSelect) return;
  const store = loadChatStore();
  chatThreadSelect.innerHTML = '';

  if (!Array.isArray(store.conversations) || store.conversations.length === 0) {
    const conversation = createConversation();
    const fixed = { activeId: conversation.id, conversations: [conversation] };
    saveChatStore(fixed);
    store.activeId = fixed.activeId;
    store.conversations = fixed.conversations;
  }

  store.conversations.forEach((c, i) => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.title || `Chat ${i + 1}`;
    if (c.id === store.activeId) {
      option.selected = true;
    }
    chatThreadSelect.appendChild(option);
  });

  // Add separator and delete option
  const separator = document.createElement('option');
  separator.disabled = true;
  separator.textContent = '──────────';
  chatThreadSelect.appendChild(separator);
  
  const deleteOption = document.createElement('option');
  deleteOption.value = '__delete__';
  deleteOption.textContent = '🗑 Delete current chat';
  chatThreadSelect.appendChild(deleteOption);
}

function createNewThread() {
  const store = loadChatStore();
  const conversation = createConversation();
  store.conversations.unshift(conversation);
  store.activeId = conversation.id;
  saveChatStore(store);
  renderThreadOptions();
  restoreMessages();
  addMessage('Started a new chat.', false);
}

function getChatMode() {
  const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
  if (storedMode === 'agent' || storedMode === 'ask') {
    return storedMode;
  }
  return 'ask';
}

function setChatMode(mode) {
  const safeMode = mode === 'agent' ? 'agent' : 'ask';
  try {
    localStorage.setItem(MODE_STORAGE_KEY, safeMode);
  } catch {
    // ignore storage issues
  }
  if (chatModeSelect) {
    chatModeSelect.value = safeMode;
  }
}

function getConversationMessages(limit = 16) {
  const stored = getStoredMessages();
  return stored.slice(-limit).map((m) => ({
    role: m.isUser ? 'user' : 'assistant',
    content: m.text,
  }));
}

const mobileChatMq = window.matchMedia('(max-width: 768px)');

function resetChatViewport() {
  chatPanel?.classList.remove('keyboard-visible');
  const root = document.documentElement;
  root.style.removeProperty('--chat-vv-height');
  root.style.removeProperty('--chat-vv-top');
  if (chatPanel) {
    chatPanel.style.removeProperty('height');
    chatPanel.style.removeProperty('top');
    chatPanel.style.removeProperty('left');
    chatPanel.style.removeProperty('right');
    chatPanel.style.removeProperty('width');
  }
}

function syncChatViewport() {
  if (!chatPanel?.classList.contains('open') || !mobileChatMq.matches) {
    resetChatViewport();
    return;
  }

  const vv = window.visualViewport;
  const root = document.documentElement;

  if (!vv) {
    root.style.setProperty('--chat-vv-height', '100dvh');
    root.style.setProperty('--chat-vv-top', '0px');
    chatPanel.style.height = '100dvh';
    chatPanel.style.top = '0px';
    chatPanel.style.left = '0';
    chatPanel.style.right = '0';
    chatPanel.style.width = '100%';
    return;
  }

  let height = Math.round(vv.height);
  let top = Math.round(vv.offsetTop);
  if (height < 120) {
    height = Math.round(window.innerHeight);
    top = 0;
  }
  const keyboardGap = Math.max(0, window.innerHeight - height - top);

  root.style.setProperty('--chat-vv-height', `${height}px`);
  root.style.setProperty('--chat-vv-top', `${top}px`);

  chatPanel.style.left = '0';
  chatPanel.style.right = '0';
  chatPanel.style.width = '100%';
  chatPanel.style.height = `${height}px`;
  chatPanel.style.top = `${top}px`;

  const keyboardVisible = keyboardGap > 50 || height < window.innerHeight * 0.85;
  chatPanel.classList.toggle('keyboard-visible', keyboardVisible);

  if (vv.offsetTop > 0 || window.scrollY > 0) {
    window.scrollTo(0, 0);
  }

  if (chatMessages) {
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }
}

function initMobileChatViewport() {
  if (!window.visualViewport) return;

  const onViewportChange = () => syncChatViewport();

  window.visualViewport.addEventListener('resize', onViewportChange);
  window.visualViewport.addEventListener('scroll', onViewportChange);
  mobileChatMq.addEventListener('change', () => {
    if (!mobileChatMq.matches) resetChatViewport();
    else syncChatViewport();
  });

  chatInput?.addEventListener('focus', () => {
    setTimeout(syncChatViewport, 50);
    setTimeout(syncChatViewport, 150);
    setTimeout(syncChatViewport, 320);
    setTimeout(syncChatViewport, 500);
  });

  chatInput?.addEventListener('input', () => {
    if (mobileChatMq.matches && chatPanel.classList.contains('open')) {
      syncChatViewport();
    }
  });

  chatInput?.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== chatInput) {
        chatPanel?.classList.remove('keyboard-visible');
        syncChatViewport();
      }
    }, 120);
  });
}

function setChatOpen(isOpen) {
  if (!chatPanel) return;
  chatPanel.classList.toggle('open', isOpen);
  document.body.classList.toggle('chat-open', isOpen);
  if (isOpen) {
    chatPanel.style.removeProperty('visibility');
    chatPanel.style.removeProperty('opacity');
    requestAnimationFrame(syncChatViewport);
    setTimeout(syncChatViewport, 350);
  } else {
    resetChatViewport();
    chatPanel.style.removeProperty('height');
    chatPanel.style.removeProperty('top');
    chatPanel.style.removeProperty('left');
    chatPanel.style.removeProperty('right');
    chatPanel.style.removeProperty('width');
  }
}

/**
 * Initialize chat module
 */
export function initChat() {
  // Ensure store exists (and migrate legacy history once)
  saveChatStore(loadChatStore());
  renderThreadOptions();
  const hasHistory = restoreMessages();
  setChatMode(getChatMode());
  if (!hasHistory) {
    storeMessages([{ text: WELCOME_TEXT, isUser: false, ts: Date.now() }]);
    restoreMessages();
  }

  chatToggle.addEventListener('click', openChat);
  chatClose.addEventListener('click', closeChat);
  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatUploadBtn.addEventListener('click', () => {
    chatFileInput.click();
  });

  chatFileInput.addEventListener('change', handleFileUpload);

  if (chatThreadSelect) {
    chatThreadSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === '__delete__') {
        if (confirm('Are you sure you want to delete this chat thread?')) {
          deleteActiveConversation();
        } else {
          // Re-render to reset the select back to the active thread
          renderThreadOptions();
        }
      } else {
        setActiveConversation(val);
        restoreMessages();
      }
    });
  }

  if (chatNewThreadBtn) {
    chatNewThreadBtn.addEventListener('click', createNewThread);
  }

  if (chatModeSelect) {
    chatModeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      setChatMode(mode);
      addMessage(mode === 'agent' ? 'Agent mode enabled. I can use portal tools.' : 'Ask mode enabled. I will answer directly.');
    });
  }

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatPanel.classList.contains('open')) closeChat();
  });

  initMobileChatViewport();

  // Tap outside to close (mobile fullscreen chat only)
  document.addEventListener('pointerdown', (e) => {
    if (!mobileChatMq.matches || !chatPanel.classList.contains('open')) return;
    const target = e.target;
    if (chatPanel.contains(target) || chatToggle.contains(target)) return;
    closeChat();
  });

  // Listen for download button clicks (delegated)
  chatMessages.addEventListener('click', handleChatActionClick);
}

/**
 * Open chat panel
 */
export function openChat() {
  setChatOpen(true);
  setTimeout(() => {
    syncChatViewport();
    chatInput.focus();
  }, 0);
}

/**
 * Close chat panel
 */
export function closeChat() {
  setChatOpen(false);
}

/**
 * Add message to chat UI
 */
function addMessage(text, isUser = false, opts = {}) {
  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${isUser ? 'user' : 'system'}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  if (opts.html) {
    bubble.innerHTML = opts.html;
  } else {
    bubble.innerHTML = `<p>${renderMarkdownSafe(text)}</p>`;
  }

  messageEl.appendChild(bubble);
  chatMessages.appendChild(messageEl);
  
  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (opts.persist !== false) {
    persistMessage(text, isUser, { html: opts.html || null });
  }
}

/**
 * Add a rich HTML message (not persisted as HTML to storage, only text)
 */
function addRichMessage(text, html) {
  addMessage(text, false, { html });
}

/**
 * Handle file upload
 */
async function handleFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  currentFile = file;
  addMessage(`📁 Analyzing ${file.name}...`);

  try {
    parseResult = await api.agentParse(file);
    const { headers, samples, suggestions } = parseResult;

    // Display results
    let message = `✅ Found **${headers.length}** columns:\n\n`;
    message += '**Column Mapping Suggestions:**\n';
    
    for (const header of headers) {
      const suggestion = suggestions[header];
      if (suggestion) {
        message += `• "${header}" → **${suggestion}** ✓\n`;
      } else {
        message += `• "${header}" → (unmapped, stored in extra)\n`;
      }
    }

    message += `\n**Samples:** ${samples.length} rows loaded\n\n`;
    message += '✨ Ready to import? Say "import" or adjust the mapping!';

    addMessage(message);
    mappingInProgress = true;

  } catch (error) {
    addMessage(`❌ Error: ${error.message}`);
  }

  // Reset file input
  chatFileInput.value = '';
}

/**
 * Send message / process command
 */
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  if (chatSendBtn) chatSendBtn.disabled = true;

  addMessage(text, true);

  try {
    if (text.toLowerCase() === 'import' && parseResult) {
      await importParsedFile();
    } else {
      await sendChatMessage();
    }
  } finally {
    if (chatSendBtn) chatSendBtn.disabled = false;
  }
}

/**
 * Import parsed file to database
 */
async function importParsedFile() {
  if (!currentFile || !parseResult) {
    addMessage('❌ No file loaded. Please upload a CSV or XLSX file first.');
    return;
  }

  addMessage('⏳ Importing rows...');

  try {
    const result = await api.agentImport(currentFile, parseResult.suggestions);
    const { created, skipped } = result;

    addMessage(
      `✅ **Import Complete**\n\n` +
      `• Created: **${created}** staff records\n` +
      `• Skipped: **${skipped}** rows (missing required fields)\n\n` +
      `Check the Staff Records page to view newly imported entries!`
    );

    currentFile = null;
    parseResult = null;
    mappingInProgress = false;

  } catch (error) {
    addMessage(`❌ Error: ${error.message}`);
  }
}

/**
 * Send message to chat API
 */
async function sendChatMessage() {
  // Show typing indicator
  const typingId = showTypingIndicator();

  try {
    const mode = chatModeSelect?.value || getChatMode();
    const messages = getConversationMessages();
    const allow_write = mode === 'agent';

    const data = await api.agentChat({
      mode,
      messages,
      allow_write,
    });

    removeTypingIndicator(typingId);
    const reply = data.reply || 'No response from assistant.';
    const actions = data.actions || [];

    // Show the text reply
    addMessage(reply);

    // Process agent actions for client-side execution
    if (mode === 'agent' && actions.length > 0) {
      await processAgentActions(actions);
    }

  } catch (error) {
    removeTypingIndicator(typingId);
    addMessage(`⚠️ Assistant unavailable: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════
// Agent Action Processing
// ═══════════════════════════════════════════════════════

/**
 * Process agent tool call results and trigger client-side actions
 */
async function processAgentActions(actions) {
  for (const action of actions) {
    const { tool, args, result } = action;

    switch (tool) {
      case 'bulk_id_cards':
        await handleBulkIdCards(result, args);
        break;

      case 'export_staff':
        handleExportStaff(result, args);
        break;

      case 'navigate_page':
        handleNavigatePage(result, args);
        break;

      case 'create_staff':
        if (result?.status === 'created') {
          showActionSummary('✅ Created', `Staff record #${result.id} — ${result.full_name}`, 'success');
        }
        break;

      case 'update_staff':
        if (result?.status === 'updated') {
          showActionSummary('✏️ Updated', `Staff record #${result.id} — ${result.full_name}`, 'info');
        }
        break;

      case 'delete_staff':
        if (result?.status === 'deleted') {
          showActionSummary('🗑 Deleted', `Staff record #${result.id} removed`, 'warning');
        }
        break;

      case 'create_field_def':
        if (result?.status === 'created') {
          showActionSummary('✅ Field Created', `"${result.label}" (${result.data_type})`, 'success');
        }
        break;

      case 'update_field_def':
        if (result?.status === 'updated') {
          showActionSummary('✏️ Field Updated', `"${result.label}"`, 'info');
        }
        break;

      case 'delete_field_def':
        if (result?.status === 'deleted') {
          showActionSummary('🗑 Field Deleted', `Field #${result.id} removed`, 'warning');
        }
        break;

      default:
        // Other tool calls are handled by the text reply
        break;
    }
  }
}

/**
 * Handle bulk ID card generation client-side
 */
async function handleBulkIdCards(result, _args) {
  if (!result || !result.items || result.items.length === 0) {
    addMessage('⚠️ No staff records found to generate ID cards for.');
    return;
  }

  const count = result.items.length;
  const fieldDefs = result.field_defs || [];

  // Show progress message
  const progressEl = addProgressMessage(
    `🪪 Generating ${count} ID card${count !== 1 ? 's' : ''}...`,
    count
  );

  try {
    // Use the existing generateIdCardsZip from id_cards.js
    const { blob, count: created, skipped } = await generateIdCardsZip(
      result.items,
      fieldDefs,
      {
        scale: 3,
        onProgress: (done) => {
          updateProgress(progressEl, done, count);
        },
      }
    );

    // Remove progress
    if (progressEl) progressEl.remove();

    if (!blob) {
      addMessage('❌ Failed to generate ID cards. No cards could be rendered.');
      return;
    }

    // Create downloadable URL
    const url = URL.createObjectURL(blob);
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);

    // Store for later download
    const downloadId = `dl_${Date.now()}`;
    window.__chatDownloads = window.__chatDownloads || {};
    window.__chatDownloads[downloadId] = { url, filename: `ID_Cards_${new Date().toISOString().slice(0, 10)}.zip` };

    // Show download popup with rich HTML
    const html = `
      <div class="chat-action-card chat-action-success">
        <div class="chat-action-icon">🪪</div>
        <div class="chat-action-body">
          <div class="chat-action-title">ID Cards Ready!</div>
          <div class="chat-action-detail">
            Generated <strong>${created}</strong> ID card${created !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''} • ${sizeMB} MB
          </div>
          <button class="chat-download-btn" data-download-id="${downloadId}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download ZIP
          </button>
        </div>
      </div>
    `;

    addRichMessage(
      `✅ ID Cards Ready! Generated ${created} card${created !== 1 ? 's' : ''}. Click the download button below.`,
      html
    );
  } catch (err) {
    if (progressEl) progressEl.remove();
    console.error('Bulk ID card generation failed:', err);
    addMessage(`❌ ID card generation failed: ${err.message}`);
  }
}

/**
 * Handle staff export action
 */
function handleExportStaff(result, args) {
  const format = args?.format || result?.format || 'xlsx';
  const url = result?.download_url;

  if (url) {
    const html = `
      <div class="chat-action-card chat-action-success">
        <div class="chat-action-icon">📊</div>
        <div class="chat-action-body">
          <div class="chat-action-title">Export Ready!</div>
          <div class="chat-action-detail">
            Staff data exported as <strong>${format.toUpperCase()}</strong>
          </div>
          <a href="${escapeHtml(url)}" class="chat-download-btn" download>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download ${format.toUpperCase()}
          </a>
        </div>
      </div>
    `;
    addRichMessage(`📊 Export ready! Download your ${format.toUpperCase()} file.`, html);
  } else {
    api
      .exportStaff(format)
      .then(() => addMessage(`📊 Downloaded ${format.toUpperCase()} export.`))
      .catch((err) => addMessage(`❌ Export failed: ${err.message}`));
  }
}

/**
 * Handle page navigation
 */
function handleNavigatePage(result, args) {
  const page = args?.page || result?.page;
  if (page && typeof window._navigateTo === 'function') {
    const params = args?.params || {};
    window._navigateTo(page, params);
    addMessage(`📍 Navigated to ${page.replace(/-/g, ' ')}.`);
  }
}

// ═══════════════════════════════════════════════════════
// UI Helpers
// ═══════════════════════════════════════════════════════

/**
 * Show a compact action summary in the chat
 */
function showActionSummary(title, detail, type = 'info') {
  const colorMap = {
    success: '#10B981',
    info: '#6366F1',
    warning: '#F59E0B',
    error: '#EF4444',
  };
  const color = colorMap[type] || colorMap.info;

  const html = `
    <div class="chat-action-pill" style="border-left: 3px solid ${color};">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
  addRichMessage(`${title} — ${detail}`, html);
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
  const id = `typing_${Date.now()}`;
  const el = document.createElement('div');
  el.className = 'chat-message system';
  el.id = id;
  el.innerHTML = `
    <div class="message-bubble">
      <div class="chat-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * Show progress message
 */
function addProgressMessage(text, total) {
  const el = document.createElement('div');
  el.className = 'chat-message system';
  el.innerHTML = `
    <div class="message-bubble">
      <div class="chat-progress-wrapper">
        <p>${renderMarkdownSafe(text)}</p>
        <div class="chat-progress-bar">
          <div class="chat-progress-fill" style="width: 0%"></div>
        </div>
        <span class="chat-progress-label">0 / ${total}</span>
      </div>
    </div>
  `;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

/**
 * Update progress bar
 */
function updateProgress(el, done, total) {
  if (!el) return;
  const fill = el.querySelector('.chat-progress-fill');
  const label = el.querySelector('.chat-progress-label');
  if (fill) fill.style.width = `${Math.round((done / total) * 100)}%`;
  if (label) label.textContent = `${done} / ${total}`;
}

/**
 * Handle clicks on action buttons inside chat messages
 */
function handleChatActionClick(e) {
  // Download button
  const downloadBtn = e.target.closest('[data-download-id]');
  if (downloadBtn) {
    e.preventDefault();
    const dlId = downloadBtn.dataset.downloadId;
    const dl = window.__chatDownloads?.[dlId];
    if (dl) {
      const a = document.createElement('a');
      a.href = dl.url;
      a.download = dl.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    return;
  }

  // Navigate button
  const navBtn = e.target.closest('[data-navigate-page]');
  if (navBtn) {
    e.preventDefault();
    const page = navBtn.dataset.navigatePage;
    if (page && typeof window._navigateTo === 'function') {
      window._navigateTo(page);
    }
    return;
  }
}
