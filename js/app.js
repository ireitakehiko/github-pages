'use strict';

// ===== State =====
const State = {
  videos: [],
  categories: [],
  assignments: [],
  currentFilter: 'all',
  searchQuery: '',
  pageSize: 30,
  displayCount: 30,
  editingCategoryId: null,
  assigningVideoId: null,
  selectedColor: '#FF6B6B',
};

// ===== DOM helpers =====
const $ = (id) => document.getElementById(id);
const show = (el) => { if (typeof el === 'string') el = $(el); el.style.display = ''; };
const hide = (el) => { if (typeof el === 'string') el = $(el); el.style.display = 'none'; };

// ===== Toast =====
let toastTimer = null;
function showToast(msg, duration = 2500) {
  const el = $('toast');
  el.textContent = msg;
  show(el);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide(el), duration);
}

// ===== Screen navigation =====
function showScreen(id) {
  ['screen-login', 'screen-main', 'screen-categories', 'screen-settings'].forEach(s => {
    const el = $(s);
    if (s === id) { el.style.display = 'flex'; }
    else { el.style.display = 'none'; }
  });
}

// ===== Local Storage helpers =====
const LS = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  remove: (k) => localStorage.removeItem(k),
};

// ===== Init =====
async function init() {
  await DB.open();

  const clientId = LS.get('clientId');
  if (!clientId) {
    showSetupSection();
    showScreen('screen-login');
    return;
  }

  showLoginSection(clientId);
  showScreen('screen-login');

  try {
    await YouTube.initClient(clientId);
  } catch (e) {
    console.error('Failed to init YouTube client', e);
    showToast('APIの初期化に失敗しました');
  }

  const savedToken = LS.get('accessToken');
  const savedUser = LS.get('user');
  if (savedToken && savedUser) {
    YouTube.setToken(savedToken);
    YouTube.setUser(savedUser);
    await enterApp();
  }
}

function showSetupSection() {
  show('setup-section');
  hide('login-section');
}

function showLoginSection(clientId) {
  hide('setup-section');
  show('login-section');
  $('client-id-display').textContent = clientId;
  $('settings-client-id').textContent = clientId;
}

// ===== Load data from DB =====
async function loadData() {
  const [videos, categories, assignments] = await Promise.all([
    DB.Videos.getAll(),
    DB.Categories.getAll(),
    DB.Assignments.getAll(),
  ]);
  State.videos = videos.sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
  State.categories = categories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  State.assignments = assignments;
}

// ===== Enter main app =====
async function enterApp() {
  await loadData();
  const user = YouTube.getUser();
  if (user) updateUserInfo(user);

  showScreen('screen-main');
  renderCategoryChips();
  renderDrawerCategories();

  if (State.videos.length === 0) {
    await syncVideos();
  } else {
    renderVideoList();
    updateVideoCount();
  }
}

function updateUserInfo(user) {
  if (!user) return;
  $('user-name').textContent = user.name || '-';
  $('user-email').textContent = user.email || '-';
  $('drawer-user-name').textContent = user.name || '-';
  $('drawer-user-email').textContent = user.email || '-';
  if (user.picture) {
    const avatar = $('user-avatar');
    avatar.src = user.picture;
    show(avatar);
  }
}

// ===== Sync videos from YouTube =====
async function syncVideos() {
  const syncBtn = $('sync-btn');
  syncBtn.classList.add('syncing');
  show('loading-spinner');
  hide('video-list');
  hide('empty-state');
  hide('load-more-btn');

  $('loading-spinner').querySelector('p').textContent = '高評価動画を取得中...';

  try {
    const videos = await YouTube.fetchLikedVideos((count) => {
      $('loading-spinner').querySelector('p').textContent = `${count}件取得中...`;
    });

    await DB.Videos.putBulk(videos);
    State.videos = videos;
    State.displayCount = State.pageSize;
    renderVideoList();
    updateVideoCount();
    showToast(`${videos.length}件の高評価動画を取得しました`);
  } catch (e) {
    console.error('Sync failed:', e);
    showToast('取得に失敗しました。再度お試しください');
    if (State.videos.length > 0) renderVideoList();
    else { show('empty-state'); $('empty-state-text').textContent = '動画を取得できませんでした'; }
  } finally {
    hide('loading-spinner');
    show('video-list');
    syncBtn.classList.remove('syncing');
  }
}

