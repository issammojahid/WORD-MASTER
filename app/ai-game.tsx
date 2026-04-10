import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  ImageBackground,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { GAME_CATEGORIES, type GameCategory, ARABIC_LETTERS } from "@/constants/i18n";
import { playSound } from "@/lib/sound-manager";
import { LinearGradient } from "expo-linear-gradient";

const AI_BG: [string, string, string] = ["#010D07", "#011A0D", "#010D07"];

type Difficulty = "easy" | "normal" | "hard" | "legendary";

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    label: string;
    emoji: string;
    desc: string;
    color: string;
    minDelay: number;
    maxDelay: number;
    missRate: number;
  }
> = {
  easy: {
    label: "سهل",
    emoji: "🌱",
    desc: "استجابة بطيئة، كلمات بسيطة، يخطئ أحياناً",
    color: Colors.emerald,
    minDelay: 5000,
    maxDelay: 8000,
    missRate: 0.4,
  },
  normal: {
    label: "متوسط",
    emoji: "⚡",
    desc: "سرعة ومفردات معتدلة",
    color: Colors.gold,
    minDelay: 3000,
    maxDelay: 5000,
    missRate: 0.2,
  },
  hard: {
    label: "صعب",
    emoji: "🔥",
    desc: "استجابة سريعة ومفردات قوية",
    color: Colors.ruby,
    minDelay: 2000,
    maxDelay: 3000,
    missRate: 0.1,
  },
  legendary: {
    label: "أسطوري",
    emoji: "👑",
    desc: "شبه مستحيل — ذكاء اصطناعي كامل",
    color: "#BF00FF",
    minDelay: 1000,
    maxDelay: 2000,
    missRate: 0.02,
  },
};

const ROUND_TIME = 50;
const TOTAL_ROUNDS = 3;

type CategoryStatus = "idle" | "correct" | "duplicate" | "empty" | "invalid";

type RoundResult = {
  category: GameCategory;
  playerAnswer: string;
  aiAnswer: string;
  playerStatus: CategoryStatus;
  aiStatus: CategoryStatus;
  playerScore: number;
  aiScore: number;
};

type GamePhase = "difficulty" | "loading" | "playing" | "roundResults" | "gameOver";

const CAT_LABEL: Record<GameCategory, string> = {
  girlName: "اسم بنت",
  boyName: "اسم ولد",
  animal: "حيوان",
  fruit: "فاكهة",
  vegetable: "خضرة",
  object: "شيء",
  city: "مدينة",
  country: "دولة",
};

function pickLetter(used: string[]): string {
  const available = ARABIC_LETTERS.filter((l) => !used.includes(l));
  const pool = available.length > 0 ? available : ARABIC_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalize(word: string): string {
  return word
    .trim()
    .replace(/\s+/g, " ")                // collapse multiple spaces
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")  // diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")             // alef variants → plain alef
    .replace(/[ؤ]/g, "و")               // waw with hamza
    .replace(/[ئ]/g, "ي")               // ya with hamza
    .replace(/ى/g, "ي")                 // alef maqsura
    .replace(/ة/g, "ه")                 // ta marbuta
    .toLowerCase();
}

function statusColor(s: CategoryStatus, muted: string): string {
  if (s === "correct") return Colors.emerald;
  if (s === "duplicate") return Colors.gold;
  return muted;
}

