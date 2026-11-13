import {useResultSound} from "@/lib/use-result-sound";
import {ScaledText as Text} from "@/components/ScaledText";
import {MatchRoster} from "@/components/MatchRoster";
import {AnswerSheet} from "@/components/AnswerSheet";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {Keyboard, Platform, ScrollView, StyleSheet, TouchableOpacity, View} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { GameIcon, GameIllustration } from "@/components/GameIcon";
import { GameHeader, GameScreenBackground, RewardCard, VictoryCosmeticEffect } from "@/components/GameUi";
import { gameDesign } from "@/constants/game-design";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ARABIC_LETTERS, GAME_CATEGORIES, type GameCategory } from "@/constants/i18n";
import { getOfflineWordsForCategory, validateOfflineWord } from "@/lib/offline-word-validator";

const ROUND_TIME = 50;
const TOTAL_ROUNDS = 5;
const ROUND_REWARD = 20;
const GOLD = gameDesign.colors.coins;

type GamePhase = "setup" | "playing" | "results" | "gameOver";
type AnswerStatus = "correct" | "empty" | "invalid";
type CategoryResult = { category: GameCategory; answer: string; status: AnswerStatus; points: number };
type BotDifficulty = "easy" | "normal" | "hard" | "legendary";
type BotId = "bot1" | "bot2" | "bot3";
type BotScoreMap = Record<BotId, number>;
type BotAnswerMap = Record<BotId, Partial<Record<GameCategory, string>>>;

const BOT_PLAYERS: { id: BotId; name: "botNameOne" | "botNameTwo" | "botNameThree"; color: string }[] = [
  { id: "bot1", name: "botNameOne", color: gameDesign.colors.friends },
  { id: "bot2", name: "botNameTwo", color: gameDesign.colors.chat },
  { id: "bot3", name: "botNameThree", color: gameDesign.colors.online },
];

const BOT_DIFFICULTIES: {
  id: BotDifficulty;
  title: "difficultyEasy" | "difficultyNormal" | "difficultyHard" | "difficultyLegendary";
  hint: "difficultyEasyHint" | "difficultyNormalHint" | "difficultyHardHint" | "difficultyLegendaryHint";
  color: string;
}[] = [
  { id: "easy", title: "difficultyEasy", hint: "difficultyEasyHint", color: gameDesign.colors.offline },
  { id: "normal", title: "difficultyNormal", hint: "difficultyNormalHint", color: gameDesign.colors.friends },
  { id: "hard", title: "difficultyHard", hint: "difficultyHardHint", color: gameDesign.colors.coins },
  { id: "legendary", title: "difficultyLegendary", hint: "difficultyLegendaryHint", color: gameDesign.colors.online },
];

const BOT_FILL_CHANCES: Record<BotDifficulty, number> = {
  easy: 0.34,
  normal: 0.53,
  hard: 0.72,
  legendary: 0.9,
};

function randomBotSuffixes(): Record<BotId, number> {
  return {
    bot1: Math.floor(100 + Math.random() * 900),
    bot2: Math.floor(100 + Math.random() * 900),
    bot3: Math.floor(100 + Math.random() * 900),
  };
}

