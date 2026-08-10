/**
 * Quizz Buddy - Drag, Pan & Zoom Engine
 * PointerEvent-based smooth drag positioning with boundary checking,
 * multi-touch pinch zooming, mouse wheel zooming, and background canvas panning.
 */
class DragEngine {
  constructor() {
    this.activeCard = null;
    this.startX = 0;
    this.startY = 0;
    this.initialLeft = 0;
    this.initialTop = 0;
    this.hasMoved = false;

    this.boardElem = null;
    this.canvasElem = null;
    this.onPositionChange = null;
    this.onViewChange = null;

    // Pan & Zoom state
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.minScale = 0.4;
    this.maxScale = 2.5;

    // Background Panning tracking
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.initialPanX = 0;
    this.initialPanY = 0;

    // Multi-touch tracking
    this.activePointers = new Map();
    this.initialPinchDist = 0;
    this.initialPinchScale = 1.0;
    this.pinchCenter = { x: 0, y: 0 };
  }

  init(boardElemId, canvasElemId, callbacks = {}) {
    this.boardElem = document.getElementById(boardElemId);
    this.canvasElem = document.getElementById(canvasElemId);

    if (typeof callbacks === 'function') {
      this.onPositionChange = callbacks;
    } else {
      this.onPositionChange = callbacks.onPositionChange;
      this.onViewChange = callbacks.onViewChange;
    }

    if (!this.boardElem || !this.canvasElem) return;

    // Listeners on board container
    this.boardElem.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Mouse Wheel Zoom
    this.boardElem.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Restore saved view state if available
    if (window.appState && window.appState.scale) {
      this.scale = window.appState.scale || 1.0;
      this.panX = window.appState.panX || 0;
      this.panY = window.appState.panY || 0;
    }

    this.applyTransform(false);
  }

