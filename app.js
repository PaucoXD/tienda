/**
 * Draguz Shop — app.js v4
 * Fixes:
 *  - Diseño ya NO se voltea (flipY correcto)
 *  - Color de prenda NUNCA afecta el diseño
 *  - Carga en móvil (canvas responsivo desde inicio)
 *  - Modelo carga correctamente con fallback de tamaño
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── TAMAÑO RESPONSIVO ─────────────────────────
const canvasEl  = document.getElementById('c');
const wrap      = canvasEl.parentElement;

function getSize() {
  const w = Math.min(wrap.clientWidth - 40, 520);
  return w;
}

let SIZE = getSize();
canvasEl.width  = SIZE;
canvasEl.height = SIZE;

// ── RENDERER ──────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas:    canvasEl,
  alpha:     true,
  antialias: true,
  powerPreference: 'default',   // compatible con móvil
});
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding      = THREE.sRGBEncoding;
renderer.toneMapping         = THREE.NoToneMapping; // sin tone mapping para evitar tinte

// ── ESCENA Y CÁMARA ───────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0, 3.5);

// ── CONTROLES ─────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan       = false;
controls.enableDamping   = true;
controls.dampingFactor   = 0.07;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.7;
controls.minPolarAngle   = Math.PI * 0.1;
controls.maxPolarAngle   = Math.PI * 0.9;
canvasEl.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── ILUMINACIÓN ───────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const key  = new THREE.DirectionalLight(0xffffff, 0.8);
key.position.set(2, 4, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.3);
fill.position.set(-3, 1, 2);
scene.add(fill);

// ── ESTADO ────────────────────────────────────
let model      = null;
let meshes     = [];
let shirtColor = '#ffffff';
let modelBox   = new THREE.Box3();
let modelSize  = new THREE.Vector3(1, 1.4, 0.3);

// Plano 3D del diseño — completamente independiente de la playera
let designMesh = null;
let designTex  = null;

let dp = { scale: 0.5, offsetX: 0.0, offsetY: 0.0 };

// ── PLANO DEL DISEÑO ──────────────────────────
function buildDesignMesh() {
  if (designMesh) {
    scene.remove(designMesh);
    designMesh.geometry.dispose();
  }

  if (!designTex) return;

  // Calcular tamaño manteniendo proporción de la imagen
  const img   = designTex.image;
  const ratio = img ? img.height / img.width : 1;
  const w     = modelSize.x * dp.scale;
  const h     = w * ratio;

  const geo = new THREE.PlaneGeometry(w, h);

  // MeshBasicMaterial con color SIEMPRE blanco — nunca hereda el color de la playera
  const mat = new THREE.MeshBasicMaterial({
    map:         designTex,
    transparent: true,
    alphaTest:   0.01,
    color:       0xffffff,    // forzado blanco — el color de la prenda NO lo cambia
    depthWrite:  false,
    side:        THREE.FrontSide,
  });

  designMesh = new THREE.Mesh(geo, mat);
  designMesh.renderOrder = 999; // siempre encima

  // Posicionar en el frente de la playera
  const frontZ = modelSize.z / 2 + 0.015;
  designMesh.position.set(
    modelSize.x  * dp.offsetX,
    modelSize.y  * dp.offsetY,
    frontZ
  );

  scene.add(designMesh);
}

// ── CARGAR MODELO ─────────────────────────────
const loader = new GLTFLoader();
let loadedOk = false;

loader.load(
  'playera.glb',
  (gltf) => {
    loadedOk = true;
    model = gltf.scene;

    // Centrar modelo en origen
    const box    = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    modelSize    = box.getSize(new THREE.Vector3());
    modelBox     = box;
    model.position.sub(center);

    // Ajustar cámara al tamaño real
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    camera.position.set(0, 0, maxDim * 1.9);
    controls.minDistance = maxDim * 0.6;
    controls.maxDistance = maxDim * 6;

    // Aplicar material PBR limpio — solo color, sin textura
    model.traverse(child => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.castShadow    = true;
      child.receiveShadow = true;
      child.material = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(shirtColor),
        roughness: 0.82,
        metalness: 0.0,
        side:      THREE.DoubleSide,
        envMapIntensity: 0,
      });
    });

    scene.add(model);

    // Ocultar loader
    const loader2 = document.getElementById('canvasLoader');
    if (loader2) loader2.style.display = 'none';
    setStatus('Listo — gira con mouse o dedo');
    window.dispatchEvent(new Event('shirtLoaded'));

    // Si ya había diseño pendiente, colocarlo ahora
    if (designTex) buildDesignMesh();
  },
  (xhr) => {
    if (xhr.total > 0) {
      setStatus(`Cargando… ${Math.round(xhr.loaded / xhr.total * 100)}%`);
    }
  },
  (err) => {
    console.error('GLB error:', err);
    setStatus('Error al cargar — verifica que playera.glb esté en la misma carpeta');
  }
);

function setStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}

// ── API PÚBLICA ───────────────────────────────

/** Cambia SOLO el color de la playera. El plano del diseño usa MeshBasicMaterial
 *  con color:0xffffff — nunca hereda el color de la prenda. */
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(m => m.material.color.set(hex));
  // designMesh no se toca — su material.color es siempre 0xffffff
};

/** Carga imagen del usuario y la coloca en el plano 3D del frente */
window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const texLoader = new THREE.TextureLoader();

  texLoader.load(url, (tex) => {
    tex.encoding = THREE.sRGBEncoding;
    tex.flipY    = true;   // THREE.js espera flipY=true para imágenes normales

    if (designTex) designTex.dispose();
    designTex = tex;

    buildDesignMesh();

    // Miniatura en panel
    const prev = document.getElementById('designPreview');
    if (prev) {
      prev.innerHTML = `<img src="${url}"
        style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">`;
    }
  });
};

/** Actualiza posición/tamaño desde los sliders */
window.updateDesign = function() {
  dp.scale   = parseFloat(document.getElementById('sliderS').value);
  dp.offsetX = parseFloat(document.getElementById('sliderX').value);
  dp.offsetY = parseFloat(document.getElementById('sliderY').value);
  buildDesignMesh();
};

// ── RESIZE RESPONSIVO ─────────────────────────
window.addEventListener('resize', () => {
  SIZE = getSize();
  renderer.setSize(SIZE, SIZE);
  camera.updateProjectionMatrix();
});

// ── LOOP ──────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
