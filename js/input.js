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

export class InputManager {
  constructor({ canvas, touchContainer, onMove, onPause, onSuperJump, onToggleDebug, shouldCaptureKeyboard }) {
    this.canvas = canvas;
    this.touchContainer = touchContainer;
    this.onMove = onMove;
    this.onPause = onPause;
    this.onSuperJump = onSuperJump;
    this.onToggleDebug = onToggleDebug;
    this.shouldCaptureKeyboard = shouldCaptureKeyboard;
    this.swipeStart = null;
    this.holdInterval = null;
    this.holdDir = null;
  }

  bind() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (this.shouldCaptureKeyboard?.()) return;
      if (event.code === 'KeyP' || event.code === 'Escape') {
        this.onPause();
        return;
      }
      if (event.code === 'KeyC') {
        this.onToggleDebug?.();
        return;
      }
      if (event.code === 'KeyJ' || event.code === 'Space') {
        event.preventDefault();
        this.onSuperJump();
        return;
      }
      const dir = KEY_TO_DIR[event.code];
      if (dir) {
        event.preventDefault();
        this.onMove(dir);
      }
    });

    this.touchContainer.querySelectorAll('button[data-dir]').forEach((btn) => {
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.startHold(btn.dataset.dir);
      });
      btn.addEventListener('pointerup', () => this.stopHold());
      btn.addEventListener('pointercancel', () => this.stopHold());
      btn.addEventListener('pointerleave', () => this.stopHold());
    });

    this.touchContainer.querySelectorAll('button[data-action="superjump"]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        this.onSuperJump();
      });
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      this.swipeStart = { x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener('pointerup', (event) => {
      if (!this.swipeStart) return;
      const dx = event.clientX - this.swipeStart.x;
      const dy = event.clientY - this.swipeStart.y;
      this.swipeStart = null;
      const threshold = 24;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) this.onMove(dx > 0 ? 'right' : 'left');
      else this.onMove(dy > 0 ? 'down' : 'up');
    });
    this.canvas.addEventListener('pointercancel', () => {
      this.swipeStart = null;
    });
  }

  startHold(dir) {
    this.stopHold();
    this.holdDir = dir;
    this.onMove(dir);
    this.holdInterval = setInterval(() => {
      this.onMove(this.holdDir);
    }, 120);
  }

  stopHold() {
    this.holdDir = null;
    if (this.holdInterval) {
      clearInterval(this.holdInterval);
      this.holdInterval = null;
    }
  }
}
