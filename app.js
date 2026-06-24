/**
 * Draguz Shop — app.js v7
 * - Diseño centrado usando bounding box real del modelo
 * - flipY=false en textura del plano hijo (evita volteo)
 * - Posición calculada en coordenadas locales reales
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── CANVAS RESPONSIVO ─────────────────────────
const canvasEl = document.getElementById('c');
const wrapEl   = canvasEl.closest('.canvas-wrap');
function getSize() {
  return Math.max(260, Math.min(wrapEl ? wrapEl.clientWidth - 40 : 380, 520));
}
let SIZE = getSize();
canvasEl.width  = SIZE;
canvasEl.height = SIZE;
canvasEl.style.cssText = `width:${SIZE}px;height:${SIZE}px;`;

// ── RENDERER ──────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl, alpha: true, antialias: true,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
  });
} catch(e) { setStatus('WebGL no disponible en este navegador'); throw e; }

renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputEncoding      = THREE.sRGBEncoding;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;

// ── ESCENA / CÁMARA / CONTROLES ───────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0, 3.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false; controls.enableDamping = true;
controls.dampingFactor = 0.08; controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
controls.minPolarAngle = Math.PI * 0.1;
controls.maxPolarAngle = Math.PI * 0.9;
canvasEl.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── ILUMINACIÓN ESTUDIO ───────────────────────
scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));
scene.add(new THREE.HemisphereLight(0xdde8ff, 0xfff0d0, 0.4));

const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.4);
keyLight.position.set(3, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.radius = 4;
keyLight.shadow.bias   = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.5);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

scene.add(Object.assign(new THREE.DirectionalLight(0xffffff, 0.2),
  { position: new THREE.Vector3(0, -2, -4) }));

// ── ESTADO ────────────────────────────────────
let shirtModel = null;
let meshes     = [];
let shirtColor = '#ffffff';
// Bounding box EN ESPACIO LOCAL del modelo (se calcula tras cargar)
let localBox   = new THREE.Box3();
let localSize  = new THREE.Vector3(1, 1.4, 0.3);
let localCenter = new THREE.Vector3(0, 0, 0);

let designMesh = null;
let designTex  = null;
// offsetX/Y en fracción del tamaño local (0 = centro del pecho)
let dp = { scale: 0.42, offsetX: 0.0, offsetY: 0.0 };
let modelReady = false;

// ── HELPERS ───────────────────────────────────
function setStatus(msg) {
  const el = document.getElementById('canvasStatus'); if (el) el.textContent = msg;
}
function hideLoader() {
  const el = document.getElementById('canvasLoader'); if (el) el.style.display = 'none';
}

// ── PLANO DEL DISEÑO ──────────────────────────
function buildDesignMesh() {
  if (designMesh) {
    if (designMesh.parent) designMesh.parent.remove(designMesh);
    designMesh.geometry.dispose();
    designMesh.material.dispose();
    designMesh = null;
  }
  if (!designTex || !shirtModel) return;

  // Proporciones reales de la imagen
  const img   = designTex.image;
  const ratio = (img && img.width > 0) ? img.height / img.width : 1;
  const w     = localSize.x * dp.scale;
  const h     = w * ratio;

  designMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map:         designTex,
      transparent: true,
      alphaTest:   0.01,
      color:       0xffffff,   // nunca hereda color de prenda
      depthWrite:  false,
    })
  );
  designMesh.renderOrder = 2;

  // Centro del frente en coordenadas LOCALES del modelo:
  // X = centro horizontal del bounding box
  // Y = ligeramente arriba del centro vertical (zona pecho)
  // Z = cara frontal del bounding box + pequeño offset
  const cx = localCenter.x + localSize.x * dp.offsetX;
  const cy = localCenter.y + localSize.y * 0.12 + localSize.y * dp.offsetY; // +12% = zona pecho
  const cz = localBox.max.z + 0.015;  // cara frontal real del modelo

  designMesh.position.set(cx, cy, cz);

  // Es hijo del modelo → rota con él automáticamente
  shirtModel.add(designMesh);
}

// ── CARGAR MODELO ─────────────────────────────
setStatus('Cargando modelo 3D…');
const loadTimeout = setTimeout(() => {
  if (!modelReady) {
    hideLoader();
    setStatus('⚠️ Verifica que playera.glb esté en la raíz del repo junto a index.html');
  }
}, 25000);

new GLTFLoader().load('./playera.glb',
  (gltf) => {
    clearTimeout(loadTimeout);
    modelReady = true;
    shirtModel = gltf.scene;

    // 1. Calcular bounding box ANTES de centrar
    const worldBox  = new THREE.Box3().setFromObject(shirtModel);
    const worldSize = worldBox.getSize(new THREE.Vector3());
    const worldCenter = worldBox.getCenter(new THREE.Vector3());

    // 2. Centrar el modelo en el origen
    shirtModel.position.sub(worldCenter);

    // 3. Calcular bounding box LOCAL (después de centrar = en espacio local)
    localBox.setFromObject(shirtModel);
    localSize.copy(worldSize);
    localCenter.set(0, 0, 0); // después de centrar, el centro local es el origen

    // 4. Ajustar cámara
    const maxDim = Math.max(localSize.x, localSize.y, localSize.z);
    camera.position.set(0, localSize.y * 0.05, maxDim * 1.9);
    controls.target.set(0, 0, 0);
    controls.minDistance = maxDim * 0.6;
    controls.maxDistance = maxDim * 6;
    controls.update();

    // 5. Aplicar material PBR
    shirtModel.traverse(child => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.castShadow = child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(shirtColor),
        roughness: 0.92,
        metalness: 0.0,
        side:      THREE.DoubleSide,
      });
    });

    scene.add(shirtModel);
    hideLoader();
    setStatus('Gira con mouse o dedo · Scroll para zoom');
    window.dispatchEvent(new Event('shirtLoaded'));

    // Log para debug — muestra dónde está el frente real
    console.log('Modelo cargado. BBox local:', {
      min: localBox.min, max: localBox.max, size: localSize,
      fronteZ: localBox.max.z
    });

    if (designTex) buildDesignMesh();
  },
  (xhr) => {
    const pct = xhr.total > 0 ? ` ${Math.round(xhr.loaded/xhr.total*100)}%` : '';
    setStatus(`Cargando modelo…${pct}`);
  },
  (err) => {
    clearTimeout(loadTimeout);
    hideLoader();
    console.error('GLB error:', err);
    setStatus('⚠️ No se encontró playera.glb en la carpeta del repo');
  }
);

// ── API PÚBLICA ───────────────────────────────
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(m => m.material.color.set(hex));
  // designMesh usa MeshBasicMaterial con color:0xffffff → nunca cambia
};

window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);

  new THREE.TextureLoader().load(url, (tex) => {
    // flipY=false porque el plano es hijo del modelo y ya tiene la orientación correcta
    tex.encoding  = THREE.sRGBEncoding;
    tex.flipY     = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (designTex) designTex.dispose();
    designTex = tex;
    buildDesignMesh();

    const prev = document.getElementById('designPreview');
    if (prev) prev.innerHTML =
      `<img src="${url}" style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">`;
  });
};

window.updateDesign = function() {
  dp.scale   = parseFloat(document.getElementById('sliderS').value);
  dp.offsetX = parseFloat(document.getElementById('sliderX').value);
  dp.offsetY = parseFloat(document.getElementById('sliderY').value);
  if (designTex && shirtModel) buildDesignMesh();
};

// ── RESIZE ────────────────────────────────────
window.addEventListener('resize', () => {
  SIZE = getSize();
  renderer.setSize(SIZE, SIZE);
  canvasEl.style.cssText = `width:${SIZE}px;height:${SIZE}px;`;
});

// ── RENDER LOOP ───────────────────────────────
(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();
