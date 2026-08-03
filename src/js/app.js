/**
 * Quizz Buddy - Main Application Logic
 * State management, LocalStorage persistence, Player CRUD, Score tracking, Color customization.
 */

const STORAGE_KEY = 'quizz_buddy_state_v1';

const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#3b82f6'  // Blue
];

window.appState = {
  players: [],
  isSetupMode: false, // false = Play Mode (default), true = Setup Mode (movable)
  isMuted: false,
  selectedColor: COLOR_PALETTE[0],
  activeColorPickerId: null // Id of player whose color picker popover is currently open
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Initialize Modules
  window.wakeLockCtrl.init('wake-lock-status');
  window.soundFx.setMuted(window.appState.isMuted);

  window.dragEngine.init('board', (playerId, x, y) => {
    const player = window.appState.players.find(p => p.id === playerId);
    if (player) {
      player.x = x;
      player.y = y;
      saveState();
    }
  });

  // Attach UI Event Listeners
  setupEventListeners();
  
  // Render Initial View
  renderAll();
});

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      window.appState.players = data.players || [];
      window.appState.isSetupMode = data.isSetupMode || false;
      window.appState.isMuted = data.isMuted || false;
    } else {
      // Default demo players if empty
      window.appState.players = [
        { id: 'p1', name: 'Player 1', color: '#6366f1', score: 0, x: 80, y: 100 },
        { id: 'p2', name: 'Player 2', color: '#ec4899', score: 0, x: 280, y: 100 },
        { id: 'p3', name: 'Player 3', color: '#06b6d4', score: 0, x: 480, y: 100 }
      ];
    }
  } catch (err) {
    console.error('Failed to load local storage state:', err);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      players: window.appState.players,
      isSetupMode: window.appState.isSetupMode,
      isMuted: window.appState.isMuted
    }));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

function setupEventListeners() {
  // Mode Toggle Button (Play Mode vs Setup Mode)
  const modeBtn = document.getElementById('btn-mode-toggle');
  if (modeBtn) {
    modeBtn.addEventListener('click', toggleMode);
  }

  // Add Player Modal Triggers
  const addPlayerBtn = document.getElementById('btn-add-player');
  const modalAdd = document.getElementById('modal-add-player');
  const closeAddModal = document.getElementById('btn-close-add-modal');
  const cancelAddModal = document.getElementById('btn-cancel-add-modal');
  const formAddPlayer = document.getElementById('form-add-player');
  const addAndCloseBtn = document.getElementById('btn-add-and-close');

  if (addPlayerBtn) {
    addPlayerBtn.addEventListener('click', () => {
      openModal(modalAdd);
      const input = document.getElementById('input-player-name');
      if (input) input.focus();
    });
  }

  if (closeAddModal) closeAddModal.addEventListener('click', () => closeModal(modalAdd));
  if (cancelAddModal) cancelAddModal.addEventListener('click', () => closeModal(modalAdd));

  if (formAddPlayer) {
    formAddPlayer.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAddPlayerAction(false);
    });
  }

  if (addAndCloseBtn) {
    addAndCloseBtn.addEventListener('click', () => {
      handleAddPlayerAction(true);
    });
  }

  // Manage Players Modal Triggers
  const btnManage = document.getElementById('btn-manage-players');
  const modalManage = document.getElementById('modal-manage-players');
  const closeManageModal = document.getElementById('btn-close-manage-modal');
  const doneManageModal = document.getElementById('btn-done-manage-modal');
  const formQuickAdd = document.getElementById('form-manage-quick-add');
  const btnClearAll = document.getElementById('btn-clear-all-players');

  if (btnManage) {
    btnManage.addEventListener('click', () => {
      renderManagePlayersList();
      openModal(modalManage);
      const input = document.getElementById('input-manage-name');
      if (input) input.focus();
    });
  }

  if (closeManageModal) closeManageModal.addEventListener('click', () => closeModal(modalManage));
  if (doneManageModal) doneManageModal.addEventListener('click', () => closeModal(modalManage));

  if (formQuickAdd) {
    formQuickAdd.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('input-manage-name');
      const name = input.value.trim();
      if (name) {
        addNewPlayer(name, getRandomColor());
        input.value = '';
        renderManagePlayersList();
      }
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (confirm('Are you sure you want to remove ALL players from the board?')) {
        window.appState.players = [];
        renderBoardCards();
        renderManagePlayersList();
        saveState();
      }
    });
  }

  // Setup Color Picker Swatches
  renderColorSwatches();

  // Mute Toggle
  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      window.appState.isMuted = !window.appState.isMuted;
      window.soundFx.setMuted(window.appState.isMuted);
      updateMuteButtonUI();
      saveState();
    });
  }

  // Reset Scores Triggers
  const btnReset = document.getElementById('btn-reset');
  const modalReset = document.getElementById('modal-reset');
  const closeResetModal = document.getElementById('btn-close-reset-modal');
  const cancelResetModal = document.getElementById('btn-cancel-reset-modal');
  const confirmResetBtn = document.getElementById('btn-confirm-reset');

  if (btnReset) btnReset.addEventListener('click', () => openModal(modalReset));
  if (closeResetModal) closeResetModal.addEventListener('click', () => closeModal(modalReset));
  if (cancelResetModal) cancelResetModal.addEventListener('click', () => closeModal(modalReset));
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', () => {
      resetAllScores();
      closeModal(modalReset);
    });
  }

  // Close popovers or modals when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-icon-btn.color-btn') && 
        !e.target.closest('.color-picker-popover') && 
        !e.target.closest('.color-cycle-btn')) {
      closeAllColorPopovers();
    }
  });

  // Close modals on background overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });
}

