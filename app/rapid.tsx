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
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";
import { playSound } from "@/lib/sound-manager";
import { LinearGradient } from "expo-linear-gradient";

const RAPID_BG: [string, string, string] = ["#120200", "#1E0400", "#120200"];

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

type CoinTier = { entry: number; reward: number };
const COIN_TIERS: CoinTier[] = [
  { entry: 50, reward: 100 },
  { entry: 100, reward: 250 },
];

export default function RapidScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, reportGameResult, addCoins } = usePlayer();
  const { theme } = useTheme();
  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [phase, setPhase] = useState<"tier_select" | "waiting" | "countdown" | "playing" | "round_result" | "game_over">("tier_select");
  const [selectedTier, setSelectedTier] = useState<CoinTier | null>(null);
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
  const [gameOverData, setGameOverData] = useState<{ won: boolean; myScore: number; oppScore: number; coinsEarned: number; xpEarned: number; isDraw: boolean } | null>(null);
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
  const phaseRef = useRef<string>("tier_select");

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionCooldown, setReactionCooldown] = useState(false);
  const [incomingReaction, setIncomingReaction] = useState<{ emoji: string; playerName: string } | null>(null);
  const incomingReactionAnim = useRef(new Animated.Value(0)).current;
  const reactionCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTierRef = useRef<CoinTier | null>(null);

  const handleSelectTier = useCallback((tier: CoinTier) => {
    if (profile.coins < tier.entry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addCoins(-tier.entry);
    setSelectedTier(tier);
    selectedTierRef.current = tier;
    setPhase("waiting");
    phaseRef.current = "waiting";

    const socket = getSocket();
    socket.emit("findMatch", {
      playerName: profile.name,
      playerSkin: profile.equippedSkin,
      playerId,
      mode: "rapid",
      coinEntry: tier.entry,
    });
  }, [profile.coins, profile.name, profile.equippedSkin, playerId, addCoins]);

  useEffect(() => {
    const socket = getSocket();
    socketIdRef.current = socket.id || null;

    const handleConnect = () => {
      socketIdRef.current = socket.id || null;
      if (playerId) socket.emit("register_player_id", { playerId });
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
        playSound("correct");
      } else {
        setWordSubmitted(false);
        setSubmissionFeedback(data.reason === "wrong_letter" ? "حرف خطأ!" : data.reason === "too_short" ? "قصيرة جداً!" : "غير صحيحة!");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        playSound("wrong");
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
      const tier = selectedTierRef.current;
      const isDraw = data.winnerId === null && myFinalScore === oppFinalScore;

      if (isDraw && tier) {
        addCoins(tier.entry);
      }

      setGameOverData({
        won,
        myScore: myFinalScore,
        oppScore: oppFinalScore,
        coinsEarned: data.coinsEarned,
        xpEarned: data.xpEarned,
        isDraw,
      });
      setPhase("game_over");
      phaseRef.current = "game_over";
      rapidRoomIdRef.current = null;
      reportGameResult(won, myFinalScore, data.coinsEarned, data.xpEarned, tier?.entry);
      if (!isDraw) playSound(won ? "win" : "lose");
      if (won) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };

    const handleGameReaction = (data: { emoji: string; playerName: string }) => {
      setIncomingReaction(data);
      incomingReactionAnim.setValue(0);
      Animated.sequence([
        Animated.spring(incomingReactionAnim, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(incomingReactionAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setIncomingReaction(null));
    };

    socket.on("connect", handleConnect);
    socket.on("rapid_start", handleRapidStart);
    socket.on("rapid_letter", handleRapidLetter);
    socket.on("rapid_word_result", handleRapidWordResult);
    socket.on("rapid_round_result", handleRapidRoundResult);
    socket.on("rapid_game_over", handleRapidGameOver);
    socket.on("game_reaction", handleGameReaction);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("rapid_start", handleRapidStart);
      socket.off("rapid_letter", handleRapidLetter);
      socket.off("rapid_word_result", handleRapidWordResult);
      socket.off("rapid_round_result", handleRapidRoundResult);
      socket.off("rapid_game_over", handleRapidGameOver);
      socket.off("game_reaction", handleGameReaction);
      if (rapidRoomIdRef.current) {
        socket.emit("rapid_leave", { rapidRoomId: rapidRoomIdRef.current });
      } else if (phaseRef.current === "waiting") {
        socket.emit("rapid_cancel");
        if (selectedTierRef.current) {
          addCoins(selectedTierRef.current.entry);
        }
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
    if (rapidRoomId) {
      socket.emit("rapid_leave", { rapidRoomId });
    } else if (phaseRef.current === "waiting") {
      socket.emit("rapid_cancel");
      if (selectedTierRef.current) {
        addCoins(selectedTierRef.current.entry);
      }
    }
    router.back();
  };

  const timerColor =
    timeLeft > 6 ? Colors.emerald : timeLeft > 3 ? Colors.gold : Colors.ruby;

  if (phase === "tier_select") {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <LinearGradient colors={RAPID_BG} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.tierContent}>
          <Ionicons name="flash" size={48} color={Colors.ruby} />
          <Text style={[styles.waitingTitle, { color: theme.textPrimary }]}>الوضع السريع</Text>
          <Text style={[styles.tierSubtitle, { color: theme.textSecondary }]}>اختر مستوى الدخول</Text>

          <View style={styles.coinBalance}>
            <Ionicons name="star" size={16} color={Colors.gold} />
            <Text style={styles.coinBalanceText}>{profile.coins} عملة</Text>
          </View>

          <View style={styles.tierCards}>
            {COIN_TIERS.map((tier) => {
              const canAfford = profile.coins >= tier.entry;
              return (
                <TouchableOpacity
                  key={tier.entry}
                  style={[styles.tierCard, !canAfford && styles.tierCardDisabled]}
                  onPress={() => handleSelectTier(tier)}
                  disabled={!canAfford}
                  activeOpacity={0.8}
                >
                  <View style={styles.tierEntry}>
                    <Ionicons name="star" size={20} color={canAfford ? Colors.gold : theme.textMuted} />
                    <Text style={[styles.tierEntryText, !canAfford && { color: theme.textMuted }]}>{tier.entry}</Text>
                  </View>
                  <Ionicons name="arrow-down" size={16} color={theme.textMuted} />
                  <View style={styles.tierReward}>
                    <Text style={[styles.tierRewardText, !canAfford && { color: theme.textMuted }]}>+{tier.reward} 🪙</Text>
                  </View>
                  {!canAfford && (
                    <Text style={styles.tierInsufficient}>رصيدك غير كافٍ</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  if (phase === "waiting") {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <LinearGradient colors={RAPID_BG} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={handleLeave}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.waitingContent}>
          <Ionicons name="flash" size={48} color={Colors.ruby} />
          <Text style={[styles.waitingTitle, { color: theme.textPrimary }]}>الوضع السريع</Text>
          {selectedTier && (
            <View style={styles.tierSelectedBadge}>
              <Ionicons name="star" size={14} color={Colors.gold} />
              <Text style={styles.tierSelectedText}>الدخول: {selectedTier.entry} عملة · الجائزة: +{selectedTier.reward} 🪙</Text>
            </View>
          )}
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
      <View style={[styles.container, styles.countdownContainer, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <LinearGradient colors={RAPID_BG} style={StyleSheet.absoluteFillObject} />
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
        {selectedTier && (
          <View style={styles.rewardBanner}>
            <Text style={styles.rewardBannerText}>الجائزة: {selectedTier.reward} عملة 🪙</Text>
          </View>
        )}
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
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <LinearGradient colors={RAPID_BG} style={StyleSheet.absoluteFillObject} />
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
    const gameEmoji = gameOverData.isDraw ? "🤝" : gameOverData.won ? "🏆" : "😞";
    const gameTitle = gameOverData.isDraw ? "تعادل!" : gameOverData.won ? "فزت!" : "خسرت";
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <LinearGradient colors={RAPID_BG} style={StyleSheet.absoluteFillObject} />
        <View style={styles.gameOverContent}>
          <Text style={styles.gameOverEmoji}>{gameEmoji}</Text>
          <Text style={[styles.gameOverTitle, { color: theme.textPrimary }]}>{gameTitle}</Text>
          {gameOverData.isDraw && selectedTier && (
            <View style={styles.drawRefundBadge}>
              <Ionicons name="refresh-circle" size={18} color={Colors.gold} />
              <Text style={styles.drawRefundText}>تعادل! استرجعت عملاتك</Text>
            </View>
          )}
          <View style={styles.finalScoreBoard}>
            <View style={styles.finalScoreSide}>
              <Text style={styles.finalScoreLabel}>أنت</Text>
              <Text style={[styles.finalScoreNum, gameOverData.won && { color: Colors.emerald }]}>{gameOverData.myScore}</Text>
            </View>
            <Text style={styles.finalScoreDash}>-</Text>
            <View style={styles.finalScoreSide}>
              <Text style={styles.finalScoreLabel}>{opponent?.name || "خصم"}</Text>
              <Text style={[styles.finalScoreNum, !gameOverData.won && !gameOverData.isDraw && { color: Colors.emerald }]}>{gameOverData.oppScore}</Text>
            </View>
          </View>
          <View style={styles.rewardsRow}>
            <View style={styles.rewardItem}>
              <Ionicons name="star" size={18} color={Colors.gold} />
              <Text style={styles.rewardText}>+{gameOverData.coinsEarned} 🪙</Text>
            </View>
            <View style={styles.rewardItem}>
              <Ionicons name="flash" size={18} color={Colors.sapphire} />
              <Text style={styles.rewardText}>+{gameOverData.xpEarned} XP</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Ionicons name="home" size={18} color={"#000000"} />
            <Text style={styles.homeBtnText}>الرئيسية</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <LinearGradient colors={RAPID_BG} style={StyleSheet.absoluteFillObject} />
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

      {/* Incoming reaction floating bubble */}
      {incomingReaction && (
        <Animated.View
          pointerEvents="none"
          style={[styles.incomingReactionBubble, {
            opacity: incomingReactionAnim,
            transform: [
              { scale: incomingReactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              { translateY: incomingReactionAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            ],
          }]}>
          <Text style={styles.incomingReactionEmoji}>{incomingReaction.emoji}</Text>
          <Text style={styles.incomingReactionName}>{incomingReaction.playerName}</Text>
        </Animated.View>
      )}

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

        {/* Reaction button */}
        <View style={styles.reactionRow}>
          <TouchableOpacity
            style={[styles.reactionTriggerBtn, { opacity: reactionCooldown ? 0.4 : 1 }]}
            onPress={() => !reactionCooldown && setShowReactionPicker(p => !p)}
            disabled={reactionCooldown}
          >
            <Text style={{ fontSize: 20 }}>😊</Text>
          </TouchableOpacity>
          {showReactionPicker && (
            <View style={styles.reactionPickerStrip}>
              {["😂", "🔥", "👏", "💀", "🤝", "😤", "❤️", "😎"].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionPickerBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (rapidRoomId) socket.emit("game_reaction", { roomId: rapidRoomId, emoji, playerName: profile.name });
                    setShowReactionPicker(false);
                    setReactionCooldown(true);
                    if (reactionCooldownRef.current) clearTimeout(reactionCooldownRef.current);
                    reactionCooldownRef.current = setTimeout(() => setReactionCooldown(false), 5000);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
            placeholderTextColor={theme.inputPlaceholder}
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
          <Ionicons name="send" size={18} color={"#000000"} />
          <Text style={styles.submitBtnText}>{wordSubmitted ? "تم الإرسال" : "أرسل"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "web" ? 75 : 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#12122A",
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
    color: "#E8E8FF",
  },
  waitingSubtitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
    color: "#9898CC",
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

  tierContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  tierSubtitle: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: "#9898CC",
  },
  coinBalance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#12122A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  coinBalanceText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  tierCards: {
    width: "100%",
    gap: 14,
    marginTop: 8,
  },
  tierCard: {
    backgroundColor: "#12122A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  tierCardDisabled: {
    opacity: 0.45,
    borderColor: "#1E1E3A",
  },
  tierEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tierEntryText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
    color: Colors.gold,
  },
  tierReward: {
    backgroundColor: Colors.emerald + "18",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tierRewardText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.emerald,
  },
  tierInsufficient: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: Colors.ruby,
    marginTop: 2,
  },
  tierSelectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold + "15",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gold + "30",
  },
  tierSelectedText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.gold,
  },
  rewardBanner: {
    backgroundColor: Colors.emerald + "18",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.emerald + "40",
  },
  rewardBannerText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: Colors.emerald,
  },
  drawRefundBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold + "18",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  drawRefundText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
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
    color: "#E8E8FF",
  },
  vsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: Colors.ruby,
  },
  countdownLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 16,
    color: "#9898CC",
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#12122A",
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
    backgroundColor: "#12122A",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  roundText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#E8E8FF",
  },
  miniScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#12122A",
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
    color: "#E8E8FF",
  },
  miniScoreDash: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#5A5A88",
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
    backgroundColor: "#12122A",
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
  reactionRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  reactionTriggerBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: "#12122A",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1E1E3A",
  },
  reactionPickerStrip: {
    flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center",
  },
  reactionPickerBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  incomingReactionBubble: {
    position: "absolute", top: 120, right: 16, alignItems: "center",
    backgroundColor: "#1E1E3A", borderRadius: 20, padding: 10, zIndex: 999,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8,
  },
  incomingReactionEmoji: { fontSize: 36 },
  incomingReactionName: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#9898CC", marginTop: 2 },
  letterText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 52,
    color: "#000000",
  },
  inputArea: {
    width: "100%",
    alignItems: "center",
  },
  wordInput: {
    width: "100%",
    backgroundColor: "#0E0E24",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#1E1E3A",
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
    color: "#E8E8FF",
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
    color: "#000000",
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
    color: "#5A5A88",
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
    color: "#E8E8FF",
  },
  scoreWinner: {
    color: Colors.emerald,
  },
  scoreName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: "#9898CC",
  },
  scoreDivider: {
    paddingHorizontal: 8,
  },
  scoreDash: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: "#5A5A88",
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
    backgroundColor: "#12122A",
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
    color: "#E8E8FF",
  },
  finalScoreBoard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    backgroundColor: "#12122A",
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
    color: "#9898CC",
  },
  finalScoreNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 32,
    color: "#E8E8FF",
  },
  finalScoreDash: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: "#5A5A88",
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
    backgroundColor: "#12122A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rewardText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#E8E8FF",
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
    color: "#000000",
  },
});
