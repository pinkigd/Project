import * as THREE from "../vendor/three.module.min.js";

/* Simplex noise (Ashima / IQ) for the vertex shader */
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSize;
varying float vNoise;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(position);
  float noise = snoise(n * 1.6 + uTime * 0.18);
  vNoise = noise;
  vec3 displaced = n * (1.0 + noise * 0.32);
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_PointSize = uSize * (1.0 + noise * 0.8) * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vNoise;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.05, d) * 0.85;
  vec3 color = mix(uColorA, uColorB, smoothstep(-0.6, 0.8, vNoise));
  gl_FragColor = vec4(color, alpha);
}
`;

export function initScene({ canvas, reducedMotion, isTouch }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    canvas.remove(); // graceful CSS-only fallback when WebGL is unavailable
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    20
  );
  camera.position.z = 2.7;

  const detail = isTouch ? 28 : 50;
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: isTouch ? 5.5 : 7.0 },
      uColorA: { value: new THREE.Color("#2b3a55") },
      uColorB: { value: new THREE.Color("#c8ff4d") },
    },
  });
  const points = new THREE.Points(geometry, material);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the sphere anchored upper-right on wide screens, centered on small
    const wide = w > 900;
    group.position.set(wide ? 0.85 : 0, wide ? 0.35 : 0.55, 0);
    group.scale.setScalar(wide ? 1.15 : 0.8);
  }
  layout();

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!isTouch) {
    window.addEventListener("pointermove", (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  const clock = new THREE.Clock();
  let visible = true;
  let rafId = null;

  function render() {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    group.rotation.y = t * 0.06 + pointer.x * 0.25;
    group.rotation.x = t * 0.03 + pointer.y * 0.18;
    renderer.render(scene, camera);
  }

  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId === null && !reducedMotion) rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  if (reducedMotion) {
    render(); // single static frame
  } else {
    // Only render while the hero is on screen and the tab is visible
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible && !document.hidden ? start() : stop();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", () => {
      !document.hidden && visible ? start() : stop();
    });
    start();
  }

  window.addEventListener("resize", () => {
    layout();
    if (reducedMotion) render();
  });
}
