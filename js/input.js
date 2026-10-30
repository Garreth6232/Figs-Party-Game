const KEY_TO_DIR = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right'
};

const SWIPE_THRESHOLD_PX = 22;
const TAP_MAX_MS = 280;

export class InputSequenceDetector {
  constructor(sequence, onMatch) {
    this.sequence = Array.isArray(sequence) ? sequence : [];
    this.onMatch = onMatch;
    this.progress = 0;
  }

  reset() {
    this.progress = 0;
  }

  push(token) {
    if (!this.sequence.length) return;

    if (token === this.sequence[this.progress]) {
      this.progress += 1;
      if (this.progress === this.sequence.length) {
        this.progress = 0;
        this.onMatch?.();
      }
      return;
    }

    this.progress = token === this.sequence[0] ? 1 : 0;
  }
}

export class InputManager {
  constructor({
    canvas,
    touchContainer,
    onMove,
    onPause,
    onSuperJump,
    onToggleDebug,
    onToggleTerrainDebug,
    shouldCaptureKeyboard,
    sequenceBindings = []
  }) {
    this.canvas = canvas;
    this.touchContainer = touchContainer;
    this.onMove = onMove;
    this.onPause = onPause;
    this.onSuperJump = onSuperJump;
    this.onToggleDebug = onToggleDebug;
    this.onToggleTerrainDebug = onToggleTerrainDebug;
    this.shouldCaptureKeyboard = shouldCaptureKeyboard;
    this.gesture = null;
    this.sequenceBindings = sequenceBindings;
  }

  bind() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (this.shouldCaptureKeyboard?.()) return;
      const dir = KEY_TO_DIR[event.code];

      this.sequenceBindings.forEach((binding) => {
        if (binding.shouldListen?.() === false) return;
        if (dir) binding.detector.push(dir);
        else binding.detector.reset();
      });

      if (event.code === 'KeyP' || event.code === 'Escape') {
        this.onPause();
        return;
      }
      if (event.code === 'KeyC') {
        this.onToggleDebug?.();
        return;
      }
      if (event.code === 'KeyV') {
        this.onToggleTerrainDebug?.();
        return;
      }
      if (event.code === 'KeyJ' || event.code === 'Space') {
        event.preventDefault();
        this.onSuperJump();
        return;
      }
      if (dir) {
        event.preventDefault();
        this.onMove(dir);
      }
    });

    const touchActions = { superjump: () => this.onSuperJump(), pause: () => this.onPause() };
    this.touchContainer?.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        touchActions[btn.dataset.action]?.();
      });
    });

    // Touch: a swipe moves as soon as the finger has travelled far enough (no waiting for release);
    // a quick tap hops forward.
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      this.gesture = { x: event.clientX, y: event.clientY, at: performance.now(), used: false };
    });
    this.canvas.addEventListener('pointermove', (event) => {
      const gesture = this.gesture;
      if (!gesture || gesture.used || !event.isPrimary) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.hypot(dx, dy) < SWIPE_THRESHOLD_PX) return;
      gesture.used = true;
      if (Math.abs(dx) > Math.abs(dy)) this.onMove(dx > 0 ? 'right' : 'left');
      else this.onMove(dy > 0 ? 'down' : 'up');
    });
    this.canvas.addEventListener('pointerup', (event) => {
      const gesture = this.gesture;
      this.gesture = null;
      if (!gesture || gesture.used || !event.isPrimary) return;
      if (performance.now() - gesture.at <= TAP_MAX_MS) this.onMove('up');
    });
    this.canvas.addEventListener('pointercancel', () => {
      this.gesture = null;
    });
  }
}
