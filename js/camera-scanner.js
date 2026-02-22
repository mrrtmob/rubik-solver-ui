/**
 * camera-scanner.js — v4
 * - Scan order: U → L → F → R → B → D
 * - 3D CSS animated cube showing rotation direction between faces
 * - Camera fills viewfinder correctly (centered grid)
 * - HSV color classifier (unchanged from v3)
 */

import { FACE_COLORS } from './ui.js';

// ─── Scan order & transitions ─────────────────────────────────────────────────
const SCAN_SEQUENCE = ['U', 'L', 'F', 'R', 'B', 'D'];

// For each step: what CSS animation class to apply to the 3D cube
// and a plain text description
const TRANSITIONS = {
  'U→L': { anim: 'rotate-right',  text: 'Rotate cube to the RIGHT',       icon: '→' },
  'L→F': { anim: 'rotate-right',  text: 'Rotate cube to the RIGHT again',  icon: '→' },
  'F→R': { anim: 'rotate-right',  text: 'Rotate cube to the RIGHT again',  icon: '→' },
  'R→B': { anim: 'rotate-right',  text: 'Rotate cube to the RIGHT again',  icon: '→' },
  'B→D': { anim: 'rotate-up',     text: 'Tilt cube UP — bottom faces you', icon: '↑' },
};

// Face label on the 3D cube faces
// CSS 3D cube: front=F, back=B, right=R, left=L, top=U, bottom=D
// We highlight the active scanning face with a bright color
function buildCube3D(activeFace) {
  const faceStyle = (f) => {
    const isActive = f === activeFace;
    const col = isActive ? '#ffffff' : '#1a1a1a';
    const textCol = isActive ? '#000' : '#555';
    const border = isActive ? '2px solid #fff' : '1px solid #333';
    return `background:${col};color:${textCol};border:${border};`;
  };
  return `
    <div class="cube3d-wrap">
      <div class="cube3d" id="cube3d">
        <div class="face3d front"  style="${faceStyle('F')}">F</div>
        <div class="face3d back"   style="${faceStyle('B')}">B</div>
        <div class="face3d right"  style="${faceStyle('R')}">R</div>
        <div class="face3d left"   style="${faceStyle('L')}">L</div>
        <div class="face3d top"    style="${faceStyle('U')}">U</div>
        <div class="face3d bottom" style="${faceStyle('D')}">D</div>
      </div>
    </div>`;
}

