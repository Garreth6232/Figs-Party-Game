import { Game } from './game.js';
import { InputManager } from './input.js';
import { UIController } from './ui.js';
import { AudioSystem } from './audio.js';
import { STORAGE_KEYS } from './config.js';

const canvas = document.getElementById('gameCanvas');
const ui = new UIController();
const audio = new AudioSystem(STORAGE_KEYS.muted);
const game = new Game({ canvas, audio, ui });

const muteBtn = document.getElementById('muteBtn');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resumeBtn = document.getElementById('resumeBtn');

const syncMuteButton = () => {
  muteBtn.textContent = audio.isMuted ? '🔇' : '🔊';
};
syncMuteButton();

muteBtn.addEventListener('click', () => {
  audio.toggleMute();
  audio.play('ui');
  syncMuteButton();
});

const beginRun = () => {
  game.start();
  ui.hideAllOverlays();
  audio.play('ui');
};
startBtn.addEventListener('click', beginRun);
restartBtn.addEventListener('click', beginRun);
resumeBtn.addEventListener('click', () => {
  game.togglePause();
  ui.showPause(false);
  audio.play('ui');
});

const input = new InputManager({
  canvas,
  touchContainer: document.querySelector('.touch-controls'),
  onMove: (dir) => game.move(dir),
  onPause: () => {
    if (game.state === 'start' || game.state === 'dead') return;
    game.togglePause();
    ui.showPause(game.state === 'paused');
    audio.play('ui');
  }
});
input.bind();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  if (game.state === 'dead') {
    ui.showPause(false);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

ui.showStart();
