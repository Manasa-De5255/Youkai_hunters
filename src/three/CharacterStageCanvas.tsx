import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CharacterCustomization, Gender } from '../types/game';
import { WarriorCharacter3D } from './WarriorCharacter3D';

interface CharacterStageCanvasProps {
  gender: Gender;
  customization: CharacterCustomization;
  playerLevel: number;
  flourishSignal: number;
  resetViewSignal: number;
  rotateStepSignal: { seq: number; deltaRad: number };
}

function detectSoftwareWebGL(): boolean {
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export default function CharacterStageCanvas({
  gender,
  customization,
  playerLevel,
  flourishSignal,
  resetViewSignal,
  rotateStepSignal,
}: CharacterStageCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const warriorRef = useRef<WarriorCharacter3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stageElRef = useRef<HTMLDivElement | null>(null);
  const initialPropsRef = useRef({ gender, customization, playerLevel });
  const prevFlourishRef = useRef(flourishSignal);

  const syncCamDataset = () => {
    const stageEl = stageElRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!stageEl || !camera || !controls) return;
    stageEl.dataset.camX = camera.position.x.toFixed(2);
    stageEl.dataset.camZ = camera.position.z.toFixed(2);
    stageEl.dataset.camDist = camera.position.distanceTo(controls.target).toFixed(2);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const stageEl: HTMLDivElement = container;
    stageElRef.current = stageEl;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-label', '3D Yokai Hunter Character Viewport');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 40);
    camera.position.set(0, 1.16, 3.85);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.94, 0);
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.95;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 2.4;
    controls.maxDistance = 5.0;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();
    controlsRef.current = controls;
    syncCamDataset();

    const handleControlsChange = () => {
      syncCamDataset();
    };
    controls.addEventListener('change', handleControlsChange);

    // Calibrated 3-point studio lighting so skin tones & anime facial features stay sharp
    const hemi = new THREE.HemisphereLight(0x88c8ff, 0x2a0a12, 0.56);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.38);
    keyLight.position.set(2.2, 3.6, 3.4);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.camera.left = -2;
      keyLight.shadow.camera.right = 2;
      keyLight.shadow.camera.top = 2.5;
      keyLight.shadow.camera.bottom = -0.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimCyan = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimCyan.position.set(-2.6, 2.2, -2.5);
    scene.add(rimCyan);

    const rimCrimson = new THREE.DirectionalLight(0xdc2626, 0.72);
    rimCrimson.position.set(2.5, 1.4, -2.4);
    scene.add(rimCrimson);

    // Dark obsidian stepped sanctuary dais + contact shadow
    const daisGroup = new THREE.Group();
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f1c,
      roughness: 0.76,
      metalness: 0.25,
    });
    const daisTop = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 0.07, 48), daisMat);
    daisTop.position.y = -0.036;
    daisTop.receiveShadow = true;
    daisGroup.add(daisTop);

    const daisBase = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.06, 0.06, 48), daisMat);
    daisBase.position.y = -0.095;
    daisGroup.add(daisBase);

    const rimRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.8,
    });
    const daisRing = new THREE.Mesh(new THREE.TorusGeometry(0.845, 0.01, 8, 56), rimRingMat);
    daisRing.rotation.x = Math.PI / 2;
    daisRing.position.y = -0.002;
    daisGroup.add(daisRing);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
    sGrad.addColorStop(0, 'rgba(0,0,0,0.68)');
    sGrad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.005;
    daisGroup.add(contactShadow);
    scene.add(daisGroup);

    const warrior = new WarriorCharacter3D(renderer.capabilities.getMaxAnisotropy());
    warrior.rebuild(initialPropsRef.current.gender, initialPropsRef.current.customization, {
      playerLevel: initialPropsRef.current.playerLevel,
    });
    scene.add(warrior.root);
    warriorRef.current = warrior;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, entry.contentRect.width);
      const h = Math.max(1, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let disposed = false;
    let frameId = 0;
    let tickCount = 0;
    const startMs = performance.now();
    let lastMs = startMs;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      let polls = 0;
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        polls += 1;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED && polls < 24) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastMs) / 1000, 0.05);
      lastMs = now;
      const elapsed = (now - startMs) / 1000;

      warrior.update(elapsed, dt);
      controls.update();
      tickCount += 1;
      stageEl.dataset.ticks = String(tickCount);
      syncCamDataset();
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('change', handleControlsChange);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      warrior.dispose();
      daisMat.dispose();
      daisTop.geometry.dispose();
      daisBase.geometry.dispose();
      rimRingMat.dispose();
      daisRing.geometry.dispose();
      shadowTex.dispose();
      contactShadow.geometry.dispose();
      (contactShadow.material as THREE.Material).dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      warriorRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      stageElRef.current = null;
    };
  }, []);

  useEffect(() => {
    const warrior = warriorRef.current;
    if (!warrior) return;
    warrior.rebuild(gender, customization, { playerLevel });
    if (flourishSignal !== prevFlourishRef.current) {
      prevFlourishRef.current = flourishSignal;
      warrior.triggerFlourish();
    }
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [gender, customization, playerLevel, flourishSignal]);

  useEffect(() => {
    if (resetViewSignal === 0) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 1.16, 3.85);
    controls.target.set(0, 0.94, 0);
    controls.update();
    syncCamDataset();
    if (rendererRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, camera);
    }
  }, [resetViewSignal]);

  useEffect(() => {
    if (rotateStepSignal.seq === 0) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateStepSignal.deltaRad);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    syncCamDataset();
    if (rendererRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, camera);
    }
  }, [rotateStepSignal]);

  return (
    <div
      ref={mountRef}
      data-testid="character-canvas-stage"
      data-level={playerLevel}
      data-gender={gender}
      data-costume={customization.costume}
      data-hair={customization.hairStyle}
      data-sword={customization.sword}
      data-archery={customization.archery}
      data-superpower={customization.superpower}
      className="h-full w-full cursor-grab active:cursor-grabbing"
    />
  );
}
