/**
 * Quizz Buddy - WebRTC Buzzer Manager
 * Handles PeerJS host/client connections, QR code joining,
 * participant claiming, high-precision buzz queueing, and host Quiz Master controls.
 */

class BuzzerManager {
  constructor() {
    this.peer = null;
    this.hostPeerId = null;
    this.isHost = false;

    // Host state
    this.clientConns = new Map(); // connectionId -> { conn, playerId, name, color }
    this.questionActive = false;
    this.buzzQueue = []; // Array of playerId in order of buzz
    this.backOfQueueOnWrong = false;

    // Client state
    this.hostConn = null;
    this.myPlayerId = null;
    this.myPlayerName = '';
    this.myPlayerColor = '#6366f1';
    this.myState = 'off'; // 'off', 'waiting', 'in_queue', 'up'
    this.myQueuePosition = 0;
  }

  // --- HOST LOGIC ---

  initHost() {
    this.isHost = true;
    // Generate a random host ID
    const randomId = Math.random().toString(36).substring(2, 8);
    this.hostPeerId = `qb-${randomId}`;

    try {
      this.peer = new Peer(this.hostPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.hostPeerId = id;
        this.updateHostUI();
        if (typeof renderBuzzerQrCode === 'function') {
          renderBuzzerQrCode();
        }
      });

      this.peer.on('connection', (conn) => {
        this.handleHostIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS Host Error:', err);
      });
    } catch (err) {
      console.error('Failed to initialize PeerJS host:', err);
    }
  }

  getJoinUrl() {
    const loc = window.location;
    return `${loc.origin}${loc.pathname}?join=${encodeURIComponent(this.hostPeerId)}`;
  }

  handleHostIncomingConnection(conn) {
    conn.on('open', () => {
      // Send current available (unclaimed) players to the new client
      this.sendAvailablePlayersToClient(conn);
    });

    conn.on('data', (data) => {
      this.handleHostDataReceived(conn, data);
    });

    conn.on('close', () => {
      this.clientConns.delete(conn.connectionId);
      this.removePlayerFromQueue(conn.playerId);
      this.broadcastRoomState();
      this.updateHostUI();
    });
  }

  sendAvailablePlayersToClient(conn) {
    const claimedPlayerIds = new Set();
    this.clientConns.forEach(c => {
      if (c.playerId) claimedPlayerIds.add(c.playerId);
    });

    const availablePlayers = (window.appState ? window.appState.players : []).filter(p => !claimedPlayerIds.has(p.id));

    conn.send({
      type: 'ROOM_STATE',
      availablePlayers: availablePlayers,
      questionActive: this.questionActive
    });
  }

  broadcastRoomState() {
    const claimedPlayerIds = new Set();
    this.clientConns.forEach(c => {
      if (c.playerId) claimedPlayerIds.add(c.playerId);
    });

    const availablePlayers = (window.appState ? window.appState.players : []).filter(p => !claimedPlayerIds.has(p.id));

    this.clientConns.forEach(c => {
      if (c.conn && c.conn.open) {
        c.conn.send({
          type: 'ROOM_STATE',
          availablePlayers: availablePlayers,
          questionActive: this.questionActive
        });
      }
    });
  }

  handleHostDataReceived(conn, data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'SELECT_PLAYER': {
        const playerId = data.playerId;
        const player = (window.appState ? window.appState.players : []).find(p => p.id === playerId);

        // Check if player is already claimed by another connection
        let alreadyClaimed = false;
        this.clientConns.forEach(c => {
          if (c.playerId === playerId && c.conn.connectionId !== conn.connectionId) {
            alreadyClaimed = true;
          }
        });

        if (!player || alreadyClaimed) {
          conn.send({ type: 'SELECT_ERROR', message: 'Player is no longer available.' });
          this.sendAvailablePlayersToClient(conn);
          return;
        }

        // Assign player to this connection
        this.clientConns.set(conn.connectionId, {
          conn: conn,
          playerId: player.id,
          name: player.name,
          color: player.color
        });

        conn.playerId = player.id;

        conn.send({
          type: 'SELECT_SUCCESS',
          player: player,
          questionActive: this.questionActive
        });

        // Broadcast updated room state so other connecting devices see updated availability
        this.broadcastRoomState();
        this.updateHostUI();
        break;
      }

      case 'BUZZ': {
        const clientInfo = this.clientConns.get(conn.connectionId);
        if (!clientInfo || !clientInfo.playerId) return;

        if (this.questionActive) {
          this.processBuzz(clientInfo.playerId);
        }
        break;
      }

      case 'DISCONNECT': {
        conn.close();
        break;
      }
    }
  }

  processBuzz(playerId) {
    // Prevent duplicate buzzes from same player in queue
    if (this.buzzQueue.includes(playerId)) return;

    const becameUp = (this.buzzQueue.length === 0);
    this.buzzQueue.push(playerId);

    if (becameUp) {
      if (window.soundFx) window.soundFx.playBuzzer();
    } else {
      if (window.soundFx) window.soundFx.playChime(880, 'sine', 0.15, 0.1);
    }

    this.broadcastQueueUpdate();
    this.updateHostUI();
  }

  removePlayerFromQueue(playerId) {
    if (!playerId) return;
    this.buzzQueue = this.buzzQueue.filter(id => id !== playerId);
    this.broadcastQueueUpdate();
  }

  broadcastQueueUpdate() {
    this.clientConns.forEach((info) => {
      const pId = info.playerId;
      let state = 'off';
      let position = 0;

      if (!this.questionActive) {
        state = 'off';
      } else if (this.buzzQueue.length === 0) {
        state = 'waiting';
      } else {
        const index = this.buzzQueue.indexOf(pId);
        if (index === 0) {
          state = 'up';
          position = 1;
        } else if (index > 0) {
          state = 'in_queue';
          position = index + 1;
        } else {
          state = 'waiting'; // Question active, player hasn't buzzed yet -> can still buzz to queue up
        }
      }

      if (info.conn && info.conn.open) {
        info.conn.send({
          type: 'QUEUE_UPDATE',
          state: state,
          position: position,
          queueLength: this.buzzQueue.length,
          currentUpPlayerId: this.buzzQueue[0] || null
        });
      }
    });
  }

  // --- HOST ACTIONS ---

  newQuestion() {
    this.buzzQueue = [];
    this.questionActive = true;

    // Send QUESTION_START to all connected players
    this.clientConns.forEach((info) => {
      if (info.conn && info.conn.open) {
        info.conn.send({
          type: 'QUESTION_START',
          state: 'waiting'
        });
      }
    });

    if (window.soundFx) window.soundFx.playChime(520, 'triangle', 0.2, 0.1);
    this.updateHostUI();
  }

  goodAnswer() {
    if (this.buzzQueue.length === 0) return;
    const winnerId = this.buzzQueue[0];

    // Award +1 point to winner on host
    if (window.appState && window.appState.players) {
      const player = window.appState.players.find(p => p.id === winnerId);
      if (player) {
        player.score += 1;
        if (typeof saveState === 'function') saveState();
        if (typeof renderBoardCards === 'function') renderBoardCards();
        if (typeof renderManagePlayersList === 'function') renderManagePlayersList();
      }
    }

    if (window.soundFx) window.soundFx.playPointAdd();

    // End question and set all buzzers to OFF
    this.questionActive = false;
    this.buzzQueue = [];

    this.clientConns.forEach((info) => {
      if (info.conn && info.conn.open) {
        info.conn.send({
          type: 'QUESTION_END',
          winnerId: winnerId,
          state: 'off'
        });
      }
    });

    this.updateHostUI();
  }

  wrongAnswer(sendToBackOfQueue) {
    if (this.buzzQueue.length === 0) return;

    const wrongPlayerId = this.buzzQueue.shift();

    if (sendToBackOfQueue) {
      this.buzzQueue.push(wrongPlayerId);
    }

    if (this.buzzQueue.length > 0) {
      if (window.soundFx) window.soundFx.playBuzzer();
    } else {
      if (window.soundFx) window.soundFx.playPointSub();
    }

    this.broadcastQueueUpdate();
    this.updateHostUI();
  }

  kickPlayer(playerId) {
    this.clientConns.forEach((info, connId) => {
      if (info.playerId === playerId) {
        if (info.conn && info.conn.open) {
          info.conn.send({ type: 'KICKED' });
          info.conn.close();
        }
        this.clientConns.delete(connId);
      }
    });

    this.removePlayerFromQueue(playerId);
    this.broadcastRoomState();
    this.updateHostUI();
  }

  updateHostUI() {
    // Update connected count indicator on host navbar button
    const liveQuizBtn = document.getElementById('btn-live-quiz');
    const connectedCount = this.clientConns.size;

    if (liveQuizBtn) {
      if (connectedCount > 0) {
        liveQuizBtn.style.display = 'inline-flex';
        liveQuizBtn.innerHTML = `⚡ Live Quiz (${connectedCount})`;
      } else {
        liveQuizBtn.style.display = 'none';
      }
    }

    // Render Connected Buzzers List inside setup modal if open
    const listContainer = document.getElementById('connected-buzzers-list');
    if (listContainer) {
      listContainer.innerHTML = '';
      if (connectedCount === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:1rem; font-size:0.9rem;">No buzzers connected yet. Scan the QR code above!</div>`;
      } else {
        this.clientConns.forEach((info) => {
          const item = document.createElement('div');
          item.className = 'connected-buzzer-item';
          item.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span class="status-dot green"></span>
              <div class="player-badge" style="background-color:${info.color};"></div>
              <strong style="font-size:0.95rem;">${escapeHtml(info.name)}</strong>
            </div>
            <button class="btn btn-danger icon-btn item-kick-btn" title="Kick Player">🛑 Kick</button>
          `;
          const kickBtn = item.querySelector('.item-kick-btn');
          if (kickBtn) {
            kickBtn.addEventListener('click', () => {
              if (confirm(`Kick ${info.name} from the buzzer session?`)) {
                this.kickPlayer(info.playerId);
              }
            });
          }
          listContainer.appendChild(item);
        });
      }
    }

    // Render Live Quiz Master Modal if open
    const upContainer = document.getElementById('current-up-player-container');
    const queueList = document.getElementById('live-buzz-queue-list');
    const goodBtn = document.getElementById('btn-good-answer');
    const wrongBtn = document.getElementById('btn-wrong-answer');

    const currentUpId = this.buzzQueue[0];
    const upPlayer = currentUpId ? (window.appState ? window.appState.players : []).find(p => p.id === currentUpId) : null;

    if (upContainer) {
      if (upPlayer) {
        upContainer.innerHTML = `
          <div class="hero-up-card" style="--card-color:${upPlayer.color}">
            <div class="hero-up-badge">CURRENTLY UP</div>
            <div class="hero-up-name">${escapeHtml(upPlayer.name)}</div>
            <div class="hero-up-score">Current Score: ${upPlayer.score} pts</div>
          </div>
        `;
      } else {
        upContainer.innerHTML = `
          <div class="hero-up-card empty">
            <div class="hero-up-prompt">${this.questionActive ? 'Waiting for someone to buzz...' : 'Click "▶️ New Question" to activate buzzers!'}</div>
          </div>
        `;
      }
    }

    if (goodBtn) goodBtn.disabled = !upPlayer;
    if (wrongBtn) wrongBtn.disabled = !upPlayer;

    if (queueList) {
      queueList.innerHTML = '';
      if (this.buzzQueue.length <= 1) {
        queueList.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:0.5rem;">Queue is empty</div>`;
      } else {
        // Render 2nd person onwards
        for (let i = 1; i < this.buzzQueue.length; i++) {
          const qId = this.buzzQueue[i];
          const qPlayer = (window.appState ? window.appState.players : []).find(p => p.id === qId);
          if (qPlayer) {
            const qItem = document.createElement('div');
            qItem.className = 'queue-list-item';
            qItem.innerHTML = `
              <span class="queue-num">#${i + 1}</span>
              <div class="player-badge" style="background-color:${qPlayer.color}"></div>
              <span class="queue-name">${escapeHtml(qPlayer.name)}</span>
            `;
            queueList.appendChild(qItem);
          }
        }
      }
    }
  }

  // --- CLIENT LOGIC (RUNS ON MOBILE PLAYER DEVICE) ---

  initClient(hostPeerId) {
    this.isHost = false;
    this.hostPeerId = hostPeerId;

    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        this.connectToHost();
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS Client Error:', err);
        this.renderClientStatus('Connection error. Retrying...', true);
      });
    } catch (err) {
      console.error('Failed to initialize client peer:', err);
    }
  }

  connectToHost() {
    this.renderClientStatus('Connecting to host room...', false);

    this.hostConn = this.peer.connect(this.hostPeerId, {
      reliable: true
    });

    this.hostConn.on('open', () => {
      this.renderClientStatus('Connected! Fetching players...', false);
    });

    this.hostConn.on('data', (data) => {
      this.handleClientDataReceived(data);
    });

    this.hostConn.on('close', () => {
      this.renderClientStatus('Disconnected from host room.', true);
    });
  }

  handleClientDataReceived(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'ROOM_STATE': {
        if (!this.myPlayerId) {
          this.renderParticipantSelectionView(data.availablePlayers || []);
        }
        break;
      }

      case 'SELECT_SUCCESS': {
        this.myPlayerId = data.player.id;
        this.myPlayerName = data.player.name;
        this.myPlayerColor = data.player.color;
        this.renderActiveBuzzerView();
        break;
      }

      case 'SELECT_ERROR': {
        alert(data.message || 'Could not select player.');
        break;
      }

      case 'QUESTION_START': {
        this.myState = 'waiting';
        this.updateBuzzerUI();
        if (navigator.vibrate) navigator.vibrate(80);
        break;
      }

      case 'QUEUE_UPDATE': {
        this.myState = data.state;
        this.myQueuePosition = data.position;
        this.updateBuzzerUI();

        if (this.myState === 'up' && navigator.vibrate) {
          navigator.vibrate([150, 50, 150, 50, 200]);
        }
        break;
      }

      case 'QUESTION_END': {
        this.myState = 'off';
        this.updateBuzzerUI();
        break;
      }

      case 'KICKED': {
        alert('You have been kicked from the quiz room by the host.');
        window.location.href = window.location.pathname;
        break;
      }
    }
  }

  selectPlayer(playerId) {
    if (!this.hostConn || !this.hostConn.open) return;
    this.hostConn.send({
      type: 'SELECT_PLAYER',
      playerId: playerId
    });
  }

  sendBuzz() {
    if (this.myState !== 'waiting') return;
    if (!this.hostConn || !this.hostConn.open) return;

    this.hostConn.send({ type: 'BUZZ' });
    this.myState = 'in_queue';
    this.updateBuzzerUI();

    if (navigator.vibrate) navigator.vibrate(60);
  }

  // --- CLIENT DOM RENDERING ---

  renderClientStatus(msg, isError) {
    const selectView = document.getElementById('buzzer-select-view');
    if (selectView) {
      selectView.innerHTML = `
        <div style="text-align:center; padding:2rem; color:${isError ? '#fca5a5' : '#a5b4fc'};">
          <div class="spinner" style="font-size:2rem; margin-bottom:1rem;">⚡</div>
          <h3>${escapeHtml(msg)}</h3>
        </div>
      `;
    }
  }

  renderParticipantSelectionView(availablePlayers) {
    const clientView = document.getElementById('buzzer-client-view');
    if (!clientView) return;

    clientView.style.display = 'flex';

    if (!availablePlayers || availablePlayers.length === 0) {
      clientView.innerHTML = `
        <div class="buzzer-card-container">
          <h2 style="margin-bottom:0.5rem; text-align:center;">Quiz Buddy 🏆</h2>
          <p style="color:var(--text-muted); text-align:center; margin-bottom:1.5rem;">All available participants have already been claimed or no players added yet on host screen.</p>
          <button onclick="window.location.reload()" class="btn btn-primary" style="width:100%;">🔄 Refresh List</button>
        </div>
      `;
      return;
    }

    let itemsHtml = availablePlayers.map(p => `
      <button class="player-select-card" data-player-id="${p.id}" style="--player-color:${p.color}">
        <div class="player-badge" style="background-color:${p.color};"></div>
        <span class="player-select-name">${escapeHtml(p.name)}</span>
      </button>
    `).join('');

    clientView.innerHTML = `
      <div class="buzzer-card-container">
        <h2 style="margin-bottom:0.25rem; text-align:center;">Welcome to Quiz Buddy! 🏆</h2>
        <p style="color:var(--text-muted); text-align:center; margin-bottom:1.25rem; font-size:0.9rem;">Tap your name to claim your buzzer:</p>
        <div class="player-select-grid">
          ${itemsHtml}
        </div>
      </div>
    `;

    clientView.querySelectorAll('.player-select-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.dataset.playerId;
        this.selectPlayer(pId);
      });
    });
  }

  renderActiveBuzzerView() {
    const clientView = document.getElementById('buzzer-client-view');
    if (!clientView) return;

    clientView.style.display = 'flex';
    clientView.innerHTML = `
      <div class="buzzer-active-container">
        <div class="buzzer-header">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div class="player-badge" style="background-color:${this.myPlayerColor}; width:16px; height:16px;"></div>
            <span style="font-family:var(--font-heading); font-weight:700; font-size:1.1rem;">${escapeHtml(this.myPlayerName)}</span>
          </div>
          <span id="client-status-indicator" class="status-badge">STANDBY</span>
        </div>

        <div class="buzzer-body">
          <button id="big-buzzer" class="big-buzzer state-off">
            <span class="buzzer-icon">🔔</span>
            <span id="buzzer-text" class="buzzer-text">STANDBY</span>
            <span id="buzzer-subtext" class="buzzer-subtext">Waiting for host...</span>
          </button>
        </div>
      </div>
    `;

    const buzzerBtn = document.getElementById('big-buzzer');
    if (buzzerBtn) {
      buzzerBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.sendBuzz();
      });
    }

    this.updateBuzzerUI();
  }

  updateBuzzerUI() {
    const buzzerBtn = document.getElementById('big-buzzer');
    const textElem = document.getElementById('buzzer-text');
    const subtextElem = document.getElementById('buzzer-subtext');
    const statusElem = document.getElementById('client-status-indicator');

    if (!buzzerBtn || !textElem) return;

    buzzerBtn.className = `big-buzzer state-${this.myState}`;

    switch (this.myState) {
      case 'off':
        textElem.textContent = 'STANDBY';
        if (subtextElem) subtextElem.textContent = 'Waiting for question...';
        if (statusElem) {
          statusElem.className = 'status-badge off';
          statusElem.textContent = 'STANDBY';
        }
        break;

      case 'waiting':
        textElem.textContent = 'BUZZ NOW!';
        if (subtextElem) subtextElem.textContent = 'Tap big button to buzz!';
        if (statusElem) {
          statusElem.className = 'status-badge ready';
          statusElem.textContent = 'READY!';
        }
        break;

      case 'in_queue':
        textElem.textContent = `#${this.myQueuePosition} IN QUEUE`;
        if (subtextElem) subtextElem.textContent = 'Buzzed! Waiting for your turn...';
        if (statusElem) {
          statusElem.className = 'status-badge queue';
          statusElem.textContent = `QUEUE #${this.myQueuePosition}`;
        }
        break;

      case 'up':
        textElem.textContent = "IT'S YOUR TURN!";
        if (subtextElem) subtextElem.textContent = 'ANSWER OUT LOUD NOW! 📢';
        if (statusElem) {
          statusElem.className = 'status-badge up';
          statusElem.textContent = 'YOUR TURN!';
        }
        break;
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.buzzerManager = new BuzzerManager();
