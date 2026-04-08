export class UIController {
  constructor() {
    this.scoreEl = document.getElementById('scoreValue');
    this.bestEl = document.getElementById('bestValue');
    this.startScreen = document.getElementById('startScreen');
    this.pauseScreen = document.getElementById('pauseScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.messageEl = document.getElementById('gameOverMessage');
  }

  updateScore(score) {
    this.scoreEl.textContent = String(score);
  }

  updateBest(best) {
    this.bestEl.textContent = String(best);
  }

  hideAllOverlays() {
    this.startScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
  }

  showStart() {
    this.hideAllOverlays();
    this.startScreen.classList.remove('hidden');
  }

  showPause(show) {
    this.pauseScreen.classList.toggle('hidden', !show);
  }

  showGameOver(score, message) {
    this.messageEl.textContent = `${message} Final score: ${score}.`;
    this.gameOverScreen.classList.remove('hidden');
  }
}
