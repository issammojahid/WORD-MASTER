import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
  Modal,
  ImageBackground,
} from "react-native";
const BG_DC = require("@/assets/images/bg_daily.png");
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const DC_BG: [string, string, string] = ["rgba(0,0,0,0.72)", "rgba(0,0,0,0.58)", "rgba(0,0,0,0.72)"];

const ARABIC_KEYBOARD: string[][] = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح"],
  ["ج", "د", "ذ", "ر", "ز", "س", "ش", "ط", "ظ", "ك"],
  ["م", "ن", "ت", "ا", "ل", "ب", "ي", "و", "ة", "⌫"],
  ["إ", "أ", "آ", "ى", "ئ", "ء", "ؤ", "ُ"],
];

type LetterStatus = "correct" | "present" | "absent" | "empty" | "typing";
type ColoringEntry = { letter: string; status: "correct" | "present" | "absent" };
type LeaderboardEntry = {
  playerId: string;
  name: string;
  skin: string;
  level: number;
  guessCount: number;
  durationSeconds: number;
  displayRank: number;
};

const STATUS_COLORS: Record<LetterStatus, { bg: string; border: string; text: string }> = {
  correct: { bg: "#065F46", border: "#10B981", text: "#ECFDF5" },
  present: { bg: "#92400E", border: "#F59E0B", text: "#FEF3C7" },
  absent: { bg: "#1F2937", border: "#374151", text: "#9CA3AF" },
  empty: { bg: "#0F172A", border: "#1E3A5F", text: "#E8E8FF" },
  typing: { bg: "#0F172A", border: "#3B82F6", text: "#E8E8FF" },
};

const MAX_GUESSES = 6;