// ===== Filter & search videos =====
function getFilteredVideos() {
  let videos = State.videos;

  if (State.currentFilter === 'uncategorized') {
    const assignedIds = new Set(State.assignments.map(a => a.videoId));
    videos = videos.filter(v => !assignedIds.has(v.videoId));
  } else if (State.currentFilter !== 'all') {
    const catAssignments = State.assignments.filter(a => a.categoryId === State.currentFilter);
    const assignedIds = new Set(catAssignments.map(a => a.videoId));
    videos = videos.filter(v => assignedIds.has(v.videoId));
  }

  if (State.searchQuery) {
    const q = State.searchQuery.toLowerCase();
    videos = videos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.channelTitle.toLowerCase().includes(q)
    );
  }

  return videos;
}

// ===== Render video list =====
function renderVideoList() {
  const filtered = getFilteredVideos();
  const toShow = filtered.slice(0, State.displayCount);

  const container = $('video-list');
  container.innerHTML = '';

  if (filtered.length === 0) {
    hide('video-list');
    show('empty-state');
    hide('load-more-btn');
    $('empty-state-text').textContent = State.searchQuery ? '検索結果がありません' : '動画がありません';
    return;
  }

  show('video-list');
  hide('empty-state');

  const assignmentMap = buildAssignmentMap();
  toShow.forEach(video => {
    const el = createVideoCard(video, assignmentMap);
    container.appendChild(el);
  });

  if (filtered.length > State.displayCount) {
    show('load-more-btn');
    $('load-more-btn').textContent = `さらに読み込む (${filtered.length - State.displayCount}件)`;
  } else {
    hide('load-more-btn');
  }
}

function buildAssignmentMap() {
  const map = {};
  State.assignments.forEach(a => {
    if (!map[a.videoId]) map[a.videoId] = [];
    map[a.videoId].push(a.categoryId);
  });
  return map;
}

function getCategoryById(id) {
  return State.categories.find(c => c.id === id);
}

function createVideoCard(video, assignmentMap) {
  const videoCategories = (assignmentMap[video.videoId] || [])
    .map(id => getCategoryById(id))
    .filter(Boolean);

  const div = document.createElement('div');
  div.className = 'video-card';
  div.dataset.videoId = video.videoId;

  const tagsHtml = videoCategories.map(cat =>
    `<span class="video-category-tag" style="background:${cat.color}">${escHtml(cat.name)}</span>`
  ).join('');

  div.innerHTML = `
    <div class="video-thumbnail-wrap">
      <img class="video-thumbnail" src="${escHtml(video.thumbnail)}" alt="" loading="lazy">
      ${video.duration ? `<span class="video-duration">${escHtml(video.duration)}</span>` : ''}
    </div>
    <div class="video-info">
      <div class="video-title">${escHtml(video.title)}</div>
      ${tagsHtml ? `<div class="video-categories">${tagsHtml}</div>` : ''}
      <div class="video-meta">
        <span class="video-channel">${escHtml(video.channelTitle)}</span>
      </div>
    </div>
    <div class="video-actions">
      <button class="video-action-btn assign-btn ${videoCategories.length > 0 ? 'categorized' : ''}" data-video-id="${video.videoId}" aria-label="カテゴリに追加">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="${videoCategories.length > 0
            ? 'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z'
            : 'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z'}"/>
        </svg>
      </button>
    </div>
  `;

  div.querySelector('.assign-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openAssignModal(video.videoId);
  });

  div.addEventListener('click', () => {
    window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank', 'noopener');
  });

  return div;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== Category chips =====
function renderCategoryChips() {
  const container = $('category-chips');
  const existing = Array.from(container.querySelectorAll('.chip[data-category-id]'));
  existing.slice(2).forEach(el => el.remove());

  State.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (State.currentFilter === cat.id ? ' chip-active' : '');
    btn.dataset.categoryId = cat.id;
    btn.textContent = cat.name;
    btn.style.borderColor = cat.color;
    if (State.currentFilter === cat.id) btn.style.background = cat.color;
    btn.addEventListener('click', () => setFilter(cat.id));
    container.appendChild(btn);
  });

  container.querySelectorAll('.chip').forEach(chip => {
    const id = chip.dataset.categoryId;
    const isActive = State.currentFilter === id;
    chip.classList.toggle('chip-active', isActive);
    if (id && id !== 'all' && id !== 'uncategorized') {
      const cat = getCategoryById(id);
      if (cat) {
        chip.style.borderColor = cat.color;
        chip.style.background = isActive ? cat.color : '';
        chip.style.color = isActive ? 'white' : '';
      }
    }
  });
}

