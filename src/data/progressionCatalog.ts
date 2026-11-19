import {
  ActivityId,
  ArcheryId,
  CharacterCustomization,
  CostumeId,
  CustomizationCategoryKey,
  GadgetId,
  Gender,
  HairColorId,
  HairStyleId,
  SkinToneId,
  SuperpowerId,
  SwordId,
} from '../types/game';
import { getDefaultCustomization, sanitizeCustomization } from './customizationCatalog';

export interface LevelThreshold {
  level: number;
  minXp: number;
  title: string;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minXp: 0, title: 'Initiate Archer' },
  { level: 2, minXp: 100, title: 'Blade Disciple' },
  { level: 3, minXp: 250, title: 'Spirit Channeler' },
  { level: 4, minXp: 450, title: 'Shadow Master' },
  { level: 5, minXp: 700, title: 'Grand Yokai Slayer' },
];

export interface ActivityDefinition {
  id: ActivityId;
  name: string;
  description: string;
  requiredLevel: number;
  shortcut: string;
  xpPerHit: number;
}

export const ACTIVITY_DEFINITIONS: ActivityDefinition[] = [
  {
    id: 'archery',
    name: 'Archery',
    description: 'Shoot luminous spirit arrows at floating Yokai targets.',
    requiredLevel: 1,
    shortcut: '1',
    xpPerHit: 25,
  },
  {
    id: 'sword_combat',
    name: 'Katana Strike',
    description: 'Unleash close-range forged blade slashes against targets.',
    requiredLevel: 2,
    shortcut: '2',
    xpPerHit: 30,
  },
  {
    id: 'superpower_burst',
    name: 'Spirit Superpower',
    description: 'Channel elemental energy shockwaves across the sanctuary.',
    requiredLevel: 3,
    shortcut: '3',
    xpPerHit: 40,
  },
];

export interface GadgetDefinition {
  id: GadgetId;
  name: string;
  description: string;
  requiredLevel: number;
  shortcut: string;
}

export const GADGET_DEFINITIONS: GadgetDefinition[] = [
  {
    id: 'archery_bow',
    name: 'Archery Bow & Quiver',
    description: 'Standard-issue recurve bow & quiver for Level 1 archery.',
    requiredLevel: 1,
    shortcut: '1',
  },
  {
    id: 'hunter_blade',
    name: 'Hunter Katana',
    description: 'Forged close-combat katana unlocked at Level 2.',
    requiredLevel: 2,
    shortcut: '2',
  },
  {
    id: 'spirit_talisman',
    name: 'Spirit Talisman',
    description: 'Temporary swiftness seal activated with key 4.',
    requiredLevel: 2,
    shortcut: '4',
  },
  {
    id: 'yokai_radar',
    name: 'Yokai Compass',
    description: 'Reveals active target bearings across the realm.',
    requiredLevel: 3,
    shortcut: '5',
  },
  {
    id: 'spirit_beam',
    name: 'Superpower Focus',
    description: 'Amplifies elemental aura & shockwave radius.',
    requiredLevel: 3,
    shortcut: '3',
  },
];

export const COSTUME_UNLOCK_LEVELS: Record<CostumeId, number> = {
  shadow_hunter: 1,
  moonlit_azure: 2,
  crimson_ronin: 2,
  ivory_exorcist: 3,
  obsidian_shogun: 3,
  jade_weaver: 4,
};

export const HAIR_STYLE_UNLOCK_LEVELS: Record<HairStyleId, number> = {
  imperial_crown: 1,
  high_ponytail: 2,
  shadow_ronin: 2,
  twin_spirit: 3,
  silver_bob: 3,
  sovereign_halfup: 4,
};

export const HAIR_COLOR_UNLOCK_LEVELS: Record<HairColorId, number> = {
  obsidian: 1,
  midnight_indigo: 2,
  crimson_flame: 2,
  silver_moon: 3,
  ash_gold: 3,
  jade_teal: 4,
};

export const SWORD_UNLOCK_LEVELS: Record<SwordId, number> = {
  moonfang_katana: 2,
  dragonfire_jian: 2,
  azure_odachi: 3,
  bloodmoon_nodachi: 3,
  jade_sabre: 4,
};

