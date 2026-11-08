import {ScaledText as Text} from "@/components/ScaledText";
import {RoyalBrand,RoyalSurface} from "./RoyalUi";
import {usePlayer} from "@/contexts/PlayerContext";
import {useInterfacePreferences} from "@/lib/interface-preferences";
import React, { useEffect, useState } from "react";
import {ActivityIndicator, AccessibilityInfo, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type PressableProps, type TextInputProps, type ViewStyle} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, Pattern, Rect } from "react-native-svg";
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
  const preferences=useInterfacePreferences();
  return reduceMotion||preferences.reduceMotion||preferences.quality==="low";
}

export function GameScreenBackground(_props: { accent?: "online" | "offline" | "reward" }) {
  const { theme, isDark } = useTheme();
  const preferences=useInterfacePreferences();
  const art = require("../assets/ui-2027/royal-courtyard.png");
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
    <LinearGradient colors={[theme.background, theme.backgroundSecondary, theme.backgroundTertiary]} style={StyleSheet.absoluteFill} />
    {preferences.quality!=="low"&&<Image source={art} resizeMode="cover" style={{position:"absolute",top:0,left:0,width:"100%",height:360,opacity:isDark?1:0.25}} />}
    <LinearGradient colors={isDark?["#17154000","#17153BB0","#171437"]:["#F7EEDA55","#F7EEDACC","#F7EEDA"]} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
    <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs><Pattern id="royal-edge-zellige" width="30" height="30" patternUnits="userSpaceOnUse"><Path d="M15 1l4 8 10 6-10 4-4 10-4-10L1 15l10-6zM0 0l30 30M30 0L0 30" fill="none" stroke="#D5AE69" strokeWidth=".9" opacity=".6"/></Pattern></Defs><Rect x="0" y="0" width="16" height="800" fill="url(#royal-edge-zellige)"/><Rect x="384" y="0" width="16" height="800" fill="url(#royal-edge-zellige)"/>
      <Path d="M10 130V48q0-20 20-20h54M390 130V48q0-20-20-20h-54M10 670v80q0 22 22 22h50M390 670v80q0 22-22 22h-50" fill="none" stroke={isDark?"#D5AE69":"#A97D45"} strokeWidth="1" opacity="0.35" />
      <Path d="m10 150 4 7-4 7-4-7zM390 150l4 7-4 7-4-7zM10 644l4 7-4 7-4-7zM390 644l4 7-4 7-4-7z" fill="#D5AE69" opacity="0.5" />
    </Svg>
  </View>;
}

export function GameHeader({title,subtitle,onBack,trailing,icon,compact=false,brand=true}:{title:string;subtitle?:string;onBack?:()=>void;trailing?:React.ReactNode;icon?:React.ReactNode;compact?:boolean;brand?:boolean}) {
 const {theme}=useTheme(),{isRTL,t}=useLanguage(),{profile}=usePlayer();
 const back=onBack?<Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={onBack} style={{width:44,minHeight:44,alignItems:"center",justifyContent:"center",borderRadius:13,borderWidth:1.5,borderColor:"#E1BB76",backgroundColor:"#242044"}}><Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={26} color="#FFE4A0"/></Pressable>:<View style={{width:44}}/>;
 if(compact)return <RoyalSurface style={{marginHorizontal:10,marginBottom:8,paddingVertical:6,flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:9,minHeight:62}}>{back}<View style={{flex:1}}><Text style={{fontFamily:"Cairo_700Bold",fontSize:17,color:theme.textPrimary,textAlign:isRTL?"right":"left"}}>{title}</Text>{subtitle?<Text style={{fontFamily:"Cairo_400Regular",fontSize:10,color:theme.textSecondary,textAlign:isRTL?"right":"left"}}>{subtitle}</Text>:null}</View>{trailing}</RoyalSurface>;
 return <View style={{paddingHorizontal:14,paddingBottom:8,gap:3}}>
  {brand&&<View style={{height:100,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><View style={{width:58,alignItems:"center"}}><PlayerAvatar size={49} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/><View style={{borderRadius:8,borderWidth:1,borderColor:"#EECC7A",backgroundColor:"#116C79",paddingHorizontal:7,marginTop:-7}}><Text style={{fontFamily:"Cairo_700Bold",fontSize:10,color:"#FFF0CB"}}>{profile.level}</Text></View></View><RoyalBrand width={150}/><View style={{width:58,alignItems:"flex-end"}}>{back}</View></View>}
  <RoyalSurface style={{minHeight:49,paddingVertical:4,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:7}}><View style={{minWidth:25}}>{!brand?back:icon??<Text style={{fontSize:21,color:"#E5BE72"}}>✧</Text>}</View><Text accessibilityRole="header" style={{flex:1,fontFamily:"Cairo_700Bold",fontSize:22,textAlign:"center",color:"#FFF0D6"}}>{title}</Text>{trailing??<Text style={{fontSize:21,color:"#E5BE72"}}>✧</Text>}</RoyalSurface>
  {subtitle?<Text style={{fontFamily:"Cairo_600SemiBold",fontSize:11,color:"#EDE0C6",textAlign:"center",paddingTop:2}}>{subtitle}</Text>:null}
 </View>;
}

export function GameCard({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: accent ? `${accent}AA` : theme.cardBorder }, style]}>
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
      {children ?? <Text style={[styles.buttonText, { color: variant === "secondary" ? color : color === gameDesign.colors.primary ? "#271537" : "#FFFFFF" }]}>{label}</Text>}
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
      <AvatarArtwork transparent skinId={skinId} size={frameId === "basic_frame" ? size : size * 0.78} />
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
    <View accessible accessibilityLabel={`${label ?? "العملات"}: ${amount}`} style={[styles.coinBalance, compact && styles.compactCoinBalance]}>
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
          <ScrollView style={{flexShrink:1}} contentContainerStyle={{gap:12}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
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
  card: { borderWidth: 1.5, borderRadius: 22, padding: 18, gap: 12, overflow: "hidden", shadowColor: "#080615", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
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