function setFilter(filterId) {
  State.currentFilter = filterId;
  State.displayCount = State.pageSize;
  renderCategoryChips();
  renderVideoList();

  const cat = filterId === 'all' ? null : filterId === 'uncategorized' ? null : getCategoryById(filterId);
  $('header-title').textContent = filterId === 'all' ? 'すべての高評価' :
    filterId === 'uncategorized' ? '未分類' : cat?.name || '';
}

// ===== Drawer categories =====
function renderDrawerCategories() {
  const container = $('drawer-categories');
  container.innerHTML = '';

  const assignmentMap = buildAssignmentMap();

  [
    { id: 'all', name: 'すべての高評価', color: '#FF0000' },
    { id: 'uncategorized', name: '未分類', color: '#888' },
  ].concat(State.categories).forEach(cat => {
    const count = cat.id === 'all' ? State.videos.length :
      cat.id === 'uncategorized' ? State.videos.filter(v => !assignmentMap[v.videoId]).length :
      (State.assignments.filter(a => a.categoryId === cat.id).length);

    const div = document.createElement('div');
    div.className = 'drawer-category-item';
    div.innerHTML = `
      <div class="category-color-dot" style="background:${cat.color}"></div>
      <span class="drawer-category-name">${escHtml(cat.name)}</span>
      <span class="drawer-category-count">${count}</span>
    `;
    div.addEventListener('click', () => {
      closeDrawer();
      showScreen('screen-main');
      setFilter(cat.id);
    });
    container.appendChild(div);
  });
}

// ===== Categories screen =====
function renderCategoriesScreen() {
  const container = $('categories-list');
  container.innerHTML = '';

  if (State.categories.length === 0) {
    show('categories-empty');
    return;
  }
  hide('categories-empty');

  State.categories.forEach(cat => {
    const count = State.assignments.filter(a => a.categoryId === cat.id).length;
    const div = document.createElement('div');
    div.className = 'category-item';
    div.innerHTML = `
      <div class="category-color-dot" style="background:${cat.color}"></div>
      <div class="category-item-info">
        <div class="category-item-name">${escHtml(cat.name)}</div>
        <div class="category-item-count">${count}件の動画</div>
      </div>
      <div class="category-item-actions">
        <button class="category-action-btn edit-cat-btn" data-id="${cat.id}" aria-label="編集">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button class="category-action-btn delete-cat-btn delete" data-id="${cat.id}" aria-label="削除">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    div.querySelector('.edit-cat-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryModal(cat.id);
    });
    div.querySelector('.delete-cat-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(cat.id);
    });
    container.appendChild(div);
  });
}

// ===== Category modal =====
function openCategoryModal(editId = null) {
  State.editingCategoryId = editId;
  const modal = $('modal-category');
  const input = $('category-name-input');

  if (editId) {
    const cat = getCategoryById(editId);
    $('modal-category-title').textContent = 'カテゴリを編集';
    input.value = cat.name;
    State.selectedColor = cat.color;
  } else {
    $('modal-category-title').textContent = 'カテゴリを追加';
    input.value = '';
    State.selectedColor = '#FF6B6B';
  }

  document.querySelectorAll('.color-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === State.selectedColor);
  });

  show(modal);
  setTimeout(() => input.focus(), 100);
}

function closeCategoryModal() {
  hide('modal-category');
  State.editingCategoryId = null;
}

async function saveCategory() {
  const name = $('category-name-input').value.trim();
  if (!name) { showToast('カテゴリ名を入力してください'); return; }

  const cat = {
    id: State.editingCategoryId || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    color: State.selectedColor,
    createdAt: State.editingCategoryId
      ? (getCategoryById(State.editingCategoryId)?.createdAt || new Date().toISOString())
      : new Date().toISOString(),
  };

  await DB.Categories.put(cat);

  if (State.editingCategoryId) {
    const idx = State.categories.findIndex(c => c.id === State.editingCategoryId);
    if (idx >= 0) State.categories[idx] = cat;
    else State.categories.push(cat);
  } else {
    State.categories.push(cat);
  }

  closeCategoryModal();
  renderCategoriesScreen();
  renderCategoryChips();
  renderDrawerCategories();
  showToast(State.editingCategoryId ? 'カテゴリを更新しました' : 'カテゴリを作成しました');
}

async function deleteCategory(id) {
  if (!confirm('このカテゴリを削除しますか？\n動画の割り当ても解除されます。')) return;

  await DB.Categories.delete(id);
  await DB.Assignments.deleteByCategory(id);

  State.categories = State.categories.filter(c => c.id !== id);
  State.assignments = State.assignments.filter(a => a.categoryId !== id);

  if (State.currentFilter === id) setFilter('all');

  renderCategoriesScreen();
  renderCategoryChips();
  renderDrawerCategories();
  renderVideoList();
  showToast('カテゴリを削除しました');
}

// ===== Assign modal =====
function openAssignModal(videoId) {
  State.assigningVideoId = videoId;
  const video = State.videos.find(v => v.videoId === videoId);
  if (!video) return;

  const infoEl = $('assign-video-info');
  infoEl.innerHTML = `
    <img class="assign-video-thumb" src="${escHtml(video.thumbnail)}" alt="" loading="lazy">
    <div class="assign-video-title">${escHtml(video.title)}</div>
  `;

  const listEl = $('assign-categories-list');
  listEl.innerHTML = '';

  if (State.categories.length === 0) {
    listEl.innerHTML = '<p style="color:#999;font-size:13px;padding:8px 0">カテゴリがありません。先にカテゴリを作成してください。</p>';
    show('modal-assign');
    return;
  }

  const currentAssignments = State.assignments.filter(a => a.videoId === videoId);
  const assignedCatIds = new Set(currentAssignments.map(a => a.categoryId));

  State.categories.forEach(cat => {
    const isAssigned = assignedCatIds.has(cat.id);
    const div = document.createElement('div');
    div.className = `assign-category-item${isAssigned ? ' assigned' : ''}`;
    div.dataset.categoryId = cat.id;
    div.innerHTML = `
      <div class="category-color-dot" style="background:${cat.color}"></div>
      <div class="assign-category-check">
        ${isAssigned ? '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="white" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>' : ''}
      </div>
      <span class="assign-category-name">${escHtml(cat.name)}</span>
    `;
    div.addEventListener('click', () => toggleAssignment(videoId, cat.id, div));
    listEl.appendChild(div);
  });

  show('modal-assign');
}

async function toggleAssignment(videoId, categoryId, itemEl) {
  const isAssigned = itemEl.classList.contains('assigned');

  if (isAssigned) {
    const existing = State.assignments.find(a => a.videoId === videoId && a.categoryId === categoryId);
    if (existing) {
      await DB.Assignments.delete(existing.id);
      State.assignments = State.assignments.filter(a => a.id !== existing.id);
    }
    itemEl.classList.remove('assigned');
    itemEl.querySelector('.assign-category-check').innerHTML = '';
  } else {
    const assignment = {
      id: `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      videoId,
      categoryId,
      createdAt: new Date().toISOString(),
    };
    await DB.Assignments.put(assignment);
    State.assignments.push(assignment);
    itemEl.classList.add('assigned');
    itemEl.querySelector('.assign-category-check').innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="white" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
  }

  renderVideoList();
  renderDrawerCategories();
  renderCategoriesScreen();
}

