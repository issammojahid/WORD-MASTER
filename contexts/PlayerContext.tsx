import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

// ── Rarity ───────────────────────────────────────────────────────────────────
export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_COLORS: Record<string, string> = {
  common:    "#00F5FF",
  rare:      "#BF00FF",
  epic:      "#FF006E",
  legendary: "#F5C842",
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common:    "عادي",
  rare:      "نادر",
  epic:      "ملحمي",
  legendary: "أسطوري",
};

// ── Skins ────────────────────────────────────────────────────────────────────
export type SkinId =
  | "student" | "djellaba" | "sport" | "champion"
  | "kaftan" | "fassi" | "sahrawi" | "amazigh"
  | "ninja" | "astronaut" | "king" | "hacker" | "superhero"
  | "legend" | "elite" | "tourChamp"
  | "vip_phoenix" | "vip_sultan" | "vip_cyber";

export type UnlockCondition = {
  type: "wins" | "level" | "streak";
  value: number;
  label: string;
};

export type Skin = {
  id: SkinId;
  price: number;
  emoji: string;
  color: string;
  rarity: Rarity;
  category: "moroccan" | "global" | "exclusive";
  nameAr: string;
  descAr: string;
  unlockCondition?: UnlockCondition;
};

export const SKINS: Skin[] = [
  // ── Existing ──────────────────────────────────────────────────────────────
  { id: "student",   price: 0,   emoji: "🎓", color: "#3498DB", rarity: "common",    category: "global",    nameAr: "الطالب",          descAr: "الزي الكلاسيكي المجاني" },
  { id: "djellaba",  price: 150, emoji: "👘", color: "#8B2500", rarity: "common",    category: "moroccan",  nameAr: "الجلابة",         descAr: "الزي المغربي التقليدي" },
  { id: "sport",     price: 200, emoji: "⚽", color: "#27AE60", rarity: "common",    category: "global",    nameAr: "الرياضي",         descAr: "الزي الرياضي العصري" },
  { id: "champion",  price: 500, emoji: "🏆", color: "#F5A623", rarity: "epic",      category: "global",    nameAr: "البطل",           descAr: "زي البطل المنتصر" },
  // ── New Moroccan ──────────────────────────────────────────────────────────
  { id: "kaftan",    price: 180, emoji: "👗", color: "#C2185B", rarity: "common",    category: "moroccan",  nameAr: "القفطان",         descAr: "القفطان المغربي الأنيق" },
  { id: "fassi",     price: 320, emoji: "🎭", color: "#7B1FA2", rarity: "rare",      category: "moroccan",  nameAr: "الزي الفاسي",     descAr: "الزي الفاسي الملكي" },
  { id: "sahrawi",   price: 130, emoji: "🌵", color: "#F57F17", rarity: "common",    category: "moroccan",  nameAr: "الصحراوي",        descAr: "زي الصحراء المغربية" },
  { id: "amazigh",   price: 380, emoji: "⚡", color: "#1565C0", rarity: "rare",      category: "moroccan",  nameAr: "الأمازيغي",       descAr: "الزي الأمازيغي التراثي" },
  // ── New Global ────────────────────────────────────────────────────────────
  { id: "ninja",     price: 350, emoji: "🥷", color: "#37474F", rarity: "rare",      category: "global",    nameAr: "النينجا",         descAr: "المقاتل الصامت الخفي" },
  { id: "astronaut", price: 450, emoji: "👨‍🚀", color: "#3F51B5", rarity: "epic",      category: "global",    nameAr: "رائد الفضاء",     descAr: "مستكشف الفضاء الخارجي" },
  { id: "king",      price: 700, emoji: "👑", color: "#FFB300", rarity: "legendary", category: "global",    nameAr: "الملك",           descAr: "حاكم المملكة العظيم" },
  { id: "hacker",    price: 380, emoji: "💻", color: "#00BCD4", rarity: "rare",      category: "global",    nameAr: "الهاكر",          descAr: "خبير البرمجة والأكواد" },
  { id: "superhero", price: 550, emoji: "🦸", color: "#E53935", rarity: "epic",      category: "global",    nameAr: "البطل الخارق",    descAr: "منقذ المدينة الشجاع" },
  // ── Exclusive (achievement-locked) ───────────────────────────────────────
  {
    id: "legend", price: 0, emoji: "🌟", color: "#FF6B35", rarity: "legendary", category: "exclusive",
    nameAr: "الأسطورة", descAr: "حقق 20 انتصاراً لتفتح هذا الزي",
    unlockCondition: { type: "wins", value: 20, label: "فز بـ 20 مباراة" },
  },
  {
    id: "elite", price: 0, emoji: "💎", color: "#00E5FF", rarity: "epic", category: "exclusive",
    nameAr: "النخبة", descAr: "ابلغ المستوى 10 لتفتح هذا الزي",
    unlockCondition: { type: "level", value: 10, label: "ابلغ المستوى 10" },
  },
  {
    id: "tourChamp", price: 0, emoji: "🏅", color: "#FFD600", rarity: "legendary", category: "exclusive",
    nameAr: "بطل البطولات", descAr: "حقق سلسلة 5 انتصارات لتفتح هذا الزي",
    unlockCondition: { type: "streak", value: 5, label: "سلسلة 5 انتصارات" },
  },
  // ── VIP Exclusive ───────────────────────────────────────────────────────────
  { id: "vip_phoenix", price: 0, emoji: "🔥", color: "#FF6B00", rarity: "legendary", category: "exclusive", nameAr: "العنقاء", descAr: "حصري لأعضاء VIP" },
  { id: "vip_sultan",  price: 0, emoji: "👑", color: "#F5C842", rarity: "legendary", category: "exclusive", nameAr: "السلطان", descAr: "حصري لأعضاء VIP" },
  { id: "vip_cyber",   price: 0, emoji: "🤖", color: "#00F5FF", rarity: "legendary", category: "exclusive", nameAr: "السايبر", descAr: "حصري لأعضاء VIP" },
];

