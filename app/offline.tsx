import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { ARABIC_LETTERS, GAME_CATEGORIES, GameCategory } from "@/constants/i18n";

const ROUND_TIME = 50;
const TOTAL_ROUNDS = 5;

type CategoryStatus = "correct" | "duplicate" | "empty" | "invalid";

const AI_PLAYERS = [
  { name: "بوت الذكاء", emoji: "🤖" },
  { name: "روبوت الكلمات", emoji: "🦾" },
];

function getAIAnswer(cat: GameCategory, letter: string): string {
  const aiWords: Partial<Record<string, Partial<Record<GameCategory, string[]>>>> = {
    "أ": { girlName: ["أمل","آية","أسماء"], boyName: ["أحمد","أمير","أنس"], animal: ["أسد","أرنب"], fruit: ["أناناس","أجاص"], vegetable: ["أرضيشوكي"], object: ["أريكة","أقلام"], city: ["الدار البيضاء"], country: ["الجزائر"] },
    "ب": { girlName: ["بتول","بسمة"], boyName: ["بلال","بكر"], animal: ["بقرة","بطة"], fruit: ["بطيخ","برتقال"], vegetable: ["باذنجان","بطاطس"], object: ["باب","بساط"], city: ["بيروت","بغداد"], country: ["البحرين"] },
    "س": { girlName: ["سارة","سلمى"], boyName: ["سامر","سالم"], animal: ["سمكة","سلطعون"], fruit: ["سفرجل"], vegetable: ["سبانخ","سلق"], object: ["سيارة","سرير"], city: ["سطات"], country: ["سوريا"] },
    "م": { girlName: ["مريم","منى"], boyName: ["محمد","مراد"], animal: ["ماعز","مها"], fruit: ["مانغو","موز"], vegetable: ["ملفوف","ملوخية"], object: ["مكتب","مفتاح"], city: ["مراكش","مكناس"], country: ["المغرب","مصر"] },
    "ف": { girlName: ["فاطمة","فريدة"], boyName: ["فادي","فارس"], animal: ["فهد","فيل","فراشة"], fruit: ["فراولة","فستق"], vegetable: ["فلفل","فجل"], object: ["فرن","فنجان"], city: ["فاس"], country: ["فرنسا"] },
    "ر": { girlName: ["رانيا","ريم"], boyName: ["رامي","راشد"], animal: ["رخ"], fruit: ["رمان","رطب"], vegetable: ["ريحان","رجلة"], object: ["راديو","رسالة"], city: ["الرباط"], country: ["روسيا"] },
    "ن": { girlName: ["نور","نادية"], boyName: ["ناصر","نادر"], animal: ["نمر","نسر","نحلة"], fruit: ["نخيل","نارنج"], vegetable: ["نعناع","نبات"], object: ["نافذة","نظارة"], city: ["الناظور"], country: ["نيجيريا"] },
    "ح": { girlName: ["حنان","حياة"], boyName: ["حاتم","حازم"], animal: ["حمار","حصان","حمامة"], fruit: ["حمض"], vegetable: ["حلبة","حميض"], object: ["حاسوب","حقيبة"], city: ["الحسيمة"], country: ["الحبشة"] },
    "ع": { girlName: ["عائشة","علياء"], boyName: ["عادل","عامر"], animal: ["عنكبوت","عقرب","عقاب"], fruit: ["عنب"], vegetable: ["عدس"], object: ["عصا","عربة"], city: ["العرائش"], country: ["العراق"] },
    "ط": { girlName: ["طيبة","طيف"], boyName: ["طارق","طاهر"], animal: ["طاووس","طيور"], fruit: [], vegetable: ["طماطم","طرخون"], object: ["طاولة","طبق","طيارة"], city: ["طنجة","طنجة"], country: ["تركيا"] },
    "ك": { girlName: ["كريمة","كوثر"], boyName: ["كريم","كامل"], animal: ["كلب","كنغر"], fruit: ["كرز","كمثرى"], vegetable: ["كرات","كراث"], object: ["كتاب","كمبيوتر","كرسي"], city: ["الكويت"], country: ["كينيا"] },
    "ل": { girlName: ["لمياء","لين"], boyName: ["لقمان","لؤي"], animal: ["لبؤة","لقلق"], fruit: ["لوز","ليمون"], vegetable: ["لفت","لوبيا"], object: ["لمبة","لوحة","لعبة"], city: ["العرائش"], country: ["لبنان","ليبيا"] },
    "هـ": { girlName: ["هدى","هناء"], boyName: ["هادي","هاشم"], animal: ["هدهد","هرة"], fruit: [], vegetable: ["هليون","هندباء"], object: ["هاتف","هدية"], city: [], country: [] },
    "و": { girlName: ["وفاء","ولاء"], boyName: ["وائل","واثق"], animal: ["وعل","وردية"], fruit: [], vegetable: ["ورد"], object: ["وسادة","وعاء","ورق"], city: ["وجدة"], country: [] },
  };

  const data = aiWords[letter];
  if (!data) return "";
  const options = (data[cat] as string[]) || [];
  if (!options.length) return "";
  // Random with 70% chance of answering
  if (Math.random() > 0.7) return "";
  return options[Math.floor(Math.random() * options.length)];
}