export default function DailyChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId } = usePlayer();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState("");
  const [wordLength, setWordLength] = useState(4);
  const [completedGuesses, setCompletedGuesses] = useState<ColoringEntry[][]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [completed, setCompleted] = useState(false);
  const [won, setWon] = useState(false);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [coinsAwarded, setCoinsAwarded] = useState(0);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState(false);
  const [tab, setTab] = useState<"game" | "leaderboard">("game");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [letterGuessMap, setLetterGuessMap] = useState<Record<string, LetterStatus>>({});

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const winAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const animateWin = useCallback(() => {
    winAnim.setValue(0);
    Animated.spring(winAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    loadChallenge();
    const interval = setInterval(updateCountdown, 1000);
    updateCountdown();
    return () => clearInterval(interval);
  }, []);

  function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const diff = tomorrow.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
  }

  async function loadChallenge() {
    setLoading(true);
    try {
      const url = new URL(`/api/daily-challenge`, getApiUrl());
      url.searchParams.set("playerId", playerId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("server error");
      const data = await res.json();
      setLetter(data.letter || "");
      setWordLength(data.wordLength || 4);
      if (data.entry) {
        const entry = data.entry;
        if (entry.guesses && entry.guesses.length > 0) {
          if (entry.completed) {
            setCompleted(true);
            setWon(entry.won);
            setRevealedWord(data.word);
            const target = data.word || "";
            const prevGuesses: ColoringEntry[][] = entry.guesses.map((g: string) =>
              applyColoring(g, target)
            );
            setCompletedGuesses(prevGuesses);
            updateLetterMap(prevGuesses);
            setTimeout(() => setResultModal(true), 600);
          } else {
            const target = data.word || "";
            const prevGuesses: ColoringEntry[][] = entry.guesses.map((g: string) =>
              applyColoring(g, target)
            );
            setCompletedGuesses(prevGuesses);
            updateLetterMap(prevGuesses);
          }
        }
      }
    } catch (e) {
      console.error("[daily-challenge] load error:", e);
    }
    setLoading(false);
  }

  function applyColoring(guess: string, target: string): ColoringEntry[] {
    const guessChars = [...guess];
    const targetChars = [...target];
    const result: ColoringEntry[] = guessChars.map(l => ({ letter: l, status: "absent" as const }));
    const used = new Array(targetChars.length).fill(false);
    for (let i = 0; i < guessChars.length; i++) {
      if (guessChars[i] === targetChars[i]) {
        result[i] = { letter: guessChars[i], status: "correct" };
        used[i] = true;
      }
    }
    for (let i = 0; i < guessChars.length; i++) {
      if (result[i].status === "correct") continue;
      const foundIdx = targetChars.findIndex((ch, idx) => !used[idx] && ch === guessChars[i]);
      if (foundIdx !== -1) {
        result[i] = { letter: guessChars[i], status: "present" };
        used[foundIdx] = true;
      }
    }
    return result;
  }

  function updateLetterMap(allGuesses: ColoringEntry[][]) {
    const map: Record<string, LetterStatus> = {};
    for (const row of allGuesses) {
      for (const cell of row) {
        const cur = map[cell.letter];
        if (cell.status === "correct") map[cell.letter] = "correct";
        else if (cell.status === "present" && cur !== "correct") map[cell.letter] = "present";
        else if (!cur) map[cell.letter] = "absent";
      }
    }
    setLetterGuessMap(map);
  }

  async function submitGuess() {
    const trimmed = currentInput.trim();
    if ([...trimmed].length !== wordLength) {
      setGuessError(`الكلمة يجب أن تكون ${wordLength} أحرف`);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!trimmed.startsWith(letter) && !trimmed.startsWith(letterEquivalents(letter))) {
      setGuessError(`الكلمة يجب أن تبدأ بحرف ${letter}`);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSubmitting(true);
    setGuessError(null);
    try {
      const url = new URL(`/api/daily-challenge/guess`, getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, guess: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.error === "wrong_length") {
          setGuessError(`الكلمة يجب أن تكون ${data.expected} أحرف`);
        } else if (data.error === "already_completed") {
          setGuessError("لقد أنهيت تحدي اليوم مسبقاً");
        } else {
          setGuessError("تعذر إرسال الإجابة");
        }
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSubmitting(false);
        return;
      }
      const newRow: ColoringEntry[] = data.coloring;
      const newGuesses = [...completedGuesses, newRow];
      setCompletedGuesses(newGuesses);
      updateLetterMap(newGuesses);
      setCurrentInput("");
      if (data.completed) {
        setCompleted(true);
        setWon(data.won);
        setRevealedWord(data.word);
        setCoinsAwarded(data.coinsAwarded || 0);
        if (data.won) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          animateWin();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setTimeout(() => setResultModal(true), 1000);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      setGuessError("خطأ في الاتصال");
      shake();
    }
    setSubmitting(false);
  }

  function letterEquivalents(l: string): string {
    const eq: Record<string, string> = { "ا": "أ", "أ": "ا", "إ": "ا" };
    return eq[l] || l;
  }

  function pressKey(key: string) {
    if (completed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") {
      setCurrentInput(prev => [...prev].slice(0, -1).join(""));
      return;
    }
    if ([...currentInput].length < wordLength) {
      setCurrentInput(prev => prev + key);
    }
  }

  async function loadLeaderboard() {
    setLbLoading(true);
    try {
      const url = new URL(`/api/daily-challenge/leaderboard`, getApiUrl());
      const res = await fetch(url.toString());
      if (res.ok) setLeaderboard(await res.json());
    } catch {}
    setLbLoading(false);
  }

  const renderGrid = () => {
    const rows = [];
    for (let i = 0; i < MAX_GUESSES; i++) {
      const isCompleted = i < completedGuesses.length;
      const isCurrent = i === completedGuesses.length && !completed;
      const cells = [];
      for (let j = 0; j < wordLength; j++) {
        let status: LetterStatus = "empty";
        let cellLetter = "";
        if (isCompleted) {
          const entry = completedGuesses[i][j];
          status = entry ? entry.status : "empty";
          cellLetter = entry ? entry.letter : "";
        } else if (isCurrent) {
          const chars = [...currentInput];
          cellLetter = chars[j] || "";
          status = cellLetter ? "typing" : "empty";
        }
        const colors = STATUS_COLORS[status];
        cells.push(
          <View key={j} style={[styles.cell, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.cellText, { color: colors.text }]}>{cellLetter}</Text>
          </View>
        );
      }
      rows.push(
        <Animated.View key={i} style={[
          styles.gridRow,
          isCurrent && { transform: [{ translateX: shakeAnim }] },
        ]}>
          {cells}
        </Animated.View>
      );
    }
    return rows;
  };

  const renderKeyboard = () => (
    <View style={styles.keyboard}>
      {ARABIC_KEYBOARD.map((row, ri) => (
        <View key={ri} style={styles.keyRow}>
          {row.map(key => {
            const status = letterGuessMap[key];
            const colors = status ? STATUS_COLORS[status] : { bg: "#1E293B", border: "#334155", text: "#E8E8FF" };
            return (
              <TouchableOpacity
                key={key}
                style={[styles.key, { backgroundColor: colors.bg, borderColor: colors.border }]}
                onPress={() => pressKey(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <ImageBackground source={BG_DC} style={[styles.container, styles.centerContent, { paddingTop: topInset }]} resizeMode="cover">
        <LinearGradient colors={DC_BG} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color={Colors.emerald} />
        <Text style={styles.loadingText}>جاري تحميل تحدي اليوم...</Text>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={BG_DC} style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]} resizeMode="cover">
      <LinearGradient colors={DC_BG} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#E8E8FF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🌍 تحدي اليوم</Text>
          <Text style={styles.headerSub}>حرف: {letter} · التالي: {countdown}</Text>
        </View>
        <TouchableOpacity style={styles.lbBtn} onPress={() => {
          const next = tab === "game" ? "leaderboard" : "game";
          setTab(next);
          if (next === "leaderboard") loadLeaderboard();
        }}>
          <Ionicons name={tab === "game" ? "trophy-outline" : "grid-outline"} size={20} color={Colors.gold} />
        </TouchableOpacity>
      </View>

      {tab === "game" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
          {/* Info */}
          <View style={styles.infoRow}>
            <View style={[styles.infoBadge, { backgroundColor: Colors.emerald + "15", borderColor: Colors.emerald + "40" }]}>
              <Text style={[styles.infoBadgeText, { color: Colors.emerald }]}>حرف {letter}</Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: Colors.gold + "15", borderColor: Colors.gold + "40" }]}>
              <Text style={[styles.infoBadgeText, { color: Colors.gold }]}>{wordLength} أحرف</Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: "#3B82F615", borderColor: "#3B82F640" }]}>
              <Text style={[styles.infoBadgeText, { color: "#60A5FA" }]}>{completedGuesses.length}/{MAX_GUESSES}</Text>
            </View>
          </View>

          {/* Grid */}
          <View style={styles.grid}>{renderGrid()}</View>

          {/* Error */}
          {guessError && (
            <Text style={styles.guessError}>{guessError}</Text>
          )}

          {/* Submit Button */}
          {!completed && (
            <TouchableOpacity
              style={[styles.submitBtn, {
                opacity: ([...currentInput].length !== wordLength || submitting) ? 0.5 : 1
              }]}
              onPress={submitGuess}
              disabled={[...currentInput].length !== wordLength || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>إرسال الإجابة ✓</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Completed banner */}
          {completed && (
            <View style={[styles.completedBanner, {
              backgroundColor: won ? Colors.emerald + "18" : Colors.ruby + "18",
              borderColor: won ? Colors.emerald + "50" : Colors.ruby + "50",
            }]}>
              <Text style={[styles.completedTitle, { color: won ? Colors.emerald : Colors.ruby }]}>
                {won ? "🎉 أحسنت!" : "😔 انتهت المحاولات"}
              </Text>
              {revealedWord && (
                <Text style={styles.revealedWord}>الكلمة: {revealedWord}</Text>
              )}
              {coinsAwarded > 0 && (
                <Text style={styles.coinsAwardedText}>+{coinsAwarded} عملة 🪙</Text>
              )}
              <TouchableOpacity style={styles.viewLbBtn} onPress={() => {
                setTab("leaderboard");
                loadLeaderboard();
              }}>
                <Ionicons name="trophy" size={14} color={Colors.gold} />
                <Text style={styles.viewLbBtnText}>ترتيب اليوم</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Keyboard */}
          {!completed && renderKeyboard()}
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.lbTitle}>🏆 ترتيب تحدي اليوم</Text>
          {lbLoading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
          ) : leaderboard.length === 0 ? (
            <View style={styles.emptyLb}>
              <Text style={styles.emptyLbText}>لا يوجد لاعبون أنهوا التحدي بعد</Text>
              <Text style={styles.emptyLbSub}>كن أول من يفوز!</Text>
            </View>
          ) : (
            leaderboard.map((entry) => {
              const skin = SKINS.find(s => s.id === entry.skin) || SKINS[0];
              const isMe = entry.playerId === playerId;
              const mins = Math.floor(entry.durationSeconds / 60);
              const secs = entry.durationSeconds % 60;
              return (
                <View key={entry.playerId} style={[
                  styles.lbRow,
                  isMe && { borderColor: Colors.emerald + "60", backgroundColor: Colors.emerald + "08" },
                ]}>
                  <Text style={[styles.lbRank, {
                    color: entry.displayRank === 1 ? Colors.gold : entry.displayRank === 2 ? "#C0C0C0" : entry.displayRank === 3 ? "#CD7F32" : "#9898CC"
                  }]}>
                    {entry.displayRank === 1 ? "🥇" : entry.displayRank === 2 ? "🥈" : entry.displayRank === 3 ? "🥉" : `#${entry.displayRank}`}
                  </Text>
                  <View style={[styles.lbAvatar, { backgroundColor: skin.color + "33" }]}>
                    <Text style={styles.lbAvatarEmoji}>{skin.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbName, isMe && { color: Colors.emerald }]} numberOfLines={1}>
                      {entry.name}{isMe ? " (أنت)" : ""}
                    </Text>
                    <Text style={styles.lbMeta}>{entry.guessCount} محاولة · {mins > 0 ? `${mins}د ` : ""}{secs}ث</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Result Modal */}
      <Modal visible={resultModal} transparent animationType="fade" onRequestClose={() => setResultModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: winAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
            <LinearGradient colors={won ? [Colors.emerald + "22", "#001A10"] : [Colors.ruby + "22", "#1A0010"]} style={styles.modalGradient}>
              <Text style={styles.modalEmoji}>{won ? "🎉" : "😔"}</Text>
              <Text style={styles.modalTitle}>{won ? "ممتاز!" : "انتهت المحاولات"}</Text>
              {revealedWord && (
                <View style={styles.modalWordBox}>
                  <Text style={styles.modalWordLabel}>الكلمة كانت:</Text>
                  <Text style={styles.modalWord}>{revealedWord}</Text>
                </View>
              )}
              {coinsAwarded > 0 && (
                <View style={styles.modalCoins}>
                  <Text style={styles.modalCoinsText}>+{coinsAwarded} عملة 🪙</Text>
                </View>
              )}
              <View style={styles.modalStats}>
                <View style={styles.modalStat}>
                  <Text style={styles.modalStatVal}>{completedGuesses.length}</Text>
                  <Text style={styles.modalStatLabel}>محاولة</Text>
                </View>
                <View style={[styles.modalStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#1E3A5F" }]}>
                  <Text style={styles.modalStatVal}>{won ? "✓" : "✗"}</Text>
                  <Text style={styles.modalStatLabel}>{won ? "فائز" : "خسارة"}</Text>
                </View>
                <View style={styles.modalStat}>
                  <Text style={styles.modalStatVal}>{MAX_GUESSES - completedGuesses.length}</Text>
                  <Text style={styles.modalStatLabel}>متبقية</Text>
                </View>
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalLbBtn} onPress={() => {
                  setResultModal(false);
                  setTab("leaderboard");
                  loadLeaderboard();
                }}>
                  <Ionicons name="trophy" size={16} color={Colors.gold} />
                  <Text style={styles.modalLbBtnText}>ترتيب اليوم</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setResultModal(false)}>
                  <Text style={styles.modalCloseBtnText}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  centerContent: { justifyContent: "center", alignItems: "center" },
  loadingText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC", marginTop: 12 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF" },
  headerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC", marginTop: 2 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#0D2016", justifyContent: "center", alignItems: "center",
  },
  lbBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#0D2016", justifyContent: "center", alignItems: "center",
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  infoRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  infoBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  infoBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
  grid: { gap: 8, alignItems: "center" },
  gridRow: { flexDirection: "row", gap: 8 },
  cell: {
    width: 46, height: 52, borderRadius: 10, borderWidth: 2,
    justifyContent: "center", alignItems: "center",
  },
  cellText: { fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "center" },
  guessError: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.ruby, textAlign: "center" },
  submitBtn: {
    backgroundColor: Colors.emerald + "20", borderRadius: 14, paddingVertical: 14,
    alignItems: "center", borderWidth: 1.5, borderColor: Colors.emerald + "60",
  },
  submitBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.emerald },
  completedBanner: {
    borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1.5, gap: 8,
  },
  completedTitle: { fontFamily: "Cairo_700Bold", fontSize: 20 },
  revealedWord: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#E8E8FF" },
  coinsAwardedText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.gold },
  viewLbBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
    backgroundColor: Colors.gold + "18", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
  },
  viewLbBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.gold },
  keyboard: { gap: 6, paddingBottom: 16 },
  keyRow: { flexDirection: "row", justifyContent: "center", gap: 4, flexWrap: "wrap" },
  key: {
    minWidth: 30, height: 40, borderRadius: 8, paddingHorizontal: 6,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  keyText: { fontFamily: "Cairo_700Bold", fontSize: 16 },
  lbTitle: { fontFamily: "Cairo_700Bold", fontSize: 17, color: Colors.gold, textAlign: "center", marginBottom: 8 },
  lbRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D2016", borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#1E3A2F",
  },
  lbRank: { fontFamily: "Cairo_700Bold", fontSize: 16, minWidth: 30, textAlign: "center" },
  lbAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  lbAvatarEmoji: { fontSize: 20 },
  lbName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#E8E8FF" },
  lbMeta: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC" },
  emptyLb: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyLbText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#9898CC" },
  emptyLbSub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#5A5A88" },
  modalOverlay: {
    flex: 1, backgroundColor: "#000000AA", justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: { borderRadius: 24, overflow: "hidden", width: "100%", maxWidth: 360 },
  modalGradient: { padding: 28, alignItems: "center", gap: 12 },
  modalEmoji: { fontSize: 56 },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 24, color: "#E8E8FF" },
  modalWordBox: { alignItems: "center", gap: 4 },
  modalWordLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#9898CC" },
  modalWord: { fontFamily: "Cairo_700Bold", fontSize: 28, color: "#E8E8FF" },
  modalCoins: { backgroundColor: Colors.gold + "22", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 },
  modalCoinsText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  modalStats: { flexDirection: "row", marginTop: 4 },
  modalStat: { flex: 1, alignItems: "center", paddingVertical: 8 },
  modalStatVal: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#E8E8FF" },
  modalStatLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 8, width: "100%" },
  modalLbBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: Colors.gold + "18", borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.gold + "40",
  },
  modalLbBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.gold },
  modalCloseBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0D2016", borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: "#1E3A2F",
  },
  modalCloseBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC" },
});
