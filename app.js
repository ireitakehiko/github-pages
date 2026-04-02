'use strict';

const STORAGE_KEY = 'journal_entries';

const MOODS = {
  none: { emoji: '', label: 'なし' },
  great: { emoji: '😁', label: '最高' },
  good: { emoji: '😀', label: '良い' },
  neutral: { emoji: '😐', label: '普通' },
  bad: { emoji: '😟', label: '悪い' },
  awful: { emoji: '😡', label: '最悪' },
};

// ---- State ----
let entries = [];
let currentId = null;   // viewing
let editingId = null;   // null = new entry
let pendingDeleteId = null;
let selectedMood = 'none';

// ---- DOM refs ----
const entryList = document.getElementById('entryList');
const entryCount = document.getElementById('entryCount');
const searchInput = document.getElementById('searchInput');

const emptyState = document.getElementById('emptyState');
const editor = document.getElementById('editor');
const viewer = document.getElementById('viewer');

const entryTitle = document.getElementById('entryTitle');
const entryContent = document.getElementById('entryContent');
const dateDisplay = document.getElementById('dateDisplay');

const btnNew = document.getElementById('btnNew');
const btnNewMain = document.getElementById('btnNewMain');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');
const btnCancel = document.getElementById('btnCancel');
const btnEdit = document.getElementById('btnEdit');
const btnDeleteView = document.getElementById('btnDeleteView');

const viewerTitle = document.getElementById('viewerTitle');
const viewerDate = document.getElementById('viewerDate');
const viewerMood = document.getElementById('viewerMood');
const viewerContent = document.getElementById('viewerContent');

const modalOverlay = document.getElementById('modalOverlay');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');

const moodBtns = document.querySelectorAll('.mood-btn');

// ---- Storage ----
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- Formatting ----
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatDateShort(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });
}

function now() {
  return new Date().toISOString();
}

// ---- Render sidebar ----
function getFilteredEntries() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(e =>
    (e.title && e.title.toLowerCase().includes(q)) ||
    (e.content && e.content.toLowerCase().includes(q))
  );
}

function renderList() {
  const filtered = getFilteredEntries();
  entryList.innerHTML = '';

  filtered.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'entry-item' + (entry.id === currentId ? ' active' : '');
    li.dataset.id = entry.id;

    const moodEmoji = MOODS[entry.mood]?.emoji || '';
    const title = entry.title || '無題';
    const preview = entry.content
      ? entry.content.replace(/\s+/g, ' ').slice(0, 60)
      : '';

    li.innerHTML = `
      <div class="entry-item-title">
        ${moodEmoji ? `<span class="entry-item-mood">${moodEmoji}</span>` : ''}
        ${escapeHtml(title)}
      </div>
      ${preview ? `<div class="entry-item-preview">${escapeHtml(preview)}</div>` : ''}
      <div class="entry-item-date">${formatDateShort(entry.createdAt)}</div>
    `;

    li.addEventListener('click', () => openViewer(entry.id));
    entryList.appendChild(li);
  });

  const total = entries.length;
  entryCount.textContent = `${total} 件の日記`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Views ----
function showEmpty() {
  emptyState.classList.remove('hidden');
  editor.classList.add('hidden');
  viewer.classList.add('hidden');
  currentId = null;
  renderList();
}

function openEditor(id = null) {
  editingId = id;
  currentId = id;

  editor.classList.remove('hidden');
  emptyState.classList.add('hidden');
  viewer.classList.add('hidden');

  if (id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    entryTitle.value = entry.title || '';
    entryContent.value = entry.content || '';
    setMood(entry.mood || 'none');
    dateDisplay.textContent = formatDate(entry.createdAt);
    btnDelete.classList.remove('hidden');
  } else {
    entryTitle.value = '';
    entryContent.value = '';
    setMood('none');
    dateDisplay.textContent = formatDate(now());
    btnDelete.classList.add('hidden');
  }

  renderList();
  entryContent.focus();
}

function openViewer(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  currentId = id;
  editingId = null;

  viewer.classList.remove('hidden');
  emptyState.classList.add('hidden');
  editor.classList.add('hidden');

  viewerTitle.textContent = entry.title || '無題';
  viewerDate.textContent = formatDate(entry.createdAt);
  const mood = MOODS[entry.mood];
  viewerMood.textContent = mood?.emoji ? `${mood.emoji} ${mood.label}` : '';
  viewerContent.textContent = entry.content || '';

  renderList();
}

// ---- Mood ----
function setMood(mood) {
  selectedMood = mood;
  moodBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mood === mood);
  });
}

// ---- CRUD ----
function saveEntry() {
  const title = entryTitle.value.trim();
  const content = entryContent.value.trim();

  if (!title && !content) {
    entryContent.focus();
    entryContent.placeholder = '内容を入力してください...';
    return;
  }

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx !== -1) {
      entries[idx] = {
        ...entries[idx],
        title,
        content,
        mood: selectedMood,
        updatedAt: now(),
      };
    }
    const savedId = editingId;
    saveEntries();
    openViewer(savedId);
  } else {
    const entry = {
      id: generateId(),
      title,
      content,
      mood: selectedMood,
      createdAt: now(),
      updatedAt: now(),
    };
    entries.unshift(entry);
    saveEntries();
    openViewer(entry.id);
  }
}

function confirmDelete(id) {
  pendingDeleteId = id;
  modalOverlay.classList.remove('hidden');
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  saveEntries();
  currentId = null;

  if (entries.length > 0) {
    openViewer(entries[0].id);
  } else {
    showEmpty();
  }
}

// ---- Event listeners ----
btnNew.addEventListener('click', () => openEditor(null));
btnNewMain.addEventListener('click', () => openEditor(null));

btnSave.addEventListener('click', saveEntry);

btnCancel.addEventListener('click', () => {
  if (currentId && entries.find(e => e.id === currentId)) {
    openViewer(currentId);
  } else if (entries.length > 0) {
    openViewer(entries[0].id);
  } else {
    showEmpty();
  }
});

btnDelete.addEventListener('click', () => confirmDelete(editingId));
btnDeleteView.addEventListener('click', () => confirmDelete(currentId));
btnEdit.addEventListener('click', () => openEditor(currentId));

// Keyboard shortcut: Ctrl+S / Cmd+S to save
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    if (!editor.classList.contains('hidden')) {
      e.preventDefault();
      saveEntry();
    }
  }
  if (e.key === 'Escape') {
    if (!modalOverlay.classList.contains('hidden')) {
      modalOverlay.classList.add('hidden');
      pendingDeleteId = null;
    }
  }
});

moodBtns.forEach(btn => {
  btn.addEventListener('click', () => setMood(btn.dataset.mood));
});

searchInput.addEventListener('input', renderList);

modalCancel.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  pendingDeleteId = null;
});

modalConfirm.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  if (pendingDeleteId) {
    deleteEntry(pendingDeleteId);
    pendingDeleteId = null;
  }
});

// ---- Init ----
entries = loadEntries();
if (entries.length > 0) {
  openViewer(entries[0].id);
} else {
  showEmpty();
}
