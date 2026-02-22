/**
 * camera-scanner.js  — v2  (HSV-based color classifier)
 *
 * Key improvements over v1:
 *  • RGB → HSV conversion: hue is largely lighting-invariant
 *  • Priority-ordered classification:
 *      1. Black/dark  (low Value)
 *      2. White       (low Saturation + high Value)
 *      3. Yellow      (narrow hue band, beats orange)
 *      4. Orange      (hue band)
 *      5. Red         (wraps around 0°/360°)
 *      6. Green       (hue band)
 *      7. Blue        (hue band)
 *  • Large 28×28px average sample per cell instead of sparse 5-point
 *  • getImageData called once per cell (not 25 calls per cell)
 *  • willReadFrequently: true on canvas context (fixes the console warning)
 *  • Confidence indicator: dot gets bright border ring when signal is clear
 */

import { FACE_COLORS } from './ui.js';

// ─── CSS ─────────────────────────────────────────────────────────────────────
const SCANNER_CSS = `
#scanner-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: #050505;
  display: flex; flex-direction: column;
  font-family: 'Space Mono', monospace;
  color: #e0e0e0;
  animation: scannerSlideUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes scannerSlideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
#scanner-header {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #262626;
  background: rgba(5,5,5,0.95);
  backdrop-filter: blur(10px);
}
#scanner-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.4rem; letter-spacing: 4px; color: #fff;
}
#scanner-close {
  background: transparent; border: 1px solid #333; color: #aaa;
  font-family: 'Space Mono', monospace; font-size: 0.7rem;
  letter-spacing: 2px; padding: 6px 14px; border-radius: 4px; cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: all 0.2s;
}
#scanner-close:hover { border-color: #fff; color: #fff; }
#scanner-close:active { opacity: 0.6; }
#scanner-body {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; padding: 14px; overflow: hidden;
}
#scanner-viewfinder {
  position: relative;
  width: min(78vw, 320px);
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.7);
  flex-shrink: 0;
}
#scanner-video {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
#scanner-canvas { display: none; }
#scanner-grid {
  position: absolute; inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  pointer-events: none;
}
.sg-cell {
  border: 1px solid rgba(255,255,255,0.18);
  position: relative;
}
#scanner-grid::before, #scanner-grid::after {
  content: ''; position: absolute;
  width: 20px; height: 20px;
  border-color: #fff; border-style: solid; border-width: 0;
  pointer-events: none; z-index: 4;
}
#scanner-grid::before { top: 6px; left: 6px; border-top-width: 3px; border-left-width: 3px; border-radius: 2px 0 0 0; }
#scanner-grid::after  { bottom: 6px; right: 6px; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 2px 0; }
.sg-cell .color-dot {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2.5px solid rgba(0,0,0,0.5);
  box-shadow: 0 2px 10px rgba(0,0,0,0.7);
  background: #222;
  transition: background 0.15s, border-color 0.2s;
}
.sg-cell .color-dot.confident {
  border-color: rgba(255,255,255,0.75);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 2px 10px rgba(0,0,0,0.7);
}
.sg-cell .face-label {
  position: absolute; bottom: 3px; right: 5px;
  font-size: 0.5rem; font-weight: 700;
  color: rgba(255,255,255,0.8);
  text-shadow: 0 1px 3px #000; letter-spacing: 1px;
}
#face-selector {
  display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
}
.fs-btn {
  background: transparent; border: 1px solid #333; color: #666;
  font-family: 'Space Mono', monospace; font-size: 0.6rem;
  letter-spacing: 2px; padding: 6px 12px; border-radius: 4px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.15s; -webkit-tap-highlight-color: transparent;
}
.fs-btn .fs-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.3); flex-shrink: 0; }
.fs-btn.selected  { border-color: #fff; color: #fff; }
.fs-btn.done-face { opacity: 0.5; }
.fs-btn:active    { opacity: 0.65; }
#scanner-instruction {
  font-size: 0.58rem; letter-spacing: 1.5px; color: #555;
  text-align: center; line-height: 1.7; padding: 0 8px;
}
#scanner-progress { display: flex; gap: 8px; align-items: center; }
.sp-dot {
  width: 9px; height: 9px; border-radius: 50%;
  border: 1px solid #3a3a3a; background: #111; transition: all 0.2s;
}
.sp-dot.done   { background: #fff; border-color: #fff; }
.sp-dot.active { background: transparent; border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,0.25); }
#scanner-actions { display: flex; gap: 10px; width: 100%; }
#btn-capture {
  flex: 1; height: 52px; border-radius: 6px; cursor: pointer;
  background: #fff; border: 1px solid #fff; color: #000;
  font-family: 'Space Mono', monospace; font-size: 0.82rem;
  font-weight: 700; letter-spacing: 3px;
  transition: opacity 0.15s, background 0.2s, border-color 0.2s;
  -webkit-tap-highlight-color: transparent;
}
#btn-capture:active { opacity: 0.7; }
#btn-capture.apply-mode { background: #7ecfff; border-color: #7ecfff; }
#btn-retake {
  flex: 0 0 auto; height: 52px; padding: 0 16px; border-radius: 6px; cursor: pointer;
  background: transparent; border: 1px solid #333; color: #666;
  font-family: 'Space Mono', monospace; font-size: 0.7rem; letter-spacing: 2px;
  transition: all 0.15s; -webkit-tap-highlight-color: transparent;
}
#btn-retake:hover { border-color: #555; color: #aaa; }
#btn-retake:active { opacity: 0.6; }
#scanner-error {
  display: none; width: 100%;
  background: rgba(255,50,50,0.10); border: 1px solid rgba(255,50,50,0.35);
  color: #ff8888; font-size: 0.6rem; letter-spacing: 1px;
  border-radius: 4px; padding: 8px 14px; text-align: center; line-height: 1.55;
}
#scanner-error.visible { display: block; }
#scanner-viewfinder.captured::after {
  content: ''; position: absolute; inset: 0;
  background: rgba(255,255,255,0.22);
  animation: captureFlash 0.35s ease-out forwards;
  pointer-events: none; z-index: 10;
}
@keyframes captureFlash { 0% { opacity: 1; } 100% { opacity: 0; } }
@media (max-width: 900px) {
  #scanner-body { gap: 10px; padding: 10px 12px; }
  #scanner-viewfinder { width: min(80vw, 300px); }
  #btn-capture, #btn-retake { height: 54px; }
}
@media (max-width: 380px) {
  #scanner-viewfinder { width: min(84vw, 260px); }
  #btn-capture { font-size: 0.74rem; letter-spacing: 2px; }
}
`;

