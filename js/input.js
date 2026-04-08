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
  constructor({ canvas, touchContainer, onMove, onPause }) {
    this.canvas = canvas;
    this.touchContainer = touchContainer;
    this.onMove = onMove;
    this.onPause = onPause;
    this.swipeStart = null;
  }

  bind() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyP' || event.code === 'Escape') {
        this.onPause();
        return;
      }
      const dir = KEY_TO_DIR[event.code];
      if (dir) {
        event.preventDefault();
        this.onMove(dir);
      }
    });

    this.touchContainer.querySelectorAll('button[data-dir]').forEach((btn) => {
      btn.addEventListener('pointerdown', () => this.onMove(btn.dataset.dir));
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      this.swipeStart = { x: event.clientX, y: event.clientY };
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (!this.swipeStart) return;
      const dx = event.clientX - this.swipeStart.x;
      const dy = event.clientY - this.swipeStart.y;
      this.swipeStart = null;
      const threshold = 30;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.onMove(dx > 0 ? 'right' : 'left');
      } else {
        this.onMove(dy > 0 ? 'down' : 'up');
      }
    });
  }
}