function handleAddPlayerAction(shouldClose) {
  const input = document.getElementById('input-player-name');
  if (!input) return;

  const name = input.value.trim() || `Player ${window.appState.players.length + 1}`;
  addNewPlayer(name, window.appState.selectedColor);

  input.value = '';
  
  if (shouldClose) {
    closeModal(document.getElementById('modal-add-player'));
  } else {
    input.focus();
  }
}

function renderColorSwatches() {
  const container = document.getElementById('color-swatches');
  if (!container) return;

  container.innerHTML = '';
  COLOR_PALETTE.forEach((color, index) => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch ${index === 0 ? 'selected' : ''}`;
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      window.appState.selectedColor = color;
    });
    container.appendChild(swatch);
  });
}

function toggleColorPickerPopover(playerId, anchorElem) {
  closeAllColorPopovers();

  const popover = document.createElement('div');
  popover.className = 'color-picker-popover';
  popover.dataset.playerId = playerId;

  COLOR_PALETTE.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'popover-swatch';
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      setPlayerColor(playerId, color);
      popover.remove();
    });
    popover.appendChild(swatch);
  });

  anchorElem.appendChild(popover);
}

function closeAllColorPopovers() {
  document.querySelectorAll('.color-picker-popover').forEach(p => p.remove());
}

function setPlayerColor(playerId, newColor) {
  const player = window.appState.players.find(p => p.id === playerId);
  if (!player) return;

  player.color = newColor;
  window.soundFx.playChime(650, 'sine', 0.1, 0.05);

  renderBoardCards();
  renderManagePlayersList();
  saveState();
}

function toggleMode() {
  window.appState.isSetupMode = !window.appState.isSetupMode;
  window.soundFx.playLock(window.appState.isSetupMode);
  closeAllColorPopovers();
  updateModeBtnUI();
  renderBoardCards();
  saveState();
}

function updateModeBtnUI() {
  const modeBtn = document.getElementById('btn-mode-toggle');
  if (!modeBtn) return;

  if (window.appState.isSetupMode) {
    modeBtn.className = 'btn btn-mode setup-mode';
    modeBtn.innerHTML = '🛠️ Setup Mode';
    modeBtn.title = 'Setup Mode: Drag cards to arrange seating. Scoring disabled.';
  } else {
    modeBtn.className = 'btn btn-mode play-mode';
    modeBtn.innerHTML = '🎮 Play Mode';
    modeBtn.title = 'Play Mode: Cards locked in place. Tap cards to add points.';
  }
}

function updateMuteButtonUI() {
  const btnMute = document.getElementById('btn-mute');
  if (!btnMute) return;
  btnMute.innerHTML = window.appState.isMuted ? '🔇' : '🔊';
  btnMute.title = window.appState.isMuted ? 'Sound muted' : 'Sound enabled';
}

function renderAll() {
  updateModeBtnUI();
  updateMuteButtonUI();
  renderBoardCards();
}

function renderBoardCards() {
  const board = document.getElementById('board');
  const hint = document.getElementById('board-hint');
  if (!board) return;

  if (window.appState.players.length === 0) {
    if (hint) hint.style.display = 'block';
    board.querySelectorAll('.player-card').forEach(c => c.remove());
    return;
  }

  if (hint) hint.style.display = 'none';

  const existingCards = new Map();
  board.querySelectorAll('.player-card').forEach(card => {
    existingCards.set(card.dataset.playerId, card);
  });

  window.appState.players.forEach(player => {
    let card = existingCards.get(player.id);
    if (!card) {
      card = createPlayerCardDOM(player);
      board.appendChild(card);
    } else {
      updatePlayerCardDOM(card, player);
      existingCards.delete(player.id);
    }
  });

  existingCards.forEach(card => card.remove());
}

function createPlayerCardDOM(player) {
  const card = document.createElement('div');
  const isSetup = window.appState.isSetupMode;

  card.className = `player-card ${isSetup ? 'setup-mode' : 'play-mode'}`;
  card.dataset.playerId = player.id;
  card.style.setProperty('--card-color', player.color);
  card.style.left = `${player.x || 100}px`;
  card.style.top = `${player.y || 100}px`;

  // IMPORTANT: Trash button and Palette button ONLY rendered when in Setup Mode!
  card.innerHTML = `
    <div class="card-top">
      <div class="player-badge"></div>
      <div class="player-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div>
      <div class="card-actions-top">
        ${isSetup ? `
          <button class="card-icon-btn color-btn" title="Choose Color">🎨</button>
          <button class="card-icon-btn delete" title="Delete player">🗑️</button>
        ` : ''}
      </div>
    </div>
    <div class="card-score-body">
      <div class="score-display">${player.score}</div>
      <div class="tap-prompt">${isSetup ? 'Move Mode' : '+1 Tap'}</div>
    </div>
    <div class="card-bottom">
      <button class="minus-btn" title="Remove 1 point">-1</button>
      <div class="drag-handle-icon">${isSetup ? '⋮⋮' : '🔒'}</div>
    </div>
  `;

  attachCardEvents(card, player.id);
  return card;
}

function updatePlayerCardDOM(card, player) {
  const isSetup = window.appState.isSetupMode;

  card.className = `player-card ${isSetup ? 'setup-mode' : 'play-mode'}`;
  card.style.setProperty('--card-color', player.color);
  card.style.left = `${player.x}px`;
  card.style.top = `${player.y}px`;

  const nameElem = card.querySelector('.player-name');
  if (nameElem) nameElem.textContent = player.name;

  const scoreElem = card.querySelector('.score-display');
  if (scoreElem && scoreElem.textContent !== String(player.score)) {
    scoreElem.textContent = player.score;
  }

  // Update top actions (hide in Play Mode, show in Setup Mode)
  const cardTop = card.querySelector('.card-top');
  const actionsTop = card.querySelector('.card-actions-top');
  if (actionsTop) {
    actionsTop.innerHTML = isSetup ? `
      <button class="card-icon-btn color-btn" title="Choose Color">🎨</button>
      <button class="card-icon-btn delete" title="Delete player">🗑️</button>
    ` : '';
    attachTopActionsEvents(cardTop, player.id);
  }

  const promptElem = card.querySelector('.tap-prompt');
  if (promptElem) promptElem.textContent = isSetup ? 'Move Mode' : '+1 Tap';

  const dragIcon = card.querySelector('.drag-handle-icon');
  if (dragIcon) dragIcon.textContent = isSetup ? '⋮⋮' : '🔒';
}

function attachCardEvents(card, playerId) {
  const cardTop = card.querySelector('.card-top');
  attachTopActionsEvents(cardTop, playerId);

  // Main Card Tap -> Add +1 Point (ONLY in Play Mode!)
  card.addEventListener('click', (e) => {
    if (window.appState.isSetupMode) return;
    if (e.target.closest('.minus-btn') || e.target.closest('.card-icon-btn') || e.target.closest('.player-badge') || e.target.closest('.color-picker-popover')) return;

    addPoint(playerId, e);
  });

  // Minus Button Click -> Subtract 1 Point
  const minusBtn = card.querySelector('.minus-btn');
  if (minusBtn) {
    minusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      subtractPoint(playerId, e);
    });
  }
}

function attachTopActionsEvents(cardTopElem, playerId) {
  if (!cardTopElem) return;

  // Palette button opens color picker popover
  const colorBtn = cardTopElem.querySelector('.card-icon-btn.color-btn');
  if (colorBtn) {
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleColorPickerPopover(playerId, cardTopElem);
    });
  }

  // Delete button removes player
  const deleteBtn = cardTopElem.querySelector('.card-icon-btn.delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const player = window.appState.players.find(p => p.id === playerId);
      if (player && confirm(`Remove ${player.name}?`)) {
        removePlayer(playerId);
      }
    });
  }
}

function addPoint(playerId, e) {
  if (window.appState.isSetupMode) return;

  const player = window.appState.players.find(p => p.id === playerId);
  if (!player) return;

  player.score += 1;
  window.soundFx.playPointAdd();
  
  const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
  if (card) {
    const scoreBody = card.querySelector('.card-score-body');
    const scoreDisplay = card.querySelector('.score-display');
    if (scoreDisplay) scoreDisplay.textContent = player.score;

    if (scoreBody) {
      scoreBody.classList.remove('pop');
      void scoreBody.offsetWidth;
      scoreBody.classList.add('pop');
    }

    createScoreFloater(e.clientX || (card.getBoundingClientRect().left + 85), 
                       e.clientY || (card.getBoundingClientRect().top + 95), 
                       '+1', 'plus');
  }

  saveState();
}

function subtractPoint(playerId, e) {
  const player = window.appState.players.find(p => p.id === playerId);
  if (!player) return;

  player.score -= 1;
  window.soundFx.playPointSub();

  const card = document.querySelector(`.player-card[data-player-id="${playerId}"]`);
  if (card) {
    const scoreDisplay = card.querySelector('.score-display');
    if (scoreDisplay) scoreDisplay.textContent = player.score;

    const rect = card.getBoundingClientRect();
    createScoreFloater(e.clientX || (rect.left + 40), 
                       e.clientY || (rect.top + rect.height - 20), 
                       '-1', 'minus');
  }

  saveState();
}

function createScoreFloater(x, y, text, typeClass) {
  const floater = document.createElement('div');
  floater.className = `score-floater ${typeClass}`;
  floater.textContent = text;
  floater.style.left = `${x}px`;
  floater.style.top = `${y}px`;

  document.body.appendChild(floater);
  setTimeout(() => floater.remove(), 750);
}

function addNewPlayer(name, color) {
  const board = document.getElementById('board');
  const boardRect = board ? board.getBoundingClientRect() : { width: 600, height: 400 };

  const count = window.appState.players.length;
  const col = count % 4;
  const row = Math.floor(count / 4);

  const defaultX = Math.min(60 + col * 190, boardRect.width - 180);
  const defaultY = Math.min(80 + row * 210, boardRect.height - 200);

  const newPlayer = {
    id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name,
    color: color || getRandomColor(),
    score: 0,
    x: Math.max(20, defaultX),
    y: Math.max(20, defaultY)
  };

  window.appState.players.push(newPlayer);
  renderBoardCards();
  saveState();
}

function renderManagePlayersList() {
  const container = document.getElementById('manage-players-list');
  if (!container) return;

  container.innerHTML = '';

  if (window.appState.players.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No participants yet. Use the input above to add players!</div>`;
    return;
  }

  window.appState.players.forEach(player => {
    const item = document.createElement('div');
    item.className = 'manage-item';
    item.innerHTML = `
      <div class="manage-item-info">
        <div class="player-badge" style="background-color:${player.color}; box-shadow:0 0 6px ${player.color};"></div>
        <div class="manage-item-name">${escapeHtml(player.name)}</div>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem; position:relative;">
        <span class="manage-item-score">Score: ${player.score}</span>
        <button class="btn icon-btn color-cycle-btn" title="Choose Color">🎨</button>
        <button class="btn btn-danger icon-btn item-delete-btn" title="Remove player">🗑️</button>
      </div>
    `;

    const colorBtn = item.querySelector('.color-cycle-btn');
    const deleteBtn = item.querySelector('.item-delete-btn');

    if (colorBtn) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleColorPickerPopover(player.id, item.querySelector('div[style*="position:relative"]'));
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        removePlayer(player.id);
        renderManagePlayersList();
      });
    }

    container.appendChild(item);
  });
}

function removePlayer(playerId) {
  window.appState.players = window.appState.players.filter(p => p.id !== playerId);
  renderBoardCards();
  saveState();
}

function resetAllScores() {
  window.appState.players.forEach(p => p.score = 0);
  window.soundFx.playReset();
  renderBoardCards();
  saveState();
}

function getRandomColor() {
  const count = window.appState.players.length;
  return COLOR_PALETTE[count % COLOR_PALETTE.length];
}

function openModal(modalElem) {
  if (modalElem) modalElem.classList.add('active');
}

function closeModal(modalElem) {
  if (modalElem) modalElem.classList.remove('active');
  closeAllColorPopovers();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
