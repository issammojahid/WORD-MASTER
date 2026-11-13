import {useResultSound} from "@/lib/use-result-sound";
import {ScaledText as Text} from "@/components/ScaledText";
import { fetchWithTimeout } from "@/lib/network";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {View, StyleSheet, TouchableOpacity, ScrollView, Animated, Platform, ActivityIndicator, Modal, useWindowDimensions} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { GameHeader, GameScreenBackground, useReducedMotion } from "@/components/GameUi";
import { GameIcon, GameIllustration } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";

const ARABIC_KEYBOARD: string[][] = [
  ["ض", "ص", "ث", "ق", "ف"],
  ["غ", "ع", "ه", "خ", "ح"],
  ["ج", "د", "ذ", "ر", "ز"],
  ["س", "ش", "ط", "ظ", "ك"],
  ["م", "ن", "ت", "ا", "ل"],
  ["ب", "ي", "و", "ة", "إ"],
  ["أ", "آ", "ى", "ئ", "ء"],
  ["ؤ", "ُ", "⌫"],
];

type LetterStatus = "correct" | "present" | "absent" | "empty" | "typing";
type ColoringEntry = { letter: string; status: "correct" | "present" | "absent" };
const STATUS_COLORS: Record<LetterStatus, { bg: string; border: string; text: string }> = {
  correct: { bg: "#087C74", border: gameDesign.colors.offline, text: "#FFFFFF" },
  present: { bg: "#926900", border: gameDesign.colors.coins, text: "#FFFFFF" },
  absent: { bg: "#667887", border: "#4E6274", text: "#FFFFFF" },
  empty: { bg: "#D5F6FA", border: "#78CBD5", text: gameDesign.colors.textPrimary },
  typing: { bg: "#E8F4FF", border: gameDesign.colors.friends, text: gameDesign.colors.textPrimary },
};

const MAX_GUESSES = 6;

