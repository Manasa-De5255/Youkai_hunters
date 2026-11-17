import {
  ArcheryId,
  CharacterCustomization,
  CostumeId,
  CustomizationCategoryKey,
  Gender,
  HairColorId,
  HairStyleId,
  SkinToneId,
  SuperpowerId,
  SwordId,
} from '../types/game';

export interface CostumeOption {
  id: CostumeId;
  name: string;
  maleTitle: string;
  femaleTitle: string;
  subtitle: string;
  primaryHex: string;
  secondaryHex: string;
  trimHex: string;
  innerHex: string;
  armorStyle: 'coat' | 'plate' | 'shrine' | 'shinobi';
}

export interface HairStyleOption {
  id: HairStyleId;
  name: string;
  maleDesc: string;
  femaleDesc: string;
}

export interface SwatchOption<T extends string> {
  id: T;
  name: string;
  hex: string;
  accentHex?: string;
}

export interface WeaponOption<T extends string> {
  id: T;
  name: string;
  description: string;
  primaryHex: string;
  accentHex: string;
  glowHex: string;
}

export interface SuperpowerOption {
  id: SuperpowerId;
  name: string;
  element: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
}

export const UPLOADED_ASSETS = {
  openingBg: '/assets/aistudio/Yokai_Hunters__Moonlit_Forest_fe20c0f3.png',
  customizationBg: '/assets/aistudio/Yokai_Hunters_Warrior___16_Nov_2026__9.29_pm_367f5ae5.png',
  maleCharacter: '/assets/aistudio/Yokai_Hunters_Warrior_MALE___16_Nov_2026__9.22_pm_d89229ad.png',
  femaleCharacter: '/assets/aistudio/Yokai_Hunters_Warrior__FEMALE__16_Nov_2026__9.24_pm_83697a22.png',
} as const;

export const CUSTOMIZATION_CATEGORIES: {
  key: CustomizationCategoryKey;
  label: string;
  shortDesc: string;
}[] = [
  { key: 'costume', label: 'Costume', shortDesc: 'Battle robes & armor' },
  { key: 'hair', label: 'Hair', shortDesc: 'Hairstyles & color' },
  { key: 'sword', label: 'Sword', shortDesc: 'Blades & guards' },
  { key: 'archery', label: 'Archery', shortDesc: 'Bows & quivers' },
  { key: 'superpower', label: 'Superpower', shortDesc: 'Spirit aura & beams' },
  { key: 'skinTone', label: 'Skin Tone', shortDesc: 'Complexion tones' },
];

export const COSTUME_OPTIONS: CostumeOption[] = [
  {
    id: 'shadow_hunter',
    name: 'Shadow Hunter',
    maleTitle: 'Obsidian Dragon Coat',
    femaleTitle: 'Crimson Phoenix Mantle',
    subtitle: 'Default guild armor in obsidian leather, crimson silk & gold filigree',
    primaryHex: '#181920',
    secondaryHex: '#6c131d',
    trimHex: '#c89b4b',
    innerHex: '#4f0d15',
    armorStyle: 'coat',
  },
  {
    id: 'moonlit_azure',
    name: 'Moonlit Shinobi',
    maleTitle: 'Midnight Gale Garb',
    femaleTitle: 'Crescent Silk Raiment',
    subtitle: 'Midnight blue stealthweave with luminous cyan spirit trim',
    primaryHex: '#0f1b33',
    secondaryHex: '#0f4c6b',
    trimHex: '#38bdf8',
    innerHex: '#0c2745',
    armorStyle: 'shinobi',
  },
  {
    id: 'crimson_ronin',
    name: 'Bloodmoon Ronin',
    maleTitle: 'Scarlet Lacquer Haori',
    femaleTitle: 'Ember Empress Vestment',
    subtitle: 'Deep vermilion battle coat paired with charcoal lamellar plates',
    primaryHex: '#4b0f18',
    secondaryHex: '#16161d',
    trimHex: '#e0a958',
    innerHex: '#7e1824',
    armorStyle: 'coat',
  },
  {
    id: 'ivory_exorcist',
    name: 'Shrine Exorcist',
    maleTitle: 'Sacred Frost Hakama',
    femaleTitle: 'Celestial Miko Battle Robe',
    subtitle: 'Ivory ceremonial silk with vermilion sashes and gilded seals',
    primaryHex: '#d9dde6',
    secondaryHex: '#9e1c2b',
    trimHex: '#d4a656',
    innerHex: '#2c364c',
    armorStyle: 'shrine',
  },
  {
    id: 'obsidian_shogun',
    name: 'Shogun Ironplate',
    maleTitle: 'Ironclad Warlord Armor',
    femaleTitle: 'Valkyrie O-Yoroi Plate',
    subtitle: 'Heavy lacquered midnight-steel pauldrons with antique gold crest',
    primaryHex: '#111622',
    secondaryHex: '#25324a',
    trimHex: '#e5b869',
    innerHex: '#1d2230',
    armorStyle: 'plate',
  },
  {
    id: 'jade_weaver',
    name: 'Jade Spirit Weaver',
    maleTitle: 'Verdant Mist Coat',
    femaleTitle: 'Emerald Lotus Attire',
    subtitle: 'Deep celadon-jade robes accented with bronze filigree',
    primaryHex: '#0d2b2b',
    secondaryHex: '#125a4c',
    trimHex: '#cfa15e',
    innerHex: '#081d1e',
    armorStyle: 'shrine',
  },
];

