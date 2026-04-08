import { Game } from './game.js';
import { InputManager } from './input.js';
import { UIController } from './ui.js';
import { AudioSystem } from './audio.js';
import { GAME_STATES, STORAGE_KEYS } from './config.js';

const canvas = document.getElementById('gameCanvas');
const ui = new UIController();
const audio = new AudioSystem(STORAGE_KEYS.muted);
const game = new Game({ canvas, audio, ui });

const muteBtn = document.getElementById('muteBtn');
const infoBtn = document.getElementById('infoBtn');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resumeBtn = document.getElementById('resumeBtn');
const superJumpBtn = document.getElementById('superJumpBtn');

let infoPausedRun = false;

const syncMuteButton = () => {
  muteBtn.textContent = audio.isMuted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(audio.isMuted));
};
syncMuteButton();

muteBtn.addEventListener('click', () => {
  audio.toggleMute();
  audio.play('ui');
  syncMuteButton();
});

const setInfoOpen = (isOpen) => {
  if (isOpen) {
    if (game.state === GAME_STATES.PLAYING) {
      game.setState(GAME_STATES.PAUSED);
      infoPausedRun = true;
    }
    ui.showInfo(true);
  } else {
    ui.showInfo(false);
    if (infoPausedRun && game.state === GAME_STATES.PAUSED) game.setState(GAME_STATES.PLAYING);
    infoPausedRun = false;
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
  event.preventDefault();
  const hidden = ui.infoScreen.classList.contains('hidden');
  setInfoOpen(hidden);
});

const beginRun = () => {
  game.start();
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

superJumpBtn?.addEventListener('click', () => {
  game.useSuperJump();
});

const input = new InputManager({
  canvas,
  touchContainer: document.querySelector('.touch-controls'),
  onMove: (dir) => game.move(dir),
  onSuperJump: () => game.useSuperJump(),
  onToggleDebug: () => game.toggleCollisionDebug(),
  onPause: () => {
    if (game.state === GAME_STATES.MENU || game.state === GAME_STATES.GAME_OVER || !ui.infoScreen.classList.contains('hidden')) return;
    game.togglePause();
    ui.showPause(game.state === GAME_STATES.PAUSED);
    audio.play('ui');
  }
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