export default function DailyChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { playerId } = usePlayer();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [localPreview,setLocalPreview]=useState(false);
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
  const [countdown, setCountdown] = useState("");
  const [letterGuessMap, setLetterGuessMap] = useState<Record<string, LetterStatus>>({});

  const challengeDate=useRef("");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const winAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    if (reduceMotion) return;
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, shakeAnim]);

  const animateWin = useCallback(() => {
    if (reduceMotion) {
      winAnim.setValue(1);
      return;
    }
    winAnim.setValue(0);
    Animated.spring(winAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }).start();
  }, [reduceMotion, winAnim]);

  const loadChallengeRef = useRef(loadChallenge);
  loadChallengeRef.current = loadChallenge;
  useEffect(() => { if (playerId) void loadChallengeRef.current(); }, [playerId]);

  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    updateCountdown();
    return () => clearInterval(interval);
  }, []);

  function updateCountdown() {
    const now = new Date();
    const today=now.toISOString().slice(0,10);
    if(challengeDate.current&&challengeDate.current!==today){challengeDate.current=today;void loadChallengeRef.current();}
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
    setLoadError(false);
    try {
      const url = new URL(`/api/daily-challenge`, getApiUrl());
      url.searchParams.set("playerId", playerId);
      const res = await fetchWithTimeout(url.toString());
      if (!res.ok) throw new Error("server error");
      const data = await res.json();
      if(typeof data.letter!=="string"||!data.letter||!Number.isInteger(data.wordLength)||data.wordLength<3||data.wordLength>7)throw new Error("invalid challenge");
      challengeDate.current=data.date;
      setLocalPreview(data.local===true);
      setCompleted(false);setWon(false);setRevealedWord(null);setCompletedGuesses([]);setLetterGuessMap({});setCurrentInput("");setResultModal(false);setCoinsAwarded(0);setGuessError(null);
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
            const prevGuesses: ColoringEntry[][] = entry.coloring ?? entry.guesses.map((g: string) =>
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
      setLoadError(true);
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

  useResultSound(resultModal?"daily-result":null,won?"win":"lose");
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
    const activeDate=challengeDate.current;
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
      if(activeDate!==challengeDate.current){setSubmitting(false);return;}
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
        const colors = status === "empty" || status === "typing" ? { bg:theme.card, border:status === "typing" ? gameDesign.colors.coins : theme.cardBorder, text:theme.textPrimary } : STATUS_COLORS[status];
        cells.push(
          <View key={j} style={[styles.cell, { width:Math.min(46,(width-56)/wordLength-8), backgroundColor: colors.bg, borderColor: colors.border }]}>
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
        <View key={ri} style={[styles.keyRow, { maxWidth: width - 32 }]}>
          {row.map(key => {
            const status = letterGuessMap[key];
            const colors = status ? STATUS_COLORS[status] : { bg:theme.card, border:theme.cardBorder, text:theme.textPrimary };
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === "⌫" ? "حذف حرف" : key}
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
      <View style={[styles.container, styles.centerContent, { paddingTop: topInset, backgroundColor: theme.background }]}>
        <GameScreenBackground accent="offline" />

        <ActivityIndicator size="large" color={Colors.emerald} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>جاري تحميل تحدي اليوم...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <GameScreenBackground accent="offline" />
      <GameHeader
        title="تحدي اليوم"
        subtitle="كلمة واحدة، ست محاولات"
        onBack={() => router.back()}
        icon={<GameIcon name="dailyChallenge" size={23} color={Colors.emerald} />}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content,{paddingBottom:Math.max(104,bottomInset+80)}]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
          <View style={styles.challengeHeading}><Text style={[styles.challengeTitle,{color:theme.textPrimary}]}>اكتشف كلمة اليوم</Text><Text style={[styles.challengeHint,{color:theme.textSecondary}]}>التحدي التالي خلال {countdown}</Text></View>
          {localPreview&&!loadError?<Text style={[styles.challengeHint,{color:theme.textSecondary}]}>تحدٍّ محلي للتجربة · دون مكافآت العملات</Text>:null}
          {loadError ? <View style={[styles.completedBanner,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><GameIllustration name="reward" size={52}/><Text accessibilityRole="alert" style={[styles.challengeHint,{color:theme.textSecondary}]}>تعذر تحميل التحدي. تحقق من اتصالك ثم أعد المحاولة.</Text><TouchableOpacity accessibilityRole="button" onPress={()=>void loadChallenge()} style={styles.submitBtn}><Text style={styles.submitBtnText}>إعادة المحاولة</Text></TouchableOpacity></View> : <>
          {/* Info */}
          <View style={styles.infoRow}>
            <View style={[styles.infoBadge, { backgroundColor: Colors.emerald + "15", borderColor: Colors.emerald + "40" }]}>
              <Text style={[styles.infoBadgeText, { color: Colors.emerald }]}>حرف {letter}</Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: Colors.gold + "15", borderColor: Colors.gold + "40" }]}>
              <Text style={[styles.infoBadgeText, { color: Colors.gold }]}>{wordLength} أحرف</Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: `${gameDesign.colors.friends}15`, borderColor: `${gameDesign.colors.friends}40` }]}>
              <Text style={[styles.infoBadgeText, { color: gameDesign.colors.friends }]}>{completedGuesses.length}/{MAX_GUESSES}</Text>
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
                {won ? "أحسنت!" : "انتهت المحاولات"}
              </Text>
              {revealedWord && (
                <Text style={[styles.revealedWord, { color: theme.textPrimary }]}>الكلمة: {revealedWord}</Text>
              )}
              {coinsAwarded > 0 && (
                <View style={styles.coinAward}>
                  <GameIcon name="coins" size={18} color={Colors.gold} />
                  <Text style={styles.coinsAwardedText}>+{coinsAwarded} عملة</Text>
                </View>
              )}
            </View>
          )}

          {/* Keyboard */}
          {!completed && renderKeyboard()}
          <View style={styles.legend}>{[{color:"#087C74",label:"حرف في موضعه"},{color:"#926900",label:"حرف في موضع آخر"},{color:"#667887",label:"حرف غير موجود"}].map(item=><View key={item.label} style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:item.color}]}/><Text style={[styles.legendText,{color:theme.textSecondary}]}>{item.label}</Text></View>)}</View>
          </>}
        </ScrollView>

      {/* Result Modal */}
      <Modal visible={resultModal} transparent animationType="fade" onRequestClose={() => setResultModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <Animated.View style={[styles.modalCard, { borderColor: theme.cardBorder, transform: [{ scale: winAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
            <LinearGradient colors={[theme.backgroundTertiary, theme.card]} style={styles.modalGradient}>
              <GameIllustration name={won ? "victory" : "defeat"} size={72} />
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{won ? "ممتاز!" : "انتهت المحاولات"}</Text>
              {revealedWord && (
                <View style={styles.modalWordBox}>
                  <Text style={[styles.modalWordLabel, { color: theme.textSecondary }]}>الكلمة كانت:</Text>
                  <Text style={[styles.modalWord, { color: theme.textPrimary }]}>{revealedWord}</Text>
                </View>
              )}
              {coinsAwarded > 0 && (
                <View style={[styles.modalCoins, styles.modalCoinsInner]}>
                  <GameIcon name="coins" size={20} color={Colors.gold} />
                  <Text style={styles.modalCoinsText}>+{coinsAwarded} عملة</Text>
                </View>
              )}
              <View style={styles.modalStats}>
                <View style={styles.modalStat}>
                  <Text style={[styles.modalStatVal, { color: theme.textPrimary }]}>{completedGuesses.length}</Text>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>محاولة</Text>
                </View>
                <View style={[styles.modalStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.modalStatVal, { color: won ? gameDesign.colors.success : gameDesign.colors.danger }]}>{won ? "✓" : "✗"}</Text>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>{won ? "فائز" : "خسارة"}</Text>
                </View>
                <View style={styles.modalStat}>
                  <Text style={[styles.modalStatVal, { color: theme.textPrimary }]}>{MAX_GUESSES - completedGuesses.length}</Text>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>متبقية</Text>
                </View>
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]} onPress={() => setResultModal(false)}>
                  <Text style={[styles.modalCloseBtnText, { color: theme.textPrimary }]}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  centerContent: { justifyContent: "center", alignItems: "center" },
  loadingText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, marginTop: 12 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18 },
  headerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 2 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#102A29", justifyContent: "center", alignItems: "center",
  },
  content: { width:"100%", maxWidth:560, alignSelf:"center", padding:16, gap:14, paddingBottom: 110 },
  challengeHeading:{alignItems:"center",gap:4,paddingVertical:6},challengeTitle:{fontFamily:"Cairo_700Bold",fontSize:20},challengeHint:{fontFamily:"Cairo_400Regular",fontSize:12,textAlign:"center",lineHeight:22},legend:{flexDirection:"row-reverse",flexWrap:"wrap",gap:12,justifyContent:"center"},legendItem:{flexDirection:"row-reverse",gap:5,alignItems:"center"},legendDot:{width:8,height:8,borderRadius:3},legendText:{fontFamily:"Cairo_400Regular",fontSize:10},
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
    backgroundColor: gameDesign.colors.coins, borderRadius: 14, minHeight:48, paddingHorizontal:16, paddingVertical: 12,
    alignItems: "center", borderWidth: 1.5, borderColor: Colors.emerald + "60",
  },
  submitBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#21152F" },
  completedBanner: {
    borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1.5, gap: 8,
  },
  coinAward: { flexDirection: "row", alignItems: "center", gap: 7 },
  completedTitle: { fontFamily: "Cairo_700Bold", fontSize: 20 },
  revealedWord: { fontFamily: "Cairo_700Bold", fontSize: 22 },
  coinsAwardedText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.gold },
  keyboard: { gap: 6, paddingBottom: 16 },
  keyRow: { flexDirection: "row", justifyContent: "center", gap: 4, flexWrap: "wrap" },
  key: {
    minWidth: 44, minHeight: 44, flex: 1, borderRadius: 10, paddingHorizontal: 5,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  keyText: { fontFamily: "Cairo_700Bold", fontSize: 16 },
  modalOverlay: {
    flex: 1, backgroundColor: "#000000AA", justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: { borderRadius: 24, overflow: "hidden", width: "100%", maxWidth: 360 },
  modalGradient: { padding: 28, alignItems: "center", gap: 12 },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 24, color: "#F6F7FF" },
  modalWordBox: { alignItems: "center", gap: 4 },
  modalWordLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#9898CC" },
  modalWord: { fontFamily: "Cairo_700Bold", fontSize: 28, color: "#F6F7FF" },
  modalCoins: { backgroundColor: Colors.gold + "22", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 },
  modalCoinsInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalCoinsText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  modalStats: { flexDirection: "row", marginTop: 4 },
  modalStat: { flex: 1, alignItems: "center", paddingVertical: 8 },
  modalStatVal: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#F6F7FF" },
  modalStatLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 8, width: "100%" },
  modalCloseBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#102A29", borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: "#1E3A2F",
  },
  modalCloseBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC" },
});
