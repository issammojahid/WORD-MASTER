import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/network";
import { markStartupDuration, startupNow } from "@/lib/startup-performance";
import {
  DEFAULT_COSMETIC_INVENTORY,
  DEFAULT_EQUIPPED_COSMETICS,
  type CosmeticInventory,
  type EquippedCosmetics,
} from "@shared/cosmetics";

// ── Skins ────────────────────────────────────────────────────────────────────
export type SkinId =
  | "student" | "djellaba" | "sport" | "champion"
  | "kaftan" | "fassi" | "sahrawi" | "amazigh"
  | "ninja" | "astronaut" | "king" | "hacker" | "superhero"
  | "legend" | "elite" | "tourChamp"
  | "vip_phoenix" | "vip_sultan" | "vip_cyber";

// ── Backgrounds ───────────────────────────────────────────────────────────────
export type BackgroundId = "default" | "desert" | "space" | "city" | "marrakech" | "school";

// ── Emotes ────────────────────────────────────────────────────────────────────
export type EmoteId = "laugh" | "cool" | "fire" | "clap" | "angry";

// ── Victory Effects ────────────────────────────────────────────────────────────
export type EffectId = "none" | "confetti" | "fire_effect" | "stars" | "coins_burst";

// ── Titles ────────────────────────────────────────────────────────────────────
export type TitleId =
  | "beginner" | "eloquent" | "word_master" | "letter_king"
  | "morocco_legend" | "lightning" | "genius" | "streak_lord" | "champion_title"
  | "vip_gold";

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
  ownedCosmetics: CosmeticInventory;
  equippedCosmetics: EquippedCosmetics;
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
  // Country (null = not yet selected by the user)
  country: string | null;
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
  isReady: boolean;
  hasLocalProfileError: boolean;
  updateProfile: (updates: Partial<PlayerProfile>) => void;
  addCoins: (amount: number) => void;
  addXp: (amount: number) => void;
  setPlayerName: (name: string) => void;
  syncToServer: () => Promise<void>;
  reportGameResult: (won: boolean, score: number, coinsEarned: number, xpEarned: number) => Promise<{ streakBonus: number }>;
  consumeCard: (cardId: keyof PowerCards) => boolean;
  addPowerCard: (cardId: keyof PowerCards, count?: number) => void;
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
  ownedCosmetics: DEFAULT_COSMETIC_INVENTORY,
  equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
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
  country: null,
  clanId: null,
  elo: 1000,
  division: "silver",
  seasonWins: 0,
  seasonLosses: 0,
};

function xpForLevel(level: number): number {
  return 100 + (level - 1) * 70;
}

