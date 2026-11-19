import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARCHERY_OPTIONS, SUPERPOWER_OPTIONS } from '../data/customizationCatalog';
import {
  buildRoundSpawnPlan,
  evaluateRoundOutcome,
  getRoundConfig,
  KodamaHitCheckState,
  KodamaRoundHudSnapshot,
  KodamaRoundOutcome,
  KodamaSpawnSpec,
  shouldAwardGhostHit,
} from '../data/kodamaChallenge';
import { isActivityUnlocked, isGadgetUnlocked } from '../data/progressionCatalog';
import { ActivityId, CharacterCustomization, Gender } from '../types/game';
import {
  createCrimsonAuraTexture,
  createForestGroundTexture,
  createKodamaGhostRig,
  createMistTexture,
  KodamaVisualRig,
  loadGrassWallTexture,
  loadKodamaGhostTexture,
} from './kodamaAssets';
import { WarriorCharacter3D } from './WarriorCharacter3D';

interface SanctuaryGameCanvasProps {
  gender: Gender;
  customization: CharacterCustomization;
  playerLevel: number;
  activeActivity: ActivityId;
  talismanActive: boolean;
  round: number;
  stage: 1 | 2;
  roundRunKey: number;
  onKodamaHit?: () => void;
  onRoundStatsChange?: (snapshot: KodamaRoundHudSnapshot) => void;
  onRoundFinished?: (outcome: KodamaRoundOutcome) => void;
  onActivityHit?: (activityId: ActivityId) => void;
  onSelectActivity?: (activityId: ActivityId) => void;
  onToggleTalisman?: () => void;
  onToggleRadar?: () => void;
  onLockedAttempt?: (message: string) => void;
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

interface ArrowProjectile {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
}

interface ActiveKodamaGhost extends KodamaHitCheckState {
  spec: KodamaSpawnSpec;
  rig: KodamaVisualRig;
  phaseTime: number;
  opacity: number;
  worldX: number;
  worldY: number;
  worldZ: number;
}

interface RoundEngineState {
  round: number;
  stage: 1 | 2;
  runKey: number;
  plan: KodamaSpawnSpec[];
  spawnIndex: number;
  spawnTimer: number;
  hits: number;
  finished: boolean;
  activeGhosts: ActiveKodamaGhost[];
}

export default function SanctuaryGameCanvas({
  gender,
  customization,
  playerLevel,
  activeActivity,
  talismanActive,
  round,
  stage,
  roundRunKey,
  onKodamaHit,
  onRoundStatsChange,
  onRoundFinished,
  onActivityHit,
  onSelectActivity,
  onToggleTalisman,
  onToggleRadar,
  onLockedAttempt,
}: SanctuaryGameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const warriorRef = useRef<WarriorCharacter3D | null>(null);

  const playerLevelRef = useRef(playerLevel);
  const activeActivityRef = useRef(activeActivity);
  const talismanActiveRef = useRef(talismanActive);
  const customizationRef = useRef(customization);
  const roundPropRef = useRef({ round, stage, roundRunKey });

  const onKodamaHitRef = useRef(onKodamaHit);
  const onRoundStatsChangeRef = useRef(onRoundStatsChange);
  const onRoundFinishedRef = useRef(onRoundFinished);
  const onActivityHitRef = useRef(onActivityHit);
  const onSelectActivityRef = useRef(onSelectActivity);
  const onToggleTalismanRef = useRef(onToggleTalisman);
  const onToggleRadarRef = useRef(onToggleRadar);
  const onLockedAttemptRef = useRef(onLockedAttempt);

  playerLevelRef.current = playerLevel;
  activeActivityRef.current = activeActivity;
  talismanActiveRef.current = talismanActive;
  customizationRef.current = customization;
  roundPropRef.current = { round, stage, roundRunKey };
  onKodamaHitRef.current = onKodamaHit;
  onRoundStatsChangeRef.current = onRoundStatsChange;
  onRoundFinishedRef.current = onRoundFinished;
  onActivityHitRef.current = onActivityHit;
  onSelectActivityRef.current = onSelectActivity;
  onToggleTalismanRef.current = onToggleTalisman;
  onToggleRadarRef.current = onToggleRadar;
  onLockedAttemptRef.current = onLockedAttempt;

  // Trigger ref so round changes restart cleanly without tearing down WebGL context
  const resetRoundTriggerRef = useRef<((r: number, s: 1 | 2, k: number) => void) | null>(null);

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
    renderer.toneMappingExposure = 1.05;
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
    scene.background = new THREE.Color(0x050a07);
    scene.fog = new THREE.FogExp2(0x08110b, 0.044);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 80);
    camera.position.set(0, 2.05, 6.2);