// ─── Face hold instructions ───────────────────────────────────────────────────
const FACE_GUIDE = {
  U: { label: 'TOP FACE',    tip: 'Hold cube normally · top faces camera' },
  L: { label: 'LEFT FACE',   tip: 'Right side of cube now faces camera' },
  F: { label: 'FRONT FACE',  tip: 'Front of cube faces camera' },
  R: { label: 'RIGHT FACE',  tip: 'Left side of cube now faces camera' },
  B: { label: 'BACK FACE',   tip: 'Back of cube faces camera' },
  D: { label: 'BOTTOM FACE', tip: 'Tilt cube up — bottom faces camera' },
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const SCANNER_CSS = `
#scanner-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: #060606;
  display: flex; flex-direction: column;
  font-family: 'Space Mono', monospace;
  color: #e0e0e0;
  overflow: hidden;
}

/* ── Header ── */
#scanner-header {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #1e1e1e;
  background: #060606;
}
#scanner-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.4rem; letter-spacing: 4px; color: #fff;
}
#scanner-close {
  background: transparent; border: 1px solid #2a2a2a; color: #666;
  font-family: 'Space Mono', monospace; font-size: 0.65rem;
  letter-spacing: 2px; padding: 6px 12px; border-radius: 4px;
  cursor: pointer; transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}
#scanner-close:hover { border-color: #fff; color: #fff; }
#scanner-close:active { opacity: 0.6; }

/* ── Scrollable body ── */
#scanner-body {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  align-items: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ── Guide strip ── */
#guide-strip {
  width: 100%; flex-shrink: 0;
  background: #0d0d0d;
  border-bottom: 1px solid #1e1e1e;
  display: flex; align-items: center; gap: 14px;
  padding: 10px 16px;
}
#guide-face-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.1rem; letter-spacing: 3px; color: #fff;
  white-space: nowrap;
}
#guide-tip-text {
  font-size: 0.58rem; letter-spacing: 1px; color: #666;
  line-height: 1.5;
}
#guide-cube-wrap {
  flex-shrink: 0; margin-left: auto;
}

/* ── 3D CSS Cube ── */
.cube3d-wrap {
  width: 52px; height: 52px;
  perspective: 140px;
  display: flex; align-items: center; justify-content: center;
}
.cube3d {
  width: 32px; height: 32px;
  position: relative;
  transform-style: preserve-3d;
  transform: rotateX(-20deg) rotateY(30deg);
  transition: transform 0.6s ease;
}
.face3d {
  position: absolute;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; font-weight: 700; font-family: 'Space Mono', monospace;
  border-radius: 2px;
}
.face3d.front  { transform: translateZ(16px); }
.face3d.back   { transform: rotateY(180deg) translateZ(16px); }
.face3d.right  { transform: rotateY(90deg)  translateZ(16px); }
.face3d.left   { transform: rotateY(-90deg) translateZ(16px); }
.face3d.top    { transform: rotateX(90deg)  translateZ(16px); }
.face3d.bottom { transform: rotateX(-90deg) translateZ(16px); }

/* Rotation animations on the 3D cube */
@keyframes anim-rotate-right {
  0%   { transform: rotateX(-20deg) rotateY(30deg); }
  100% { transform: rotateX(-20deg) rotateY(30deg + 90deg); }
}
.cube3d.spin-right {
  animation: spin-right 1s cubic-bezier(0.4,0,0.2,1) infinite;
}
@keyframes spin-right {
  0%   { transform: rotateX(-20deg) rotateY(30deg); }
  40%  { transform: rotateX(-20deg) rotateY(120deg); }
  60%  { transform: rotateX(-20deg) rotateY(120deg); }
  100% { transform: rotateX(-20deg) rotateY(30deg); }
}
.cube3d.spin-up {
  animation: spin-up 1s cubic-bezier(0.4,0,0.2,1) infinite;
}
@keyframes spin-up {
  0%   { transform: rotateX(-20deg) rotateY(30deg); }
  40%  { transform: rotateX(-110deg) rotateY(30deg); }
  60%  { transform: rotateX(-110deg) rotateY(30deg); }
  100% { transform: rotateX(-20deg) rotateY(30deg); }
}
.cube3d.spin-left {
  animation: spin-left 1s cubic-bezier(0.4,0,0.2,1) infinite;
}
@keyframes spin-left {
  0%   { transform: rotateX(-20deg) rotateY(30deg); }
  40%  { transform: rotateX(-20deg) rotateY(-60deg); }
  60%  { transform: rotateX(-20deg) rotateY(-60deg); }
  100% { transform: rotateX(-20deg) rotateY(30deg); }
}

/* ── Viewfinder: full-width square, camera object-fit contained in center ── */
#scanner-vf-outer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 16px 0;
  flex-shrink: 0;
}
#scanner-viewfinder {
  position: relative;
  /* square, fits width */
  width: min(calc(100vw - 32px), 360px);
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  background: #111;
  box-shadow: 0 0 0 2px #fff, 0 8px 32px rgba(0,0,0,0.8);
}
#scanner-video {
  /* fill the square box, cropping to center */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
#scanner-canvas { display: none; }

/* ── 3×3 grid overlay ── */
#scanner-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  pointer-events: none;
  z-index: 2;
}
.sg-cell {
  border: 1px solid rgba(255,255,255,0.20);
  position: relative;
}
/* corner brackets */
#scanner-grid::before, #scanner-grid::after {
  content: '';
  position: absolute;
  width: 22px; height: 22px;
  border-color: #fff; border-style: solid; border-width: 0;
  pointer-events: none; z-index: 4;
}
#scanner-grid::before { top: 7px; left: 7px; border-top-width: 3px; border-left-width: 3px; border-radius: 2px 0 0 0; }
#scanner-grid::after  { bottom: 7px; right: 7px; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 2px 0; }

.sg-cell .color-dot {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 2.5px solid rgba(0,0,0,0.5);
  box-shadow: 0 2px 8px rgba(0,0,0,0.7);
  background: #222;
  transition: background 0.15s, border-color 0.2s;
}
.sg-cell .color-dot.confident {
  border-color: rgba(255,255,255,0.8);
}
.sg-cell .face-label {
  position: absolute;
  bottom: 2px; right: 4px;
  font-size: 0.45rem; font-weight: 700;
  color: rgba(255,255,255,0.8);
  text-shadow: 0 1px 3px #000;
}

/* ── Error banner ── */
#scanner-error {
  display: none;
  width: calc(100% - 32px); margin: 8px 0 0;
  background: rgba(255,50,50,0.10); border: 1px solid rgba(255,50,50,0.35);
  color: #ff8888; font-size: 0.58rem; letter-spacing: 1px;
  border-radius: 4px; padding: 7px 12px; text-align: center; line-height: 1.5;
}
#scanner-error.visible { display: block; }

/* ── Face selector pills ── */
#face-selector {
  display: flex; gap: 5px; flex-wrap: wrap;
  justify-content: center;
  padding: 10px 16px 0;
  width: 100%;
}
.fs-btn {
  background: transparent; border: 1px solid #222; color: #555;
  font-family: 'Space Mono', monospace; font-size: 0.55rem;
  letter-spacing: 2px; padding: 5px 10px; border-radius: 4px;
  cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
  transition: all 0.15s; -webkit-tap-highlight-color: transparent;
}
.fs-btn .fs-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.3); }
.fs-btn.selected  { border-color: #fff; color: #fff; }
.fs-btn.done-face { opacity: 0.45; }
.fs-btn:active    { opacity: 0.6; }

/* ── Progress dots row ── */
#progress-row {
  display: flex; gap: 6px; align-items: center;
  padding: 10px 16px 0;
}
.prog-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.prog-dot {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.2s;
}
.prog-label { font-size: 0.4rem; letter-spacing: 1px; color: #444; transition: color 0.2s; }
.prog-label.active { color: #fff; }
.prog-label.done   { color: #4caf50; }

/* ── Bottom actions ── */
#scanner-actions {
  display: flex; gap: 10px;
  width: 100%; padding: 10px 16px 16px;
  flex-shrink: 0;
}
#btn-capture {
  flex: 1; height: 50px; border-radius: 6px;
  background: #fff; border: 1px solid #fff; color: #000;
  font-family: 'Space Mono', monospace; font-size: 0.78rem;
  font-weight: 700; letter-spacing: 3px; cursor: pointer;
  transition: opacity 0.15s, background 0.2s;
  -webkit-tap-highlight-color: transparent;
}
#btn-capture:active { opacity: 0.7; }
#btn-capture.apply-mode { background: #7ecfff; border-color: #7ecfff; }
#btn-retake {
  height: 50px; padding: 0 14px; border-radius: 6px;
  background: transparent; border: 1px solid #222; color: #555;
  font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 2px;
  cursor: pointer; transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
#btn-retake:hover { border-color: #555; color: #aaa; }
#btn-retake:active { opacity: 0.6; }

/* ── Transition overlay (shown after each capture) ── */
#transition-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(6,6,6,0.97);
  flex-direction: column;
  align-items: center; justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
  animation: toFadeIn 0.2s ease both;
}
#transition-overlay.visible { display: flex; }
@keyframes toFadeIn { from { opacity: 0; } to { opacity: 1; } }

#to-check {
  width: 60px; height: 60px;
  border-radius: 50%; border: 2px solid #4caf50;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem;
  animation: toPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes toPop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

#to-done-label {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1rem; letter-spacing: 4px; color: #4caf50;
}
#to-divider {
  width: 40px; height: 1px; background: #222;
}

#to-next-label {
  font-size: 0.55rem; letter-spacing: 3px; color: #555; text-transform: uppercase;
}
#to-next-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.6rem; letter-spacing: 5px; color: #fff;
}

/* 3D cube in transition card — bigger */
#to-cube-wrap {
  width: 100px; height: 100px;
  perspective: 240px;
  display: flex; align-items: center; justify-content: center;
}
#to-cube {
  width: 54px; height: 54px;
  position: relative;
  transform-style: preserve-3d;
  transform: rotateX(-20deg) rotateY(30deg);
}
.to-face {
  position: absolute;
  width: 54px; height: 54px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; font-weight: 700; font-family: 'Space Mono', monospace;
  border-radius: 3px;
}
.to-face.front  { transform: translateZ(27px); }
.to-face.back   { transform: rotateY(180deg) translateZ(27px); }
.to-face.right  { transform: rotateY(90deg)  translateZ(27px); }
.to-face.left   { transform: rotateY(-90deg) translateZ(27px); }
.to-face.top    { transform: rotateX(90deg)  translateZ(27px); }
.to-face.bottom { transform: rotateX(-90deg) translateZ(27px); }

#to-cube.spin-right {
  animation: big-spin-right 1.2s cubic-bezier(0.4,0,0.2,1) infinite;
}
@keyframes big-spin-right {
  0%   { transform: rotateX(-20deg) rotateY(30deg); }
  45%  { transform: rotateX(-20deg) rotateY(120deg); }
  65%  { transform: rotateX(-20deg) rotateY(120deg); }
  100% { transform: rotateX(-20deg) rotateY(30deg); }
}
#to-cube.spin-up {
  animation: big-spin-up 1.2s cubic-bezier(0.4,0,0.2,1) infinite;
}
@keyframes big-spin-up {
  0%   { transform: rotateX(-20deg) rotateY(30deg); }
  45%  { transform: rotateX(-110deg) rotateY(30deg); }
  65%  { transform: rotateX(-110deg) rotateY(30deg); }
  100% { transform: rotateX(-20deg) rotateY(30deg); }
}

#to-rotate-desc {
  font-size: 0.62rem; letter-spacing: 1.5px; color: #7ecfff;
  line-height: 1.7; max-width: 260px;
}

#to-continue-btn {
  margin-top: 4px;
  background: #fff; border: none; color: #000;
  font-family: 'Space Mono', monospace;
  font-size: 0.78rem; font-weight: 700; letter-spacing: 3px;
  padding: 14px 32px; border-radius: 6px; cursor: pointer;
  transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
}
#to-continue-btn:active { opacity: 0.7; }
#to-continue-btn.apply { background: #7ecfff; }

/* Capture flash */
#scanner-viewfinder.flash::after {
  content: ''; position: absolute; inset: 0;
  background: rgba(255,255,255,0.3);
  animation: flashOut 0.3s ease-out forwards;
  pointer-events: none; z-index: 10;
}
@keyframes flashOut { 0% { opacity: 1; } 100% { opacity: 0; } }
`;

// ─── HSV Color Classifier ─────────────────────────────────────────────────────
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, v };
}

