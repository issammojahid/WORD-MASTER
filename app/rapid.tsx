import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";

const { width } = Dimensions.get("window");
const ROUND_TIME = 10;
const TOTAL_ROUNDS = 5;

type RapidCategory = {
  id: string;
  label: string;
};

const RAPID_CATEGORIES: RapidCategory[] = [
  { id: "girlName", label: "اسم بنت" },
  { id: "boyName", label: "اسم ولد" },
  { id: "animal", label: "حيوان" },
  { id: "fruit", label: "فاكهة" },
  { id: "vegetable", label: "خضرة" },
  { id: "object", label: "جماد" },
  { id: "city", label: "مدينة" },
  { id: "country", label: "بلد" },
];

type RoundResultData = {
  round: number;
  winnerId: string | null;
  winnerName: string;
  word: string;
  category: string;
  scores: Record<string, number>;
  isDraw: boolean;
  attempts?: Record<string, string>;
};

type OpponentInfo = {
  id: string;
  name: string;
  skin: string;
};

export default function RapidScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, reportGameResult } = usePlayer();
  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [phase, setPhase] = useState<"waiting" | "countdown" | "playing" | "round_result" | "game_over">("waiting");
  const [rapidRoomId, setRapidRoomId] = useState<string | null>(null);
  const [currentLetter, setCurrentLetter] = useState("");
  const [currentCategory, setCurrentCategory] = useState<RapidCategory>(RAPID_CATEGORIES[0]);
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [wordInput, setWordInput] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultData | null>(null);
  const [gameOverData, setGameOverData] = useState<{ won: boolean; myScore: number; oppScore: number; coinsEarned: number; xpEarned: number } | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState("جاري البحث عن لاعب...");
  const [countdownNum, setCountdownNum] = useState(3);
  const [wordSubmitted, setWordSubmitted] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const letterAnim = useRef(new Animated.Value(0)).current;
  const socketIdRef = useRef<string | null>(null);
  const rapidRoomIdRef = useRef<string | null>(null);
  const phaseRef = useRef<string>("waiting");

  useEffect(() => {
    const socket = getSocket();
    socketIdRef.current = socket.id || null;

    const handleConnect = () => {
      socketIdRef.current = socket.id || null;
    };

    const handleRapidStart = (data: {
      rapidRoomId: string;
      opponent: OpponentInfo;
    }) => {
      rapidRoomIdRef.current = data.rapidRoomId;
      setRapidRoomId(data.rapidRoomId);
      setOpponent(data.opponent);
      setPhase("countdown");
      phaseRef.current = "countdown";
      setCountdownNum(3);
    };

    const handleRapidLetter = (data: {
      round: number;
      letter: string;
      category: string;
      timeLimit: number;
    }) => {
      setCurrentRound(data.round);
      setCurrentLetter(data.letter);
      const cat = RAPID_CATEGORIES.find((c) => c.id === data.category) || RAPID_CATEGORIES[0];
      setCurrentCategory(cat);
      setTimeLeft(data.timeLimit);
      setWordInput("");
      setWordSubmitted(false);
      setSubmissionFeedback(null);
      setPhase("playing");
      phaseRef.current = "playing";

      Animated.sequence([
        Animated.timing(letterAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(letterAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      setTimeout(() => inputRef.current?.focus(), 400);
    };

    const handleRapidWordResult = (data: {
      valid: boolean;
      reason?: string;
      winnerId?: string;
    }) => {
      if (data.valid) {
        setSubmissionFeedback("✓");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setWordSubmitted(false);
        setSubmissionFeedback(data.reason === "wrong_letter" ? "حرف خطأ!" : data.reason === "too_short" ? "قصيرة جداً!" : "غير صحيحة!");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => setSubmissionFeedback(null), 1200);
      }
    };

    const handleRapidRoundResult = (data: RoundResultData) => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRoundResult(data);
      if (socketIdRef.current) {
        setMyScore(data.scores[socketIdRef.current] || 0);
        const oppId = Object.keys(data.scores).find((k) => k !== socketIdRef.current);
        if (oppId) setOpponentScore(data.scores[oppId] || 0);
      }
      setPhase("round_result");
      phaseRef.current = "round_result";
      const isWinner = data.winnerId === socketIdRef.current;
      if (isWinner) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (data.winnerId && !data.isDraw) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    const handleRapidGameOver = (data: {
      winnerId: string | null;
      scores: Record<string, number>;
      coinsEarned: number;
      xpEarned: number;
    }) => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const won = data.winnerId === socketIdRef.current;
      const myFinalScore = socketIdRef.current ? (data.scores[socketIdRef.current] || 0) : 0;
      const oppId = Object.keys(data.scores).find((k) => k !== socketIdRef.current);
      const oppFinalScore = oppId ? (data.scores[oppId] || 0) : 0;
      setGameOverData({
        won,
        myScore: myFinalScore,
        oppScore: oppFinalScore,
        coinsEarned: data.coinsEarned,
        xpEarned: data.xpEarned,
      });
      setPhase("game_over");
      phaseRef.current = "game_over";
      rapidRoomIdRef.current = null;
      if (won) {
        reportGameResult(true, myFinalScore, data.coinsEarned, data.xpEarned);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        reportGameResult(false, myFinalScore, Math.floor(data.coinsEarned / 2), Math.floor(data.xpEarned / 2));
      }
    };

    socket.on("connect", handleConnect);
    socket.on("rapid_start", handleRapidStart);
    socket.on("rapid_letter", handleRapidLetter);
    socket.on("rapid_word_result", handleRapidWordResult);
    socket.on("rapid_round_result", handleRapidRoundResult);
    socket.on("rapid_game_over", handleRapidGameOver);

    socket.emit("findMatch", {
      playerName: profile.name,
      playerSkin: profile.equippedSkin,
      playerId,
      mode: "rapid",
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("rapid_start", handleRapidStart);
      socket.off("rapid_letter", handleRapidLetter);
      socket.off("rapid_word_result", handleRapidWordResult);
      socket.off("rapid_round_result", handleRapidRoundResult);
      socket.off("rapid_game_over", handleRapidGameOver);
      if (rapidRoomIdRef.current) {
        socket.emit("rapid_leave", { rapidRoomId: rapidRoomIdRef.current });
      } else if (phaseRef.current === "waiting") {
        socket.emit("rapid_cancel");
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "countdown") {
      let c = 3;
      setCountdownNum(c);
      const tick = setInterval(() => {
        c--;
        if (c <= 0) {
          clearInterval(tick);
        } else {
          setCountdownNum(c);
        }
      }, 1000);
      return () => clearInterval(tick);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "playing") {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "playing") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase]);

  const handleSubmitWord = useCallback(() => {
    if (!wordInput.trim() || wordSubmitted || !rapidRoomId) return;
    setWordSubmitted(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const socket = getSocket();
    socket.emit("rapid_word", {
      rapidRoomId,
      word: wordInput.trim(),
      category: currentCategory.id,
    });
  }, [wordInput, wordSubmitted, rapidRoomId, currentCategory]);

  const handleLeave = () => {
    const socket = getSocket();
    if (rapidRoomId) socket.emit("rapid_leave", { rapidRoomId });
    router.back();
  };

  const timerColor =
    timeLeft > 6 ? Colors.emerald : timeLeft > 3 ? Colors.gold : Colors.ruby;

  if (phase === "waiting") {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleLeave}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.waitingContent}>
          <Ionicons name="flash" size={48} color={Colors.ruby} />
          <Text style={styles.waitingTitle}>الوضع السريع</Text>
          <Text style={styles.waitingSubtitle}>{matchmakingStatus}</Text>
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.loadingDot, { backgroundColor: Colors.ruby }]} />
            <Animated.View style={[styles.loadingDot, { backgroundColor: Colors.gold }]} />
            <Animated.View style={[styles.loadingDot, { backgroundColor: Colors.emerald }]} />
          </View>
        </View>
      </View>
    );
  }

  if (phase === "countdown") {
    const countColors: Record<number, string> = { 3: Colors.emerald, 2: Colors.gold, 1: Colors.ruby };
    const color = countColors[countdownNum] || Colors.gold;
    const opponentSkin = opponent ? (SKINS.find((s) => s.id === opponent.skin) || SKINS[0]) : SKINS[0];
    return (
      <View style={[styles.container, styles.countdownContainer, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.vsRow}>
          <View style={styles.vsPlayer}>
            <View style={[styles.vsAvatar, { backgroundColor: equippedSkin.color + "33" }]}>
              <Text style={styles.vsEmoji}>{equippedSkin.emoji}</Text>
            </View>
            <Text style={[styles.vsName, { color: Colors.gold }]}>{profile.name}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          {opponent && (
            <View style={styles.vsPlayer}>
              <View style={[styles.vsAvatar, { backgroundColor: opponentSkin.color + "33" }]}>
                <Text style={styles.vsEmoji}>{opponentSkin.emoji}</Text>
              </View>
              <Text style={styles.vsName}>{opponent.name}</Text>
            </View>
          )}
        </View>
        <Text style={styles.countdownLabel}>الجولة تبدأ في</Text>
        <View style={[styles.countdownCircle, { borderColor: color }]}>
          <Text style={[styles.countdownNumber, { color }]}>{countdownNum}</Text>
        </View>
        <Text style={styles.rapidBadge}>⚡ الوضع السريع</Text>
      </View>
    );
  }

  if (phase === "round_result") {
    const isWinner = roundResult?.winnerId === socketIdRef.current;
    const isDraw = roundResult?.isDraw;
    const myAttempt = socketIdRef.current && roundResult?.attempts ? roundResult.attempts[socketIdRef.current] : null;
    const oppAttempt = opponent && roundResult?.attempts ? roundResult.attempts[Object.keys(roundResult.attempts).find((k) => k !== socketIdRef.current) || ""] : null;
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.roundResultContent}>
          <Text style={styles.roundResultRound}>الجولة {roundResult?.round || currentRound} / {TOTAL_ROUNDS}</Text>
          <View style={styles.scoreBoard}>
            <View style={styles.scoreSide}>
              <Text style={styles.scoreEmoji}>{equippedSkin.emoji}</Text>
              <Text style={[styles.scoreNum, isWinner && styles.scoreWinner]}>{myScore}</Text>
              <Text style={styles.scoreName}>{profile.name}</Text>
            </View>
            <View style={styles.scoreDivider}>
              <Text style={styles.scoreDash}>—</Text>
            </View>
            <View style={styles.scoreSide}>
              <Text style={styles.scoreEmoji}>{opponent ? (SKINS.find((s) => s.id === opponent.skin) || SKINS[0]).emoji : "?"}</Text>
              <Text style={[styles.scoreNum, !isWinner && !isDraw && styles.scoreWinner]}>{opponentScore}</Text>
              <Text style={styles.scoreName}>{opponent?.name || "خصم"}</Text>
            </View>
          </View>
          {isDraw ? (
            <View style={[styles.resultBadge, { backgroundColor: Colors.gold + "20" }]}>
              <Text style={[styles.resultBadgeText, { color: Colors.gold }]}>تعادل! ⏱️</Text>
            </View>
          ) : isWinner ? (
            <View style={[styles.resultBadge, { backgroundColor: Colors.emerald + "20" }]}>
              <Text style={[styles.resultBadgeText, { color: Colors.emerald }]}>فزت بالجولة! 🎉</Text>
            </View>
          ) : (
            <View style={[styles.resultBadge, { backgroundColor: Colors.ruby + "20" }]}>
              <Text style={[styles.resultBadgeText, { color: Colors.ruby }]}>خسرت الجولة 😔</Text>
            </View>
          )}
          <View style={styles.attemptsSection}>
            {roundResult?.word ? (
              <View style={styles.attemptRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.emerald} />
                <Text style={styles.attemptWinning}>{roundResult.word}</Text>
              </View>
            ) : null}
            {!isDraw && !isWinner && myAttempt ? (
              <View style={styles.attemptRow}>
                <Ionicons name="close-circle" size={18} color={Colors.ruby} />
                <Text style={styles.attemptLosing}>{myAttempt}</Text>
              </View>
            ) : null}
            {!isDraw && isWinner && oppAttempt ? (
              <View style={styles.attemptRow}>
                <Ionicons name="close-circle" size={18} color={Colors.ruby} />
                <Text style={styles.attemptLosing}>{oppAttempt}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (phase === "game_over" && gameOverData) {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.gameOverContent}>
          <Text style={styles.gameOverEmoji}>{gameOverData.won ? "🏆" : "😞"}</Text>
          <Text style={styles.gameOverTitle}>{gameOverData.won ? "فزت!" : "خسرت"}</Text>
          <View style={styles.finalScoreBoard}>
            <View style={styles.finalScoreSide}>
              <Text style={styles.finalScoreLabel}>أنت</Text>
              <Text style={[styles.finalScoreNum, gameOverData.won && { color: Colors.emerald }]}>{gameOverData.myScore}</Text>
            </View>
            <Text style={styles.finalScoreDash}>-</Text>
            <View style={styles.finalScoreSide}>
              <Text style={styles.finalScoreLabel}>{opponent?.name || "خصم"}</Text>
              <Text style={[styles.finalScoreNum, !gameOverData.won && { color: Colors.emerald }]}>{gameOverData.oppScore}</Text>
            </View>
          </View>
          <View style={styles.rewardsRow}>
            <View style={styles.rewardItem}>
              <Ionicons name="star" size={18} color={Colors.gold} />
              <Text style={styles.rewardText}>+{gameOverData.coinsEarned} عملة</Text>
            </View>
            <View style={styles.rewardItem}>
              <Ionicons name="flash" size={18} color={Colors.sapphire} />
              <Text style={styles.rewardText}>+{gameOverData.xpEarned} XP</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Ionicons name="home" size={18} color={Colors.black} />
            <Text style={styles.homeBtnText}>الرئيسية</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.playHeader}>
        <View style={styles.roundInfo}>
          <Text style={styles.roundText}>الجولة {currentRound}/{TOTAL_ROUNDS}</Text>
        </View>
        <View style={styles.miniScoreRow}>
          <View style={styles.miniScoreItem}>
            <Text style={styles.miniScoreEmoji}>{equippedSkin.emoji}</Text>
            <Text style={styles.miniScoreNum}>{myScore}</Text>
          </View>
          <Text style={styles.miniScoreDash}>-</Text>
          <View style={styles.miniScoreItem}>
            <Text style={styles.miniScoreNum}>{opponentScore}</Text>
            <Text style={styles.miniScoreEmoji}>{opponent ? (SKINS.find((s) => s.id === opponent.skin) || SKINS[0]).emoji : "?"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.playBody}>
        <Animated.View style={[styles.timerCircle, { borderColor: timerColor, transform: [{ scale: timeLeft <= 3 ? pulseAnim : 1 }] }]}>
          <Text style={[styles.timerNum, { color: timerColor }]}>{timeLeft}</Text>
        </Animated.View>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{currentCategory.label}</Text>
        </View>

        <View style={styles.letterDisplay}>
          <Text style={styles.letterText}>{currentLetter}</Text>
        </View>

        <View style={styles.inputArea}>
          <TextInput
            ref={inputRef}
            style={[
              styles.wordInput,
              wordSubmitted && styles.wordInputSubmitted,
              submissionFeedback && !wordSubmitted && styles.wordInputError,
            ]}
            value={wordInput}
            onChangeText={(text) => {
              if (!wordSubmitted) setWordInput(text);
            }}
            placeholder={`كلمة تبدأ بحرف ${currentLetter}...`}
            placeholderTextColor={Colors.inputPlaceholder}
            textAlign="right"
            autoFocus
            editable={!wordSubmitted && timeLeft > 0}
            onSubmitEditing={handleSubmitWord}
            returnKeyType="send"
          />
          {submissionFeedback && (
            <Text style={[styles.feedbackText, wordSubmitted ? styles.feedbackSuccess : styles.feedbackError]}>
              {submissionFeedback}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (wordSubmitted || !wordInput.trim() || timeLeft <= 0) && styles.submitBtnDisabled]}
          onPress={handleSubmitWord}
          disabled={wordSubmitted || !wordInput.trim() || timeLeft <= 0}
          activeOpacity={0.85}
        >
          <Ionicons name="send" size={18} color={Colors.black} />
          <Text style={styles.submitBtnText}>{wordSubmitted ? "تم الإرسال" : "أرسل"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "web" ? 75 : 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  waitingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  waitingTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 26,
    color: Colors.textPrimary,
  },
  waitingSubtitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },

  countdownContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 30,
  },
  vsPlayer: {
    alignItems: "center",
    gap: 8,
  },
  vsAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  vsEmoji: { fontSize: 30 },
  vsName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  vsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: Colors.ruby,
  },
  countdownLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.card,
  },
  countdownNumber: {
    fontFamily: "Cairo_700Bold",
    fontSize: 48,
  },
  rapidBadge: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.ruby,
    marginTop: 10,
  },

  playHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roundInfo: {
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  roundText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: Colors.textPrimary,
  },
  miniScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  miniScoreItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniScoreEmoji: { fontSize: 16 },
  miniScoreNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  miniScoreDash: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textMuted,
  },

  playBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  timerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.card,
  },
  timerNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 36,
  },
  categoryBadge: {
    backgroundColor: Colors.ruby + "20",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ruby + "40",
  },
  categoryText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.ruby,
  },
  letterDisplay: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  letterText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 52,
    color: Colors.black,
  },
  inputArea: {
    width: "100%",
    alignItems: "center",
  },
  wordInput: {
    width: "100%",
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
    color: Colors.inputText,
    textAlign: "right",
  },
  wordInputSubmitted: {
    borderColor: Colors.emerald,
    backgroundColor: Colors.emerald + "10",
  },
  wordInputError: {
    borderColor: Colors.ruby,
  },
  feedbackText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    marginTop: 6,
  },
  feedbackSuccess: {
    color: Colors.emerald,
  },
  feedbackError: {
    color: Colors.ruby,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.black,
  },

  roundResultContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  roundResultRound: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textMuted,
  },
  scoreBoard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  scoreSide: {
    alignItems: "center",
    gap: 4,
  },
  scoreEmoji: { fontSize: 28 },
  scoreNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 36,
    color: Colors.textPrimary,
  },
  scoreWinner: {
    color: Colors.emerald,
  },
  scoreName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scoreDivider: {
    paddingHorizontal: 8,
  },
  scoreDash: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: Colors.textMuted,
  },
  resultBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resultBadgeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
  },
  attemptsSection: {
    gap: 8,
    marginTop: 4,
    alignItems: "center",
  },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  attemptWinning: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.emerald,
  },
  attemptLosing: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: Colors.ruby,
    textDecorationLine: "line-through",
  },

  gameOverContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  gameOverEmoji: { fontSize: 56 },
  gameOverTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 30,
    color: Colors.textPrimary,
  },
  finalScoreBoard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    backgroundColor: Colors.card,
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 16,
  },
  finalScoreSide: {
    alignItems: "center",
    gap: 4,
  },
  finalScoreLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  finalScoreNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 32,
    color: Colors.textPrimary,
  },
  finalScoreDash: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: Colors.textMuted,
  },
  rewardsRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 8,
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rewardText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  homeBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.black,
  },
});
