import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// === SCROLL REVEAL SYSTEM ===
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      // Stagger chips
      if (entry.target.classList.contains('skills')) {
        entry.target.querySelectorAll('.chip').forEach((tag, i) => {
          setTimeout(() => tag.classList.add('revealed'), i * 80);
        });
      }
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .skills').forEach(el => {
  revealObserver.observe(el);
});

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000008);
scene.fog = new THREE.FogExp2(0x000010, 0.00015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 50, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// === MOUSE TRACKING ===
const mouse = new THREE.Vector2(0, 0);
let targetMouseX = 0, targetMouseY = 0;
window.addEventListener('mousemove', (e) => {
  targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// === CONTROLS ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;
controls.maxDistance = 600;
controls.minDistance = 20;

// === POST PROCESSING ===
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  2.0, 0.5, 0.15
);
composer.addPass(bloomPass);

// Vignette shader
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.4 },
    uSmoothness: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uSmoothness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = smoothstep(0.5, 0.5 - uSmoothness, dist) ;
      color.rgb *= mix(1.0 - uIntensity, 1.0, vignette);
      gl_FragColor = color;
    }
  `,
};
const vignettePass = new ShaderPass(vignetteShader);
composer.addPass(vignettePass);
composer.addPass(new OutputPass());

// === GALAXY STARS (InstancedMesh) ===
const starCount = 25000;
const starGeometry = new THREE.SphereGeometry(0.15, 6, 6);
const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const stars = new THREE.InstancedMesh(starGeometry, starMaterial, starCount);
stars.name = 'galaxyStars';

const dummy = new THREE.Object3D();
const starColors = [];
const starData = [];
const colorPalette = [
  new THREE.Color(0xfff8e7), // warm white
  new THREE.Color(0xaaccff), // blue white
  new THREE.Color(0xffddaa), // yellow
  new THREE.Color(0xff8866), // orange-red
  new THREE.Color(0x88aaff), // blue
  new THREE.Color(0xffaadd), // pink
  new THREE.Color(0xaaffcc), // green tint
];

for (let i = 0; i < starCount; i++) {
  // Spiral galaxy distribution
  const arm = Math.floor(Math.random() * 4);
  const armAngle = (arm / 4) * Math.PI * 2;
  const distance = Math.pow(Math.random(), 0.5) * 350;
  const spiralAngle = distance * 0.015 + armAngle;
  const spread = (1 + distance * 0.08) * (Math.random() - 0.5);
  const heightSpread = (Math.random() - 0.5) * (15 + distance * 0.05);

  const x = Math.cos(spiralAngle) * distance + spread * Math.cos(spiralAngle + Math.PI / 2);
  const z = Math.sin(spiralAngle) * distance + spread * Math.sin(spiralAngle + Math.PI / 2);
  const y = heightSpread;

  const scale = 0.2 + Math.random() * 1.2;
  dummy.position.set(x, y, z);
  dummy.scale.set(scale, scale, scale);
  dummy.updateMatrix();
  stars.setMatrixAt(i, dummy.matrix);

  const col = colorPalette[Math.floor(Math.random() * colorPalette.length)].clone();
  col.multiplyScalar(0.6 + Math.random() * 0.6);
  stars.setColorAt(i, col);

  starData.push({
    baseScale: scale,
    twinkleSpeed: 1 + Math.random() * 4,
    twinkleOffset: Math.random() * Math.PI * 2,
    x, y, z
  });
}
stars.instanceMatrix.needsUpdate = true;
stars.instanceColor.needsUpdate = true;
scene.add(stars);

// === GALAXY CORE GLOW ===
const coreGeometry = new THREE.SphereGeometry(8, 32, 32);
const coreMaterial = new THREE.MeshBasicMaterial({
  color: 0xffeedd,
  transparent: true,
  opacity: 0.9,
});
const core = new THREE.Mesh(coreGeometry, coreMaterial);
core.name = 'galaxyCore';
scene.add(core);

// Core halo
const haloGeometry = new THREE.SphereGeometry(25, 32, 32);
const haloMaterial = new THREE.MeshBasicMaterial({
  color: 0xffcc88,
  transparent: true,
  opacity: 0.15,
});
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
halo.name = 'galaxyCoreHalo';
scene.add(halo);

// Outer halo
const outerHaloGeometry = new THREE.SphereGeometry(50, 32, 32);
const outerHaloMaterial = new THREE.MeshBasicMaterial({
  color: 0x6644aa,
  transparent: true,
  opacity: 0.05,
});
const outerHalo = new THREE.Mesh(outerHaloGeometry, outerHaloMaterial);
outerHalo.name = 'galaxyOuterHalo';
scene.add(outerHalo);

// === DUST PARTICLES ===
const dustCount = 8000;
const dustGeometry = new THREE.BufferGeometry();
const dustPositions = new Float32Array(dustCount * 3);
const dustColors = new Float32Array(dustCount * 3);
const dustSizes = new Float32Array(dustCount);

for (let i = 0; i < dustCount; i++) {
  const arm = Math.floor(Math.random() * 4);
  const armAngle = (arm / 4) * Math.PI * 2;
  const distance = Math.pow(Math.random(), 0.4) * 300;
  const spiralAngle = distance * 0.015 + armAngle + (Math.random() - 0.5) * 0.5;
  const spread = (1 + distance * 0.12) * (Math.random() - 0.5);

  dustPositions[i * 3] = Math.cos(spiralAngle) * distance + spread * Math.cos(spiralAngle + Math.PI / 2);
  dustPositions[i * 3 + 1] = (Math.random() - 0.5) * (8 + distance * 0.03);
  dustPositions[i * 3 + 2] = Math.sin(spiralAngle) * distance + spread * Math.sin(spiralAngle + Math.PI / 2);

  const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
  dustColors[i * 3] = c.r * 0.4;
  dustColors[i * 3 + 1] = c.g * 0.4;
  dustColors[i * 3 + 2] = c.b * 0.4;

  dustSizes[i] = 0.5 + Math.random() * 2;
}

dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
dustGeometry.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));

const dustMaterial = new THREE.PointsMaterial({
  size: 1.5,
  vertexColors: true,
  transparent: true,
  opacity: 0.3,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});
const dust = new THREE.Points(dustGeometry, dustMaterial);
dust.name = 'galaxyDust';
scene.add(dust);

// === BACKGROUND STARS ===
const bgStarCount = 5000;
const bgGeometry = new THREE.BufferGeometry();
const bgPositions = new Float32Array(bgStarCount * 3);
const bgStarColors = new Float32Array(bgStarCount * 3);

for (let i = 0; i < bgStarCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 1500 + Math.random() * 2000;
  bgPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  bgPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  bgPositions[i * 3 + 2] = r * Math.cos(phi);

  const brightness = 0.3 + Math.random() * 0.7;
  bgStarColors[i * 3] = brightness;
  bgStarColors[i * 3 + 1] = brightness;
  bgStarColors[i * 3 + 2] = brightness + Math.random() * 0.2;
}

bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
bgGeometry.setAttribute('color', new THREE.BufferAttribute(bgStarColors, 3));

const bgMaterial = new THREE.PointsMaterial({
  size: 1.5,
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const bgStars = new THREE.Points(bgGeometry, bgMaterial);
bgStars.name = 'backgroundStars';
scene.add(bgStars);

// === NEBULA CLOUDS ===
function createNebula(pos, color, size, opacity) {
  const geo = new THREE.PlaneGeometry(size, size);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, `rgba(${color.r * 255},${color.g * 255},${color.b * 255},${opacity})`);
  gradient.addColorStop(0.3, `rgba(${color.r * 255},${color.g * 255},${color.b * 255},${opacity * 0.5})`);
  gradient.addColorStop(0.6, `rgba(${color.r * 255},${color.g * 255},${color.b * 255},${opacity * 0.15})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    opacity: opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.lookAt(camera.position);
  return mesh;
}

