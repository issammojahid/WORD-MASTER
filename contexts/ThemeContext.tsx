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
  background: "#100B24",
  backgroundSecondary: "#1A1033",
  backgroundTertiary: "#241047",
  card: "#1B1433",
  cardBorder: "#51406E",
  textPrimary: "#FFF8FF",
  textSecondary: "#D8C9EA",
  textMuted: "#B5A5CA",
  inputBg: "#140E29",
  inputBorder: "#594274",
  inputBorderFocus: "#22D9E5",
  inputText: "#FFF8FF",
  inputPlaceholder: "#B5A5CA",
  overlay: "rgba(8,4,20,0.78)",
  overlayLight: "rgba(16,11,36,0.97)",
  modalBg: "#21153B",
  statusBar: "light",
};

const lightColors: ThemeColors = {
  background: "#F5F1F7",
  backgroundSecondary: "#ECE5F1",
  backgroundTertiary: "#FFF6DC",
  card: "#FFFFFF",
  cardBorder: "#D5D0D2",
  textPrimary: "#33243B",
  textSecondary: "#62576A",
  textMuted: "#827A88",
  inputBg: "#FFFDF9",
  inputBorder: "#CFC7C3",
  inputBorderFocus: "#08A8D0",
  inputText: "#33243B",
  inputPlaceholder: "#827A88",
  overlay: "rgba(51,36,59,0.58)",
  overlayLight: "rgba(255,254,252,0.97)",
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
        if (val === "dark") setIsDark(true);
        else if (val === "light") setIsDark(false);
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