function closeAssignModal() {
  hide('modal-assign');
  State.assigningVideoId = null;
}

// ===== Drawer =====
function openDrawer() {
  renderDrawerCategories();
  show('drawer-overlay');
  show('drawer');
}

function closeDrawer() {
  hide('drawer-overlay');
  hide('drawer');
}

// ===== Export / Import =====
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: State.categories,
    assignments: State.assignments,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yt-likes-categories-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('エクスポートしました');
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.categories || !data.assignments) throw new Error('Invalid format');

    if (!confirm(`${data.categories.length}件のカテゴリと${data.assignments.length}件の割り当てをインポートしますか？\n既存のデータは上書きされます。`)) return;

    await Promise.all([
      DB.Categories.getAll().then(cats => Promise.all(cats.map(c => DB.Categories.delete(c.id)))),
      DB.Assignments.getAll().then(asgnms => Promise.all(asgnms.map(a => DB.Assignments.delete(a.id)))),
    ]);

    await Promise.all([
      ...data.categories.map(c => DB.Categories.put(c)),
      ...data.assignments.map(a => DB.Assignments.put(a)),
    ]);

    State.categories = data.categories;
    State.assignments = data.assignments;

    renderCategoryChips();
    renderVideoList();
    renderCategoriesScreen();
    renderDrawerCategories();
    showToast('インポートしました');
  } catch (e) {
    console.error(e);
    showToast('インポートに失敗しました');
  }
}

// ===== Video count =====
function updateVideoCount() {
  $('video-count').textContent = `${State.videos.length}件`;
}