function classifyColor(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (v < 0.12) return 'X';
  if (s < 0.30 && v > 0.50) return 'U';   // white
  if (h >= 38 && h <= 70  && s > 0.38) return 'D';  // yellow
  if (h >= 15 && h <  38  && s > 0.42) return 'L';  // orange
  if ((h >= 330 || h < 15) && s > 0.38) return 'R'; // red
  if (h >= 90 && h <= 165 && s > 0.28) return 'F';  // green
  if (h >= 195 && h <= 265 && s > 0.28) return 'B'; // blue
  if (s < 0.40 && v > 0.45) return 'U';
  // nearest hue fallback
  const HUE = { R: 0, L: 26, D: 54, F: 128, B: 228 };
  let best = 'U', bestD = Infinity;
  for (const [k, c] of Object.entries(HUE)) {
    let d = Math.abs(h - c); if (d > 180) d = 360 - d;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

function isConfident(r, g, b) {
  const { s, v } = rgbToHsv(r, g, b);
  if (v < 0.12) return false;
  return (s < 0.25 && v > 0.65) || (s > 0.55 && v > 0.40);
}

// ─── Module state ─────────────────────────────────────────────────────────────
const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
let video, canvas, ctx, stream;
let onFaceScannedCallback = null;
let selectedFace = 'U';
let scannedFaces = {};
let sampledColors = null;
let sampleInterval = null;
const SAMPLE_HALF = 16;

// ─── Sampling ─────────────────────────────────────────────────────────────────
function sampleGrid() {
  if (!video || !canvas || video.readyState < 2) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
  ctx.drawImage(video, 0, 0, vw, vh);

  // The viewfinder crops the video to a square using object-fit:cover.
  // We need to sample from the equivalent square region in the raw video frame.
  const side   = Math.min(vw, vh);
  const offX   = (vw - side) / 2;   // horizontal offset if video is wider
  const offY   = (vh - side) / 2;   // vertical offset if video is taller
  const cellSz = side / 3;

  const colors = [], confidence = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = Math.round(offX + cellSz * (col + 0.5));
      const cy = Math.round(offY + cellSz * (row + 0.5));
      const x1 = Math.max(0, cx - SAMPLE_HALF);
      const y1 = Math.max(0, cy - SAMPLE_HALF);
      const w  = Math.min(vw, cx + SAMPLE_HALF) - x1;
      const h  = Math.min(vh, cy + SAMPLE_HALF) - y1;
      if (w <= 0 || h <= 0) { colors.push('X'); confidence.push(false); continue; }
      const data = ctx.getImageData(x1, y1, w, h).data;
      let rS = 0, gS = 0, bS = 0, n = 0;
      for (let i = 0; i < data.length; i += 8) { rS += data[i]; gS += data[i+1]; bS += data[i+2]; n++; }
      const ra = rS/n, ga = gS/n, ba = bS/n;
      colors.push(classifyColor(ra, ga, ba));
      confidence.push(isConfident(ra, ga, ba));
    }
  }
  sampledColors = colors;
  updateDots(colors, confidence);
}