// ─── HSV Color Classifier ─────────────────────────────────────────────────────
//
// HSV is much more robust than raw RGB distance because:
//   • Hue is largely independent of brightness/exposure
//   • Saturation distinguishes vivid cube colors from white/grey
//   • Value detects dark shadows / inner plastic

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (d !== 0) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s, v };
}

/**
 * Classify averaged RGB → Rubik face key.
 * Rules are ordered from most-distinctive to least.
 */
function classifyColor(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);

    // 1. Very dark (inner plastic, deep shadow) — ignore
    if (v < 0.12) return 'X';

    // 2. White (U): low saturation + high brightness
    //    Camera white often has s up to ~0.30 under warm lighting
    if (s < 0.30 && v > 0.50) return 'U';

    // From here saturation is meaningful (s ≥ 0.30)

    // 3. Yellow (D): 38–70°  (beats orange which starts at 15°)
    if (h >= 38 && h <= 70 && s > 0.38) return 'D';

    // 4. Orange (L): 15–38°
    if (h >= 15 && h < 38 && s > 0.42) return 'L';

    // 5. Red (R): wraps — >330° or <15°
    if ((h >= 330 || h < 15) && s > 0.38) return 'R';

    // 6. Green (F): 90–165°
    if (h >= 90 && h <= 165 && s > 0.28) return 'F';

    // 7. Blue (B): 195–265°
    if (h >= 195 && h <= 265 && s > 0.28) return 'B';

    // Fallback: relaxed white check (overcast / blue-tinted camera)
    if (s < 0.40 && v > 0.45) return 'U';

    // Last resort: nearest hue
    return nearestHueFallback(h);
}

// Hue centers for each chromatic face
const HUE_CENTERS = { R: 0, L: 26, D: 54, F: 128, B: 228 };
function nearestHueFallback(h) {
    let best = 'U', bestDist = Infinity;
    for (const [key, center] of Object.entries(HUE_CENTERS)) {
        let dist = Math.abs(h - center);
        if (dist > 180) dist = 360 - dist;
        if (dist < bestDist) { bestDist = dist; best = key; }
    }
    return best;
}

