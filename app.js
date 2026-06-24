/**
 * Draguz Shop — app.js v8
 * Sin with statements, compatible con ES modules strict mode
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// ── HELPERS UI ────────────────────────────────
function setStatus(msg) {
  const el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}
function hideLoader() {
  const el = document.getElementById('canvasLoader');
  if (el) el.style.display = 'none';
}

// ── CANVAS RESPONSIVO ─────────────────────────
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
const renderer = new THREE.WebGLRenderer({
  canvas:          canvasEl,
  alpha:           true,
  antialias:       true,
  powerPreference: 'default',
  failIfMajorPerformanceCaveat: false,
});
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
canvasEl.addEventListener('pointerdown', function() { controls.autoRotate = false; });

// ── ILUMINACIÓN ───────────────────────────────
scene.add(new THREE.AmbientLight(0xfff8f0, 0.55));
scene.add(new THREE.HemisphereLight(0xdde8ff, 0xfff0d0, 0.4));

const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.4);
keyLight.position.set(3, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width  = 1024;
keyLight.shadow.mapSize.height = 1024;
keyLight.shadow.radius = 4;
keyLight.shadow.bias   = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.5);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
rimLight.position.set(0, -2, -4);
scene.add(rimLight);

// ── ESTADO ────────────────────────────────────
let shirtModel  = null;
let meshes      = [];
let shirtColor  = '#ffffff';
let localBox    = new THREE.Box3();
let localSize   = new THREE.Vector3(1, 1.4, 0.3);
let designMesh  = null;
let designTex   = null;
let modelReady  = false;
let dp          = { scale: 0.42, offsetX: 0.0, offsetY: 0.0 };

// ── PLANO DEL DISEÑO ──────────────────────────
function buildDesignMesh() {
  if (designMesh) {
    if (designMesh.parent) designMesh.parent.remove(designMesh);
    designMesh.geometry.dispose();
    designMesh.material.dispose();
    designMesh = null;
  }
  if (!designTex || !shirtModel) return;

  var img   = designTex.image;
  var ratio = (img && img.width > 0) ? img.height / img.width : 1;
  var w     = localSize.x * dp.scale;
  var h     = w * ratio;

  var geo = new THREE.PlaneGeometry(w, h);
  var mat = new THREE.MeshBasicMaterial({
    map:         designTex,
    transparent: true,
    alphaTest:   0.01,
    color:       0xffffff,
    depthWrite:  false,
  });

  designMesh = new THREE.Mesh(geo, mat);
  designMesh.renderOrder = 2;

  var cx = localSize.x * dp.offsetX;
  var cy = localSize.y * 0.12 + localSize.y * dp.offsetY;
  var cz = localBox.max.z + 0.015;
  designMesh.position.set(cx, cy, cz);

  shirtModel.add(designMesh);
}

// ── CARGAR MODELO ─────────────────────────────
setStatus('Cargando modelo 3D…');

var loadTimeout = setTimeout(function() {
  if (!modelReady) {
    hideLoader();
    setStatus('Tiempo agotado — verifica que playera.glb esté en el repo');
  }
}, 30000);

// Verificar que el archivo existe antes de cargar
fetch('./playera.glb', { method: 'HEAD' })
  .then(function(r) {
    if (!r.ok) {
      clearTimeout(loadTimeout);
      hideLoader();
      setStatus('playera.glb no encontrado (error ' + r.status + ') — súbelo al repo');
      return;
    }
    // Archivo existe, proceder a cargar
    cargarModelo();
  })
  .catch(function() {
    // fetch falló (posible CORS en local) — intentar cargar directamente
    cargarModelo();
  });

function cargarModelo() {
  var loader = new GLTFLoader();
  loader.load(
    './playera.glb',

    function(gltf) {
      clearTimeout(loadTimeout);
      modelReady  = true;
      shirtModel  = gltf.scene;

      var box    = new THREE.Box3().setFromObject(shirtModel);
      var center = box.getCenter(new THREE.Vector3());
      localSize  = box.getSize(new THREE.Vector3());
      shirtModel.position.sub(center);

      localBox.setFromObject(shirtModel);

      var maxDim = Math.max(localSize.x, localSize.y, localSize.z);
      camera.position.set(0, localSize.y * 0.05, maxDim * 1.9);
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.6;
      controls.maxDistance = maxDim * 6;
      controls.update();

      shirtModel.traverse(function(child) {
        if (!child.isMesh) return;
        meshes.push(child);
        child.castShadow    = true;
        child.receiveShadow = true;
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

      if (designTex) buildDesignMesh();
    },

    function(xhr) {
      if (xhr.total > 0) {
        var pct = Math.round(xhr.loaded / xhr.total * 100);
        setStatus('Cargando modelo… ' + pct + '%');
      }
    },

    function(err) {
      clearTimeout(loadTimeout);
      hideLoader();
      console.error('Error GLB:', err);
      setStatus('Error al cargar playera.glb — ' + (err.message || 'verifica el archivo'));
    }
  );
}

// ── API PÚBLICA ───────────────────────────────
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(function(m) { m.material.color.set(hex); });
};

window.loadDesign = function(input) {
  var file = input.files[0];
  if (!file) return;
  var url = URL.createObjectURL(file);

  var texLoader = new THREE.TextureLoader();
  texLoader.load(url, function(tex) {
    tex.encoding  = THREE.sRGBEncoding;
    tex.flipY     = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    if (designTex) designTex.dispose();
    designTex = tex;
    buildDesignMesh();

    var prev = document.getElementById('designPreview');
    if (prev) {
      prev.innerHTML = '<img src="' + url + '" style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">';
    }
  });
};

window.updateDesign = function() {
  dp.scale   = parseFloat(document.getElementById('sliderS').value);
  dp.offsetX = parseFloat(document.getElementById('sliderX').value);
  dp.offsetY = parseFloat(document.getElementById('sliderY').value);
  if (designTex && shirtModel) buildDesignMesh();
};

// ── RESIZE ────────────────────────────────────
window.addEventListener('resize', function() {
  SIZE = getSize();
  renderer.setSize(SIZE, SIZE);
  canvasEl.style.width  = SIZE + 'px';
  canvasEl.style.height = SIZE + 'px';
});

// ── RENDER LOOP ───────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
