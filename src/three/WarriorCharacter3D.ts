import * as THREE from 'three';
import {
  ARCHERY_OPTIONS,
  COSTUME_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  SUPERPOWER_OPTIONS,
  SWORD_OPTIONS,
} from '../data/customizationCatalog';
import {
  ArcheryId,
  CharacterCustomization,
  Gender,
  HairStyleId,
  SuperpowerId,
  SwordId,
} from '../types/game';
import {
  createFaceTexture,
  createLeatherBumpTexture,
  createOutfitBrocadeTexture,
  createSanctuaryRingTexture,
} from './proceduralTextures';

interface AnimParts {
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  hairSwayGroup: THREE.Group;
  tasselGroups: THREE.Group[];
  coatSwayGroup: THREE.Group;
  auraRings: THREE.Mesh[];
  auraMotes: THREE.InstancedMesh | null;
  moteBaseData: { angle: number; radius: number; height: number; speed: number; scale: number }[];
  groundSigil: THREE.Mesh | null;
  auraLight: THREE.PointLight | null;
}

export class WarriorCharacter3D {
  public readonly root = new THREE.Group();
  private characterContainer = new THREE.Group();
  private disposableGeometries: THREE.BufferGeometry[] = [];
  private disposableMaterials: THREE.Material[] = [];
  private disposableTextures: THREE.Texture[] = [];
  private sharedLeatherBump: THREE.CanvasTexture;
  private maxAnisotropy: number;
  private anim: AnimParts = {
    torsoGroup: new THREE.Group(),
    headGroup: new THREE.Group(),
    leftArmGroup: new THREE.Group(),
    rightArmGroup: new THREE.Group(),
    hairSwayGroup: new THREE.Group(),
    tasselGroups: [],
    coatSwayGroup: new THREE.Group(),
    auraRings: [],
    auraMotes: null,
    moteBaseData: [],
    groundSigil: null,
    auraLight: null,
  };
  private attackTimer = 0;
  private baseTorsoY = 1.04;
  private dummyMatrix = new THREE.Object3D();

  constructor(maxAnisotropy: number) {
    this.maxAnisotropy = maxAnisotropy;
    this.sharedLeatherBump = createLeatherBumpTexture(maxAnisotropy);
    this.root.add(this.characterContainer);
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.disposableGeometries.push(geo);
    return geo;
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.disposableMaterials.push(mat);
    return mat;
  }

  private trackTex<T extends THREE.Texture>(tex: T): T {
    this.disposableTextures.push(tex);
    return tex;
  }

  public triggerFlourish(): void {
    this.attackTimer = 0.65;
  }

