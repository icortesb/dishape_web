import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fit(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
) {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/** Brand texture: emerald gradient face with a dark "d" carved in. */
function brandTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, "#56d364");
  g.addColorStop(1, "#2f9e46");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#0a0a0f";
  ctx.font = "700 160px 'Space Grotesk Variable', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("d", s / 2, s / 2 + 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function pointerOf(canvas: HTMLCanvasElement) {
  const p = { x: 0, y: 0 };
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    p.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    p.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  canvas.addEventListener("pointerleave", () => {
    p.x = 0;
    p.y = 0;
  });
  return p;
}

/* ---------------------------------------------------------------- *
 * Variante A — the dishape cube in 3D                              *
 * ---------------------------------------------------------------- */
function initCube(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const tilt = new THREE.Group();
  scene.add(tilt);

  const cube = new THREE.Mesh(
    new RoundedBoxGeometry(2.3, 2.3, 2.3, 6, 0.3),
    new THREE.MeshStandardMaterial({
      map: brandTexture(),
      metalness: 0.25,
      roughness: 0.45,
    }),
  );
  cube.rotation.set(-0.5, 0.6, 0);
  tilt.add(cube);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x56d364, 0.9, 25);
  rim.position.set(-5, -3, 4);
  scene.add(rim);

  const p = pointerOf(canvas);
  const clock = new THREE.Clock();

  const render = () => renderer.render(scene, camera);
  const loop = () => {
    requestAnimationFrame(loop);
    const d = clock.getDelta();
    cube.rotation.y += d * 0.35;
    tilt.rotation.y += (p.x * 0.45 - tilt.rotation.y) * 0.06;
    tilt.rotation.x += (p.y * 0.35 - tilt.rotation.x) * 0.06;
    render();
  };

  fit(renderer, camera, canvas);
  reduce ? render() : loop();
  new ResizeObserver(() => {
    fit(renderer, camera, canvas);
    render();
  }).observe(canvas);
}

/* ---------------------------------------------------------------- *
 * Variante B — ambient cube field                                  *
 * ---------------------------------------------------------------- */
function initField(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const count = 150;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.5 }),
    count,
  );

  const dummy = new THREE.Object3D();
  const rng = (a: number, b: number) => a + Math.random() * (b - a);
  const data = Array.from({ length: count }, () => ({
    x: rng(-12, 12),
    y: rng(-7, 7),
    z: rng(-10, 3),
    rx: rng(0, Math.PI),
    ry: rng(0, Math.PI),
    s: rng(0.35, 1.3),
    spin: rng(0.1, 0.5) * (Math.random() < 0.5 ? -1 : 1),
    phase: rng(0, Math.PI * 2),
  }));

  const cA = new THREE.Color(0x3fb950);
  const cB = new THREE.Color(0x56d364);
  data.forEach((p, i) => mesh.setColorAt(i, Math.random() < 0.5 ? cA : cB));

  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);

  const p = pointerOf(canvas);
  const clock = new THREE.Clock();

  const writeMatrices = (t: number) => {
    data.forEach((d, i) => {
      dummy.position.set(d.x, d.y + Math.sin(t * 0.6 + d.phase) * 0.6, d.z);
      dummy.rotation.set(d.rx + t * d.spin, d.ry + t * d.spin, 0);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  const render = () => renderer.render(scene, camera);
  const loop = () => {
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    writeMatrices(t);
    group.rotation.y += (p.x * 0.3 - group.rotation.y) * 0.04;
    group.rotation.x += (p.y * 0.2 - group.rotation.x) * 0.04;
    render();
  };

  fit(renderer, camera, canvas);
  writeMatrices(0);
  reduce ? render() : loop();
  new ResizeObserver(() => {
    fit(renderer, camera, canvas);
    render();
  }).observe(canvas);
}

/* ---------------------------------------------------------------- */
const cubeCanvas = document.querySelector<HTMLCanvasElement>('[data-scene="cube"]');
const fieldCanvas = document.querySelector<HTMLCanvasElement>('[data-scene="field"]');
if (cubeCanvas) initCube(cubeCanvas);
if (fieldCanvas) initField(fieldCanvas);
