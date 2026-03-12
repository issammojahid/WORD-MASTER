import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

export type SkinId = "student" | "djellaba" | "sport" | "champion";

export type Skin = {
  id: SkinId;
  price: number;
  emoji: string;
  color: string;
};

export const SKINS: Skin[] = [
  { id: "student", price: 0, emoji: "🎓", color: "#3498DB" },
  { id: "djellaba", price: 150, emoji: "👘", color: "#8B2500" },
  { id: "sport", price: 200, emoji: "⚽", color: "#27AE60" },
  { id: "champion", price: 500, emoji: "🏆", color: "#F5A623" },
];

export type PlayerProfile = {
  name: string;
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
};

type PlayerContextType = {
  profile: PlayerProfile;
  playerId: string;
  updateProfile: (updates: Partial<PlayerProfile>) => void;
  addCoins: (amount: number) => void;
  addXp: (amount: number) => void;
  purchaseSkin: (skinId: SkinId) => boolean;
  equipSkin: (skinId: SkinId) => void;
  setPlayerName: (name: string) => void;
  syncToServer: () => Promise<void>;
  reportGameResult: (won: boolean, score: number, coinsEarned: number, xpEarned: number, coinEntry?: number) => Promise<{ streakBonus: number; coinEntryReward: number }>;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

const STORAGE_KEY = "player_profile_v3";
const PLAYER_ID_KEY = "player_id_v1";

const defaultProfile: PlayerProfile = {
  name: "لاعب",
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
};

function calculateLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

function generatePlayerId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile>(defaultProfile);
  const [playerId, setPlayerId] = useState<string>("");
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem(PLAYER_ID_KEY);
        if (!id) {
          id = generatePlayerId();
          await AsyncStorage.setItem(PLAYER_ID_KEY, id);
        }
        setPlayerId(id);

        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setProfile({ ...defaultProfile, ...parsed });
        }

        try {
          const baseUrl = getApiUrl();
          const res = await fetch(new URL(`/api/player/${id}`, baseUrl).toString());
          if (res.ok) {
            const serverProfile = await res.json();
            const merged: PlayerProfile = {
              name: serverProfile.name || parsed?.name || defaultProfile.name,
              coins: Math.max(serverProfile.coins ?? 0, parsed?.coins ?? 0),
              xp: Math.max(serverProfile.xp ?? 0, parsed?.xp ?? 0),
              level: Math.max(serverProfile.level ?? 1, parsed?.level ?? 1),
              equippedSkin: serverProfile.equippedSkin || parsed?.equippedSkin || defaultProfile.equippedSkin,
              ownedSkins: [...new Set([...(serverProfile.ownedSkins || []), ...(parsed?.ownedSkins || []), "student"])],
              totalScore: Math.max(serverProfile.totalScore ?? 0, parsed?.totalScore ?? 0),
              gamesPlayed: Math.max(serverProfile.gamesPlayed ?? 0, parsed?.gamesPlayed ?? 0),
              wins: Math.max(serverProfile.wins ?? 0, parsed?.wins ?? 0),
              winStreak: serverProfile.winStreak ?? 0,
              bestStreak: Math.max(serverProfile.bestStreak ?? 0, parsed?.bestStreak ?? 0),
              lastStreakReward: serverProfile.lastStreakReward ?? 0,
              lastSpinAt: serverProfile.lastSpinAt || null,
            };
            setProfile(merged);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
        } catch {}
      } catch {}
    })();
  }, []);

  const saveProfile = async (p: PlayerProfile) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {}
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

  const addXp = (amount: number) => {
    setProfile((prev) => {
      const newXp = prev.xp + amount;
      const updated = { ...prev, xp: newXp, level: calculateLevel(newXp) };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
  };

  const purchaseSkin = (skinId: SkinId): boolean => {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return false;
    if (profile.ownedSkins.includes(skinId)) return true;
    if (profile.coins < skin.price) return false;

    setProfile((prev) => {
      const updated = {
        ...prev,
        coins: prev.coins - skin.price,
        ownedSkins: [...prev.ownedSkins, skinId],
        equippedSkin: skinId,
      };
      saveProfile(updated);
      debouncedSync(updated);
      return updated;
    });
    return true;
  };

  const equipSkin = (skinId: SkinId) => {
    if (!profile.ownedSkins.includes(skinId)) return;
    updateProfile({ equippedSkin: skinId });
  };

  const setPlayerName = (name: string) => {
    updateProfile({ name });
  };

  const syncToServer = async () => {
    if (!playerId) return;
    try {
      const baseUrl = getApiUrl();
      await fetch(new URL(`/api/player/${playerId}`, baseUrl).toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
    } catch {}
  };

  const reportGameResult = async (won: boolean, score: number, coinsEarned: number, xpEarned: number, coinEntry?: number): Promise<{ streakBonus: number; coinEntryReward: number }> => {
    if (!playerId) return { streakBonus: 0, coinEntryReward: 0 };
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/player/${playerId}/game-result`, baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ won, score, coinsEarned, xpEarned, coinEntry }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const serverP = data.profile;
          const merged: PlayerProfile = {
            name: serverP.name || profile.name,
            coins: serverP.coins ?? profile.coins,
            xp: serverP.xp ?? profile.xp,
            level: serverP.level ?? profile.level,
            equippedSkin: serverP.equippedSkin || profile.equippedSkin,
            ownedSkins: [...new Set([...(serverP.ownedSkins || []), ...profile.ownedSkins])],
            totalScore: serverP.totalScore ?? profile.totalScore,
            gamesPlayed: serverP.gamesPlayed ?? profile.gamesPlayed,
            wins: serverP.wins ?? profile.wins,
            winStreak: serverP.winStreak ?? profile.winStreak,
            bestStreak: serverP.bestStreak ?? profile.bestStreak,
            lastStreakReward: serverP.lastStreakReward ?? profile.lastStreakReward,
            lastSpinAt: serverP.lastSpinAt || profile.lastSpinAt,
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
        if (newStreak >= m.wins && m.wins > profile.lastStreakReward) {
          streakBonus += m.reward;
        }
      }
    }
    updateProfile({
      coins: profile.coins + coinsEarned + streakBonus,
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
    <PlayerContext.Provider
      value={{
        profile,
        playerId,
        updateProfile,
        addCoins,
        addXp,
        purchaseSkin,
        equipSkin,
        setPlayerName,
        syncToServer,
        reportGameResult,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
