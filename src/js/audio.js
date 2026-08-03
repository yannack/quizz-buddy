/**
 * Quizz Buddy - Web Audio Synthesizer
 * Zero-dependency synthesized sound effects for point changes, locks, and actions.
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window.AudioContext !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  setMuted(isMuted) {
    this.muted = isMuted;
  }

  playChime(freq, type = 'sine', duration = 0.15, vol = 0.1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Point Addition (+1) - Crisp upward chord chime
  playPointAdd() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Quick ascending major arpeggio (C5 -> E5 -> G5)
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      setTimeout(() => this.playChime(freq, 'sine', 0.18, 0.08), index * 40);
    });
  }

  // Point Subtraction (-1) - Soft downward chime
  playPointSub() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    [440.00, 349.23].forEach((freq, index) => {
      setTimeout(() => this.playChime(freq, 'triangle', 0.2, 0.08), index * 60);
    });
  }

  // Lock Toggle
  playLock(isLocked) {
    if (isLocked) {
      this.playChime(440, 'sine', 0.1, 0.06);
      setTimeout(() => this.playChime(880, 'sine', 0.15, 0.08), 80);
    } else {
      this.playChime(880, 'sine', 0.1, 0.06);
      setTimeout(() => this.playChime(440, 'sine', 0.15, 0.08), 80);
    }
  }

  // Reset Chime
  playReset() {
    if (this.muted) return;
    this.playChime(300, 'sawtooth', 0.3, 0.04);
  }
}

window.soundFx = new SoundEffects();
