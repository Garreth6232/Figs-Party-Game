import { ASSET_GUIDE } from './config.js';

export class UIController {
  constructor() {
    this.scoreEl = document.getElementById('scoreValue');
    this.bestEl = document.getElementById('bestValue');
    this.coinEl = document.getElementById('coinValue');
    this.superJumpEl = document.getElementById('superJumpValue');
    this.scoreCard = document.getElementById('scoreCard');
    this.bestCard = document.getElementById('bestCard');
    this.coinCard = document.getElementById('coinCard');
    this.superJumpCard = document.getElementById('superJumpCard');
    this.toastEl = document.getElementById('toast');
    this.startScreen = document.getElementById('startScreen');
    this.pauseScreen = document.getElementById('pauseScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.infoScreen = document.getElementById('infoScreen');
    this.infoList = document.getElementById('infoList');
    this.messageEl = document.getElementById('gameOverMessage');
    this.startBtn = document.getElementById('startBtn');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.closeInfoBtn = document.getElementById('closeInfoBtn');
    this.overlays = [this.startScreen, this.pauseScreen, this.gameOverScreen, this.infoScreen];
    this.scorePopTimer = null;
    this.bestPopTimer = null;
    this.toastTimer = null;
    this.renderAssetGuide();
  }

  renderAssetGuide() {
    if (!this.infoList) return;
    this.infoList.innerHTML = '';
    for (const item of ASSET_GUIDE) {
      const row = document.createElement('article');
      row.className = 'info-item';
      row.innerHTML = `
        <img src="${item.preview}" alt="${item.name} preview" loading="lazy" />
        <div>
          <h3>${item.name} <span class="badge badge-${item.action}">${item.action}</span></h3>
          <p>${item.description}</p>
        </div>
      `;
      this.infoList.append(row);
    }
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

  updateCoins(coins, needed) {
    this.coinEl.textContent = `${coins}/${needed}`;
    this.coinCard.classList.toggle('charged', coins >= needed - 1);
  }

  updateSuperJumps(count) {
    this.superJumpEl.textContent = String(count);
    this.superJumpCard.classList.toggle('charged', count > 0);
  }

  showToast(message, variant = 'info') {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.dataset.variant = variant;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1200);
  }

  hideAllOverlays() {
    this.overlays.forEach((overlay) => {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    });
  }

  showStart() {
    this.hideAllOverlays();
    this.startScreen.classList.remove('hidden');
    this.startScreen.setAttribute('aria-hidden', 'false');
    this.startBtn?.focus();
  }

  showPause(show) {
    this.pauseScreen.classList.toggle('hidden', !show);
    this.pauseScreen.setAttribute('aria-hidden', String(!show));
    if (show) this.resumeBtn?.focus();
  }

  showInfo(show) {
    this.infoScreen.classList.toggle('hidden', !show);
    this.infoScreen.setAttribute('aria-hidden', String(!show));
    if (show) this.closeInfoBtn?.focus();
  }

  showGameOver(score, message) {
    this.hideAllOverlays();
    this.messageEl.textContent = `${message} Final score: ${score}.`;
    this.gameOverScreen.classList.remove('hidden');
    this.gameOverScreen.setAttribute('aria-hidden', 'false');
    this.restartBtn?.focus();
  }
}