export default function AIGameScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { profile, addXp, updateProfile } = usePlayer();
  const { theme } = useTheme();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [phase, setPhase] = useState<GamePhase>("difficulty");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [currentRound, setCurrentRound] = useState(1);
  const [currentLetter, setCurrentLetter] = useState("");
  const [usedLetters, setUsedLetters] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [playerAnswers, setPlayerAnswers] = useState<Record<GameCategory, string>>(
    {} as Record<GameCategory, string>
  );
  const [aiAnswers, setAiAnswers] = useState<Record<GameCategory, string>>(
    {} as Record<GameCategory, string>
  );
  const [aiThinking, setAiThinking] = useState<Set<GameCategory>>(new Set());
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [playerTotalScore, setPlayerTotalScore] = useState(0);
  const [aiTotalScore, setAiTotalScore] = useState(0);
  const [wordPool, setWordPool] = useState<Record<string, string[]>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const submittedRef = useRef(false);
  const playerAnswersRef = useRef<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const aiAnswersRef = useRef<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  // Ref mirror of wordPool so the timer callback can always access the current pool
  const wordPoolRef = useRef<Record<string, string[]>>({});
  const letterAnim = useRef(new Animated.Value(0)).current;
  const gameOverCalcDone = useRef(false);

  useEffect(() => {
    playerAnswersRef.current = playerAnswers;
  }, [playerAnswers]);

  useEffect(() => {
    aiAnswersRef.current = aiAnswers;
  }, [aiAnswers]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearAiTimeouts = () => {
    aiTimeoutsRef.current.forEach((id) => clearTimeout(id));
    aiTimeoutsRef.current = [];
  };

  useEffect(() => {
    return () => {
      stopTimer();
      clearAiTimeouts();
    };
  }, []);

  const fetchWordPool = async (letter: string): Promise<Record<string, string[]>> => {
    try {
      const url = new URL("/api/words", getApiUrl());
      url.searchParams.set("letter", letter);
      const res = await fetch(url.toString());
      if (res.ok) return await res.json();
    } catch {}
    return {};
  };

  const submitRound = useCallback(
    async (
      pAnswers: Record<GameCategory, string>,
      aAnswers: Record<GameCategory, string>,
      letter: string,
    ) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitted(true);
      clearAiTimeouts();
      stopTimer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Client-side validation using the pre-fetched word pool.
      // Each pool entry is already filtered to the current letter by the server,
      // so we only need to check membership after normalisation.
      const pool = wordPoolRef.current;
      const playerValid: Record<GameCategory, boolean> = {} as Record<GameCategory, boolean>;
      for (const cat of GAME_CATEGORIES) {
        const answer = (pAnswers[cat] || "").trim();
        if (answer.length < 2) {
          playerValid[cat] = false;
          continue;
        }
        const normAnswer = normalize(answer);
        const words = pool[cat] || [];
        const normSet = new Set(words.map(normalize));
        // Accept with or without the definite article ال
        const stripped = normAnswer.startsWith("ال") ? normAnswer.slice(2) : normAnswer;
        playerValid[cat] =
          normSet.has(normAnswer) ||
          normSet.has(stripped) ||
          normSet.has("ال" + stripped);
      }

      const results: RoundResult[] = [];
      let pRound = 0;
      let aRound = 0;

      for (const cat of GAME_CATEGORIES) {
        const pAnswer = (pAnswers[cat] || "").trim();
        const aAnswer = (aAnswers[cat] || "").trim();
        const pIsValid = pAnswer.length >= 2 && playerValid[cat];
        const aIsValid = aAnswer.length >= 2;

        // Scoring rules:
        //  valid + different from AI  → player 10, AI 10
        //  valid + same as AI answer  → player  5, AI  5 (duplicate)
        //  invalid / empty            → player  0, AI 10 (if AI had answer)
        const isSameAsAi =
          pIsValid && aIsValid && normalize(pAnswer) === normalize(aAnswer);

        let pScore = 0;
        let aScore = 0;
        let pStatus: CategoryStatus = pAnswer ? "invalid" : "empty";
        let aStatus: CategoryStatus = aAnswer ? "correct" : "empty";

        if (isSameAsAi) {
          pScore = 5;
          aScore = 5;
          pStatus = "duplicate";
          aStatus = "duplicate";
        } else {
          if (pIsValid) {
            pScore = 10;
            pStatus = "correct";
          }
          if (aIsValid) {
            aScore = 10;
          }
        }

        pRound += pScore;
        aRound += aScore;

        results.push({
          category: cat,
          playerAnswer: pAnswer,
          aiAnswer: aAnswer,
          playerStatus: pStatus,
          aiStatus: aStatus,
          playerScore: pScore,
          aiScore: aScore,
        });
      }

      setRoundResults(results);
      setPlayerTotalScore((prev) => prev + pRound);
      setAiTotalScore((prev) => prev + aRound);
      setPhase("roundResults");
      const hasCorrect = results.some((r) => r.playerStatus === "correct");
      const allBad = results.every((r) => r.playerStatus === "empty" || r.playerStatus === "invalid");
      if (hasCorrect) playSound("correct");
      else if (allBad) playSound("wrong");
    },
    []
  );

  const launchRound = useCallback(
    (round: number, letter: string, pool: Record<string, string[]>, diff: Difficulty) => {
      setCurrentRound(round);
      setCurrentLetter(letter);
      setTimeLeft(ROUND_TIME);
      setSubmitted(false);
      submittedRef.current = false;
      setPlayerAnswers({} as Record<GameCategory, string>);
      setAiAnswers({} as Record<GameCategory, string>);
      aiAnswersRef.current = {} as Record<GameCategory, string>;
      playerAnswersRef.current = {} as Record<GameCategory, string>;
      setAiThinking(new Set(GAME_CATEGORIES));
      setRoundResults(null);

      letterAnim.setValue(0);
      Animated.spring(letterAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();

      const config = DIFFICULTY_CONFIG[diff];

      clearAiTimeouts();
      GAME_CATEGORIES.forEach((cat) => {
        const delay = randInt(config.minDelay, config.maxDelay);
        const willMiss = Math.random() < config.missRate;
        const words = pool[cat] || [];

        const tid = setTimeout(() => {
          if (submittedRef.current) return;
          setAiThinking((prev) => {
            const next = new Set(prev);
            next.delete(cat);
            return next;
          });
          if (!willMiss && words.length > 0) {
            const word = words[Math.floor(Math.random() * words.length)];
            setAiAnswers((prev) => ({ ...prev, [cat]: word }));
            aiAnswersRef.current = { ...aiAnswersRef.current, [cat]: word };
          }
        }, delay);
        aiTimeoutsRef.current.push(tid);
      });

      stopTimer();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            submitRound(playerAnswersRef.current, aiAnswersRef.current, letter);
            return 0;
          }
          if (prev <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return prev - 1;
        });
      }, 1000);

      setPhase("playing");
    },
    [submitRound]
  );

  const handleStartGame = async (diff: Difficulty) => {
    setDifficulty(diff);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase("loading");
    const letter = pickLetter([]);
    setUsedLetters([letter]);
    setPlayerTotalScore(0);
    setAiTotalScore(0);
    gameOverCalcDone.current = false;
    const pool = await fetchWordPool(letter);
    wordPoolRef.current = pool;
    setWordPool(pool);
    launchRound(1, letter, pool, diff);
  };

  const handleNextRound = async () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setPhase("gameOver");
      return;
    }
    const nextRound = currentRound + 1;
    const newLetter = pickLetter([...usedLetters]);
    setUsedLetters((prev) => [...prev, newLetter]);
    setPhase("loading");
    const pool = await fetchWordPool(newLetter);
    wordPoolRef.current = pool;
    setWordPool(pool);
    launchRound(nextRound, newLetter, pool, difficulty);
  };

  useEffect(() => {
    if (phase === "gameOver" && !gameOverCalcDone.current) {
      gameOverCalcDone.current = true;
      const won = playerTotalScore > aiTotalScore;
      playSound(won ? "win" : "lose");
      const xpGain = Math.max(10, Math.floor(playerTotalScore / 2));
      addXp(xpGain);
      updateProfile({
        gamesPlayed: profile.gamesPlayed + 1,
        wins: won ? profile.wins + 1 : profile.wins,
        totalScore: profile.totalScore + playerTotalScore,
      });
    }
  }, [phase]);

  const handlePlayAgain = () => {
    stopTimer();
    clearAiTimeouts();
    setPhase("difficulty");
    setCurrentRound(1);
    setUsedLetters([]);
    setPlayerTotalScore(0);
    setAiTotalScore(0);
    setRoundResults(null);
    gameOverCalcDone.current = false;
  };

  const timerColor =
    timeLeft <= 10 ? Colors.ruby : timeLeft <= 20 ? Colors.gold : Colors.emerald;
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  if (phase === "difficulty") {
    return (
      <View style={[styles.container, { paddingTop: topInset, backgroundColor: theme.background }]}>
        <ImageBackground source={require("../assets/images/bg_ai.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover"><View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} /></ImageBackground>
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.card }]}>
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>اللعب ضد الذكاء الاصطناعي</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.diffContent, { paddingBottom: bottomInset + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.aiHero}>
            <Text style={styles.aiHeroEmoji}>🤖</Text>
            <Text style={[styles.aiHeroTitle, { color: theme.textPrimary }]}>تحدّى الذكاء الاصطناعي</Text>
            <Text style={[styles.aiHeroSub, { color: theme.textMuted }]}>
              {TOTAL_ROUNDS} جولات • 50 ثانية لكل جولة • 8 فئات
            </Text>
          </View>

          {(
            Object.entries(DIFFICULTY_CONFIG) as [
              Difficulty,
              (typeof DIFFICULTY_CONFIG)[Difficulty]
            ][]
          ).map(([key, cfg]) => (
            <TouchableOpacity
              key={key}
              style={[styles.diffCard, { borderColor: cfg.color + "60" }]}
              onPress={() => handleStartGame(key)}
              activeOpacity={0.85}
            >
              <View style={[styles.diffIcon, { backgroundColor: cfg.color + "18" }]}>
                <Text style={styles.diffEmoji}>{cfg.emoji}</Text>
              </View>
              <View style={styles.diffText}>
                <Text style={[styles.diffLabel, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={[styles.diffDesc, { color: theme.textSecondary }]}>{cfg.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={cfg.color + "90"} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (phase === "loading") {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", backgroundColor: theme.background }]}>
        <ImageBackground source={require("../assets/images/bg_ai.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover"><View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} /></ImageBackground>
        <Text style={styles.loadingEmoji}>🤖</Text>
        <Text style={styles.loadingText}>جاري التحضير...</Text>
      </View>
    );
  }

  if (phase === "playing") {
    return (
      <View style={[styles.container, { paddingTop: topInset, backgroundColor: theme.background }]}>
        <ImageBackground source={require("../assets/images/bg_ai.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover"><View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} /></ImageBackground>
        <View style={[styles.gameHeader, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.gameHeaderLeft}>
            <Text style={[styles.roundLabel, { color: theme.textSecondary }]}>جولة {currentRound}/{TOTAL_ROUNDS}</Text>
            <Text style={[styles.diffBadge, { color: diffConfig.color }]}>
              {diffConfig.emoji} {diffConfig.label}
            </Text>
          </View>

          <Animated.View
            style={[
              styles.letterBadge,
              { opacity: letterAnim, transform: [{ scale: letterAnim }] },
            ]}
          >
            <Text style={styles.letterText}>{currentLetter}</Text>
          </Animated.View>

          <View
            style={[
              styles.timerBadge,
              { backgroundColor: timerColor + "22", borderColor: timerColor + "50" },
            ]}
          >
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        </View>

        <View style={styles.scoreBanner}>
          <View style={styles.scoreHalf}>
            <Text style={styles.scoreName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={[styles.scoreNum, { color: Colors.gold }]}>{playerTotalScore}</Text>
          </View>
          <Text style={styles.vsChip}>VS</Text>
          <View style={[styles.scoreHalf, { alignItems: "flex-start" }]}>
            <Text style={[styles.scoreNum, { color: Colors.ruby }]}>{aiTotalScore}</Text>
            <Text style={styles.scoreName}>🤖 AI</Text>
          </View>
        </View>

        {/* AI answer column is intentionally hidden during play.
            Answers are generated silently in the background and revealed
            all at once when the player presses "إنهاء الإجابة". */}

        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.catListContent,
            { paddingBottom: bottomInset + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
        >
          {GAME_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.catRow}>
              <Text style={[styles.catLabel, { color: theme.textSecondary }]}>{CAT_LABEL[cat]}</Text>
              <TextInput
                style={[styles.catInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }, submitted && styles.catInputDisabled]}
                value={playerAnswers[cat] || ""}
                onChangeText={(text) =>
                  setPlayerAnswers((prev) => ({ ...prev, [cat]: text }))
                }
                placeholder={`${currentLetter}...`}
                placeholderTextColor={theme.inputPlaceholder}
                textAlign="right"
                editable={!submitted}
                returnKeyType="next"
              />
            </View>
          ))}
        </KeyboardAwareScrollView>

        {!submitted ? (
          <View style={[styles.submitBar, { bottom: bottomInset + 12 }]}>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => {
                if (submittedRef.current) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                submitRound(playerAnswersRef.current, aiAnswersRef.current, currentLetter);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>إنهاء الإجابة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.submitBar, { bottom: bottomInset + 12 }]}>
            <View style={styles.waitingChip}>
              <Text style={styles.waitingText}>جاري التصحيح...</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (phase === "roundResults" && roundResults) {
    const pRound = roundResults.reduce((s, r) => s + r.playerScore, 0);
    const aRound = roundResults.reduce((s, r) => s + r.aiScore, 0);
    const isLastRound = currentRound >= TOTAL_ROUNDS;

    return (
      <View style={[styles.container, { paddingTop: topInset, backgroundColor: theme.background }]}>
        <ImageBackground source={require("../assets/images/bg_ai.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover"><View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} /></ImageBackground>
        <View style={[styles.resultsHeader, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.cardBorder }]}>
          <Text style={[styles.resultsTitle, { color: theme.textPrimary }]}>نتائج الجولة {currentRound}</Text>
          <View style={styles.roundScoreRow}>
            <Text style={[styles.roundScoreNum, { color: Colors.gold }]}>
              {profile.name}: {pRound}
            </Text>
            <Text style={styles.roundScoreSep}>—</Text>
            <Text style={[styles.roundScoreNum, { color: Colors.ruby }]}>
              AI: {aRound}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.resultsList, { paddingBottom: bottomInset + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {roundResults.map((r) => (
            <View key={r.category} style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.resultCatName, { color: theme.textMuted }]}>{CAT_LABEL[r.category]}</Text>
              <View style={styles.resultAnswers}>
                <View style={styles.resultCol}>
                  <Text
                    style={[
                      styles.resultAnswer,
                      { color: statusColor(r.playerStatus, theme.textMuted) },
                      !r.playerAnswer && styles.resultAnswerEmpty,
                    ]}
                  >
                    {r.playerAnswer || "—"}
                  </Text>
                  <Text style={[styles.resultPts, { color: r.playerScore > 0 ? Colors.emerald : theme.textMuted }]}>
                    +{r.playerScore}
                  </Text>
                </View>
                <View style={styles.resultDivider} />
                <View style={styles.resultCol}>
                  <Text style={[styles.resultAnswer, { color: statusColor(r.aiStatus, theme.textMuted) }, !r.aiAnswer && styles.resultAnswerEmpty]}>
                    {r.aiAnswer || "—"}
                  </Text>
                  <Text style={[styles.resultPts, { color: r.aiScore > 0 ? Colors.ruby : theme.textMuted }]}>
                    +{r.aiScore}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.resultsFooter, { paddingBottom: bottomInset + 12 }]}>
          <Text style={styles.totalScoreText}>
            الإجمالي — {profile.name}: {playerTotalScore} | AI: {aiTotalScore}
          </Text>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNextRound} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>
              {isLastRound ? "النتيجة النهائية" : "الجولة التالية"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === "gameOver") {
    const won = playerTotalScore > aiTotalScore;
    const draw = playerTotalScore === aiTotalScore;
    const xpGain = Math.max(10, Math.floor(playerTotalScore / 2));
    return (
      <View style={[styles.container, styles.gameOverContainer, { paddingTop: topInset, backgroundColor: theme.background }]}>
        <ImageBackground source={require("../assets/images/bg_ai.png")} style={StyleSheet.absoluteFillObject} resizeMode="cover"><View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.60)" }]} /></ImageBackground>
        <View style={[styles.gameOverCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={styles.gameOverEmoji}>{won ? "🏆" : draw ? "🤝" : "😔"}</Text>
          <Text style={[styles.gameOverTitle, { color: won ? Colors.gold : draw ? theme.textPrimary : Colors.ruby }]}>
            {won ? "فزت!" : draw ? "تعادل!" : "خسرت!"}
          </Text>
          <Text style={[styles.gameOverSub, { color: theme.textSecondary }]}>
            {won
              ? "أنت أذكى من الذكاء الاصطناعي 🎉"
              : draw
              ? "تعادلتم بنقاط متساوية"
              : "الذكاء الاصطناعي تفوّق عليك هذه المرة"}
          </Text>

          <View style={[styles.finalScoreBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
            <View style={styles.finalRow}>
              <Text style={[styles.finalName, { color: theme.textPrimary }]}>{profile.name}</Text>
              <Text style={[styles.finalNum, { color: Colors.gold }]}>{playerTotalScore}</Text>
            </View>
            <View style={styles.finalDivider} />
            <View style={styles.finalRow}>
              <Text style={[styles.finalName, { color: theme.textPrimary }]}>🤖 AI ({diffConfig.label})</Text>
              <Text style={[styles.finalNum, { color: Colors.ruby }]}>{aiTotalScore}</Text>
            </View>
          </View>

          <View style={styles.xpBadge}>
            <Ionicons name="star" size={14} color={Colors.gold} />
            <Text style={styles.xpText}>+{xpGain} XP</Text>
          </View>

          <View style={styles.gameOverBtns}>
            <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain} activeOpacity={0.85}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.playAgainText}>العب مجدداً</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.homeBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="home-outline" size={18} color={theme.textPrimary} />
              <Text style={[styles.homeBtnText, { color: theme.textPrimary }]}>الرئيسية</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#12122A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: "#E8E8FF",
    textAlign: "center",
    flex: 1,
  },

  diffContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "stretch",
  },
  aiHero: {
    alignItems: "center",
    marginBottom: 28,
  },
  aiHeroEmoji: { fontSize: 64, marginBottom: 12 },
  aiHeroTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
    color: "#E8E8FF",
    marginBottom: 6,
  },
  aiHeroSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "#5A5A88",
    textAlign: "center",
  },
  diffCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12122A",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  diffIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  diffEmoji: { fontSize: 28 },
  diffText: { flex: 1 },
  diffLabel: {
    fontFamily: "Cairo_700Bold",
    fontSize: 17,
    marginBottom: 3,
  },
  diffDesc: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: "#5A5A88",
  },

  loadingEmoji: { fontSize: 56, textAlign: "center", marginBottom: 16 },
  loadingText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 18,
    color: "#5A5A88",
    textAlign: "center",
  },

  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A",
  },
  gameHeaderLeft: { gap: 2 },
  roundLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: "#5A5A88",
  },
  diffBadge: {
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
  },
  letterBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.gold + "22",
    borderWidth: 2,
    borderColor: Colors.gold + "60",
    alignItems: "center",
    justifyContent: "center",
  },
  letterText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 30,
    color: Colors.gold,
  },
  timerBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
  },

  scoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#12122A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A",
  },
  scoreHalf: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  scoreName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    color: "#5A5A88",
    maxWidth: 110,
  },
  scoreNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
  },
  vsChip: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#5A5A88",
    paddingHorizontal: 12,
  },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A" + "50",
  },
  tableHeaderText: {
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    color: "#5A5A88",
    textAlign: "center",
  },
  tableHeaderCenter: {
    width: 80,
    textAlign: "center",
    fontSize: 14,
    color: "#5A5A88",
  },

  catListContent: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A" + "40",
    gap: 8,
  },
  catLabel: {
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: "#E8E8FF",
    textAlign: "right",
  },
  catAiCol: {
    width: 80,
    alignItems: "center",
  },
  aiThinking: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "#5A5A88",
    letterSpacing: 2,
  },
  aiWord: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: Colors.ruby,
    textAlign: "center",
  },
  aiEmpty: {
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    color: "#5A5A88" + "80",
  },
  catInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#12122A",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: "#E8E8FF",
    borderWidth: 1,
    borderColor: "#1E1E3A",
    textAlign: "right",
  },
  catInputDisabled: {
    opacity: 0.6,
  },

  submitBar: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.emerald,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  submitBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  waitingChip: {
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#12122A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E1E3A",
  },
  waitingText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: "#5A5A88",
  },

  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A",
  },
  resultsTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: "#E8E8FF",
    textAlign: "center",
    marginBottom: 8,
  },
  roundScoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  roundScoreNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
  },
  roundScoreSep: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "#5A5A88",
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  resultCard: {
    backgroundColor: "#12122A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E1E3A",
    padding: 12,
    marginBottom: 10,
  },
  resultCatName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#5A5A88",
    textAlign: "center",
    marginBottom: 8,
  },
  resultAnswers: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  resultAnswer: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: "#E8E8FF",
    textAlign: "center",
  },
  resultAnswerEmpty: {
    color: "#5A5A88",
    fontFamily: "Cairo_400Regular",
  },
  resultPts: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
  },
  resultDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#1E1E3A",
    marginHorizontal: 10,
  },

  resultsFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1E1E3A",
    gap: 10,
  },
  totalScoreText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: "#5A5A88",
    textAlign: "center",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  nextBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: "#fff",
  },

  gameOverContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  gameOverCard: {
    width: "100%",
    backgroundColor: "#12122A",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E1E3A",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  gameOverEmoji: { fontSize: 64 },
  gameOverTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 30,
  },
  gameOverSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "#5A5A88",
    textAlign: "center",
  },
  finalScoreBox: {
    width: "100%",
    backgroundColor: "#0A0A1A",
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    gap: 10,
  },
  finalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  finalName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: "#E8E8FF",
  },
  finalNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
  },
  finalDivider: {
    height: 1,
    backgroundColor: "#1E1E3A",
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.gold + "18",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.gold + "30",
  },
  xpText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  gameOverBtns: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  playAgainBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.emerald,
    borderRadius: 14,
    paddingVertical: 13,
    gap: 7,
  },
  playAgainText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  homeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12122A",
    borderRadius: 14,
    paddingVertical: 13,
    gap: 7,
    borderWidth: 1,
    borderColor: "#1E1E3A",
  },
  homeBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: "#E8E8FF",
  },
});
