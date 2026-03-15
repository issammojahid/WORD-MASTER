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
  background: "#0A0A1A",
  backgroundSecondary: "#0E0E24",
  backgroundTertiary: "#14142E",
  card: "#12122A",
  cardBorder: "#1E1E3A",
  textPrimary: "#E8E8FF",
  textSecondary: "#9898CC",
  textMuted: "#5A5A88",
  inputBg: "#0E0E24",
  inputBorder: "#1E1E3A",
  inputBorderFocus: "#00F5FF",
  inputText: "#E8E8FF",
  inputPlaceholder: "#3A3A66",
  overlay: "rgba(0,0,0,0.85)",
  overlayLight: "rgba(10,10,26,0.92)",
  modalBg: "#0E0E24",
  statusBar: "light",
};

const lightColors: ThemeColors = {
  background: "#0A0A1A",
  backgroundSecondary: "#0E0E24",
  backgroundTertiary: "#14142E",
  card: "#12122A",
  cardBorder: "#1E1E3A",
  textPrimary: "#E8E8FF",
  textSecondary: "#9898CC",
  textMuted: "#5A5A88",
  inputBg: "#0E0E24",
  inputBorder: "#1E1E3A",
  inputBorderFocus: "#00F5FF",
  inputText: "#E8E8FF",
  inputPlaceholder: "#3A3A66",
  overlay: "rgba(0,0,0,0.85)",
  overlayLight: "rgba(10,10,26,0.92)",
  modalBg: "#0E0E24",
  statusBar: "light",
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