export const HAIR_STYLE_OPTIONS: HairStyleOption[] = [
  {
    id: 'imperial_crown',
    name: 'Imperial Crown Locks',
    maleDesc: 'Tall black-and-gold hunter crown with long flowing hair',
    femaleDesc: 'Elevated gold-crested ponytail crown with wispy bangs',
  },
  {
    id: 'high_ponytail',
    name: 'Moonlit Ponytail',
    maleDesc: 'Swept warrior ponytail bound with crimson silk',
    femaleDesc: 'High cascading combat ponytail with framing strands',
  },
  {
    id: 'shadow_ronin',
    name: 'Shadow Ronin Mane',
    maleDesc: 'Untamed layered spikes with midnight forehead band',
    femaleDesc: 'Dynamic wind-swept wolf cut with spirit ribbon',
  },
  {
    id: 'twin_spirit',
    name: 'Twin Spirit Braids',
    maleDesc: 'Dual braided side-locks with brushed shoulder mane',
    femaleDesc: 'Long twin tails clasped with gilded rings',
  },
  {
    id: 'silver_bob',
    name: 'Blade-Cut Bob',
    maleDesc: 'Clean angled temple cut with sharp nape taper',
    femaleDesc: 'Sleek chin-length assassin bob with side part',
  },
  {
    id: 'sovereign_halfup',
    name: 'Sovereign Topknot',
    maleDesc: 'Regal half-tied bun with flowing cape-length back hair',
    femaleDesc: 'Half-up lotus knot with cascading temple locks',
  },
];

export const HAIR_COLOR_OPTIONS: SwatchOption<HairColorId>[] = [
  { id: 'obsidian', name: 'Jet Obsidian', hex: '#14161d', accentHex: '#2d3345' },
  { id: 'midnight_indigo', name: 'Midnight Indigo', hex: '#172347', accentHex: '#3b82f6' },
  { id: 'crimson_flame', name: 'Crimson Flame', hex: '#6e1623', accentHex: '#ef4444' },
  { id: 'silver_moon', name: 'Silver Moon', hex: '#cbd5e1', accentHex: '#f8fafc' },
  { id: 'ash_gold', name: 'Gilded Ash', hex: '#b5945b', accentHex: '#eab308' },
  { id: 'jade_teal', name: 'Jade Mist', hex: '#134e4a', accentHex: '#2dd4bf' },
];

export const SWORD_OPTIONS: WeaponOption<SwordId>[] = [
  {
    id: 'moonfang_katana',
    name: 'Moonfang Katana',
    description: 'Curved forged-steel katana with gilded chrysanthemum guard',
    primaryHex: '#cbd5e1',
    accentHex: '#c89b4b',
    glowHex: '#38bdf8',
  },
  {
    id: 'dragonfire_jian',
    name: 'Dragonfire Jian',
    description: 'Imperial double-edged straight sword with crimson tassel',
    primaryHex: '#e2e8f0',
    accentHex: '#b91c1c',
    glowHex: '#f59e0b',
  },
  {
    id: 'azure_odachi',
    name: 'Azure Spirit Odachi',
    description: 'Long spirit-infused greatblade pulsing with cyan moonlight',
    primaryHex: '#7dd3fc',
    accentHex: '#0f172a',
    glowHex: '#06b6d4',
  },
  {
    id: 'bloodmoon_nodachi',
    name: 'Bloodmoon Nodachi',
    description: 'Obsidian demon-slayer blade etched with crimson runes',
    primaryHex: '#1f2937',
    accentHex: '#991b1b',
    glowHex: '#ef4444',
  },
  {
    id: 'jade_sabre',
    name: 'Jade Serpent Dao',
    description: 'Broad curved hunter sabre forged with jade-bronze hilt',
    primaryHex: '#94a3b8',
    accentHex: '#0d9488',
    glowHex: '#2dd4bf',
  },
];

