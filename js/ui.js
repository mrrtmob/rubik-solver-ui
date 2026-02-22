// ==========================================
// COLOR DEFINITIONS
// ==========================================
export const FACE_COLORS = {
  U: { css: '#ffffff', hex: 0xffffff, name: 'White' },
  R: { css: '#c41e3a', hex: 0xc41e3a, name: 'Red' },
  F: { css: '#009b48', hex: 0x009b48, name: 'Green' },
  D: { css: '#ffd500', hex: 0xffd500, name: 'Yellow' },
  L: { css: '#ff5800', hex: 0xff5800, name: 'Orange' },
  B: { css: '#0051a2', hex: 0x0051a2, name: 'Blue' },
  X: { css: '#222222', hex: 0x222222, name: 'Empty' },
};

export const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
export const defaultStr = () => FACE_ORDER.map(f => f.repeat(9)).join('');

// ==========================================
// PALETTE
// ==========================================
export function buildPalette(selectedColor, onSelect) {
  const palette = document.getElementById('palette');
  palette.innerHTML = '';
  Object.entries(FACE_COLORS).forEach(([key, val]) => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (key === selectedColor ? ' selected' : '');
    sw.style.background = val.css;
    sw.title = val.name + ' (' + key + ')';
    sw.innerHTML = `<span>${key}</span>`;
    sw.onclick = () => onSelect(key);
    palette.appendChild(sw);
  });
}

// ==========================================
// FACE NET
// ==========================================
export function buildFaceNet(facelets, onPaint) {
  const net = document.getElementById('face-net');
  net.innerHTML = '';
  FACE_ORDER.forEach((face, fi) => {
    const grid = document.createElement('div');
    grid.className = 'face-grid ' + face;
    for (let i = 0; i < 9; i++) {
      const idx = fi * 9 + i;
      const cell = document.createElement('div');
      cell.className = 'facelet' + (i === 4 ? ' center' : '');
      cell.style.background = FACE_COLORS[facelets[idx]]?.css || '#222';
      cell.dataset.idx = idx;
      if (i !== 4) cell.onclick = () => onPaint(idx, cell);
      grid.appendChild(cell);
    }
    net.appendChild(grid);
  });
}

// ==========================================
// SOLUTION BOX
// ==========================================
export function showSolution(moves, onJump) {
  const box = document.getElementById('solution-box');
  box.className = 'has-solution';
  box.innerHTML = moves
    .map((m, i) => `<span class="move-token" data-i="${i}" onclick="window.__jumpToStep(${i})">${m}</span>`)
    .join('');
  window.__jumpToStep = onJump;
}

export function clearSolutionBox() {
  const box = document.getElementById('solution-box');
  box.className = '';
  box.innerHTML = 'No solution yet. Paint or scramble the cube, then hit SOLVE.';
  document.getElementById('solve-time').textContent = '';
}

export function showError(msg) {
  const box = document.getElementById('solution-box');
  box.className = 'error';
  box.textContent = '⚠ ' + msg;
}

export function highlightMove(step) {
  document.querySelectorAll('.move-token').forEach((el, i) => {
    el.className = 'move-token' + (i < step ? ' done' : i === step ? ' current' : '');
  });
}

export function updateStepCounter(current, total) {
  const el = document.getElementById('step-counter');
  el.textContent = total === 0 ? '— / —' : `${current + 1} / ${total}`;
}

export function updateProgress(current, total) {
  const fill = document.getElementById('progress-fill');
  fill.style.width = total === 0 ? '0%' : Math.max(0, ((current + 1) / total) * 100) + '%';
}

export function setSolveTime(ms) {
  document.getElementById('solve-time').textContent = ms !== null ? `(${ms}ms)` : '';
}

export function setSolveBtn(text, disabled) {
  const btn = document.getElementById('solve-btn');
  btn.textContent = text;
  btn.disabled = disabled;
}

export function setPlayBtn(text) {
  document.getElementById('play-btn').textContent = text;
}

export function updateFaceletStringInput(facelets) {
  document.getElementById('facelet-string').value = facelets.join('');
}
