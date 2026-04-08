export class UIController {
  constructor() {
    this.scoreEl = document.getElementById('scoreValue');
    this.bestEl = document.getElementById('bestValue');
    this.scoreCard = document.getElementById('scoreCard');
    this.bestCard = document.getElementById('bestCard');
    this.startScreen = document.getElementById('startScreen');
    this.pauseScreen = document.getElementById('pauseScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.messageEl = document.getElementById('gameOverMessage');
    this.startBtn = document.getElementById('startBtn');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.scorePopTimer = null;
    this.bestPopTimer = null;
  }

  pulseScore(isBest = false) {
    this.scoreCard.classList.remove('pop');
    void this.scoreCard.offsetWidth;
    this.scoreCard.classList.add('pop');
    clearTimeout(this.scorePopTimer);
    this.scorePopTimer = setTimeout(() => this.scoreCard.classList.remove('pop'), 180);

    if (isBest) {
      this.bestCard.classList.remove('best-pop');
      void this.bestCard.offsetWidth;
      this.bestCard.classList.add('best-pop');
      clearTimeout(this.bestPopTimer);
      this.bestPopTimer = setTimeout(() => this.bestCard.classList.remove('best-pop'), 220);
    }
  }

  updateScore(score, { pulse = false, bestPulse = false } = {}) {
    this.scoreEl.textContent = String(score);
    if (pulse) this.pulseScore(bestPulse);
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
    this.startBtn?.focus();
  }

  showPause(show) {
    this.pauseScreen.classList.toggle('hidden', !show);
    if (show) this.resumeBtn?.focus();
  }

  showGameOver(score, message) {
    this.messageEl.textContent = `${message} Final score: ${score}.`;
    this.gameOverScreen.classList.remove('hidden');
    this.restartBtn?.focus();
  }
}