    // Dark supernatural Japanese forest + subtle crimson accents
    const hemi = new THREE.HemisphereLight(0x2d4a36, 0x060907, 0.72);
    scene.add(hemi);

    const forestMoonLight = new THREE.DirectionalLight(0xa7cbb5, 1.35);
    forestMoonLight.position.set(3.5, 9, 6);
    if (!isSoftwareGl) {
      forestMoonLight.castShadow = true;
      forestMoonLight.shadow.mapSize.set(1024, 1024);
      forestMoonLight.shadow.camera.left = -12;
      forestMoonLight.shadow.camera.right = 12;
      forestMoonLight.shadow.camera.top = 12;
      forestMoonLight.shadow.camera.bottom = -12;
      forestMoonLight.shadow.bias = -0.0005;
    }
    scene.add(forestMoonLight);

    const crimsonWallLightLeft = new THREE.PointLight(0xdc2626, 4.2, 16, 1.6);
    crimsonWallLightLeft.position.set(-4.5, 4.4, -3.5);
    scene.add(crimsonWallLightLeft);

    const crimsonWallLightRight = new THREE.PointLight(0xb91c1c, 4.2, 16, 1.6);
    crimsonWallLightRight.position.set(4.5, 4.4, -3.5);
    scene.add(crimsonWallLightRight);

    // Subtle warrior foreground fill so bow & hunter customization pop cleanly against the dark moss wall
    const hunterFillLight = new THREE.PointLight(0xd1fae5, 1.9, 8, 1.4);
    hunterFillLight.position.set(0, 2.3, 4.2);
    scene.add(hunterFillLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const grassWallTexture = loadGrassWallTexture(maxAniso);
    const kodamaTexture = loadKodamaGhostTexture(maxAniso);
    const mistTexture = createMistTexture();
    const crimsonAuraTexture = createCrimsonAuraTexture();
    const forestGroundTexture = createForestGroundTexture();

    // Forest moss clearing floor
    const groundMat = new THREE.MeshStandardMaterial({
      map: forestGroundTexture,
      roughness: 0.98,
      metalness: 0.01,
      envMapIntensity: 0.12,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(36, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Towering overgrown Grass Wall filling the background using the uploaded artwork
    const wallWidth = 26;
    const wallHeight = 12.2;
    const wallGeo = new THREE.PlaneGeometry(wallWidth, wallHeight, 24, 8);
    // Curve the wall slightly inward at outer edges so it wraps the hunter's field of view
    const wallPos = wallGeo.attributes.position;
    for (let i = 0; i < wallPos.count; i++) {
      const vx = wallPos.getX(i);
      const curveZ = vx * vx * 0.015;
      wallPos.setZ(i, curveZ);
    }
    wallGeo.computeVertexNormals();

    const wallMat = new THREE.MeshBasicMaterial({
      map: grassWallTexture,
    });
    const grassWallMesh = new THREE.Mesh(wallGeo, wallMat);
    grassWallMesh.position.set(0, wallHeight * 0.43, -6.75);
    scene.add(grassWallMesh);

    // Creeping Drifting Ground Fog & Crimson Mist Planes
    const mistGeo = new THREE.PlaneGeometry(7.2, 2.3);
    const mistPlanes: { mesh: THREE.Mesh; baseX: number; speed: number; phase: number }[] = [];
    const mistMats: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 6; i++) {
      const isCrimson = i % 3 === 1;
      const mat = new THREE.MeshBasicMaterial({
        map: isCrimson ? crimsonAuraTexture : mistTexture,
        transparent: true,
        opacity: isCrimson ? 0.22 : 0.3,
        depthWrite: false,
      });
      mistMats.push(mat);
      const mist = new THREE.Mesh(mistGeo, mat);
      const bx = -7.5 + i * 3.0;
      mist.position.set(bx, 0.72 + (i % 2) * 0.3, -5.2 + (i % 3) * 0.55);
      scene.add(mist);
      mistPlanes.push({ mesh: mist, baseX: bx, speed: 0.25 + (i % 3) * 0.1, phase: i * 1.3 });
    }

    // Foreground Customized Warrior & Bow facing the Grass Wall (-Z)
    const warrior = new WarriorCharacter3D(maxAniso);
    warrior.rebuild(gender, customizationRef.current, { playerLevel: playerLevelRef.current });
    warrior.root.position.set(0, 0, 2.2);
    warrior.root.rotation.y = Math.PI;
    scene.add(warrior.root);
    warriorRef.current = warrior;

    // Shared Arrow Geometries & Materials
    const arrowShaftGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.95, 8);
    arrowShaftGeo.rotateX(Math.PI / 2);
    const arrowTipGeo = new THREE.ConeGeometry(0.055, 0.18, 6);
    arrowTipGeo.rotateX(Math.PI / 2);
    const arrowShaftMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.7,
    });
    const arrowTipMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    const arrows: ArrowProjectile[] = [];