  setViewState(scale, panX, panY, animate = false) {
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));
    this.panX = panX;
    this.panY = panY;
    this.applyTransform(animate);
    this.notifyViewChange();
  }

  applyTransform(animate = false) {
    if (!this.canvasElem) return;

    if (animate) {
      this.canvasElem.style.transition = 'transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1)';
      setTimeout(() => {
        if (this.canvasElem) this.canvasElem.style.transition = 'none';
      }, 250);
    } else {
      this.canvasElem.style.transition = 'none';
    }

    this.canvasElem.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.scale})`;

    // Update zoom level badge UI
    const levelBadge = document.getElementById('zoom-level');
    if (levelBadge) {
      levelBadge.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  onPointerDown(e) {
    // Save pointer for pinch zoom tracking
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-finger pinch gesture start
    if (this.activePointers.size === 2) {
      this.isPanning = false;
      if (this.activeCard) {
        this.activeCard.classList.remove('dragging');
        this.activeCard = null;
      }
      this.startPinchGesture();
      return;
    }

    // Ignore clicks inside zoom controls or overlays
    if (e.target.closest('#zoom-controls') || e.target.closest('.modal-overlay')) {
      return;
    }

    // Check if user tapped interactive controls inside card
    if (
      e.target.closest('.minus-btn') || 
      e.target.closest('.card-icon-btn') || 
      e.target.closest('.player-badge') ||
      e.target.closest('.color-picker-popover') ||
      e.target.closest('.player-name-input')
    ) {
      return;
    }

    const card = e.target.closest('.player-card');

    // Case 1: Card Dragging (Active ONLY in Setup Mode)
    if (card && window.appState && window.appState.isSetupMode) {
      this.activeCard = card;
      this.hasMoved = false;
      this.startX = e.clientX;
      this.startY = e.clientY;

      this.initialLeft = parseFloat(card.style.left) || 0;
      this.initialTop = parseFloat(card.style.top) || 0;

      card.classList.add('dragging');
      card.setPointerCapture(e.pointerId);
      return;
    }

    // Case 2: Canvas Panning (Allowed anytime when touching/clicking background)
    if (!card) {
      this.isPanning = true;
      this.hasMoved = false;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.initialPanX = this.panX;
      this.initialPanY = this.panY;
      this.boardElem.classList.add('panning');
    }
  }

  onPointerMove(e) {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // 2-Finger Pinch Zooming
    if (this.activePointers.size === 2) {
      this.updatePinchGesture();
      return;
    }

    // Single Finger Card Dragging
    if (this.activeCard) {
      const deltaX = e.clientX - this.startX;
      const deltaY = e.clientY - this.startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        this.hasMoved = true;
      }

      if (!this.hasMoved) return;

      // Adjust movement for scale factor so card moves 1:1 with pointer
      const scaledDeltaX = deltaX / this.scale;
      const scaledDeltaY = deltaY / this.scale;

      const newLeft = Math.max(-50, this.initialLeft + scaledDeltaX);
      const newTop = Math.max(-50, this.initialTop + scaledDeltaY);

      this.activeCard.style.left = `${newLeft}px`;
      this.activeCard.style.top = `${newTop}px`;
      return;
    }

    // Single Finger / Mouse Background Panning
    if (this.isPanning) {
      const deltaX = e.clientX - this.panStartX;
      const deltaY = e.clientY - this.panStartY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        this.hasMoved = true;
      }

      this.panX = this.initialPanX + deltaX;
      this.panY = this.initialPanY + deltaY;
      this.applyTransform(false);
    }
  }

  onPointerUp(e) {
    this.activePointers.delete(e.pointerId);

    // End Card Dragging
    if (this.activeCard) {
      const playerId = this.activeCard.dataset.playerId;
      const isDragMovement = this.hasMoved;

      this.activeCard.classList.remove('dragging');

      if (isDragMovement && this.onPositionChange && playerId) {
        const left = parseFloat(this.activeCard.style.left);
        const top = parseFloat(this.activeCard.style.top);
        this.onPositionChange(playerId, left, top);
      }

      this.activeCard = null;
      this.hasMoved = false;
    }

    // End Background Panning
    if (this.isPanning) {
      this.isPanning = false;
      this.boardElem.classList.remove('panning');
      this.notifyViewChange();
    }
  }

  startPinchGesture() {
    const points = Array.from(this.activePointers.values());
    const p1 = points[0];
    const p2 = points[1];

    this.initialPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    this.initialPinchScale = this.scale;

    const boardRect = this.boardElem.getBoundingClientRect();
    this.pinchCenter = {
      x: ((p1.x + p2.x) / 2) - boardRect.left,
      y: ((p1.y + p2.y) / 2) - boardRect.top
    };
  }

  updatePinchGesture() {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) return;

    const p1 = points[0];
    const p2 = points[1];

    const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (this.initialPinchDist <= 0) return;

    const scaleFactor = currentDist / this.initialPinchDist;
    const targetScale = Math.min(this.maxScale, Math.max(this.minScale, this.initialPinchScale * scaleFactor));

    this.zoomAtPoint(targetScale, this.pinchCenter.x, this.pinchCenter.y);
  }

  onWheel(e) {
    e.preventDefault();

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const targetScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));

    const boardRect = this.boardElem.getBoundingClientRect();
    const focusX = e.clientX - boardRect.left;
    const focusY = e.clientY - boardRect.top;

    this.zoomAtPoint(targetScale, focusX, focusY);
    this.notifyViewChange();
  }

  zoomAtPoint(newScale, focusX, focusY) {
    if (newScale === this.scale) return;

    const scaleRatio = newScale / this.scale;
    this.panX = focusX - scaleRatio * (focusX - this.panX);
    this.panY = focusY - scaleRatio * (focusY - this.panY);
    this.scale = newScale;

    this.applyTransform(false);
  }

  zoomIn() {
    const boardRect = this.boardElem.getBoundingClientRect();
    const targetScale = Math.min(this.maxScale, this.scale * 1.25);
    this.zoomAtPoint(targetScale, boardRect.width / 2, boardRect.height / 2);
    this.notifyViewChange();
  }

  zoomOut() {
    const boardRect = this.boardElem.getBoundingClientRect();
    const targetScale = Math.max(this.minScale, this.scale * 0.8);
    this.zoomAtPoint(targetScale, boardRect.width / 2, boardRect.height / 2);
    this.notifyViewChange();
  }

  resetView() {
    this.fitToBoard();
  }

  fitToBoard() {
    if (!window.appState || !window.appState.players || window.appState.players.length === 0) {
      this.setViewState(1.0, 0, 0, true);
      return;
    }

    const boardRect = this.boardElem.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const cardW = 180;
    const cardH = 200;

    window.appState.players.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + cardW);
      maxY = Math.max(maxY, p.y + cardH);
    });

    const contentWidth = maxX - minX + 40;
    const contentHeight = maxY - minY + 40;

    const scaleX = boardRect.width / contentWidth;
    const scaleY = boardRect.height / contentHeight;

    let autoScale = Math.min(scaleX, scaleY, 1.1);
    autoScale = Math.min(this.maxScale, Math.max(this.minScale, autoScale));

    const panX = (boardRect.width - (maxX + minX) * autoScale) / 2;
    const panY = (boardRect.height - (maxY + minY) * autoScale) / 2;

    this.setViewState(autoScale, panX, panY, true);
  }

  notifyViewChange() {
    if (this.onViewChange) {
      this.onViewChange(this.scale, this.panX, this.panY);
    }
  }
}

window.dragEngine = new DragEngine();
