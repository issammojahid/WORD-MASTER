import React from "react";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FantasyHomeDock } from "@/components/FantasyHome";

export function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const visible = ["/", "/tasks", "/achievements", "/store", "/friends", "/clans", "/profile", "/settings", "/daily-challenge", "/spin", "/halloween"].includes(pathname) || pathname.startsWith("/chat/");
  if (!visible) return null;
  return <FantasyHomeDock bottomInset={insets.bottom} pathname={pathname} />;
}
