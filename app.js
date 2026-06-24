/**
 * Draguz Shop — app.js v9
 * - Material correcto (no transparente)
 * - Diseño centrado en pecho con valores absolutos del bbox real
 * - flipY dinámico según orientación del modelo
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
// Sin toneMapping — colores directos, sin procesamiento que aclare la tela
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
// Ambient fuerte para que la tela no quede oscura
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

var key = new THREE.DirectionalLight(0xffffff, 0.8);
key.position.set(2, 4, 5);
scene.add(key);

var fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-3, 1, 2);
scene.add(fill);

// ── ESTADO ────────────────────────────────────
var shirtModel = null;
var meshes     = [];
var shirtColor = '#ffffff';
var bbox       = new THREE.Box3();
var bsize      = new THREE.Vector3();
var designMesh = null;
var designTex  = null;
var modelReady = false;
var dp         = { scale: 0.45, offsetX: 0.0, offsetY: 0.0 };

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

  // Posición en coordenadas locales del modelo
  // offsetY positivo = zona pecho (arriba del centro)
  var px = bsize.x * dp.offsetX;
  var py = bsize.y * (0.15 + dp.offsetY);  // 15% arriba del centro = pecho
  var pz = bbox.max.z + 0.02;              // frente del modelo

  designMesh.position.set(px, py, pz);
  shirtModel.add(designMesh);

  // Debug en consola
  console.log('BBox:', {
    min: bbox.min.toArray().map(function(v){return v.toFixed(3);}),
    max: bbox.max.toArray().map(function(v){return v.toFixed(3);}),
    size: bsize.toArray().map(function(v){return v.toFixed(3);}),
    designPos: [px.toFixed(3), py.toFixed(3), pz.toFixed(3)]
  });
}

// ── CARGAR MODELO ─────────────────────────────
setStatus('Cargando modelo 3D…');

var loadTimeout = setTimeout(function() {
  if (!modelReady) {
    hideLoader();
    setStatus('Tiempo de carga agotado — verifica playera.glb en el repo');
  }
}, 30000);

function cargarModelo() {
  var loader = new GLTFLoader();
  loader.load(
    './playera.glb',

    function onLoad(gltf) {
      clearTimeout(loadTimeout);
      modelReady = true;
      shirtModel = gltf.scene;

      // Centrar modelo en origen
      var worldBox = new THREE.Box3().setFromObject(shirtModel);
      var center   = worldBox.getCenter(new THREE.Vector3());
      shirtModel.position.sub(center);

      // Recalcular bbox en coordenadas locales (ya centrado)
      bbox.setFromObject(shirtModel);
      bbox.getSize(bsize);

      console.log('Modelo centrado. BBox local:', {
        min: bbox.min.toArray().map(function(v){return v.toFixed(3);}),
        max: bbox.max.toArray().map(function(v){return v.toFixed(3);}),
        size: bsize.toArray().map(function(v){return v.toFixed(3);})
      });

      // Ajustar cámara al tamaño real
      var maxDim = Math.max(bsize.x, bsize.y, bsize.z);
      camera.position.set(0, bsize.y * 0.05, maxDim * 1.9);
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.5;
      controls.maxDistance = maxDim * 7;
      controls.update();

      // Material tela — opaco, sin transparencia
      shirtModel.traverse(function(child) {
        if (!child.isMesh) return;
        meshes.push(child);
        child.material = new THREE.MeshStandardMaterial({
          color:     new THREE.Color(shirtColor),
          roughness: 0.85,
          metalness: 0.0,
          side:      THREE.DoubleSide,
          transparent: false,
          opacity:     1.0,
        });
      });

      scene.add(shirtModel);
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

// Verificar que el archivo existe, luego cargar
fetch('./playera.glb', { method: 'HEAD' })
  .then(function(r) {
    if (!r.ok) {
      clearTimeout(loadTimeout);
      hideLoader();
      setStatus('playera.glb no encontrado (HTTP ' + r.status + ') — súbelo al repo');
      return;
    }
    cargarModelo();
  })
  .catch(function() {
    cargarModelo(); // intentar de todos modos (falla en local por CORS)
  });

// ── API PÚBLICA ───────────────────────────────
window.cambiarColorPlayera = function(hex) {
  shirtColor = hex;
  meshes.forEach(function(m) { m.material.color.set(hex); });
};

window.loadDesign = function(input) {
  var file = input.files[0];
  if (!file) return;
  var url = URL.createObjectURL(file);
  var tl  = new THREE.TextureLoader();

  tl.load(url, function(tex) {
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
