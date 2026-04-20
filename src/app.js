/**
 * App Controller — Wires TM Engine + Renderer + User Input
 */
import './styles.css';
import { MultiTapeTuringMachine, decToBin, binToDec, STATES } from './turing-machine.js';
import { Renderer, initBackground } from './renderer.js';

// ---- State ----
let tm = new MultiTapeTuringMachine();
let renderer;
let isPlaying = false;
let playInterval = null;
let speed = 500;
let currentViewStep = 0; // Which history step we're viewing
let inputMode = 'binary'; // 'binary' or 'decimal'

// ---- DOM References ----
const inputA = document.getElementById('input-a');
const inputB = document.getElementById('input-b');
const previewA = document.getElementById('preview-a');
const previewB = document.getElementById('preview-b');
const btnLoad = document.getElementById('btn-load');
const btnReset = document.getElementById('btn-reset');
const btnStepBack = document.getElementById('btn-step-back');
const btnPlay = document.getElementById('btn-play');
const btnStepFwd = document.getElementById('btn-step-fwd');
const btnFastFwd = document.getElementById('btn-fast-fwd');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const modeBtns = document.querySelectorAll('.mode-btn');
const exampleChips = document.querySelectorAll('.example-chip');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initBackground();
  renderer = new Renderer();
  console.log('TM Simulator: Renderer initialized');
  bindEvents();
  updateInputPreviews();

  // Hide preloader
  setTimeout(() => {
    document.getElementById('preloader').classList.add('hide');
  }, 800);
});

// ---- Event Binding ----
function bindEvents() {
  btnLoad.addEventListener('click', handleLoad);
  btnReset.addEventListener('click', handleReset);
  btnStepBack.addEventListener('click', handleStepBack);
  btnPlay.addEventListener('click', handlePlayPause);
  btnStepFwd.addEventListener('click', handleStepForward);
  btnFastFwd.addEventListener('click', handleFastForward);

  speedSlider.addEventListener('input', () => {
    speed = parseInt(speedSlider.value);
    speedValue.textContent = speed + 'ms';
    if (isPlaying) {
      clearInterval(playInterval);
      playInterval = setInterval(autoStep, speed);
    }
  });

  // Mode toggle
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      inputMode = btn.dataset.mode;
      inputA.placeholder = inputMode === 'binary' ? 'e.g. 1011' : 'e.g. 11';
      inputB.placeholder = inputMode === 'binary' ? 'e.g. 1101' : 'e.g. 13';
      inputA.value = '';
      inputB.value = '';
      updateInputPreviews();
    });
  });

  // Example chips
  exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Switch to binary mode
      modeBtns.forEach(b => b.classList.remove('active'));
      document.getElementById('mode-binary').classList.add('active');
      inputMode = 'binary';
      inputA.placeholder = 'e.g. 1011';
      inputB.placeholder = 'e.g. 1101';

      inputA.value = chip.dataset.a;
      inputB.value = chip.dataset.b;
      updateInputPreviews();
    });
  });

  // Input previews
  inputA.addEventListener('input', updateInputPreviews);
  inputB.addEventListener('input', updateInputPreviews);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if focused on input fields
    if (e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        handlePlayPause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleStepForward();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handleStepBack();
        break;
      case 'KeyR':
        handleReset();
        break;
    }
  });
}

// ---- Input Previews ----
function updateInputPreviews() {
  const a = inputA.value.trim();
  const b = inputB.value.trim();

  if (inputMode === 'binary') {
    if (a && /^[01]+$/.test(a)) {
      previewA.innerHTML = `= <span>${binToDec(a)}</span> (decimal)`;
    } else {
      previewA.textContent = a ? 'Invalid binary' : '';
    }
    if (b && /^[01]+$/.test(b)) {
      previewB.innerHTML = `= <span>${binToDec(b)}</span> (decimal)`;
    } else {
      previewB.textContent = b ? 'Invalid binary' : '';
    }
  } else {
    if (a && /^\d+$/.test(a)) {
      previewA.innerHTML = `= <span>${decToBin(a)}</span> (binary)`;
    } else {
      previewA.textContent = a ? 'Invalid decimal' : '';
    }
    if (b && /^\d+$/.test(b)) {
      previewB.innerHTML = `= <span>${decToBin(b)}</span> (binary)`;
    } else {
      previewB.textContent = b ? 'Invalid decimal' : '';
    }
  }
}

