/**
 * Draguz Shop — app.js v5
 * - Timeout de carga con mensaje claro
 * - Fallback si GLB falla o tarda mucho
 * - Design plane independiente, color nunca tiñe
 * - flipY correcto, sin volteo
 * - Responsivo móvil
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── TAMAÑO RESPONSIVO ─────────────────────────
const canvasEl = document.getElementById('c');
const wrapEl   = canvasEl.closest('.canvas-wrap');

function getSize() {
  const available = wrapEl ? wrapEl.clientWidth - 40 : 380;
  return Math.max(260, Math.min(available, 500));
}

let SIZE = getSize();
canvasEl.width  = SIZE;
canvasEl.height = SIZE;
canvasEl.style.width  = SIZE + 'px';
canvasEl.style.height = SIZE + 'px';

// ── RENDERER ──────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas:          canvasEl,
    alpha:           true,
    antialias:       true,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
  });
} catch(e) {
  setStatus('Tu navegador no soporta WebGL — intenta en Chrome o Firefox');
  throw e;
}

renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping    = THREE.NoToneMapping;

// ── ESCENA / CÁMARA / CONTROLES ───────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0, 3.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan       = false;
controls.enableDamping   = true;
controls.dampingFactor   = 0.08;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.7;
controls.minPolarAngle   = Math.PI * 0.1;
controls.maxPolarAngle   = Math.PI * 0.9;
canvasEl.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── ILUMINACIÓN ───────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
keyLight.position.set(2, 4, 5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-3, 1, 2);
scene.add(fillLight);

// ── ESTADO ────────────────────────────────────
let meshes     = [];
let shirtColor = '#ffffff';
let modelSize  = new THREE.Vector3(1, 1.4, 0.3);
let designMesh = null;
let designTex  = null;
let dp         = { scale: 0.5, offsetX: 0.0, offsetY: 0.0 };
let modelReady = false;

// ── HELPERS DE UI ─────────────────────────────
function setStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}
function hideLoader() {
  const el = document.getElementById('canvasLoader');
  if (el) el.style.display = 'none';
}
function showLoader(msg) {
  const el = document.getElementById('canvasLoader');
  if (el) el.style.display = 'flex';
  setStatus(msg || 'Cargando…');
}

// ── PLANO DEL DISEÑO ──────────────────────────
function buildDesignMesh() {
  if (designMesh) {
    scene.remove(designMesh);
    designMesh.geometry.dispose();
    designMesh.material.dispose();
    designMesh = null;
  }
  if (!designTex || !modelReady) return;

  const img   = designTex.image;
  const ratio = (img && img.width > 0) ? img.height / img.width : 1;
  const w     = modelSize.x * dp.scale;
  const h     = w * ratio;

  designMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map:        designTex,
      transparent: true,
      alphaTest:  0.01,
      color:      0xffffff,   // siempre blanco — nunca hereda color de prenda
      depthWrite: false,
    })
  );

  designMesh.renderOrder = 999;
  designMesh.position.set(
    modelSize.x * dp.offsetX,
    modelSize.y * dp.offsetY,
    modelSize.z / 2 + 0.02
  );
  scene.add(designMesh);
}

// ── CARGAR GLB ────────────────────────────────
showLoader('Cargando modelo 3D…');

// Timeout de 25 segundos — si no carga, muestra mensaje útil
const loadTimeout = setTimeout(() => {
  if (!modelReady) {
    hideLoader();
    setStatus('⚠️ El modelo tardó mucho. Verifica que playera.glb esté en la misma carpeta que index.html en tu repo.');
  }
}, 25000);

new GLTFLoader().load(
  './playera.glb',

  // ✅ ÉXITO
  (gltf) => {
    clearTimeout(loadTimeout);
    modelReady = true;

    const model = gltf.scene;

    // Centrar en origen
    const box    = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    modelSize    = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    // Ajustar cámara
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    camera.position.set(0, modelSize.y * 0.05, maxDim * 1.9);
    controls.target.set(0, 0, 0);
    controls.minDistance = maxDim * 0.6;
    controls.maxDistance = maxDim * 6;
    controls.update();

    // Material PBR — solo color, sin textura
    model.traverse(child => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.material = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(shirtColor),
        roughness: 0.82,
        metalness: 0.0,
        side:      THREE.DoubleSide,
      });
    });

    scene.add(model);
    hideLoader();
    setStatus('Gira con mouse o dedo · Scroll para zoom');
    window.dispatchEvent(new Event('shirtLoaded'));

    // Si había diseño esperando, colocarlo ahora
    if (designTex) buildDesignMesh();
  },

  // 📶 PROGRESO
  (xhr) => {
    if (xhr.total > 0) {
      const pct = Math.round(xhr.loaded / xhr.total * 100);
      setStatus(`Cargando modelo… ${pct}%`);
    } else {
      setStatus('Cargando modelo…');
    }
  },

  // ❌ ERROR
  (err) => {
    clearTimeout(loadTimeout);
    hideLoader();
    console.error('GLB load error:', err);
    setStatus('⚠️ No se encontró playera.glb — asegúrate de subirlo al repo junto con index.html');
  }
);

// ── API PÚBLICA ───────────────────────────────

/** Solo cambia el color de la playera — el plano del diseño es independiente */
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(m => m.material.color.set(hex));
};

/** Carga imagen y la coloca en el plano 3D del frente */
window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  new THREE.TextureLoader().load(url, (tex) => {
    tex.encoding  = THREE.sRGBEncoding;
    tex.flipY     = true;      // correcto para imágenes normales en PlaneGeometry
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (designTex) { designTex.dispose(); }
    designTex = tex;

    buildDesignMesh();

    const prev = document.getElementById('designPreview');
    if (prev) prev.innerHTML =
      `<img src="${url}" style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">`;
  });
};

/** Actualiza desde sliders */
window.updateDesign = function() {
  dp.scale   = parseFloat(document.getElementById('sliderS').value);
  dp.offsetX = parseFloat(document.getElementById('sliderX').value);
  dp.offsetY = parseFloat(document.getElementById('sliderY').value);
  if (designTex) buildDesignMesh();
};

// ── RESIZE ────────────────────────────────────
window.addEventListener('resize', () => {
  SIZE = getSize();
  renderer.setSize(SIZE, SIZE);
  canvasEl.style.width  = SIZE + 'px';
  canvasEl.style.height = SIZE + 'px';
});

// ── RENDER LOOP ───────────────────────────────
(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();
