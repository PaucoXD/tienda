/**
 * Draguz Shop — app.js
 * Three.js r132 | GLTFLoader | OrbitControls
 * Mejoras: UV mapping por zona, materiales PBR, iluminación de estudio
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ─────────────────────────────────────────────
// 1. RENDERIZADOR
// ─────────────────────────────────────────────
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(320, 320);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled  = true;
renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
renderer.outputEncoding     = THREE.sRGBEncoding;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// ─────────────────────────────────────────────
// 2. ESCENA Y CÁMARA
// ─────────────────────────────────────────────
const scene  = new THREE.Scene();
scene.background = null; // transparente — el CSS maneja el fondo

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.2, 5.5);

// ─────────────────────────────────────────────
// 3. CONTROLES
// ─────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan    = false;
controls.minDistance  = 2.5;
controls.maxDistance  = 9;
controls.minPolarAngle = Math.PI * 0.2;
controls.maxPolarAngle = Math.PI * 0.85;
controls.autoRotate   = true;
controls.autoRotateSpeed = 1.2;
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Detener auto-rotate al tocar
renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ─────────────────────────────────────────────
// 4. ILUMINACIÓN DE ESTUDIO
// ─────────────────────────────────────────────
// Luz ambiente suave
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

// Luz principal (key light) — arriba-izquierda
const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.1);
keyLight.position.set(3, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far  = 30;
scene.add(keyLight);

// Luz de relleno (fill light) — lado opuesto, más débil
const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.4);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

// Rim light — contraluz sutil para definir silueta
const rimLight = new THREE.DirectionalLight(0xffffff, 0.25);
rimLight.position.set(0, -2, -5);
scene.add(rimLight);

// ─────────────────────────────────────────────
// 5. ESTADO DEL EDITOR
// ─────────────────────────────────────────────
let shirtModel      = null;
let meshes          = [];          // todos los Mesh de la playera
let designTexture   = null;        // textura del diseño subido
let currentColor    = '#ffffff';   // color actual de la prenda
let activeZone      = 'frente';    // zona activa: 'frente' | 'espalda' | 'manga'

// Canvas 2D para compositar diseño sobre textura base
const offscreen     = document.createElement('canvas');
offscreen.width     = 1024;
offscreen.height    = 1024;
const offCtx        = offscreen.getContext('2d');

// Textura Three.js derivada del canvas 2D
let canvasTexture   = null;

// ─────────────────────────────────────────────
// 6. CARGAR MODELO
// ─────────────────────────────────────────────
const loader = new GLTFLoader();

loader.load(
  'playera.glb',
  (gltf) => {
    shirtModel = gltf.scene;

    // Centrar el modelo automáticamente
    const box = new THREE.Box3().setFromObject(shirtModel);
    const center = box.getCenter(new THREE.Vector3());
    shirtModel.position.sub(center);

    // Recolectar meshes y configurar materiales PBR
    shirtModel.traverse((child) => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.castShadow    = true;
      child.receiveShadow = true;

      // Convertir a MeshStandardMaterial para PBR
      const mat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(currentColor),
        roughness: 0.88,   // tela mate
        metalness: 0.0,
        side:      THREE.DoubleSide,
      });

      // Preservar el mapa UV original si existe
      if (child.material && child.material.map) {
        mat.map = child.material.map;
      }

      child.material = mat;
    });

    scene.add(shirtModel);
    updateStatus('Modelo cargado — gira con el mouse');
  },
  (progress) => {
    const pct = Math.round((progress.loaded / progress.total) * 100);
    updateStatus(`Cargando modelo… ${pct}%`);
  },
  (error) => {
    console.error('Error cargando playera.glb:', error);
    updateStatus('Error al cargar el modelo 3D');
  }
);

function updateStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}

// ─────────────────────────────────────────────
// 7. COMPOSITAR DISEÑO EN CANVAS 2D
// ─────────────────────────────────────────────

/**
 * Zonas de impresión — coordenadas UV normalizadas (0–1024 px en canvas 1024×1024)
 * Ajusta estos valores si tu UV map difiere.
 */
