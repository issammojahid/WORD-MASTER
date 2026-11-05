import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { gameDesign } from "@/constants/game-design";
import { GameIcon } from "@/components/GameIcon";
import { AvatarArtwork } from "@/components/AvatarArtwork";
import { CosmeticArtwork } from "@/components/CosmeticArtwork";
import type { SkinId } from "@/contexts/PlayerContext";
import { getCosmetic } from "@shared/cosmetics";

export function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

export function GameScreenBackground({ accent = "online" }: { accent?: "online" | "offline" | "reward" }) {
  const { theme, isDark } = useTheme();
  const pixelColor = gameDesign.colors[accent === "reward" ? "coins" : accent];
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden", pointerEvents: "none" }]}>
      <LinearGradient
        colors={isDark ? ["#0D091C", "#1A102F", "#241047"] : [theme.background, theme.backgroundSecondary, theme.backgroundTertiary]}
        locations={[0, 0.56, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.ambientOrb, styles.ambientTop, { backgroundColor: pixelColor, opacity: isDark ? 0.08 : 0.05 }]} />
      <View style={[styles.ambientOrb, styles.ambientSide, { backgroundColor: gameDesign.colors.missions, opacity: isDark ? 0.05 : 0.03 }]} />
      <Svg
        width="100%"
        height={286}
        viewBox="0 0 400 286"
        preserveAspectRatio="xMidYMax slice"
        style={[styles.fantasyScene, { opacity: isDark ? 0.78 : 0.42 }]}
      >
        <Circle cx="312" cy="68" r="25" fill="#D9C6FF" opacity={0.14} />
        <Circle cx="312" cy="68" r="15" fill="#F5EFFF" opacity={0.62} />
        <Path d="M0 166 48 124l35 25 48-57 50 54 46-37 47 45 45-61 81 66v127H0Z" fill="#38215B" opacity={0.58} />
        <Path d="m0 194 64-46 43 29 55-42 55 47 46-30 47 38 47-42 43 28v141H0Z" fill="#24143F" opacity={0.8} />
        <Path d="M0 222c55-24 96-20 142 0 47-32 89-27 128-4 44-27 84-26 130-4v72H0Z" fill="#170F2D" />
        <Path d="M151 223v-46l19-14v-33l17 15v-24l14-17 14 17v24l17-15v33l19 14v46" fill="#120C24" stroke="#7D52B3" strokeOpacity={0.45} strokeWidth="2" />
        <Path d="M194 222v-34a18 18 0 0 1 36 0v34M207 177h10v13h-10z" fill="#251342" stroke="#A778E8" strokeOpacity={0.42} strokeWidth="2" />
        <Rect x="171" y="188" width="12" height="24" rx="6" fill="#22D9E5" opacity={0.23} />
        <Rect x="240" y="188" width="12" height="24" rx="6" fill="#F34FAE" opacity={0.2} />
        <Path d="M54 227V178m0 4c-15-2-22-12-24-25 14 1 23 8 26 20m-2-8c3-16 13-25 27-29 0 15-8 26-24 33m265 54v-46m0 2c-15-2-22-12-24-25 14 1 23 8 26 20m-2-8c3-16 13-25 27-29 0 15-8 26-24 33" fill="none" stroke="#120C24" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="79" cy="57" r="2" fill="#FFFFFF" opacity={0.8} />
        <Circle cx="122" cy="82" r="1.5" fill="#75F4F2" opacity={0.9} />
        <Circle cx="244" cy="43" r="2" fill="#F9D7FF" opacity={0.9} />
        <Circle cx="357" cy="115" r="1.5" fill="#FFFFFF" opacity={0.75} />
        <Path d="m96 107 3 6 6 2-6 2-3 6-2-6-6-2 6-2zm196 35 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#A879F0" opacity={0.75} />
      </Svg>
    </View>
  );
}

export function GameHeader({
  title,
  subtitle,
  onBack,
  trailing,
  icon,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { isRTL, t } = useLanguage();
  const backButton = onBack ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.back}
      onPress={onBack}
      style={({ pressed }) => [styles.backButton, { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: pressed ? 0.72 : 1 }]}
    >
      <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={21} color={theme.textPrimary} />
    </Pressable>
  ) : <View style={styles.headerSlot} />;

  return (
    <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      {backButton}
      <View style={[styles.headerCopy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <View style={[styles.headerTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {icon}
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>{title}</Text>
        </View>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing ?? <View style={styles.headerSlot} />}
    </View>
  );
}

export function GameCard({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: accent ? `${accent}55` : theme.cardBorder }, style]}>
      {children}
    </View>
  );
}

export function GameButton({
  children,
  label,
  onPress,
  disabled,
  variant = "primary",
  accent,
  style,
  ...props
}: PressableProps & {
  children?: React.ReactNode;
  label?: string;
  variant?: "primary" | "secondary" | "danger";
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color = accent ?? (variant === "danger" ? gameDesign.colors.danger
    : variant === "secondary" ? gameDesign.colors.online
    : gameDesign.colors.primary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variant === "secondary" ? `${color}1A` : color,
          borderColor: variant === "secondary" ? `${color}66` : color,
          opacity: disabled ? 0.45 : pressed ? 0.84 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        Platform.select({
          web: { boxShadow: disabled ? "none" : `0 7px 18px ${color}35` },
          default: {
            shadowColor: color,
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: disabled ? 0 : 0.24,
            shadowRadius: 9,
            elevation: disabled ? 0 : 4,
          },
        }),
        style,
      ]}
      {...props}
    >
      {children ?? <Text style={[styles.buttonText, { color: variant === "secondary" ? color : color === gameDesign.colors.primary ? gameDesign.colors.textPrimary : "#FFFFFF" }]}>{label}</Text>}
    </Pressable>
  );
}