export const ARCHERY_UNLOCK_LEVELS: Record<ArcheryId, number> = {
  ravenwood_recurve: 1,
  moonlight_crescent: 2,
  phoenix_sunbow: 2,
  shadowbone_compound: 3,
  jade_yumi: 4,
};

export const SUPERPOWER_UNLOCK_LEVELS: Record<SuperpowerId, number> = {
  azure_moonbeam: 3,
  crimson_yokai_flame: 3,
  void_lightning: 4,
  golden_solar: 4,
  emerald_gale: 5,
  frost_lotus: 5,
};

export const SKIN_TONE_UNLOCK_LEVELS: Record<SkinToneId, number> = {
  porcelain_fair: 1,
  warm_ivory: 2,
  golden_sand: 2,
  amber_bronze: 3,
  deep_espresso: 4,
};

export const CATEGORY_UNLOCK_LEVELS: Record<CustomizationCategoryKey, number> = {
  archery: 1,
  costume: 1,
  hair: 1,
  skinTone: 1,
  sword: 2,
  superpower: 3,
};

export function getLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (safeXp >= t.minXp) {
      level = t.level;
    }
  }
  return level;
}

export function getNextLevelThreshold(level: number): LevelThreshold | null {
  return LEVEL_THRESHOLDS.find((t) => t.level === level + 1) ?? null;
}

export function getLevelTitle(level: number): string {
  const found = LEVEL_THRESHOLDS.find((t) => t.level === level);
  if (found) return found.title;
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].title;
}

export function getRequiredLevelForItem(
  itemType:
    | 'costume'
    | 'hairStyle'
    | 'hairColor'
    | 'sword'
    | 'archery'
    | 'superpower'
    | 'skinTone',
  itemId: string,
): number {
  switch (itemType) {
    case 'costume':
      return COSTUME_UNLOCK_LEVELS[itemId as CostumeId] ?? 2;
    case 'hairStyle':
      return HAIR_STYLE_UNLOCK_LEVELS[itemId as HairStyleId] ?? 2;
    case 'hairColor':
      return HAIR_COLOR_UNLOCK_LEVELS[itemId as HairColorId] ?? 2;
    case 'sword':
      return SWORD_UNLOCK_LEVELS[itemId as SwordId] ?? 2;
    case 'archery':
      return ARCHERY_UNLOCK_LEVELS[itemId as ArcheryId] ?? 2;
    case 'superpower':
      return SUPERPOWER_UNLOCK_LEVELS[itemId as SuperpowerId] ?? 3;
    case 'skinTone':
      return SKIN_TONE_UNLOCK_LEVELS[itemId as SkinToneId] ?? 2;
  }
}

export function makeItemKey(
  itemType:
    | 'costume'
    | 'hairStyle'
    | 'hairColor'
    | 'sword'
    | 'archery'
    | 'superpower'
    | 'skinTone',
  itemId: string,
): string {
  return `${itemType}:${itemId}`;
}

export function getUnlockedItemsForLevel(level: number, existing: string[] = []): string[] {
  const set = new Set<string>(existing);

  const addIfUnlocked = (
    itemType:
      | 'costume'
      | 'hairStyle'
      | 'hairColor'
      | 'sword'
      | 'archery'
      | 'superpower'
      | 'skinTone',
    record: Record<string, number>,
  ) => {
    for (const [id, reqLevel] of Object.entries(record)) {
      if (level >= reqLevel) {
        set.add(makeItemKey(itemType, id));
      }
    }
  };

  addIfUnlocked('costume', COSTUME_UNLOCK_LEVELS);
  addIfUnlocked('hairStyle', HAIR_STYLE_UNLOCK_LEVELS);
  addIfUnlocked('hairColor', HAIR_COLOR_UNLOCK_LEVELS);
  addIfUnlocked('sword', SWORD_UNLOCK_LEVELS);
  addIfUnlocked('archery', ARCHERY_UNLOCK_LEVELS);
  addIfUnlocked('superpower', SUPERPOWER_UNLOCK_LEVELS);
  addIfUnlocked('skinTone', SKIN_TONE_UNLOCK_LEVELS);

  for (const act of ACTIVITY_DEFINITIONS) {
    if (level >= act.requiredLevel) {
      set.add(`activity:${act.id}`);
    }
  }
  for (const gad of GADGET_DEFINITIONS) {
    if (level >= gad.requiredLevel) {
      set.add(`gadget:${gad.id}`);
    }
  }

  return Array.from(set).sort();
}

