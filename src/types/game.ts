export type Gender = 'male' | 'female';

export type CostumeId =
  | 'shadow_hunter'
  | 'moonlit_azure'
  | 'crimson_ronin'
  | 'ivory_exorcist'
  | 'obsidian_shogun'
  | 'jade_weaver';

export type HairStyleId =
  | 'imperial_crown'
  | 'high_ponytail'
  | 'shadow_ronin'
  | 'twin_spirit'
  | 'silver_bob'
  | 'sovereign_halfup';

export type HairColorId =
  | 'obsidian'
  | 'midnight_indigo'
  | 'crimson_flame'
  | 'silver_moon'
  | 'ash_gold'
  | 'jade_teal';

export type SwordId =
  | 'moonfang_katana'
  | 'dragonfire_jian'
  | 'azure_odachi'
  | 'bloodmoon_nodachi'
  | 'jade_sabre';

export type ArcheryId =
  | 'ravenwood_recurve'
  | 'moonlight_crescent'
  | 'phoenix_sunbow'
  | 'shadowbone_compound'
  | 'jade_yumi';

export type SuperpowerId =
  | 'azure_moonbeam'
  | 'crimson_yokai_flame'
  | 'void_lightning'
  | 'golden_solar'
  | 'emerald_gale'
  | 'frost_lotus';

export type SkinToneId =
  | 'porcelain_fair'
  | 'warm_ivory'
  | 'golden_sand'
  | 'amber_bronze'
  | 'deep_espresso';

export type CustomizationCategoryKey =
  | 'costume'
  | 'hair'
  | 'sword'
  | 'archery'
  | 'superpower'
  | 'skinTone';

export interface CharacterCustomization {
  costume: CostumeId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  sword: SwordId;
  archery: ArcheryId;
  superpower: SuperpowerId;
  skinTone: SkinToneId;
}

export type ActivityId = 'archery' | 'sword_combat' | 'superpower_burst';

export type GadgetId =
  | 'archery_bow'
  | 'hunter_blade'
  | 'spirit_talisman'
  | 'yokai_radar'
  | 'spirit_beam';

export interface KodamaChallengeProgress {
  diamonds: number;
  completedRounds: number[];
  stage2Unlocked: boolean;
}

export interface PlayerAccount {
  playerId: string;
  username: string;
  gender: Gender;
  level: number;
  xp: number;
  orbsCleared: number;
  unlockedItems: string[];
  kodamaProgress: KodamaChallengeProgress;
  recoveryQuestion: string;
  maleCustomization: CharacterCustomization;
  femaleCustomization: CharacterCustomization;
  createdAt: string;
  updatedAt: string;
}

export type AppScreen = 'auth' | 'gender-select' | 'customize' | 'playing';
