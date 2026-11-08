import {getStoreOffer,canPurchaseStoreOffer,STORE_TIER_LABELS} from "@/constants/store-economy";
import {INTERNAL_SHOWCASE_ENABLED} from "@/constants/release-content";
import {RoyalSurface} from "@/components/RoyalUi";
import {SeasonCatalogArtwork} from "@/components/SeasonCatalogArtwork";
import {SeasonItemPreview} from "@/components/SeasonItemPreview";
import {seasonPreviewItems,type SeasonPreviewItem} from "@/constants/season-catalog";
import {SEASON_EVENTS,initialSeasonIndex} from "@/lib/season-calendar";
import {ScaledText as Text} from "@/components/ScaledText";
import {SeasonCollectionBanner} from "@/components/SeasonCollectionBanner";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { AvatarArtwork } from "@/components/AvatarArtwork";
import { CosmeticArtwork } from "@/components/CosmeticArtwork";
import { HalloweenAvatar, HalloweenCategory, HalloweenProfileLook, useHalloweenAppearance } from "@/components/HalloweenAppearance";
import { HalloweenAccountStatus, HalloweenEntry, HalloweenAcquireButton } from "@/components/HalloweenEconomy";
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
    title: "المتجر",
    subtitle: "اختر المظاهر التي تعبّر عن أسلوبك",
    heading: "شخصيات وإطارات",
    description: "مظاهر تجميلية فقط؛ لا تؤثر على قواعد اللعب أو النقاط.",
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
  const { width,fontScale } = useWindowDimensions();
  const { isRTL, language } = useLanguage();
  const { profile, playerId, updateProfile } = usePlayer();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const text = COPY[language];
  const halloween = useHalloweenAppearance();
  const collectionScroll = useRef<ScrollView>(null);
  const [legacyPreview, setLegacyPreview] = useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [seasonSelection,setSeasonSelection]=useState<SeasonPreviewItem|null>(null),[seasonPreviewOpen,setSeasonPreviewOpen]=useState(false);
  useEffect(() => { setLegacyPreview(false); }, [halloween.equipmentKey]);
  const showHalloween = halloween.active && !legacyPreview;
  const [selectedKind, setSelectedKind] = useState<"skin" | CosmeticKind>("skin");
  const [selectedItemId, setSelectedItemId] = useState<string>(profile.equippedSkin);
  const {category}=useLocalSearchParams<{category?:string}>();
  useEffect(()=>{
    if(category==='skin'){setSelectedKind('skin');setSelectedItemId(AVATAR_CATALOG[0].id);}
    else if(COSMETIC_KINDS.some(kind=>kind===category)){
      const first=COSMETIC_CATALOG.find(item=>item.kind===category);
      if(first){setSelectedKind(first.kind);setSelectedItemId(first.id);}
    }
  },[category]);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{ id: string; kind: "skin" | CosmeticKind; price: number } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const previewScale = useRef(new Animated.Value(1)).current;
  const columns = fontScale>1.3?3:5;
  const horizontalPadding = width >= 600 ? 24 : 16;
  const cardWidth = useMemo(
    () => (Math.min(width, 760) - horizontalPadding * 2 - 8 * (columns - 1)) / columns,
    [columns, horizontalPadding, width],
  );
  const products = selectedKind === "skin"
    ? AVATAR_CATALOG.map((item) => ({ ...item, ...getStoreOffer(item.id)!, kind: "skin" as const, icon: "person-outline" as const }))
    : COSMETIC_CATALOG.filter((item) => item.kind === selectedKind).map(item=>({...item,...getStoreOffer(item.id)!}));
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
    if (!canPurchaseStoreOffer(itemId,price)) {setFeedback(isRTL?"الشراء متوقف مؤقتاً لتحديث الأثمنة. يمكنك تجهيز المظاهر المملوكة.":"Purchases are paused while prices are updated. Owned items can still be equipped.");setFeedbackIsError(true);return;}
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

  const selectionOwned=selectedKind==="skin"?profile.ownedSkins.includes(selectedItemId as SkinId):profile.ownedCosmetics[selectedKind].includes(selectedItemId);
  const seasonEvent=SEASON_EVENTS[initialSeasonIndex(Date.now())],seasonKind=selectedKind==="skin"?"avatar":selectedKind==="seasonal"?"icon":selectedKind;
  const seasonItems=INTERNAL_SHOWCASE_ENABLED?seasonPreviewItems(seasonEvent.id).filter(item=>item.kind===seasonKind):[];
  function activateSelected(){if(!selectionOwned&&!selectedProduct.purchaseReady)return;if(selectionOwned){if(selectedKind==="skin")equipSkin(selectedItemId as SkinId);else equipCosmetic(selectedKind,selectedItemId);}else{setPreviewOpen(false);setPendingPurchase({id:selectedItemId,kind:selectedKind,price:selectedProduct.price});}}

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <GameScreenBackground accent="reward" />

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
        <SeasonCollectionBanner/>
        <GameModal visible={previewOpen} onRequestClose={()=>setPreviewOpen(false)}><ScrollView style={{maxHeight:600}} contentContainerStyle={{gap:10}}><Pressable accessibilityRole="button" accessibilityLabel="إغلاق المعاينة" onPress={()=>setPreviewOpen(false)} style={{minHeight:44,alignSelf:"flex-start",justifyContent:"center"}}><Ionicons name="close" size={24} color={theme.textPrimary}/></Pressable><LinearGradient
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
        </LinearGradient>
        {showHalloween&&halloween.asset(halloweenCategory)?<HalloweenAcquireButton assetKey={halloween.asset(halloweenCategory)!.previewKey}/>:null}
        {!showHalloween&&<Pressable accessibilityRole="button" disabled={selectedEquipped||!!buyingItemId||!playerId||(!selectionOwned&&!selectedProduct.purchaseReady)} onPress={()=>{if(selectionOwned){if(selectedKind==="skin")equipSkin(selectedItemId as SkinId);else equipCosmetic(selectedKind,selectedItemId);}else {setPreviewOpen(false);setPendingPurchase({id:selectedItemId,kind:selectedKind,price:selectedProduct.price});}}} style={[styles.actionButton,{backgroundColor:gameDesign.colors.coins,opacity:selectedEquipped?.5:1}]}><Text style={[styles.actionText,{color:"#1C1231",fontSize:15}]}>{selectedEquipped?text.equipped:selectionOwned?text.equip:!selectedProduct.purchaseReady?(isRTL?"الشراء متوقف مؤقتاً":"Purchases paused"):`${text.buy} · ${selectedProduct.price} ${text.coins}`}</Text></Pressable>}
        </ScrollView></GameModal>

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
                  setSeasonSelection(null);setSelectedKind(kind);
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

        <HalloweenCategory kind={selectedKind} onSelect={() => { setSeasonSelection(null);setLegacyPreview(false); setPreviewOpen(true); setFeedback(""); collectionScroll.current?.scrollTo({ y: 0, animated: !reduceMotion }); }} />

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

        {INTERNAL_SHOWCASE_ENABLED?<Text style={{fontFamily:"Cairo_700Bold",fontSize:14,color:"#FFE3A6",textAlign:"right"}}>{seasonEvent.title} · معاينة المظاهر القادمة</Text>:null}
        <View style={styles.catalog}>{seasonItems.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`معاينة موسمية: ${item.name}`} onPress={()=>{setSeasonSelection(item);setSeasonPreviewOpen(true);}} style={[styles.productCard,{width:cardWidth,borderColor:seasonSelection?.key===item.key?"#3DE4D4":"#C2985F",backgroundColor:theme.card}]}><SeasonCatalogArtwork item={item} size={Math.max(30,cardWidth-6)}/><Text numberOfLines={1} style={[styles.productName,{color:theme.textPrimary}]}>{item.name}</Text><Text style={{fontFamily:"Cairo_600SemiBold",fontSize:9,color:"#81EADD"}}>قريباً</Text></Pressable>)}</View>
        <Text style={{fontFamily:"Cairo_700Bold",fontSize:14,color:"#FFE3A6",textAlign:"right"}}>المجموعة الأساسية</Text><Text style={{fontFamily:"Cairo_400Regular",fontSize:11,lineHeight:21,color:theme.textMuted,textAlign:isRTL?"right":"left"}}>{isRTL?"أثمنة جديدة حسب ندرة المظهر. الشراء متوقف مؤقتاً لتحديث الأثمنة؛ المظاهر المملوكة تبقى متاحة للتجهيز.":"New rarity-based prices. Purchases are paused for the price update; owned items remain available to equip."}</Text>
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
            return (
              <View
                key={item.id}
                style={[
                  styles.productCard,
                  {
                    width: cardWidth,
                    backgroundColor: theme.card,
                    borderColor: selected ? "#35E5D8" : "#A88859",
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
                  onPress={() => { setSeasonSelection(null); halloween.reset(); setLegacyPreview(true); setSelectedItemId(item.id); setPreviewOpen(true); collectionScroll.current?.scrollTo({y:0,animated:!reduceMotion}); }}
                  style={({ pressed }) => [styles.productPreview, pressed && styles.pressed]}
                >
                  {owned?<View style={[styles.productState,{backgroundColor:equipped?"#087D83":"#48315F"}]}><Ionicons name={equipped?"checkmark-circle":"checkmark"} size={12} color="#ABFFF1"/></View>:null}
                  <View style={[styles.productAvatar, { height:Math.max(42,cardWidth*0.85), backgroundColor: `${item.colors[0]}20` }]}>
                    {item.kind === "skin"
                      ? <AvatarArtwork skinId={item.id as SkinId} size={Math.max(32,cardWidth-6)} />
                      : <CosmeticArtwork kind={item.kind} itemId={item.id} size={Math.max(32,cardWidth-12)} />}
                  </View>
                  <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={1}>{name}</Text><Text style={{fontFamily:"Cairo_600SemiBold",fontSize:9,color:item.tier==="legendary"?"#F5CB68":item.tier==="rare"?"#C9ACFF":"#8ADCD7"}}>{isRTL?STORE_TIER_LABELS[item.tier]:item.tier}</Text>

                </Pressable>
                <Text style={{fontFamily:"Cairo_700Bold",fontSize:10,color:gameDesign.colors.coinsText,textAlign:"center"}}>{equipped?"✓":owned?text.owned:item.price.toLocaleString()}</Text>

              </View>
            );
          })}
        </View>
        <RoyalSurface style={{padding:12,flexDirection:"row-reverse",gap:12,alignItems:"center",minHeight:125}}>
         <Pressable accessibilityRole="button" accessibilityLabel="تكبير معاينة المظهر" onPress={()=>seasonSelection?setSeasonPreviewOpen(true):setPreviewOpen(true)}>{seasonSelection?<SeasonCatalogArtwork item={seasonSelection} size={94}/>:showHalloween?<HalloweenAvatar skinId={profile.equippedSkin} size={94}/>:selectedKind==="skin"||selectedKind==="frame"?<PlayerAvatar skinId={selectedSkin} frameId={selectedKind==="frame"?selectedItemId:profile.equippedCosmetics.frame} size={94}/>:<CosmeticArtwork kind={selectedKind} itemId={selectedItemId} size={94}/>}</Pressable>
         <View style={{flex:1,gap:6}}><Text style={{fontFamily:"Cairo_700Bold",fontSize:17,color:theme.textPrimary,textAlign:"right"}}>{seasonSelection?.name??selectedName}</Text>
          {seasonSelection?<><Text style={{fontFamily:"Cairo_400Regular",fontSize:11,color:theme.textSecondary,textAlign:"right"}}>قريباً · معاينة فقط</Text><Pressable accessibilityRole="button" onPress={()=>setSeasonPreviewOpen(true)} style={[styles.actionButton,{borderColor:"#3ADDD0",backgroundColor:"#116877"}]}><Text style={[styles.actionText,{color:"#FFF0D6"}]}>معاينة المظهر والحركة</Text></Pressable></>:showHalloween&&halloween.asset(halloweenCategory)?<HalloweenAcquireButton assetKey={halloween.asset(halloweenCategory)!.previewKey}/>:<><Text style={{fontFamily:"Cairo_700Bold",fontSize:13,color:"#F2CC7C",textAlign:"right"}}>{selectionOwned?text.owned:`${selectedProduct.price} ${text.coins}`}</Text><Pressable accessibilityRole="button" disabled={selectedEquipped||!!buyingItemId||!playerId||(!selectionOwned&&!selectedProduct.purchaseReady)} onPress={activateSelected} style={[styles.actionButton,{backgroundColor:"#F3CC78",borderColor:"#FFF0B8",opacity:selectedEquipped?.55:1}]}><Text style={[styles.actionText,{fontSize:16,color:"#30213E"}]}>{selectedEquipped?text.equipped:selectionOwned?text.equip:!selectedProduct.purchaseReady?(isRTL?"الشراء متوقف مؤقتاً":"Purchases paused"):text.buy}</Text></Pressable></>}
         </View>
        </RoyalSurface>
        <Text style={[styles.note, { color: theme.textMuted }]}>{text.onlineNote}</Text>
      </ScrollView>

      <GameModal visible={seasonPreviewOpen} onRequestClose={()=>setSeasonPreviewOpen(false)}>{seasonSelection?<View style={{alignItems:"center",gap:10}}><Text style={{fontFamily:"Cairo_700Bold",fontSize:19,color:"#FFE3A6",textAlign:"center"}}>{seasonSelection.name}</Text><View style={{width:Math.min(280,width-88),height:Math.min(280,width-88)}}><View style={{position:"absolute",left:(Math.min(280,width-88)-280)/2,top:(Math.min(280,width-88)-280)/2,transform:[{scale:Math.min(280,width-88)/280}]}}><SeasonItemPreview key={seasonSelection.key} item={seasonSelection}/></View></View><Text style={{fontFamily:"Cairo_400Regular",fontSize:11,color:theme.textSecondary,textAlign:"center"}}>معاينة فنية · لا تغيّر الملكية أو المظهر المجهّز</Text><Pressable accessibilityRole="button" onPress={()=>setSeasonPreviewOpen(false)} style={{minHeight:44,justifyContent:"center"}}><Text style={{fontFamily:"Cairo_700Bold",fontSize:14,color:"#6AE9DD"}}>إغلاق المعاينة الموسمية</Text></Pressable></View>:null}</GameModal>
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
  previewToggle:{minHeight:110,padding:10,borderRadius:18,borderWidth:1,flexDirection:"row",alignItems:"center",gap:10},
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
  categoryChip: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12 },
  categoryText: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  productCard: { alignItems: "center", borderRadius: 14, borderWidth: 1.5, padding: 2, gap: 0, overflow: "hidden" },
  productPreview: { width: "100%", alignItems: "center", gap: 3 },
  productState: { position:"absolute",top:2,right:2,zIndex:2,minHeight: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 2 },
  productStateText: { fontFamily: "Cairo_700Bold", fontSize: 9, lineHeight: 14 },
  productAvatar: { width: "100%", height: 46, overflow:"hidden", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  productName: { fontFamily: "Cairo_700Bold", fontSize: 9, lineHeight: 16, minHeight: 16, textAlign: "center" },
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