type RoundResultEntry = {
  name: string;
  emoji?: string;
  isAI?: boolean;
  answers: Record<GameCategory, string>;
  scores: Record<GameCategory, number>;
  status: Record<GameCategory, CategoryStatus>;
  total: number;
};

function pickRandomLetter(used: string[] = []): string {
  const available = ARABIC_LETTERS.filter((l) => !used.includes(l));
  const pool = available.length > 0 ? available : ARABIC_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { profile, addCoins, addXp, updateProfile } = usePlayer();

  const [phase, setPhase] = useState<"playing" | "results" | "gameOver">("playing");
  const [currentRound, setCurrentRound] = useState(1);
  const [usedLetters, setUsedLetters] = useState<string[]>([]);
  const [currentLetter, setCurrentLetter] = useState(() => pickRandomLetter());
  const [answers, setAnswers] = useState<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [roundResults, setRoundResults] = useState<RoundResultEntry[] | null>(null);
  const [playerTotals, setPlayerTotals] = useState<Record<string, number>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const letterAnim = useRef(new Animated.Value(0)).current;
  const answersRef = useRef(answers);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    letterAnim.setValue(0);
    Animated.spring(letterAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
    startTimer();
    return () => stopTimer();
  }, [currentRound, currentLetter]);

  const startTimer = () => {
    stopTimer();
    setTimeLeft(ROUND_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          doCalculate(answersRef.current);
          return 0;
        }
        if (prev <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const doCalculate = useCallback((submittedAnswers: Record<GameCategory, string>) => {
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const letter = currentLetter;
    const allParticipants = [
      { name: profile.name, emoji: undefined as string | undefined, isAI: false, answers: submittedAnswers },
      ...AI_PLAYERS.map((ai) => ({
        name: ai.name, emoji: ai.emoji, isAI: true,
        answers: Object.fromEntries(GAME_CATEGORIES.map((cat) => [cat, getAIAnswer(cat, letter)])) as Record<GameCategory, string>,
      })),
    ];

    const answerCounts: Partial<Record<GameCategory, Map<string, number>>> = {};
    for (const cat of GAME_CATEGORIES) {
      const m = new Map<string, number>();
      for (const p of allParticipants) {
        const ans = (p.answers[cat] || "").trim().toLowerCase();
        if (ans) m.set(ans, (m.get(ans) || 0) + 1);
      }
      answerCounts[cat] = m;
    }

    const allEntries: RoundResultEntry[] = [];
    for (const participant of allParticipants) {
      const scores = {} as Record<GameCategory, number>;
      const status = {} as Record<GameCategory, CategoryStatus>;
      let total = 0;

      for (const cat of GAME_CATEGORIES) {
        const ans = (participant.answers[cat] || "").trim();
        if (!ans) { scores[cat] = 0; status[cat] = "empty"; }
        else {
          const norm = ans.replace(/[أإآ]/g, "أ");
          const normLetter = letter.replace(/[أإآ]/g, "أ");
          if (!norm.startsWith(normLetter)) { scores[cat] = 0; status[cat] = "invalid"; }
          else {
            const count = answerCounts[cat]?.get(ans.toLowerCase()) || 0;
            if (count > 1) { scores[cat] = 0; status[cat] = "duplicate"; }
            else { scores[cat] = 3; status[cat] = "correct"; }
          }
        }
        total += scores[cat];
      }
      allEntries.push({ name: participant.name, emoji: participant.emoji, isAI: participant.isAI, answers: participant.answers, scores, status, total });
    }

    setRoundResults(allEntries);
    setPlayerTotals((prev) => {
      const updated = { ...prev };
      for (const e of allEntries) updated[e.name] = (updated[e.name] || 0) + e.total;
      return updated;
    });
    setSubmitted(true);
    setPhase("results");
  }, [currentLetter, profile.name]);

  const handleSubmit = () => {
    if (submitted) return;
    stopTimer();
    doCalculate(answers);
  };

  const handleNextRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentRound >= TOTAL_ROUNDS) {
      setPhase("gameOver");
      const myTotal = (playerTotals[profile.name] || 0);
      const allTotals = Object.values(playerTotals).sort((a, b) => b - a);
      const myRank = allTotals.indexOf(myTotal);
      const coinRewards = [20, 15, 10, 5];
      addCoins(coinRewards[Math.min(myRank, coinRewards.length - 1)]);
      addXp(Math.floor(myTotal / 2));
      updateProfile({ gamesPlayed: profile.gamesPlayed + 1, wins: myRank === 0 ? profile.wins + 1 : profile.wins, totalScore: profile.totalScore + myTotal });
      return;
    }
    const nextLetter = pickRandomLetter([...usedLetters, currentLetter]);
    setUsedLetters((prev) => [...prev, currentLetter]);
    setCurrentLetter(nextLetter);
    setCurrentRound((prev) => prev + 1);
    setAnswers({} as Record<GameCategory, string>);
    setSubmitted(false);
    setRoundResults(null);
    setPhase("playing");
  };

  const resetGame = () => {
    const first = pickRandomLetter();
    setPhase("playing");
    setCurrentRound(1);
    setUsedLetters([]);
    setCurrentLetter(first);
    setAnswers({} as Record<GameCategory, string>);
    setSubmitted(false);
    setRoundResults(null);
    setPlayerTotals({});
    letterAnim.setValue(0);
  };

  const timerColor = timeLeft > 15 ? Colors.timerGreen : timeLeft > 8 ? Colors.timerYellow : Colors.timerRed;
  const timerProgress = timeLeft / ROUND_TIME;

  if (phase === "gameOver") {
    const sorted = Object.entries(playerTotals).sort(([, a], [, b]) => b - a);
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <ScrollView contentContainerStyle={styles.gameOverContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.gameOverTitle}>{t.gameOver}</Text>
          <View style={styles.trophyCircle}><Ionicons name="trophy" size={56} color={Colors.gold} /></View>
          <View style={styles.finalRankings}>
            {sorted.map(([name, score], idx) => {
              const isMe = name === profile.name;
              const rc = [Colors.rank1, Colors.rank2, Colors.rank3];
              return (
                <View key={name} style={[styles.finalRankRow, isMe && styles.finalRankRowMe]}>
                  <Text style={[styles.finalRankNum, { color: rc[idx] || Colors.textMuted }]}>{idx + 1}</Text>
                  <Text style={styles.finalRankName}>{name}{isMe ? " ★" : ""}</Text>
                  <Text style={styles.finalRankScore}>{score}</Text>
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={styles.playAgainBtn} onPress={resetGame}>
            <Text style={styles.playAgainBtnText}>{t.playAgain}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Text style={styles.homeBtnText}>{t.backToHome}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (phase === "results" && roundResults) {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.roundResultsHeader}>
          <Text style={styles.roundResultsTitle}>{t.results} - {t.round} {currentRound}/{TOTAL_ROUNDS}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.roundResultsContent} showsVerticalScrollIndicator={false}>
          {roundResults.map((entry) => (
            <View key={entry.name} style={[styles.resultPlayerCard, entry.name === profile.name && styles.resultPlayerCardMe]}>
              <View style={styles.resultPlayerHeader}>
                <View style={styles.resultPlayerLeft}>
                  {entry.emoji && <Text style={{ fontSize: 20, marginRight: 8 }}>{entry.emoji}</Text>}
                  <Text style={styles.resultPlayerName}>{entry.name}</Text>
                </View>
                <View style={styles.resultTotalBadge}><Text style={styles.resultTotalText}>+{entry.total}</Text></View>
              </View>
              {GAME_CATEGORIES.map((cat) => {
                const ans = entry.answers[cat] || "";
                const sc = entry.scores[cat] || 0;
                const st = entry.status[cat] || "empty";
                const sc2 = st === "correct" ? Colors.scoreCorrect : st === "duplicate" ? Colors.scoreDuplicate : Colors.scoreEmpty;
                return (
                  <View key={cat} style={styles.resultCatRow}>
                    <Text style={styles.resultCatName}>{t[cat as keyof typeof t] as string}</Text>
                    <Text style={[styles.resultAnswer, !ans && styles.resultAnswerEmpty]}>{ans || "—"}</Text>
                    <View style={[styles.resultScoreBadge, { backgroundColor: sc2 + "22" }]}>
                      <Text style={[styles.resultScoreText, { color: sc2 }]}>{sc > 0 ? `+${sc}` : "0"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreSummaryTitle}>المجموع الكلي</Text>
            {Object.entries(playerTotals).sort(([, a], [, b]) => b - a).map(([name, score], idx) => (
              <View key={name} style={styles.scoreSummaryRow}>
                <Text style={styles.scoreSummaryRank}>{idx + 1}</Text>
                <Text style={styles.scoreSummaryName}>{name}</Text>
                <Text style={styles.scoreSummaryTotal}>{score}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.nextRoundBtn} onPress={handleNextRound}>
          <Text style={styles.nextRoundBtnText}>{currentRound >= TOTAL_ROUNDS ? t.gameOver : t.nextRound}</Text>
          <Ionicons name="arrow-forward" size={20} color={Colors.black} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.gameTopBar}>
        <TouchableOpacity style={styles.backBtnSmall} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Animated.View style={[styles.letterDisplay, { transform: [{ scale: letterAnim }] }]}>
          <Text style={styles.letterText}>{currentLetter}</Text>
        </Animated.View>
        <View style={styles.gameInfoRight}>
          <Text style={styles.roundLabel}>{t.round} {currentRound}/{TOTAL_ROUNDS} · وضع غير متصل</Text>
          <View style={styles.timerContainer}>
            <View style={styles.timerTrack}>
              <View style={[styles.timerFill, { width: `${timerProgress * 100}%` as any, backgroundColor: timerColor }]} />
            </View>
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.inputsContent, { paddingBottom: bottomInset + 80 }]}
        showsVerticalScrollIndicator={false}
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
      >
        {GAME_CATEGORIES.map((cat) => (
          <View key={cat} style={styles.categoryInputRow}>
            <Text style={styles.categoryLabel}>{t[cat as keyof typeof t] as string}</Text>
            <TextInput
              style={[styles.categoryInput, !!(answers[cat]) && styles.categoryInputFilled, submitted && styles.categoryInputSubmitted]}
              value={answers[cat] || ""}
              onChangeText={(val) => { if (!submitted) setAnswers((prev) => ({ ...prev, [cat]: val })); }}
              placeholder={`${currentLetter}...`}
              placeholderTextColor={Colors.inputPlaceholder}
              editable={!submitted}
              textAlign="right"
              autoCorrect={false}
            />
          </View>
        ))}
      </KeyboardAwareScrollView>

      {!submitted ? (
        <TouchableOpacity style={[styles.submitBtn, { bottom: bottomInset + 12 }]} onPress={handleSubmit}>
          <Ionicons name="send" size={20} color={Colors.black} style={{ marginRight: 8 }} />
          <Text style={styles.submitBtnText}>{t.submit}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.submittedState, { bottom: bottomInset + 12 }]}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.emerald} />
          <Text style={styles.submittedStateText}>جاري حساب النتائج...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  backBtnSmall: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.card, justifyContent: "center", alignItems: "center", marginRight: 10 },
  gameTopBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.backgroundSecondary, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  letterDisplay: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gold, justifyContent: "center", alignItems: "center", marginRight: 14, shadowColor: Colors.gold, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  letterText: { fontFamily: "Cairo_700Bold", fontSize: 36, color: Colors.black, lineHeight: 48 },
  gameInfoRight: { flex: 1 },
  roundLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  timerContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  timerTrack: { flex: 1, height: 8, backgroundColor: Colors.cardBorder, borderRadius: 4, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 4 },
  timerText: { fontFamily: "Cairo_700Bold", fontSize: 22, minWidth: 32, textAlign: "center" },
  inputsContent: { padding: 12, gap: 8 },
  categoryInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.textSecondary, width: 72, textAlign: "right" },
  categoryInput: { flex: 1, backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontFamily: "Cairo_400Regular", color: Colors.inputText },
  categoryInputFilled: { borderColor: Colors.gold + "80", backgroundColor: Colors.gold + "10" },
  categoryInputSubmitted: { opacity: 0.7 },
  submitBtn: { position: "absolute", left: 16, right: 16, backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  submitBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  submittedState: { position: "absolute", left: 16, right: 16, backgroundColor: Colors.emerald + "22", borderRadius: 16, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.emerald + "40" },
  submittedStateText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.emerald },
  roundResultsHeader: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.backgroundSecondary },
  roundResultsTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary, textAlign: "center" },
  roundResultsContent: { padding: 12, gap: 12, paddingBottom: 100 },
  resultPlayerCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  resultPlayerCardMe: { borderColor: Colors.gold + "60" },
  resultPlayerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  resultPlayerLeft: { flexDirection: "row", alignItems: "center" },
  resultPlayerName: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary },
  resultTotalBadge: { backgroundColor: Colors.gold + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  resultTotalText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  resultCatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderTopWidth: 1, borderTopColor: Colors.cardBorder + "50" },
  resultCatName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted, width: 64, textAlign: "right" },
  resultAnswer: { flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textPrimary, textAlign: "center", paddingHorizontal: 6 },
  resultAnswerEmpty: { color: Colors.textMuted },
  resultScoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, minWidth: 32, alignItems: "center" },
  resultScoreText: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  scoreSummary: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  scoreSummaryTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary, textAlign: "center", marginBottom: 10 },
  scoreSummaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  scoreSummaryRank: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold, width: 30, textAlign: "center" },
  scoreSummaryName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 10 },
  scoreSummaryTotal: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  nextRoundBtn: { backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16, marginHorizontal: 16, marginVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  nextRoundBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  gameOverContent: { padding: 20, alignItems: "center", paddingBottom: 40 },
  gameOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 32, color: Colors.textPrimary, textAlign: "center", marginBottom: 20 },
  trophyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.gold + "22", justifyContent: "center", alignItems: "center", marginBottom: 20, borderWidth: 2, borderColor: Colors.gold + "40" },
  finalRankings: { width: "100%", gap: 10, marginBottom: 24 },
  finalRankRow: { backgroundColor: Colors.card, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  finalRankRowMe: { borderColor: Colors.gold + "60" },
  finalRankNum: { fontFamily: "Cairo_700Bold", fontSize: 20, width: 36, textAlign: "center" },
  finalRankName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 15, color: Colors.textPrimary, paddingHorizontal: 10 },
  finalRankScore: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  playAgainBtn: { backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, marginBottom: 12, shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  playAgainBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  homeBtn: { backgroundColor: Colors.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40, borderWidth: 1, borderColor: Colors.cardBorder },
  homeBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: Colors.textSecondary },
});