const nebulae = [];
const nebulaConfigs = [
  { pos: new THREE.Vector3(80, 5, -60), color: new THREE.Color(0.5, 0.15, 0.7), size: 140, opacity: 0.18 },
  { pos: new THREE.Vector3(-100, -10, 50), color: new THREE.Color(0.15, 0.3, 0.6), size: 160, opacity: 0.14 },
  { pos: new THREE.Vector3(30, 8, 120), color: new THREE.Color(0.6, 0.1, 0.35), size: 120, opacity: 0.12 },
  { pos: new THREE.Vector3(-60, -5, -100), color: new THREE.Color(0.1, 0.5, 0.5), size: 140, opacity: 0.1 },
  { pos: new THREE.Vector3(150, 3, 30), color: new THREE.Color(0.7, 0.35, 0.1), size: 100, opacity: 0.12 },
  { pos: new THREE.Vector3(-30, 15, -150), color: new THREE.Color(0.3, 0.1, 0.6), size: 110, opacity: 0.08 },
  { pos: new THREE.Vector3(120, -8, -80), color: new THREE.Color(0.5, 0.2, 0.4), size: 95, opacity: 0.1 },
];

nebulaConfigs.forEach((cfg, i) => {
  const nebula = createNebula(cfg.pos, cfg.color, cfg.size, cfg.opacity);
  nebula.name = `nebula_${i}`;
  scene.add(nebula);
  nebulae.push(nebula);
});

