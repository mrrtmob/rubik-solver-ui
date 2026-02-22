import {
  FACE_COLORS, FACE_ORDER, defaultStr,
  buildPalette, buildFaceNet,
  showSolution, clearSolutionBox, showError, highlightMove,
  updateStepCounter, updateProgress, setSolveTime,
  setSolveBtn, setPlayBtn, updateFaceletStringInput,
} from './ui.js';

import {
  initThree, resetCamera, resetThreeCubeState,
  setColorsFromString, enqueueMove,
} from './three-cube.js';

import { initScanner } from './camera-scanner.js';

// ==========================================
// LOAD rubik-solver FROM CDN
// ==========================================
let Cube, initSolver, solve, scramble;

// ==========================================
// STATE
// ==========================================
let currentCube = null;
let facelets = defaultStr().split('');
let selectedColor = 'U';
let solutionMoves = [];
let currentStep = -1;
let playInterval = null;

// ==========================================
// HELPERS
// ==========================================
function getSpeed() {
  return parseInt(document.getElementById('speed-slider').value);
}

function syncCubeFromFacelets() {
  try {
    currentCube = Cube.fromString(facelets.join(''));
  } catch {
    currentCube = null;
  }
}

function refreshThree() {
  setColorsFromString(facelets.join(''));
}

// ==========================================
// PAINT
// ==========================================
function onPaint(idx, cell) {
  facelets[idx] = selectedColor;
  cell.style.background = FACE_COLORS[selectedColor]?.css || '#222';
  updateFaceletStringInput(facelets);
  syncCubeFromFacelets();
  stopPlay();
  solutionMoves = []; currentStep = -1;
  clearSolutionBox();
  updateStepCounter(-1, 0);
  updateProgress(-1, 0);
  resetThreeCubeState();
  refreshThree();
}

// ==========================================
// SCRAMBLE & RESET
// ==========================================
window.resetCube = function () {
  facelets = defaultStr().split('');
  currentCube = new Cube();
  solutionMoves = []; currentStep = -1;
  stopPlay();
  buildFaceNet(facelets, onPaint);
  updateFaceletStringInput(facelets);
  clearSolutionBox();
  updateStepCounter(-1, 0);
  updateProgress(-1, 0);
  resetThreeCubeState();
  refreshThree();
};

window.clearCube = function () {
  facelets = Array(54).fill('X');
  FACE_ORDER.forEach((f, i) => { facelets[i * 9 + 4] = f; });
  buildFaceNet(facelets, onPaint);
  updateFaceletStringInput(facelets);
  stopPlay();
  solutionMoves = []; currentStep = -1;
  clearSolutionBox();
  updateStepCounter(-1, 0);
  updateProgress(-1, 0);
  resetThreeCubeState();
  refreshThree();
};

window.applyScramble = function () {
  const alg = document.getElementById('scramble-input').value.trim();
  if (!alg) return;
  window.resetCube();
  try {
    currentCube = new Cube();
    currentCube.move(alg);
    facelets = currentCube.asString().split('');
    buildFaceNet(facelets, onPaint);
    updateFaceletStringInput(facelets);
    refreshThree();
    clearSolutionBox();
  } catch (e) {
    showError('Invalid algorithm: ' + e.message);
  }
};

window.randomScramble = function () {
  const scr = scramble();
  document.getElementById('scramble-input').value = scr;
  window.applyScramble();
};

window.copyFaceletString = function () {
  navigator.clipboard.writeText(document.getElementById('facelet-string').value).catch(() => { });
};

window.loadFaceletString = function () {
  const val = document.getElementById('facelet-string').value.trim();
  if (val.length !== 54) { showError('String must be exactly 54 characters.'); return; }
  try {
    const cube = Cube.fromString(val);
    const v = cube.verify();
    if (v !== true) { showError(v); return; }
    facelets = val.split('');
    currentCube = cube;
    buildFaceNet(facelets, onPaint);
    stopPlay();
    solutionMoves = []; currentStep = -1;
    clearSolutionBox();
    updateStepCounter(-1, 0);
    updateProgress(-1, 0);
    resetThreeCubeState();
    refreshThree();
  } catch (e) {
    showError(e.message);
  }
};

// ==========================================
// SOLVER
// ==========================================
window.solveCube = function (autoPlay = false) {
  syncCubeFromFacelets();
  if (!currentCube) { showError('Invalid cube state.'); return; }

  const v = currentCube.verify();
  if (v !== true) { showError(v); return; }

  stopPlay();
  solutionMoves = []; currentStep = -1;
  setSolveTime(null);
  resetThreeCubeState();
  refreshThree();

  setSolveBtn('SOLVING...', true);
  if (autoPlay) setPlayBtn('SOLVING...');

  setTimeout(() => {
    try {
      const t0 = performance.now();
      const sol = solve(currentCube, 22);
      const ms = (performance.now() - t0).toFixed(1);

      setSolveBtn('SOLVE', false);
      if (autoPlay) setPlayBtn('▶ Play');

      if (sol === null) { showError('No solution found (cube may be invalid).'); return; }

      setSolveTime(ms);
      solutionMoves = sol.trim().split(/\s+/).filter(Boolean);
      currentStep = -1;

      if (solutionMoves.length === 0) {
        const box = document.getElementById('solution-box');
        box.className = 'has-solution';
        box.innerHTML = '<span style="color:var(--text);font-weight:bold;">Cube is already solved!</span>';
      } else {
        showSolution(solutionMoves, jumpToStep);
      }

      updateStepCounter(currentStep, solutionMoves.length);
      updateProgress(currentStep, solutionMoves.length);
      if (autoPlay && solutionMoves.length > 0) window.togglePlay();

    } catch (e) {
      setSolveBtn('SOLVE', false);
      if (autoPlay) setPlayBtn('▶ Play');
      showError('Solver error: ' + e.message);
    }
  }, 20);
};

