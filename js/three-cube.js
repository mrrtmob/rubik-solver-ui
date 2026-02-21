import { FACE_COLORS, FACE_ORDER } from './ui.js';

// ==========================================
// THREE.JS STATE
// ==========================================
let scene, camera, renderer, cubeGroup;
let isDragging = false, prevMouse = { x: 0, y: 0 };
let spherical = { theta: Math.PI / 6, phi: Math.PI / 3, radius: 7 };
let cubies = [];
let animQueue = [];
let animBusy = false;
let currentAnimId = null;

const THREE = window.THREE;

const CUBIE_COLORS = {
  U: 0xffffff, R: 0xc41e3a, F: 0x009b48,
  D: 0xffd500, L: 0xff5800, B: 0x0051a2,
  inner: 0x050505,
};

// ==========================================
// INIT
// ==========================================
export function initThree(getSpeed) {
  const canvas = document.getElementById('three-canvas');
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  updateCameraPosition();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x8888ff, 0.3);
  dir2.position.set(-5, -3, -5);
  scene.add(dir2);

  cubeGroup = new THREE.Group();
  scene.add(cubeGroup);
  buildCubies();

  // Mouse
  canvas.addEventListener('mousedown', e => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    spherical.theta -= (e.clientX - prevMouse.x) * 0.01;
    spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi - (e.clientY - prevMouse.y) * 0.01));
    prevMouse = { x: e.clientX, y: e.clientY };
    updateCameraPosition();
  });
  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('mouseleave', () => isDragging = false);
  canvas.addEventListener('wheel', e => {
    spherical.radius = Math.max(4, Math.min(15, spherical.radius + e.deltaY * 0.01));
    updateCameraPosition();
    e.preventDefault();
  }, { passive: false });

  // Touch
  let lastTouch = null;
  canvas.addEventListener('touchstart', e => { lastTouch = e.touches[0]; e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (!lastTouch) return;
    const t = e.touches[0];
    spherical.theta -= (t.clientX - lastTouch.clientX) * 0.01;
    spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi - (t.clientY - lastTouch.clientY) * 0.01));
    lastTouch = t;
    updateCameraPosition();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => lastTouch = null);

  // ResizeObserver catches both window resize AND layout reflow on mobile
  const ro = new ResizeObserver(() => {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(canvas.parentElement);

  // Store getSpeed reference for animations
  window.__getSpeed = getSpeed;

  animate();
}

function updateCameraPosition() {
  const { theta, phi, radius } = spherical;
  camera.position.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(0, 0, 0);
}

export function resetCamera() {
  spherical = { theta: Math.PI / 6, phi: Math.PI / 3, radius: 7 };
  updateCameraPosition();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// ==========================================
// CUBIES
// ==========================================
function buildCubies() {
  while (cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);
  cubies = [];
  const gap = 0.05, size = 1;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const geo = new THREE.BoxGeometry(size, size, size);
        const mats = [
          new THREE.MeshLambertMaterial({ color: x === 1  ? CUBIE_COLORS.R : CUBIE_COLORS.inner }),
          new THREE.MeshLambertMaterial({ color: x === -1 ? CUBIE_COLORS.L : CUBIE_COLORS.inner }),
          new THREE.MeshLambertMaterial({ color: y === 1  ? CUBIE_COLORS.U : CUBIE_COLORS.inner }),
          new THREE.MeshLambertMaterial({ color: y === -1 ? CUBIE_COLORS.D : CUBIE_COLORS.inner }),
          new THREE.MeshLambertMaterial({ color: z === 1  ? CUBIE_COLORS.F : CUBIE_COLORS.inner }),
          new THREE.MeshLambertMaterial({ color: z === -1 ? CUBIE_COLORS.B : CUBIE_COLORS.inner }),
        ];
        const mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(x * (size + gap), y * (size + gap), z * (size + gap));
        mesh.userData = { gx: x, gy: y, gz: z };
        cubeGroup.add(mesh);
        cubies.push(mesh);
      }
    }
  }
}

export function resetThreeCubeState() {
  cancelAnimations();
  buildCubies();
}

// ==========================================
// COLOR SYNC
// ==========================================
export function setColorsFromString(str) {
  if (!scene || !cubeGroup) return;
  const faces = {};
  FACE_ORDER.forEach((f, fi) => {
    faces[f] = [];
    for (let i = 0; i < 9; i++) faces[f].push(str[fi * 9 + i] || 'X');
  });

  cubies.forEach(mesh => {
    const { gx, gy, gz } = mesh.userData;
    const mats = mesh.material;
    const c = (f, r, col) => hexForFace(faces[f][r * 3 + col]);

    mats[0].color.setHex(gx === 1  ? c('R', 1 - gy, 1 - gz)  : CUBIE_COLORS.inner);
    mats[1].color.setHex(gx === -1 ? c('L', 1 - gy, gz + 1)  : CUBIE_COLORS.inner);
    mats[2].color.setHex(gy === 1  ? c('U', gz + 1, gx + 1)  : CUBIE_COLORS.inner);
    mats[3].color.setHex(gy === -1 ? c('D', 1 - gz, gx + 1)  : CUBIE_COLORS.inner);
    mats[4].color.setHex(gz === 1  ? c('F', 1 - gy, gx + 1)  : CUBIE_COLORS.inner);
    mats[5].color.setHex(gz === -1 ? c('B', 1 - gy, 1 - gx)  : CUBIE_COLORS.inner);
  });
}