function updateDots(colors, conf) {
  document.querySelectorAll('.sg-cell').forEach((cell, i) => {
    const key = colors[i] || 'X';
    const dot   = cell.querySelector('.color-dot');
    const label = cell.querySelector('.face-label');
    if (dot)   { dot.style.background = FACE_COLORS[key]?.css || '#222'; dot.classList.toggle('confident', !!conf?.[i]); }
    if (label) { label.textContent = key !== 'X' ? key : ''; }
  });
}

// ─── 3D cube helpers ──────────────────────────────────────────────────────────
function makeFaces(activeFace, size) {
  const faceDefs = [
    { cls: 'front',  label: 'F' },
    { cls: 'back',   label: 'B' },
    { cls: 'right',  label: 'R' },
    { cls: 'left',   label: 'L' },
    { cls: 'top',    label: 'U' },
    { cls: 'bottom', label: 'D' },
  ];
  // Which label corresponds to which face key
  const labelToFace = { F: 'F', B: 'B', R: 'R', L: 'L', U: 'U', D: 'D' };
  return faceDefs.map(({ cls, label }) => {
    const isActive = labelToFace[label] === activeFace;
    const bg     = isActive ? '#fff' : '#1c1c1c';
    const color  = isActive ? '#000' : '#555';
    const border = isActive ? `${size > 40 ? 2 : 1.5}px solid #fff` : `1px solid #2a2a2a`;
    return `<div class="${size > 40 ? 'to-face' : 'face3d'} ${cls}" style="background:${bg};color:${color};border:${border}">${label}</div>`;
  }).join('');
}