export function isItemUnlocked(
  level: number,
  unlockedItems: string[],
  itemType:
    | 'costume'
    | 'hairStyle'
    | 'hairColor'
    | 'sword'
    | 'archery'
    | 'superpower'
    | 'skinTone',
  itemId: string,
): boolean {
  const reqLevel = getRequiredLevelForItem(itemType, itemId);
  if (level >= reqLevel) return true;
  return unlockedItems.includes(makeItemKey(itemType, itemId));
}

export function isCategoryUnlocked(level: number, category: CustomizationCategoryKey): boolean {
  return level >= CATEGORY_UNLOCK_LEVELS[category];
}

export function isActivityUnlocked(level: number, activityId: ActivityId): boolean {
  const def = ACTIVITY_DEFINITIONS.find((a) => a.id === activityId);
  return def ? level >= def.requiredLevel : false;
}

export function isGadgetUnlocked(level: number, gadgetId: GadgetId): boolean {
  const def = GADGET_DEFINITIONS.find((g) => g.id === gadgetId);
  return def ? level >= def.requiredLevel : false;
}

export function findLockedCustomizationError(
  requested: Partial<CharacterCustomization> | null | undefined,
  current: CharacterCustomization,
  level: number,
  unlockedItems: string[],
): string | null {
  if (!requested || typeof requested !== 'object') return null;

  const checks: [
    keyof CharacterCustomization,
    'costume' | 'hairStyle' | 'hairColor' | 'sword' | 'archery' | 'superpower' | 'skinTone',
    string,
  ][] = [
    ['costume', 'costume', 'Costume'],
    ['hairStyle', 'hairStyle', 'Hairstyle'],
    ['hairColor', 'hairColor', 'Hair color'],
    ['sword', 'sword', 'Sword'],
    ['archery', 'archery', 'Archery bow'],
    ['superpower', 'superpower', 'Superpower'],
    ['skinTone', 'skinTone', 'Skin tone'],
  ];

  for (const [prop, itemType, label] of checks) {
    const val = requested[prop];
    if (typeof val !== 'string' || val === current[prop]) continue;
    if (!isItemUnlocked(level, unlockedItems, itemType, val)) {
      const req = getRequiredLevelForItem(itemType, val);
      return `${label} is locked. Unlock at Level ${req}.`;
    }
  }

  return null;
}

export function enforceCustomizationProgression(
  input: Partial<CharacterCustomization> | null | undefined,
  gender: Gender,
  level: number,
  unlockedItems: string[],
): CharacterCustomization {
  const sanitized = sanitizeCustomization(input, gender);
  const defaults = getDefaultCustomization(gender);

  return {
    costume: isItemUnlocked(level, unlockedItems, 'costume', sanitized.costume)
      ? sanitized.costume
      : defaults.costume,
    hairStyle: isItemUnlocked(level, unlockedItems, 'hairStyle', sanitized.hairStyle)
      ? sanitized.hairStyle
      : defaults.hairStyle,
    hairColor: isItemUnlocked(level, unlockedItems, 'hairColor', sanitized.hairColor)
      ? sanitized.hairColor
      : defaults.hairColor,
    sword: isItemUnlocked(level, unlockedItems, 'sword', sanitized.sword)
      ? sanitized.sword
      : defaults.sword,
    archery: isItemUnlocked(level, unlockedItems, 'archery', sanitized.archery)
      ? sanitized.archery
      : defaults.archery,
    superpower: isItemUnlocked(level, unlockedItems, 'superpower', sanitized.superpower)
      ? sanitized.superpower
      : defaults.superpower,
    skinTone: isItemUnlocked(level, unlockedItems, 'skinTone', sanitized.skinTone)
      ? sanitized.skinTone
      : defaults.skinTone,
  };
}
