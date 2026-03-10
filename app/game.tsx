import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Keyboard,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";
import { GAME_CATEGORIES, GameCategory } from "@/constants/i18n";

const ROUND_TIME = 25;

type CategoryStatus = "idle" | "correct" | "duplicate" | "empty" | "invalid";

type RoundResult = {
  playerId: string;
  playerName: string;
  answers: Record<string, string>;
  scores: Record<string, number>;
  roundTotal: number;
  status: Record<string, CategoryStatus>;
};

export default function GameScreen() {
  const { roomId, letter, round, totalRounds } = useLocalSearchParams<{
    roomId: string;
    letter: string;
    round: string;
    totalRounds: string;
  }>();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { profile, updateProfile, addCoins, addXp } = usePlayer();
  const socket = getSocket();

  const [answers, setAnswers] = useState<Record<GameCategory, string>>(
    {} as Record<GameCategory, string>
  );
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [submitted, setSubmitted] = useState(false);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);
  const [currentLetter, setCurrentLetter] = useState(letter || "أ");
  const [currentRound, setCurrentRound] = useState(parseInt(round || "1", 10));
  const [numTotalRounds] = useState(parseInt(totalRounds || "5", 10));
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [gamePlayers, setGamePlayers] = useState<{ id: string; name: string; score: number }[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverPlayers, setGameOverPlayers] = useState<
    { id: string; name: string; score: number; coins: number }[]
  >([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const letterAnim = useRef(new Animated.Value(0)).current;
  const socketId = socket.id;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    // Letter entrance animation
    Animated.spring(letterAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [currentLetter]);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [currentRound]);

  useEffect(() => {
    socket.on("player_submitted", ({ playerId }: { playerId: string }) => {
      setSubmittedPlayers((prev) =>
        prev.includes(playerId) ? prev : [...prev, playerId]
      );
    });

    socket.on(
      "round_results",
      (data: {
        results: RoundResult[];
        round: number;
        totalRounds: number;
        players: { id: string; name: string; score: number }[];
      }) => {
        stopTimer();
        setRoundResults(data.results);
        setGamePlayers(data.players);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    );

    socket.on(
      "new_round",
      (data: { letter: string; round: number; totalRounds: number }) => {
        setCurrentLetter(data.letter);
        setCurrentRound(data.round);
        setAnswers({} as Record<GameCategory, string>);
        setSubmitted(false);
        setSubmittedPlayers([]);
        setRoundResults(null);
        setTimeLeft(ROUND_TIME);
        letterAnim.setValue(0);
        startTimer();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    );

    socket.on(
      "game_over",
      (data: { players: { id: string; name: string; score: number; coins: number }[] }) => {
        stopTimer();
        setIsGameOver(true);
        setGameOverPlayers(data.players);

        // Award coins and XP to local player
        const me = data.players.find((p) => p.id === socketId);
        if (me) {
          addCoins(me.coins);
          addXp(Math.floor(me.score / 2));
          const rank = data.players.findIndex((p) => p.id === socketId);
          updateProfile({
            gamesPlayed: profile.gamesPlayed + 1,
            wins: rank === 0 ? profile.wins + 1 : profile.wins,
            totalScore: profile.totalScore + me.score,
          });
        }
      }
    );

    return () => {
      socket.off("player_submitted");
      socket.off("round_results");
      socket.off("new_round");
      socket.off("game_over");
    };
  }, [socketId]);

  const startTimer = () => {
    stopTimer();
    setTimeLeft(ROUND_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          handleAutoSubmit();
          return 0;
        }
        if (prev <= 5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleAutoSubmit = useCallback(() => {
    if (!submitted) {
      handleSubmit();
    }
  }, [submitted, answers, roomId]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);
    Keyboard.dismiss();
    stopTimer();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    socket.emit("submit_answers", {
      roomId,
      answers,
    });
  }, [submitted, answers, roomId]);

  const handleNextRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket.emit("next_round", { roomId }, (_res: { isGameOver: boolean }) => {});
  };

  const handlePlayAgain = () => {
    socket.emit("play_again", { roomId });
    router.replace("/lobby");
  };

  const timerColor =
    timeLeft > 10 ? Colors.timerGreen : timeLeft > 5 ? Colors.timerYellow : Colors.timerRed;
  const timerProgress = timeLeft / ROUND_TIME;

  // Game over screen
  if (isGameOver) {
    const sortedPlayers = [...gameOverPlayers].sort((a, b) => b.score - a.score);
    const myRank = sortedPlayers.findIndex((p) => p.id === socketId);

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <ScrollView
          contentContainerStyle={styles.gameOverContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.gameOverTitle}>{t.gameOver}</Text>
          <View style={styles.trophyCircle}>
            <Ionicons name="trophy" size={56} color={Colors.gold} />
          </View>

          {sortedPlayers[0] && (
            <View style={styles.winnerCard}>
              <Text style={styles.winnerLabel}>{t.winner}</Text>
              <Text style={styles.winnerName}>{sortedPlayers[0].name}</Text>
              <Text style={styles.winnerScore}>{sortedPlayers[0].score} {t.points}</Text>
            </View>
          )}

          <View style={styles.finalRankings}>
            {sortedPlayers.map((p, idx) => {
              const isMe = p.id === socketId;
              const rankColors = [Colors.rank1, Colors.rank2, Colors.rank3];
              return (
                <View key={p.id} style={[styles.finalRankRow, isMe && styles.finalRankRowMe]}>
                  <Text style={[styles.finalRankNum, { color: rankColors[idx] || Colors.textMuted }]}>
                    {idx + 1}
                  </Text>
                  <Text style={styles.finalRankName}>{p.name}{isMe ? " ★" : ""}</Text>
                  <View style={styles.finalRankRight}>
                    <Text style={styles.finalRankScore}>{p.score}</Text>
                    <View style={styles.coinRewardBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                      <Text style={styles.coinRewardText}>+{p.coins}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain}>
            <Text style={styles.playAgainBtnText}>{t.playAgain}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Text style={styles.homeBtnText}>{t.backToHome}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Round results screen
  if (roundResults) {
    const myResult = roundResults.find((r) => r.playerId === socketId);
    const isHost = gamePlayers.find((p) => p.id === socketId)?.id === gamePlayers[0]?.id;

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.roundResultsHeader}>
          <Text style={styles.roundResultsTitle}>
            {t.results} - {t.round} {currentRound}/{numTotalRounds}
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.roundResultsContent}
          showsVerticalScrollIndicator={false}
        >
          {roundResults.map((result) => {
            const isMe = result.playerId === socketId;
            return (
              <View key={result.playerId} style={[styles.resultPlayerCard, isMe && styles.resultPlayerCardMe]}>
                <View style={styles.resultPlayerHeader}>
                  <Text style={styles.resultPlayerName}>{result.playerName}{isMe ? " (أنت)" : ""}</Text>
                  <View style={[styles.resultTotalBadge]}>
                    <Text style={styles.resultTotalText}>+{result.roundTotal}</Text>
                  </View>
                </View>
                {GAME_CATEGORIES.map((cat) => {
                  const ans = result.answers[cat] || "";
                  const sc = result.scores[cat] || 0;
                  const st = result.status[cat] || "empty";
                  const statusColor =
                    st === "correct" ? Colors.scoreCorrect
                      : st === "duplicate" ? Colors.scoreDuplicate
                      : Colors.scoreEmpty;
                  return (
                    <View key={cat} style={styles.resultCatRow}>
                      <Text style={styles.resultCatName}>{t[cat as keyof typeof t] as string}</Text>
                      <Text style={[styles.resultAnswer, !ans && styles.resultAnswerEmpty]}>
                        {ans || "—"}
                      </Text>
                      <View style={[styles.resultScoreBadge, { backgroundColor: statusColor + "22" }]}>
                        <Text style={[styles.resultScoreText, { color: statusColor }]}>
                          {sc > 0 ? `+${sc}` : "0"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          {/* Score summary */}
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreSummaryTitle}>المجموع الكلي</Text>
            {[...gamePlayers].sort((a, b) => b.score - a.score).map((p, idx) => (
              <View key={p.id} style={styles.scoreSummaryRow}>
                <Text style={styles.scoreSummaryRank}>{idx + 1}</Text>
                <Text style={styles.scoreSummaryName}>{p.name}</Text>
                <Text style={styles.scoreSummaryTotal}>{p.score}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {isHost ? (
          <TouchableOpacity style={styles.nextRoundBtn} onPress={handleNextRound}>
            <Text style={styles.nextRoundBtnText}>
              {currentRound >= numTotalRounds ? t.gameOver : t.nextRound}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.black} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingNextRound}>
            <Text style={styles.waitingNextRoundText}>في انتظار المضيف...</Text>
          </View>
        )}
      </View>
    );
  }

  // Game play screen
  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Top bar */}
      <View style={styles.gameTopBar}>
        {/* Letter */}
        <Animated.View
          style={[
            styles.letterDisplay,
            {
              transform: [
                { scale: letterAnim },
                {
                  rotate: letterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["20deg", "0deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.letterText}>{currentLetter}</Text>
        </Animated.View>

        {/* Round & timer */}
        <View style={styles.gameInfoRight}>
          <Text style={styles.roundLabel}>
            {t.round} {currentRound}/{numTotalRounds}
          </Text>
          <View style={styles.timerContainer}>
            <View style={styles.timerTrack}>
              <Animated.View
                style={[
                  styles.timerFill,
                  {
                    width: `${timerProgress * 100}%`,
                    backgroundColor: timerColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.timerText, { color: timerColor }]}>
              {timeLeft}
            </Text>
          </View>
        </View>
      </View>

      {/* Submitted count */}
      {submittedPlayers.length > 0 && (
        <View style={styles.submittedBar}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.emerald} />
          <Text style={styles.submittedText}>
            {submittedPlayers.length} {t.players} أرسلوا إجاباتهم
          </Text>
        </View>
      )}

      {/* Category inputs */}
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.inputsContent, { paddingBottom: bottomInset + 80 }]}
        showsVerticalScrollIndicator={false}
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
      >
        {GAME_CATEGORIES.map((cat, idx) => (
          <View key={cat} style={styles.categoryInputRow}>
            <Text style={styles.categoryLabel}>{t[cat as keyof typeof t] as string}</Text>
            <TextInput
              style={[
                styles.categoryInput,
                submitted && styles.categoryInputSubmitted,
                !!(answers[cat]) && styles.categoryInputFilled,
              ]}
              value={answers[cat] || ""}
              onChangeText={(val) => {
                if (!submitted) {
                  setAnswers((prev) => ({ ...prev, [cat]: val }));
                }
              }}
              placeholder={`${currentLetter}...`}
              placeholderTextColor={Colors.inputPlaceholder}
              editable={!submitted}
              textAlign="right"
              returnKeyType={idx < GAME_CATEGORIES.length - 1 ? "next" : "done"}
              autoCorrect={false}
            />
          </View>
        ))}
      </KeyboardAwareScrollView>

      {/* Submit button */}
      {!submitted ? (
        <TouchableOpacity
          style={[styles.submitBtn, { bottom: bottomInset + 12 }]}
          onPress={handleSubmit}
        >
          <Ionicons name="send" size={20} color={Colors.black} style={{ marginRight: 8 }} />
          <Text style={styles.submitBtnText}>{t.submit}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.submittedState, { bottom: bottomInset + 12 }]}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.emerald} />
          <Text style={styles.submittedStateText}>تم الإرسال! في انتظار اللاعبين الآخرين...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gameTopBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  letterDisplay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  letterText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 40,
    color: Colors.black,
    lineHeight: 52,
  },
  gameInfoRight: {
    flex: 1,
  },
  roundLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: "right",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timerTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    borderRadius: 4,
  },
  timerText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
    minWidth: 32,
    textAlign: "center",
  },
  submittedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.emerald + "15",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  submittedText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.emerald,
  },
  inputsContent: {
    padding: 12,
    gap: 8,
  },
  categoryInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    width: 72,
    textAlign: "right",
  },
  categoryInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    color: Colors.inputText,
  },
  categoryInputFilled: {
    borderColor: Colors.gold + "80",
    backgroundColor: Colors.gold + "10",
  },
  categoryInputSubmitted: {
    opacity: 0.6,
  },
  submitBtn: {
    position: "absolute",
    left: 16,
    right: 16,
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
  submitBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.black,
  },
  submittedState: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: Colors.emerald + "22",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.emerald + "40",
  },
  submittedStateText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.emerald,
  },
  roundResultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundSecondary,
  },
  roundResultsTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  roundResultsContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 100,
  },
  resultPlayerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  resultPlayerCardMe: {
    borderColor: Colors.gold + "60",
  },
  resultPlayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  resultPlayerName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: Colors.textPrimary,
  },
  resultTotalBadge: {
    backgroundColor: Colors.gold + "22",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  resultTotalText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  resultCatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder + "50",
  },
  resultCatName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.textMuted,
    width: 64,
    textAlign: "right",
  },
  resultAnswer: {
    flex: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  resultAnswerEmpty: {
    color: Colors.textMuted,
  },
  resultScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 32,
    alignItems: "center",
  },
  resultScoreText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
  },
  scoreSummary: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  scoreSummaryTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  scoreSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  scoreSummaryRank: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.gold,
    width: 30,
    textAlign: "center",
  },
  scoreSummaryName: {
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
    paddingHorizontal: 10,
  },
  scoreSummaryTotal: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  nextRoundBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  nextRoundBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.black,
  },
  waitingNextRound: {
    alignItems: "center",
    paddingVertical: 16,
  },
  waitingNextRoundText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textMuted,
  },
  gameOverContent: {
    padding: 20,
    alignItems: "center",
    paddingBottom: 40,
  },
  gameOverTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 32,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 20,
  },
  trophyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.gold + "22",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.gold + "40",
  },
  winnerCard: {
    backgroundColor: Colors.gold + "15",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  winnerLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    color: Colors.gold,
    marginBottom: 4,
  },
  winnerName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  winnerScore: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 16,
    color: Colors.gold,
  },
  finalRankings: {
    width: "100%",
    gap: 10,
    marginBottom: 24,
  },
  finalRankRow: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  finalRankRowMe: {
    borderColor: Colors.gold + "60",
  },
  finalRankNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    width: 36,
    textAlign: "center",
  },
  finalRankName: {
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: Colors.textPrimary,
    paddingHorizontal: 10,
  },
  finalRankRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  finalRankScore: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
  coinRewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Colors.gold + "20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coinRewardText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    color: Colors.gold,
  },
  playAgainBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 12,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  playAgainBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.black,
  },
  homeBtn: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  homeBtnText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
