import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameIcon, type GameIconName } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

type TabRoute = "/" | "/friends" | "/tasks" | "/achievements" | "/clans";

type Tab = {
  route: TabRoute;
  icon: GameIconName;
  label: string;
  color: string;
};

export function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isRTL, t } = useLanguage();
  const { theme } = useTheme();
  const tabs: Tab[] = [
    { route: "/clans", icon: "clans", label: t.clans, color: gameDesign.colors.clansText },
    { route: "/achievements", icon: "achievements", label: t.achievements, color: gameDesign.colors.achievementsText },
    { route: "/", icon: "home", label: isRTL ? "الرئيسية" : "Home", color: gameDesign.colors.onlineText },
    { route: "/tasks", icon: "missions", label: t.missions, color: gameDesign.colors.missionsText },
    { route: "/friends", icon: "friends", label: isRTL ? "الأصدقاء" : "Friends", color: gameDesign.colors.friendsText },
  ];
  const activeTab = pathname.startsWith("/chat")
    ? "/friends"
    : tabs.find((tab) => tab.route === pathname)?.route;

  if (!activeTab) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: theme.card,
          borderColor: "#51406E",
          paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 6 : 8),
          flexDirection: "row",
        },
      ]}
    >
      {tabs.map((tab) => {
        const selected = tab.route === activeTab;
        return (
          <Pressable
            key={tab.route}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => {
              if (!selected) router.replace(tab.route);
            }}
            style={({ pressed }) => [
              styles.tab,
              selected && tab.route !== "/" && {
                backgroundColor: `${tab.color}12`,
                borderColor: `${tab.color}55`,
              },
              selected && tab.route !== "/" && styles.selectedTab,
              pressed && !selected && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.iconFrame,
                tab.route === "/"
                  ? styles.homeIconFrame
                  : selected && { backgroundColor: `${tab.color}20`, borderColor: tab.color },
              ]}
            >
              <GameIcon
                name={tab.icon}
                size={tab.route === "/" ? 27 : selected ? 25 : 23}
                color={tab.route === "/" ? gameDesign.colors.onlineDeep : selected ? tab.color : theme.textMuted}
                secondaryColor={tab.route === "/" ? gameDesign.colors.onlineDeep : selected ? tab.color : theme.textMuted}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? tab.color : theme.textMuted },
                (selected || tab.route === "/") && styles.selectedLabel,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 560,
    minHeight: 76,
    marginBottom: 6,
    paddingTop: 5,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderRadius: 22,
    ...Platform.select({
      web: { boxShadow: "0 10px 24px rgba(5, 3, 17, 0.48)" },
      default: {
        shadowColor: "#080615",
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 9,
      },
    }),
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconFrame: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  selectedTab: { borderWidth: 1 },
  homeIconFrame: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: gameDesign.colors.coins,
    backgroundColor: gameDesign.colors.coins,
  },
  label: {
    maxWidth: "100%",
    fontFamily: gameDesign.typography.fontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  selectedLabel: {
    fontFamily: gameDesign.typography.fontFamily.bold,
  },
  pressed: {
    opacity: 0.72,
  },
});