// ── Backgrounds ───────────────────────────────────────────────────────────────
export type BackgroundId = "default" | "desert" | "space" | "city" | "marrakech" | "school";

export type Background = {
  id: BackgroundId;
  price: number;
  emoji: string;
  color: string;
  rarity: Rarity;
  nameAr: string;
};

export const BACKGROUNDS: Background[] = [
  { id: "default",   price: 0,   emoji: "🌊", color: "#0A0A1A", rarity: "common",    nameAr: "الافتراضي" },
  { id: "desert",    price: 200, emoji: "🏜️", color: "#C19A6B", rarity: "common",    nameAr: "صحراء المغرب" },
  { id: "space",     price: 300, emoji: "🌌", color: "#0A0A2A", rarity: "rare",      nameAr: "الفضاء" },
  { id: "city",      price: 250, emoji: "🌆", color: "#1A3050", rarity: "common",    nameAr: "المدينة" },
  { id: "marrakech", price: 350, emoji: "🌹", color: "#8B2500", rarity: "rare",      nameAr: "مراكش" },
  { id: "school",    price: 150, emoji: "🏫", color: "#2E7D32", rarity: "common",    nameAr: "المدرسة" },
];

// ── Emotes ────────────────────────────────────────────────────────────────────
export type EmoteId = "laugh" | "cool" | "fire" | "clap" | "angry";

export type Emote = {
  id: EmoteId;
  price: number;
  emoji: string;
  nameAr: string;
};

export const EMOTES: Emote[] = [
  { id: "laugh", price: 0,   emoji: "😂", nameAr: "ضحك" },
  { id: "cool",  price: 80,  emoji: "😎", nameAr: "هادئ" },
  { id: "fire",  price: 100, emoji: "🔥", nameAr: "نار" },
  { id: "clap",  price: 80,  emoji: "👏", nameAr: "تصفيق" },
  { id: "angry", price: 60,  emoji: "😡", nameAr: "غاضب" },
];

// ── Victory Effects ────────────────────────────────────────────────────────────
export type EffectId = "none" | "confetti" | "fire_effect" | "stars" | "coins_burst";

export type Effect = {
  id: EffectId;
  price: number;
  emoji: string;
  color: string;
  rarity: Rarity;
  nameAr: string;
  descAr: string;
};

export const EFFECTS: Effect[] = [
  { id: "none",        price: 0,   emoji: "—",  color: "#5A5A88", rarity: "common",    nameAr: "بلا تأثير",     descAr: "لا يوجد تأثير خاص" },
  { id: "confetti",    price: 200, emoji: "🎊", color: "#E040FB", rarity: "common",    nameAr: "كونفيتي",       descAr: "مطر من الألوان عند الفوز" },
  { id: "fire_effect", price: 300, emoji: "🔥", color: "#FF6D00", rarity: "rare",      nameAr: "تأثير النار",   descAr: "ألسنة نيران عند الفوز" },
  { id: "stars",       price: 250, emoji: "⭐", color: "#FFD600", rarity: "rare",      nameAr: "انفجار النجوم", descAr: "نجوم تتساقط عند الفوز" },
  { id: "coins_burst", price: 400, emoji: "🪙", color: "#F5C842", rarity: "epic",      nameAr: "انفجار عملات", descAr: "أمطار من العملات الذهبية" },
];

// ── Titles ────────────────────────────────────────────────────────────────────
export type TitleId =
  | "beginner" | "eloquent" | "word_master" | "letter_king"
  | "morocco_legend" | "lightning" | "genius" | "streak_lord" | "champion_title"
  | "vip_gold";

export type Title = {
  id: TitleId;
  price: number;
  emoji: string;
  color: string;
  rarity: Rarity;
  nameAr: string;
  descAr: string;
  unlockCondition?: UnlockCondition;
};

