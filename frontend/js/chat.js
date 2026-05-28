/**
 * Chat Assistant Module
 * Handles the import assistant chat panel with file upload and API communication
 */

import * as api from './api.js';

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
const WELCOME_TEXT = "👋 Hi! I'm your import assistant. Upload a CSV or XLSX file to get started.";

// Chat state
let currentFile = null;
let parseResult = null;
let mappingInProgress = false;
let pendingAllowWrite = false;

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

function persistMessage(text, isUser) {
  const store = loadChatStore();
  const convo = getActiveConversation(store);
  const items = Array.isArray(convo.messages) ? convo.messages : [];
  items.push({
    text: text ?? '',
    isUser: !!isUser,
    ts: Date.now(),
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
    addMessage(m.text, !!m.isUser, { persist: false });
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

function setChatOpen(isOpen) {
  chatPanel.classList.toggle('open', isOpen);
  document.body.classList.toggle('chat-open', isOpen);
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

  // Tap outside to close (mobile)
  document.addEventListener('pointerdown', (e) => {
    if (!chatPanel.classList.contains('open')) return;
    const target = e.target;
    if (chatPanel.contains(target) || chatToggle.contains(target)) return;
    closeChat();
  });
}

/**
 * Open chat panel
 */
export function openChat() {
  setChatOpen(true);
  setTimeout(() => chatInput.focus(), 0);
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
  
  bubble.innerHTML = `<p>${renderMarkdownSafe(text)}</p>`;
  messageEl.appendChild(bubble);
  chatMessages.appendChild(messageEl);
  
  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (opts.persist !== false) {
    persistMessage(text, isUser);
  }
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
    const formData = new FormData();
    formData.append('file', file);

    // Call parse endpoint
    const response = await fetch('/api/hr/agent/parse', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to parse file: ${response.statusText}`);
    }

    parseResult = await response.json();
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

  // One-time write confirmation command
  if (text.toLowerCase() === 'allow_write=true') {
    pendingAllowWrite = true;
    addMessage(text, true, { persist: false });
    addMessage('Write confirmation enabled for the next agent action.', false);
    return;
  }

  addMessage(text, true);

  // Handle specific commands
  if (text.toLowerCase() === 'import' && parseResult) {
    await importParsedFile();
  } else {
    // Send to chat API for general questions
    await sendChatMessage();
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
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('mapping', JSON.stringify(parseResult.suggestions));

    const response = await fetch('/api/hr/agent/import', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Import failed: ${response.statusText}`);
    }

    const result = await response.json();
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
  try {
    const mode = chatModeSelect?.value || getChatMode();
    const messages = getConversationMessages();
    const allow_write = pendingAllowWrite;
    pendingAllowWrite = false;

    const response = await fetch('/api/hr/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        messages,
        allow_write,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat error: ${response.statusText}`);
    }

    const data = await response.json();
    const reply = data.reply || 'No response from assistant.';
    addMessage(reply);

  } catch (error) {
    addMessage(`⚠️ Assistant unavailable: ${error.message}`);
  }
}
