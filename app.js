/**
 * Draguz Shop — app.js v10
 * Fix definitivo:
 * - Raycaster para encontrar el frente REAL de la playera
 * - buildDesignMesh no se llama múltiples veces
 * - Playera opaca con bordes visibles
 */

import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader }    from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

function setStatus(msg) {
  var el = document.getElementById('canvasStatus');
  if (el) el.textContent = msg;
}
function hideLoader() {
  var el = document.getElementById('canvasLoader');
  if (el) el.style.display = 'none';
}

// ── CANVAS ────────────────────────────────────
var canvasEl = document.getElementById('c');
var wrapEl   = canvasEl.closest('.canvas-wrap');
function getSize() {
  var w = wrapEl ? wrapEl.clientWidth - 40 : 380;
  return Math.max(260, Math.min(w, 520));
}
var SIZE = getSize();
canvasEl.width  = SIZE;
canvasEl.height = SIZE;
canvasEl.style.width  = SIZE + 'px';
canvasEl.style.height = SIZE + 'px';

// ── RENDERER ──────────────────────────────────
var renderer = new THREE.WebGLRenderer({
  canvas: canvasEl, alpha: true, antialias: true,
  powerPreference: 'default',
});
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping    = THREE.NoToneMapping;

// ── ESCENA / CÁMARA ───────────────────────────
var scene  = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0, 3.5);

// ── CONTROLES ─────────────────────────────────
var controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan       = false;
controls.enableDamping   = true;
controls.dampingFactor   = 0.08;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.6;
controls.minPolarAngle   = Math.PI * 0.1;
controls.maxPolarAngle   = Math.PI * 0.9;
canvasEl.addEventListener('pointerdown', function() { controls.autoRotate = false; });

// ── ILUMINACIÓN ───────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
var key = new THREE.DirectionalLight(0xffffff, 0.6);
key.position.set(2, 4, 5);
scene.add(key);
var fill = new THREE.DirectionalLight(0xffffff, 0.3);
fill.position.set(-3, 1, 2);
scene.add(fill);

// ── ESTADO ────────────────────────────────────
var shirtModel  = null;
var meshes      = [];
var shirtColor  = '#ffffff';
var bsize       = new THREE.Vector3();
var designMesh  = null;
var designTex   = null;
var modelReady  = false;
var dp          = { scale: 0.45, offsetX: 0.0, offsetY: 0.0 };

// Posición real del frente (encontrada con raycaster)
var frontZ      = 0.1;
var modelCenterY = 0;

// ── ENCONTRAR FRENTE CON RAYCASTER ────────────
function findFrontZ() {
  // Lanzar rayos desde adelante hacia el modelo para encontrar el Z real del frente
  var raycaster = new THREE.Raycaster();
  var origin    = new THREE.Vector3(0, modelCenterY, 10); // desde adelante
  var direction = new THREE.Vector3(0, 0, -1);            // hacia el modelo
  raycaster.set(origin, direction);

  var hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    frontZ = hits[0].point.z;
    console.log('Frente detectado con raycaster: Z =', frontZ.toFixed(4));
  } else {
    // Fallback: usar bbox
    var box = new THREE.Box3().setFromObject(shirtModel);
    frontZ  = box.max.z;
    console.log('Raycaster sin hit, usando bbox.max.z:', frontZ.toFixed(4));
  }
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

  var img   = designTex.image;
  var ratio = (img && img.width > 0) ? img.height / img.width : 1;
  var w     = bsize.x * dp.scale;
  var h     = w * ratio;

  designMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map:         designTex,
      transparent: true,
      alphaTest:   0.01,
      color:       0xffffff,
      depthWrite:  false,
    })
  );
  designMesh.renderOrder = 2;

  // Usar el Z real encontrado por raycaster
  var px = bsize.x * dp.offsetX;
  var py = modelCenterY + bsize.y * (0.18 + dp.offsetY);
  var pz = frontZ + 0.02;

  designMesh.position.set(px, py, pz);
  shirtModel.add(designMesh);

  console.log('Diseño colocado en:', px.toFixed(3), py.toFixed(3), pz.toFixed(3),
    '| bsize:', bsize.x.toFixed(3), bsize.y.toFixed(3), bsize.z.toFixed(3));
}

// ── CARGAR MODELO ─────────────────────────────
setStatus('Cargando modelo 3D…');

var loadTimeout = setTimeout(function() {
  if (!modelReady) {
    hideLoader();
    setStatus('Tiempo agotado — verifica que playera.glb esté en el repo');
  }
}, 30000);

function cargarModelo() {
  var loader = new GLTFLoader();
  loader.load('./playera.glb',

    function onLoad(gltf) {
      clearTimeout(loadTimeout);
      modelReady = true;
      shirtModel = gltf.scene;

      // Centrar en origen
      var box    = new THREE.Box3().setFromObject(shirtModel);
      var center = box.getCenter(new THREE.Vector3());
      var size   = box.getSize(new THREE.Vector3());
      shirtModel.position.sub(center);
      bsize.copy(size);
      modelCenterY = 0; // después de centrar, centro Y = 0

      // Ajustar cámara
      var maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(0, size.y * 0.05, maxDim * 1.9);
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.5;
      controls.maxDistance = maxDim * 7;
      controls.update();

      // Material opaco
      shirtModel.traverse(function(child) {
        if (!child.isMesh) return;
        meshes.push(child);
        child.material = new THREE.MeshStandardMaterial({
          color:       new THREE.Color(shirtColor),
          roughness:   0.85,
          metalness:   0.0,
          side:        THREE.DoubleSide,
          transparent: false,
          opacity:     1.0,
        });
      });

      scene.add(shirtModel);

      // Encontrar frente real con raycaster DESPUÉS de agregar a la escena
      findFrontZ();

      hideLoader();
      setStatus('Gira con mouse o dedo · Scroll para zoom');
      window.dispatchEvent(new Event('shirtLoaded'));

      if (designTex) buildDesignMesh();
    },

    function onProgress(xhr) {
      if (xhr.total > 0) {
        setStatus('Cargando… ' + Math.round(xhr.loaded / xhr.total * 100) + '%');
      }
    },

    function onError(err) {
      clearTimeout(loadTimeout);
      hideLoader();
      console.error('GLB error:', err);
      setStatus('Error al cargar playera.glb');
    }
  );
}

fetch('./playera.glb', { method: 'HEAD' })
  .then(function(r) {
    if (!r.ok) {
      clearTimeout(loadTimeout);
      hideLoader();
      setStatus('playera.glb no encontrado (HTTP ' + r.status + ')');
      return;
    }
    cargarModelo();
  })
  .catch(function() { cargarModelo(); });

// ── API PÚBLICA ───────────────────────────────
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(function(m) { m.material.color.set(hex); });
};

window.loadDesign = function(input) {
  var file = input.files[0];
  if (!file) return;
  var url = URL.createObjectURL(file);
  new THREE.TextureLoader().load(url, function(tex) {
    tex.encoding  = THREE.sRGBEncoding;
    tex.flipY     = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (designTex) designTex.dispose();
    designTex = tex;
    buildDesignMesh();
    var prev = document.getElementById('designPreview');
    if (prev) prev.innerHTML =
      '<img src="' + url + '" style="max-height:56px;max-width:100%;object-fit:contain;border-radius:6px;">';
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