// ===== Bottom nav =====
function handleNavClick(tab) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  if (tab === 'videos') {
    showScreen('screen-main');
  } else if (tab === 'categories') {
    renderCategoriesScreen();
    showScreen('screen-categories');
  } else if (tab === 'settings') {
    updateSettingsScreen();
    showScreen('screen-settings');
  }
}

function updateSettingsScreen() {
  const user = YouTube.getUser();
  if (user) {
    $('user-name').textContent = user.name || '-';
    $('user-email').textContent = user.email || '-';
    if (user.picture) {
      const avatar = $('user-avatar');
      avatar.src = user.picture;
      show(avatar);
    }
  }
  $('settings-client-id').textContent = LS.get('clientId') || '-';
  updateVideoCount();
}

// ===== Event listeners =====
function bindEvents() {
  // Login / Setup
  $('save-client-id-btn').addEventListener('click', async () => {
    const val = $('client-id-input').value.trim();
    if (!val) { showToast('クライアントIDを入力してください'); return; }
    LS.set('clientId', val);
    showLoginSection(val);
    try {
      await YouTube.initClient(val);
    } catch (e) {
      showToast('APIの初期化に失敗しました');
    }
  });

  $('change-client-id-btn').addEventListener('click', () => {
    LS.remove('clientId');
    $('client-id-input').value = LS.get('clientId') || '';
    showSetupSection();
  });

  $('google-signin-btn').addEventListener('click', async () => {
    try {
      const user = await YouTube.signIn();
      LS.set('user', user);
      await enterApp();
    } catch (e) {
      console.error('Sign in failed:', e);
      showToast('ログインに失敗しました');
    }
  });

  // Header buttons
  $('menu-btn').addEventListener('click', openDrawer);

  $('search-toggle-btn').addEventListener('click', () => {
    const bar = $('search-bar');
    if (bar.style.display === 'none' || !bar.style.display) {
      show(bar);
      $('search-input').focus();
    } else {
      hide(bar);
      $('search-input').value = '';
      State.searchQuery = '';
      renderVideoList();
    }
  });

  $('search-close-btn').addEventListener('click', () => {
    hide('search-bar');
    $('search-input').value = '';
    State.searchQuery = '';
    renderVideoList();
  });

  $('search-input').addEventListener('input', (e) => {
    State.searchQuery = e.target.value.trim();
    State.displayCount = State.pageSize;
    renderVideoList();
  });

  $('sync-btn').addEventListener('click', syncVideos);

  // Filter chips
  $('category-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setFilter(chip.dataset.categoryId);
  });

  // Load more
  $('load-more-btn').addEventListener('click', () => {
    State.displayCount += State.pageSize;
    renderVideoList();
  });

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => handleNavClick(btn.dataset.tab));
  });

  // Drawer overlay
  $('drawer-overlay').addEventListener('click', closeDrawer);

  // Categories screen
  $('categories-back-btn').addEventListener('click', () => {
    showScreen('screen-main');
  });

  $('add-category-fab').addEventListener('click', () => openCategoryModal());

  // Category modal
  $('modal-category-cancel').addEventListener('click', closeCategoryModal);
  $('modal-category-save').addEventListener('click', saveCategory);

  $('category-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCategory();
  });

  document.querySelectorAll('.color-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      State.selectedColor = btn.dataset.color;
      document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  $('modal-category').addEventListener('click', (e) => {
    if (e.target === $('modal-category')) closeCategoryModal();
  });

  // Assign modal
  $('modal-assign-cancel').addEventListener('click', closeAssignModal);
  $('modal-assign').addEventListener('click', (e) => {
    if (e.target === $('modal-assign')) closeAssignModal();
  });

  // Settings
  $('settings-back-btn').addEventListener('click', () => showScreen('screen-main'));

  $('signout-btn').addEventListener('click', () => {
    if (!confirm('ログアウトしますか？')) return;
    YouTube.signOut();
    LS.remove('accessToken');
    LS.remove('user');
    showScreen('screen-login');
    showLoginSection(LS.get('clientId') || '');
  });

  $('refresh-btn').addEventListener('click', () => {
    showScreen('screen-main');
    syncVideos();
  });

  $('export-btn').addEventListener('click', exportData);

  $('import-btn').addEventListener('click', () => $('import-file-input').click());

  $('import-file-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  $('change-api-btn').addEventListener('click', () => {
    YouTube.signOut();
    LS.remove('accessToken');
    LS.remove('user');
    LS.remove('clientId');
    $('client-id-input').value = '';
    showScreen('screen-login');
    showSetupSection();
  });
}

// ===== Service Worker =====
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  registerSW();
  init();
});
