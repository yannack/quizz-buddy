/**
 * Quizz Buddy - Drag Engine
 * PointerEvent-based smooth drag positioning with boundary checking.
 * Only active in Setup Mode.
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
    this.onPositionChange = null;
  }

  init(boardElemId, onPositionChangeCallback) {
    this.boardElem = document.getElementById(boardElemId);
    this.onPositionChange = onPositionChangeCallback;

    this.boardElem.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  onPointerDown(e) {
    // Only allow dragging in Setup Mode
    if (!window.appState || !window.appState.isSetupMode) return;

    // IMPORTANT: Skip drag if user clicked on any interactive buttons inside card
    if (
      e.target.closest('.minus-btn') || 
      e.target.closest('.card-icon-btn') || 
      e.target.closest('.player-badge') ||
      e.target.closest('.color-picker-popover')
    ) {
      return;
    }

    const card = e.target.closest('.player-card');
    if (!card) return;

    this.activeCard = card;
    this.hasMoved = false;
    this.startX = e.clientX;
    this.startY = e.clientY;

    const rect = card.getBoundingClientRect();
    const boardRect = this.boardElem.getBoundingClientRect();

    this.initialLeft = rect.left - boardRect.left;
    this.initialTop = rect.top - boardRect.top;

    card.classList.add('dragging');
    card.setPointerCapture(e.pointerId);
  }

  onPointerMove(e) {
    if (!this.activeCard) return;

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      this.hasMoved = true;
    }

    if (!this.hasMoved) return;

    const boardRect = this.boardElem.getBoundingClientRect();
    const cardRect = this.activeCard.getBoundingClientRect();

    let newLeft = this.initialLeft + deltaX;
    let newTop = this.initialTop + deltaY;

    const maxLeft = boardRect.width - cardRect.width;
    const maxTop = boardRect.height - cardRect.height;

    newLeft = Math.max(8, Math.min(newLeft, maxLeft - 8));
    newTop = Math.max(8, Math.min(newTop, maxTop - 8));

    this.activeCard.style.left = `${newLeft}px`;
    this.activeCard.style.top = `${newTop}px`;
  }

  onPointerUp(e) {
    if (!this.activeCard) return;

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
}

window.dragEngine = new DragEngine();