function shuffleLetters(letters: string[]): string[] {
  const shuffled = [...letters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function OfflineScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { profile, addXp, updateProfile, awardOfflineMatch } = usePlayer();
  const { theme, isDark } = useTheme();
  const letterQueueRef = useRef(shuffleLetters(ARABIC_LETTERS));
  const letterIndexRef = useRef(0);
  const answersRef = useRef<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const submittedRef = useRef(false);
  const finishedRef = useRef(false);

  const getNextLetter = useCallback(() => {
    if (letterIndexRef.current >= letterQueueRef.current.length) {
      letterQueueRef.current = shuffleLetters(ARABIC_LETTERS);
      letterIndexRef.current = 0;
    }
    return letterQueueRef.current[letterIndexRef.current++];
  }, []);

  const [phase, setPhase] = useState<GamePhase>("setup");
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [currentRound, setCurrentRound] = useState(1);
  const [currentLetter, setCurrentLetter] = useState(getNextLetter);
  const [answers, setAnswers] = useState<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [roundResults, setRoundResults] = useState<CategoryResult[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [botScores, setBotScores] = useState<BotScoreMap>({ bot1: 0, bot2: 0, bot3: 0 });
  const [roundBotScores, setRoundBotScores] = useState<BotScoreMap>({ bot1: 0, bot2: 0, bot3: 0 });
  const [roundBotAnswers, setRoundBotAnswers] = useState<BotAnswerMap>({ bot1: {}, bot2: {}, bot3: {} });
  const [botNameSuffixes, setBotNameSuffixes] = useState<Record<BotId, number>>(randomBotSuffixes);

  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset = Platform.OS === "web" ? 16 : insets.bottom;

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submitRound = useCallback((submittedAnswers: Record<GameCategory, string>) => {
    if (phase !== "playing" || submittedRef.current) return;
    submittedRef.current = true;
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const results = GAME_CATEGORIES.map((category): CategoryResult => {
      const answer = (submittedAnswers[category] || "").trim();
      if (!answer) return { category, answer, status: "empty", points: 0 };
      if (!validateOfflineWord(answer, category, currentLetter)) {
        return { category, answer, status: "invalid", points: 0 };
      }
      return { category, answer, status: "correct", points: 3 };
    });
    const score = results.reduce((sum, result) => sum + result.points, 0);
    const roundScores: BotScoreMap = { bot1: 0, bot2: 0, bot3: 0 };
    const roundAnswers: BotAnswerMap = { bot1: {}, bot2: {}, bot3: {} };
    BOT_PLAYERS.forEach((bot, index) => {
      const botChance = Math.max(0, Math.min(1, BOT_FILL_CHANCES[difficulty] + (index - 1) * 0.06));
      GAME_CATEGORIES.forEach((category) => {
        const words = getOfflineWordsForCategory(category, currentLetter);
        if (words.length === 0 || Math.random() >= botChance) return;
        const answer = words[Math.floor(Math.random() * words.length)];
        roundAnswers[bot.id][category] = answer;
        roundScores[bot.id] += 3;
      });
    });
    setRoundResults(results);
    setRoundScore(score);
    setRoundBotScores(roundScores);
    setRoundBotAnswers(roundAnswers);
    setBotScores((previous) => ({
      bot1: previous.bot1 + roundScores.bot1,
      bot2: previous.bot2 + roundScores.bot2,
      bot3: previous.bot3 + roundScores.bot3,
    }));
    setTotalScore((previous) => previous + score);
    setPhase("results");
  }, [currentLetter, difficulty, phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    setTimeLeft(ROUND_TIME);
    submittedRef.current = false;
    const timer = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, currentRound]);

  useEffect(() => {
    if (phase === "playing" && timeLeft === 0) submitRound(answersRef.current);
  }, [phase, submitRound, timeLeft]);

  const finishGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    void awardOfflineMatch(totalScore);
    addXp(Math.floor(totalScore / 2));
    updateProfile({
      gamesPlayed: profile.gamesPlayed + 1,
      totalScore: profile.totalScore + totalScore,
    });
    setPhase("gameOver");
  };

  const handleNextRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentRound === TOTAL_ROUNDS) {
      finishGame();
      return;
    }
    setAnswers({} as Record<GameCategory, string>);
    answersRef.current = {} as Record<GameCategory, string>;
    setRoundResults([]);
    setRoundBotScores({ bot1: 0, bot2: 0, bot3: 0 });
    setRoundBotAnswers({ bot1: {}, bot2: {}, bot3: {} });
    setCurrentLetter(getNextLetter());
    setCurrentRound((round) => round + 1);
    setPhase("playing");
  };

  const resetGame = () => {
    finishedRef.current = false;
    letterQueueRef.current = shuffleLetters(ARABIC_LETTERS);
    letterIndexRef.current = 0;
    const nextLetter = getNextLetter();
    setCurrentLetter(nextLetter);
    setCurrentRound(1);
    setAnswers({} as Record<GameCategory, string>);
    answersRef.current = {} as Record<GameCategory, string>;
    setRoundResults([]);
    setRoundScore(0);
    setTotalScore(0);
    setBotScores({ bot1: 0, bot2: 0, bot3: 0 });
    setRoundBotScores({ bot1: 0, bot2: 0, bot3: 0 });
    setRoundBotAnswers({ bot1: {}, bot2: {}, bot3: {} });
    setBotNameSuffixes(randomBotSuffixes());
    setPhase("setup");
  };

  const startGame = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBotNameSuffixes(randomBotSuffixes());
    setPhase("playing");
  };

  const closeScreen = () => router.replace("/");
  const timerColor = timeLeft > 15
    ? isDark ? gameDesign.colors.successOnDark : gameDesign.colors.success
    : timeLeft > 8 ? gameDesign.colors.coins
    : isDark ? gameDesign.colors.dangerOnDark : gameDesign.colors.danger;
  const selectedDifficulty = BOT_DIFFICULTIES.find((option) => option.id === difficulty) ?? BOT_DIFFICULTIES[1];
  const standings = [
    { id: "player", name: profile.name, score: totalScore, color: gameDesign.colors.coins },
    ...BOT_PLAYERS.map((bot) => ({ id: bot.id, name: t[bot.name] + "_" + botNameSuffixes[bot.id], score: botScores[bot.id], color: bot.color })),
  ].sort((first, second) => second.score - first.score);
  const highestBotScore = Math.max(...Object.values(botScores));
  const playerWon = totalScore > highestBotScore;
  const matchDraw = totalScore === highestBotScore;
  useResultSound(phase==="gameOver"?"offline-result":null,playerWon?"win":matchDraw?"draw":"lose");

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <GameScreenBackground accent="offline" />
      <GameHeader compact
        title={t.offlineMode}
        subtitle={phase === "setup" ? t.botMatchDescription : t[selectedDifficulty.title]}
        onBack={closeScreen}
        icon={<GameIcon name="offline" size={23} color={gameDesign.colors.offline} />}
        trailing={phase !== "setup" ? (
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>{currentRound}/{TOTAL_ROUNDS}</Text>
          </View>
        ) : undefined}
      />

      {phase === "setup" && (
        <ScrollView
          contentContainerStyle={styles.setupContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.setupIntro}>
            <View style={styles.setupIcon}>
              <GameIcon name="offline" size={36} color={gameDesign.colors.offline} />
            </View>
            <Text style={[styles.setupTitle, { color: theme.textPrimary }]}>{t.botMatchTitle}</Text>
            <Text style={[styles.setupDescription, { color: theme.textSecondary }]}>
              {t.botMatchDescription}
            </Text>
          </View>

          <View style={styles.botRoster}>
            {BOT_PLAYERS.map((bot) => (
              <View
                key={bot.id}
                style={[styles.botChip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              >
                <View style={[styles.botAvatar, { backgroundColor: `${bot.color}20` }]}>
                  <Ionicons name="hardware-chip-outline" size={17} color={bot.color} />
                </View>
                <Text style={[styles.botName, { color: theme.textPrimary }]}>{t[bot.name] + "_" + botNameSuffixes[bot.id]}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.difficultyHeading, { color: theme.textPrimary }]}>{t.chooseBotDifficulty}</Text>
          <View style={styles.difficultyList}>
            {BOT_DIFFICULTIES.map((option) => {
              const selected = difficulty === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.difficultyCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: selected ? option.color : theme.cardBorder,
                    },
                  ]}
                  onPress={() => setDifficulty(option.id)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.difficultyIcon, { backgroundColor: `${option.color}20` }]}>
                    <Ionicons
                      name={option.id === "legendary" ? "flame" : option.id === "easy" ? "leaf" : "flash"}
                      size={20}
                      color={option.color}
                    />
                  </View>
                  <View style={styles.difficultyCopy}>
                    <Text style={[styles.difficultyTitle, { color: theme.textPrimary }]}>{t[option.title]}</Text>
                    <Text style={[styles.difficultyHint, { color: theme.textSecondary }]}>{t[option.hint]}</Text>
                  </View>
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={21}
                    color={selected ? option.color : theme.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.submitButton}
            onPress={startGame}
            activeOpacity={0.85}
          >
            <Ionicons name="play-circle-outline" size={22} color={gameDesign.colors.textPrimary} />
            <Text style={styles.submitText}>{t.startBotMatch}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {phase === "playing" && (
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={styles.playContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >

          <View style={{flexDirection:"row-reverse",gap:10,alignItems:"stretch"}}>
          <View style={[styles.timerCard, {flex:1,justifyContent:"center",minWidth:0}, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.timerLabels}>
              <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>{t.timeLeft}</Text>
              <Text style={[styles.timerNumber, { color: timerColor }]}>{timeLeft}s</Text>
            </View>
            <View style={[styles.timerTrack, { backgroundColor: theme.backgroundTertiary }]}>
              <View style={[styles.timerProgress, { width: `${(timeLeft / ROUND_TIME) * 100}%`, backgroundColor: timerColor }]} />
            </View>
          </View>

          <View style={[styles.letterCard, { backgroundColor: theme.card, borderColor: gameDesign.colors.offline }]}>
            <Text style={[styles.letterLabel, { color: gameDesign.colors.coinsText }]}>{t.currentLetter}</Text>
            <Text style={[styles.letter, { color: gameDesign.colors.coinsText }]}>{currentLetter}</Text>

          </View>

          </View>
          <MatchRoster ownId="offline-self" compact players={[{id:"offline-self",name:profile.name,score:totalScore},...BOT_PLAYERS.map(bot=>({id:bot.id,name:t[bot.name] + "_" + botNameSuffixes[bot.id],score:botScores[bot.id]}))]}/>

          <AnswerSheet answers={answers} maxLength={40} onChange={(category,value)=>setAnswers(previous=>({...previous,[category]:value}))} onSubmit={()=>submitRound(answersRef.current)}/>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.submitButton}
            onPress={() => submitRound(answers)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color={gameDesign.colors.textPrimary} />
            <Text style={styles.submitText}>{t.submit}</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      )}

      {phase === "results" && (
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.scoreCard, { backgroundColor: theme.card, borderColor: `${gameDesign.colors.offline}55` }]}>
            <Text style={[styles.scoreCaption, { color: theme.textSecondary }]}>{t.results} · {t.round} {currentRound}/{TOTAL_ROUNDS}</Text>
            <Text style={styles.scoreValue}>+{roundScore} {t.points}</Text>
          </View>
          <View style={[styles.roundBotCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.botScoresHeading, { color: theme.textPrimary }]}>{t.roundBotScores}</Text>
            {BOT_PLAYERS.map((bot) => (
              <View key={bot.id} style={[styles.botScoreRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={styles.botScoreContent}>
                  <View style={styles.standingPlayer}>
                    <View style={[styles.standingDot, { backgroundColor: bot.color }]} />
                    <Text style={[styles.botScoreName, { color: theme.textPrimary }]}>{t[bot.name] + "_" + botNameSuffixes[bot.id]}</Text>
                  </View>
                  <Text style={[styles.botAnswers, { color: theme.textSecondary }]}>
                    {t.botAnswers}: {GAME_CATEGORIES
                      .filter((category) => roundBotAnswers[bot.id][category])
                      .map((category) => `${t[category]}: ${roundBotAnswers[bot.id][category]}`)
                      .join(" · ") || "—"}
                  </Text>
                </View>
                <Text style={[styles.botScoreValue, { color: bot.color }]}>+{roundBotScores[bot.id]}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.resultList, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {roundResults.map((result) => {
              const statusColor = result.status === "correct"
                ? isDark ? gameDesign.colors.successOnDark : gameDesign.colors.successText
                : result.status === "invalid"
                  ? isDark ? gameDesign.colors.dangerOnDark : gameDesign.colors.dangerText
                  : theme.textMuted;
              const statusText = result.status === "correct" ? t.correct : result.status === "invalid" ? t.invalidWord : t.empty;
              return (
                <View key={result.category} style={[styles.resultRow, { borderBottomColor: theme.cardBorder }]}>
                  <View style={styles.resultWords}>
                    <Text style={[styles.resultCategory, { color: theme.textSecondary }]}>{t[result.category]}</Text>
                    <Text style={[styles.resultAnswer, { color: theme.textPrimary }]}>{result.answer || "—"}</Text>
                  </View>
                  <View style={styles.resultPoints}>
                    <Text style={[styles.resultStatus, { color: statusColor }]}>{statusText}</Text>
                    <Text style={[styles.resultPointValue, { color: statusColor }]}>{result.points > 0 ? `+${result.points}` : "0"}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={handleNextRound} activeOpacity={0.85}>
            <Text style={styles.submitText}>{currentRound === TOTAL_ROUNDS ? t.gameOver : t.nextRound}</Text>
            <Ionicons name="arrow-forward" size={20} color={gameDesign.colors.textPrimary} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {phase === "gameOver" && (
        <ScrollView contentContainerStyle={styles.gameOverContent} showsVerticalScrollIndicator={false}>
          <View style={styles.trophyCircle}>
            <GameIllustration name={playerWon || matchDraw ? "victory" : "defeat"} size={94} />
          </View>
          {playerWon ? <VictoryCosmeticEffect effectId={profile.equippedCosmetics.victory} /> : null}
          <Text style={[styles.gameOverTitle, { color: theme.textPrimary }]}>
            {playerWon ? t.youBeatBots : matchDraw ? t.matchDraw : t.botsWon}
          </Text>
          <Text style={[styles.totalScore, { color: theme.textSecondary }]}>{t.totalScore}: {totalScore}</Text>
          <View style={[styles.finalStandings, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.standingsTitle, { color: theme.textPrimary }]}>{t.finalStandings}</Text>
            {standings.map((player, index) => (
              <View key={player.id} style={[styles.finalStandingRow, { borderBottomColor: theme.cardBorder }]}>
                <Text style={[styles.finalRank, { color: index === 0 ? GOLD : theme.textMuted }]}>#{index + 1}</Text>
                <View style={[styles.standingDot, { backgroundColor: player.color }]} />
                <Text style={[styles.finalStandingName, { color: theme.textPrimary }]} numberOfLines={1}>{player.name}</Text>
                <Text style={[styles.finalStandingScore, { color: player.color }]}>{player.score}</Text>
              </View>
            ))}
          </View>
          <RewardCard title={t.coinsEarned} amount={`+${ROUND_REWARD}`} icon={playerWon ? "victory" : "reward"} />
          <TouchableOpacity style={styles.submitButton} onPress={resetGame} activeOpacity={0.85}>
            <Ionicons name="refresh" size={21} color={gameDesign.colors.textPrimary} />
            <Text style={styles.submitText}>{t.playAgain}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.homeButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={closeScreen}
          >
            <Text style={[styles.homeButtonText, { color: theme.textSecondary }]}>{t.backToHome}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  backButton: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18 },
  headerSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12 },
  roundBadge: { minWidth: 54, height: 40, borderRadius: 14, backgroundColor: `${gameDesign.colors.offline}20`, alignItems: "center", justifyContent: "center" },
  roundBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: gameDesign.colors.coinsText },
  setupContent: { width: "100%", maxWidth: 560, alignSelf: "center", padding: 18, gap: 14, paddingBottom: 30 },
  setupIntro: { alignItems: "center", paddingTop: 16, paddingBottom: 4, gap: 7 },
  setupIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: `${gameDesign.colors.friends}18`, alignItems: "center", justifyContent: "center" },
  setupTitle: { fontFamily: "Cairo_700Bold", fontSize: 21, textAlign: "center" },
  setupDescription: { fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center" },
  botRoster: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  botChip: { flex: 1, minHeight: 72, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4, padding: 8 },
  botAvatar: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  botName: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
  difficultyHeading: { fontFamily: "Cairo_700Bold", fontSize: 16, marginTop: 4 },
  difficultyList: { gap: 9 },
  difficultyCard: { minHeight: 67, borderRadius: 17, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12 },
  difficultyIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  difficultyCopy: { flex: 1 },
  difficultyTitle: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  difficultyHint: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  playContent: { width: "100%", maxWidth: 560, alignSelf: "center", padding: 18, gap: 14, paddingBottom: 30 },
  timerCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 9 },
  timerLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timerLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
  timerNumber: { fontFamily: "Cairo_700Bold", fontSize: 17 },
  timerTrack: { height: 7, borderRadius: 4, overflow: "hidden" },
  timerProgress: { height: "100%", borderRadius: 4 },
  letterCard: { width:84, minHeight: 86, borderRadius: 18, borderWidth: 2, overflow: "hidden", alignItems: "center", justifyContent: "center", padding: 5 },
  letterLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 9 },
  letter: { fontFamily: "Cairo_700Bold", fontSize: 42, lineHeight: 54 },
  instruction: { fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "center" },
  liveStandings: { borderRadius: 17, borderWidth: 1, padding: 12, gap: 8 },
  standingsHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  standingsTitle: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  standingsRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  standingPlayer: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 },
  standingDot: { width: 7, height: 7, borderRadius: 4 },
  standingName: { flex: 1, fontFamily: "Cairo_400Regular", fontSize: 10 },
  standingScore: { fontFamily: "Cairo_700Bold", fontSize: 12 },
  categories: { gap: 10 },
  inputCard: { borderRadius: 16, borderWidth: 1, padding: 11, gap: 6 },
  inputLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13 },
  answerInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontFamily: "Cairo_400Regular", fontSize: 16 },
  submitButton: { minHeight: 52, borderRadius: 16, backgroundColor: gameDesign.colors.offline, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 4 },
  submitText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: gameDesign.colors.textPrimary },
  resultContent: { flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center", padding: 18, gap: 14, justifyContent: "center" },
  scoreCard: { borderRadius: 20, borderWidth: 1, alignItems: "center", paddingVertical: 18, gap: 4 },
  scoreCaption: { fontFamily: "Cairo_400Regular", fontSize: 13 },
  scoreValue: { fontFamily: "Cairo_700Bold", fontSize: 28, color: gameDesign.colors.successText },
  roundBotCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  botScoresHeading: { fontFamily: "Cairo_700Bold", fontSize: 14, marginBottom: 4 },
  botScoreRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 5 },
  botScoreContent: { flex: 1, gap: 1 },
  botScoreName: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
  botAnswers: { fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 15 },
  botScoreValue: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  resultList: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  resultRow: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  resultWords: { flex: 1, gap: 1 },
  resultCategory: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  resultAnswer: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  resultPoints: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultStatus: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  resultPointValue: { minWidth: 24, textAlign: "right", fontFamily: "Cairo_700Bold", fontSize: 14 },
  gameOverContent: { flexGrow: 1, width: "100%", maxWidth: 480, alignSelf: "center", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  trophyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: `${gameDesign.colors.coins}18`, alignItems: "center", justifyContent: "center" },
  gameOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 27 },
  totalScore: { fontFamily: "Cairo_600SemiBold", fontSize: 18 },
  finalStandings: { width: "100%", borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  finalStandingRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  finalRank: { width: 24, fontFamily: "Cairo_700Bold", fontSize: 13 },
  finalStandingName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 13 },
  finalStandingScore: { fontFamily: "Cairo_700Bold", fontSize: 15 },
  rewardBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: 15, borderRadius: 16, backgroundColor: `${gameDesign.colors.coins}18` },
  rewardText: { fontFamily: "Cairo_700Bold", fontSize: 17, color: gameDesign.colors.coinsText },
  homeButton: { width: "100%", minHeight: 48, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  homeButtonText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
});
