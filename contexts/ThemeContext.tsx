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
  background: "#180C27",
  backgroundSecondary: "#261435",
  backgroundTertiary: "#352044",
  card: "#30203F",
  cardBorder: "#B38C57",
  textPrimary: "#FFF0D6",
  textSecondary: "#E1CFEA",
  textMuted: "#BDABCD",
  inputBg: "#241333",
  inputBorder: "#92704F",
  inputBorderFocus: "#39CFC5",
  inputText: "#FFF0D6",
  inputPlaceholder: "#BDABCD",
  overlay: "rgba(10,4,20,0.86)",
  overlayLight: "rgba(24,12,39,0.97)",
  modalBg: "#30203F",
  statusBar: "light",
};

const lightColors: ThemeColors = {
  background: "#F7EEDA",
  backgroundSecondary: "#F0E2CB",
  backgroundTertiary: "#EAD9C4",
  card: "#FFF8EC",
  cardBorder: "#B18A55",
  textPrimary: "#352044",
  textSecondary: "#695071",
  textMuted: "#806C88",
  inputBg: "#FFFBF3",
  inputBorder: "#BE9A69",
  inputBorderFocus: "#087F8C",
  inputText: "#352044",
  inputPlaceholder: "#806C88",
  overlay: "rgba(51,36,59,0.58)",
  overlayLight: "rgba(255,254,252,0.97)",
  modalBg: "#FFF8EC",
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