export const ARCHERY_OPTIONS: WeaponOption<ArcheryId>[] = [
  {
    id: 'ravenwood_recurve',
    name: 'Ravenwood Recurve',
    description: 'Black lacquered recurve bow with gold tips & crimson fletching',
    primaryHex: '#1e1b24',
    accentHex: '#c89b4b',
    glowHex: '#dc2626',
  },
  {
    id: 'moonlight_crescent',
    name: 'Moonlight Crescent',
    description: 'Silver-cyan spirit bow firing luminous moonlit arrows',
    primaryHex: '#1e3a5f',
    accentHex: '#38bdf8',
    glowHex: '#7dd3fc',
  },
  {
    id: 'phoenix_sunbow',
    name: 'Phoenix Sunbow',
    description: 'Gilded crimson warbow crowned with flame-carved limbs',
    primaryHex: '#7f1d1d',
    accentHex: '#eab308',
    glowHex: '#f97316',
  },
  {
    id: 'shadowbone_compound',
    name: 'Shadowbone Hunter',
    description: 'Reinforced horn-limbed bow forged for piercing yokai hide',
    primaryHex: '#27272a',
    accentHex: '#a16207',
    glowHex: '#a855f7',
  },
  {
    id: 'jade_yumi',
    name: 'Jade Whisper Yumi',
    description: 'Asymmetric bamboo-jade longbow with emerald spirit cord',
    primaryHex: '#115e59',
    accentHex: '#d4a656',
    glowHex: '#34d399',
  },
];

export const SUPERPOWER_OPTIONS: SuperpowerOption[] = [
  {
    id: 'azure_moonbeam',
    name: 'Azure Moonbeam',
    element: 'Spirit Water',
    description: 'Orbiting cyan moonlight rings & astral spirit streams',
    primaryHex: '#38bdf8',
    secondaryHex: '#0284c7',
  },
  {
    id: 'crimson_yokai_flame',
    name: 'Crimson Yokai Flame',
    element: 'Hellfire',
    description: 'Blazing scarlet-amber vortex and rising ember wisps',
    primaryHex: '#ef4444',
    secondaryHex: '#f97316',
  },
  {
    id: 'void_lightning',
    name: 'Void Lightning',
    element: 'Storm',
    description: 'Crackling violet plasma arcs & abyssal energy halo',
    primaryHex: '#a855f7',
    secondaryHex: '#6366f1',
  },
  {
    id: 'golden_solar',
    name: 'Solar Exorcism',
    element: 'Radiant',
    description: 'Sacred golden shrine mandala & ascending light beams',
    primaryHex: '#fbbf24',
    secondaryHex: '#f59e0b',
  },
  {
    id: 'emerald_gale',
    name: 'Emerald Spirit Gale',
    element: 'Tempest',
    description: 'Swirling jade wind spirals & luminous mist motes',
    primaryHex: '#34d399',
    secondaryHex: '#0d9488',
  },
  {
    id: 'frost_lotus',
    name: 'Frost Lotus',
    element: 'Glacier',
    description: 'Crystalline ice shards orbiting a pale-blue lotus aura',
    primaryHex: '#bae6fd',
    secondaryHex: '#60a5fa',
  },
];

export const SKIN_TONE_OPTIONS: SwatchOption<SkinToneId>[] = [
  { id: 'porcelain_fair', name: 'Porcelain Fair', hex: '#ecd0c2', accentHex: '#cfa998' },
  { id: 'warm_ivory', name: 'Warm Ivory', hex: '#e2ba9f', accentHex: '#bf9176' },
  { id: 'golden_sand', name: 'Golden Sand', hex: '#cfa07b', accentHex: '#ab7853' },
  { id: 'amber_bronze', name: 'Amber Bronze', hex: '#ad734e', accentHex: '#845132' },
  { id: 'deep_espresso', name: 'Deep Umber', hex: '#744a34', accentHex: '#4f2f20' },
];

export function getDefaultCustomization(_gender: Gender): CharacterCustomization {
  return {
    costume: 'shadow_hunter',
    hairStyle: 'imperial_crown',
    hairColor: 'obsidian',
    sword: 'moonfang_katana',
    archery: 'ravenwood_recurve',
    superpower: 'azure_moonbeam',
    skinTone: 'porcelain_fair',
  };
}

export function sanitizeCustomization(
  input: Partial<CharacterCustomization> | null | undefined,
  gender: Gender,
): CharacterCustomization {
  const defaults = getDefaultCustomization(gender);
  if (!input || typeof input !== 'object') return defaults;

  const has = <T extends string>(arr: { id: T }[], val: unknown): val is T =>
    typeof val === 'string' && arr.some((item) => item.id === val);

  return {
    costume: has(COSTUME_OPTIONS, input.costume) ? input.costume : defaults.costume,
    hairStyle: has(HAIR_STYLE_OPTIONS, input.hairStyle) ? input.hairStyle : defaults.hairStyle,
    hairColor: has(HAIR_COLOR_OPTIONS, input.hairColor) ? input.hairColor : defaults.hairColor,
    sword: has(SWORD_OPTIONS, input.sword) ? input.sword : defaults.sword,
    archery: has(ARCHERY_OPTIONS, input.archery) ? input.archery : defaults.archery,
    superpower: has(SUPERPOWER_OPTIONS, input.superpower) ? input.superpower : defaults.superpower,
    skinTone: has(SKIN_TONE_OPTIONS, input.skinTone) ? input.skinTone : defaults.skinTone,
  };
}