  public rebuild(gender: Gender, custom: CharacterCustomization): void {
    this.clearCurrentCharacter();

    const isMale = gender === 'male';
    const costume = COSTUME_OPTIONS.find((c) => c.id === custom.costume) ?? COSTUME_OPTIONS[0];
    const hairColorOpt =
      HAIR_COLOR_OPTIONS.find((h) => h.id === custom.hairColor) ?? HAIR_COLOR_OPTIONS[0];
    const skinOpt =
      SKIN_TONE_OPTIONS.find((s) => s.id === custom.skinTone) ?? SKIN_TONE_OPTIONS[0];
    const superpowerOpt =
      SUPERPOWER_OPTIONS.find((sp) => sp.id === custom.superpower) ?? SUPERPOWER_OPTIONS[0];

    // Textures
    const faceTex = this.trackTex(
      createFaceTexture(
        {
          gender,
          skinTone: custom.skinTone,
          hairColor: custom.hairColor,
        },
        this.maxAnisotropy,
      ),
    );
    const brocadeTex = this.trackTex(createOutfitBrocadeTexture(costume, this.maxAnisotropy));

    // Materials
    const skinMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: skinOpt.hex,
        roughness: 0.78,
        metalness: 0.0,
      }),
    );
    const faceMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: faceTex,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
        roughness: 0.78,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const outfitMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: brocadeTex,
        bumpMap: this.sharedLeatherBump,
        bumpScale: 0.012,
        color: 0xffffff,
        roughness: costume.armorStyle === 'plate' ? 0.36 : 0.68,
        metalness: costume.armorStyle === 'plate' ? 0.55 : 0.14,
      }),
    );
    const secondaryFabricMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: costume.secondaryHex,
        bumpMap: this.sharedLeatherBump,
        bumpScale: 0.008,
        roughness: 0.72,
        metalness: 0.08,
        side: THREE.DoubleSide,
      }),
    );
    const innerLiningMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: costume.innerHex,
        roughness: 0.78,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    );
    const trimGoldMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: costume.trimHex,
        roughness: 0.24,
        metalness: 0.88,
      }),
    );
    const darkArmorMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: costume.primaryHex,
        bumpMap: this.sharedLeatherBump,
        bumpScale: 0.01,
        roughness: 0.42,
        metalness: 0.42,
        side: THREE.DoubleSide,
      }),
    );
    const hairMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: hairColorOpt.hex,
        roughness: 0.48,
        metalness: 0.18,
      }),
    );

    // Proportions
    const hipY = isMale ? 0.94 : 0.91;
    const waistY = isMale ? 1.04 : 0.99;
    const shoulderY = isMale ? 1.43 : 1.37;
    const shoulderSpan = isMale ? 0.215 : 0.172;
    const hipSpan = isMale ? 0.102 : 0.098;

    // 1. LOWER BODY: BOOTS & LEGS (grounded flush at y = 0)
    for (const side of [-1, 1]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(side * hipSpan, 0, 0);

      // Boot sole + sculpted foot
      const soleGeo = this.trackGeo(new THREE.BoxGeometry(0.088, 0.032, 0.21));
      const sole = new THREE.Mesh(soleGeo, darkArmorMat);
      sole.position.set(0, 0.016, 0.042);
      sole.castShadow = true;
      legGroup.add(sole);

      if (!isMale) {
        // Subtle heeled boot arch for female warrior matching reference
        const heelGeo = this.trackGeo(new THREE.BoxGeometry(0.055, 0.055, 0.055));
        const heel = new THREE.Mesh(heelGeo, darkArmorMat);
        heel.position.set(0, 0.032, -0.035);
        legGroup.add(heel);
      }

      const toeGeo = this.trackGeo(new THREE.SphereGeometry(0.046, 16, 12));
      const toe = new THREE.Mesh(toeGeo, darkArmorMat);
      toe.scale.set(0.95, 0.72, 1.55);
      toe.position.set(0, 0.046, 0.085);
      legGroup.add(toe);

      // Tall knee-high armored boot shaft (Lathe)
      const bootProfile = [
        new THREE.Vector2(0.046, 0.03),
        new THREE.Vector2(0.049, 0.16),
        new THREE.Vector2(0.058, 0.34),
        new THREE.Vector2(0.065, 0.45),
        new THREE.Vector2(0.056, 0.46),
      ];
      const bootGeo = this.trackGeo(new THREE.LatheGeometry(bootProfile, 18));
      const boot = new THREE.Mesh(bootGeo, darkArmorMat);
      boot.castShadow = true;
      legGroup.add(boot);

      // Gold filigree boot cuff & shin plate
      const cuffGeo = this.trackGeo(new THREE.TorusGeometry(0.064, 0.008, 10, 24));
      const cuff = new THREE.Mesh(cuffGeo, trimGoldMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.445;
      legGroup.add(cuff);

      const shinGuardGeo = this.trackGeo(new THREE.BoxGeometry(0.038, 0.24, 0.024));
      const shinGuard = new THREE.Mesh(shinGuardGeo, trimGoldMat);
      shinGuard.position.set(0, 0.28, 0.056);
      legGroup.add(shinGuard);

      // Upper thigh / trousers
      const thighProfile = isMale
        ? [
            new THREE.Vector2(0.062, 0.44),
            new THREE.Vector2(0.088, 0.65),
            new THREE.Vector2(0.092, hipY),
          ]
        : [
            new THREE.Vector2(0.056, 0.44),
            new THREE.Vector2(0.072, 0.68),
            new THREE.Vector2(0.078, hipY),
          ];
      const thighGeo = this.trackGeo(new THREE.LatheGeometry(thighProfile, 18));
      const thigh = new THREE.Mesh(thighGeo, isMale ? outfitMat : innerLiningMat);
      thigh.castShadow = true;
      legGroup.add(thigh);

      this.characterContainer.add(legGroup);
    }

    // 2. PELVIS & LAYERED BATTLE COAT SKIRT PANELS
    const pelvisGeo = this.trackGeo(
      new THREE.CylinderGeometry(isMale ? 0.15 : 0.138, isMale ? 0.17 : 0.165, 0.16, 20),
    );
    const pelvis = new THREE.Mesh(pelvisGeo, outfitMat);
    pelvis.scale.set(1.12, 1, 0.78);
    pelvis.position.y = hipY;
    this.characterContainer.add(pelvis);

    const coatSwayGroup = new THREE.Group();
    coatSwayGroup.position.y = waistY;
    this.anim.coatSwayGroup = coatSwayGroup;

    // Back & Side split battle coat (outer dark brocade + inner crimson lining)
    const coatH = isMale ? 0.72 : 0.68;
    const coatTopR = isMale ? 0.165 : 0.155;
    const coatBotR = isMale ? 0.34 : 0.36;

    const backCoatGeo = this.trackGeo(
      new THREE.CylinderGeometry(coatTopR, coatBotR, coatH, 28, 1, true, Math.PI * 0.25, Math.PI * 1.5),
    );
    const backCoat = new THREE.Mesh(backCoatGeo, outfitMat);
    backCoat.position.y = -coatH / 2 + 0.02;
    backCoat.scale.set(1.06, 1, 0.86);
    backCoat.castShadow = true;
    coatSwayGroup.add(backCoat);

    const backLiningGeo = this.trackGeo(
      new THREE.CylinderGeometry(
        coatTopR - 0.008,
        coatBotR - 0.012,
        coatH - 0.03,
        24,
        1,
        true,
        Math.PI * 0.27,
        Math.PI * 1.46,
      ),
    );
    const backLining = new THREE.Mesh(backLiningGeo, innerLiningMat);
    backLining.position.y = -coatH / 2 + 0.03;
    backLining.scale.set(1.04, 1, 0.84);
    coatSwayGroup.add(backLining);

    // Front brocade dragon/phoenix tabard panel + crimson under-skirt panels
    const frontTabardGeo = this.trackGeo(
      new THREE.CylinderGeometry(
        coatTopR + 0.006,
        coatBotR * 0.75,
        coatH * 0.92,
        16,
        1,
        true,
        -Math.PI * 0.16,
        Math.PI * 0.32,
      ),
    );
    const frontTabard = new THREE.Mesh(frontTabardGeo, outfitMat);
    frontTabard.position.set(0, -coatH * 0.46 + 0.02, 0.012);
    frontTabard.scale.set(1.05, 1, 0.88);
    frontTabard.castShadow = true;
    coatSwayGroup.add(frontTabard);

    // Front flanking crimson-and-gold panels (matching reference art)
    for (const side of [-1, 1]) {
      const panelGeo = this.trackGeo(new THREE.BoxGeometry(0.11, coatH * 0.82, 0.016));
      const panel = new THREE.Mesh(panelGeo, secondaryFabricMat);
      panel.position.set(side * 0.135, -coatH * 0.42, 0.115);
      panel.rotation.y = side * -0.45;
      panel.rotation.z = side * 0.16;
      coatSwayGroup.add(panel);

      const trimStripGeo = this.trackGeo(new THREE.BoxGeometry(0.016, coatH * 0.82, 0.02));
      const trimStrip = new THREE.Mesh(trimStripGeo, trimGoldMat);
      trimStrip.position.set(side * -0.048, 0, 0);
      panel.add(trimStrip);
    }

    this.characterContainer.add(coatSwayGroup);

    // 3. TORSO, WAIST CORSET, COLLAR & ARMOR
    const torsoGroup = new THREE.Group();
    this.baseTorsoY = waistY;
    torsoGroup.position.y = waistY;
    this.anim.torsoGroup = torsoGroup;

    const torsoHeight = shoulderY - waistY + 0.04;
    const torsoProfile = isMale
      ? [
          new THREE.Vector2(0.138, 0),
          new THREE.Vector2(0.146, torsoHeight * 0.25),
          new THREE.Vector2(0.182, torsoHeight * 0.68),
          new THREE.Vector2(0.195, torsoHeight * 0.9),
          new THREE.Vector2(0.115, torsoHeight),
        ]
      : [
          new THREE.Vector2(0.105, 0),
          new THREE.Vector2(0.12, torsoHeight * 0.28),
          new THREE.Vector2(0.155, torsoHeight * 0.65),
          new THREE.Vector2(0.152, torsoHeight * 0.88),
          new THREE.Vector2(0.098, torsoHeight),
        ];
    const torsoGeo = this.trackGeo(new THREE.LatheGeometry(torsoProfile, 24));
    const torso = new THREE.Mesh(torsoGeo, outfitMat);
    torso.scale.set(1.12, 1, 0.74);
    torso.castShadow = true;
    torsoGroup.add(torso);

    // Ornate Waist Belt / Corset Sash + Gold Buckle + Hanging Tassels
    const beltGeo = this.trackGeo(
      new THREE.CylinderGeometry(isMale ? 0.154 : 0.125, isMale ? 0.158 : 0.136, 0.11, 24),
    );
    const belt = new THREE.Mesh(beltGeo, secondaryFabricMat);
    belt.scale.set(1.13, 1, 0.79);
    belt.position.y = 0.04;
    torsoGroup.add(belt);

    const goldBeltBandGeo = this.trackGeo(
      new THREE.CylinderGeometry(isMale ? 0.157 : 0.128, isMale ? 0.159 : 0.132, 0.025, 24),
    );
    const goldBeltBand = new THREE.Mesh(goldBeltBandGeo, trimGoldMat);
    goldBeltBand.scale.set(1.13, 1, 0.81);
    goldBeltBand.position.y = 0.04;
    torsoGroup.add(goldBeltBand);

    const buckleGeo = this.trackGeo(new THREE.OctahedronGeometry(0.042, 0));
    const buckle = new THREE.Mesh(buckleGeo, trimGoldMat);
    buckle.scale.set(1.2, 0.9, 0.45);
    buckle.position.set(0, 0.04, isMale ? 0.132 : 0.108);
    torsoGroup.add(buckle);

    // Hanging crimson & gold waist tassels
    const tasselGroups: THREE.Group[] = [];
    for (const [tx, tz] of [
      [0.055, isMale ? 0.135 : 0.115],
      [-0.08, isMale ? 0.125 : 0.105],
    ]) {
      const tGroup = new THREE.Group();
      tGroup.position.set(tx, 0.01, tz);
      const ribbonGeo = this.trackGeo(new THREE.BoxGeometry(0.028, 0.42, 0.008));
      const ribbon = new THREE.Mesh(ribbonGeo, secondaryFabricMat);
      ribbon.position.y = -0.21;
      tGroup.add(ribbon);
      const beadGeo = this.trackGeo(new THREE.SphereGeometry(0.014, 10, 10));
      const bead = new THREE.Mesh(beadGeo, trimGoldMat);
      bead.position.y = -0.42;
      tGroup.add(bead);
      torsoGroup.add(tGroup);
      tasselGroups.push(tGroup);
    }
    this.anim.tasselGroups = tasselGroups;

    // Inner collar base + Crossed V-Collar Lapels (flush, zero gap)
    const innerCollarGeo = this.trackGeo(
      new THREE.CylinderGeometry(isMale ? 0.072 : 0.062, isMale ? 0.088 : 0.078, 0.055, 16),
    );
    const innerCollar = new THREE.Mesh(innerCollarGeo, innerLiningMat);
    innerCollar.position.set(0, torsoHeight - 0.005, 0.012);
    torsoGroup.add(innerCollar);

    for (const side of [-1, 1]) {
      const lapelGeo = this.trackGeo(new THREE.BoxGeometry(0.062, 0.21, 0.022));
      const lapel = new THREE.Mesh(lapelGeo, secondaryFabricMat);
      lapel.position.set(side * (isMale ? 0.048 : 0.042), torsoHeight * 0.79, isMale ? 0.132 : 0.112);
      lapel.rotation.z = side * -0.4;
      lapel.rotation.x = -0.22;
      torsoGroup.add(lapel);

      const goldEdgeGeo = this.trackGeo(new THREE.BoxGeometry(0.012, 0.21, 0.025));
      const goldEdge = new THREE.Mesh(goldEdgeGeo, trimGoldMat);
      goldEdge.position.x = side * -0.024;
      lapel.add(goldEdge);
    }

    // Chest Armor Overlay for Shogun Plate style
    if (costume.armorStyle === 'plate') {
      const plateGeo = this.trackGeo(
        new THREE.CylinderGeometry(isMale ? 0.188 : 0.158, isMale ? 0.155 : 0.13, 0.22, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
      );
      const plate = new THREE.Mesh(plateGeo, trimGoldMat);
      plate.scale.set(1.12, 1, 0.78);
      plate.position.y = torsoHeight * 0.68;
      torsoGroup.add(plate);
    }

    // 4. LAYERED SHOULDER PAULDRONS & ARMS
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * shoulderSpan, torsoHeight - 0.05, 0);

      // Symmetrically mirrored 3-Tiered Sleek Angled Shoulder Pauldrons
      const pauldronSideGroup = new THREE.Group();
      pauldronSideGroup.rotation.y = side * (Math.PI / 2);
      armGroup.add(pauldronSideGroup);

      const tierCount = costume.armorStyle === 'shinobi' ? 2 : 3;
      for (let t = 0; t < tierCount; t++) {
        const plateW = 0.075 + t * 0.014;
        const plateGeo = this.trackGeo(
          new THREE.CylinderGeometry(
            plateW,
            plateW + 0.015,
            0.036,
            14,
            1,
            false,
            -Math.PI * 0.36,
            Math.PI * 0.72,
          ),
        );
        const tier = new THREE.Mesh(plateGeo, darkArmorMat);
        tier.position.set(0, 0.028 - t * 0.034, 0.012 + t * 0.014);
        tier.rotation.x = 0.34 + t * 0.14;
        tier.scale.set(1.12, 1, 1.05);
        tier.castShadow = true;
        pauldronSideGroup.add(tier);

        const trimGeo = this.trackGeo(
          new THREE.TorusGeometry(plateW + 0.012, 0.005, 6, 16, Math.PI * 0.72),
        );
        const tierTrim = new THREE.Mesh(trimGeo, trimGoldMat);
        tierTrim.rotation.set(Math.PI / 2, 0, Math.PI * 0.14);
        tierTrim.position.y = -0.017;
        tier.add(tierTrim);
      }

      // Shoulder tassel accent (male signature from reference)
      if (isMale) {
        const shTasselGeo = this.trackGeo(new THREE.CylinderGeometry(0.008, 0.015, 0.13, 10));
        const shTassel = new THREE.Mesh(shTasselGeo, secondaryFabricMat);
        shTassel.position.set(side * 0.045, -0.06, 0.058);
        armGroup.add(shTassel);
      }

      // Upper arm + Forearm with gold bracer
      const upperArmGeo = this.trackGeo(
        new THREE.CylinderGeometry(isMale ? 0.052 : 0.042, isMale ? 0.048 : 0.038, 0.27, 14),
      );
      const upperArm = new THREE.Mesh(upperArmGeo, outfitMat);
      upperArm.position.y = -0.14;
      upperArm.castShadow = true;
      armGroup.add(upperArm);

      const forearmGroup = new THREE.Group();
      forearmGroup.position.y = -0.27;

      const bracerGeo = this.trackGeo(
        new THREE.CylinderGeometry(isMale ? 0.048 : 0.039, isMale ? 0.036 : 0.031, 0.24, 14),
      );
      const bracer = new THREE.Mesh(bracerGeo, darkArmorMat);
      bracer.position.y = -0.12;
      bracer.castShadow = true;
      forearmGroup.add(bracer);

      const bracerTrimGeo = this.trackGeo(new THREE.TorusGeometry(isMale ? 0.044 : 0.036, 0.006, 8, 18));
      const bracerTrim = new THREE.Mesh(bracerTrimGeo, trimGoldMat);
      bracerTrim.rotation.x = Math.PI / 2;
      bracerTrim.position.y = -0.03;
      forearmGroup.add(bracerTrim);

      // Articulated Hand
      const handGroup = new THREE.Group();
      handGroup.position.y = -0.26;
      const palmGeo = this.trackGeo(new THREE.BoxGeometry(0.042, 0.065, 0.026));
      const palm = new THREE.Mesh(palmGeo, skinMat);
      handGroup.add(palm);

      // Weapon attachments: Right hand (-1 or +1: in character space +X is character's left, -X is character's right!)
      if (side === -1) {
        // Character's RIGHT hand -> Equipped Sword angled cleanly outward-down
        const swordMesh = this.buildSwordMesh(custom.sword);
        swordMesh.position.set(0, -0.015, 0.02);
        swordMesh.rotation.set(Math.PI * 0.45, 0, -0.2);
        handGroup.add(swordMesh);
        armGroup.rotation.z = -0.22;
        armGroup.rotation.x = -0.14;
        forearmGroup.rotation.x = -0.22;
        this.anim.rightArmGroup = armGroup;
      } else {
        // Character's LEFT hand -> Equipped Bow angled cleanly along left side
        const bowMesh = this.buildBowMesh(custom.archery);
        bowMesh.position.set(0.025, -0.01, 0.02);
        bowMesh.rotation.set(0.14, -Math.PI * 0.08, -0.18);
        handGroup.add(bowMesh);
        armGroup.rotation.z = 0.24;
        armGroup.rotation.x = -0.1;
        forearmGroup.rotation.x = -0.22;
        this.anim.leftArmGroup = armGroup;
      }

      forearmGroup.add(handGroup);
      armGroup.add(forearmGroup);
      torsoGroup.add(armGroup);
    }

    // Back-mounted Quiver with Feathered Arrows (for Archery visibility!)
    const quiverGroup = this.buildQuiverMesh(custom.archery);
    quiverGroup.position.set(-0.08, torsoHeight * 0.65, -0.14);
    quiverGroup.rotation.z = 0.42;
    torsoGroup.add(quiverGroup);

    // 5. NECK, SCULPTED HEAD, ANIME FACE & HAIRSTYLE + CROWN
    const neckGeo = this.trackGeo(
      new THREE.CylinderGeometry(isMale ? 0.052 : 0.043, isMale ? 0.058 : 0.048, 0.11, 16),
    );
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = torsoHeight + 0.03;
    torsoGroup.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.y = torsoHeight + 0.145;
    this.anim.headGroup = headGroup;

    // Sculpted Head in uniform skinMat + curved front facePatch overlay for crisp eyes & features
    const headGeo = this.trackGeo(new THREE.SphereGeometry(0.106, 32, 24));
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.scale.set(0.92, 1.07, 0.96);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const facePatchGeo = this.trackGeo(
      new THREE.SphereGeometry(
        0.1072,
        28,
        20,
        Math.PI * 0.28,
        Math.PI * 0.44,
        Math.PI * 0.24,
        Math.PI * 0.52,
      ),
    );
    const facePatch = new THREE.Mesh(facePatchGeo, faceMat);
    facePatch.scale.set(0.92, 1.07, 0.96);
    facePatch.renderOrder = 2;
    headGroup.add(facePatch);

    // Subtle 3D chin & nose bridge behind face surface for profile depth
    const chinGeo = this.trackGeo(new THREE.SphereGeometry(0.048, 16, 12));
    const chin = new THREE.Mesh(chinGeo, skinMat);
    chin.scale.set(0.92, 0.85, 0.88);
    chin.position.set(0, -0.072, 0.024);
    headGroup.add(chin);

    const noseGeo = this.trackGeo(new THREE.ConeGeometry(0.0085, 0.022, 8));
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI * 0.42;
    nose.position.set(0, -0.016, 0.1);
    headGroup.add(nose);

    // Ears
    for (const side of [-1, 1]) {
      const earGeo = this.trackGeo(new THREE.SphereGeometry(0.022, 10, 10));
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.scale.set(0.45, 1.15, 0.72);
      ear.position.set(side * 0.095, -0.008, -0.008);
      headGroup.add(ear);
    }

    // 3D Hairstyle + Signature Crown
    const hairSwayGroup = this.buildHairAndCrown(
      gender,
      custom.hairStyle,
      hairMat,
      darkArmorMat,
      trimGoldMat,
      secondaryFabricMat,
    );
    headGroup.add(hairSwayGroup);

    torsoGroup.add(headGroup);
    this.characterContainer.add(torsoGroup);

    // 6. SUPERPOWER MAGICAL ENERGY VFX & SANCTUARY GROUND SIGIL
    this.buildSuperpowerVfx(custom.superpower, superpowerOpt.primaryHex, superpowerOpt.secondaryHex);
  }

  private buildHairAndCrown(
    gender: Gender,
    style: HairStyleId,
    hairMat: THREE.Material,
    crownMat: THREE.Material,
    goldMat: THREE.Material,
    ribbonMat: THREE.Material,
  ): THREE.Group {
    const hairRoot = new THREE.Group();
    const swayGroup = new THREE.Group();
    swayGroup.position.set(0, 0.02, -0.06);
    this.anim.hairSwayGroup = swayGroup;
    hairRoot.add(swayGroup);

    // Hair cap covering cranium above the brow hairline
    const capGeo = this.trackGeo(
      new THREE.SphereGeometry(0.112, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.43),
    );
    const cap = new THREE.Mesh(capGeo, hairMat);
    cap.scale.set(0.95, 1.06, 1.02);
    cap.rotation.x = -0.24;
    hairRoot.add(cap);

    // Framing side bangs (TubeGeometry curves along temples)
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.04, 0.09, 0.06),
        new THREE.Vector3(side * 0.088, 0.02, 0.075),
        new THREE.Vector3(side * 0.092, -0.08, 0.055),
        new THREE.Vector3(side * 0.078, -0.16, 0.03),
      ]);
      const bangGeo = this.trackGeo(new THREE.TubeGeometry(curve, 12, 0.015, 8, false));
      const bang = new THREE.Mesh(bangGeo, hairMat);
      hairRoot.add(bang);
    }

    // Center-parted forehead wisps framing above the brows cleanly
    for (const side of [-1, 1]) {
      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.098, 0.074),
        new THREE.Vector3(side * 0.044, 0.072, 0.092),
        new THREE.Vector3(side * 0.078, 0.025, 0.082),
      ]);
      const fGeo = this.trackGeo(new THREE.TubeGeometry(fCurve, 10, 0.011, 7, false));
      hairRoot.add(new THREE.Mesh(fGeo, hairMat));
    }

    if (style === 'imperial_crown') {
      // Tall Guan crown headpiece matching Male & Female uploaded artworks
      const crownBaseGeo = this.trackGeo(new THREE.CylinderGeometry(0.042, 0.052, 0.075, 18));
      const crownBase = new THREE.Mesh(crownBaseGeo, crownMat);
      crownBase.position.set(0, 0.125, -0.005);
      hairRoot.add(crownBase);

      const crownTopGeo = this.trackGeo(
        new THREE.CylinderGeometry(0.028, 0.042, 0.085, 18),
      );
      const crownTop = new THREE.Mesh(crownTopGeo, crownMat);
      crownTop.position.set(0, 0.185, -0.012);
      hairRoot.add(crownTop);

      const crestGeo = this.trackGeo(new THREE.OctahedronGeometry(0.024, 0));
      const crest = new THREE.Mesh(crestGeo, goldMat);
      crest.scale.set(0.85, 1.35, 0.4);
      crest.position.set(0, 0.15, 0.042);
      hairRoot.add(crest);

      const bandGeo = this.trackGeo(new THREE.TorusGeometry(0.048, 0.006, 8, 20));
      const band = new THREE.Mesh(bandGeo, gender === 'female' ? ribbonMat : goldMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.105, -0.005);
      hairRoot.add(band);

      // Long flowing back cascade
      this.addFlowingBackCascade(swayGroup, hairMat, 0.56, 0.14);
    } else if (style === 'high_ponytail') {
      const tieGeo = this.trackGeo(new THREE.TorusGeometry(0.032, 0.01, 8, 18));
      const tie = new THREE.Mesh(tieGeo, ribbonMat);
      tie.position.set(0, 0.095, -0.075);
      tie.rotation.x = -0.6;
      hairRoot.add(tie);

      const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.08, -0.02),
        new THREE.Vector3(0, 0.04, -0.14),
        new THREE.Vector3(0, -0.18, -0.17),
        new THREE.Vector3(0, -0.46, -0.12),
      ]);
      const tailGeo = this.trackGeo(new THREE.TubeGeometry(tailCurve, 18, 0.048, 10, false));
      const tail = new THREE.Mesh(tailGeo, hairMat);
      tail.scale.set(1.25, 1, 0.8);
      swayGroup.add(tail);
    } else if (style === 'shadow_ronin') {
      // Headband + layered spiky locks
      const bandGeo = this.trackGeo(new THREE.TorusGeometry(0.108, 0.009, 8, 26));
      const band = new THREE.Mesh(bandGeo, ribbonMat);
      band.rotation.x = Math.PI / 2 - 0.15;
      band.position.set(0, 0.048, 0.004);
      hairRoot.add(band);

      for (let i = 0; i < 9; i++) {
        const angle = -Math.PI * 0.4 + (i / 8) * Math.PI * 0.8;
        const spikeGeo = this.trackGeo(new THREE.ConeGeometry(0.026, 0.13, 7));
        const spike = new THREE.Mesh(spikeGeo, hairMat);
        spike.position.set(Math.sin(angle) * 0.095, 0.075, -Math.cos(angle) * 0.095);
        spike.rotation.z = -Math.sin(angle) * 0.7;
        spike.rotation.x = -0.4;
        hairRoot.add(spike);
      }
      this.addFlowingBackCascade(swayGroup, hairMat, 0.34, 0.12);
    } else if (style === 'twin_spirit') {
      for (const side of [-1, 1]) {
        const ringGeo = this.trackGeo(new THREE.TorusGeometry(0.024, 0.007, 8, 16));
        const ring = new THREE.Mesh(ringGeo, goldMat);
        ring.position.set(side * 0.095, 0.06, -0.055);
        ring.rotation.y = side * 0.7;
        hairRoot.add(ring);

        const tCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.095, 0.04, 0),
          new THREE.Vector3(side * 0.145, -0.14, -0.03),
          new THREE.Vector3(side * 0.15, -0.42, -0.02),
        ]);
        const tGeo = this.trackGeo(new THREE.TubeGeometry(tCurve, 16, 0.032, 9, false));
        swayGroup.add(new THREE.Mesh(tGeo, hairMat));
      }
    } else if (style === 'silver_bob') {
      for (const side of [-1, 1]) {
        const bobGeo = this.trackGeo(new THREE.CylinderGeometry(0.048, 0.03, 0.22, 10));
        const bob = new THREE.Mesh(bobGeo, hairMat);
        bob.position.set(side * 0.088, -0.045, -0.015);
        bob.rotation.z = side * 0.12;
        hairRoot.add(bob);
      }
      this.addFlowingBackCascade(swayGroup, hairMat, 0.2, 0.1);
    } else {
      // sovereign_halfup
      const bunGeo = this.trackGeo(new THREE.SphereGeometry(0.052, 16, 14));
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(0, 0.128, -0.02);
      hairRoot.add(bun);

      const pinGeo = this.trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 8));
      const pin = new THREE.Mesh(pinGeo, goldMat);
      pin.rotation.z = Math.PI / 2 - 0.22;
      pin.position.set(0, 0.132, -0.02);
      hairRoot.add(pin);

      this.addFlowingBackCascade(swayGroup, hairMat, 0.52, 0.14);
    }

    return hairRoot;
  }

  private addFlowingBackCascade(
    swayGroup: THREE.Group,
    hairMat: THREE.Material,
    length: number,
    width: number,
  ): void {
    for (let i = -2; i <= 2; i++) {
      const offsetX = i * (width * 0.34);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(offsetX * 0.7, 0.05, -0.02),
        new THREE.Vector3(offsetX, -length * 0.35, -0.085),
        new THREE.Vector3(offsetX * 1.15, -length * 0.75, -0.095),
        new THREE.Vector3(offsetX * 1.2, -length, -0.07),
      ]);
      const r = i === 0 ? 0.036 : 0.026;
      const strandGeo = this.trackGeo(new THREE.TubeGeometry(curve, 14, r, 8, false));
      const strand = new THREE.Mesh(strandGeo, hairMat);
      strand.castShadow = true;
      swayGroup.add(strand);
    }
  }

  private buildSwordMesh(swordId: SwordId): THREE.Group {
    const spec = SWORD_OPTIONS.find((s) => s.id === swordId) ?? SWORD_OPTIONS[0];
    const group = new THREE.Group();

    const bladeMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.primaryHex,
        roughness: 0.18,
        metalness: 0.92,
      }),
    );
    const guardMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.accentHex,
        roughness: 0.25,
        metalness: 0.86,
      }),
    );
    const edgeGlowMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.glowHex,
        emissive: spec.glowHex,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.4,
      }),
    );

    const bladeLen =
      swordId === 'azure_odachi' || swordId === 'bloodmoon_nodachi' ? 0.98 : 0.78;
    const bladeW = swordId === 'jade_sabre' ? 0.044 : 0.026;

    // Tsuka handle
    const hiltGeo = this.trackGeo(new THREE.CylinderGeometry(0.014, 0.015, 0.22, 12));
    const hilt = new THREE.Mesh(hiltGeo, guardMat);
    hilt.position.y = -0.08;
    group.add(hilt);

    // Tsuba guard
    const guardGeo =
      swordId === 'dragonfire_jian'
        ? this.trackGeo(new THREE.BoxGeometry(0.11, 0.022, 0.034))
        : this.trackGeo(new THREE.CylinderGeometry(0.046, 0.046, 0.014, 16));
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0.035;
    group.add(guard);

    // Sculpted Blade
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-bladeW * 0.5, 0);
    bladeShape.lineTo(bladeW * 0.5, 0);
    if (swordId === 'moonfang_katana' || swordId === 'azure_odachi' || swordId === 'jade_sabre') {
      bladeShape.quadraticCurveTo(bladeW * 0.8, bladeLen * 0.55, bladeW * 0.1, bladeLen);
      bladeShape.quadraticCurveTo(-bladeW * 0.25, bladeLen * 0.55, -bladeW * 0.5, 0);
    } else {
      bladeShape.lineTo(bladeW * 0.35, bladeLen * 0.85);
      bladeShape.lineTo(0, bladeLen);
      bladeShape.lineTo(-bladeW * 0.35, bladeLen * 0.85);
    }
    bladeShape.closePath();

    const bladeGeo = this.trackGeo(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.008,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.003,
        bevelThickness: 0.003,
      }),
    );
    bladeGeo.center();
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.04 + bladeLen * 0.5;
    blade.castShadow = true;
    group.add(blade);

    // Subtle luminous rune / edge core
    const runeGeo = this.trackGeo(new THREE.BoxGeometry(0.005, bladeLen * 0.72, 0.016));
    const rune = new THREE.Mesh(runeGeo, edgeGlowMat);
    rune.position.y = 0.04 + bladeLen * 0.42;
    group.add(rune);

    if (swordId === 'dragonfire_jian') {
      const tasselGeo = this.trackGeo(new THREE.CylinderGeometry(0.006, 0.016, 0.14, 10));
      const tassel = new THREE.Mesh(tasselGeo, edgeGlowMat);
      tassel.position.y = -0.25;
      group.add(tassel);
    }

    return group;
  }

  private buildBowMesh(archeryId: ArcheryId): THREE.Group {
    const spec = ARCHERY_OPTIONS.find((a) => a.id === archeryId) ?? ARCHERY_OPTIONS[0];
    const group = new THREE.Group();

    const limbMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.primaryHex,
        roughness: 0.38,
        metalness: 0.35,
      }),
    );
    const tipMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.accentHex,
        roughness: 0.25,
        metalness: 0.85,
      }),
    );
    const stringMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.glowHex,
        emissive: spec.glowHex,
        emissiveIntensity: 0.65,
        roughness: 0.3,
      }),
    );

    const bowH = archeryId === 'jade_yumi' ? 1.15 : 0.96;
    const curve =
      archeryId === 'shadowbone_compound'
        ? new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, bowH * 0.5, -0.15),
            new THREE.Vector3(0, bowH * 0.26, 0.08),
            new THREE.Vector3(0, 0, 0.14),
            new THREE.Vector3(0, -bowH * 0.26, 0.08),
            new THREE.Vector3(0, -bowH * 0.5, -0.15),
          ])
        : new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, bowH * 0.5, -0.14),
            new THREE.Vector3(0, bowH * 0.32, -0.03),
            new THREE.Vector3(0, 0, 0.11),
            new THREE.Vector3(0, -bowH * 0.32, -0.03),
            new THREE.Vector3(0, -bowH * 0.5, -0.14),
          ]);

    const limbGeo = this.trackGeo(new THREE.TubeGeometry(curve, 24, 0.015, 8, false));
    const limb = new THREE.Mesh(limbGeo, limbMat);
    limb.castShadow = true;
    group.add(limb);

    // Ornate riser grip
    const riserGeo = this.trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 12));
    const riser = new THREE.Mesh(riserGeo, tipMat);
    riser.position.set(0, 0, 0.11);
    group.add(riser);

    // Tip caps
    for (const dir of [-1, 1]) {
      const capGeo = this.trackGeo(new THREE.ConeGeometry(0.02, 0.06, 8));
      const cap = new THREE.Mesh(capGeo, tipMat);
      cap.position.set(0, dir * bowH * 0.5, -0.145);
      cap.rotation.x = dir > 0 ? -0.6 : Math.PI + 0.6;
      group.add(cap);
    }

    // Bowstring
    const strGeo = this.trackGeo(new THREE.CylinderGeometry(0.0028, 0.0028, bowH * 0.98, 6));
    const str = new THREE.Mesh(strGeo, stringMat);
    str.position.set(0, 0, -0.14);
    group.add(str);

    // Notched arrow ready on riser
    const arrowShaftGeo = this.trackGeo(new THREE.CylinderGeometry(0.004, 0.004, 0.62, 6));
    const arrowShaft = new THREE.Mesh(arrowShaftGeo, tipMat);
    arrowShaft.rotation.x = Math.PI / 2;
    arrowShaft.position.set(0.02, 0.02, 0.14);
    group.add(arrowShaft);

    const arrowHeadGeo = this.trackGeo(new THREE.ConeGeometry(0.014, 0.055, 4));
    const arrowHead = new THREE.Mesh(arrowHeadGeo, stringMat);
    arrowHead.rotation.x = Math.PI / 2;
    arrowHead.position.set(0.02, 0.02, 0.46);
    group.add(arrowHead);

    return group;
  }

  private buildQuiverMesh(archeryId: ArcheryId): THREE.Group {
    const spec = ARCHERY_OPTIONS.find((a) => a.id === archeryId) ?? ARCHERY_OPTIONS[0];
    const group = new THREE.Group();

    const bodyMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.primaryHex,
        roughness: 0.65,
        metalness: 0.18,
      }),
    );
    const trimMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.accentHex,
        roughness: 0.25,
        metalness: 0.85,
      }),
    );
    const fletchMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.glowHex,
        emissive: spec.glowHex,
        emissiveIntensity: 0.35,
        roughness: 0.5,
      }),
    );

    const tubeGeo = this.trackGeo(new THREE.CylinderGeometry(0.044, 0.032, 0.44, 14));
    const tube = new THREE.Mesh(tubeGeo, bodyMat);
    group.add(tube);

    const ringGeo = this.trackGeo(new THREE.TorusGeometry(0.046, 0.007, 8, 18));
    const ring = new THREE.Mesh(ringGeo, trimMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.21;
    group.add(ring);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const shaftGeo = this.trackGeo(new THREE.CylinderGeometry(0.0035, 0.0035, 0.18, 6));
      const shaft = new THREE.Mesh(shaftGeo, trimMat);
      shaft.position.set(Math.cos(a) * 0.018, 0.27, Math.sin(a) * 0.018);
      group.add(shaft);

      const fletchGeo = this.trackGeo(new THREE.ConeGeometry(0.012, 0.045, 4));
      const fletch = new THREE.Mesh(fletchGeo, fletchMat);
      fletch.position.set(Math.cos(a) * 0.018, 0.35, Math.sin(a) * 0.018);
      group.add(fletch);
    }

    return group;
  }

  private buildSuperpowerVfx(
    powerId: SuperpowerId,
    primaryHex: string,
    secondaryHex: string,
  ): void {
    const ringTex = this.trackTex(createSanctuaryRingTexture(primaryHex, this.maxAnisotropy));

    const sigilMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const sigilGeo = this.trackGeo(new THREE.PlaneGeometry(1.55, 1.55));
    const sigil = new THREE.Mesh(sigilGeo, sigilMat);
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.y = 0.018;
    this.characterContainer.add(sigil);
    this.anim.groundSigil = sigil;

    const beamMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: primaryHex,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const secBeamMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: secondaryHex,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );

    const auraRings: THREE.Mesh[] = [];

    // Sleek lower aura ring at ankle/calf level so torso & face stay 100% clear
    const lowRingGeo = this.trackGeo(new THREE.TorusGeometry(0.62, 0.007, 8, 48));
    const lowRing = new THREE.Mesh(lowRingGeo, beamMat);
    lowRing.position.y = 0.24;
    lowRing.rotation.x = Math.PI * 0.48;
    this.characterContainer.add(lowRing);
    auraRings.push(lowRing);

    // Back spirit halo behind shoulders
    const haloR = powerId === 'golden_solar' ? 0.48 : 0.42;
    const haloGeo = this.trackGeo(new THREE.TorusGeometry(haloR, 0.009, 10, 40));
    const halo = new THREE.Mesh(haloGeo, secBeamMat);
    halo.position.set(0, 1.38, -0.26);
    this.characterContainer.add(halo);
    auraRings.push(halo);

    // Outer flanking ascending spirit ribbons (left/right side of character, never blocking face)
    for (const side of [-1, 1]) {
      const ribbonCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.56, 0.08, -0.05),
        new THREE.Vector3(side * 0.64, 0.58, 0.12),
        new THREE.Vector3(side * 0.58, 1.12, -0.14),
        new THREE.Vector3(side * 0.44, 1.62, -0.22),
      ]);
      const ribbonGeo = this.trackGeo(new THREE.TubeGeometry(ribbonCurve, 24, 0.007, 6, false));
      const ribbon = new THREE.Mesh(ribbonGeo, side === 1 ? beamMat : secBeamMat);
      this.characterContainer.add(ribbon);
      auraRings.push(ribbon);
    }
    this.anim.auraRings = auraRings;

    // Instanced orbiting spirit motes (18 lightweight octahedra)
    const count = 18;
    const moteGeo = this.trackGeo(new THREE.OctahedronGeometry(0.026, 0));
    const moteMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: primaryHex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, count);
    motes.frustumCulled = false;

    const moteBaseData = [];
    for (let i = 0; i < count; i++) {
      moteBaseData.push({
        angle: (i / count) * Math.PI * 2,
        radius: 0.48 + (i % 3) * 0.14,
        height: 0.15 + ((i * 0.19) % 1.55),
        speed: 0.65 + (i % 4) * 0.22,
        scale: 0.65 + (i % 3) * 0.35,
      });
    }
    this.characterContainer.add(motes);
    this.anim.auraMotes = motes;
    this.anim.moteBaseData = moteBaseData;

    const auraLight = new THREE.PointLight(primaryHex, 1.4, 3.6, 2);
    auraLight.position.set(0, 0.95, 0.35);
    this.characterContainer.add(auraLight);
    this.anim.auraLight = auraLight;
  }

  public update(elapsed: number, dt: number): void {
    const breath = Math.sin(elapsed * 2.1);
    const sway = Math.sin(elapsed * 1.35);

    // Subtle idle breathing & poise
    this.anim.torsoGroup.position.y = this.baseTorsoY + breath * 0.008;
    this.anim.headGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.05;
    this.anim.headGroup.rotation.x = breath * 0.022;

    // Hair & coat & waist tassels gently sway
    this.anim.hairSwayGroup.rotation.x = 0.04 + sway * 0.045;
    this.anim.hairSwayGroup.rotation.z = Math.cos(elapsed * 1.1) * 0.025;
    this.anim.coatSwayGroup.rotation.x = sway * 0.018;

    for (let i = 0; i < this.anim.tasselGroups.length; i++) {
      this.anim.tasselGroups[i].rotation.z = Math.sin(elapsed * 1.8 + i) * 0.06;
    }

    // Attack / Weapon flourish decay
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const p = Math.sin((this.attackTimer / 0.65) * Math.PI);
      this.anim.rightArmGroup.rotation.x = -0.14 - p * 0.85;
      this.anim.rightArmGroup.rotation.z = -0.24 - p * 0.28;
      this.anim.leftArmGroup.rotation.x = -0.08 - p * 0.35;
    } else {
      this.anim.rightArmGroup.rotation.x = -0.14 + breath * 0.03;
      this.anim.rightArmGroup.rotation.z = -0.24 + sway * 0.02;
      this.anim.leftArmGroup.rotation.x = -0.08 - breath * 0.03;
    }

    // Superpower animation
    if (this.anim.groundSigil) {
      this.anim.groundSigil.rotation.z = elapsed * 0.35;
    }
    this.anim.auraRings.forEach((ring, idx) => {
      ring.rotation.z = elapsed * (idx % 2 === 0 ? 0.9 : -0.75);
      ring.rotation.y += dt * (idx === 2 ? 0.9 : 0.3);
    });
    if (this.anim.auraMotes) {
      const dummy = this.dummyMatrix;
      this.anim.moteBaseData.forEach((m, i) => {
        const a = m.angle + elapsed * m.speed;
        const y = ((m.height + elapsed * 0.28) % 1.68) + 0.12;
        dummy.position.set(Math.cos(a) * m.radius, y, Math.sin(a) * m.radius);
        dummy.rotation.set(elapsed + i, elapsed * 1.3, 0);
        const pulse = m.scale * (0.85 + 0.25 * Math.sin(elapsed * 3 + i));
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        this.anim.auraMotes!.setMatrixAt(i, dummy.matrix);
      });
      this.anim.auraMotes.instanceMatrix.needsUpdate = true;
    }
  }

  private clearCurrentCharacter(): void {
    while (this.characterContainer.children.length > 0) {
      this.characterContainer.remove(this.characterContainer.children[0]);
    }
    for (const g of this.disposableGeometries) g.dispose();
    for (const m of this.disposableMaterials) m.dispose();
    for (const t of this.disposableTextures) t.dispose();
    this.disposableGeometries = [];
    this.disposableMaterials = [];
    this.disposableTextures = [];
    this.anim.auraRings = [];
    this.anim.tasselGroups = [];
    this.anim.auraMotes = null;
    this.anim.groundSigil = null;
    this.anim.auraLight = null;
  }

  public dispose(): void {
    this.clearCurrentCharacter();
    this.sharedLeatherBump.dispose();
  }
}