export const TITLES: Title[] = [
  { id: "beginner",       price: 0,   emoji: "🎓", color: "#9CA3AF", rarity: "common",    nameAr: "مبتدئ",             descAr: "لقبك الأول في رحلة الكلمات" },
  { id: "eloquent",       price: 200, emoji: "🗣️", color: "#00F5FF", rarity: "common",    nameAr: "الفصيح",            descAr: "يتقن فن الكلام والبيان" },
  { id: "word_master",    price: 350, emoji: "📖", color: "#BF00FF", rarity: "rare",      nameAr: "معلم الكلمات",      descAr: "خبير لا يُقهر في عالم المفردات" },
  { id: "lightning",      price: 300, emoji: "⚡", color: "#00F5FF", rarity: "rare",      nameAr: "سريع البرق",        descAr: "أسرع من البرق في إيجاد الكلمات" },
  { id: "genius",         price: 600, emoji: "🧠", color: "#BF00FF", rarity: "epic",      nameAr: "الذكاء الخارق",     descAr: "عقل استثنائي في عالم الحروف" },
  { id: "letter_king",    price: 500, emoji: "👑", color: "#BF00FF", rarity: "epic",      nameAr: "ملك الحروف",        descAr: "حاكم مطلق على ممالك الكلمات" },
  { id: "streak_lord",    price: 0,   emoji: "🔥", color: "#FF6D00", rarity: "epic",      nameAr: "سيد السلاسل",      descAr: "حقق سلسلة 5 انتصارات",
    unlockCondition: { type: "streak", value: 5, label: "سلسلة 5 انتصارات" } },
  { id: "morocco_legend", price: 0,   emoji: "🌟", color: "#F5C842", rarity: "legendary", nameAr: "أسطورة المغرب",     descAr: "فز بـ 20 مباراة لتحمل هذا اللقب",
    unlockCondition: { type: "wins", value: 20, label: "فز بـ 20 مباراة" } },
  { id: "champion_title", price: 0,   emoji: "🏅", color: "#F5C842", rarity: "legendary", nameAr: "البطل الأبدي",      descAr: "ابلغ المستوى 10 لتحمل هذا اللقب",
    unlockCondition: { type: "level", value: 10, label: "ابلغ المستوى 10" } },
  { id: "vip_gold",       price: 0,   emoji: "👑", color: "#F5C842", rarity: "legendary", nameAr: "عضو VIP",           descAr: "لقب حصري لأعضاء الاشتراك المميز" },
];

// ── Mystery Box ───────────────────────────────────────────────────────────────
export const MYSTERY_BOX_PRICE = 100;

export type MysteryBoxPrize = {
  type: "skin" | "background" | "emote" | "effect" | "coins";
  id?: string;
  coins?: number;
  emoji: string;
  nameAr: string;
};

// ── Power Cards ───────────────────────────────────────────────────────────────
export type PowerCards = {
  time: number;
  freeze: number;
  hint: number;
};

// ── Level reward milestones ───────────────────────────────────────────────────
export const LEVEL_REWARDS: { level: number; coins?: number; skinId?: SkinId; label: string }[] = [
  { level: 5,  coins: 300,  label: "وصلت المستوى 5! 🎉 +300 عملة" },
  { level: 10, coins: 500,  label: "وصلت المستوى 10! 🔥 +500 عملة" },
  { level: 15, skinId: "astronaut", label: "وصلت المستوى 15! 👨‍🚀 فتحت رائد الفضاء!" },
  { level: 20, coins: 1000, label: "وصلت المستوى 20! 👑 +1000 عملة" },
];

// ── Player Profile ────────────────────────────────────────────────────────────
export type PlayerProfile = {
  name: string;
  playerTag: number | null;
  coins: number;
  xp: number;
  level: number;
  equippedSkin: SkinId;
  ownedSkins: SkinId[];
  totalScore: number;
  gamesPlayed: number;
  wins: number;
  winStreak: number;
  bestStreak: number;
  lastStreakReward: number;
  lastSpinAt: string | null;
  lastLoginRewardAt: string | null;
  claimedLevelRewards: number[];
  // New cosmetic fields
  ownedBackgrounds: BackgroundId[];
  equippedBackground: BackgroundId;
  ownedEmotes: EmoteId[];
  ownedEffects: EffectId[];
  equippedEffect: EffectId;
  dailyShopDate: string | null;
  dailyShopBought: string[];
  // Power cards inventory
  powerCards: PowerCards;
  // Titles
  ownedTitles: TitleId[];
  equippedTitle: TitleId | null;
  // VIP
  isVip: boolean;
  vipExpiresAt: string | null;
  // Country
  country: string;
  // Clan Wars
  clanId: string | null;
  // Ranked Season
  elo: number;
  division: string;
  seasonWins: number;
  seasonLosses: number;
};

