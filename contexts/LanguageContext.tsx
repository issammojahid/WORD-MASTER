import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, Translations, translations } from "@/constants/i18n";

type LanguageContextType = {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  soundEffects: boolean;
  setSoundEffects: (v: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  audioPreferencesReady: boolean;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [soundEffects, setSoundEffectsState] = useState(true);
  const [musicEnabled, setMusicEnabledState] = useState(true);
  const [audioPreferencesReady, setAudioPreferencesReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem("language");
        const storedSfx  = await AsyncStorage.getItem("sound_effects");
        const storedMus  = await AsyncStorage.getItem("music_enabled");
        if (storedLang === "ar" || storedLang === "en") setLanguageState(storedLang);
        if (storedSfx !== null) setSoundEffectsState(storedSfx === "true");
        if (storedMus !== null) setMusicEnabledState(storedMus === "true");
      } catch (error) {
        if (__DEV__) console.warn("[preferences] unable to load language and audio settings", error);
      } finally {
        setAudioPreferencesReady(true);
      }
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem("language", lang);
  };

  const setSoundEffects = async (v: boolean) => {
    setSoundEffectsState(v);
    await AsyncStorage.setItem("sound_effects", String(v));
  };

  const setMusicEnabled = async (v: boolean) => {
    setMusicEnabledState(v);
    await AsyncStorage.setItem("music_enabled", String(v));
  };

  return (
    <LanguageContext.Provider
      value={{
        language, t: translations[language],
        setLanguage, isRTL: language === "ar",
        soundEffects, setSoundEffects,
        musicEnabled, setMusicEnabled,
        audioPreferencesReady,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