/** Returns true if the classification is "confident" — used for dot border. */
function isConfident(r, g, b) {
    const { s, v } = rgbToHsv(r, g, b);
    if (v < 0.12) return false;
    if (s < 0.25 && v > 0.65) return true;  // clear white
    if (s > 0.55 && v > 0.40) return true;  // vivid saturated color
    return false;
}

// ─── Module state ─────────────────────────────────────────────────────────────
let video, canvas, ctx, stream;
let onFaceScannedCallback = null;
let selectedFace = 'U';
let scannedFaces = {};
const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
let sampledColors = null;
let sampledConfidence = null;
let sampleInterval = null;

// Half-size of the averaging box per cell in native camera pixels
const SAMPLE_HALF = 16;  // → 32×32 = 1024 pixels averaged per cell

// ─── Sampling ─────────────────────────────────────────────────────────────────
function sampleGrid() {
    if (!video || !canvas || video.readyState < 2) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;

    if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw; canvas.height = vh;
    }

    ctx.drawImage(video, 0, 0, vw, vh);

    const cellW = vw / 3, cellH = vh / 3;
    const colors = [], confidence = [];

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cx = Math.round(cellW * (col + 0.5));
            const cy = Math.round(cellH * (row + 0.5));

            const x1 = Math.max(0, cx - SAMPLE_HALF);
            const y1 = Math.max(0, cy - SAMPLE_HALF);
            const w = Math.min(vw, cx + SAMPLE_HALF) - x1;
            const h = Math.min(vh, cy + SAMPLE_HALF) - y1;
            if (w <= 0 || h <= 0) { colors.push('X'); confidence.push(false); continue; }

            const data = ctx.getImageData(x1, y1, w, h).data;
            let rSum = 0, gSum = 0, bSum = 0, n = 0;
            // Sample every other pixel (stride 2) = still ~256 samples per cell
            for (let i = 0; i < data.length; i += 8) {
                rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; n++;
            }
            const rAvg = rSum / n, gAvg = gSum / n, bAvg = bSum / n;

            colors.push(classifyColor(rAvg, gAvg, bAvg));
            confidence.push(isConfident(rAvg, gAvg, bAvg));
        }
    }

    sampledColors = colors;
    sampledConfidence = confidence;
    updateDots(colors, confidence);
}

function updateDots(colors, confidence) {
    document.querySelectorAll('.sg-cell').forEach((cell, i) => {
        const key = colors[i] || 'X';
        const dot = cell.querySelector('.color-dot');
        const label = cell.querySelector('.face-label');
        if (dot) {
            dot.style.background = FACE_COLORS[key]?.css || '#222';
            dot.classList.toggle('confident', !!confidence?.[i]);
        }
        if (label) label.textContent = key !== 'X' ? key : '';
    });
}

