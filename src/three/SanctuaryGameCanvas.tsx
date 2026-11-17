import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SUPERPOWER_OPTIONS } from '../data/customizationCatalog';
import { CharacterCustomization, Gender } from '../types/game';
import { WarriorCharacter3D } from './WarriorCharacter3D';

interface SanctuaryGameCanvasProps {
  gender: Gender;
  customization: CharacterCustomization;
  onSpiritBurst?: (count: number) => void;
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

export default function SanctuaryGameCanvas({
  gender,
  customization,
  onSpiritBurst,
}: SanctuaryGameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onBurstRef = useRef(onSpiritBurst);
  onBurstRef.current = onSpiritBurst;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b18);
    scene.fog = new THREE.FogExp2(0x060b18, 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 80);
    camera.position.set(0, 3.2, 6.2);

    // Warm/cool night moonlit lighting
    const hemi = new THREE.HemisphereLight(0x60a5fa, 0x1a0b12, 0.65);
    scene.add(hemi);

    const moonLight = new THREE.DirectionalLight(0xdbeafe, 1.8);
    moonLight.position.set(6, 12, 5);
    if (!isSoftwareGl) {
      moonLight.castShadow = true;
      moonLight.shadow.mapSize.set(1024, 1024);
      moonLight.shadow.camera.left = -12;
      moonLight.shadow.camera.right = 12;
      moonLight.shadow.camera.top = 12;
      moonLight.shadow.camera.bottom = -12;
      moonLight.shadow.bias = -0.0005;
    }
    scene.add(moonLight);