// ---- Handlers ----
function handleLoad() {
  let a = inputA.value.trim();
  let b = inputB.value.trim();

  if (!a || !b) {
    shakeElement(btnLoad);
    return;
  }

  // Convert decimal to binary if needed
  if (inputMode === 'decimal') {
    a = decToBin(a);
    b = decToBin(b);
    if (!a || !b) {
      shakeElement(btnLoad);
      return;
    }
  }

  // Validate binary
  if (!/^[01]+$/.test(a) || !/^[01]+$/.test(b)) {
    shakeElement(btnLoad);
    return;
  }

  // Reset and load
  stopPlaying();
  tm = new MultiTapeTuringMachine();
  tm.load(a, b);

  currentViewStep = 0;

  // Show tapes
  renderer.showTapes(true);
  renderer.hideResult();
  renderer.clearLog();
  renderer.renderSnapshot(tm.getSnapshot(0), false);

  // Enable controls
  setControlsEnabled(true);
  updateControlButtons();
}

function handleReset() {
  if (!tm.inputA) return;
  stopPlaying();
  tm.load(tm.inputA, tm.inputB);
  currentViewStep = 0;

  renderer.hideResult();
  renderer.clearLog();
  renderer.renderSnapshot(tm.getSnapshot(0), false);
  updateControlButtons();
}

function handleStepForward() {
  if (tm.halted && currentViewStep >= tm.history.length - 1) return;

  // If we're viewing a past step, just move forward in history
  if (currentViewStep < tm.history.length - 1) {
    currentViewStep++;
    const snap = tm.getSnapshot(currentViewStep);
    renderer.renderSnapshot(snap, false);
    renderer.highlightLogEntry(currentViewStep);
    updateControlButtons();
    return;
  }

  // Otherwise, execute a new step
  const snap = tm.step();
  if (snap) {
    currentViewStep = snap.stepNumber;
    renderer.renderSnapshot(snap, isPlaying);
    renderer.addLogEntry(snap, true);
    updateControlButtons();

    if (tm.halted) {
      stopPlaying();
      renderer.showResult(tm.getResult());
      renderer.updateStatus(snap, false);
    }
  }
}

function handleStepBack() {
  if (currentViewStep <= 0) return;
  currentViewStep--;
  const snap = tm.getSnapshot(currentViewStep);
  renderer.renderSnapshot(snap, false);
  renderer.highlightLogEntry(currentViewStep);
  updateControlButtons();
}

function handlePlayPause() {
  if (!tm.inputA) return;

  if (isPlaying) {
    stopPlaying();
  } else {
    startPlaying();
  }
  updateControlButtons();
}

function handleFastForward() {
  if (tm.halted) return;
  stopPlaying();

  // Run to completion
  let snap;
  while (!tm.halted) {
    snap = tm.step();
    if (snap) {
      renderer.addLogEntry(snap, false);
    }
  }

  if (snap) {
    currentViewStep = snap.stepNumber;
    renderer.renderSnapshot(snap, false);
    renderer.addLogEntry(snap, true);
    renderer.showResult(tm.getResult());
    updateControlButtons();
  }
}

// ---- Playback Controls ----
function startPlaying() {
  if (tm.halted) return;
  isPlaying = true;
  playInterval = setInterval(autoStep, speed);
  btnPlay.textContent = '⏸';
  btnPlay.classList.add('playing');
}

function stopPlaying() {
  isPlaying = false;
  if (playInterval) clearInterval(playInterval);
  playInterval = null;
  btnPlay.textContent = '▶';
  btnPlay.classList.remove('playing');
}

function autoStep() {
  if (tm.halted) {
    stopPlaying();
    updateControlButtons();
    return;
  }

  // If viewing a past step, catch up first
  if (currentViewStep < tm.history.length - 1) {
    currentViewStep++;
    const snap = tm.getSnapshot(currentViewStep);
    renderer.renderSnapshot(snap, isPlaying);
    renderer.highlightLogEntry(currentViewStep);
    return;
  }

  const snap = tm.step();
  if (snap) {
    currentViewStep = snap.stepNumber;
    renderer.renderSnapshot(snap, isPlaying);
    renderer.addLogEntry(snap, true);

    if (tm.halted) {
      stopPlaying();
      renderer.showResult(tm.getResult());
      renderer.updateStatus(snap, false);
      updateControlButtons();
    }
  }
}

// ---- UI Helpers ----
function setControlsEnabled(enabled) {
  btnReset.disabled = !enabled;
  btnStepBack.disabled = !enabled;
  btnPlay.disabled = !enabled;
  btnStepFwd.disabled = !enabled;
  btnFastFwd.disabled = !enabled;
}

function updateControlButtons() {
  btnStepBack.disabled = currentViewStep <= 0;
  btnStepFwd.disabled = tm.halted && currentViewStep >= tm.history.length - 1;
  btnFastFwd.disabled = tm.halted;
  btnPlay.disabled = tm.halted && currentViewStep >= tm.history.length - 1;

  if (tm.halted && !isPlaying) {
    btnPlay.textContent = '▶';
    btnPlay.classList.remove('playing');
  }
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight; // trigger reflow
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => { el.style.animation = ''; }, 400);
}

// Add shake keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);
