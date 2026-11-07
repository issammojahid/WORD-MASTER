import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import { AvatarArtwork } from "@/components/AvatarArtwork";
import { CosmeticArtwork } from "@/components/CosmeticArtwork";
import { HalloweenAvatar, HalloweenCategory, HalloweenProfileLook, useHalloweenAppearance } from "@/components/HalloweenAppearance";
import { HalloweenAccountStatus, HalloweenEntry } from "@/components/HalloweenEconomy";
import { GameIcon } from "@/components/GameIcon";
import { CoinBalance, GameHeader, GameModal, GameScreenBackground, PlayerAvatar, useReducedMotion } from "@/components/GameUi";
import {
  AVATAR_CATALOG,
  COSMETIC_CATALOG,
  COSMETIC_KINDS,
  getAvatarCosmetic,
  type CosmeticKind,
} from "@shared/cosmetics";
import { gameDesign } from "@/constants/game-design";
import type { SkinId } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getApiUrl } from "@/lib/query-client";

const COPY = {
  ar: {
    title: "متجر المظاهر",
    subtitle: "اختر المظاهر التي تعبّر عن أسلوبك",
    heading: "شخصيات وإطارات",
    description: "مظاهر تجميلية فقط؛ ما كتأثرش على قواعد اللعب أو النقاط.",
    skins: "الشخصيات",
    frame: "الإطارات",
    background: "الخلفيات",
    nameplate: "لوحات الاسم",
    victory: "تأثيرات الفوز",
    seasonal: "موسمية",
    profileLook: "معاينة المظهر",
    equippedLook: "مجهز في الملف الشخصي",
    confirmTitle: "تأكيد الشراء",
    confirmBody: "سيُخصم هذا المبلغ من رصيدك بعد تأكيد الشراء.",
    cancel: "إلغاء",
    confirmPurchase: "تأكيد الشراء",
    seasonalNote: "مجموعة مستوحاة من مواسم ومناسبات مختلفة.",
    basic_frame: "الإطار الأساسي",
    basic_frameDesc: "الإطار البسيط الأصلي",
    basic_background: "الخلفية الأساسية",
    basic_backgroundDesc: "ألوان اللعبة الأصلية",
    basic_nameplate: "لوحة الاسم الأساسية",
    basic_nameplateDesc: "لوحة الاسم الأصلية",
    no_victory_effect: "دون تأثير",
    no_victory_effectDesc: "العودة إلى عرض الفوز الأصلي",
    no_seasonal: "دون زينة موسمية",
    no_seasonalDesc: "إزالة الزينة الموسمية",
    student: "صاحب الحروف",
    djellaba: "الرحّال",
    sport: "السريع",
    amazigh: "نجمة الأطلس",
    astronaut: "مستكشف الفضاء",
    ninja: "ظلّ الحروف",
    king: "ملك الكلمات",
    studentDesc: "شخصيتك الأصلية",
    djellabaDesc: "ألوان دافئة ولمعة ذهبية",
    sportDesc: "طاقة وردية وإطار رياضي",
    amazighDesc: "ألوان الأطلس ونقوش هندسية",
    astronautDesc: "خوذة فضائية ولمعة بنفسجية",
    ninjaDesc: "قناع غامض وهالة بنفسجية",
    kingDesc: "تاج ذهبي وتأثير ملكي",
    mosaic_frame: "فسيفساء الأطلس",
    mosaic_frameDesc: "إطار هندسي بألوان مغربية",
    atlas_frame: "إطار الأطلس",
    atlas_frameDesc: "لمسة ذهبية مستوحاة من الجبال",
    aurora_frame: "الشفق البنفسجي",
    aurora_frameDesc: "هالة بنفسجية أنيقة",
    marrakech_bg: "ليالي مراكش",
    marrakech_bgDesc: "ألوان دافئة مستوحاة من المدينة الحمراء",
    atlas_night_bg: "ليل الأطلس",
    atlas_night_bgDesc: "سماء جبلية هادئة",
    zellige_bg: "زليج أخضر",
    zellige_bgDesc: "نقوش هندسية خضراء",
    calligraphy_plate: "خطّاط",
    calligraphy_plateDesc: "لوحة اسم بلمسة بنفسجية",
    gold_plate: "الذهبي",
    gold_plateDesc: "لوحة أنيقة بلمعة ذهبية",
    emerald_plate: "زمردي",
    emerald_plateDesc: "ألوان زمردية هادئة",
    starlight: "ضوء النجوم",
    starlightDesc: "وميض نجوم عند الفوز",
    confetti: "قصاصات احتفال",
    confettiDesc: "ألوان احتفالية عند الفوز",
    golden_burst: "انفجار ذهبي",
    golden_burstDesc: "لمعة ذهبية خفيفة عند الفوز",
    ramadan_lantern: "فانوس رمضان",
    ramadan_lanternDesc: "زخرفة موسمية مستوحاة من الفوانيس",
    eid_mosaic: "زليج العيد",
    eid_mosaicDesc: "نقوش احتفالية مستوحاة من الزليج",
    atlas_winter: "شتاء الأطلس",
    atlas_winterDesc: "ألوان باردة مستوحاة من قمم الأطلس",
    equipped: "مجهز",
    owned: "مملوك",
    notOwned: "غير مملوك",
    equip: "جهّز",
    buy: "شراء",
    coins: "عملات",
    insufficient: "رصيدك غير كافٍ لشراء هذا المظهر.",
    networkError: "تعذر إكمال الشراء. تحقق من اتصالك وحاول مجدداً.",
    purchaseSuccess: "تم شراء المظهر وإضافته إلى حسابك.",
    equipSuccess: "تم تحديث مظهرك.",
    preview: "مظهرك",
    previewing: "معاينة",
    onlineNote: "يتطلب الشراء اتصالاً بالإنترنت. يمكنك تجهيز المظاهر المملوكة دون اتصال.",
  },
  en: {
    title: "Cosmetic Store",
    subtitle: "Make your profile feel like yours",
    heading: "Avatars & frames",
    description: "Cosmetics only. They never change game rules, scoring, or rewards.",
    skins: "Avatars",
    frame: "Frames",
    background: "Backgrounds",
    nameplate: "Nameplates",
    victory: "Victory effects",
    seasonal: "Seasonal",
    profileLook: "Preview",
    equippedLook: "Equipped on profile",
    confirmTitle: "Confirm purchase",
    confirmBody: "This amount will be deducted from your balance when you confirm.",
    cancel: "Cancel",
    confirmPurchase: "Confirm purchase",
    seasonalNote: "A themed collection inspired by Moroccan seasons and celebrations.",
    basic_frame: "Classic Frame",
    basic_frameDesc: "The original simple frame",
    basic_background: "Classic Background",
    basic_backgroundDesc: "The game's original colors",
    basic_nameplate: "Classic Nameplate",
    basic_nameplateDesc: "The original nameplate",
    no_victory_effect: "No Effect",
    no_victory_effectDesc: "Use the original victory presentation",
    no_seasonal: "No Seasonal Ornament",
    no_seasonalDesc: "Remove the seasonal decoration",
    student: "Letter Buddy",
    djellaba: "The Traveler",
    sport: "The Sprinter",
    amazigh: "Atlas Star",
    astronaut: "Space Explorer",
    ninja: "Word Shadow",
    king: "Word King",
    studentDesc: "Your original character",
    djellabaDesc: "Warm colors with a golden glow",
    sportDesc: "Energetic colors and a sporty frame",
    amazighDesc: "Atlas-inspired colors and geometry",
    astronautDesc: "Space helmet with a violet shine",
    ninjaDesc: "A mysterious mask and violet aura",
    kingDesc: "Golden crown and royal accent",
    mosaic_frame: "Atlas Mosaic",
    mosaic_frameDesc: "A geometric frame in Moroccan colors",
    atlas_frame: "Atlas Frame",
    atlas_frameDesc: "A golden touch inspired by the mountains",
    aurora_frame: "Violet Aurora",
    aurora_frameDesc: "A soft violet halo",
    marrakech_bg: "Marrakech Nights",
    marrakech_bgDesc: "Warm colors inspired by the red city",
    atlas_night_bg: "Atlas at Night",
    atlas_night_bgDesc: "A calm mountain sky",
    zellige_bg: "Emerald Zellige",
    zellige_bgDesc: "Green geometric patterns",
    calligraphy_plate: "Calligrapher",
    calligraphy_plateDesc: "A nameplate with a violet finish",
    gold_plate: "Golden",
    gold_plateDesc: "A polished golden nameplate",
    emerald_plate: "Emerald",
    emerald_plateDesc: "A calm emerald nameplate",
    starlight: "Starlight",
    starlightDesc: "A starry glow when you win",
    confetti: "Celebration",
    confettiDesc: "A colorful win effect",
    golden_burst: "Golden Burst",
    golden_burstDesc: "A subtle golden win effect",
    ramadan_lantern: "Ramadan Lantern",
    ramadan_lanternDesc: "A seasonal lantern-inspired ornament",
    eid_mosaic: "Eid Mosaic",
    eid_mosaicDesc: "A festive zellige-inspired design",
    atlas_winter: "Atlas Winter",
    atlas_winterDesc: "Cool colors inspired by Atlas peaks",
    equipped: "Equipped",
    owned: "Owned",
    notOwned: "Not owned",
    equip: "Equip",
    buy: "Buy",
    coins: "coins",
    insufficient: "You don't have enough coins for this look.",
    networkError: "Purchase failed. Check your connection and try again.",
    purchaseSuccess: "Look purchased and added to your collection.",
    equipSuccess: "Your look has been updated.",
    preview: "Your look",
    previewing: "Preview",
    onlineNote: "Purchases need an internet connection. Owned looks can be equipped offline.",
  },
} as const;

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isRTL, language } = useLanguage();
  const { profile, playerId, updateProfile } = usePlayer();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const text = COPY[language];
  const halloween = useHalloweenAppearance();
  const collectionScroll = useRef<ScrollView>(null);
  const [legacyPreview, setLegacyPreview] = useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  useEffect(() => { setLegacyPreview(false); }, [halloween.equipmentKey]);
  const showHalloween = halloween.active && !legacyPreview;
  const [selectedKind, setSelectedKind] = useState<"skin" | CosmeticKind>("skin");
  const [selectedItemId, setSelectedItemId] = useState<string>(profile.equippedSkin);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{ id: string; kind: "skin" | CosmeticKind; price: number } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const previewScale = useRef(new Animated.Value(1)).current;
  const columns = width >= 648 ? 5 : width >= 452 ? 4 : width >= 372 ? 3 : 2;
  const horizontalPadding = width >= 600 ? 24 : 16;
  const cardWidth = useMemo(
    () => (Math.min(width, 760) - horizontalPadding * 2 - 8 * (columns - 1)) / columns,
    [columns, horizontalPadding, width],
  );
  const products = selectedKind === "skin"
    ? AVATAR_CATALOG.map((item) => ({ ...item, kind: "skin" as const, icon: "person-outline" as const }))
    : COSMETIC_CATALOG.filter((item) => item.kind === selectedKind);
  const selectedProduct = products.find((item) => item.id === selectedItemId) ?? products[0];
  const selectedSkin = selectedKind === "skin" ? selectedItemId as SkinId : profile.equippedSkin;
  const selectedCosmetic = getAvatarCosmetic(selectedSkin);
  const selectedColors = selectedKind === "skin" ? selectedCosmetic.colors : selectedProduct.colors;
  const labels = text as Readonly<Record<string, string>>;
  const halloweenCategory = selectedKind === "skin" ? "avatar" : selectedKind === "seasonal" ? "icon" : selectedKind;
  const selectedName = showHalloween ? (halloween.asset(halloweenCategory)?.label ?? (language === "ar" ? "مظهر هالوين" : "Halloween look")) : labels[selectedItemId] ?? selectedItemId;
  const selectedDescription = showHalloween && halloween.equipped ? "مظاهر هالوين المجهزة محفوظة في مجموعتك" : showHalloween ? (language === "ar" ? "معاينة محلية فقط · لم يتغير حسابك أو مشترياتك" : "Local preview only · your account and purchases are unchanged") : labels[`${selectedItemId}Desc`] ?? "";
  const selectedEquipped = (showHalloween && halloween.equipped) || (!showHalloween && (selectedKind === "skin"
    ? profile.equippedSkin === selectedItemId
    : profile.equippedCosmetics[selectedKind] === selectedItemId));
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 24 : insets.bottom;

  useEffect(() => {
    if (reduceMotion) {
      previewScale.setValue(1);
      return;
    }
    previewScale.setValue(0.96);
    const animation = Animated.spring(previewScale, {
      toValue: 1,
      speed: 20,
      bounciness: 5,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [previewScale, reduceMotion, selectedItemId]);

  const buyItem = async (itemId: string, itemKind: "skin" | CosmeticKind, price: number) => {
    if (!playerId || buyingItemId) return;
    setFeedback("");
    setBuyingItemId(itemId);
    try {
      const response = await fetch(new URL(`/api/player/${playerId}/purchase`, getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: itemKind === "skin" ? "skin" : "cosmetic", itemId, price }),
      });
      const data = await response.json() as {
        error?: string;
        profile?: { coins?: number; ownedSkins?: string[]; ownedCosmetics?: typeof profile.ownedCosmetics };
        alreadyOwned?: boolean;
      };
      if (response.status === 402 || data.error === "insufficient_coins") {
        setFeedback(text.insufficient);
        setFeedbackIsError(true);
        return;
      }
      if (!response.ok || !data.profile) {
        throw new Error(data.error ?? "purchase_failed");
      }
      const updates = {
        coins: data.profile.coins ?? profile.coins,
        ...(itemKind === "skin"
          ? { ownedSkins: (data.profile.ownedSkins ?? profile.ownedSkins) as SkinId[] }
          : { ownedCosmetics: data.profile.ownedCosmetics ?? {
              ...profile.ownedCosmetics,
              [itemKind]: [...profile.ownedCosmetics[itemKind], itemId],
            } }),
      };
      updateProfile(updates);
      setFeedback(data.alreadyOwned ? text.equipSuccess : text.purchaseSuccess);
      setFeedbackIsError(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("[store] Cosmetic purchase failed:", error);
      setFeedback(text.networkError);
      setFeedbackIsError(true);
    } finally {
      setBuyingItemId(null);
    }
  };

  const equipSkin = (skinId: SkinId) => {
    if (profile.equippedSkin === skinId) return;
    updateProfile({ equippedSkin: skinId });
    setFeedback(text.equipSuccess);
    setFeedbackIsError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const equipCosmetic = (kind: CosmeticKind, itemId: string) => {
    if (profile.equippedCosmetics[kind] === itemId) return;
    updateProfile({ equippedCosmetics: { ...profile.equippedCosmetics, [kind]: itemId } });
    setFeedback(text.equipSuccess);
    setFeedbackIsError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirmPendingPurchase = () => {
    if (!pendingPurchase || buyingItemId) return;
    const item = pendingPurchase;
    setPendingPurchase(null);
    void buyItem(item.id, item.kind, item.price);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <GameScreenBackground accent="reward" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.background+"A8"}]}/>
      <GameHeader
        title={text.title}
        subtitle={text.subtitle}
        onBack={() => router.back()}
        icon={<Ionicons name="color-palette-outline" size={23} color={gameDesign.colors.coinsText} />}
        trailing={<CoinBalance amount={halloween.commerce ? halloween.coins ?? profile.coins : profile.coins} label={text.coins} />}
      />

      <ScrollView ref={collectionScroll} contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <HalloweenEntry compact />
        <HalloweenAccountStatus compact />
        <Pressable accessibilityRole="button" accessibilityState={{expanded:previewOpen}} onPress={()=>setPreviewOpen(v=>!v)} style={[styles.previewToggle,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>
          {showHalloween?<HalloweenAvatar skinId={profile.equippedSkin} size={44}/>:<PlayerAvatar skinId={selectedSkin} size={44} frameId={profile.equippedCosmetics.frame}/>}
          <View style={{flex:1,alignItems:"flex-end"}}><Text style={[styles.previewName,{fontSize:15,color:theme.textPrimary}]}>{text.profileLook}</Text><Text style={[styles.previewLabel,{color:theme.textSecondary}]}>{selectedName}</Text></View><Ionicons name={previewOpen?"chevron-up":"chevron-down"} size={18} color={theme.textSecondary}/>
        </Pressable>
        {previewOpen&&<LinearGradient
          colors={[`${selectedColors[0]}30`, "#1A112D", theme.card]}
          locations={[0, 0.58, 1]}
          style={[styles.preview, { borderColor: `${selectedColors[0]}85` }]}
        >
          <View style={styles.previewHeader}>
            <View style={styles.previewHeading}>
              <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>{text.profileLook}</Text>
              <Text style={[styles.previewName, { color: theme.textPrimary }]}>{selectedName}</Text>
            </View>
            <View style={[styles.equippedBadge, { backgroundColor: `${selectedColors[0]}20`, borderColor: `${selectedColors[0]}55` }]}>
              <Ionicons name={selectedEquipped ? "checkmark-circle" : "sparkles"} size={16} color={selectedColors[1]} />
              <Text style={[styles.equippedBadgeText, { color: theme.textPrimary }]}>
                {selectedEquipped ? text.equippedLook : text.previewing}
              </Text>
            </View>
          </View>
          <Animated.View style={[styles.previewStage, showHalloween ? { width: "100%", height: 280 } : null, { transform: [{ scale: previewScale }] }]}>
            {showHalloween ? (
              <HalloweenProfileLook name={profile.name} skinId={profile.equippedSkin} />
            ) : selectedKind === "skin" ? (
              <PlayerAvatar
                size={136}
                skinId={selectedSkin}
                frameId={profile.equippedCosmetics.frame}
                accessibilityLabel={selectedName}
              />
            ) : selectedKind === "frame" ? (
              <View style={styles.framePreview}>
                <AvatarArtwork skinId={profile.equippedSkin} size={108} />
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <CosmeticArtwork kind="frame" itemId={selectedItemId} size={140} />
                </View>
              </View>
            ) : (
              <CosmeticArtwork kind={selectedKind} itemId={selectedItemId} size={136} />
            )}
          </Animated.View>
          <Text style={[styles.previewDescription, { color: theme.textSecondary }]}>{selectedDescription}</Text>
          {showHalloween ? (
            <Pressable accessibilityRole="button" onPress={() => router.push("/profile")} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, backgroundColor: "#49305C" }}>
              <Text style={{ color: "#FFE6A5", fontFamily: "Cairo_700Bold" }}>{language === "ar" ? "عرض المظهر في الملف الشخصي" : "View on profile"}</Text>
            </Pressable>
          ) : null}
        </LinearGradient>}

        {selectedKind==="seasonal"?<Text style={[styles.description,{color:theme.textSecondary}]}>{text.seasonalNote}</Text>:null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {(["skin", ...COSMETIC_KINDS] as const).map((kind) => {
            const active = selectedKind === kind;
            const key = kind === "skin" ? "skins" : kind;
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setSelectedKind(kind);
                  if (kind === "skin") {
                    setSelectedItemId(profile.equippedSkin);
                  } else {
                    const first = COSMETIC_CATALOG.find((item) => item.kind === kind);
                    if (first) setSelectedItemId(first.id);
                  }
                }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  { backgroundColor: active ? `${gameDesign.colors.coins}22` : theme.card, borderColor: active ? gameDesign.colors.coins : theme.cardBorder },
                  pressed && styles.pressed,
                ]}
              >
                {kind === "skin" ? (
                  <AvatarArtwork skinId={profile.equippedSkin} size={24} />
                ) : (
                  <CosmeticArtwork
                    kind={kind}
                    itemId={COSMETIC_CATALOG.find((item) => item.kind === kind)?.id ?? ""}
                    size={28}
                  />
                )}
                <Text style={[styles.categoryText, { color: active ? gameDesign.colors.coinsText : theme.textSecondary }]}>{labels[key]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <HalloweenCategory kind={selectedKind} onSelect={() => { setLegacyPreview(false); setPreviewOpen(true); setFeedback(""); collectionScroll.current?.scrollTo({ y: 0, animated: !reduceMotion }); }} />

        {feedback ? (
          <View
            accessibilityRole={feedbackIsError ? "alert" : "text"}
            style={[styles.feedback, { flexDirection: isRTL ? "row-reverse" : "row" }, {
              backgroundColor: feedbackIsError ? `${gameDesign.colors.danger}18` : `${gameDesign.colors.success}18`,
              borderColor: feedbackIsError ? `${gameDesign.colors.danger}55` : `${gameDesign.colors.success}55`,
            }]}
          >
            <Ionicons
              name={feedbackIsError ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={19}
              color={feedbackIsError ? gameDesign.colors.danger : gameDesign.colors.success}
            />
            <Text style={[styles.feedbackText, { color: theme.textPrimary }]}>{feedback}</Text>
          </View>
        ) : null}

        <View style={styles.catalog}>
          {products.map((item) => {
            const owned = item.kind === "skin"
              ? profile.ownedSkins.includes(item.id as SkinId)
              : profile.ownedCosmetics[item.kind].includes(item.id);
            const equipped = item.kind === "skin"
              ? profile.equippedSkin === item.id
              : profile.equippedCosmetics[item.kind] === item.id;
            const selected = selectedItemId === item.id;
            const name = labels[item.id] ?? item.id;
            const description = labels[`${item.id}Desc`] ?? "";
            const isBuying = buyingItemId === item.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.productCard,
                  {
                    width: cardWidth,
                    backgroundColor: theme.card,
                    borderColor: selected ? item.colors[0] : theme.cardBorder,
                    shadowColor: item.colors[0],
                    shadowOpacity: selected ? 0.18 : 0,
                    elevation: selected ? 5 : 1,
                  },
                ]}
              >
                <LinearGradient
                  colors={[`${item.colors[0]}18`, theme.card]}
                  style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name}. ${description}`}
                  accessibilityState={{ selected }}
                  onPress={() => { halloween.reset(); setLegacyPreview(true); setSelectedItemId(item.id); setPreviewOpen(true); collectionScroll.current?.scrollTo({y:0,animated:!reduceMotion}); }}
                  style={({ pressed }) => [styles.productPreview, pressed && styles.pressed]}
                >
                  <View style={[styles.productState, { backgroundColor: `${item.colors[0]}24`, borderColor: `${item.colors[0]}65` }]}>
                    <Ionicons
                      name={equipped ? "checkmark-circle" : owned ? "checkmark" : "sparkles"}
                      size={13}
                      color={item.colors[1]}
                    />
                    <Text style={[styles.productStateText, { color: item.colors[1] }]}>
                      {equipped ? text.equipped : owned ? text.owned : text.notOwned}
                    </Text>
                  </View>
                  <View style={[styles.productAvatar, { backgroundColor: `${item.colors[0]}20` }]}>
                    {item.kind === "skin"
                      ? <AvatarArtwork skinId={item.id as SkinId} size={Math.min(66, cardWidth - 22)} />
                      : <CosmeticArtwork kind={item.kind} itemId={item.id} size={Math.min(66, cardWidth - 22)} />}
                  </View>
                  <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={2}>{name}</Text>
                  <Text style={[styles.productDescription, { color: theme.textSecondary }]} numberOfLines={2}>{description}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={equipped ? text.equipped : owned ? text.equip : `${text.buy} ${item.price} ${text.coins}`}
                  disabled={equipped || isBuying || (!owned && !playerId)}
                  onPress={() => owned
                    ? item.kind === "skin" ? equipSkin(item.id as SkinId) : equipCosmetic(item.kind, item.id)
                    : setPendingPurchase({ id: item.id, kind: item.kind, price: item.price })}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: equipped ? `${item.colors[0]}28` : owned ? `${item.colors[0]}16` : item.colors[1],
                      borderColor: `${item.colors[0]}55`,
                      opacity: equipped ? 0.8 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {isBuying ? (
                    <ActivityIndicator size="small" color={item.colors[1]} />
                  ) : (
                    <>
                      {!owned ? <GameIcon name="coins" size={17} color="#100B24" /> : null}
                      <Text style={[styles.actionText, { color: owned ? theme.textPrimary : "#100B24" }]}>
                        {equipped ? text.equipped : owned ? text.equip : item.price === 0 ? text.equip : `${item.price} ${text.coins}`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Text style={[styles.note, { color: theme.textMuted }]}>{text.onlineNote}</Text>
      </ScrollView>

      <GameModal visible={pendingPurchase !== null} onRequestClose={() => setPendingPurchase(null)}>
        {pendingPurchase ? (
          <View style={styles.confirmation}>
            <View style={[styles.confirmationIcon, { backgroundColor: `${gameDesign.colors.coins}20` }]}>
              <GameIcon name="coins" size={30} color={gameDesign.colors.coins} secondaryColor="#FFE2A3" />
            </View>
            <Text style={[styles.confirmationTitle, { color: theme.textPrimary }]}>{text.confirmTitle}</Text>
            <Text style={[styles.confirmationBody, { color: theme.textSecondary }]}>{text.confirmBody}</Text>
            <View style={[styles.confirmationItem, { backgroundColor: `${gameDesign.colors.coins}12`, borderColor: `${gameDesign.colors.coins}45` }]}>
              <Text style={[styles.confirmationItemName, { color: theme.textPrimary }]} numberOfLines={1}>
                {labels[pendingPurchase.id] ?? pendingPurchase.id}
              </Text>
              <View style={styles.confirmationPrice}>
                <GameIcon name="coins" size={20} color={gameDesign.colors.coins} secondaryColor="#FFE2A3" />
                <Text style={[styles.confirmationAmount, { color: gameDesign.colors.coinsText }]}>
                  {pendingPurchase.price.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={[styles.confirmationActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Pressable
                accessibilityRole="button"
                disabled={buyingItemId !== null}
                onPress={() => setPendingPurchase(null)}
                style={({ pressed }) => [
                  styles.confirmationButton,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.confirmationButtonText, { color: theme.textSecondary }]}>{text.cancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={buyingItemId !== null}
                onPress={confirmPendingPurchase}
                style={({ pressed }) => [
                  styles.confirmationButton,
                  styles.confirmationPrimary,
                  { opacity: pressed || buyingItemId !== null ? 0.75 : 1 },
                ]}
              >
                {buyingItemId ? (
                  <ActivityIndicator color="#100B24" />
                ) : (
                  <Text style={[styles.confirmationButtonText, { color: "#100B24" }]}>{text.confirmPurchase}</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </GameModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 12, paddingTop: 8, paddingBottom: 32 },
  preview: { alignItems: "center", borderRadius: 26, borderWidth: 1.5, padding: 18, gap: 10, overflow: "hidden" },
  previewToggle:{minHeight:68,padding:10,borderRadius:18,borderWidth:1,flexDirection:"row",alignItems:"center",gap:10},
  previewHeader: { width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  previewHeading: { flex: 1, gap: 3 },
  previewLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
  previewStage: { width: 152, height: 152, alignItems: "center", justifyContent: "center" },
  framePreview: { width: 140, height: 140, alignItems: "center", justifyContent: "center" },
  previewName: { fontFamily: "Cairo_700Bold", fontSize: 20, lineHeight: 28 },
  previewDescription: { width: "100%", fontFamily: "Cairo_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  equippedBadge: { maxWidth: "55%", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  equippedBadgeText: { flexShrink: 1, fontFamily: "Cairo_600SemiBold", fontSize: 12, lineHeight: 18 },
  sectionHeading: { gap: 4 },
  heading: { fontFamily: "Cairo_700Bold", fontSize: 19 },
  description: { fontFamily: "Cairo_400Regular", fontSize: 13, lineHeight: 20 },
  feedback: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  feedbackText: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 13 },
  catalog: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 8 },
  categoryRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  categoryChip: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12 },
  categoryText: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  productCard: { alignItems: "center", borderRadius: 14, borderWidth: 1.5, padding: 8, gap: 6, overflow: "hidden" },
  productPreview: { width: "100%", alignItems: "center", gap: 7 },
  productState: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 2 },
  productStateText: { fontFamily: "Cairo_700Bold", fontSize: 9, lineHeight: 14 },
  productAvatar: { width: "100%", height: 70, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  productName: { fontFamily: "Cairo_700Bold", fontSize: 11, lineHeight: 16, minHeight: 32, textAlign: "center" },
  productDescription: { minHeight: 32, fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 16, textAlign: "center" },
  actionButton: { width: "100%", minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 9, borderWidth: 1, paddingHorizontal: 5 },
  actionText: { fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "center" },
  confirmation: { alignItems: "center", gap: 12 },
  confirmationIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  confirmationTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "center" },
  confirmationBody: { fontFamily: "Cairo_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  confirmationItem: { width: "100%", minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  confirmationItemName: { flex: 1, fontFamily: "Cairo_700Bold", fontSize: 15 },
  confirmationPrice: { flexDirection: "row", alignItems: "center", gap: 6 },
  confirmationAmount: { fontFamily: "Cairo_700Bold", fontSize: 17 },
  confirmationActions: { width: "100%", gap: 10, marginTop: 4 },
  confirmationButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 8 },
  confirmationPrimary: { backgroundColor: gameDesign.colors.coins, borderColor: `${gameDesign.colors.coins}AA` },
  confirmationButtonText: { fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "center" },
  note: { fontFamily: "Cairo_400Regular", fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 12 },
  pressed: { opacity: 0.8 },
});