    // Ground stone courtyard
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1224,
      roughness: 0.85,
      metalness: 0.12,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(42, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stone path & sanctuary ring
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.25,
    });
    const courtyardRing = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.1, 48), ringMat);
    courtyardRing.rotation.x = -Math.PI / 2;
    courtyardRing.position.y = 0.02;
    scene.add(courtyardRing);

    // Landmark Torii Gate at z = -8.5
    const toriiGroup = new THREE.Group();
    const toriiRedMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.52,
      metalness: 0.18,
    });
    const toriiDarkMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.6,
      metalness: 0.3,
    });
    for (const sx of [-1.8, 1.8]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.4, 14), toriiRedMat);
      pillar.position.set(sx, 2.2, 0);
      pillar.castShadow = true;
      toriiGroup.add(pillar);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 14), toriiDarkMat);
      base.position.set(sx, 0.25, 0);
      toriiGroup.add(base);
    }
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.26, 0.34), toriiDarkMat);
    topBeam.position.set(0, 4.35, 0);
    toriiGroup.add(topBeam);
    const subBeam = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.18, 0.24), toriiRedMat);
    subBeam.position.set(0, 3.65, 0);
    toriiGroup.add(subBeam);
    toriiGroup.position.set(0, 0, -8.5);
    scene.add(toriiGroup);

    // Glowing Yokai Spirit Targets around arena
    const superpowerOpt =
      SUPERPOWER_OPTIONS.find((s) => s.id === customization.superpower) ?? SUPERPOWER_OPTIONS[0];
    const orbGeo = new THREE.OctahedronGeometry(0.32, 1);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.4,
    });
    const orbs: { mesh: THREE.Mesh; basePos: THREE.Vector3; cooldown: number }[] = [];
    const orbCoords = [
      new THREE.Vector3(-3.6, 1.25, -4.0),
      new THREE.Vector3(3.6, 1.25, -4.0),
      new THREE.Vector3(0, 1.35, -5.8),
    ];
    for (const pos of orbCoords) {
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.position.copy(pos);
      scene.add(mesh);
      orbs.push({ mesh, basePos: pos.clone(), cooldown: 0 });
    }

    // Player Customized Warrior
    const warrior = new WarriorCharacter3D(renderer.capabilities.getMaxAnisotropy());
    warrior.rebuild(gender, customization);
    scene.add(warrior.root);

    // Burst shockwave ring
    const burstGeo = new THREE.RingGeometry(0.3, 0.45, 36);
    const burstMat = new THREE.MeshBasicMaterial({
      color: superpowerOpt.primaryHex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const burstRing = new THREE.Mesh(burstGeo, burstMat);
    burstRing.rotation.x = -Math.PI / 2;
    burstRing.position.y = 0.08;
    scene.add(burstRing);

    const keys = new Set<string>();
    let burstProgress = -1;
    let burstCount = 0;

    const triggerStrike = () => {
      warrior.triggerFlourish();
      burstProgress = 0;
      burstRing.position.set(warrior.root.position.x, 0.12, warrior.root.position.z);
      for (const orb of orbs) {
        if (orb.cooldown <= 0 && orb.mesh.position.distanceTo(warrior.root.position) < 3.6) {
          orb.cooldown = 2.4;
          burstCount += 1;
          onBurstRef.current?.(burstCount);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyF') {
        e.preventDefault();
        triggerStrike();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => keys.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    renderer.domElement.addEventListener('click', triggerStrike);

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
    const startMs = performance.now();
    let lastMs = startMs;
    const moveVec = new THREE.Vector3();
    const desiredCamPos = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
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

      // Movement
      moveVec.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveVec.z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveVec.z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveVec.x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveVec.x += 1;

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        const speed = 4.2;
        warrior.root.position.x = THREE.MathUtils.clamp(
          warrior.root.position.x + moveVec.x * speed * dt,
          -10,
          10,
        );
        warrior.root.position.z = THREE.MathUtils.clamp(
          warrior.root.position.z + moveVec.z * speed * dt,
          -7.5,
          8,
        );
        const targetAngle = Math.atan2(moveVec.x, moveVec.z);
        let diff = targetAngle - warrior.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        warrior.root.rotation.y += diff * (1 - Math.exp(-10 * dt));
      }

      // Burst shockwave animation
      if (burstProgress >= 0) {
        burstProgress += dt * 2.2;
        const scale = 1 + burstProgress * 7.5;
        burstRing.scale.setScalar(scale);
        burstMat.opacity = Math.max(0, 1 - burstProgress);
        if (burstProgress >= 1) {
          burstProgress = -1;
          burstMat.opacity = 0;
        }
      }

      // Floating Yokai Orbs
      orbs.forEach((orb, idx) => {
        if (orb.cooldown > 0) {
          orb.cooldown = Math.max(0, orb.cooldown - dt);
          orb.mesh.scale.setScalar(0.15);
        } else {
          orb.mesh.scale.setScalar(1);
        }
        orb.mesh.position.y = orb.basePos.y + Math.sin(elapsed * 2 + idx) * 0.18;
        orb.mesh.rotation.y = elapsed * 1.4 + idx;
      });

      warrior.update(elapsed, dt);

      // Smooth damped chase camera facing Torii landmark
      desiredCamPos.set(
        warrior.root.position.x,
        2.45,
        warrior.root.position.z + 5.6,
      );
      camera.position.lerp(desiredCamPos, 1 - Math.exp(-6 * dt));
      lookTarget.set(warrior.root.position.x, 1.15, warrior.root.position.z - 0.8);
      camera.lookAt(lookTarget);

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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('click', triggerStrike);
      resizeObserver.disconnect();
      warrior.dispose();
      ground.geometry.dispose();
      groundMat.dispose();
      courtyardRing.geometry.dispose();
      ringMat.dispose();
      toriiRedMat.dispose();
      toriiDarkMat.dispose();
      orbGeo.dispose();
      orbMat.dispose();
      burstGeo.dispose();
      burstMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [gender, customization]);

  return (
    <div
      ref={mountRef}
      data-testid="sanctuary-game-canvas"
      className="h-full w-full cursor-crosshair"
    />
  );
}
