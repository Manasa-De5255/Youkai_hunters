import * as THREE from 'three';
import {
  CostumeOption,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
} from '../data/customizationCatalog';
import {
  Gender,
  HairColorId,
  SkinToneId,
} from '../types/game';

export interface FaceTextureParams {
  gender: Gender;
  skinTone: SkinToneId;
  hairColor: HairColorId;
}

function adjustHex(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.l = THREE.MathUtils.clamp(hsl.l + amount, 0, 1);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

export function createFaceTexture(
  params: FaceTextureParams,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  // 512x512 transparent facial overlay mapped to the front face patch (+Z)
  // so underlying headMesh skinMat matches neck, ears, chin, and hands seamlessly.
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const skin =
    SKIN_TONE_OPTIONS.find((s) => s.id === params.skinTone) ?? SKIN_TONE_OPTIONS[0];
  const hairCol =
    HAIR_COLOR_OPTIONS.find((h) => h.id === params.hairColor) ?? HAIR_COLOR_OPTIONS[0];

  const isFemale = params.gender === 'female';
  const cxMid = 256;

  // Soft natural cheek warmth
  const blushColor = isFemale ? 'rgba(218, 92, 112, 0.28)' : 'rgba(194, 96, 96, 0.14)';
  for (const dir of [-1, 1]) {
    const bx = cxMid + dir * 124;
    const by = 306;
    const bg = ctx.createRadialGradient(bx, by, 4, bx, by, 46);
    bg.addColorStop(0, blushColor);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(bx, by, 44, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle default outer-corner warrior eye shading matching the uploaded artworks
  for (const dir of [-1, 1]) {
    const ex = cxMid + dir * 118;
    const ey = 250;
    const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, 40);
    g.addColorStop(0, isFemale ? 'rgba(165, 36, 54, 0.34)' : 'rgba(170, 26, 42, 0.44)');
    g.addColorStop(1, 'rgba(170, 26, 42, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 36, 22, dir * -0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fixed default anime eyes (non-customizable, matching male/female guild warriors)
  const eyeOffsetX = isFemale ? 98 : 102;
  const eyeY = 248;
  const irisBaseHex = '#1b1620';
  const irisAccentHex = '#6e4e3d';

  for (const dir of [-1, 1]) {
    const cx = cxMid + dir * eyeOffsetX;
    ctx.save();
    ctx.translate(cx, eyeY);
    if (dir === -1) ctx.scale(-1, 1);

    const eyeW = isFemale ? 60 : 56;
    const eyeH = isFemale ? 33 : 27;
    const tilt = isFemale ? -0.11 : -0.14;
    ctx.rotate(tilt);

    // Subtle eyelid crease
    ctx.strokeStyle = adjustHex(skin.hex, -0.28);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-eyeW * 0.85, -eyeH * 1.05);
    ctx.quadraticCurveTo(0, -eyeH * 1.48, eyeW * 0.94, -eyeH * 0.78);
    ctx.stroke();

    // Crisp sclera
    ctx.fillStyle = '#fafbfd';
    ctx.beginPath();
    ctx.moveTo(-eyeW, 2);
    ctx.quadraticCurveTo(0, -eyeH * 1.15, eyeW, -2);
    ctx.quadraticCurveTo(0, eyeH * 0.95, -eyeW, 2);
    ctx.closePath();
    ctx.fill();

    // Iris + Pupil + Catchlights
    ctx.save();
    ctx.clip();

    // Upper eyelid shadow across sclera
    ctx.fillStyle = 'rgba(20, 24, 42, 0.26)';
    ctx.fillRect(-eyeW, -eyeH * 1.35, eyeW * 2, eyeH * 0.52);

    // Compensate ~1.22x horizontal px/unit density on front sphere patch for balanced round iris
    const irisRy = eyeH * 0.96;
    const irisRx = irisRy * 1.2;

    ctx.save();
    ctx.scale(irisRx / irisRy, 1);
    const irisGrad = ctx.createRadialGradient(0, 2, 2, 0, 0, irisRy);
    irisGrad.addColorStop(0, '#07090e');
    irisGrad.addColorStop(0.42, irisBaseHex);
    irisGrad.addColorStop(0.84, irisAccentHex);
    irisGrad.addColorStop(1, '#090c14');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(0, 1, irisRy, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#05070b';
    ctx.beginPath();
    ctx.arc(0, 1, irisRy * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // Crisp anime catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-irisRy * 0.34, -irisRy * 0.34, irisRy * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(irisRy * 0.36, irisRy * 0.34, irisRy * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // Bold upper lash line
    ctx.strokeStyle = '#0e1017';
    ctx.lineWidth = isFemale ? 7.5 : 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-eyeW, 2);
    ctx.quadraticCurveTo(0, -eyeH * 1.15, eyeW + 7, -4);
    ctx.stroke();

    // Delicate lower lash line
    ctx.strokeStyle = 'rgba(20, 18, 22, 0.58)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-eyeW * 0.68, eyeH * 0.5);
    ctx.quadraticCurveTo(0, eyeH * 0.94, eyeW * 0.88, eyeH * 0.14);
    ctx.stroke();

    // Crisp Eyebrow
    ctx.strokeStyle = adjustHex(hairCol.hex, -0.06);
    ctx.lineWidth = isFemale ? 5.2 : 6.8;
    ctx.beginPath();
    ctx.moveTo(-eyeW * 0.92, -eyeH * 1.78);
    ctx.quadraticCurveTo(0, -eyeH * 2.18, eyeW * 1.05, -eyeH * 1.56);
    ctx.stroke();

    ctx.restore();
  }

  // Subtle nose bridge highlight & nostril/tip shadow
  ctx.fillStyle = adjustHex(skin.hex, 0.08);
  ctx.beginPath();
  ctx.ellipse(cxMid, 276, 5, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = adjustHex(skin.hex, -0.2);
  ctx.beginPath();
  ctx.ellipse(cxMid, 304, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sculpted anime lips
  const lipColor = isFemale ? '#b83c4c' : adjustHex(skin.hex, -0.22);
  ctx.fillStyle = lipColor;
  ctx.beginPath();
  ctx.moveTo(cxMid - 34, 372);
  ctx.quadraticCurveTo(cxMid, 359, cxMid + 34, 372);
  ctx.quadraticCurveTo(cxMid, 390, cxMid - 34, 372);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = adjustHex(lipColor, -0.24);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cxMid - 35, 372);
  ctx.quadraticCurveTo(cxMid, 377, cxMid + 35, 372);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createOutfitBrocadeTexture(
  costume: CostumeOption,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = costume.primaryHex;
  ctx.fillRect(0, 0, size, size);

  // Fine woven silk/leather diamond lattice
  ctx.strokeStyle = adjustHex(costume.primaryHex, 0.045);
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }

  // Intricate gold wave-scale & filigree hem borders (no letter-like shapes!)
  ctx.strokeStyle = costume.trimHex;
  ctx.globalAlpha = 0.68;
  ctx.lineWidth = 2;
  for (let row = 0; row < 3; row++) {
    const baseY = 418 + row * 24;
    const offset = (row % 2) * 20;
    for (let x = -20 + offset; x < size + 20; x += 40) {
      ctx.beginPath();
      ctx.arc(x, baseY, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, baseY, 12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  // Subtle embroidered cloud-knot flourishes on chest/upper coat
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 1.8;
  for (let y = 76; y < 340; y += 96) {
    for (let x = 64; x < size; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x - 24, y);
      ctx.bezierCurveTo(x - 10, y - 22, x + 10, y + 22, x + 24, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 10);
      ctx.bezierCurveTo(x - 6, y - 8, x + 6, y - 8, x + 16, y + 10);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Metallic filigree border & crimson lining trim
  ctx.fillStyle = costume.trimHex;
  ctx.fillRect(0, size - 14, size, 4);
  ctx.fillStyle = costume.secondaryHex;
  ctx.fillRect(0, size - 10, size, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createLeatherBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  let seed = 42;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 4200; i++) {
    const x = nextRand() * size;
    const y = nextRand() * size;
    const r = 0.8 + nextRand() * 1.8;
    const v = Math.floor(105 + nextRand() * 55);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createSanctuaryRingTexture(
  glowHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  const rad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 240);
  rad.addColorStop(0, `${glowHex}33`);
  rad.addColorStop(0.7, `${glowHex}18`);
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.beginPath();
  ctx.arc(cx, cy, 245, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = glowHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 224, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 204, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a1 = (i / 8) * Math.PI * 2;
    const a2 = ((i + 3) / 8) * Math.PI * 2;
    ctx.moveTo(cx + Math.cos(a1) * 204, cy + Math.sin(a1) * 204);
    ctx.lineTo(cx + Math.cos(a2) * 204, cy + Math.sin(a2) * 204);
  }
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 206, cy + Math.sin(a) * 206);
    ctx.lineTo(cx + Math.cos(a) * 222, cy + Math.sin(a) * 222);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}