// === SHOOTING STARS (Enhanced with multi-segment trails) ===
const shootingStars = [];
function createShootingStar() {
  const segments = 20;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(segments * 3);
  const alphas = new Float32Array(segments);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0.8, 0.9, 1.0) },
    },
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `,
  });
  const line = new THREE.Line(geo, mat);
  line.name = `shootingStar_${shootingStars.length}`;

  const angle = Math.random() * Math.PI * 2;
  const startDist = 200 + Math.random() * 300;

  line.userData = {
    segments,
    direction: new THREE.Vector3(
      -Math.cos(angle) * 2,
      -0.5 - Math.random(),
      -Math.sin(angle) * 2
    ).normalize(),
    startPos: new THREE.Vector3(
      Math.cos(angle) * startDist,
      50 + Math.random() * 100,
      Math.sin(angle) * startDist
    ),
    speed: 3 + Math.random() * 5,
    life: 0,
    maxLife: 80 + Math.random() * 80,
    tailLength: 15 + Math.random() * 20,
    active: false,
    trailPositions: [],
  };

  scene.add(line);
  return line;
}

for (let i = 0; i < 8; i++) {
  shootingStars.push(createShootingStar());
}

// === COSMIC DUST STREAMS ===
const streamCount = 2000;
const streamGeo = new THREE.BufferGeometry();
const streamPositions = new Float32Array(streamCount * 3);
const streamColors = new Float32Array(streamCount * 3);
const streamSizes = new Float32Array(streamCount);
const streamData = [];

for (let i = 0; i < streamCount; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 30 + Math.random() * 200;
  const height = (Math.random() - 0.5) * 20;

  streamPositions[i * 3] = Math.cos(angle) * radius;
  streamPositions[i * 3 + 1] = height;
  streamPositions[i * 3 + 2] = Math.sin(angle) * radius;

  const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.15, 0.5, 0.5 + Math.random() * 0.3);
  streamColors[i * 3] = c.r;
  streamColors[i * 3 + 1] = c.g;
  streamColors[i * 3 + 2] = c.b;

  streamSizes[i] = 0.5 + Math.random() * 1.5;

  streamData.push({
    angle,
    radius,
    height,
    speed: 0.001 + Math.random() * 0.003,
    verticalOscillation: Math.random() * 5,
    oscSpeed: 0.5 + Math.random() * 2,
    oscOffset: Math.random() * Math.PI * 2,
  });
}

streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));

const streamMat = new THREE.PointsMaterial({
  size: 1.2,
  vertexColors: true,
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});
const dustStream = new THREE.Points(streamGeo, streamMat);
dustStream.name = 'cosmicDustStream';
scene.add(dustStream);

// === CORE LIGHT RAYS ===
const rayCount = 12;
const rayGroup = new THREE.Group();
for (let i = 0; i < rayCount; i++) {
  const rayGeo = new THREE.PlaneGeometry(2, 80);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xffeedd,
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ray = new THREE.Mesh(rayGeo, rayMat);
  ray.rotation.z = (i / rayCount) * Math.PI;
  ray.rotation.y = Math.random() * Math.PI;
  ray.userData = { baseOpacity: 0.03 + Math.random() * 0.03, speed: 0.3 + Math.random() * 0.5 };
  rayGroup.add(ray);
}
scene.add(rayGroup);

// === CINEMATIC CAMERA PATH ===
let cinematicMode = true;
let cinematicTime = 0;
const cinematicDuration = 600;

function getCinematicPosition(t) {
  const phase = (t % cinematicDuration) / cinematicDuration;
  const angle = phase * Math.PI * 2;

  const radius = 150 + Math.sin(angle * 2) * 80;
  const height = 40 + Math.sin(angle * 3) * 60;

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  );
}

// === SCROLL-LINKED CAMERA ===
let scrollProgress = 0;
const scrollPositions = [
  { pos: new THREE.Vector3(0, 50, 200), target: new THREE.Vector3(0, 0, 0) },       // Hero - front view
  { pos: new THREE.Vector3(180, 30, 100), target: new THREE.Vector3(0, 0, 0) },      // About - side angle
  { pos: new THREE.Vector3(-120, 60, 150), target: new THREE.Vector3(0, 0, 0) },     // Experience - dynamic angle
  { pos: new THREE.Vector3(-50, 80, 180), target: new THREE.Vector3(0, 0, 0) },      // Work - elevated
  { pos: new THREE.Vector3(0, 20, 120), target: new THREE.Vector3(0, 0, 0) },        // Contact - close up
];

function getScrollCameraPosition(progress) {
  const idx = Math.min(Math.floor(progress * (scrollPositions.length - 1)), scrollPositions.length - 2);
  const t = (progress * (scrollPositions.length - 1)) - idx;
  const smoothT = t * t * (3 - 2 * t); // smoothstep

  const pos = new THREE.Vector3().lerpVectors(scrollPositions[idx].pos, scrollPositions[idx + 1].pos, smoothT);
  const tgt = new THREE.Vector3().lerpVectors(scrollPositions[idx].target, scrollPositions[idx + 1].target, smoothT);
  return { pos, target: tgt };
}

// === SCROLL TRACKING ===
window.addEventListener('scroll', () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  // Disable cinematic once user starts scrolling
  if (window.scrollY > 50) cinematicMode = false;
});

// === ANIMATION LOOP ===
const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  const elapsed = clock.getElapsedTime();
  frameCount++;

  // Smooth mouse interpolation
  mouse.x += (targetMouseX - mouse.x) * 0.05;
  mouse.y += (targetMouseY - mouse.y) * 0.05;

  controls.update();

  // Twinkle stars (optimized - update every 2 frames)
  if (frameCount % 2 === 0) {
    for (let i = 0; i < starCount; i++) {
      const d = starData[i];
      const twinkle = 0.6 + 0.4 * Math.sin(elapsed * d.twinkleSpeed + d.twinkleOffset);
      const s = d.baseScale * twinkle;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      stars.setMatrixAt(i, dummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true;
  }

  // Rotate galaxy slowly
  stars.rotation.y += 0.0003;
  dust.rotation.y += 0.0003;

  // Pulse core with breathing effect
  const corePulse = 1 + Math.sin(elapsed * 0.5) * 0.12 + Math.sin(elapsed * 1.3) * 0.05;
  core.scale.set(corePulse, corePulse, corePulse);
  halo.scale.set(corePulse * 1.08, corePulse * 1.08, corePulse * 1.08);
  outerHalo.scale.set(corePulse * 1.15, corePulse * 1.15, corePulse * 1.15);
  coreMaterial.opacity = 0.8 + Math.sin(elapsed * 0.8) * 0.15;
  haloMaterial.opacity = 0.12 + Math.sin(elapsed * 0.6) * 0.06;

  // Core light rays animation
  rayGroup.children.forEach((ray, i) => {
    const pulse = Math.sin(elapsed * ray.userData.speed + i * 0.5) * 0.5 + 0.5;
    ray.material.opacity = ray.userData.baseOpacity * pulse;
    ray.scale.x = 1 + Math.sin(elapsed * 0.3 + i) * 0.3;
  });

  // Nebulae face camera with subtle pulsing
  nebulae.forEach((n, i) => {
    n.lookAt(camera.position);
    const pulse = 1 + Math.sin(elapsed * 0.4 + i * 1.5) * 0.08;
    n.scale.set(pulse, pulse, pulse);
    n.material.opacity = nebulaConfigs[i].opacity * (0.8 + Math.sin(elapsed * 0.3 + i) * 0.2);
  });

  // Background stars rotation
  bgStars.rotation.y += 0.00005;
  bgStars.rotation.x += 0.00002;

  // Cosmic dust stream animation
  const streamPos = dustStream.geometry.attributes.position;
  for (let i = 0; i < streamCount; i++) {
    const d = streamData[i];
    d.angle += d.speed;
    const oscY = Math.sin(elapsed * d.oscSpeed + d.oscOffset) * d.verticalOscillation;

    streamPos.setXYZ(i,
      Math.cos(d.angle) * d.radius,
      d.height + oscY,
      Math.sin(d.angle) * d.radius
    );
  }
  streamPos.needsUpdate = true;
  dustStream.rotation.y += 0.0001;

  // Enhanced shooting stars with multi-segment trails
  shootingStars.forEach(ss => {
    const ud = ss.userData;
    if (!ud.active) {
      if (Math.random() < 0.004) {
        ud.active = true;
        ud.life = 0;
        ud.trailPositions = [];
        const angle = Math.random() * Math.PI * 2;
        ud.startPos.set(
          Math.cos(angle) * (200 + Math.random() * 200),
          60 + Math.random() * 100,
          Math.sin(angle) * (200 + Math.random() * 200)
        );
        ud.direction.set(
          -Math.cos(angle + 0.5) * 2,
          -0.8 - Math.random() * 0.5,
          -Math.sin(angle + 0.5) * 2
        ).normalize();
      }
      return;
    }

    ud.life++;
    const progress = ud.life / ud.maxLife;
    const headPos = ud.startPos.clone().addScaledVector(ud.direction, ud.life * ud.speed);

    // Build trail
    ud.trailPositions.unshift(headPos.clone());
    if (ud.trailPositions.length > ud.segments) ud.trailPositions.pop();

    const posAttr = ss.geometry.attributes.position;
    const alphaAttr = ss.geometry.attributes.alpha;
    for (let i = 0; i < ud.segments; i++) {
      if (i < ud.trailPositions.length) {
        const p = ud.trailPositions[i];
        posAttr.setXYZ(i, p.x, p.y, p.z);
        const fade = 1 - (i / ud.segments);
        const lifeFade = Math.min(progress * 5, 1) * Math.max(1 - (progress - 0.7) / 0.3, 0);
        alphaAttr.setX(i, fade * fade * lifeFade * 0.8);
      }
    }
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    if (progress >= 1) {
      ud.active = false;
      for (let i = 0; i < ud.segments; i++) alphaAttr.setX(i, 0);
      alphaAttr.needsUpdate = true;
    }
  });

  // Cinematic camera movement
  if (cinematicMode) {
    cinematicTime += 0.5;
    const targetPos = getCinematicPosition(cinematicTime);
    camera.position.lerp(targetPos, 0.005);
    controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.01);
  } else {
    // Scroll-linked camera
    const scrollCam = getScrollCameraPosition(scrollProgress);
    camera.position.lerp(scrollCam.pos, 0.02);
    controls.target.lerp(scrollCam.target, 0.02);

    // Mouse parallax (subtle)
    camera.position.x += mouse.x * 3;
    camera.position.y += -mouse.y * 2;
  }

  composer.render();
}

renderer.setAnimationLoop(animate);

// Disable cinematic on user interaction
renderer.domElement.addEventListener('pointerdown', () => {
  cinematicMode = false;
});

// === RESIZE ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// === CONTACT MODAL ===
const openModalBtn = document.getElementById('openContactModal');
const closeModalBtn = document.getElementById('closeContactModal');
const modalOverlay = document.getElementById('contactModal');

if (openModalBtn && closeModalBtn && modalOverlay) {
  openModalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  });

  closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

// === WEB3FORMS INTEGRATION ===
const contactForm = document.querySelector('.contact-form');
const submitBtn = document.querySelector('.form-submit');

if (contactForm && submitBtn) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const company = document.getElementById('company').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();
    
    // Set loading state
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'not-allowed';
    
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: '5ce78797-f683-456b-be86-2cc32f977627',
          name: name,
          email: email,
          company: company,
          subject: subject,
          message: message
        })
      });
      
      const result = await response.json();
      
      if (response.status === 200) {
        showToast('Pesan berhasil dikirim! Terima kasih.', 'success');
        contactForm.reset();
        
        // Close modal after delay
        setTimeout(() => {
          const modal = document.getElementById('contactModal');
          if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
          }
        }, 1500);
      } else {
        showToast(result.message || 'Terjadi kesalahan. Silakan coba lagi.', 'error');
      }
    } catch (error) {
      showToast('Gagal terhubung ke server. Periksa koneksi Anda.', 'error');
    } finally {
      // Revert loading state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}