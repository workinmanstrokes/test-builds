// three.js preview: model in mm (z up), Tina2S bed volume, tap-to-measure.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BED } from './bed.js';
export { BED, fits, fitScale } from './bed.js';

export async function createViewer(host, glbBuf, { onMeasure } = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2.5)); host.prepend(r.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, 1, 1, 5000); cam.up.set(0, 0, 1);
  const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.dampingFactor = .09;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a1a10, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(160, -120, 260); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9a50, 1.1); rim.position.set(-200, 160, 80); scene.add(rim);
  // bed
  const bed = new THREE.Group(); scene.add(bed);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(BED.x, BED.y), new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: .9 }));
  bed.add(plate);
  const grid = new THREE.GridHelper(120, 12, 0x3a4554, 0x262e3a); grid.rotation.x = Math.PI / 2; grid.scale.set(BED.x / 120, 1, 1); bed.add(grid);
  const vol = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BED.x, BED.y, BED.z)), new THREE.LineBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: .55 }));
  vol.position.z = BED.z / 2; bed.add(vol);
  // model
  const gltf = await new GLTFLoader().parseAsync(glbBuf, '');
  const obj = new THREE.Group(); scene.add(obj);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: .55, metalness: .05 });
  gltf.scene.traverse(m => { if (m.isMesh) { m.material = mat; m.geometry.computeVertexNormals(); } });
  obj.add(gltf.scene);
  const box0 = new THREE.Box3().setFromObject(obj), size0 = box0.getSize(new THREE.Vector3());
  obj.position.set(-(box0.min.x + box0.max.x) / 2, -(box0.min.y + box0.max.y) / 2, -box0.min.z);
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(obj);
  let k = 1;
  const frame = () => { const s = Math.max(size0.x * k, size0.y * k, size0.z * k, BED.y) * 1.55; cam.position.set(s * .75, -s * 1.05, s * .75); ctl.target.set(0, 0, Math.max(size0.z * k, 30) * .45); ctl.update(); };
  frame();
  // measure
  const pts = [], marks = new THREE.Group(); scene.add(marks); let measuring = false, down = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const dot = () => new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff7a1a, depthTest: false }));
  r.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  r.domElement.addEventListener('pointerup', e => {
    if (!measuring || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
    const b = r.domElement.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
    ray.setFromCamera(ndc, cam); const hit = ray.intersectObject(pivot, true)[0]; if (!hit) return;
    if (pts.length === 2) { pts.length = 0; marks.clear(); }
    pts.push(hit.point.clone()); const d = dot(); d.position.copy(hit.point); d.renderOrder = 9; marks.add(d);
    if (pts.length === 2) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff7a1a, depthTest: false })); l.renderOrder = 9; marks.add(l);
      onMeasure && onMeasure(pts[0].distanceTo(pts[1]));
    } else onMeasure && onMeasure(null);
  });
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();
  let alive = true; (function loop() { if (!alive) return; ctl.update(); r.render(scene, cam); requestAnimationFrame(loop); })();
  return {
    size: () => size0.clone().multiplyScalar(k),
    setScale(v) { k = v; pivot.scale.setScalar(v); pts.length = 0; marks.clear(); onMeasure && onMeasure(null); },
    setMeasure(on) { measuring = on; ctl.enableRotate = true; if (!on) { pts.length = 0; marks.clear(); } },
    reset: frame,
    dispose() { alive = false; ro.disconnect(); r.dispose(); r.domElement.remove(); }
  };
}