    // Shared Kodama Ghost Geometries (well-proportioned against the mossy wall)
    const ghostBodyGeo = new THREE.PlaneGeometry(1.65, 2.1);
    const ghostAuraGeo = new THREE.PlaneGeometry(2.15, 2.5);
    const ghostEyeGeo = new THREE.CircleGeometry(0.017, 12);
    const ghostHitboxGeo = new THREE.BoxGeometry(1.3, 1.85, 0.65);
    const ghostHitboxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    // Hit Shockwave Ring (bursts cleanly at ghost position on hit)
    const superpowerOpt =
      SUPERPOWER_OPTIONS.find((s) => s.id === customizationRef.current.superpower) ??
      SUPERPOWER_OPTIONS[0];
    const burstGeo = new THREE.RingGeometry(0.24, 0.38, 32);
    const burstMat = new THREE.MeshBasicMaterial({
      color: superpowerOpt.primaryHex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const burstRing = new THREE.Mesh(burstGeo, burstMat);
    burstRing.position.set(0, 2, -5);
    scene.add(burstRing);

    const keys = new Set<string>();
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const wallAimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 5.6); // z = -5.6
    const lastAimPoint = new THREE.Vector3(0, 2.35, -5.6);
    let burstProgress = -1;
    let arrowsFired = 0;

    // Kodama Round State
    const ghostRoot = new THREE.Group();
    scene.add(ghostRoot);

    const roundState: RoundEngineState = {
      round: roundPropRef.current.round,
      stage: roundPropRef.current.stage,
      runKey: roundPropRef.current.roundRunKey,
      plan: buildRoundSpawnPlan(roundPropRef.current.round, roundPropRef.current.stage),
      spawnIndex: 0,
      spawnTimer: 0.35,
      hits: 0,
      finished: false,
      activeGhosts: [],
    };

    const syncRoundHud = () => {
      const totalGhosts = roundState.plan.length;
      const activeCount = roundState.activeGhosts.filter((g) => g.phase !== 'dissolving').length;
      const unspawned = Math.max(0, totalGhosts - roundState.spawnIndex);
      const remainingGhosts = unspawned + activeCount;
      const outcome = evaluateRoundOutcome(roundState.round, roundState.hits, totalGhosts);

      container.dataset.round = String(roundState.round);
      container.dataset.stage = String(roundState.stage);
      container.dataset.roundHits = String(roundState.hits);
      container.dataset.roundSpawned = String(roundState.spawnIndex);
      container.dataset.activeGhosts = String(activeCount);
      container.dataset.crossingActive = roundState.activeGhosts.some(
        (g) => g.spec.kind === 'crossing' && g.phase !== 'dissolving',
      )
        ? 'true'
        : 'false';

      onRoundStatsChangeRef.current?.({
        round: roundState.round,
        stage: roundState.stage,
        totalGhosts,
        spawnedCount: roundState.spawnIndex,
        activeCount,
        hits: roundState.hits,
        minRequiredHits: outcome.minRequiredHits,
        remainingGhosts,
        completed: roundState.finished,
        passed: outcome.passed,
      });
    };

    const disposeGhostRig = (rig: KodamaVisualRig) => {
      ghostRoot.remove(rig.group);
      rig.bodyMat.dispose();
      rig.auraMat.dispose();
      rig.eyeLeftMat.dispose();
      rig.eyeRightMat.dispose();
    };

    const resetRoundEngine = (nextRound: number, nextStage: 1 | 2, nextRunKey: number) => {
      for (const g of roundState.activeGhosts) {
        disposeGhostRig(g.rig);
      }
      roundState.activeGhosts = [];
      for (const arrow of arrows) {
        scene.remove(arrow.mesh);
      }
      arrows.length = 0;

      roundState.round = nextRound;
      roundState.stage = nextStage;
      roundState.runKey = nextRunKey;
      roundState.plan = buildRoundSpawnPlan(nextRound, nextStage);
      roundState.spawnIndex = 0;
      roundState.spawnTimer = 0.35;
      roundState.hits = 0;
      roundState.finished = false;
      syncRoundHud();
    };

    resetRoundTriggerRef.current = resetRoundEngine;
    syncRoundHud();

    const spawnNextGhost = (spec: KodamaSpawnSpec) => {
      const rig = createKodamaGhostRig(
        spec.id,
        kodamaTexture,
        crimsonAuraTexture,
        ghostBodyGeo,
        ghostAuraGeo,
        ghostEyeGeo,
        ghostHitboxGeo,
        ghostHitboxMat,
      );
      rig.group.position.set(spec.x, spec.y, spec.z);
      ghostRoot.add(rig.group);

      roundState.activeGhosts.push({
        spec,
        rig,
        active: true,
        hitAwarded: false,
        phase: 'fading_in',
        phaseTime: 0,
        opacity: 0,
        worldX: spec.x,
        worldY: spec.y,
        worldZ: spec.z,
      });
    };

    const resolveAimPoint = (clientX?: number, clientY?: number): THREE.Vector3 => {
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
          pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointerNdc, camera);

          const activeHitboxes = roundState.activeGhosts
            .filter((g) => shouldAwardGhostHit(g))
            .map((g) => g.rig.hitboxMesh);

          const ghostHits = raycaster.intersectObjects(activeHitboxes, false);
          if (ghostHits.length > 0) {
            const hitId = ghostHits[0].object.userData.ghostId;
            const matched = roundState.activeGhosts.find((g) => g.spec.id === hitId);
            if (matched) {
              lastAimPoint.set(matched.worldX, matched.worldY + 0.1, matched.worldZ);
              return lastAimPoint;
            }
          }

          if (raycaster.ray.intersectPlane(wallAimPlane, lastAimPoint)) {
            return lastAimPoint;
          }
        }
      }

      // Keyboard Space: lock onto nearest visible/emerging Kodama ghost (leading horizontal crossers slightly)
      const hittable = roundState.activeGhosts.filter((g) => shouldAwardGhostHit(g));
      const preferred =
        hittable.find((g) => g.phase === 'visible' || g.phase === 'fading_in') ?? hittable[0];
      if (preferred) {
        let aimX = preferred.worldX;
        if (preferred.spec.kind === 'crossing') {
          const dist = Math.hypot(
            preferred.worldX - warrior.root.position.x,
            preferred.worldZ - warrior.root.position.z,
          );
          const dirSign = preferred.spec.endX >= preferred.spec.startX ? 1 : -1;
          aimX += dirSign * preferred.spec.speed * (dist / 24) * 0.75;
        }
        return new THREE.Vector3(aimX, preferred.worldY + 0.1, preferred.worldZ);
      }
      return new THREE.Vector3(warrior.root.position.x, 2.35, -5.6);
    };

    const spawnArrowToward = (targetPos: THREE.Vector3) => {
      const bowOpt =
        ARCHERY_OPTIONS.find((a) => a.id === customizationRef.current.archery) ??
        ARCHERY_OPTIONS[0];
      arrowTipMat.color.set(bowOpt.glowHex);

      const startPos = new THREE.Vector3(
        warrior.root.position.x + 0.14,
        1.42,
        warrior.root.position.z - 0.3,
      );
      const dir = targetPos.clone().sub(startPos);
      if (dir.lengthSq() < 0.05) {
        dir.set(0, 0.12, -1);
      }
      dir.normalize();

      const arrowGroup = new THREE.Group();
      const shaft = new THREE.Mesh(arrowShaftGeo, arrowShaftMat);
      const tip = new THREE.Mesh(arrowTipGeo, arrowTipMat);
      tip.position.z = 0.5;
      arrowGroup.add(shaft);
      arrowGroup.add(tip);

      arrowGroup.position.copy(startPos);
      arrowGroup.lookAt(startPos.clone().add(dir));

      // Keep warrior turned subtly toward shot while still facing the wall
      const horizontalYaw = Math.atan2(dir.x, dir.z);
      warrior.root.rotation.y = horizontalYaw;

      scene.add(arrowGroup);
      arrows.push({
        mesh: arrowGroup,
        velocity: dir.multiplyScalar(24),
        life: 1.4,
      });

      arrowsFired += 1;
      container.dataset.arrowsFired = String(arrowsFired);
      warrior.triggerFlourish();
    };

    const triggerAction = (clientX?: number, clientY?: number) => {
      const lvl = playerLevelRef.current;
      let activity = activeActivityRef.current;

      if (!isActivityUnlocked(lvl, activity)) {
        onLockedAttemptRef.current?.(
          `${activity === 'sword_combat' ? 'Katana Strike' : 'Spirit Superpower'} is locked at Level ${lvl}. Using Archery.`,
        );
        activity = 'archery';
      }

      if (activity === 'archery') {
        const targetPos = resolveAimPoint(clientX, clientY);
        spawnArrowToward(targetPos);
        return;
      }

      if (activity === 'sword_combat') {
        if (!isActivityUnlocked(lvl, 'sword_combat')) {
          onLockedAttemptRef.current?.('Katana Strike unlocks at Level 2.');
          return;
        }
        warrior.triggerFlourish();
        burstMat.color.set('#38bdf8');
        burstProgress = 0;
        burstRing.position.set(warrior.root.position.x, 1.4, warrior.root.position.z - 1.4);
        for (const ghost of roundState.activeGhosts) {
          if (
            shouldAwardGhostHit(ghost) &&
            Math.hypot(ghost.worldX - warrior.root.position.x, ghost.worldZ - warrior.root.position.z) < 5.5
          ) {
            ghost.hitAwarded = true;
            ghost.active = false;
            ghost.phase = 'dissolving';
            ghost.phaseTime = 0;
            roundState.hits += 1;
            onKodamaHitRef.current?.();
            onActivityHitRef.current?.('sword_combat');
            syncRoundHud();
          }
        }
        return;
      }

      if (activity === 'superpower_burst') {
        if (!isActivityUnlocked(lvl, 'superpower_burst')) {
          onLockedAttemptRef.current?.('Spirit Superpower unlocks at Level 3.');
          return;
        }
        warrior.triggerFlourish();
        const curPow =
          SUPERPOWER_OPTIONS.find((s) => s.id === customizationRef.current.superpower) ??
          SUPERPOWER_OPTIONS[0];
        burstMat.color.set(curPow.primaryHex);
        burstProgress = 0;
        burstRing.position.set(warrior.root.position.x, 1.8, -4.6);
        for (const ghost of roundState.activeGhosts) {
          if (shouldAwardGhostHit(ghost)) {
            ghost.hitAwarded = true;
            ghost.active = false;
            ghost.phase = 'dissolving';
            ghost.phaseTime = 0;
            roundState.hits += 1;
            onKodamaHitRef.current?.();
            onActivityHitRef.current?.('superpower_burst');
            syncRoundHud();
          }
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      const lvl = playerLevelRef.current;

      if (e.code === 'Digit1') {
        onSelectActivityRef.current?.('archery');
        return;
      }
      if (e.code === 'Digit2') {
        if (!isActivityUnlocked(lvl, 'sword_combat')) {
          onLockedAttemptRef.current?.('Katana Strike & Hunter Katana unlock at Level 2.');
          return;
        }
        onSelectActivityRef.current?.('sword_combat');
        return;
      }
      if (e.code === 'Digit3') {
        if (!isActivityUnlocked(lvl, 'superpower_burst')) {
          onLockedAttemptRef.current?.('Spirit Superpower unlocks at Level 3.');
          return;
        }
        onSelectActivityRef.current?.('superpower_burst');
        return;
      }
      if (e.code === 'Digit4') {
        if (!isGadgetUnlocked(lvl, 'spirit_talisman')) {
          onLockedAttemptRef.current?.('Spirit Talisman unlocks at Level 2.');
          return;
        }
        onToggleTalismanRef.current?.();
        return;
      }
      if (e.code === 'Digit5') {
        if (!isGadgetUnlocked(lvl, 'yokai_radar')) {
          onLockedAttemptRef.current?.('Yokai Compass unlocks at Level 3.');
          return;
        }
        onToggleRadarRef.current?.();
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        if (!isActivityUnlocked(lvl, 'sword_combat')) {
          onLockedAttemptRef.current?.(
            'Katana Strike unlocks at Level 2. Use Space or Click for Archery.',
          );
          return;
        }
        triggerAction();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        triggerAction();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => keys.clear();
    const onMouseMove = (e: MouseEvent) => {
      resolveAimPoint(e.clientX, e.clientY);
    };
    const onCanvasClick = (e: MouseEvent) => triggerAction(e.clientX, e.clientY);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onCanvasClick);

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
    const prevArrowPos = new THREE.Vector3();
    const segVec = new THREE.Vector3();
    const toGhost = new THREE.Vector3();
    const closestPt = new THREE.Vector3();

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
      const rawDt = (now - lastMs) / 1000;
      const dt = Math.min(rawDt, 0.05);
      const simDt = Math.min(rawDt, 0.14);
      lastMs = now;
      const elapsed = (now - startMs) / 1000;

      // Foreground Warrior Movement (kept cleanly in front of the Grass Wall)
      moveVec.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveVec.z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveVec.z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveVec.x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveVec.x += 1;

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        const talismanBoost =
          talismanActiveRef.current &&
          isGadgetUnlocked(playerLevelRef.current, 'spirit_talisman')
            ? 5.8
            : 4.0;
        warrior.root.position.x = THREE.MathUtils.clamp(
          warrior.root.position.x + moveVec.x * talismanBoost * dt,
          -6.5,
          6.5,
        );
        warrior.root.position.z = THREE.MathUtils.clamp(
          warrior.root.position.z + moveVec.z * talismanBoost * dt,
          0.4,
          4.0,
        );
        const targetAngle = Math.atan2(moveVec.x, moveVec.z);
        let diff = targetAngle - warrior.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        warrior.root.rotation.y += diff * (1 - Math.exp(-10 * dt));
      }

      // Subtle atmospheric drift on mist planes & crimson lighting
      for (const mist of mistPlanes) {
        mist.mesh.position.x = mist.baseX + Math.sin(elapsed * mist.speed + mist.phase) * 0.9;
      }
      crimsonWallLightLeft.intensity = 3.8 + Math.sin(elapsed * 2.1) * 0.65;
      crimsonWallLightRight.intensity = 3.8 + Math.cos(elapsed * 1.9) * 0.65;

      // Spawn Kodama Ghosts dynamically (staggered, never all simultaneously)
      const roundCfg = getRoundConfig(roundState.round);
      let hudDirty = false;
      if (!roundState.finished && roundState.spawnIndex < roundState.plan.length) {
        roundState.spawnTimer -= simDt;
        const activeNonDissolving = roundState.activeGhosts.filter(
          (g) => g.phase !== 'dissolving',
        ).length;
        if (roundState.spawnTimer <= 0 && activeNonDissolving < roundCfg.maxConcurrent) {
          const nextSpec = roundState.plan[roundState.spawnIndex];
          spawnNextGhost(nextSpec);
          roundState.spawnIndex += 1;
          const following = roundState.plan[roundState.spawnIndex];
          roundState.spawnTimer = following ? following.delayAfterPrevious : 0.5;
          hudDirty = true;
        }
      }

      // Advance Active Kodama Ghosts (Fade-in, Hover / Sudden Crossing, Fade-out, Dissolve)
      for (let i = roundState.activeGhosts.length - 1; i >= 0; i--) {
        const ghost = roundState.activeGhosts[i];
        ghost.phaseTime += simDt;

        if (ghost.phase === 'fading_in') {
          const p = Math.min(1, ghost.phaseTime / ghost.spec.fadeDuration);
          ghost.opacity = p;
          if (ghost.spec.kind === 'wall') {
            ghost.worldZ = ghost.spec.z + p * 0.4;
          }
          if (p >= 1) {
            ghost.phase = 'visible';
            ghost.phaseTime = 0;
          }
        } else if (ghost.phase === 'visible') {
          ghost.opacity = 1;
          if (ghost.spec.kind === 'crossing') {
            const travelProgress = Math.min(1, ghost.phaseTime / ghost.spec.visibleDuration);
            ghost.worldX = THREE.MathUtils.lerp(
              ghost.spec.startX,
              ghost.spec.endX,
              travelProgress,
            );
            ghost.worldY =
              ghost.spec.y +
              Math.sin(elapsed * 4.2 + ghost.spec.bobPhase) * ghost.spec.swayAmp;
          } else {
            ghost.worldX =
              ghost.spec.x +
              Math.sin(elapsed * 1.9 + ghost.spec.bobPhase) * ghost.spec.swayAmp;
            ghost.worldY =
              ghost.spec.y +
              Math.cos(elapsed * 2.4 + ghost.spec.bobPhase) * (ghost.spec.swayAmp * 0.65);
          }
          if (ghost.phaseTime >= ghost.spec.visibleDuration) {
            ghost.phase = 'fading_out';
            ghost.phaseTime = 0;
          }
        } else if (ghost.phase === 'fading_out') {
          const p = Math.min(1, ghost.phaseTime / ghost.spec.fadeDuration);
          ghost.opacity = Math.max(0, 1 - p);
          if (ghost.spec.kind === 'crossing') {
            const dirSign = ghost.spec.endX >= ghost.spec.startX ? 1 : -1;
            ghost.worldX += dirSign * ghost.spec.speed * simDt * 0.55;
          }
          if (p >= 1) {
            ghost.active = false;
            ghost.phase = 'gone';
            disposeGhostRig(ghost.rig);
            roundState.activeGhosts.splice(i, 1);
            hudDirty = true;
            continue;
          }
        } else if (ghost.phase === 'dissolving') {
          const p = Math.min(1, ghost.phaseTime / 0.28);
          ghost.opacity = Math.max(0, 1 - p);
          ghost.rig.group.scale.setScalar(1 + p * 0.35);
          if (p >= 1) {
            ghost.phase = 'gone';
            disposeGhostRig(ghost.rig);
            roundState.activeGhosts.splice(i, 1);
            hudDirty = true;
            continue;
          }
        }

        ghost.rig.group.position.set(ghost.worldX, ghost.worldY, ghost.worldZ);
        ghost.rig.bodyMat.opacity = ghost.opacity;
        ghost.rig.auraMat.opacity = ghost.opacity * (ghost.spec.kind === 'crossing' ? 0.55 : 0.36);
        const eyePulse = 0.8 + Math.sin(elapsed * 7 + ghost.spec.bobPhase) * 0.2;
        ghost.rig.eyeLeftMat.opacity = ghost.opacity * eyePulse;
        ghost.rig.eyeRightMat.opacity = ghost.opacity * eyePulse;
      }

      // Check Round Completion (once all planned ghosts spawned & cleared)
      if (
        !roundState.finished &&
        roundState.spawnIndex >= roundState.plan.length &&
        roundState.activeGhosts.length === 0
      ) {
        roundState.finished = true;
        hudDirty = true;
        const outcome = evaluateRoundOutcome(
          roundState.round,
          roundState.hits,
          roundState.plan.length,
        );
        onRoundFinishedRef.current?.(outcome);
      }

      // Advance Arrows & Continuous Swept-Segment Collision Against Kodama Ghosts (prevents tunneling)
      for (let i = arrows.length - 1; i >= 0; i--) {
        const arrow = arrows[i];
        prevArrowPos.copy(arrow.mesh.position);
        arrow.mesh.position.addScaledVector(arrow.velocity, simDt);
        arrow.life -= simDt;

        segVec.copy(arrow.mesh.position).sub(prevArrowPos);
        const segLenSq = Math.max(0.0001, segVec.lengthSq());

        let hitGhost = false;
        for (const ghost of roundState.activeGhosts) {
          if (!shouldAwardGhostHit(ghost)) continue;
          toGhost.set(
            ghost.worldX - prevArrowPos.x,
            ghost.worldY - prevArrowPos.y,
            ghost.worldZ - prevArrowPos.z,
          );
          const t = THREE.MathUtils.clamp(toGhost.dot(segVec) / segLenSq, 0, 1);
          closestPt.copy(prevArrowPos).addScaledVector(segVec, t);

          const dx = Math.abs(closestPt.x - ghost.worldX);
          const dy = Math.abs(closestPt.y - ghost.worldY);
          const dz = Math.abs(closestPt.z - ghost.worldZ);

          if (dx < 0.85 && dy < 1.08 && dz < 0.95) {
            ghost.hitAwarded = true;
            ghost.active = false;
            ghost.phase = 'dissolving';
            ghost.phaseTime = 0;

            roundState.hits += 1;
            hudDirty = true;

            burstMat.color.set('#38bdf8');
            burstProgress = 0;
            burstRing.position.set(ghost.worldX, ghost.worldY + 0.1, ghost.worldZ + 0.15);

            hitGhost = true;
            onKodamaHitRef.current?.();
            break;
          }
        }

        if (hitGhost || arrow.life <= 0 || arrow.mesh.position.z < -7.2) {
          scene.remove(arrow.mesh);
          arrows.splice(i, 1);
        }
      }

      if (hudDirty) {
        syncRoundHud();
      }

      // Burst shockwave animation
      if (burstProgress >= 0) {
        burstProgress += simDt * 2.8;
        const scale = 1 + burstProgress * 5.2;
        burstRing.scale.setScalar(scale);
        burstMat.opacity = Math.max(0, 1 - burstProgress);
        if (burstProgress >= 1) {
          burstProgress = -1;
          burstMat.opacity = 0;
        }
      }

      warrior.update(elapsed, dt);

      // Frame BOTH the foreground customized warrior+bow AND the towering Grass Wall + Kodama ghosts
      desiredCamPos.set(
        warrior.root.position.x * 0.48,
        2.05,
        warrior.root.position.z + 4.1,
      );
      camera.position.lerp(desiredCamPos, 1 - Math.exp(-6 * dt));
      lookTarget.set(warrior.root.position.x * 0.35, 2.08, -2.6);
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
      resetRoundTriggerRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      resizeObserver.disconnect();
      for (const g of roundState.activeGhosts) {
        disposeGhostRig(g.rig);
      }
      warrior.dispose();
      arrowShaftGeo.dispose();
      arrowTipGeo.dispose();
      arrowShaftMat.dispose();
      arrowTipMat.dispose();
      ghostBodyGeo.dispose();
      ghostAuraGeo.dispose();
      ghostEyeGeo.dispose();
      ghostHitboxGeo.dispose();
      ghostHitboxMat.dispose();
      ground.geometry.dispose();
      groundMat.dispose();
      forestGroundTexture.dispose();
      wallGeo.dispose();
      wallMat.dispose();
      grassWallTexture.dispose();
      kodamaTexture.dispose();
      mistTexture.dispose();
      crimsonAuraTexture.dispose();
      mistGeo.dispose();
      for (const mm of mistMats) mm.dispose();
      burstGeo.dispose();
      burstMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      warriorRef.current = null;
    };
  }, [gender]);

  // Restart/switch round cleanly when round, stage, or roundRunKey changes
  useEffect(() => {
    resetRoundTriggerRef.current?.(round, stage, roundRunKey);
  }, [round, stage, roundRunKey]);

  // Rebuild warrior appearance cleanly when customization or playerLevel changes
  useEffect(() => {
    const warrior = warriorRef.current;
    if (!warrior) return;
    warrior.rebuild(gender, customization, { playerLevel });
  }, [gender, customization, playerLevel]);

  return (
    <div
      ref={mountRef}
      data-testid="sanctuary-game-canvas"
      data-level={playerLevel}
      data-activity={activeActivity}
      data-round={round}
      data-stage={stage}
      className="h-full w-full cursor-crosshair"
    />
  );
}
