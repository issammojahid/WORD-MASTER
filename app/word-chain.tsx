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
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";
import { getApiUrl } from "@/lib/query-client";

const WC_BG: [string, string, string] = ["#0D0021", "#1A003A", "#0D0021"];
const TURN_TIME = 15;
const ROUNDS_TO_WIN = 2;

type ChainEntry = { socketId: string; playerName: string; word: string; isAi?: boolean };
type Player = { socketId: string; name: string; skin: string; roundWins: number };
type Phase = "mode_select" | "waiting" | "playing" | "round_over" | "game_over";

export default function WordChainScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, addCoins } = usePlayer();
  const socket = getSocket();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const equippedSkin = SKINS.find(s => s.id === profile.equippedSkin) || SKINS[0];

  const [phase, setPhase] = useState<Phase>("mode_select");
  const [mode, setMode] = useState<"ai" | "online" | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [mySocketId, setMySocketId] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [requiredLetter, setRequiredLetter] = useState("");
  const [currentTurnSocketId, setCurrentTurnSocketId] = useState<string>("");
  const [roundNum, setRoundNum] = useState(1);
  const [roundWins, setRoundWins] = useState<{ socketId: string; wins: number }[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [gameOverData, setGameOverData] = useState<{
    winnerSocketId: string; loserSocketId: string; chain: ChainEntry[];
  } | null>(null);
  const [roundOverData, setRoundOverData] = useState<{
    loserSocketId: string; winnerSocketId: string; chain: ChainEntry[]; reason: string;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainScrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const isMyTurn = mySocketId && currentTurnSocketId === mySocketId;
  const isAiMode = mode === "ai";

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    setMySocketId(socket.id || "");

    const handleConnect = () => setMySocketId(socket.id || "");
    const handleWordChainStart = (data: {
      roomId: string;
      players: Player[];
      currentTurnSocketId: string;
      requiredLetter: string;
      chain: ChainEntry[];
      roundNum: number;
    }) => {
      setRoomId(data.roomId);
      setPlayers(data.players);
      setCurrentTurnSocketId(data.currentTurnSocketId);
      setRequiredLetter(data.requiredLetter);
      setChain(data.chain);
      setRoundNum(data.roundNum);
      setRoundWins(data.players.map(p => ({ socketId: p.socketId, wins: 0 })));
      setPhase("playing");
      resetTimer();
    };
    const handleWordChainUpdate = (data: {
      chain: ChainEntry[];
      currentTurnSocketId: string;
      requiredLetter: string;
    }) => {
      setChain(data.chain);
      setCurrentTurnSocketId(data.currentTurnSocketId);
      setRequiredLetter(data.requiredLetter);
      setWordInput("");
      setInputError(null);
      resetTimer();
      setTimeout(() => chainScrollRef.current?.scrollToEnd({ animated: true }), 100);
    };
    const handleWordChainRoundOver = (data: {
      loserSocketId: string;
      winnerSocketId: string;
      chain: ChainEntry[];
      roundNum: number;
      roundWins: { socketId: string; wins: number }[];
      reason: string;
    }) => {
      stopTimer();
      setChain(data.chain);
      setRoundWins(data.roundWins);
      setRoundOverData({ loserSocketId: data.loserSocketId, winnerSocketId: data.winnerSocketId, chain: data.chain, reason: data.reason });
      setPhase("round_over");
      Haptics.notificationAsync(data.winnerSocketId === socket.id ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    };
    const handleWordChainNewRound = (data: {
      roundNum: number;
      requiredLetter: string;
      currentTurnSocketId: string;
      roundWins: { socketId: string; wins: number }[];
    }) => {
      setRoundNum(data.roundNum);
      setRequiredLetter(data.requiredLetter);
      setCurrentTurnSocketId(data.currentTurnSocketId);
      setRoundWins(data.roundWins);
      setChain([]);
      setRoundOverData(null);
      setPhase("playing");
      resetTimer();
    };
    const handleWordChainGameOver = (data: {
      winnerSocketId: string;
      loserSocketId: string;
      chain: ChainEntry[];
    }) => {
      stopTimer();
      setGameOverData(data);
      setPhase("game_over");
      if (data.winnerSocketId === socket.id) {
        addCoins(30);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    const handleOpponentLeft = () => {
      stopTimer();
      Alert.alert("", "غادر المنافس المباراة", [{ text: "رجوع", onPress: () => router.back() }]);
    };

    socket.on("connect", handleConnect);
    socket.on("word_chain_start", handleWordChainStart);
    socket.on("word_chain_update", handleWordChainUpdate);
    socket.on("word_chain_round_over", handleWordChainRoundOver);
    socket.on("word_chain_new_round", handleWordChainNewRound);
    socket.on("word_chain_game_over", handleWordChainGameOver);
    socket.on("word_chain_opponent_left", handleOpponentLeft);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("word_chain_start", handleWordChainStart);
      socket.off("word_chain_update", handleWordChainUpdate);
      socket.off("word_chain_round_over", handleWordChainRoundOver);
      socket.off("word_chain_new_round", handleWordChainNewRound);
      socket.off("word_chain_game_over", handleWordChainGameOver);
      socket.off("word_chain_opponent_left", handleOpponentLeft);
      stopTimer();
      if (roomId) socket.emit("word_chain_leave", { roomId });
    };
  }, [socket, roomId]);

  function resetTimer() {
    stopTimer();
    setTimeLeft(TURN_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { stopTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startAiMode() {
    setMode("ai");
    const firstLetter = "م";
    setRequiredLetter(firstLetter);
    setPhase("playing");
    setChain([]);
    setRoundNum(1);
    setRoundWins([
      { socketId: "me", wins: 0 },
      { socketId: "ai", wins: 0 },
    ]);
    setPlayers([
      { socketId: "me", name: profile.name, skin: profile.equippedSkin, roundWins: 0 },
      { socketId: "ai", name: "الذكاء الاصطناعي 🤖", skin: "robot", roundWins: 0 },
    ]);
    setCurrentTurnSocketId("me");
    setMySocketId("me");
    resetTimer();
  }

  function startOnlineMode() {
    setMode("online");
    setPhase("waiting");
    socket.emit("word_chain_join", { playerId, playerName: profile.name, skin: profile.equippedSkin }, (res: { success: boolean; roomId?: string }) => {
      if (!res.success) {
        Alert.alert("", "تعذر الانضمام للمباراة");
        setPhase("mode_select");
      }
    });
  }

  async function submitWord() {
    const word = wordInput.trim();
    if (!word) return;
    if ([...word][0] !== requiredLetter && !isLetterEquivalent([...word][0], requiredLetter)) {
      setInputError(`الكلمة يجب أن تبدأ بحرف ${requiredLetter}`);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSubmitting(true);
    setInputError(null);
    if (isAiMode) {
      const usedWords = chain.map(c => c.word);
      if (usedWords.includes(word)) {
        setInputError("هذه الكلمة استُخدمت مسبقاً");
        shake();
        setSubmitting(false);
        return;
      }
      const lastChar = [...word].at(-1) || "";
      const newChain = [...chain, { socketId: "me", playerName: profile.name, word }];
      setChain(newChain);
      setWordInput("");
      setCurrentTurnSocketId("ai");
      resetTimer();
      setTimeout(() => chainScrollRef.current?.scrollToEnd({ animated: true }), 100);
      await aiTakeTurn(lastChar, newChain, usedWords.concat([word]));
    } else {
      if (!roomId) { setSubmitting(false); return; }
      socket.emit("word_chain_submit", { roomId, word }, (res: { valid: boolean; error?: string }) => {
        if (!res.valid) {
          const msg = res.error === "already_used" ? "هذه الكلمة استُخدمت مسبقاً" :
            res.error === "not_your_turn" ? "ليس دورك" :
            res.error === "invalid_word" ? "كلمة غير صحيحة" : "خطأ";
          setInputError(msg);
          shake();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        setSubmitting(false);
      });
      return;
    }
    setSubmitting(false);
  }

  async function aiTakeTurn(letter: string, currentChain: ChainEntry[], usedWords: string[]) {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 1000));
    try {
      const url = new URL("/api/word-chain/ai-turn", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiredLetter: letter, usedWords }),
      });
      const data = await res.json();
      if (data.concede || !data.word) {
        const newRoundWins = [...roundWins];
        const meIdx = newRoundWins.findIndex(r => r.socketId === "me");
        if (meIdx !== -1) newRoundWins[meIdx].wins++;
        setRoundWins(newRoundWins);
        if (newRoundWins[meIdx]?.wins >= ROUNDS_TO_WIN) {
          setGameOverData({ winnerSocketId: "me", loserSocketId: "ai", chain: currentChain });
          setPhase("game_over");
          addCoins(30);
          stopTimer();
        } else {
          setRoundOverData({ loserSocketId: "ai", winnerSocketId: "me", chain: currentChain, reason: "no_words" });
          setPhase("round_over");
        }
        return;
      }
      const lastChar = [...data.word].at(-1) || "";
      const newChain = [...currentChain, { socketId: "ai", playerName: "الذكاء الاصطناعي 🤖", word: data.word, isAi: true }];
      setChain(newChain);
      setRequiredLetter(lastChar);
      setCurrentTurnSocketId("me");
      resetTimer();
      setTimeout(() => chainScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setCurrentTurnSocketId("me");
    }
  }

  function isLetterEquivalent(a: string, b: string): boolean {
    const equivalents: Record<string, string[]> = {
      "ا": ["أ", "إ", "آ"],
      "أ": ["ا", "إ"],
      "إ": ["ا", "أ"],
    };
    return equivalents[b]?.includes(a) || equivalents[a]?.includes(b) || false;
  }

  function handleAiRoundTimeout() {
    const newRoundWins = [...roundWins];
    const aiIdx = newRoundWins.findIndex(r => r.socketId === "ai");
    if (aiIdx !== -1) newRoundWins[aiIdx].wins++;
    setRoundWins(newRoundWins);
    setRoundOverData({ loserSocketId: "me", winnerSocketId: "ai", chain, reason: "timeout" });
    setPhase("round_over");
    stopTimer();
  }

  useEffect(() => {
    if (isAiMode && phase === "playing" && isMyTurn && timeLeft === 0) {
      handleAiRoundTimeout();
    }
  }, [timeLeft, phase, isMyTurn, isAiMode]);

  function continueAfterRound() {
    if (!roundOverData) return;
    const meWins = roundWins.find(r => r.socketId === (isAiMode ? "me" : mySocketId))?.wins || 0;
    const oppWins = roundWins.find(r => r.socketId !== (isAiMode ? "me" : mySocketId))?.wins || 0;
    if (meWins >= ROUNDS_TO_WIN || oppWins >= ROUNDS_TO_WIN) {
      const winnerSocketId = meWins >= ROUNDS_TO_WIN ? (isAiMode ? "me" : mySocketId) : (isAiMode ? "ai" : "opp");
      setGameOverData({ winnerSocketId, loserSocketId: winnerSocketId === "me" ? "ai" : "me", chain });
      setPhase("game_over");
      if (meWins >= ROUNDS_TO_WIN) { addCoins(30); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    } else {
      const newLetter = "م";
      setRequiredLetter(newLetter);
      setChain([]);
      setRoundNum(r => r + 1);
      setRoundOverData(null);
      setCurrentTurnSocketId("me");
      setPhase("playing");
      resetTimer();
    }
  }

  const timerProgress = timeLeft / TURN_TIME;
  const timerColor = timeLeft > 8 ? Colors.emerald : timeLeft > 4 ? Colors.gold : Colors.ruby;

  if (phase === "mode_select") {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <LinearGradient colors={WC_BG} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#E8E8FF" />
        </TouchableOpacity>
        <View style={styles.modeSelectContent}>
          <Text style={styles.modeSelectEmoji}>🔗</Text>
          <Text style={styles.modeSelectTitle}>سلسلة الكلمات</Text>
          <Text style={styles.modeSelectSub}>كل كلمة تبدأ من آخر حرف الكلمة السابقة{"\n"}من يتوقف يخسر الجولة!</Text>
          <TouchableOpacity style={styles.modeBtn} onPress={startAiMode} activeOpacity={0.85}>
            <LinearGradient colors={["#8B5CF620", "#8B5CF608"]} style={styles.modeBtnGrad}>
              <Text style={styles.modeBtnEmoji}>🤖</Text>
              <Text style={styles.modeBtnTitle}>ضد الذكاء الاصطناعي</Text>
              <Text style={styles.modeBtnSub}>تدرب وسع مفرداتك</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeBtn} onPress={startOnlineMode} activeOpacity={0.85}>
            <LinearGradient colors={[Colors.emerald + "20", Colors.emerald + "08"]} style={styles.modeBtnGrad}>
              <Text style={styles.modeBtnEmoji}>👥</Text>
              <Text style={styles.modeBtnTitle}>لاعب حقيقي</Text>
              <Text style={styles.modeBtnSub}>تحدّى لاعباً عشوائياً</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.rulesBox}>
            <Text style={styles.rulesTitle}>القواعد</Text>
            <Text style={styles.rulesText}>• كل كلمة يجب أن تبدأ بآخر حرف من الكلمة السابقة</Text>
            <Text style={styles.rulesText}>• لديك {TURN_TIME} ثانية لكل دور</Text>
            <Text style={styles.rulesText}>• أول لاعب يفوز بـ {ROUNDS_TO_WIN} جولات يفوز بـ 30 عملة 🪙</Text>
          </View>
        </View>
      </View>
    );
  }

  if (phase === "waiting") {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: topInset }]}>
        <LinearGradient colors={WC_BG} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={[styles.backBtn, { position: "absolute", top: topInset + 8, left: 16 }]} onPress={() => { setPhase("mode_select"); socket.emit("word_chain_cancel"); }}>
          <Ionicons name="arrow-back" size={22} color="#E8E8FF" />
        </TouchableOpacity>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.waitingText}>جاري البحث عن منافس...</Text>
        <Text style={styles.waitingSub}>انتظر قليلاً</Text>
      </View>
    );
  }

  if (phase === "game_over" && gameOverData) {
    const iWon = gameOverData.winnerSocketId === (isAiMode ? "me" : mySocketId);
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <LinearGradient colors={WC_BG} style={StyleSheet.absoluteFillObject} />
        <ScrollView contentContainerStyle={styles.gameOverContent}>
          <Text style={styles.gameOverEmoji}>{iWon ? "🏆" : "😔"}</Text>
          <Text style={styles.gameOverTitle}>{iWon ? "فزت!" : "خسرت"}</Text>
          {iWon && <Text style={styles.gameOverCoins}>+30 عملة 🪙</Text>}
          <Text style={styles.chainTitle}>سلسلة الكلمات</Text>
          <View style={styles.chainList}>
            {gameOverData.chain.map((entry, i) => {
              const isMe = entry.socketId === (isAiMode ? "me" : mySocketId);
              return (
                <View key={i} style={[styles.chainEntry, isMe ? styles.chainEntryMe : styles.chainEntryOpp]}>
                  <Text style={[styles.chainWord, isMe ? styles.chainWordMe : styles.chainWordOpp]}>{entry.word}</Text>
                  <Text style={styles.chainPlayerName}>{entry.playerName}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.winnerRow}>
            <View style={[styles.winnerBadge, { backgroundColor: iWon ? Colors.gold + "20" : Colors.ruby + "20", borderColor: iWon ? Colors.gold + "60" : Colors.ruby + "60" }]}>
              <Text style={[styles.winnerBadgeText, { color: iWon ? Colors.gold : Colors.ruby }]}>
                {iWon ? "🏆 الفائز" : "😔 الخاسر"}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.playAgainBtn} onPress={() => setPhase("mode_select")} activeOpacity={0.8}>
            <Text style={styles.playAgainBtnText}>العب مرة أخرى</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.homeBtnText}>رجوع</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (phase === "round_over" && roundOverData) {
    const iWon = roundOverData.winnerSocketId === (isAiMode ? "me" : mySocketId);
    const meWins = roundWins.find(r => r.socketId === (isAiMode ? "me" : mySocketId))?.wins || 0;
    const oppWins = roundWins.find(r => r.socketId !== (isAiMode ? "me" : mySocketId))?.wins || 0;
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <LinearGradient colors={WC_BG} style={StyleSheet.absoluteFillObject} />
        <View style={styles.roundOverContent}>
          <Text style={styles.roundOverEmoji}>{iWon ? "✅" : "❌"}</Text>
          <Text style={styles.roundOverTitle}>{iWon ? "فزت بالجولة!" : "خسرت الجولة"}</Text>
          <Text style={styles.roundOverReason}>
            {roundOverData.reason === "timeout" ? (iWon ? "انتهى وقت المنافس" : "انتهى وقتك") : "المنافس لم يجد كلمة"}
          </Text>
          <View style={styles.winsRow}>
            <View style={styles.winsBadge}>
              <Text style={styles.winsBadgeName}>{profile.name}</Text>
              <Text style={styles.winsBadgeNum}>{meWins} / {ROUNDS_TO_WIN}</Text>
            </View>
            <Text style={styles.winsDash}>–</Text>
            <View style={styles.winsBadge}>
              <Text style={styles.winsBadgeNum}>{oppWins} / {ROUNDS_TO_WIN}</Text>
              <Text style={styles.winsBadgeName}>{isAiMode ? "AI" : "المنافس"}</Text>
            </View>
          </View>
          {isAiMode && (
            <TouchableOpacity style={styles.continueBtn} onPress={continueAfterRound} activeOpacity={0.8}>
              <Text style={styles.continueBtnText}>الجولة التالية</Text>
            </TouchableOpacity>
          )}
          {!isAiMode && (
            <Text style={[styles.waitingSub, { marginTop: 12 }]}>في انتظار الجولة التالية...</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient colors={WC_BG} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn2} onPress={() => {
          if (roomId) socket.emit("word_chain_leave", { roomId });
          setPhase("mode_select");
          stopTimer();
        }}>
          <Ionicons name="arrow-back" size={22} color="#E8E8FF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🔗 سلسلة الكلمات</Text>
          <Text style={styles.headerSub}>الجولة {roundNum} · {roundWins.map(r => r.wins).join(" - ")}</Text>
        </View>
        {/* Turn Timer */}
        <View style={[styles.timerCircle, { borderColor: timerColor }]}>
          <Text style={[styles.timerNum, { color: timerColor }]}>{timeLeft}</Text>
        </View>
      </View>

      {/* Required Letter Display */}
      <View style={styles.requiredLetterBanner}>
        <Text style={styles.requiredLetterLabel}>ابدأ بحرف:</Text>
        <View style={[styles.requiredLetterBox, { borderColor: "#8B5CF6", backgroundColor: "#8B5CF618" }]}>
          <Text style={styles.requiredLetterText}>{requiredLetter}</Text>
        </View>
        <Text style={[styles.turnIndicator, { color: isMyTurn ? Colors.emerald : "#9898CC" }]}>
          {isMyTurn ? "دورك الآن" : "دور المنافس"}
        </Text>
      </View>

      {/* Chain Display */}
      <ScrollView
        ref={chainScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chainContent}
        showsVerticalScrollIndicator={false}
      >
        {chain.length === 0 && (
          <Text style={styles.chainEmptyText}>
            {isMyTurn ? `أدخل كلمة تبدأ بحرف ${requiredLetter}` : "المنافس يفكر..."}
          </Text>
        )}
        {chain.map((entry, i) => {
          const isMe = entry.socketId === (isAiMode ? "me" : mySocketId);
          return (
            <View key={i} style={[styles.chainItem, isMe ? styles.chainItemMe : styles.chainItemOpp]}>
              <Text style={[styles.chainItemWord, isMe ? styles.chainItemWordMe : styles.chainItemWordOpp]}>
                {entry.word}
              </Text>
              <Text style={styles.chainItemPlayer}>{entry.playerName}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputArea}>
        {inputError && <Text style={styles.inputError}>{inputError}</Text>}
        <Animated.View style={[styles.inputRow, { transform: [{ translateX: shakeAnim }] }]}>
          <TextInput
            ref={inputRef}
            style={styles.wordInput}
            value={wordInput}
            onChangeText={text => { setWordInput(text); setInputError(null); }}
            placeholder={isMyTurn ? `كلمة تبدأ بـ ${requiredLetter}...` : "ليس دورك..."}
            placeholderTextColor="#5A5A88"
            textAlign="right"
            editable={!!isMyTurn && !submitting}
            onSubmitEditing={isMyTurn ? submitWord : undefined}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.submitBtn, { opacity: (!isMyTurn || !wordInput.trim() || submitting) ? 0.4 : 1, backgroundColor: "#8B5CF6" }]}
            onPress={submitWord}
            disabled={!isMyTurn || !wordInput.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0021" },
  centerContent: { justifyContent: "center", alignItems: "center" },
  backBtn: {
    position: "absolute", top: 16, left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#1A003A",
    justifyContent: "center", alignItems: "center",
  },
  backBtn2: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#1A003A",
    justifyContent: "center", alignItems: "center",
  },
  modeSelectContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16, paddingTop: 60 },
  modeSelectEmoji: { fontSize: 64, marginBottom: 8 },
  modeSelectTitle: { fontFamily: "Cairo_700Bold", fontSize: 26, color: "#E8E8FF" },
  modeSelectSub: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#9898CC", textAlign: "center", lineHeight: 22 },
  modeBtn: { width: "100%", borderRadius: 18, overflow: "hidden", borderWidth: 1.5, borderColor: "#8B5CF640" },
  modeBtnGrad: { padding: 18, alignItems: "center", gap: 4 },
  modeBtnEmoji: { fontSize: 32 },
  modeBtnTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF" },
  modeBtnSub: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#9898CC" },
  rulesBox: { backgroundColor: "#12003A", borderRadius: 14, padding: 16, width: "100%", gap: 4, borderWidth: 1, borderColor: "#8B5CF620" },
  rulesTitle: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#8B5CF6", marginBottom: 4 },
  rulesText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#9898CC", lineHeight: 20 },
  waitingText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF", marginTop: 16 },
  waitingSub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#9898CC" },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 12, justifyContent: "space-between",
  },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 17, color: "#E8E8FF" },
  headerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9898CC" },
  timerCircle: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 2.5,
    justifyContent: "center", alignItems: "center",
  },
  timerNum: { fontFamily: "Cairo_700Bold", fontSize: 18 },
  requiredLetterBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#12003A", borderBottomWidth: 1, borderBottomColor: "#8B5CF620",
  },
  requiredLetterLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC" },
  requiredLetterBox: { width: 52, height: 52, borderRadius: 14, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  requiredLetterText: { fontFamily: "Cairo_700Bold", fontSize: 30, color: "#8B5CF6" },
  turnIndicator: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  chainContent: { padding: 16, gap: 10, paddingBottom: 24 },
  chainEmptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#5A5A88", textAlign: "center", paddingVertical: 40 },
  chainItem: { maxWidth: "75%", borderRadius: 14, padding: 12, gap: 2 },
  chainItemMe: { alignSelf: "flex-start", backgroundColor: "#8B5CF622", borderWidth: 1, borderColor: "#8B5CF640" },
  chainItemOpp: { alignSelf: "flex-end", backgroundColor: "#12122A", borderWidth: 1, borderColor: "#1E1E3A" },
  chainItemWord: { fontFamily: "Cairo_700Bold", fontSize: 22 },
  chainItemWordMe: { color: "#C4B5FD" },
  chainItemWordOpp: { color: "#E8E8FF" },
  chainItemPlayer: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#9898CC" },
  inputArea: { padding: 16, gap: 6, backgroundColor: "#0D0021", borderTopWidth: 1, borderTopColor: "#1A003A" },
  inputError: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.ruby, textAlign: "center" },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  wordInput: {
    flex: 1, backgroundColor: "#1A003A", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#E8E8FF",
    borderWidth: 1.5, borderColor: "#8B5CF640",
  },
  submitBtn: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  gameOverContent: { padding: 24, alignItems: "center", gap: 16, paddingBottom: 40 },
  gameOverEmoji: { fontSize: 72, marginTop: 20 },
  gameOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 28, color: "#E8E8FF" },
  gameOverCoins: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.gold },
  chainTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC", marginTop: 8 },
  chainList: { width: "100%", gap: 8 },
  chainEntry: { borderRadius: 12, padding: 10, alignItems: "center" },
  chainEntryMe: { backgroundColor: "#8B5CF618", borderWidth: 1, borderColor: "#8B5CF640" },
  chainEntryOpp: { backgroundColor: "#12122A", borderWidth: 1, borderColor: "#1E1E3A" },
  chainWord: { fontFamily: "Cairo_700Bold", fontSize: 20 },
  chainWordMe: { color: "#C4B5FD" },
  chainWordOpp: { color: "#E8E8FF" },
  chainPlayerName: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#9898CC" },
  winnerRow: { marginTop: 8 },
  winnerBadge: { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1.5 },
  winnerBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  playAgainBtn: {
    backgroundColor: "#8B5CF622", borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
    borderWidth: 1.5, borderColor: "#8B5CF660", marginTop: 8,
  },
  playAgainBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#C4B5FD" },
  homeBtn: {
    backgroundColor: "#12122A", borderRadius: 14, paddingHorizontal: 32, paddingVertical: 12,
    borderWidth: 1, borderColor: "#1E1E3A",
  },
  homeBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC" },
  roundOverContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  roundOverEmoji: { fontSize: 64 },
  roundOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 24, color: "#E8E8FF" },
  roundOverReason: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#9898CC" },
  winsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  winsBadge: { alignItems: "center", gap: 4 },
  winsBadgeName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#9898CC" },
  winsBadgeNum: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#E8E8FF" },
  winsDash: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#5A5A88" },
  continueBtn: {
    backgroundColor: "#8B5CF622", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
    borderWidth: 1.5, borderColor: "#8B5CF660", marginTop: 16,
  },
  continueBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#C4B5FD" },
});