function applyCubeAnim(cubeEl, animKey) {
  cubeEl.classList.remove('spin-right', 'spin-up', 'spin-left');
  if (animKey === 'rotate-right') cubeEl.classList.add('spin-right');
  else if (animKey === 'rotate-up') cubeEl.classList.add('spin-up');
  else if (animKey === 'rotate-left') cubeEl.classList.add('spin-left');
}

// ─── UI Builders ──────────────────────────────────────────────────────────────
function buildOverlay() {
  if (!document.getElementById('scanner-css')) {
    const s = document.createElement('style');
    s.id = 'scanner-css'; s.textContent = SCANNER_CSS;
    document.head.appendChild(s);
  }

  const overlay = document.createElement('div');
  overlay.id = 'scanner-overlay';
  overlay.innerHTML = `
    <!-- Transition overlay -->
    <div id="transition-overlay">
      <div id="to-check">✓</div>
      <div id="to-done-label"></div>
      <div id="to-divider"></div>
      <div id="to-next-label">NEXT →</div>
      <div id="to-next-name"></div>
      <div id="to-cube-wrap">
        <div id="to-cube"></div>
      </div>
      <div id="to-rotate-desc"></div>
      <button id="to-continue-btn">GOT IT</button>
    </div>

    <div id="scanner-header">
      <div id="scanner-title">SCAN CUBE</div>
      <button id="scanner-close">✕ CLOSE</button>
    </div>

    <div id="scanner-body">
      <!-- Guide strip -->
      <div id="guide-strip">
        <div>
          <div id="guide-face-name"></div>
          <div id="guide-tip-text"></div>
        </div>
        <div id="guide-cube-wrap">
          <div class="cube3d-wrap">
            <div class="cube3d" id="guide-cube"></div>
          </div>
        </div>
      </div>

      <!-- Viewfinder -->
      <div id="scanner-vf-outer">
        <div id="scanner-viewfinder">
          <video id="scanner-video" autoplay playsinline muted></video>
          <canvas id="scanner-canvas"></canvas>
          <div id="scanner-grid">
            ${Array(9).fill(0).map(() =>
              `<div class="sg-cell"><div class="color-dot"></div><div class="face-label"></div></div>`
            ).join('')}
          </div>
        </div>
      </div>

      <!-- Error -->
      <div id="scanner-error"></div>

      <!-- Face selector -->
      <div id="face-selector"></div>

      <!-- Progress: one colored dot per face in SCAN_SEQUENCE order -->
      <div id="progress-row">
        ${SCAN_SEQUENCE.map(f => `
          <div class="prog-item">
            <div class="prog-dot" data-face="${f}" style="background:${FACE_COLORS[f]?.css||'#222'};border-color:${FACE_COLORS[f]?.css||'#444'};opacity:0.35"></div>
            <div class="prog-label" data-face="${f}">${f}</div>
          </div>`).join('')}
      </div>

      <!-- Actions -->
      <div id="scanner-actions">
        <button id="btn-retake">RETAKE</button>
        <button id="btn-capture">CAPTURE U FACE</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  video  = overlay.querySelector('#scanner-video');
  canvas = overlay.querySelector('#scanner-canvas');
  ctx    = canvas.getContext('2d', { willReadFrequently: true });

  refreshGuide(selectedFace, null);
  buildFaceSelector();
  refreshProgress();

  overlay.querySelector('#scanner-close').addEventListener('click', destroyScanner);
  overlay.querySelector('#btn-capture').addEventListener('click', captureFace);
  overlay.querySelector('#btn-retake').addEventListener('click', onRetake);
  overlay.querySelector('#to-continue-btn').addEventListener('click', onContinue);
}

function refreshGuide(face, animKey) {
  const g = FACE_GUIDE[face] || {};
  const nameEl = document.getElementById('guide-face-name');
  const tipEl  = document.getElementById('guide-tip-text');
  const cube   = document.getElementById('guide-cube');
  if (nameEl) nameEl.textContent = g.label || face;
  if (tipEl)  tipEl.textContent  = g.tip   || '';
  if (cube) {
    cube.innerHTML = makeFaces(face, 32);
    applyCubeAnim(cube, animKey);
  }
}

function buildFaceSelector() {
  const c = document.getElementById('face-selector');
  if (!c) return;
  c.innerHTML = '';
  // Use SCAN_SEQUENCE order so pills match the progress dots below
  SCAN_SEQUENCE.forEach(f => {
    const isDone = !!scannedFaces[f];
    const btn = document.createElement('button');
    btn.className = ['fs-btn', f === selectedFace ? 'selected' : '', isDone ? 'done-face' : ''].filter(Boolean).join(' ');
    btn.innerHTML = `<span class="fs-dot" style="background:${FACE_COLORS[f]?.css||'#333'}"></span>${isDone ? '✓' : f}`;
    btn.addEventListener('click', () => { selectedFace = f; buildFaceSelector(); refreshProgress(); refreshGuide(f, null); });
    c.appendChild(btn);
  });
}

function refreshProgress() {
  document.querySelectorAll('.prog-dot').forEach(d => {
    const f   = d.dataset.face;
    const css = FACE_COLORS[f]?.css || '#444';
    const isDone   = !!scannedFaces[f];
    const isActive = f === selectedFace && !isDone;

    // Always keep the face color; use opacity + ring to show state
    d.style.background   = css;
    d.style.borderColor  = isActive ? '#fff' : css;
    d.style.opacity      = isDone ? '1' : isActive ? '0.85' : '0.3';
    d.style.boxShadow    = isActive ? '0 0 0 2px rgba(255,255,255,0.35)' : isDone ? '0 0 0 1px rgba(255,255,255,0.15)' : 'none';
    d.style.transform    = isActive ? 'scale(1.25)' : 'scale(1)';
    d.style.transition   = 'all 0.2s';
  });

  document.querySelectorAll('.prog-label').forEach(l => {
    const f = l.dataset.face;
    l.className = 'prog-label' + (scannedFaces[f] ? ' done' : f === selectedFace ? ' active' : '');
  });

  const count = Object.keys(scannedFaces).length;
  const btn = document.getElementById('btn-capture');
  if (!btn) return;
  if (count === 6) {
    btn.textContent = 'APPLY TO CUBE →'; btn.classList.add('apply-mode');
  } else {
    btn.textContent = `CAPTURE ${selectedFace} FACE`; btn.classList.remove('apply-mode');
  }
}

function showError(msg) {
  const el = document.getElementById('scanner-error');
  if (!el) return;
  el.textContent = msg; el.classList.toggle('visible', !!msg);
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
    }
    video.srcObject = stream;
    video.style.transform = '';
    sampleInterval = setInterval(sampleGrid, 120);
  } catch {
    showError('Camera access denied. Please allow camera permissions.');
  }
}

function stopCamera() {
  if (sampleInterval) { clearInterval(sampleInterval); sampleInterval = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

// ─── Capture / Transition ─────────────────────────────────────────────────────
function onRetake() {
  delete scannedFaces[selectedFace];
  buildFaceSelector(); refreshProgress(); refreshGuide(selectedFace, null); showError('');
}

function onContinue() {
  if (Object.keys(scannedFaces).length === 6) { applyScannedFaces(); return; }
  document.getElementById('transition-overlay').classList.remove('visible');
  refreshGuide(selectedFace, null);
}

function captureFace() {
  if (Object.keys(scannedFaces).length === 6) { applyScannedFaces(); return; }
  if (!sampledColors) { showError('Camera not ready.'); return; }

  const adjusted = [...sampledColors];
  adjusted[4] = selectedFace;
  scannedFaces[selectedFace] = adjusted;

  // Flash
  const vf = document.getElementById('scanner-viewfinder');
  if (vf) { vf.classList.remove('flash'); void vf.offsetWidth; vf.classList.add('flash'); }

  showError('');
  buildFaceSelector();
  refreshProgress();

  const capturedFace = selectedFace;

  // Next face in recommended order
  const seqIdx = SCAN_SEQUENCE.indexOf(capturedFace);
  let nextFace = null;
  for (let i = seqIdx + 1; i < SCAN_SEQUENCE.length; i++) {
    if (!scannedFaces[SCAN_SEQUENCE[i]]) { nextFace = SCAN_SEQUENCE[i]; break; }
  }
  if (!nextFace) nextFace = FACE_ORDER.find(f => !scannedFaces[f]) || null;
  if (nextFace) selectedFace = nextFace;

  setTimeout(() => showTransition(capturedFace, nextFace), 180);
}

function showTransition(from, to) {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) return;

  document.getElementById('to-done-label').textContent = from + ' FACE SAVED ✓';

  if (!to) {
    // All done
    document.getElementById('to-next-label').textContent = 'ALL FACES SCANNED!';
    document.getElementById('to-next-name').textContent = '';
    document.getElementById('to-rotate-desc').textContent = 'Tap below to load the cube.';
    document.getElementById('to-cube').innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#4caf50">✓</div>`;
    document.getElementById('to-cube').className = '';
    document.getElementById('to-continue-btn').textContent = 'APPLY TO CUBE →';
    document.getElementById('to-continue-btn').classList.add('apply');
  } else {
    const key = `${from}→${to}`;
    const tr  = TRANSITIONS[key] || { anim: '', text: `Now scan the ${to} face`, icon: '→' };
    const g   = FACE_GUIDE[to] || {};

    document.getElementById('to-next-label').textContent = 'NEXT FACE';
    document.getElementById('to-next-name').textContent  = g.label || to;
    document.getElementById('to-rotate-desc').textContent = tr.text;

    const toCube = document.getElementById('to-cube');
    toCube.innerHTML = makeFaces(to, 54);
    toCube.className = '';
    applyCubeAnim(toCube, tr.anim);

    document.getElementById('to-continue-btn').textContent = `GOT IT — SCAN ${to}`;
    document.getElementById('to-continue-btn').classList.remove('apply');
  }

  overlay.classList.add('visible');
}

