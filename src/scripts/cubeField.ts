import * as THREE from "three";

/**
 * Ambient cube field used as a subtle section background.
 * Tuned (dim, sparse, slow) so it reads as texture behind content.
 */
export function initCubeField(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const fit = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const count = 80;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.6 }),
    count,
  );

  const rng = (a: number, b: number) => a + Math.random() * (b - a);
  const data = Array.from({ length: count }, () => ({
    x: rng(-15, 15),
    y: rng(-5, 5),
    z: rng(-12, 1),
    rx: rng(0, Math.PI),
    ry: rng(0, Math.PI),
    s: rng(0.3, 1.1),
    spin: rng(0.08, 0.35) * (Math.random() < 0.5 ? -1 : 1),
    phase: rng(0, Math.PI * 2),
  }));

  const cA = new THREE.Color(0x2f9e46);
  const cB = new THREE.Color(0x3fb950);
  data.forEach((_, i) => mesh.setColorAt(i, Math.random() < 0.5 ? cA : cB));

  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(5, 8, 6);
  scene.add(key);

  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const dummy = new THREE.Object3D();
  const write = (t: number) => {
    for (let i = 0; i < count; i++) {
      const d = data[i];
      dummy.position.set(d.x, d.y + Math.sin(t * 0.5 + d.phase) * 0.5, d.z);
      dummy.rotation.set(d.rx + t * d.spin, d.ry + t * d.spin, 0);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const clock = new THREE.Clock();
  let running = true;
  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    write(t);
    group.rotation.y += (pointer.x * 0.25 - group.rotation.y) * 0.03;
    group.rotation.x += (pointer.y * 0.15 - group.rotation.x) * 0.03;
    renderer.render(scene, camera);
  };

  // Pause when the section is off-screen (save GPU).
  const vis = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        loop();
      } else if (!entry.isIntersecting) {
        running = false;
      }
    },
    { threshold: 0 },
  );
  vis.observe(canvas);

  fit();
  write(0);
  loop();
  new ResizeObserver(fit).observe(canvas);
}
