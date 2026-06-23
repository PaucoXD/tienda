import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

// 1. Configuración del Renderizador
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
renderer.setSize(320, 320);
renderer.setPixelRatio(window.devicePixelRatio);

// 2. Escena y Cámara
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 5);

// 3. Controles interactivos
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 8;

// 4. Luces
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(2, 5, 5);
scene.add(dirLight);

// 5. Cargar el Modelo 3D
let playeraModel;
const loader = new GLTFLoader();

// Asegúrate de que tu archivo se llame exactamente así en GitHub
loader.load('playera.glb', (gltf) => {
  playeraModel = gltf.scene;
  playeraModel.position.y = -1; // Ajusta este valor si la playera queda muy arriba o abajo
  
  // Asegurarnos de que el material base inicie en blanco puro
  playeraModel.traverse((child) => {
    if (child.isMesh) {
      child.material.color.set('#ffffff');
    }
  });

  scene.add(playeraModel);
}, undefined, function (error) {
  console.error('Error cargando el modelo 3D:', error);
});

// 6. Función para aplicar la imagen subida
window.loadDesign = function(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.src = e.target.result;
    
    img.onload = () => {
      const userTexture = new THREE.Texture(img);
      userTexture.flipY = false;
      userTexture.needsUpdate = true;
      
      if(playeraModel) {
        playeraModel.traverse((child) => {
          if (child.isMesh) {
            const newMaterial = child.material.clone();
            newMaterial.map = userTexture;
            newMaterial.needsUpdate = true;
            child.material = newMaterial;
          }
        });
      }
    };
  };
  reader.readAsDataURL(file);
};

// 7. Función para cambiar el color de la playera
window.cambiarColorPlayera = function(codigoHexadecimal) {
  if (playeraModel) {
    playeraModel.traverse((child) => {
      if (child.isMesh) {
        child.material.color.set(codigoHexadecimal);
      }
    });
  }
};

// 8. Bucle de Renderizado
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();