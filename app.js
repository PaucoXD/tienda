/**
 * Draguz Shop — app.js v6
 * Fix principal: designMesh es hijo del modelo → rota con él
 * Mejora: iluminación de estudio con sombras suaves
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── TAMAÑO RESPONSIVO ─────────────────────────
const canvasEl = document.getElementById('c');
const wrapEl   = canvasEl.closest('.canvas-wrap');

function getSize() {
  const w = wrapEl ? wrapEl.clientWidth - 40 : 380;
  return Math.max(260, Math.min(w, 520));
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
    canvas: canvasEl, alpha: true, antialias: true,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
  });
} catch(e) {
  setStatus('Tu navegador no soporta WebGL 3D');
  throw e;
}
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputEncoding      = THREE.sRGBEncoding;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;

// ── ESCENA / CÁMARA ───────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0, 3.5);

// ── CONTROLES ─────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan       = false;
controls.enableDamping   = true;
controls.dampingFactor   = 0.08;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.6;
controls.minPolarAngle   = Math.PI * 0.1;
controls.maxPolarAngle   = Math.PI * 0.9;
canvasEl.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── ILUMINACIÓN DE ESTUDIO ────────────────────
// Ambiente suave
scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));

// Key light — principal desde arriba-derecha, proyecta sombras
const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.4);
keyLight.position.set(3, 6, 5);
keyLight.castShadow              = true;
keyLight.shadow.mapSize.width    = 1024;
keyLight.shadow.mapSize.height   = 1024;
keyLight.shadow.camera.near      = 0.5;
keyLight.shadow.camera.far       = 30;
keyLight.shadow.radius           = 4;
keyLight.shadow.bias             = -0.001;
scene.add(keyLight);

// Fill light — relleno desde izquierda, sin sombras
const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.5);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

// Rim light — contraluz para definir silueta
const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
rimLight.position.set(0, -2, -4);
scene.add(rimLight);

// Hemisphere light — simula cielo/suelo (da mucha profundidad a la tela)
const hemi = new THREE.HemisphereLight(0xdde8ff, 0xfff0d0, 0.4);
scene.add(hemi);

// ── ESTADO ────────────────────────────────────
let shirtModel = null;   // referencia al grupo del GLB
let meshes     = [];
let shirtColor = '#ffffff';
let modelSize  = new THREE.Vector3(1, 1.4, 0.3);
let designMesh = null;
let designTex  = null;
let dp         = { scale: 0.5, offsetX: 0.0, offsetY: 0.0 };
let modelReady = false;

// ── HELPERS UI ────────────────────────────────
function setStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}
function hideLoader() {
  const el = document.getElementById('canvasLoader');
  if (el) el.style.display = 'none';
}

// ── PLANO DEL DISEÑO (hijo del modelo) ────────
// Al ser hijo de shirtModel, hereda su rotación automáticamente
function buildDesignMesh() {
  if (designMesh) {
    if (designMesh.parent) designMesh.parent.remove(designMesh);
    designMesh.geometry.dispose();
    designMesh.material.dispose();
    designMesh = null;
  }
  if (!designTex || !shirtModel) return;

  const img   = designTex.image;
  const ratio = (img && img.width > 0) ? img.height / img.width : 1;
  const w     = modelSize.x * dp.scale;
  const h     = w * ratio;

  designMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map:         designTex,
      transparent: true,
      alphaTest:   0.01,
      color:       0xffffff,  // siempre blanco — nunca hereda color de prenda
      depthWrite:  false,
      depthTest:   true,
    })
  );
  designMesh.renderOrder = 1;

  // Posición LOCAL dentro del modelo — frente de la playera
  const frontZ = modelSize.z / 2 + 0.015;
  designMesh.position.set(
    modelSize.x * dp.offsetX,
    modelSize.y * dp.offsetY,
    frontZ
  );

  // ★ CLAVE: hijo del modelo, no de la escena
  shirtModel.add(designMesh);
}

// ── CARGAR GLB ────────────────────────────────
const loadTimeout = setTimeout(() => {
  if (!modelReady) {
    hideLoader();
    setStatus('⚠️ Verifica que playera.glb esté en la misma carpeta del repo.');
  }
}, 25000);

new GLTFLoader().load(
  './playera.glb',

  (gltf) => {
    clearTimeout(loadTimeout);
    modelReady = true;
    shirtModel = gltf.scene;

    // Centrar en origen
    const box    = new THREE.Box3().setFromObject(shirtModel);
    const center = box.getCenter(new THREE.Vector3());
    modelSize    = box.getSize(new THREE.Vector3());
    shirtModel.position.sub(center);

    // Ajustar cámara
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    camera.position.set(0, modelSize.y * 0.05, maxDim * 1.9);
    controls.target.set(0, 0, 0);
    controls.minDistance = maxDim * 0.6;
    controls.maxDistance = maxDim * 6;
    controls.update();

    // Material PBR con detalles de tela
    shirtModel.traverse(child => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.castShadow    = true;
      child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({
        color:            new THREE.Color(shirtColor),
        roughness:        0.92,   // muy mate como tela
        metalness:        0.0,
        envMapIntensity:  0.2,
        side:             THREE.DoubleSide,
      });
    });

    scene.add(shirtModel);
    hideLoader();
    setStatus('Gira con mouse o dedo · Scroll para zoom');
    window.dispatchEvent(new Event('shirtLoaded'));

    if (designTex) buildDesignMesh();
  },

  (xhr) => {
    const pct = xhr.total > 0 ? Math.round(xhr.loaded / xhr.total * 100) : '';
    setStatus('Cargando modelo…' + (pct ? ` ${pct}%` : ''));
  },

  (err) => {
    clearTimeout(loadTimeout);
    hideLoader();
    console.error('GLB error:', err);
    setStatus('⚠️ No se encontró playera.glb — asegúrate de subirlo al repo.');
  }
);

// ── API PÚBLICA ───────────────────────────────

window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  // Solo afecta los meshes de la playera — designMesh usa MeshBasicMaterial
  meshes.forEach(m => m.material.color.set(hex));
};

window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);

  new THREE.TextureLoader().load(url, (tex) => {
    tex.encoding  = THREE.sRGBEncoding;
    tex.flipY     = true;
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
  canvasEl.style.width  = SIZE + 'px';
  canvasEl.style.height = SIZE + 'px';
});

// ── RENDER LOOP ───────────────────────────────
(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();
