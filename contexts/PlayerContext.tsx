import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
};

type PlayerContextType = {
  profile: PlayerProfile;
  updateProfile: (updates: Partial<PlayerProfile>) => void;
  addCoins: (amount: number) => void;
  addXp: (amount: number) => void;
  purchaseSkin: (skinId: SkinId) => boolean;
  equipSkin: (skinId: SkinId) => void;
  setPlayerName: (name: string) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

const STORAGE_KEY = "player_profile_v2";

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
};

function calculateLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile>(defaultProfile);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setProfile(JSON.parse(stored));
        }
      } catch {}
    })();
  }, []);

  const saveProfile = async (p: PlayerProfile) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {}
  };

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...updates };
      saveProfile(updated);
      return updated;
    });
  };

  const addCoins = (amount: number) => {
    setProfile((prev) => {
      const updated = { ...prev, coins: prev.coins + amount };
      saveProfile(updated);
      return updated;
    });
  };

  const addXp = (amount: number) => {
    setProfile((prev) => {
      const newXp = prev.xp + amount;
      const updated = { ...prev, xp: newXp, level: calculateLevel(newXp) };
      saveProfile(updated);
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

  return (
    <PlayerContext.Provider
      value={{
        profile,
        updateProfile,
        addCoins,
        addXp,
        purchaseSkin,
        equipSkin,
        setPlayerName,
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