function calculateLevel(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

export function getXpProgress(xp: number): { current: number; needed: number; progress: number } {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  const needed = xpForLevel(level);
  return { current: remaining, needed, progress: needed > 0 ? remaining / needed : 0 };
}

function generatePlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function mergeProfile(base: Partial<PlayerProfile>): PlayerProfile {
  return {
    ...defaultProfile,
    ...base,
    ownedSkins: [...new Set([...defaultProfile.ownedSkins, ...(base.ownedSkins || [])])],
    ownedCosmetics: Object.fromEntries(
      Object.entries(DEFAULT_COSMETIC_INVENTORY).map(([kind, defaults]) => [
        kind,
        [...new Set([...defaults, ...(base.ownedCosmetics?.[kind as keyof CosmeticInventory] ?? [])])],
      ]),
    ) as CosmeticInventory,
    equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS, ...base.equippedCosmetics },
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
  const [isReady, setIsReady] = useState(false);
  const [hasLocalProfileError, setHasLocalProfileError] = useState(false);
  const profileRef = useRef(defaultProfile);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const hydrationStartedAt = startupNow();
      let localStateReady = false;
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
        // ── Local profile ────────────────────────────────────────────────────
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let parsed: Partial<PlayerProfile> | undefined;
        if (stored) {
          try { parsed = JSON.parse(stored); } catch { parsed = undefined; }
          if (parsed) parsed.level = calculateLevel(parsed.xp ?? 0);
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

        const localProfile = !stored && isNewPlayer
          ? mergeProfile({ coins: STARTING_COINS, xp: 0, level: 1 })
          : mergeProfile(parsed || {});
        parsed = localProfile;
        profileRef.current = localProfile;
        setProfile(localProfile);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localProfile));
        setPlayerId(id);
        setIsReady(true);
        localStateReady = true;
        markStartupDuration("player-local-state", hydrationStartedAt);

        // ── Server sync ──────────────────────────────────────────────────────
        const serverSyncStartedAt = startupNow();
        try {
          const baseUrl = getApiUrl();
          const res = await fetchWithTimeout(new URL(`/api/player/${id}`, baseUrl).toString());
          if (res.ok) {
            const sp = await res.json();
            const latestLocal = profileRef.current;

            // Merge against the latest local state so a game played while the
            // initial request is pending cannot lose its earned progress.
            const serverCoins: number = isNewPlayer
              ? Math.max(STARTING_COINS, latestLocal.coins)
              : Math.max(sp.coins ?? 0, latestLocal.coins);

            const merged: PlayerProfile = {
              name: latestLocal.name || sp.name || defaultProfile.name,
              coins: serverCoins,
              xp: isNewPlayer ? latestLocal.xp : Math.max(sp.xp ?? 0, latestLocal.xp),
              level: isNewPlayer ? latestLocal.level : calculateLevel(Math.max(sp.xp ?? 0, latestLocal.xp)),
              equippedSkin: latestLocal.equippedSkin || sp.equippedSkin || defaultProfile.equippedSkin,
              ownedSkins: [...new Set([...(sp.ownedSkins || []), ...latestLocal.ownedSkins, "student"])] as SkinId[],
              ownedCosmetics: Object.fromEntries(
                Object.entries(DEFAULT_COSMETIC_INVENTORY).map(([kind, defaults]) => [
                  kind,
                  [...new Set([
                    ...(sp.ownedCosmetics?.[kind] ?? defaults),
                    ...(latestLocal.ownedCosmetics[kind as keyof CosmeticInventory] ?? []),
                  ])],
                ]),
              ) as CosmeticInventory,
              equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS, ...sp.equippedCosmetics, ...latestLocal.equippedCosmetics },
              totalScore: Math.max(sp.totalScore ?? 0, latestLocal.totalScore),
              gamesPlayed: Math.max(sp.gamesPlayed ?? 0, latestLocal.gamesPlayed),
              wins: Math.max(sp.wins ?? 0, latestLocal.wins),
              winStreak: Math.max(sp.winStreak ?? 0, latestLocal.winStreak),
              bestStreak: Math.max(sp.bestStreak ?? 0, latestLocal.bestStreak),
              lastStreakReward: Math.max(sp.lastStreakReward ?? 0, latestLocal.lastStreakReward),
              lastSpinAt: latestLocal.lastSpinAt || sp.lastSpinAt || null,
              ownedBackgrounds: [...new Set([...(sp.ownedBackgrounds || []), ...latestLocal.ownedBackgrounds, "default"])] as BackgroundId[],
              equippedBackground: latestLocal.equippedBackground || sp.equippedBackground || "default",
              ownedEmotes: [...new Set([...(sp.ownedEmotes || []), ...latestLocal.ownedEmotes, "laugh"])] as EmoteId[],
              ownedEffects: [...new Set([...(sp.ownedEffects || []), ...latestLocal.ownedEffects, "none"])] as EffectId[],
              equippedEffect: latestLocal.equippedEffect || sp.equippedEffect || "none",
              dailyShopDate: latestLocal.dailyShopDate || sp.dailyShopDate || null,
              dailyShopBought: [...new Set([...(sp.dailyShopBought || []), ...latestLocal.dailyShopBought])],
              powerCards: sp.powerCards
                ? { ...defaultProfile.powerCards, ...latestLocal.powerCards, ...sp.powerCards }
                : latestLocal.powerCards,
              lastLoginRewardAt: latestLocal.lastLoginRewardAt || null,
              claimedLevelRewards: latestLocal.claimedLevelRewards,
              ownedTitles: [...new Set([...(sp.ownedTitles || []), ...latestLocal.ownedTitles, "beginner"])] as TitleId[],
              equippedTitle: latestLocal.equippedTitle || sp.equippedTitle || "beginner",
              playerTag: latestLocal.playerTag ?? sp.playerTag ?? null,
              isVip: sp.isVip ?? false,
              vipExpiresAt: sp.vipExpiresAt ?? null,
              elo: sp.elo ?? latestLocal.elo,
              country: latestLocal.country ?? sp.country ?? null,
              clanId: latestLocal.clanId ?? sp.clanId ?? null,
              division: latestLocal.division || sp.division || "bronze",
              seasonWins: Math.max(sp.seasonWins ?? 0, latestLocal.seasonWins),
              seasonLosses: Math.max(sp.seasonLosses ?? 0, latestLocal.seasonLosses),
            };

            profileRef.current = merged;
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
          }
          markStartupDuration("player-server-sync", serverSyncStartedAt);
        } catch {
          markStartupDuration("player-server-sync-unavailable", serverSyncStartedAt);
        }
      } catch {
        // Keep the game usable, but don't overwrite storage that could not be read.
        setHasLocalProfileError(true);
        const safeProfile = mergeProfile({ coins: STARTING_COINS, xp: 0, level: 1 });
        profileRef.current = safeProfile;
        setProfile(safeProfile);
      } finally {
        if (id) setPlayerId(id);
        if (!localStateReady) {
          setIsReady(true);
          markStartupDuration("player-local-fallback", hydrationStartedAt);
        }
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
      profileRef.current = updated;
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  const addCoins = (amount: number) => {
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins + amount };
      profileRef.current = updated;
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

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

      profileRef.current = updated;
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  const setPlayerName = (name: string) => { updateProfile({ name }); };

  const consumeCard = (cardId: keyof PowerCards): boolean => {
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

  const syncToServer = async () => {
    if (!playerId) return;
    try {
      const baseUrl = getApiUrl();
      await fetch(new URL(`/api/player/${playerId}`, baseUrl).toString(), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
      });
    } catch {}
  };

  const reportGameResult = async (won: boolean, score: number, coinsEarned: number, xpEarned: number): Promise<{ streakBonus: number }> => {
    if (!playerId) return { streakBonus: 0 };
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/player/${playerId}/game-result`, baseUrl).toString(), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ won, score, coinsEarned, xpEarned }),
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
            ownedCosmetics: Object.fromEntries(
              Object.entries(DEFAULT_COSMETIC_INVENTORY).map(([kind, defaults]) => [
                kind,
                [...new Set([
                  ...(sp.ownedCosmetics?.[kind] ?? defaults),
                  ...(profile.ownedCosmetics[kind as keyof CosmeticInventory] ?? []),
                ])],
              ]),
            ) as CosmeticInventory,
            equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS, ...sp.equippedCosmetics, ...profile.equippedCosmetics },
            totalScore: sp.totalScore ?? profile.totalScore,
            gamesPlayed: sp.gamesPlayed ?? profile.gamesPlayed,
            wins: sp.wins ?? profile.wins,
            winStreak: sp.winStreak ?? profile.winStreak,
            bestStreak: sp.bestStreak ?? profile.bestStreak,
            lastStreakReward: sp.lastStreakReward ?? profile.lastStreakReward,
            lastSpinAt: sp.lastSpinAt || profile.lastSpinAt,
            lastLoginRewardAt: sp.lastLoginRewardAt || profile.lastLoginRewardAt,
            claimedLevelRewards: [...new Set([...(sp.claimedLevelRewards || []), ...profile.claimedLevelRewards])],
            country: sp.country ?? profile.country ?? defaultProfile.country,
            clanId: sp.clanId ?? profile.clanId ?? defaultProfile.clanId,
            elo: sp.elo ?? profile.elo ?? defaultProfile.elo,
            division: sp.division ?? profile.division ?? defaultProfile.division,
            seasonWins: sp.seasonWins ?? profile.seasonWins ?? defaultProfile.seasonWins,
            seasonLosses: sp.seasonLosses ?? profile.seasonLosses ?? defaultProfile.seasonLosses,
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
        return { streakBonus: data.streakBonus || 0 };
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
    return { streakBonus };
  };

  return (
    <PlayerContext.Provider value={{
      profile, playerId, isReady, hasLocalProfileError, updateProfile, addCoins, addXp,
      setPlayerName, syncToServer, reportGameResult, consumeCard,
      addPowerCard,
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