export const GameInput = React.forwardRef<TextInput, TextInputProps>(function GameInput(props, ref) {
  const { theme } = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.inputPlaceholder}
      {...props}
      style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }, props.style]}
    />
  );
});

export function PlayerAvatar({
  size = 48,
  accessibilityLabel,
  skinId = "student",
  frameId = "classic",
}: {
  size?: number;
  accessibilityLabel?: string;
  skinId?: SkinId;
  frameId?: string;
}) {
  const frameColor = getCosmetic("frame", frameId)?.colors[0] ?? gameDesign.colors.profile;
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size * 0.36,
          borderColor: frameId === "basic_frame" ? `${gameDesign.colors.profile}40` : frameColor,
          borderWidth: frameId === "basic_frame" ? 1 : 3,
        },
      ]}
    >
      <AvatarArtwork skinId={skinId} size={frameId === "basic_frame" ? size : size * 0.78} />
      {frameId !== "basic_frame" ? (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
          <CosmeticArtwork kind="frame" itemId={frameId} size={size} />
        </View>
      ) : null}
    </View>
  );
}

export function VictoryCosmeticEffect({ effectId }: { effectId: string }) {
  if (effectId === "none" || effectId === "no_victory_effect") return null;
  return (
    <View accessible accessibilityLabel="Victory cosmetic effect" style={styles.victoryEffect}>
      <CosmeticArtwork kind="victory" itemId={effectId} size={46} />
    </View>
  );
}

export function CoinBalance({ amount, label, compact = false }: { amount: number; label?: string; compact?: boolean }) {
  const { theme } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label ?? "Coins"}: ${amount}`} style={[styles.coinBalance, compact && styles.compactCoinBalance]}>
      <GameIcon name="coins" size={compact ? 17 : 21} color={gameDesign.colors.coins} secondaryColor="#FFE2A3" />
      <Text style={[styles.coinAmount, compact && styles.compactCoinAmount, { color: theme.textPrimary }]}>{amount.toLocaleString()}</Text>
    </View>
  );
}

export function RewardCard({ title, amount, icon = "reward" }: { title: string; amount: string; icon?: "reward" | "victory" }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.rewardCard, { backgroundColor: `${gameDesign.colors.coins}12`, borderColor: `${gameDesign.colors.coins}45` }]}>
      <GameIcon name="coins" size={24} color={gameDesign.colors.coins} />
      <View style={styles.rewardCopy}>
        <Text style={[styles.rewardTitle, { color: theme.textSecondary }]}>{title}</Text>
        <Text style={[styles.rewardAmount, { color: gameDesign.colors.coins }]}>{amount}</Text>
      </View>
      {icon === "victory" ? <Ionicons name="sparkles" size={18} color={gameDesign.colors.coins} /> : null}
    </View>
  );
}

export function StatusBadge({ label, tone = "success" }: { label: string; tone?: "success" | "warning" | "danger" | "neutral" }) {
  const color = tone === "danger" ? gameDesign.colors.danger
    : tone === "warning" ? gameDesign.colors.coins
    : tone === "neutral" ? gameDesign.colors.textMuted
    : gameDesign.colors.success;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}45` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description, icon = "dailyChallenge" }: { title: string; description?: string; icon?: "missions" | "achievements" | "dailyChallenge" | "friends" | "clans" }) {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <GameIcon name={icon} size={38} color={gameDesign.colors[icon]} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{title}</Text>
      {description ? <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>{description}</Text> : null}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={gameDesign.colors.online} />
      <Text style={[styles.loadingLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function GameModal({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modal, { backgroundColor: theme.modalBg, borderColor: theme.cardBorder }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ambientOrb: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  ambientTop: { top: -130, right: -72 },
  ambientSide: { top: "38%", left: -150 },
  fantasyScene: { position: "absolute", bottom: 0, left: 0 },
  header: { minHeight: 68, alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  backButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerSlot: { width: 46, height: 46 },
  headerCopy: { flex: 1, gap: 2 },
  headerTitleRow: { alignItems: "center", gap: 8 },
  headerTitle: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 19, lineHeight: 27 },
  headerSubtitle: { fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12, overflow: "hidden", shadowColor: "#080615", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  button: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 15 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 15 },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: `${gameDesign.colors.profile}18`, borderWidth: 1, borderColor: `${gameDesign.colors.profile}40` },
  victoryEffect: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coinBalance: { flexDirection: "row", alignItems: "center", gap: 7 },
  compactCoinBalance: { gap: 4 },
  coinAmount: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 16 },
  compactCoinAmount: { fontSize: 13 },
  rewardCard: { minHeight: 64, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  rewardCopy: { flex: 1, gap: 2 },
  rewardTitle: { fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 12 },
  rewardAmount: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 17 },
  badge: { minHeight: 30, borderRadius: 15, borderWidth: 1, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: gameDesign.typography.fontFamily.semibold, fontSize: 12 },
  emptyState: { flex: 1, minHeight: 190, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: `${gameDesign.colors.online}18` },
  emptyTitle: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 17, textAlign: "center" },
  emptyDescription: { fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 14, lineHeight: 21, textAlign: "center" },
  loadingState: { flex: 1, minHeight: 150, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingLabel: { fontFamily: gameDesign.typography.fontFamily.semibold, fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 440, maxHeight: "90%", borderRadius: 22, borderWidth: 1, padding: 20, gap: 12 },
});
