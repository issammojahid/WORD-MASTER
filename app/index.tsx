import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { MAPS } from "@/constants/i18n";

const { width, height } = Dimensions.get("window");

function DecorativeDot({ x, y, size, opacity }: { x: number; y: number; size: number; opacity: number }) {
  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.gold,
        opacity,
      }}
    />
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, isRTL, selectedMap } = useLanguage();
  const { profile, setPlayerName } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const mapConfig = MAPS.find((m) => m.id === selectedMap) || MAPS[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleButton = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action();
  };

  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  const xpForNextLevel = profile.level * 100;
  const xpProgress = (profile.xp % 100) / 100;

  return (
    <View style={[styles.container, { backgroundColor: mapConfig.color }]}>
      {/* Decorative dots */}
      <DecorativeDot x={20} y={height * 0.15} size={8} opacity={0.3} />
      <DecorativeDot x={width - 40} y={height * 0.2} size={12} opacity={0.2} />
      <DecorativeDot x={width * 0.5} y={height * 0.08} size={6} opacity={0.25} />
      <DecorativeDot x={30} y={height * 0.7} size={10} opacity={0.2} />
      <DecorativeDot x={width - 25} y={height * 0.65} size={7} opacity={0.3} />

      {/* Geometric decorations */}
      <View style={styles.hexDecorTopRight} />
      <View style={styles.hexDecorBottomLeft} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + 12,
            paddingBottom: bottomInset + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => handleButton(() => router.push("/settings"))}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.coinsBadge}>
            <Ionicons name="star" size={14} color={Colors.gold} />
            <Text style={styles.coinsText}>{profile.coins}</Text>
          </View>
        </View>

        {/* Player profile card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => {
            setShowNameModal(true);
            setNameInput(profile.name);
          }}
          activeOpacity={0.85}
        >
          <View style={[styles.avatarCircle, { backgroundColor: equippedSkin.color + "33" }]}>
            <Text style={styles.avatarEmoji}>{equippedSkin.emoji}</Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{profile.name}</Text>
              <Ionicons name="pencil" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </View>
            <View style={styles.levelRow}>
              <View style={[styles.levelBadge]}>
                <Text style={styles.levelText}>
                  {t.level} {profile.level}
                </Text>
              </View>
              <View style={styles.xpBarContainer}>
                <View style={[styles.xpBar, { width: `${xpProgress * 100}%` }]} />
              </View>
              <Text style={styles.xpText}>{profile.xp % 100}/{100} XP</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            { transform: [{ translateY: floatAnim }] },
          ]}
        >
          <View style={styles.letterCircle}>
            <Text style={styles.logoLetter}>ح</Text>
          </View>
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.appSubtitle}>{t.homeSubtitle}</Text>
        </Animated.View>

        {/* Main buttons */}
        <View style={styles.buttonsContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.primaryBtn]}
              onPress={() => handleButton(() => router.push("/lobby"))}
              activeOpacity={0.85}
            >
              <Ionicons name="wifi" size={22} color={Colors.black} style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>{t.playOnline}</Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => handleButton(() => router.push("/offline"))}
            activeOpacity={0.85}
          >
            <Ionicons name="person" size={20} color={Colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>{t.playOffline}</Text>
          </TouchableOpacity>

          <View style={styles.smallButtonsRow}>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => handleButton(() => router.push("/leaderboard"))}
              activeOpacity={0.85}
            >
              <Ionicons name="trophy" size={20} color={Colors.gold} />
              <Text style={styles.smallBtnText}>{t.leaderboard}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => handleButton(() => router.push("/shop"))}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="shopping" size={20} color={Colors.emerald} />
              <Text style={styles.smallBtnText}>{t.shop}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.gamesPlayed}</Text>
            <Text style={styles.statLabel}>مباريات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.wins}</Text>
            <Text style={styles.statLabel}>انتصارات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalScore}</Text>
            <Text style={styles.statLabel}>نقاط كلية</Text>
          </View>
        </View>
      </ScrollView>

      {/* Name modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>اسم اللاعب</Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={20}
              textAlign={isRTL ? "right" : "left"}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  if (nameInput.trim()) {
                    setPlayerName(nameInput.trim());
                  }
                  setShowNameModal(false);
                }}
              >
                <Text style={styles.modalConfirmText}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: "center",
  },
  hexDecorTopRight: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.gold + "20",
    transform: [{ rotate: "30deg" }],
  },
  hexDecorBottomLeft: {
    position: "absolute",
    bottom: -80,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.emerald + "15",
    transform: [{ rotate: "15deg" }],
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card + "80",
    justifyContent: "center",
    alignItems: "center",
  },
  coinsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card + "80",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  coinsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  profileCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card + "90",
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder + "40",
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  playerName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadge: {
    backgroundColor: Colors.gold + "25",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    color: Colors.gold,
  },
  xpBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    overflow: "hidden",
  },
  xpBar: {
    height: "100%",
    backgroundColor: Colors.emerald,
    borderRadius: 2,
  },
  xpText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  letterCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  logoLetter: {
    fontFamily: "Cairo_700Bold",
    fontSize: 48,
    color: Colors.black,
    lineHeight: 60,
  },
  appName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 28,
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: 1,
  },
  appSubtitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.black,
  },
  secondaryBtn: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  secondaryBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  smallButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  smallBtnText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.card + "70",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: "100%",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: Colors.cardBorder + "40",
  },
  statItem: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.cardBorder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    color: Colors.inputText,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: "center",
  },
  modalConfirmText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.black,
  },
});