const ZONES = {
  frente:  { x: 280, y: 200, w: 460, h: 460 },
  espalda: { x: 280, y: 200, w: 460, h: 460 },
  manga:   { x: 100, y: 300, w: 200, h: 200 },
};

// Almacena el diseño por zona
const zoneDesigns = { frente: null, espalda: null, manga: null };

function rebuildTexture() {
  const z = ZONES[activeZone];

  offCtx.clearRect(0, 0, 1024, 1024);

  // Fondo del color de la prenda (simula la tela)
  offCtx.fillStyle = currentColor;
  offCtx.fillRect(0, 0, 1024, 1024);

  // Dibujar diseños de todas las zonas
  Object.entries(zoneDesigns).forEach(([zone, img]) => {
    if (!img) return;
    const zd = ZONES[zone];
    offCtx.save();
    offCtx.globalCompositeOperation = 'multiply';
    offCtx.globalAlpha = 0.92;
    offCtx.drawImage(img, zd.x, zd.y, zd.w, zd.h);
    offCtx.restore();
  });

  // Actualizar/crear textura Three.js
  if (!canvasTexture) {
    canvasTexture = new THREE.CanvasTexture(offscreen);
    canvasTexture.flipY      = false;
    canvasTexture.encoding   = THREE.sRGBEncoding;
    canvasTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  } else {
    canvasTexture.needsUpdate = true;
  }

  // Aplicar a todos los meshes
  meshes.forEach((mesh) => {
    mesh.material.map   = canvasTexture;
    mesh.material.color = new THREE.Color('#ffffff'); // color lo maneja el canvas
    mesh.material.needsUpdate = true;
  });
}

// ─────────────────────────────────────────────
// 8. API PÚBLICA — llamada desde index.html
// ─────────────────────────────────────────────

/** Cambia el color base de la prenda */
window.cambiarColorPlayera = function(hex) {
  currentColor = hex;

  if (meshes.length === 0) return;

  if (canvasTexture) {
    // Si ya hay textura, recompositar
    rebuildTexture();
  } else {
    // Sin diseño, solo cambiar el color del material
    meshes.forEach((m) => m.material.color.set(hex));
  }
};

/** Carga la imagen del input y la aplica a la zona activa */
window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    zoneDesigns[activeZone] = img;
    rebuildTexture();

    // Preview miniatura en el panel
    const preview = document.getElementById('designPreview');
    if (preview) {
      preview.innerHTML = `<img src="${url}" alt="diseño">`;
    }
    URL.revokeObjectURL(url);
  };

  img.onerror = () => updateStatus('No se pudo cargar la imagen');
  img.src = url;
};

/** Cambia la zona de impresión activa */
window.setZone = function(zone, btn) {
  activeZone = zone;
  document.querySelectorAll('.zone-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Rotar la cámara suavemente hacia la zona
  if (zone === 'espalda') {
    gsTo(camera.position, { x: 0, z: -5.5 });
  } else if (zone === 'frente') {
    gsTo(camera.position, { x: 0, z: 5.5 });
  } else if (zone === 'manga') {
    gsTo(camera.position, { x: -4, z: 3.5 });
  }
};

/** Mini tween manual para mover la cámara suavemente */
function gsTo(obj, target, dur = 0.6) {
  const start = { x: obj.x, y: obj.y, z: obj.z };
  const t0    = performance.now();
  const ms    = dur * 1000;

  function step(now) {
    const t = Math.min((now - t0) / ms, 1);
    const e = t < .5 ? 2*t*t : -1 + (4 - 2*t)*t; // ease in-out
    if (target.x !== undefined) obj.x = start.x + (target.x - start.x) * e;
    if (target.y !== undefined) obj.y = start.y + (target.y - start.y) * e;
    if (target.z !== undefined) obj.z = start.z + (target.z - start.z) * e;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─────────────────────────────────────────────
// 9. LOOP DE RENDERIZADO
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ─────────────────────────────────────────────
// 10. RESIZE RESPONSIVO
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const size = Math.min(wrap.clientWidth - 40, 420);
  renderer.setSize(size, size);
  camera.updateProjectionMatrix();
});
