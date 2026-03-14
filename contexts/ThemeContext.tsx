import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "app_theme_v1";

export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  inputText: string;
  inputPlaceholder: string;
  overlay: string;
  overlayLight: string;
  modalBg: string;
  statusBar: "light" | "dark";
};

const darkColors: ThemeColors = {
  background: "#0D1B2A",
  backgroundSecondary: "#142233",
  backgroundTertiary: "#1A2D42",
  card: "#1E3448",
  cardBorder: "#2A4560",
  textPrimary: "#F0E6D3",
  textSecondary: "#A8B8CC",
  textMuted: "#6B7E91",
  inputBg: "#162840",
  inputBorder: "#2A4560",
  inputBorderFocus: "#F5A623",
  inputText: "#F0E6D3",
  inputPlaceholder: "#4A6278",
  overlay: "rgba(0,0,0,0.75)",
  overlayLight: "rgba(13,27,42,0.85)",
  modalBg: "#160D33",
  statusBar: "light",
};

const lightColors: ThemeColors = {
  background: "#F2F2F7",
  backgroundSecondary: "#E8E8ED",
  backgroundTertiary: "#DDDDE2",
  card: "#FFFFFF",
  cardBorder: "#D6D6DB",
  textPrimary: "#1C1C2E",
  textSecondary: "#5A5A72",
  textMuted: "#8E8EA0",
  inputBg: "#F0F0F5",
  inputBorder: "#D0D0D8",
  inputBorderFocus: "#F5A623",
  inputText: "#1C1C2E",
  inputPlaceholder: "#A0A0B0",
  overlay: "rgba(0,0,0,0.45)",
  overlayLight: "rgba(255,255,255,0.90)",
  modalBg: "#FFFFFF",
  statusBar: "dark",
};

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  theme: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  theme: darkColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === "light") setIsDark(false);
      })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? "dark" : "light").catch(() => {});
      return next;
    });
  }, []);

  const theme = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