// ─── UI Builders ──────────────────────────────────────────────────────────────
function buildOverlay() {
    if (!document.getElementById('scanner-css')) {
        const style = document.createElement('style');
        style.id = 'scanner-css';
        style.textContent = SCANNER_CSS;
        document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = 'scanner-overlay';
    overlay.innerHTML = `
    <div id="scanner-header">
      <div id="scanner-title">SCAN CUBE</div>
      <button id="scanner-close">✕ CLOSE</button>
    </div>
    <div id="scanner-body">
      <div id="scanner-error"></div>
      <div id="scanner-viewfinder">
        <video id="scanner-video" autoplay playsinline muted></video>
        <canvas id="scanner-canvas"></canvas>
        <div id="scanner-grid">
          ${Array(9).fill(0).map(() =>
        `<div class="sg-cell"><div class="color-dot"></div><div class="face-label"></div></div>`
    ).join('')}
        </div>
      </div>
      <div id="face-selector"></div>
      <div id="scanner-progress">
        ${FACE_ORDER.map(f => `<div class="sp-dot" data-face="${f}"></div>`).join('')}
      </div>
      <div id="scanner-instruction">Point camera at one face · Hold steady · Tap CAPTURE</div>
      <div id="scanner-actions">
        <button id="btn-retake">RETAKE</button>
        <button id="btn-capture">CAPTURE FACE</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);

    video = overlay.querySelector('#scanner-video');
    canvas = overlay.querySelector('#scanner-canvas');
    // willReadFrequently avoids the repeated-readback warning
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    buildFaceSelector();
    updateProgress();

    overlay.querySelector('#scanner-close').addEventListener('click', destroyScanner);
    overlay.querySelector('#btn-capture').addEventListener('click', captureFace);
    overlay.querySelector('#btn-retake').addEventListener('click', () => {
        delete scannedFaces[selectedFace];
        updateProgress();
        showError('');
        setInstruction('Point camera at one face · Hold steady · Tap CAPTURE');
    });
}

function buildFaceSelector() {
    const container = document.getElementById('face-selector');
    if (!container) return;
    container.innerHTML = '';
    FACE_ORDER.forEach(f => {
        const isDone = !!scannedFaces[f];
        const btn = document.createElement('button');
        btn.className = [
            'fs-btn',
            f === selectedFace ? 'selected' : '',
            isDone ? 'done-face' : '',
        ].filter(Boolean).join(' ');
        btn.dataset.face = f;
        const col = FACE_COLORS[f]?.css || '#333';
        btn.innerHTML = `<span class="fs-dot" style="background:${col}"></span>${isDone ? '✓' : f}`;
        btn.addEventListener('click', () => {
            selectedFace = f; buildFaceSelector(); updateProgress();
        });
        container.appendChild(btn);
    });
}

function updateProgress() {
    document.querySelectorAll('.sp-dot').forEach(dot => {
        const f = dot.dataset.face;
        dot.classList.toggle('done', !!scannedFaces[f]);
        dot.classList.toggle('active', f === selectedFace && !scannedFaces[f]);
    });
    const count = Object.keys(scannedFaces).length;
    const btn = document.getElementById('btn-capture');
    if (!btn) return;
    if (count === 6) {
        btn.textContent = 'APPLY TO CUBE →';
        btn.classList.add('apply-mode');
        setInstruction('All 6 faces scanned! Tap APPLY TO CUBE to load.');
    } else {
        btn.textContent = 'CAPTURE FACE';
        btn.classList.remove('apply-mode');
        setInstruction(`${count}/6 done — align the ${selectedFace} face · bright dots = confident`);
    }
}

function setInstruction(msg) {
    const el = document.getElementById('scanner-instruction');
    if (el) el.textContent = msg;
}

function showError(msg) {
    const el = document.getElementById('scanner-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('visible', !!msg);
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function startCamera() {
    try {
        // Prefer exact environment (rear) camera at high resolution
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
                audio: false,
            });
        } catch {
            // Fallback: any camera
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } },
                audio: false,
            });
        }
        video.srcObject = stream;
        video.style.transform = '';   // rear cam — no horizontal mirror
        sampleInterval = setInterval(sampleGrid, 120);
    } catch (err) {
        showError('Camera access denied. Please allow camera permissions and try again.');
    }
}

function stopCamera() {
    if (sampleInterval) { clearInterval(sampleInterval); sampleInterval = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

// ─── Capture ─────────────────────────────────────────────────────────────────
function captureFace() {
    if (Object.keys(scannedFaces).length === 6) { applyScannedFaces(); return; }
    if (!sampledColors) { showError('Camera not ready yet.'); return; }

    const adjusted = [...sampledColors];
    adjusted[4] = selectedFace;   // center is always the current face

    scannedFaces[selectedFace] = adjusted;

    // Visual flash
    const vf = document.getElementById('scanner-viewfinder');
    if (vf) { vf.classList.remove('captured'); void vf.offsetWidth; vf.classList.add('captured'); }

    showError('');
    buildFaceSelector();
    updateProgress();

    const next = FACE_ORDER.find(f => !scannedFaces[f]);
    if (next) { selectedFace = next; buildFaceSelector(); updateProgress(); }
}

function applyScannedFaces() {
    const facelets = FACE_ORDER.map(f =>
        (scannedFaces[f] || Array(9).fill('X')).join('')
    ).join('');
    destroyScanner();
    if (onFaceScannedCallback) onFaceScannedCallback(facelets);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function initScanner(callback) {
    onFaceScannedCallback = callback;
    scannedFaces = {};
    sampledColors = null;
    sampledConfidence = null;
    selectedFace = 'U';
    buildOverlay();
    startCamera();
}

export function destroyScanner() {
    stopCamera();
    const overlay = document.getElementById('scanner-overlay');
    if (overlay) overlay.remove();
}