import { Game } from './game.js';
import { InputManager, InputSequenceDetector } from './input.js';
import { UIController } from './ui.js';
import { AudioSystem } from './audio.js';
import { GAME_CONFIG, GAME_STATES, STORAGE_KEYS } from './config.js';
import { LeaderboardStore } from './leaderboard.js';

const canvas = document.getElementById('gameCanvas');
const ui = new UIController();
const audio = new AudioSystem(STORAGE_KEYS.muted);
const leaderboard = new LeaderboardStore(STORAGE_KEYS.leaderboard);

let lastGameOver = { score: 0, message: 'Run ended.' };
let leaderboardReturnScreen = 'menu';
let latestLeaderboardEntryId = null;
let pendingLeaderboardEntry = false;

const game = new Game({
  canvas,
  audio,
  ui,
  onGameOver: ({ score, message }) => {
    lastGameOver = { score, message };
    pendingLeaderboardEntry = leaderboard.qualifies(score);
    ui.showGameOver(score, message, { canEnterName: pendingLeaderboardEntry });
    if (!pendingLeaderboardEntry) latestLeaderboardEntryId = null;
  }
});

const muteBtn = document.getElementById('muteBtn');
const infoBtn = document.getElementById('infoBtn');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resumeBtn = document.getElementById('resumeBtn');

let infoPausedRun = false;
let infoReturnScreen = 'start';

const openLeaderboard = (fromScreen) => {
  leaderboardReturnScreen = fromScreen;
  const entries = leaderboard.getEntries();
  ui.renderLeaderboard(entries, latestLeaderboardEntryId);
  ui.showLeaderboard();
  audio.play('ui');
};

ui.setInitialsSubmitHandler((initials) => {
  const result = leaderboard.addEntry(initials, lastGameOver.score);
  latestLeaderboardEntryId = result.entry.id;
  pendingLeaderboardEntry = false;
  ui.renderLeaderboard(result.entries, latestLeaderboardEntryId);
  ui.showLeaderboard();
  audio.play('ui');
});

ui.setInitialsSkipHandler(() => {
  pendingLeaderboardEntry = false;
  beginRun();
});

ui.setGameOverHandlers({
  onEnterName: () => {
    if (!pendingLeaderboardEntry) return;
    ui.showInitialsEntry(lastGameOver.score);
    audio.play('ui');
  }
});

ui.setLeaderboardHandlers({
  onOpenLeaderboard: (origin) => {
    openLeaderboard(origin);
  },
  onCloseLeaderboard: () => {
    if (leaderboardReturnScreen === 'game_over' || game.state === GAME_STATES.GAME_OVER) {
      ui.showGameOver(lastGameOver.score, lastGameOver.message, { canEnterName: pendingLeaderboardEntry });
    } else {
      ui.showStart();
    }
    audio.play('ui');
  }
});

const syncMuteButton = () => {
  muteBtn.textContent = audio.isMuted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(audio.isMuted));
};
syncMuteButton();
ui.setDebugHandlers({
  onHitboxesToggle: (enabled) => game.setCollisionDebug(enabled)
});
ui.setHitboxes(game.collisionSystem.debugEnabled);

muteBtn.addEventListener('click', () => {
  audio.toggleMute();
  audio.play('ui');
  syncMuteButton();
});

const setInfoOpen = (isOpen) => {
  if (isOpen) {
    if (!ui.leaderboardScreen.classList.contains('hidden')) infoReturnScreen = 'leaderboard';
    else if (!ui.gameOverScreen.classList.contains('hidden')) infoReturnScreen = 'game_over';
    else if (!ui.pauseScreen.classList.contains('hidden')) infoReturnScreen = 'pause';
    else infoReturnScreen = 'start';
    if (game.state === GAME_STATES.PLAYING) {
      game.setState(GAME_STATES.PAUSED);
      infoPausedRun = true;
    }
    ui.showInfo(true);
  } else {
    ui.showInfo(false);
    if (infoPausedRun && game.state === GAME_STATES.PAUSED) game.setState(GAME_STATES.PLAYING);
    if (!infoPausedRun) {
      if (infoReturnScreen === 'leaderboard') ui.showLeaderboard();
      else if (infoReturnScreen === 'game_over') ui.showGameOver(lastGameOver.score, lastGameOver.message, { canEnterName: pendingLeaderboardEntry });
      else if (infoReturnScreen === 'pause') ui.showPause(true);
      else ui.showStart();
    }
    infoPausedRun = false;
    infoReturnScreen = 'start';
  }
};

infoBtn.addEventListener('click', () => {
  setInfoOpen(true);
  audio.play('ui');
});

closeInfoBtn.addEventListener('click', () => {
  setInfoOpen(false);
  audio.play('ui');
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyI') return;
  if (ui.isNameEntryActive()) return;
  event.preventDefault();
  const hidden = ui.infoScreen.classList.contains('hidden');
  setInfoOpen(hidden);
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape') return;
  if (ui.infoScreen.classList.contains('hidden')) return;
  event.preventDefault();
  setInfoOpen(false);
});

const beginRun = () => {
  game.start();
  pendingLeaderboardEntry = false;
  latestLeaderboardEntryId = null;
  ui.hideAllOverlays();
  audio.play('ui');
};
startBtn.addEventListener('click', beginRun);
restartBtn.addEventListener('click', beginRun);

resumeBtn.addEventListener('click', () => {
  if (game.state !== GAME_STATES.PAUSED || ui.pauseScreen.classList.contains('hidden')) return;
  game.togglePause();
  ui.showPause(false);
  audio.play('ui');
});

const input = new InputManager({
  canvas,
  touchContainer: document.querySelector('.touch-controls'),
  sequenceBindings: [
    {
      detector: new InputSequenceDetector(GAME_CONFIG.cheats.keyboardSequence, () => game.activateCheatCoins()),
      shouldListen: () => game.state === GAME_STATES.PLAYING
    }
  ],
  onMove: (dir) => game.move(dir),
  onSuperJump: () => game.useSuperJump(),
  onToggleDebug: () => {
    const enabled = game.toggleCollisionDebug();
    ui.setHitboxes(enabled);
  },
  onToggleTerrainDebug: () => {
    game.toggleTerrainDebug();
  },
  onPause: () => {
    if (game.state === GAME_STATES.MENU || game.state === GAME_STATES.GAME_OVER || !ui.infoScreen.classList.contains('hidden')) return;
    game.togglePause();
    ui.showPause(game.state === GAME_STATES.PAUSED);
    audio.play('ui');
  },
  shouldCaptureKeyboard: () => ui.isNameEntryActive()
});
input.bind();

let last = performance.now();
let loopId = null;
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  if (game.state === GAME_STATES.GAME_OVER) ui.showPause(false);
  loopId = requestAnimationFrame(loop);
}

if (!loopId) loopId = requestAnimationFrame(loop);
ui.showStart();