type PlayerContextType = {
  profile: PlayerProfile;
  playerId: string;
  updateProfile: (updates: Partial<PlayerProfile>) => void;
  addCoins: (amount: number) => void;
  addXp: (amount: number) => void;
  purchaseSkin: (skinId: SkinId) => boolean;
  equipSkin: (skinId: SkinId) => void;
  purchaseBackground: (id: BackgroundId) => boolean;
  equipBackground: (id: BackgroundId) => void;
  purchaseEmote: (id: EmoteId) => boolean;
  purchaseEffect: (id: EffectId) => boolean;
  equipEffect: (id: EffectId) => void;
  grantItem: (type: "skin" | "background" | "emote" | "effect", id: string) => void;
  buyDailyItem: (itemId: string, itemType: "skin" | "background" | "emote" | "effect", price: number) => boolean;
  setPlayerName: (name: string) => void;
  syncToServer: () => Promise<void>;
  reportGameResult: (won: boolean, score: number, coinsEarned: number, xpEarned: number, coinEntry?: number) => Promise<{ streakBonus: number; coinEntryReward: number }>;
  useCard: (cardId: keyof PowerCards) => boolean;
  claimLoginReward: () => boolean;
  addPowerCard: (cardId: keyof PowerCards, count?: number) => void;
  purchaseTitle: (id: TitleId) => boolean;
  equipTitle: (id: TitleId) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

const STORAGE_KEY = "player_profile_v3";
const PLAYER_ID_KEY = "player_id_v1";
const FIRST_LAUNCH_KEY = "player_first_launch_v1";
const STARTING_COINS = 1000;

const defaultProfile: PlayerProfile = {
  name: "لاعب",
  playerTag: null,
  coins: 100,
  xp: 0,
  level: 1,
  equippedSkin: "student",
  ownedSkins: ["student"],
  totalScore: 0,
  gamesPlayed: 0,
  wins: 0,
  winStreak: 0,
  bestStreak: 0,
  lastStreakReward: 0,
  lastSpinAt: null,
  lastLoginRewardAt: null,
  claimedLevelRewards: [],
  ownedBackgrounds: ["default"],
  equippedBackground: "default",
  ownedEmotes: ["laugh"],
  ownedEffects: ["none"],
  equippedEffect: "none",
  dailyShopDate: null,
  dailyShopBought: [],
  powerCards: { time: 3, freeze: 3, hint: 3 },
  ownedTitles: ["beginner"],
  equippedTitle: "beginner",
  isVip: false,
  vipExpiresAt: null,
  country: "MA",
  clanId: null,
  elo: 1000,
  division: "silver",
  seasonWins: 0,
  seasonLosses: 0,
};

function calculateLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

function generatePlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function mergeProfile(base: Partial<PlayerProfile>): PlayerProfile {
  return {
    ...defaultProfile,
    ...base,
    ownedSkins: [...new Set([...defaultProfile.ownedSkins, ...(base.ownedSkins || [])])],
    ownedBackgrounds: [...new Set([...defaultProfile.ownedBackgrounds, ...(base.ownedBackgrounds || [])])],
    ownedEmotes: [...new Set([...defaultProfile.ownedEmotes, ...(base.ownedEmotes || [])])],
    ownedEffects: [...new Set([...defaultProfile.ownedEffects, ...(base.ownedEffects || [])])],
    dailyShopBought: base.dailyShopBought || [],
    lastLoginRewardAt: base.lastLoginRewardAt || null,
    claimedLevelRewards: base.claimedLevelRewards || [],
    powerCards: base.powerCards
      ? { ...defaultProfile.powerCards, ...base.powerCards }
      : defaultProfile.powerCards,
    ownedTitles: [...new Set([...defaultProfile.ownedTitles, ...(base.ownedTitles || [])])] as TitleId[],
    equippedTitle: (base.equippedTitle as TitleId | null) ?? defaultProfile.equippedTitle,
    isVip: base.isVip ?? false,
    vipExpiresAt: base.vipExpiresAt ?? null,
  };
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile>(defaultProfile);
  const [playerId, setPlayerId] = useState<string>("");
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      // Hoisted so the finally block can always call setPlayerId even on error.
      let id = "";
      try {
        // ── Player ID ────────────────────────────────────────────────────────
        const storedId = await AsyncStorage.getItem(PLAYER_ID_KEY);
        if (storedId) {
          id = storedId;
        } else {
          id = generatePlayerId();
          await AsyncStorage.setItem(PLAYER_ID_KEY, id);
        }
        // NOTE: setPlayerId(id) is deliberately called in the finally block
        // BELOW, after the server sync completes.  This guarantees the player
        // profile exists on the Railway server before the tasks/achievements
        // React Query hooks fire (they are gated on !!playerId).

        // ── Local profile ────────────────────────────────────────────────────
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let parsed: Partial<PlayerProfile> | undefined;
        if (stored) {
          try { parsed = JSON.parse(stored); } catch { parsed = undefined; }
          setProfile(mergeProfile(parsed || {}));
        }

        // ── Welcome bonus (runs once, only for brand-new players) ─────────────
        // A player is "new" when there is no prior local profile AND the
        // first-launch flag has never been set.  Existing players who upgrade
        // to this version already have a saved profile, so they are skipped.
        const firstLaunchFlag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
        const isNewPlayer = !firstLaunchFlag && !stored;
        // Mark as launched regardless, so this block never runs again.
        if (!firstLaunchFlag) {
          await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "1");
        }

        // ── Server sync ──────────────────────────────────────────────────────
        try {
          const baseUrl = getApiUrl();
          const res = await fetch(new URL(`/api/player/${id}`, baseUrl).toString());
          if (res.ok) {
            const sp = await res.json();

            // For new players, override whatever coins the server has with the
            // starting bonus.  For returning players, keep the higher value.
            const serverCoins: number = isNewPlayer
              ? STARTING_COINS
              : Math.max(sp.coins ?? 0, parsed?.coins ?? 0);

            const merged: PlayerProfile = {
              name: sp.name || parsed?.name || defaultProfile.name,
              coins: serverCoins,
              xp: isNewPlayer ? 0 : Math.max(sp.xp ?? 0, parsed?.xp ?? 0),
              level: isNewPlayer ? 1 : Math.max(sp.level ?? 1, parsed?.level ?? 1),
              equippedSkin: sp.equippedSkin || parsed?.equippedSkin || defaultProfile.equippedSkin,
              ownedSkins: [...new Set([...(sp.ownedSkins || []), ...(parsed?.ownedSkins || []), "student"])] as SkinId[],
              totalScore: Math.max(sp.totalScore ?? 0, parsed?.totalScore ?? 0),
              gamesPlayed: Math.max(sp.gamesPlayed ?? 0, parsed?.gamesPlayed ?? 0),
              wins: Math.max(sp.wins ?? 0, parsed?.wins ?? 0),
              winStreak: sp.winStreak ?? 0,
              bestStreak: Math.max(sp.bestStreak ?? 0, parsed?.bestStreak ?? 0),
              lastStreakReward: sp.lastStreakReward ?? 0,
              lastSpinAt: sp.lastSpinAt || null,
              ownedBackgrounds: [...new Set([...(sp.ownedBackgrounds || []), ...(parsed?.ownedBackgrounds || []), "default"])] as BackgroundId[],
              equippedBackground: sp.equippedBackground || parsed?.equippedBackground || "default",
              ownedEmotes: [...new Set([...(sp.ownedEmotes || []), ...(parsed?.ownedEmotes || []), "laugh"])] as EmoteId[],
              ownedEffects: [...new Set([...(sp.ownedEffects || []), ...(parsed?.ownedEffects || []), "none"])] as EffectId[],
              equippedEffect: sp.equippedEffect || parsed?.equippedEffect || "none",
              dailyShopDate: sp.dailyShopDate || parsed?.dailyShopDate || null,
              dailyShopBought: sp.dailyShopBought || parsed?.dailyShopBought || [],
              powerCards: sp.powerCards
                ? { ...defaultProfile.powerCards, ...sp.powerCards }
                : (parsed?.powerCards ? { ...defaultProfile.powerCards, ...parsed.powerCards } : defaultProfile.powerCards),
              lastLoginRewardAt: parsed?.lastLoginRewardAt || null,
              claimedLevelRewards: parsed?.claimedLevelRewards || [],
              ownedTitles: [...new Set([...(sp.ownedTitles || []), ...(parsed?.ownedTitles || []), "beginner"])] as TitleId[],
              equippedTitle: sp.equippedTitle || parsed?.equippedTitle || "beginner",
              playerTag: sp.playerTag ?? parsed?.playerTag ?? null,
              isVip: sp.isVip ?? false,
              vipExpiresAt: sp.vipExpiresAt ?? null,
              elo: sp.elo ?? parsed?.elo ?? 1000,
              country: sp.country ?? parsed?.country ?? "MA",
              clanId: sp.clanId ?? parsed?.clanId ?? null,
              division: sp.division ?? parsed?.division ?? "bronze",
              seasonWins: sp.seasonWins ?? parsed?.seasonWins ?? 0,
              seasonLosses: sp.seasonLosses ?? parsed?.seasonLosses ?? 0,
            };

            setProfile(merged);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

            // Sync the starting bonus back to the server so the DB reflects it.
            if (isNewPlayer) {
              try {
                await fetch(new URL(`/api/player/${id}`, baseUrl).toString(), {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ coins: STARTING_COINS }),
                });
              } catch {}
            }
          } else if (isNewPlayer) {
            // Server unreachable on first launch — still give the bonus locally.
            const newProfile = mergeProfile({ coins: STARTING_COINS, xp: 0, level: 1 });
            setProfile(newProfile);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
          }
        } catch {
          if (isNewPlayer) {
            // Network error on first launch — initialize safely with bonus coins.
            const newProfile = mergeProfile({ coins: STARTING_COINS, xp: 0, level: 1 });
            setProfile(newProfile);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
          }
        }
      } catch {
        // Corrupted / missing data — initialize with a safe default profile.
        const safeProfile = mergeProfile({ coins: STARTING_COINS, xp: 0, level: 1 });
        setProfile(safeProfile);
        try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(safeProfile)); } catch {}
      } finally {
        // ── Set player ID AFTER server sync ──────────────────────────────────
        // This runs whether the try succeeded or threw.  By this point,
        // GET /api/player/:id has already run and created the player profile on
        // the server (or the call failed and we're offline).  Either way,
        // tasks/achievements queries won't fire before here because they are
        // gated on !!playerId.
        if (id) setPlayerId(id);
      }
    })();
  }, []);

  const saveProfile = async (p: PlayerProfile) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  };

  const debouncedSync = useCallback((p: PlayerProfile) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      if (!playerId) return;
      try {
        const baseUrl = getApiUrl();
        await fetch(new URL(`/api/player/${playerId}`, baseUrl).toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      } catch {}
    }, 2000);
  }, [playerId]);

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...updates };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  const addCoins = (amount: number) => {
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins + amount };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  // Calls the server purchase endpoint and reconciles the authoritative coin balance.
  // If the server rejects (insufficient_coins), the local state is reverted.
  const serverPurchase = useCallback(async (itemType: string, itemId: string, price: number) => {
    if (!playerId || price === 0) return;
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/player/${playerId}/purchase`, baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, price }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile((prev) => {
            const updated: PlayerProfile = { ...prev, coins: data.profile.coins };
            if (itemType === "skin" && Array.isArray(data.profile.ownedSkins)) {
              updated.ownedSkins = [...new Set([...prev.ownedSkins, ...(data.profile.ownedSkins as SkinId[])])] as SkinId[];
            }
            if (itemType === "title" && Array.isArray(data.profile.ownedTitles)) {
              updated.ownedTitles = [...new Set([...prev.ownedTitles, ...(data.profile.ownedTitles as TitleId[])])] as TitleId[];
            }
            saveProfile(updated);
            return updated;
          });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "insufficient_coins") {
          setProfile((prev) => {
            const reverted: PlayerProfile = { ...prev, coins: prev.coins + price };
            if (itemType === "skin") reverted.ownedSkins = prev.ownedSkins.filter((s) => s !== itemId) as SkinId[];
            if (itemType === "title") reverted.ownedTitles = prev.ownedTitles.filter((t) => t !== itemId) as TitleId[];
            saveProfile(reverted);
            debouncedSync(reverted);
            return reverted;
          });
        }
      }
    } catch {}
  }, [playerId]);

  const addXp = (amount: number) => {
    setProfile((prev) => {
      const newXp = prev.xp + amount;
      const newLevel = calculateLevel(newXp);
      let updated = { ...prev, xp: newXp, level: newLevel };

      // Check level reward milestones
      for (const milestone of LEVEL_REWARDS) {
        if (newLevel >= milestone.level && !updated.claimedLevelRewards.includes(milestone.level)) {
          updated = { ...updated, claimedLevelRewards: [...updated.claimedLevelRewards, milestone.level] };
          if (milestone.coins) {
            updated = { ...updated, coins: updated.coins + milestone.coins };
          }
          if (milestone.skinId && !updated.ownedSkins.includes(milestone.skinId)) {
            updated = { ...updated, ownedSkins: [...updated.ownedSkins, milestone.skinId] };
          }
        }
      }

      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  const purchaseSkin = (skinId: SkinId): boolean => {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return false;
    if (profile.ownedSkins.includes(skinId)) return true;

    if (skin.unlockCondition) {
      const { type, value } = skin.unlockCondition;
      const met =
        type === "wins"   ? profile.wins >= value :
        type === "level"  ? profile.level >= value :
        type === "streak" ? profile.bestStreak >= value : false;
      if (!met) return false;
      setProfile((prev) => {
        const updated = { ...prev, ownedSkins: [...prev.ownedSkins, skinId], equippedSkin: skinId };
        saveProfile(updated); debouncedSync(updated); return updated;
      });
      return true;
    }

    if (profile.coins < skin.price) return false;
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins - skin.price, ownedSkins: [...prev.ownedSkins, skinId], equippedSkin: skinId };
      saveProfile(updated); debouncedSync(updated); return updated;
    });
    serverPurchase("skin", skinId, skin.price);
    return true;
  };

  const equipSkin = (skinId: SkinId) => {
    if (!profile.ownedSkins.includes(skinId)) return;
    if (skinId.startsWith("vip_")) {
      const vipActive = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());
      if (!vipActive) return;
    }
    updateProfile({ equippedSkin: skinId });
  };

  const purchaseBackground = (id: BackgroundId): boolean => {
    const bg = BACKGROUNDS.find((b) => b.id === id);
    if (!bg) return false;
    if (profile.ownedBackgrounds.includes(id)) return true;
    if (profile.coins < bg.price) return false;
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins - bg.price, ownedBackgrounds: [...prev.ownedBackgrounds, id], equippedBackground: id };
      saveProfile(updated); debouncedSync(updated); return updated;
    });
    serverPurchase("background", id, bg.price);
    return true;
  };

  const equipBackground = (id: BackgroundId) => {
    if (!profile.ownedBackgrounds.includes(id)) return;
    updateProfile({ equippedBackground: id });
  };

  const purchaseEmote = (id: EmoteId): boolean => {
    const emote = EMOTES.find((e) => e.id === id);
    if (!emote) return false;
    if (profile.ownedEmotes.includes(id)) return true;
    if (profile.coins < emote.price) return false;
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins - emote.price, ownedEmotes: [...prev.ownedEmotes, id] };
      saveProfile(updated); debouncedSync(updated); return updated;
    });
    serverPurchase("emote", id, emote.price);
    return true;
  };

  const purchaseEffect = (id: EffectId): boolean => {
    const effect = EFFECTS.find((e) => e.id === id);
    if (!effect) return false;
    if (profile.ownedEffects.includes(id)) return true;
    if (profile.coins < effect.price) return false;
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins - effect.price, ownedEffects: [...prev.ownedEffects, id], equippedEffect: id };
      saveProfile(updated); debouncedSync(updated); return updated;
    });
    serverPurchase("effect", id, effect.price);
    return true;
  };

  const equipEffect = (id: EffectId) => {
    if (!profile.ownedEffects.includes(id)) return;
    updateProfile({ equippedEffect: id });
  };

  const grantItem = (type: "skin" | "background" | "emote" | "effect", id: string) => {
    setProfile((prev) => {
      let updated = { ...prev };
      if (type === "skin" && !prev.ownedSkins.includes(id as SkinId)) {
        updated = { ...updated, ownedSkins: [...prev.ownedSkins, id as SkinId] };
      } else if (type === "background" && !prev.ownedBackgrounds.includes(id as BackgroundId)) {
        updated = { ...updated, ownedBackgrounds: [...prev.ownedBackgrounds, id as BackgroundId] };
      } else if (type === "emote" && !prev.ownedEmotes.includes(id as EmoteId)) {
        updated = { ...updated, ownedEmotes: [...prev.ownedEmotes, id as EmoteId] };
      } else if (type === "effect" && !prev.ownedEffects.includes(id as EffectId)) {
        updated = { ...updated, ownedEffects: [...prev.ownedEffects, id as EffectId] };
      }
      saveProfile(updated); debouncedSync(updated); return updated;
    });
  };

  const buyDailyItem = (itemId: string, itemType: "skin" | "background" | "emote" | "effect", price: number): boolean => {
    if (profile.coins < price) return false;
    const today = new Date().toDateString();
    const alreadyBought = profile.dailyShopDate === today && profile.dailyShopBought.includes(itemId);
    if (alreadyBought) return false;

    setProfile((prev) => {
      const isNewDay = prev.dailyShopDate !== today;
      let updated: PlayerProfile = {
        ...prev,
        coins: prev.coins - price,
        dailyShopDate: today,
        dailyShopBought: isNewDay ? [itemId] : [...prev.dailyShopBought, itemId],
      };
      if (itemType === "skin" && !prev.ownedSkins.includes(itemId as SkinId))
        updated = { ...updated, ownedSkins: [...prev.ownedSkins, itemId as SkinId] };
      else if (itemType === "background" && !prev.ownedBackgrounds.includes(itemId as BackgroundId))
        updated = { ...updated, ownedBackgrounds: [...prev.ownedBackgrounds, itemId as BackgroundId] };
      else if (itemType === "emote" && !prev.ownedEmotes.includes(itemId as EmoteId))
        updated = { ...updated, ownedEmotes: [...prev.ownedEmotes, itemId as EmoteId] };
      else if (itemType === "effect" && !prev.ownedEffects.includes(itemId as EffectId))
        updated = { ...updated, ownedEffects: [...prev.ownedEffects, itemId as EffectId] };
      saveProfile(updated); debouncedSync(updated); return updated;
    });
    return true;
  };

  const setPlayerName = (name: string) => { updateProfile({ name }); };

  const useCard = (cardId: keyof PowerCards): boolean => {
    const currentCount = profile.powerCards[cardId];
    if (currentCount <= 0) return false;
    const newPowerCards: PowerCards = { ...profile.powerCards, [cardId]: currentCount - 1 };
    setProfile((prev) => {
      const updated = { ...prev, powerCards: newPowerCards };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
    return true;
  };

  const addPowerCard = (cardId: keyof PowerCards, count = 1) => {
    setProfile((prev) => {
      const updated = { ...prev, powerCards: { ...prev.powerCards, [cardId]: prev.powerCards[cardId] + count } };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  const equipTitle = (id: TitleId) => {
    if (!profile.ownedTitles.includes(id)) return;
    if (id === "vip_gold") {
      const vipActive = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());
      if (!vipActive) return;
    }
    updateProfile({ equippedTitle: id });
  };

  const purchaseTitle = (id: TitleId): boolean => {
    const title = TITLES.find((t) => t.id === id);
    if (!title) return false;
    if (profile.ownedTitles.includes(id)) {
      equipTitle(id);
      return true;
    }
    if (title.unlockCondition) {
      const { type, value } = title.unlockCondition;
      const met =
        type === "wins"   ? profile.wins >= value :
        type === "level"  ? profile.level >= value :
        type === "streak" ? profile.bestStreak >= value : false;
      if (!met) return false;
      setProfile((prev) => {
        const updated = { ...prev, ownedTitles: [...prev.ownedTitles, id], equippedTitle: id };
        saveProfile(updated); debouncedSync(updated); return updated;
      });
      return true;
    }
    if (profile.coins < title.price) return false;
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins - title.price, ownedTitles: [...prev.ownedTitles, id], equippedTitle: id };
      saveProfile(updated); debouncedSync(updated); return updated;
    });
    serverPurchase("title", id, title.price);
    return true;
  };

  const claimLoginReward = (): boolean => {
    const last = profile.lastLoginRewardAt ? new Date(profile.lastLoginRewardAt).getTime() : 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return false;
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins + 250, lastLoginRewardAt: new Date().toISOString() };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
    return true;
  };

  const syncToServer = async () => {
    if (!playerId) return;
    try {
      const baseUrl = getApiUrl();
      await fetch(new URL(`/api/player/${playerId}`, baseUrl).toString(), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
      });
    } catch {}
  };

  const reportGameResult = async (won: boolean, score: number, coinsEarned: number, xpEarned: number, coinEntry?: number): Promise<{ streakBonus: number; coinEntryReward: number }> => {
    if (!playerId) return { streakBonus: 0, coinEntryReward: 0 };
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/player/${playerId}/game-result`, baseUrl).toString(), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ won, score, coinsEarned, xpEarned, coinEntry }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const sp = data.profile;
          const merged: PlayerProfile = {
            name: sp.name || profile.name,
            coins: sp.coins ?? profile.coins,
            xp: sp.xp ?? profile.xp,
            level: sp.level ?? profile.level,
            equippedSkin: sp.equippedSkin || profile.equippedSkin,
            ownedSkins: [...new Set([...(sp.ownedSkins || []), ...profile.ownedSkins])] as SkinId[],
            totalScore: sp.totalScore ?? profile.totalScore,
            gamesPlayed: sp.gamesPlayed ?? profile.gamesPlayed,
            wins: sp.wins ?? profile.wins,
            winStreak: sp.winStreak ?? profile.winStreak,
            bestStreak: sp.bestStreak ?? profile.bestStreak,
            lastStreakReward: sp.lastStreakReward ?? profile.lastStreakReward,
            lastSpinAt: sp.lastSpinAt || profile.lastSpinAt,
            lastLoginRewardAt: sp.lastLoginRewardAt || profile.lastLoginRewardAt,
            claimedLevelRewards: [...new Set([...(sp.claimedLevelRewards || []), ...profile.claimedLevelRewards])],
            ownedBackgrounds: [...new Set([...(sp.ownedBackgrounds || []), ...profile.ownedBackgrounds])] as BackgroundId[],
            equippedBackground: sp.equippedBackground || profile.equippedBackground,
            ownedEmotes: [...new Set([...(sp.ownedEmotes || []), ...profile.ownedEmotes])] as EmoteId[],
            ownedEffects: [...new Set([...(sp.ownedEffects || []), ...profile.ownedEffects])] as EffectId[],
            equippedEffect: sp.equippedEffect || profile.equippedEffect,
            dailyShopDate: sp.dailyShopDate || profile.dailyShopDate,
            dailyShopBought: sp.dailyShopBought || profile.dailyShopBought,
            powerCards: sp.powerCards
              ? { ...defaultProfile.powerCards, ...sp.powerCards }
              : profile.powerCards,
            ownedTitles: [...new Set([...(sp.ownedTitles || []), ...profile.ownedTitles, "beginner"])] as TitleId[],
            equippedTitle: sp.equippedTitle || profile.equippedTitle || "beginner",
            playerTag: sp.playerTag ?? profile.playerTag,
            isVip: sp.isVip ?? profile.isVip ?? false,
            vipExpiresAt: sp.vipExpiresAt ?? profile.vipExpiresAt ?? null,
          };
          setProfile(merged);
          saveProfile(merged);
        }
        return { streakBonus: data.streakBonus || 0, coinEntryReward: data.coinEntryReward || 0 };
      }
    } catch {}
    const newStreak = won ? profile.winStreak + 1 : 0;
    let streakBonus = 0;
    if (won) {
      const milestones = [{ wins: 3, reward: 50 }, { wins: 5, reward: 100 }, { wins: 10, reward: 300 }];
      for (const m of milestones) {
        if (newStreak >= m.wins && m.wins > profile.lastStreakReward) streakBonus += m.reward;
      }
    }
    const netCoins = coinsEarned + streakBonus;
    updateProfile({
      coins: profile.coins + netCoins,
      xp: profile.xp + xpEarned,
      level: calculateLevel(profile.xp + xpEarned),
      totalScore: profile.totalScore + score,
      gamesPlayed: profile.gamesPlayed + 1,
      wins: won ? profile.wins + 1 : profile.wins,
      winStreak: newStreak,
      bestStreak: Math.max(newStreak, profile.bestStreak),
      lastStreakReward: won ? Math.max(profile.lastStreakReward, ...([3, 5, 10].filter(m => newStreak >= m))) : 0,
    });
    return { streakBonus, coinEntryReward: 0 };
  };

  return (
    <PlayerContext.Provider value={{
      profile, playerId, updateProfile, addCoins, addXp,
      purchaseSkin, equipSkin,
      purchaseBackground, equipBackground,
      purchaseEmote, purchaseEffect, equipEffect,
      grantItem, buyDailyItem,
      setPlayerName, syncToServer, reportGameResult, useCard,
      claimLoginReward, addPowerCard,
      purchaseTitle, equipTitle,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