// ==========================================
// PLAYBACK
// ==========================================
window.togglePlay = function () {
  if (playInterval) {
    stopPlay();
  } else {
    if (solutionMoves.length === 0) { window.solveCube(true); return; }
    if (currentStep >= solutionMoves.length - 1) jumpToStep(-1);
    setPlayBtn('❚❚ Pause');
    function playNext() {
      if (!playInterval) return;
      if (currentStep >= solutionMoves.length - 1) { stopPlay(); return; }
      stepForward(() => {
        if (!playInterval) return;
        playInterval = setTimeout(playNext, Math.max(50, getSpeed() - 380));
      });
    }
    playInterval = setTimeout(playNext, 0);
  }
};

function stopPlay() {
  if (playInterval) { clearTimeout(playInterval); playInterval = null; }
  setPlayBtn('▶ Play');
}

window.stepForward = function (onDone) {
  if (solutionMoves.length === 0 || currentStep >= solutionMoves.length - 1) {
    if (onDone) onDone(); return;
  }
  currentStep++;
  applyMoveToDisplay(solutionMoves[currentStep], onDone);
  highlightMove(currentStep);
  updateStepCounter(currentStep, solutionMoves.length);
  updateProgress(currentStep, solutionMoves.length);
};

// Also expose non-window version for internal use
function stepForward(onDone) { window.stepForward(onDone); }

window.stepBack = function () {
  if (solutionMoves.length === 0 || currentStep < 0) return;
  const inv = Cube.inverse(solutionMoves[currentStep]);
  currentStep--;
  applyMoveToDisplay(inv, null);
  highlightMove(currentStep);
  updateStepCounter(currentStep, solutionMoves.length);
  updateProgress(currentStep, solutionMoves.length);
};

function jumpToStep(targetStep) {
  if (solutionMoves.length === 0 && targetStep !== -1) return;
  stopPlay();
  syncCubeFromFacelets();
  resetThreeCubeState();
  for (let i = 0; i <= targetStep; i++) {
    currentCube.move(solutionMoves[i]);
    enqueueMove(solutionMoves[i], false, null);
  }
  currentStep = targetStep;
  setColorsFromString(currentCube.asString());
  highlightMove(currentStep);
  updateStepCounter(currentStep, solutionMoves.length);
  updateProgress(currentStep, solutionMoves.length);
}

function applyMoveToDisplay(move, onDone) {
  if (!currentCube) { if (onDone) onDone(); return; }
  currentCube.move(move);
  enqueueMove(move, true, onDone);
}

// ==========================================
// SPEED SLIDER
// ==========================================
document.getElementById('speed-slider').addEventListener('input', function () {
  document.getElementById('speed-label').textContent = (this.value / 1000).toFixed(1) + 's';
  if (playInterval) { stopPlay(); window.togglePlay(); }
});

// ==========================================
// CAMERA
// ==========================================
window.resetCamera = resetCamera;

// ==========================================
// BOOT
// ==========================================
window.addEventListener('load', () => {
  document.getElementById('loading-overlay').classList.remove('hidden');

  import('https://esm.sh/rubik-solver')
    .then(module => {
      Cube = module.Cube;
      initSolver = module.initSolver;
      solve = module.solve;
      scramble = module.scramble;

      function onPaletteSelect(key) {
        selectedColor = key;
        buildPalette(selectedColor, onPaletteSelect);
      }
      buildPalette(selectedColor, onPaletteSelect);
      buildFaceNet(facelets, onPaint);
      currentCube = new Cube();
      updateFaceletStringInput(facelets);
      initThree(getSpeed);
      refreshThree();

      setTimeout(() => {
        try { initSolver(); } catch (e) { console.error(e); }
        document.getElementById('loading-overlay').classList.add('hidden');
      }, 50);
    })
    .catch(err => {
      console.error('Failed to load rubik-solver:', err);
      document.querySelector('.loading-text').textContent = 'ERROR LOADING ENGINE';
    });
});

window.openScanner = function () {
  initScanner((faceletString) => {
    facelets = faceletString.split('');
    try { currentCube = Cube.fromString(faceletString); } catch { currentCube = null; }
    buildFaceNet(facelets, onPaint);
    updateFaceletStringInput(facelets);
    stopPlay();
    solutionMoves = []; currentStep = -1;
    clearSolutionBox();
    updateStepCounter(-1, 0);
    updateProgress(-1, 0);
    resetThreeCubeState();
    refreshThree();
    if (window.matchMedia('(max-width: 900px)').matches) {
      switchTab('setup');
    }
  });
};