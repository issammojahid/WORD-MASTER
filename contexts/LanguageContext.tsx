import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, Translations, translations, MapId } from "@/constants/i18n";

type LanguageContextType = {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  selectedMap: MapId;
  setSelectedMap: (map: MapId) => void;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [selectedMap, setSelectedMapState] = useState<MapId>("casablanca");

  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem("language");
        const storedMap = await AsyncStorage.getItem("selectedMap");
        if (storedLang === "ar" || storedLang === "en") {
          setLanguageState(storedLang);
        }
        if (storedMap) {
          setSelectedMapState(storedMap as MapId);
        }
      } catch {}
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem("language", lang);
  };

  const setSelectedMap = async (map: MapId) => {
    setSelectedMapState(map);
    await AsyncStorage.setItem("selectedMap", map);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        t: translations[language],
        setLanguage,
        isRTL: language === "ar",
        selectedMap,
        setSelectedMap,
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