function hexForFace(fchar) {
  return CUBIE_COLORS[fchar] !== undefined ? CUBIE_COLORS[fchar] : CUBIE_COLORS.inner;
}

// ==========================================
// MOVE ANIMATION
// ==========================================
const MOVE_DEF = {
  U: [0, 1, 0, -Math.PI / 2], D: [0, 1, 0,  Math.PI / 2],
  R: [1, 0, 0, -Math.PI / 2], L: [1, 0, 0,  Math.PI / 2],
  F: [0, 0, 1, -Math.PI / 2], B: [0, 0, 1,  Math.PI / 2],
};

function faceSelector(face) {
  switch (face) {
    case 'U': return c => c.userData.gy ===  1;
    case 'D': return c => c.userData.gy === -1;
    case 'R': return c => c.userData.gx ===  1;
    case 'L': return c => c.userData.gx === -1;
    case 'F': return c => c.userData.gz ===  1;
    case 'B': return c => c.userData.gz === -1;
  }
}

function cwStep(c, face) {
  const { gx, gy, gz } = c.userData;
  switch (face) {
    case 'U': c.userData.gx = -gz; c.userData.gz =  gx; break;
    case 'D': c.userData.gx =  gz; c.userData.gz = -gx; break;
    case 'R': c.userData.gy =  gz; c.userData.gz = -gy; break;
    case 'L': c.userData.gy = -gz; c.userData.gz =  gy; break;
    case 'F': c.userData.gx =  gy; c.userData.gy = -gx; break;
    case 'B': c.userData.gx = -gy; c.userData.gy =  gx; break;
  }
}

function updateGridCoords(c, face, mod) {
  const steps = mod === '2' ? 2 : mod === "'" ? 3 : 1;
  for (let s = 0; s < steps; s++) cwStep(c, face);
}

export function enqueueMove(move, animated, onDone) {
  animQueue.push({ move, animated, onDone });
  if (!animBusy) drainQueue();
}

function drainQueue() {
  if (!animQueue.length) { animBusy = false; return; }
  animBusy = true;
  const { move, animated, onDone } = animQueue.shift();
  applyMoveToThree(move, animated, () => { if (onDone) onDone(); drainQueue(); });
}

function cancelAnimations() {
  if (currentAnimId) { cancelAnimationFrame(currentAnimId); currentAnimId = null; }
  animQueue = [];
  animBusy = false;
}

function applyMoveToThree(move, animated, onDone) {
  const face = move[0];
  const mod  = move.length > 1 ? move[1] : '';
  const def  = MOVE_DEF[face];
  if (!def) { if (onDone) onDone(); return; }

  const axis     = new THREE.Vector3(def[0], def[1], def[2]);
  const cwAngle  = def[3];
  const angle    = mod === '2' ? cwAngle * 2 : mod === "'" ? -cwAngle : cwAngle;
  const affected = cubies.filter(faceSelector(face));

  if (!animated) {
    affected.forEach(c => updateGridCoords(c, face, mod));
    affected.forEach(c => {
      const gap = 0.05;
      c.position.set(c.userData.gx * (1 + gap), c.userData.gy * (1 + gap), c.userData.gz * (1 + gap));
    });
    if (onDone) onDone();
    return;
  }

  const pivot = new THREE.Group();
  cubeGroup.add(pivot);
  affected.forEach(c => {
    const savedPos  = c.position.clone();
    const savedQuat = c.quaternion.clone();
    cubeGroup.remove(c);
    c.position.copy(savedPos);
    c.quaternion.copy(savedQuat);
    pivot.add(c);
  });

  const duration = Math.min((window.__getSpeed?.() ?? 600) * 0.6, 380);
  const startTime = performance.now();
  const startQ = new THREE.Quaternion();
  const endQ   = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    pivot.quaternion.slerpQuaternions(startQ, endQ, e);
    renderer.render(scene, camera);

    if (t < 1) {
      currentAnimId = requestAnimationFrame(tick);
    } else {
      currentAnimId = null;
      pivot.quaternion.copy(endQ);
      pivot.updateMatrixWorld(true);
      const gap = 0.05;
      affected.forEach(c => {
        const wp = new THREE.Vector3();
        const wq = new THREE.Quaternion();
        c.getWorldPosition(wp);
        c.getWorldQuaternion(wq);
        pivot.remove(c);
        cubeGroup.add(c);
        c.position.copy(wp);
        c.quaternion.copy(wq);
        updateGridCoords(c, face, mod);
        c.position.set(c.userData.gx * (1 + gap), c.userData.gy * (1 + gap), c.userData.gz * (1 + gap));
      });
      cubeGroup.remove(pivot);
      if (onDone) onDone();
    }
  }

  currentAnimId = requestAnimationFrame(tick);
}