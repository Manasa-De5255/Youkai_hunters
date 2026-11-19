import * as THREE from 'three';
import { UPLOADED_ASSETS } from '../data/customizationCatalog';

export interface KodamaVisualRig {
  group: THREE.Group;
  bodyMat: THREE.MeshBasicMaterial;
  auraMat: THREE.MeshBasicMaterial;
  eyeLeftMat: THREE.MeshBasicMaterial;
  eyeRightMat: THREE.MeshBasicMaterial;
  hitboxMesh: THREE.Mesh;
}

export function loadGrassWallTexture(anisotropy: number): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const texture = loader.load(UPLOADED_ASSETS.grassWallBg);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, anisotropy);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Loads the uploaded Kodama artwork and strips ONLY the exterior black background
 * via perimeter flood-fill so dark hair and interior shadows remain completely opaque.
 */
export function loadKodamaGhostTexture(anisotropy: number): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fallback ghost silhouette painted immediately while image decodes
  ctx.clearRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, anisotropy);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const total = size * size;
    const visited = new Uint8Array(total);
    const exterior = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const maxLumAt = (idx: number) => {
      const o = idx * 4;
      return Math.max(data[o], data[o + 1], data[o + 2]);
    };

    const enqueueIfBg = (x: number, y: number) => {
      if (x < 0 || x >= size || y < 0 || y >= size) return;
      const idx = y * size + x;
      if (visited[idx]) return;
      visited[idx] = 1;
      if (maxLumAt(idx) < 28) {
        exterior[idx] = 1;
        queue[tail++] = idx;
      }
    };

    // Seed flood-fill strictly along the 4 image perimeter edges
    for (let x = 0; x < size; x++) {
      enqueueIfBg(x, 0);
      enqueueIfBg(x, size - 1);
    }
    for (let y = 1; y < size - 1; y++) {
      enqueueIfBg(0, y);
      enqueueIfBg(size - 1, y);
    }

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % size;
      const y = (idx - x) / size;
      enqueueIfBg(x + 1, y);
      enqueueIfBg(x - 1, y);
      enqueueIfBg(x, y + 1);
      enqueueIfBg(x, y - 1);
    }

    // Apply transparency to exterior black background and feather wispy crimson mist boundary
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      if (exterior[i]) {
        data[o + 3] = 0;
        continue;
      }
      // Check if adjacent to exterior void for soft feathered mist transition
      const x = i % size;
      const y = (i - x) / size;
      const touchesVoid =
        (x > 0 && exterior[i - 1]) ||
        (x < size - 1 && exterior[i + 1]) ||
        (y > 0 && exterior[i - size]) ||
        (y < size - 1 && exterior[i + size]);

      if (touchesVoid) {
        const lum = Math.max(data[o], data[o + 1], data[o + 2]);
        if (lum < 68) {
          data[o + 3] = Math.max(0, Math.min(255, Math.round(((lum - 14) / 54) * 215)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    texture.needsUpdate = true;
  };
  img.src = UPLOADED_ASSETS.kodamaGhost;

  return texture;
}

export function createMistTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.04,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(185, 220, 195, 0.36)');
  grad.addColorStop(0.45, 'rgba(95, 135, 108, 0.16)');
  grad.addColorStop(1, 'rgba(10, 20, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCrimsonAuraTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.02,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
  grad.addColorStop(0.45, 'rgba(153, 27, 27, 0.24)');
  grad.addColorStop(1, 'rgba(20, 5, 5, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createForestGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const base = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  base.addColorStop(0, '#070f09');
  base.addColorStop(0.55, '#040905');
  base.addColorStop(1, '#020403');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Organic dark moss patches and forest earth grain
  for (let i = 0; i < 1600; i++) {
    const x = ((i * 73) % 509) + (i % 7);
    const y = ((i * 137) % 509) + (i % 5);
    const r = 1 + (i % 4);
    ctx.fillStyle =
      i % 5 === 0
        ? 'rgba(28, 52, 34, 0.24)'
        : i % 3 === 0
          ? 'rgba(12, 22, 15, 0.35)'
          : 'rgba(42, 18, 22, 0.14)';
    ctx.beginPath();
    ctx.arc(x % size, y % size, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export function createKodamaGhostRig(
  id: string,
  ghostTexture: THREE.Texture,
  auraTexture: THREE.Texture,
  sharedBodyGeo: THREE.PlaneGeometry,
  sharedAuraGeo: THREE.PlaneGeometry,
  sharedEyeGeo: THREE.CircleGeometry,
  sharedHitboxGeo: THREE.BoxGeometry,
  sharedHitboxMat: THREE.MeshBasicMaterial,
): KodamaVisualRig {
  const group = new THREE.Group();

  const auraMat = new THREE.MeshBasicMaterial({
    map: auraTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const auraMesh = new THREE.Mesh(sharedAuraGeo, auraMat);
  auraMesh.position.set(0, 0.08, -0.04);
  group.add(auraMesh);

  const bodyMat = new THREE.MeshBasicMaterial({
    map: ghostTexture,
    transparent: true,
    opacity: 0,
    alphaTest: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bodyMesh = new THREE.Mesh(sharedBodyGeo, bodyMat);
  group.add(bodyMesh);

  // Subtle glowing crimson eye accents aligned to the Kodama spirit's face
  const eyeLeftMat = new THREE.MeshBasicMaterial({
    color: 0xff2438,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const eyeRightMat = eyeLeftMat.clone();

  const leftEye = new THREE.Mesh(sharedEyeGeo, eyeLeftMat);
  leftEye.position.set(-0.042, 0.81, 0.02);
  const rightEye = new THREE.Mesh(sharedEyeGeo, eyeRightMat);
  rightEye.position.set(0.042, 0.81, 0.02);
  group.add(leftEye);
  group.add(rightEye);

  const hitboxMesh = new THREE.Mesh(sharedHitboxGeo, sharedHitboxMat);
  hitboxMesh.position.set(0, 0.05, 0);
  hitboxMesh.userData.ghostId = id;
  group.add(hitboxMesh);

  return {
    group,
    bodyMat,
    auraMat,
    eyeLeftMat,
    eyeRightMat,
    hitboxMesh,
  };
}
