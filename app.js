cat > /home/claude/app.js << 'JSEOF'
/**
 * Draguz Shop — app.js v3
 * Solución definitiva:
 *  - Playera: material.color para el color, sin textura
 *  - Diseño: plano 3D (PlaneGeometry) pegado al frente, independiente
 *  - Color nunca afecta el diseño
 *  - Posición y tamaño controlados en espacio 3D
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── RENDERER ──────────────────────────────────
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(420, 420);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding      = THREE.sRGBEncoding;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ── ESCENA Y CÁMARA ───────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0, 3.5);

// ── CONTROLES ─────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan       = false;
controls.enableDamping   = true;
controls.dampingFactor   = 0.07;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.8;
controls.minPolarAngle   = Math.PI * 0.15;
controls.maxPolarAngle   = Math.PI * 0.85;
canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── ILUMINACIÓN ───────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const key = new THREE.DirectionalLight(0xfffaf0, 1.0);
key.position.set(2, 5, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xe8f0ff, 0.35);
fill.position.set(-3, 1, 2);
scene.add(fill);

// ── ESTADO ────────────────────────────────────
let model      = null;
let meshes     = [];
let shirtColor = '#ffffff';
let modelSize  = new THREE.Vector3(1, 1.4, 0.3); // se actualiza con el modelo real

// Plano 3D que lleva el diseño — independiente de la playera
let designPlane = null;
let designTex   = null;

// Parámetros del plano en espacio local del modelo
let dp = {
  scale:   0.55,   // tamaño relativo al ancho del modelo
  offsetX: 0.0,    // desplazamiento horizontal
  offsetY: 0.05,   // ligeramente arriba del centro
};

// ── CREAR EL PLANO DEL DISEÑO ─────────────────
function createDesignPlane(frontZ) {
  if (designPlane) scene.remove(designPlane);

  const w = modelSize.x * dp.scale;
  const h = w; // cuadrado por defecto, se ajusta al cargar la imagen

  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map:         designTex,
    transparent: true,
    depthTest:   false,   // siempre visible sobre la playera
    side:        THREE.FrontSide,
  });

  designPlane = new THREE.Mesh(geo, mat);
  designPlane.position.set(
    modelSize.x * dp.offsetX,
    modelSize.y * dp.offsetY,
    frontZ + 0.01  // justo frente a la playera
  );
  designPlane.renderOrder = 1;
  scene.add(designPlane);
}

function updateDesignPlane() {
  if (!designPlane || !model) return;

  const frontZ = modelSize.z / 2;
  const w = modelSize.x * dp.scale;

  // Mantener proporciones de la imagen
  let h = w;
  if (designTex && designTex.image) {
    const ratio = designTex.image.height / designTex.image.width;
    h = w * ratio;
  }

  designPlane.geometry.dispose();
  designPlane.geometry = new THREE.PlaneGeometry(w, h);
  designPlane.position.set(
    modelSize.x * dp.offsetX,
    modelSize.y * dp.offsetY,
    frontZ + 0.01
  );
}

// ── CARGAR MODELO ─────────────────────────────
const loader = new GLTFLoader();

loader.load(
  'playera.glb',
  (gltf) => {
    model = gltf.scene;

    // Centrar
    const box    = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    modelSize    = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    // Ajustar cámara
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    camera.position.z        = maxDim * 1.85;
    controls.minDistance     = maxDim * 0.7;
    controls.maxDistance     = maxDim * 5;

    // Materiales PBR — solo color, sin textura
    model.traverse(child => {
      if (!child.isMesh) return;
      meshes.push(child);
      child.material = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(shirtColor),
        roughness: 0.85,
        metalness: 0.0,
        side:      THREE.DoubleSide,
      });
    });

    scene.add(model);
    window.dispatchEvent(new Event('shirtLoaded'));
    setStatus('Listo — gira con mouse o dedo');
  },
  xhr => {
    if (xhr.total) setStatus(`Cargando… ${Math.round(xhr.loaded / xhr.total * 100)}%`);
  },
  err => { console.error(err); setStatus('Error al cargar el modelo'); }
);

function setStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}

// ── API PÚBLICA ───────────────────────────────

/** Cambia SOLO el color de la playera — el diseño no se toca */
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(m => m.material.color.set(hex));
  // El designPlane usa MeshBasicMaterial — el color de la prenda no lo afecta nunca
};

/** Carga la imagen y la pega en el plano 3D del frente */
window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  if (designTex) designTex.dispose();

  designTex = new THREE.TextureLoader().load(url, (tex) => {
    tex.encoding = THREE.sRGBEncoding;

    if (!designPlane) {
      const frontZ = modelSize.z / 2;
      createDesignPlane(frontZ);
    } else {
      designPlane.material.map = tex;
      designPlane.material.needsUpdate = true;
      updateDesignPlane();
    }

    // Miniatura
    const prev = document.getElementById('designPreview');
    if (prev) prev.innerHTML = `<img src="${url}" style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">`;
  });
};

/** Actualiza posición/tamaño desde los sliders */
window.updateDesign = function() {
  dp.scale   = parseFloat(document.getElementById('sliderS').value);
  dp.offsetX = parseFloat(document.getElementById('sliderX').value);
  dp.offsetY = parseFloat(document.getElementById('sliderY').value);
  updateDesignPlane();
};

// ── LOOP ──────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
JSEOF
echo "app.js v3 OK"