function applyScannedFaces() {
  // FACE_ORDER = [U,R,F,D,L,B] — correct order for the solver.
  // Each scannedFaces[f] has 9 classified color-key chars e.g. ['U','R','U',...].
  const facelets = FACE_ORDER.map(f =>
    (scannedFaces[f] || Array(9).fill('X')).join('')
  ).join('');

  // Validate: must be 54 chars of only valid face keys
  if (!/^[URFDLB]{54}$/.test(facelets)) {
    showError('Some stickers unrecognised (grey dots). Retake those faces in better lighting.');
    const to = document.getElementById('transition-overlay');
    if (to) to.classList.remove('visible');
    return;
  }

  // Each of the 6 face letters must appear exactly 9 times
  const counts = {};
  for (const ch of facelets) counts[ch] = (counts[ch] || 0) + 1;
  const bad = Object.entries(counts).filter(([, v]) => v !== 9).map(([k]) => k);
  if (bad.length) {
    showError('Color count wrong for: ' + bad.join(', ') + '. Retake those faces.');
    const to = document.getElementById('transition-overlay');
    if (to) to.classList.remove('visible');
    return;
  }

  destroyScanner();
  if (onFaceScannedCallback) onFaceScannedCallback(facelets);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function initScanner(callback) {
  onFaceScannedCallback = callback;
  scannedFaces = {}; sampledColors = null; selectedFace = 'U';
  buildOverlay();
  startCamera();
}

export function destroyScanner() {
  stopCamera();
  const o = document.getElementById('scanner-overlay');
  if (o) o.remove();
  const t = document.getElementById('transition-overlay');
  if (t) t.remove();
}