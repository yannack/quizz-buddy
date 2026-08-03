/**
 * Quizz Buddy - Screen Wake Lock Controller
 * Prevents screen sleep/dimming during quiz night.
 */
class WakeLockController {
  constructor() {
    this.wakeLock = null;
    this.supported = 'wakeLock' in navigator;
    this.statusElem = null;
  }

  init(statusElemId) {
    this.statusElem = document.getElementById(statusElemId);
    if (!this.supported) {
      if (this.statusElem) {
        this.statusElem.style.display = 'none';
      }
      return;
    }

    // Attempt request on initial user interaction
    document.addEventListener('click', () => this.requestLock(), { once: true });
    
    // Re-acquire when returning to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.requestLock();
      }
    });
  }

  async requestLock() {
    if (!this.supported || this.wakeLock !== null) return;

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.updateUI(true);

      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.updateUI(false);
      });
    } catch (err) {
      console.warn('Wake Lock request failed:', err.name, err.message);
      this.updateUI(false);
    }
  }

  updateUI(isActive) {
    if (!this.statusElem) return;
    if (isActive) {
      this.statusElem.classList.add('active');
      this.statusElem.title = 'Screen Wake Lock active';
      this.statusElem.style.opacity = '1';
    } else {
      this.statusElem.classList.remove('active');
      this.statusElem.title = 'Screen Wake Lock inactive';
      this.statusElem.style.opacity = '0.5';
    }
  }
}

window.wakeLockCtrl = new WakeLockController();
