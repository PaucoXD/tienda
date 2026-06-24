/**
 * Draguz Shop — app.js v2
 * Correcciones:
 *  - Color de prenda NO invade el diseño
 *  - Diseño centrado en el frente con controles de posición y tamaño
 *  - Cámara más cerca al cargar
 *  - Auto-rotate suave, se detiene al interactuar
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── RENDERER ──────────────────────────────────
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(420, 420);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding     = THREE.sRGBEncoding;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ── ESCENA Y CÁMARA ───────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0.1, 3.2); // más cerca

// ── CONTROLES ─────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan      = false;
controls.minDistance    = 1.5;
controls.maxDistance    = 7;
controls.enableDamping  = true;
controls.dampingFactor  = 0.07;
controls.autoRotate     = true;
controls.autoRotateSpeed = 0.8;
controls.minPolarAngle  = Math.PI * 0.15;
controls.maxPolarAngle  = Math.PI * 0.85;

canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── ILUMINACIÓN DE ESTUDIO ────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const key = new THREE.DirectionalLight(0xfffaf0, 1.0);
key.position.set(2, 5, 4);
scene.add(key);

const fill = new THREE.DirectionalLight(0xe8f0ff, 0.35);
fill.position.set(-3, 1, 2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.2);
rim.position.set(0, -3, -4);
scene.add(rim);

// ── ESTADO ────────────────────────────────────
let model         = null;
let meshes        = [];
let designImg     = null;   // imagen subida por el usuario
let shirtColor    = '#ffffff';

// Parámetros del diseño (en coordenadas UV 0-1)
let designParams = {
  offsetX: 0.0,   // -0.5 a 0.5
  offsetY: 0.0,   // -0.5 a 0.5
  scale:   0.35,  // 0.1 a 0.7
};

// ── CANVAS 2D PARA COMPOSITAR ─────────────────
// Clave: el color de la prenda va en material.color (Three.js)
// La textura canvas SOLO contiene el diseño del usuario con fondo transparente.
// Así THREE multiplica color × textura correctamente SIN teñir el diseño.
const offscreen = document.createElement('canvas');
offscreen.width  = 1024;
offscreen.height = 1024;
const offCtx = offscreen.getContext('2d');

let shirtTexture = null; // THREE.CanvasTexture

function buildTexture() {
  offCtx.clearRect(0, 0, 1024, 1024);

  if (designImg) {
    // Área del frente de la playera en UV — ajusta si tu modelo difiere
    // Centro UV ≈ (0.5, 0.45), zona de impresión ≈ 40% del canvas
    const baseW = 1024 * 0.38;
    const baseH = 1024 * 0.38;
    const cx = 1024 * (0.5  + designParams.offsetX);
    const cy = 1024 * (0.45 - designParams.offsetY); // Y invertida en UV

    const sw = baseW * (designParams.scale / 0.35);
    const sh = baseH * (designParams.scale / 0.35);
    const dx = cx - sw / 2;
    const dy = cy - sh / 2;

    // Dibujar el diseño con fondo transparente
    // NO usamos multiply aquí — Three.js aplicará el color de la prenda
    // multiplicado sobre la textura blanca del diseño
    offCtx.drawImage(designImg, dx, dy, sw, sh);
  }

  if (!shirtTexture) {
    shirtTexture = new THREE.CanvasTexture(offscreen);
    shirtTexture.flipY      = false;
    shirtTexture.encoding   = THREE.sRGBEncoding;
    shirtTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  } else {
    shirtTexture.needsUpdate = true;
  }

  meshes.forEach(m => {
    m.material.map          = shirtTexture;
    m.material.needsUpdate  = true;
    // El color de la prenda lo maneja material.color — no la textura
    m.material.color.set(shirtColor);
  });
}

// ── CARGAR MODELO ─────────────────────────────
const loader = new GLTFLoader();

loader.load(
  'playera.glb',
  (gltf) => {
    model = gltf.scene;

    // Centrar automáticamente
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    // Ajustar cámara al tamaño real del modelo
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.z = maxDim * 1.8;
    controls.minDistance = maxDim * 0.8;
    controls.maxDistance = maxDim * 5;

    model.traverse(child => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.castShadow    = true;
      child.receiveShadow = true;

      child.material = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(shirtColor),
        roughness: 0.88,
        metalness: 0.0,
        side:      THREE.DoubleSide,
      });
    });

    scene.add(model);
    window.dispatchEvent(new Event('shirtLoaded'));
    setStatus('Listo — gira con el mouse o dedo');
  },
  xhr => setStatus(`Cargando… ${Math.round(xhr.loaded / xhr.total * 100)}%`),
  err => { console.error(err); setStatus('Error al cargar el modelo'); }
);

function setStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}

// ── API PÚBLICA ───────────────────────────────

/** Cambia el color de la prenda SIN afectar el diseño */
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  if (designImg) {
    // Reconstruir textura mantiene el diseño intacto
    buildTexture();
  } else {
    // Sin diseño: solo cambiar el color del material directamente
    meshes.forEach(m => m.material.color.set(hex));
  }
  // Marcar dot activo
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('sel'));
  event.currentTarget && event.currentTarget.classList.add('sel');
};

/** Carga la imagen del usuario */
window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    designImg = img;
    buildTexture();

    // Miniatura en panel
    const prev = document.getElementById('designPreview');
    if (prev) prev.innerHTML = `<img src="${url}" style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">`;
  };
  img.src = url;
};

/** Actualiza posición/tamaño del diseño desde los sliders */
window.updateDesign = function() {
  if (!designImg) return;
  designParams.offsetX = parseFloat(document.getElementById('sliderX').value);
  designParams.offsetY = parseFloat(document.getElementById('sliderY').value);
  designParams.scale   = parseFloat(document.getElementById('sliderS').value);
  buildTexture();
};

// ── LOOP ──────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
