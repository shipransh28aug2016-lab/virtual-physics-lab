/**
 * Thin controller around Three.js r128, loaded globally via the CDN
 * `<script>` tags in index.html (classic `examples/js` builds, so
 * `THREE.OrbitControls` / `THREE.GLTFLoader` hang off the global `THREE`
 * namespace — not the npm package, not a module import).
 *
 * Kept out of the component tree's render path on purpose: the 3D apparatus
 * view is optional chrome around the existing 2D ray-diagram simulators and
 * must never throw if the CDN failed to load or a GLB model isn't present —
 * callers check `isThreeAvailable()` and the scene falls back to a
 * procedural bench built from primitives.
 *
 * `three` is not an npm dependency here (see the CDN comment above), so
 * there are no types to import — every THREE object below is necessarily
 * `any`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ApparatusKind = 'mirror' | 'lens';

export interface ApparatusUpdate {
  /** Object distance from the optic, centimetres (magnitude is used). */
  uCm: number;
  /** Image distance from the optic, centimetres. Non-finite when no image forms. */
  vCm: number;
  /** Object height, centimetres. */
  heightCm: number;
  /** Real images are drawn solid; virtual images are drawn translucent. */
  isReal: boolean;
  kind: ApparatusKind;
}

const MODEL_URL = 'assets/models/optical_bench.glb';
/** 1 cm of bench distance -> Three.js scene units (60 cm ≈ 1.8 units). */
const CM_TO_UNITS = 0.03;

function getTHREE(): any | null {
  return (window as unknown as { THREE?: any }).THREE ?? null;
}

/** True once the CDN scripts have loaded and both addons are attached. */
export function isThreeAvailable(): boolean {
  const THREE = getTHREE();
  return Boolean(THREE && THREE.OrbitControls && THREE.WebGLRenderer);
}

export class ApparatusScene {
  private readonly THREE: any;
  private readonly container: HTMLElement;
  private readonly renderer: any;
  private readonly scene: any;
  private readonly camera: any;
  private readonly controls: any;
  private readonly resizeObserver?: ResizeObserver;
  private objectPin: any = null;
  private imagePin: any = null;
  private frameId = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    const THREE = getTHREE();
    if (!THREE || !THREE.WebGLRenderer) throw new Error('Three.js is not loaded');
    this.THREE = THREE;
    this.container = container;

    const scene = new THREE.Scene();
    scene.background = makeGradientTexture(THREE);
    this.scene = scene;

    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 100);
    camera.position.set(1.5, 1.15, 2.3);
    camera.lookAt(0, 0.15, 0);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    if (THREE.PCFSoftShadowMap !== undefined) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.7;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.15, 0);
    this.controls = controls;

    // Soft lab ambience plus one shadow-casting key light.
    scene.add(new THREE.AmbientLight(0x5f7fa8, 0.7));
    const key = new THREE.DirectionalLight(0xdff1ff, 1.15);
    key.position.set(2, 3, 1.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 10;
    scene.add(key);

    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshStandardMaterial({ color: 0x0d1830, roughness: 0.9, metalness: 0.05 })
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    scene.add(table);

    this.loadApparatus();

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(container);
    }

    this.animate = this.animate.bind(this);
    this.frameId = requestAnimationFrame(this.animate);
  }

  /** Try the authored GLB first; any failure (missing file, bad names) falls back to primitives. */
  private loadApparatus(): void {
    const THREE = this.THREE;
    const GLTFLoader = THREE.GLTFLoader;
    if (!GLTFLoader) {
      this.buildFallbackApparatus();
      return;
    }
    try {
      new GLTFLoader().load(
        MODEL_URL,
        (gltf: any) => {
          if (this.disposed) return;
          gltf.scene.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          const objectPin = gltf.scene.getObjectByName('ObjectPin');
          const imagePin = gltf.scene.getObjectByName('ImagePin');
          const optic = gltf.scene.getObjectByName('Optic');
          if (!objectPin || !imagePin || !optic) {
            // The model doesn't expose the named nodes we need to animate — fall back.
            this.buildFallbackApparatus();
            return;
          }
          this.scene.add(gltf.scene);
          this.objectPin = objectPin;
          this.imagePin = imagePin;
        },
        undefined,
        () => {
          if (!this.disposed) this.buildFallbackApparatus();
        }
      );
    } catch {
      this.buildFallbackApparatus();
    }
  }

  /** Procedural bench: a rail, an optic disc on its stand, and object/image pins. */
  private buildFallbackApparatus(): void {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.name = 'FallbackBench';

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.05, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x394a63, roughness: 0.4, metalness: 0.6 })
    );
    rail.position.y = 0.06;
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);

    const optic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.02, 40),
      new THREE.MeshStandardMaterial({ color: 0x6ee7ff, roughness: 0.15, metalness: 0.85, side: THREE.DoubleSide })
    );
    optic.rotation.z = Math.PI / 2;
    optic.position.y = 0.24;
    optic.castShadow = true;
    optic.add(standMesh(THREE, 0.24));
    group.add(optic);

    this.objectPin = pinMesh(THREE, 0x45d68b);
    this.objectPin.position.set(-0.6, 0.09, 0);
    group.add(this.objectPin);

    this.imagePin = pinMesh(THREE, 0xff8fa3);
    this.imagePin.position.set(0.6, 0.09, 0);
    group.add(this.imagePin);

    this.scene.add(group);
  }

  /** Syncs the object/image pin meshes to the physics model — called on every slider change. */
  update(u: ApparatusUpdate): void {
    if (!this.objectPin || !this.imagePin) return;

    this.objectPin.position.x = mapPhysicsTo3D(-Math.abs(u.uCm));
    this.objectPin.scale.y = Math.max(0.25, u.heightCm / 1.5);

    if (Number.isFinite(u.vCm)) {
      const sign = u.kind === 'mirror' ? -1 : 1;
      this.imagePin.visible = true;
      this.imagePin.position.x = sign * mapPhysicsTo3D(Math.abs(u.vCm));
      this.imagePin.traverse((child: any) => {
        const mat = child.material;
        if (!mat) return;
        mat.transparent = !u.isReal;
        mat.opacity = u.isReal ? 1 : 0.4;
      });
    } else {
      this.imagePin.visible = false;
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate(): void {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.animate);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.controls.dispose?.();
    this.renderer.dispose?.();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

function mapPhysicsTo3D(cm: number): number {
  return cm * CM_TO_UNITS;
}

function pinMesh(THREE: any, color: number): any {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 12), mat);
  shaft.position.y = 0.075;
  shaft.castShadow = true;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 12), mat);
  head.position.y = 0.165;
  head.castShadow = true;
  group.add(shaft, head);
  return group;
}

function standMesh(THREE: any, height: number): any {
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, height, 16),
    new THREE.MeshStandardMaterial({ color: 0x263650, roughness: 0.5, metalness: 0.4 })
  );
  stand.position.y = -height / 2;
  stand.castShadow = true;
  stand.receiveShadow = true;
  return stand;
}

/** Dark-lab vertical gradient (#10192d → #0b132b) matching the app theme. */
function makeGradientTexture(THREE: any): any {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#10192d');
  grad.addColorStop(1, '#0b132b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
