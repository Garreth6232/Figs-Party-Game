export class AudioSystem {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.ctx = null;
    this.muted = localStorage.getItem(this.storageKey) === '1';
  }

  get isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem(this.storageKey, this.muted ? '1' : '0');
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  beep({ frequency, duration = 0.08, type = 'square', gain = 0.03, glide = 0 }) {
    if (this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    if (glide) {
      osc.frequency.linearRampToValueAtTime(frequency + glide, now + duration);
    }
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  play(name) {
    const table = {
      hop: () => this.beep({ frequency: 520, duration: 0.07, type: 'square', gain: 0.028, glide: 40 }),
      hit: () => this.beep({ frequency: 130, duration: 0.22, type: 'sawtooth', gain: 0.05, glide: -70 }),
      score: () => {
        this.beep({ frequency: 680, duration: 0.06, type: 'triangle', gain: 0.02, glide: 45 });
        setTimeout(() => this.beep({ frequency: 820, duration: 0.08, type: 'triangle', gain: 0.018, glide: 40 }), 45);
      },
      ui: () => this.beep({ frequency: 420, duration: 0.06, type: 'sine', gain: 0.02 })
    };
    table[name]?.();
  }
}
