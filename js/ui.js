import { ASSET_GUIDE, DEV_ASSET_BROWSER_ITEMS, GAME_CONFIG, LEADERBOARD_LIMIT } from './config.js';
import { normalizeInitialsInput } from './leaderboard.js';

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
    this.initialsScreen = document.getElementById('initialsScreen');
    this.leaderboardScreen = document.getElementById('leaderboardScreen');

    this.infoMainPanel = document.getElementById('infoMainPanel');
    this.debugAuthPanel = document.getElementById('debugAuthPanel');
    this.debugPanel = document.getElementById('debugPanel');
    this.infoList = document.getElementById('infoList');
    this.messageEl = document.getElementById('gameOverMessage');
    this.debugAssetBrowser = document.getElementById('debugAssetBrowser');

    this.startBtn = document.getElementById('startBtn');
    this.resumeBtn = document.getElementById('resumeBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.enterNameBtn = document.getElementById('enterNameBtn');
    this.closeInfoBtn = document.getElementById('closeInfoBtn');
    this.debugBtn = document.getElementById('debugBtn');
    this.debugAuthBackBtn = document.getElementById('debugAuthBackBtn');
    this.debugBackBtn = document.getElementById('debugBackBtn');
    this.debugUnlockBtn = document.getElementById('debugUnlockBtn');
    this.debugPasswordInput = document.getElementById('debugPasswordInput');
    this.debugAuthError = document.getElementById('debugAuthError');
    this.hitboxesToggle = document.getElementById('debugHitboxesToggle');
    this.tuningControls = document.getElementById('tuningControls');
    this.tuningResetBtn = document.getElementById('tuningResetBtn');
    this.tuningStatusBadge = document.getElementById('tuningStatusBadge');

    this.menuLeaderboardBtn = document.getElementById('menuLeaderboardBtn');
    this.gameOverLeaderboardBtn = document.getElementById('gameOverLeaderboardBtn');
    this.closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    this.leaderboardRows = document.getElementById('leaderboardRows');

    this.initialsInput = document.getElementById('initialsInput');
    this.initialsSaveBtn = document.getElementById('initialsSaveBtn');
    this.initialsSkipBtn = document.getElementById('initialsSkipBtn');
    this.initialsScoreEl = document.getElementById('initialsScoreValue');
    this.initialsHint = document.getElementById('initialsHint');

    this.overlays = [
      this.startScreen,
      this.pauseScreen,
      this.gameOverScreen,
      this.infoScreen,
      this.initialsScreen,
      this.leaderboardScreen
    ];

    this.scorePopTimer = null;
    this.bestPopTimer = null;
    this.toastTimer = null;
    this.onHitboxesToggle = null;
    this.onTuningChange = null;
    this.onTuningReset = null;
    this.onInitialsSubmit = null;
    this.onInitialsSkip = null;
    this.onEnterName = null;
    this.debugUnlocked = false;

    this.renderAssetGuide();
    this.renderDebugAssetBrowser();
    this.bindDebugControls();
    this.bindLeaderboardControls();
    this.bindInitialsControls();
  }

  bindDebugControls() {
    this.debugBtn?.addEventListener('click', () => this.openDebugAuth());
    this.debugAuthBackBtn?.addEventListener('click', () => this.showInfoMain());
    this.debugBackBtn?.addEventListener('click', () => this.showInfoMain());
    this.debugUnlockBtn?.addEventListener('click', () => this.tryUnlockDebug());
    this.debugPasswordInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.tryUnlockDebug();
    });
    this.hitboxesToggle?.addEventListener('change', () => {
      this.onHitboxesToggle?.(this.hitboxesToggle.checked);
    });
    this.tuningResetBtn?.addEventListener('click', () => this.onTuningReset?.());
  }

  bindLeaderboardControls() {
    this.menuLeaderboardBtn?.addEventListener('click', () => this.onOpenLeaderboard?.('menu'));
    this.gameOverLeaderboardBtn?.addEventListener('click', () => this.onOpenLeaderboard?.('game_over'));
    this.closeLeaderboardBtn?.addEventListener('click', () => this.onCloseLeaderboard?.());
  }

  bindInitialsControls() {
    this.initialsInput?.addEventListener('input', () => {
      const normalized = normalizeInitialsInput(this.initialsInput.value);
      this.initialsInput.value = normalized;
      this.initialsSaveBtn.disabled = normalized.length !== 3;
      if (normalized.length < 3 && this.initialsHint) {
        this.initialsHint.textContent = `Enter ${3 - normalized.length} more letter${normalized.length === 2 ? '' : 's'}.`;
      } else if (this.initialsHint) {
        this.initialsHint.textContent = 'Press Save Score to lock this run in the leaderboard.';
      }
    });

    this.initialsInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!this.initialsSaveBtn.disabled) this.submitInitials();
    });

    this.initialsSaveBtn?.addEventListener('click', () => this.submitInitials());
    this.initialsSkipBtn?.addEventListener('click', () => this.onInitialsSkip?.());
  }

  submitInitials() {
    const initials = normalizeInitialsInput(this.initialsInput?.value ?? '');
    if (initials.length !== 3) return;
    this.onInitialsSubmit?.(initials);
  }

  setInitialsSubmitHandler(handler) {
    this.onInitialsSubmit = handler;
  }

  setInitialsSkipHandler(handler) {
    this.onInitialsSkip = handler;
  }

  setGameOverHandlers({ onEnterName } = {}) {
    this.onEnterName = onEnterName ?? null;
    this.enterNameBtn?.addEventListener('click', () => this.onEnterName?.());
  }

  setLeaderboardHandlers({ onOpenLeaderboard, onCloseLeaderboard }) {
    this.onOpenLeaderboard = onOpenLeaderboard;
    this.onCloseLeaderboard = onCloseLeaderboard;
  }

  isNameEntryActive() {
    return !this.initialsScreen?.classList.contains('hidden');
  }

  setHitboxes(enabled) {
    if (this.hitboxesToggle) this.hitboxesToggle.checked = enabled;
  }

  setDebugHandlers({ onHitboxesToggle, onTuningChange, onTuningReset } = {}) {
    this.onHitboxesToggle = onHitboxesToggle ?? null;
    this.onTuningChange = onTuningChange ?? null;
    this.onTuningReset = onTuningReset ?? null;
  }

  renderTuningControls(settings) {
    if (!this.tuningControls) return;
    this.tuningControls.innerHTML = '';
    let activeGroup = '';

    settings.forEach((setting) => {
      if (setting.group !== activeGroup) {
        const heading = document.createElement('small');
        heading.textContent = setting.group;
        this.tuningControls.append(heading);
        activeGroup = setting.group;
      }

      const row = document.createElement('label');
      row.className = 'tuning-row';
      const valueDisplay = setting.type === 'toggle' ? (setting.value ? 'ON' : 'OFF') : Number(setting.value).toFixed(setting.step >= 1 ? 0 : 2);
      row.innerHTML = `
        <div class="tuning-row-head">
          <span>${setting.label}</span>
          <strong>${valueDisplay}</strong>
        </div>
        ${
          setting.type === 'toggle'
            ? `<input type="checkbox" data-setting-key="${setting.key}" ${setting.value ? 'checked' : ''} />`
            : `<input type="range" data-setting-key="${setting.key}" min="${setting.min}" max="${setting.max}" step="${setting.step}" value="${setting.value}" />`
        }
      `;

      const input = row.querySelector('input');
      input?.addEventListener('input', () => {
        const value = setting.type === 'toggle' ? input.checked : Number(input.value);
        this.onTuningChange?.(setting.key, value);
      });
      this.tuningControls.append(row);
    });
  }

  setTuningOverrideStatus(active) {
    if (!this.tuningStatusBadge) return;
    this.tuningStatusBadge.textContent = active ? 'Local Overrides Active' : 'Defaults Active';
    this.tuningStatusBadge.classList.toggle('active', active);
  }

  resetInfoPanels() {
    this.showInfoMain();
    if (this.debugPasswordInput) this.debugPasswordInput.value = '';
    if (this.debugAuthError) this.debugAuthError.textContent = '';
    if (this.infoList) this.infoList.scrollTop = 0;
    if (this.debugAssetBrowser) this.debugAssetBrowser.scrollTop = 0;
  }

  showInfoMain() {
    this.infoMainPanel?.classList.remove('hidden');
    this.debugAuthPanel?.classList.add('hidden');
    this.debugPanel?.classList.add('hidden');
  }

  openDebugAuth() {
    this.infoMainPanel?.classList.add('hidden');
    this.debugPanel?.classList.add('hidden');
    this.debugAuthPanel?.classList.remove('hidden');
    if (this.debugPasswordInput) {
      this.debugPasswordInput.value = '';
      this.debugPasswordInput.focus();
    }
    if (this.debugAuthError) this.debugAuthError.textContent = '';
  }

  tryUnlockDebug() {
    const entered = this.debugPasswordInput?.value?.trim() ?? '';
    if (entered !== GAME_CONFIG.debug.password) {
      if (this.debugAuthError) this.debugAuthError.textContent = 'Incorrect password.';
      this.debugUnlocked = false;
      return;
    }
    this.debugUnlocked = true;
    if (this.debugAuthError) this.debugAuthError.textContent = '';
    this.debugAuthPanel?.classList.add('hidden');
    this.infoMainPanel?.classList.add('hidden');
    this.debugPanel?.classList.remove('hidden');
    this.debugBackBtn?.focus();
  }

  renderAssetGuide() {
    if (!this.infoList) return;
    this.infoList.innerHTML = '';

    const grouped = ASSET_GUIDE.reduce((acc, item) => {
      const category = item.name.includes('Train') || item.name.includes('Max')
        ? 'Transit Hazards'
        : item.name.includes('Pickle')
          ? 'Collectibles'
          : item.name.includes('Fig')
            ? 'Player'
            : item.name.includes('Tile')
              ? 'Terrain'
              : 'World Objects';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    for (const [category, items] of Object.entries(grouped)) {
      const section = document.createElement('section');
      section.className = 'dev-asset-category';
      section.innerHTML = `<h4>${category}</h4>`;

      const list = document.createElement('div');
      list.className = 'dev-asset-list';
      for (const item of items) {
        const row = document.createElement('article');
        row.className = 'info-item';
        row.innerHTML = `
          <img src="${item.preview}" alt="${item.name} preview" loading="lazy" />
          <div>
            <h3>${item.name} <span class="badge badge-${item.action}">${item.action}</span></h3>
            ${item.description ? `<p>${item.description}</p>` : ''}
          </div>
        `;
        list.append(row);
      }
      section.append(list);
      this.infoList.append(section);
    }
  }

  renderDebugAssetBrowser() {
    if (!this.debugAssetBrowser) return;
    this.debugAssetBrowser.innerHTML = '';

    const grouped = DEV_ASSET_BROWSER_ITEMS.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    for (const [category, items] of Object.entries(grouped)) {
      const section = document.createElement('section');
      section.className = 'dev-asset-category';
      section.innerHTML = `<h4>${category}</h4>`;

      const list = document.createElement('div');
      list.className = 'dev-asset-list';

      for (const item of items) {
        const card = document.createElement('article');
        card.className = 'dev-asset-item';
        const canPreview = item.path.startsWith('assets/');
        const displayKey = item.key === 'coin' ? 'pickle' : item.key;
        const displayPath = item.key === 'coin' ? 'assets/collectibles/pickle.png' : item.path;
        card.innerHTML = `
          <div class="dev-asset-preview">
            ${canPreview ? `<img src="${item.path}" alt="${item.label} preview" loading="lazy" />` : '<span class="dev-asset-preview-fallback">n/a</span>'}
          </div>
          <div>
            <h5>${item.label} <span class="badge badge-${item.interactionType}">${item.interactionType}</span></h5>
            <p><strong>Key:</strong> ${displayKey}</p>
            <p><strong>Path:</strong> ${displayPath}</p>
            ${item.description ? `<p>${item.description}</p>` : ''}
          </div>
        `;
        list.append(card);
      }

      section.append(list);
      this.debugAssetBrowser.append(section);
    }
  }

  renderLeaderboard(entries, highlightId = null) {
    if (!this.leaderboardRows) return;
    this.leaderboardRows.innerHTML = '';

    const normalized = Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => {
      const value = entries[index];
      if (!value) return { initials: '---', score: 0, id: `placeholder-${index}`, placeholder: true };
      return value;
    });

    normalized.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      if (highlightId && entry.id === highlightId) row.classList.add('is-new');
      if (entry.placeholder) row.classList.add('is-empty');
      row.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span class="leaderboard-initials">${entry.initials}</span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      this.leaderboardRows.append(row);
    });
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
      overlay?.classList.add('hidden');
      overlay?.setAttribute('aria-hidden', 'true');
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
    if (show) {
      this.hideAllOverlays();
      this.infoScreen.classList.remove('hidden');
      this.infoScreen.setAttribute('aria-hidden', 'false');
      this.resetInfoPanels();
      this.closeInfoBtn?.focus();
      return;
    }
    this.infoScreen.classList.add('hidden');
    this.infoScreen.setAttribute('aria-hidden', 'true');
  }

  showGameOver(score, message, { canEnterName = false } = {}) {
    this.hideAllOverlays();
    this.messageEl.textContent = `${message} Final score: ${score}.`;
    this.enterNameBtn?.classList.toggle('hidden', !canEnterName);
    if (this.restartBtn) this.restartBtn.textContent = canEnterName ? 'New Game' : 'Play Again';
    this.gameOverScreen.classList.remove('hidden');
    this.gameOverScreen.setAttribute('aria-hidden', 'false');
    if (canEnterName) this.enterNameBtn?.focus();
    else this.restartBtn?.focus();
  }

  showInitialsEntry(score) {
    this.hideAllOverlays();
    if (this.initialsScoreEl) this.initialsScoreEl.textContent = String(score);
    if (this.initialsInput) {
      this.initialsInput.value = '';
      this.initialsInput.focus();
    }
    if (this.initialsSaveBtn) this.initialsSaveBtn.disabled = true;
    if (this.initialsHint) this.initialsHint.textContent = 'Enter your 3-letter arcade initials.';
    this.initialsScreen.classList.remove('hidden');
    this.initialsScreen.setAttribute('aria-hidden', 'false');
  }

  showLeaderboard() {
    this.hideAllOverlays();
    this.leaderboardScreen.classList.remove('hidden');
    this.leaderboardScreen.setAttribute('aria-hidden', 'false');
    this.closeLeaderboardBtn?.focus();
  }
}
