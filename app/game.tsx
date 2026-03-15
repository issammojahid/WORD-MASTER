import React, { useState, useEffect, useRef, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  Keyboard,
  Platform,
  Modal,
  Dimensions,
  BackHandler,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getSocket } from "@/services/socket";
import { GAME_CATEGORIES, GameCategory } from "@/constants/i18n";
import { getApiUrl } from "@/lib/query-client";
import { playSound } from "@/lib/sound-manager";
import ViewShot, { captureRef } from "react-native-view-shot";

const ROUND_TIME = 50;
const FREEZE_SECS = 4;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Deterministic ice particle layout
const ICE_PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  x: ((i * 67 + 28) % (SCREEN_W - 60)) + 30,
  y: ((i * 91 + 50) % (SCREEN_H * 0.55)) + 80,
  size: 16 + (i % 4) * 8,
  delay: i * 90,
}));

// ── Web Audio: freeze sound (descending icy tone) ─────────────────────────────
function playFreezeSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.55);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.65);
  } catch {}
}

// ── Web Audio: unfreeze sound (white-noise crack) ─────────────────────────────
function playUnfreezeSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const bufSize = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.9;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = "highpass"; flt.frequency.value = 1800;
    const gain = ctx.createGain();
    src.connect(flt); flt.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    src.start(ctx.currentTime);
  } catch {}
}

// ── Freeze overlay: covers MY screen when I am frozen by an opponent ──────────
const FreezeOverlay = memo(({ visible, countdown, cracking }: {
  visible: boolean; countdown: number; cracking: boolean;
}) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const waveAnim  = useRef(new Animated.Value(0)).current;
  const crackAnim = useRef(new Animated.Value(0)).current;
  const countScl  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      waveAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 550, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!cracking) return;
    crackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(crackAnim, { toValue: 1,   duration: 90,  useNativeDriver: true }),
      Animated.timing(crackAnim, { toValue: 0.6, duration: 200, useNativeDriver: true }),
      Animated.timing(crackAnim, { toValue: 0,   duration: 310, useNativeDriver: true }),
    ]).start();
  }, [cracking]);

  useEffect(() => {
    if (!visible || countdown <= 0) return;
    countScl.setValue(1.55);
    Animated.spring(countScl, { toValue: 1, tension: 320, friction: 10, useNativeDriver: true }).start();
  }, [countdown]);

  const waveScale = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim, zIndex: 160 }]}
    >
      {/* Blue tint */}
      <LinearGradient
        colors={["rgba(41,128,185,0.40)", "rgba(26,163,219,0.28)", "rgba(52,152,219,0.20)"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ice wave spread */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(120,210,255,0.10)", transform: [{ scale: waveScale }] },
        ]}
      />

      {/* Frost particles */}
      {ICE_PARTICLES.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute", left: p.x, top: p.y, fontSize: p.size,
            opacity: fadeAnim,
            transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
          }}
        >
          ❄
        </Animated.Text>
      ))}

      {/* "❄️ مجمّد" label + countdown */}
      <View style={{ position: "absolute", top: "35%", left: 0, right: 0, alignItems: "center" }}>
        <Text style={fzStyles.frozenLabel}>❄️ مجمّد</Text>
        <Animated.Text style={[fzStyles.frozenCount, { transform: [{ scale: countScl }] }]}>
          {countdown > 0 ? String(countdown) : ""}
        </Animated.Text>
      </View>

      {/* Ice-crack flash on unfreeze */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(210,245,255,0.65)", opacity: crackAnim }]}
      />
    </Animated.View>
  );
});

const fzStyles = StyleSheet.create({
  frozenLabel: { fontFamily: "Cairo_700Bold", fontSize: 30, color: "#fff", textAlign: "center", marginBottom: 8 },
  frozenCount: { fontFamily: "Cairo_700Bold", fontSize: 72, color: "#A8E6FF", textAlign: "center" },
});

const QUICK_MESSAGES = [
  "برافو! 👏",
  "حظ سعيد! 🍀",
  "هههه 😂",
  "سهلة! 😎",
  "ماشاء الله 🌟",
  "اوف 😬",
];

// Power cards — only available in online matches and friend rooms (game.tsx)
type PowerCardId = "time" | "freeze" | "hint";
const POWER_CARD_DEFS: { id: PowerCardId; icon: string; label: string; color: string; desc: string }[] = [
  { id: "time",   icon: "⏰", label: "وقت",    color: "#2ECC71", desc: "+20 ثانية" },
  { id: "freeze", icon: "❄️", label: "تجميد",  color: "#3498DB", desc: "جمّد الكل" },
  { id: "hint",   icon: "💡", label: "تلميح",  color: "#F5A623", desc: "كلمة صحيحة" },
];

type CategoryStatus = "idle" | "correct" | "duplicate" | "empty" | "invalid";

type RoundResult = {
  playerId: string;
  playerName: string;
  answers: Record<string, string>;
  scores: Record<string, number>;
  roundTotal: number;
  status: Record<string, CategoryStatus>;
};

type ChatBubble = {
  id: string;
  message: string;
  playerName: string;
  isMe: boolean;
};

export default function GameScreen() {
  const { isDark, theme } = useTheme();
  const { roomId, letter, round, totalRounds, coinEntry: coinEntryParam } = useLocalSearchParams<{
    roomId: string;
    letter: string;
    round: string;
    totalRounds: string;
    coinEntry?: string;
  }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { profile, playerId, updateProfile, addCoins, addXp, reportGameResult, useCard } = usePlayer();
  const gameCoinEntry = coinEntryParam ? parseInt(coinEntryParam, 10) : 0;
  const socket = getSocket();

  const [answers, setAnswers] = useState<Record<GameCategory, string>>({} as Record<GameCategory, string>);
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
    { id: string; name: string; score: number; coins: number; skin: string }[]
  >([]);

  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);
  const [streakReward, setStreakReward] = useState<{ streakBonus: number; coinEntryReward: number } | null>(null);
  const [floatingEmote, setFloatingEmote] = useState<{ emote: string; playerName: string } | null>(null);
  const emoteAnim = useRef(new Animated.Value(0)).current;

  const gameOverSlide = useRef(new Animated.Value(60)).current;
  const gameOverOpacity = useRef(new Animated.Value(0)).current;
  const winnerBounce = useRef(new Animated.Value(0)).current;

  // ── Power cards state ──────────────────────────────────────────────────────
  // usedCards: cards already used THIS round (cleared on new_round)
  const [usedCards, setUsedCards] = useState<Set<PowerCardId>>(new Set());
  const [hintWordPool, setHintWordPool] = useState<Record<string, string[]>>({});
  const [powerToast, setPowerToast] = useState<{ msg: string; color: string } | null>(null);
  // isFrozen: true = my timer is paused because an opponent used Freeze on me
  const frozenRef = useRef(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Freeze UI state (drives visual overlay + input lock)
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenCountdown, setFrozenCountdown] = useState(0);
  const [showCrack, setShowCrack] = useState(false);
  const freezeCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // opponentFrozen: caster can see their freeze is active on opponent
  const [opponentFrozenCountdown, setOpponentFrozenCountdown] = useState(0);
  const opponentFreezeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Exit confirmation state ────────────────────────────────────────────────
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitScaleAnim = useRef(new Animated.Value(0.85)).current;
  // ──────────────────────────────────────────────────────────────────────────

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const letterAnim = useRef(new Animated.Value(0)).current;
  const answersRef = useRef<Record<GameCategory, string>>({} as Record<GameCategory, string>);
  const submittedRef = useRef(false);
  const isGameOverRef = useRef(false);
  const shareCardRef = useRef<ViewShot>(null);
  const gamePlayersRef = useRef<{ id: string; name: string; score: number }[]>([]);
  const socketId = socket.id;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);
  useEffect(() => {
    isGameOverRef.current = isGameOver;
    if (isGameOver) {
      gameOverSlide.setValue(60);
      gameOverOpacity.setValue(0);
      winnerBounce.setValue(0);
      Animated.parallel([
        Animated.spring(gameOverSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(gameOverOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(winnerBounce, { toValue: -8, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(winnerBounce, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ).start();
      });
    }
  }, [isGameOver]);
  useEffect(() => { gamePlayersRef.current = gamePlayers; }, [gamePlayers]);

  useEffect(() => {
    letterAnim.setValue(0);
    Animated.spring(letterAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
  }, [currentLetter]);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [currentRound]);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startTimer = () => {
    stopTimer();
    setTimeLeft(ROUND_TIME);
    timerRef.current = setInterval(() => {
      // Skip tick while frozen by an opponent's Freeze card
      if (frozenRef.current) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          if (!submittedRef.current) doSubmit(answersRef.current);
          return 0;
        }
        if (prev <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return prev - 1;
      });
    }, 1000);
  };

  // Fetch word pool for the Hint power card whenever the letter changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL("/api/words", getApiUrl());
        url.searchParams.set("letter", currentLetter);
        const res = await fetch(url.toString());
        if (res.ok && !cancelled) setHintWordPool(await res.json());
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [currentLetter]);

  // Power card helper: show a temporary toast notification
  const showPowerToast = (msg: string, color: string) => {
    setPowerToast({ msg, color });
    setTimeout(() => setPowerToast(null), 3000);
  };

  // Power card activation handler
  const usePowerCard = (cardId: PowerCardId) => {
    if (usedCards.has(cardId) || submitted) return;
    const count = profile.powerCards[cardId] ?? 0;
    if (count <= 0) return;
    // Decrement from inventory
    const consumed = useCard(cardId);
    if (!consumed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUsedCards((prev) => new Set([...prev, cardId]));

    switch (cardId) {
      case "time":
        setTimeLeft((prev) => Math.min(prev + 20, ROUND_TIME + 30));
        showPowerToast("⏰ +20 ثانية!", "#2ECC71");
        break;

      case "freeze":
        socket.emit("power_card", { roomId, type: "freeze", playerName: profile.name });
        showPowerToast("❄️ تم تجميد المنافسين!", "#3498DB");
        // Show opponent frozen countdown on caster's screen
        if (opponentFreezeIntervalRef.current) clearInterval(opponentFreezeIntervalRef.current);
        setOpponentFrozenCountdown(FREEZE_SECS);
        let oppRemaining = FREEZE_SECS;
        opponentFreezeIntervalRef.current = setInterval(() => {
          oppRemaining -= 1;
          setOpponentFrozenCountdown(oppRemaining);
          if (oppRemaining <= 0) {
            if (opponentFreezeIntervalRef.current) clearInterval(opponentFreezeIntervalRef.current);
            opponentFreezeIntervalRef.current = null;
          }
        }, 1000);
        break;

      case "hint": {
        // Pick the first empty category and reveal a random valid word from the pool
        const emptyCats = GAME_CATEGORIES.filter((cat) => !(answers[cat] || "").trim());
        const targetCat = emptyCats.length > 0
          ? emptyCats[Math.floor(Math.random() * emptyCats.length)]
          : GAME_CATEGORIES[Math.floor(Math.random() * GAME_CATEGORIES.length)];
        const pool = hintWordPool[targetCat] || [];
        if (pool.length > 0) {
          const word = pool[Math.floor(Math.random() * Math.min(pool.length, 20))];
          const label = (t as Record<string, string>)[targetCat] || targetCat;
          showPowerToast(`💡 ${label}: ${word}`, "#F5A623");
        } else {
          showPowerToast("💡 لا توجد تلميحات", "#F5A623");
        }
        break;
      }
    }
  };

  const doSubmit = (currentAnswers: Record<GameCategory, string>) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    socket.emit("submit_answers", { roomId, answers: currentAnswers });
  };

  const handleSubmit = () => {
    if (submittedRef.current) return;
    stopTimer();
    doSubmit(answersRef.current);
  };

  const playEmojiSound = (message: string) => {
    if (message.includes("😂")) playSound("laugh");
    else if (message.includes("👏")) playSound("clap");
    else if (message.includes("🔥")) playSound("fire");
  };

  const sendQuickChat = (message: string) => {
    setShowChatPanel(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const bubbleId = Date.now().toString();
    const bubble: ChatBubble = { id: bubbleId, message, playerName: profile.name, isMe: true };
    addChatBubble(bubble);
    playEmojiSound(message);
    socket.emit("quick_chat", { roomId, message, playerName: profile.name });
  };

  const addChatBubble = (bubble: ChatBubble) => {
    setChatBubbles((prev) => [...prev, bubble]);
    setTimeout(() => {
      setChatBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
    }, 3500);
  };

  // ── Exit handlers ──────────────────────────────────────────────────────────
  const handleExitPress = () => {
    if (isGameOver) { router.replace("/lobby"); return; }
    exitScaleAnim.setValue(0.85);
    setShowExitConfirm(true);
    Animated.spring(exitScaleAnim, { toValue: 1, tension: 220, friction: 12, useNativeDriver: true }).start();
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    stopTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    socket.emit("forfeit_match", { roomId });
    router.replace("/lobby");
  };
  // ──────────────────────────────────────────────────────────────────────────

  // ── Hardware back button (Android) & swipe-back (iOS) prevention ───────────
  useEffect(() => {
    if (isGameOver) return;
    // Android hardware back button
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleExitPress();
      return true;
    });
    // iOS swipe-back / expo-router navigation pop
    const unsubscribe = navigation.addListener("beforeRemove" as any, (e: any) => {
      if (isGameOver) return;
      e.preventDefault();
      handleExitPress();
    });
    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [isGameOver, navigation]);
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    socket.on("player_submitted", ({ playerId }: { playerId: string }) => {
      setSubmittedPlayers((prev) => prev.includes(playerId) ? prev : [...prev, playerId]);
    });

    socket.on("round_results", (data: {
      results: RoundResult[];
      round: number;
      totalRounds: number;
      players: { id: string; name: string; score: number }[];
    }) => {
      stopTimer();
      const safeResults = Array.isArray(data.results) ? data.results : [];
      const safePlayers = Array.isArray(data.players) ? data.players : [];
      setRoundResults(safeResults);
      setGamePlayers(safePlayers);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const myResult = safeResults.find((r) => r.playerId === socketId);
      if (myResult) {
        const hasCorrect = Object.values(myResult.status).some((s) => s === "correct");
        const allBad = Object.values(myResult.status).every((s) => s === "empty" || s === "invalid");
        if (hasCorrect) playSound("correct");
        else if (allBad) playSound("wrong");
      }
    });

    socket.on("new_round", (data: { letter: string; round: number; totalRounds: number }) => {
      setCurrentLetter(data.letter);
      setCurrentRound(data.round);
      setAnswers({} as Record<GameCategory, string>);
      setSubmitted(false);
      submittedRef.current = false;
      setSubmittedPlayers([]);
      setRoundResults(null);
      setTimeLeft(ROUND_TIME);
      setChatBubbles([]);
      // Reset power card round-usage tracking
      setUsedCards(new Set());
      // Clear any active freeze effect between rounds
      frozenRef.current = false;
      setIsFrozen(false);
      setFrozenCountdown(0);
      setShowCrack(false);
      if (freezeTimerRef.current) { clearTimeout(freezeTimerRef.current); freezeTimerRef.current = null; }
      if (freezeCountdownRef.current) { clearInterval(freezeCountdownRef.current); freezeCountdownRef.current = null; }
      // Clear opponent freeze indicator
      setOpponentFrozenCountdown(0);
      if (opponentFreezeIntervalRef.current) { clearInterval(opponentFreezeIntervalRef.current); opponentFreezeIntervalRef.current = null; }
      letterAnim.setValue(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

    // Power card incoming — an opponent used a card that affects me
    socket.on("power_card", (data: { type: string; playerName: string }) => {
      if (data.type === "freeze") {
        // Lock my timer + input
        frozenRef.current = true;
        setIsFrozen(true);
        setFrozenCountdown(FREEZE_SECS);
        setShowCrack(false);

        // Sound + haptic
        playFreezeSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // Clear any existing timers
        if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
        if (freezeCountdownRef.current) clearInterval(freezeCountdownRef.current);

        // Countdown ticker
        let remaining = FREEZE_SECS;
        freezeCountdownRef.current = setInterval(() => {
          remaining -= 1;
          setFrozenCountdown(remaining);
          if (remaining <= 0) {
            if (freezeCountdownRef.current) clearInterval(freezeCountdownRef.current);
            freezeCountdownRef.current = null;
            // Ice crack flash, then unfreeze
            setShowCrack(true);
            playUnfreezeSound();
            freezeTimerRef.current = setTimeout(() => {
              frozenRef.current = false;
              setIsFrozen(false);
              setShowCrack(false);
              setFrozenCountdown(0);
            }, 600);
          }
        }, 1000);
      }
    });

    socket.on("game_over", (data: {
      players: { id: string; name: string; score: number; coins: number; skin?: string }[];
      tournamentId?: string | null;
      tournamentMatchId?: string | null;
    }) => {
      stopTimer();
      setIsGameOver(true);
      const safePlayers = Array.isArray(data.players) ? data.players : [];
      setGameOverPlayers(safePlayers.map((p) => ({ ...p, skin: p.skin || "default" })));
      const me = safePlayers.find((p) => p.id === socketId);
      if (me) {
        const sorted = [...safePlayers].sort((a, b) => b.score - a.score);
        const rank = sorted.findIndex((p) => p.id === socketId);
        const won = rank === 0;
        playSound(won ? "win" : "lose");
        reportGameResult(won, me.score, me.coins, Math.floor(me.score / 2), gameCoinEntry).then((result) => {
          if (result.streakBonus > 0 || result.coinEntryReward > 0) {
            setStreakReward({ streakBonus: result.streakBonus, coinEntryReward: result.coinEntryReward });
          }
        }).catch(() => {
          addCoins(me.coins);
          addXp(Math.floor(me.score / 2));
          updateProfile({
            gamesPlayed: profile.gamesPlayed + 1,
            wins: won ? profile.wins + 1 : profile.wins,
            totalScore: profile.totalScore + me.score,
          });
        });

        if (data.tournamentId && data.tournamentMatchId && won && playerId) {
          socket.emit("tournament_match_result", {
            tournamentId: data.tournamentId,
            matchId: data.tournamentMatchId,
            winnerId: playerId,
            winnerName: sorted[0].name,
            roomId,
          });
        }
      }
    });

    socket.on("quick_chat", (data: { message: string; playerName: string }) => {
      const bubbleId = Date.now().toString() + Math.random();
      addChatBubble({ id: bubbleId, message: data.message, playerName: data.playerName, isMe: false });
      if (data.message.includes("😂")) playSound("laugh");
      else if (data.message.includes("👏")) playSound("clap");
      else if (data.message.includes("🔥")) playSound("fire");
    });

    socket.on("receive_emote", (data: { emote: string; playerName: string }) => {
      setFloatingEmote(data);
      emoteAnim.setValue(0);
      Animated.sequence([
        Animated.spring(emoteAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(emoteAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setFloatingEmote(null));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    // Opponent disconnected without using forfeit — declare me winner
    socket.on("player_left", ({ playerId: leftId }: { playerId: string }) => {
      if (isGameOverRef.current) return;
      stopTimer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const players = gamePlayersRef.current;
      const me = players.find(p => p.id !== leftId);
      const opp = players.find(p => p.id === leftId);
      const myScore = me?.score ?? 50;
      const overPlayers = [
        { id: socketId || "me", name: me?.name ?? profile.name, score: Math.max(myScore, 50), coins: 30, skin: profile.equippedSkin },
        { id: leftId, name: opp?.name ?? "المنافس", score: 0, coins: 0, skin: "student" },
      ];
      setIsGameOver(true);
      setGameOverPlayers(overPlayers);
      reportGameResult(true, Math.max(myScore, 50), 30, 25, gameCoinEntry).catch(() => addCoins(30));
    });

    return () => {
      socket.off("player_submitted");
      socket.off("round_results");
      socket.off("new_round");
      socket.off("game_over");
      socket.off("quick_chat");
      socket.off("receive_emote");
      socket.off("power_card");
      socket.off("player_left");
      if (freezeCountdownRef.current) { clearInterval(freezeCountdownRef.current); }
      if (opponentFreezeIntervalRef.current) { clearInterval(opponentFreezeIntervalRef.current); }
    };
  }, [socketId]);

  const handleNextRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket.emit("next_round", { roomId }, (_res: { isGameOver: boolean }) => {});
  };

  const handlePlayAgain = () => {
    socket.emit("play_again", { roomId });
    router.replace("/lobby");
  };

  const timerColor = timeLeft > 15 ? Colors.timerGreen : timeLeft > 8 ? Colors.timerYellow : Colors.timerRed;
  const timerProgress = timeLeft / ROUND_TIME;

  // Game over screen
  if (isGameOver) {
    const sortedPlayers = [...gameOverPlayers].sort((a, b) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉"];
    const myIdx = sortedPlayers.findIndex((p) => p.id === socketId);
    const amWinner = myIdx === 0;
    const podiumPlayers = sortedPlayers.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    const podiumHeights = [90, 130, 70];

    const podiumBaseColors = ["#C49B00", "#7A8FA0", "#8B5E3C"];
    const podiumBorderColors = [Colors.gold + "80", "#9EB3C4" + "80", "#CD8042" + "80"];

    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <Animated.View style={{ flex: 1, opacity: gameOverOpacity, transform: [{ translateY: gameOverSlide }] }}>
        <ScrollView contentContainerStyle={styles.gameOverContent} showsVerticalScrollIndicator={false}>
          {/* Title with winner bounce */}
          {amWinner ? (
            <Animated.Text style={[styles.gameOverTitle, { color: Colors.gold, transform: [{ translateY: winnerBounce }] }]}>
              🏆 أنت الفائز!
            </Animated.Text>
          ) : (
            <Text style={[styles.gameOverTitle, { color: theme.textPrimary }]}>{t.gameOver}</Text>
          )}
          {amWinner ? <Text style={[styles.gameOverSub, { color: Colors.gold + "CC" }]}>أداء رائع — استمر!</Text>
            : myIdx === 1 ? <Text style={[styles.gameOverSub, { color: theme.textSecondary }]}>🥈 المركز الثاني — أحسنت!</Text>
            : myIdx === 2 ? <Text style={[styles.gameOverSub, { color: theme.textSecondary }]}>🥉 المركز الثالث — لا بأس!</Text>
            : <Text style={[styles.gameOverSub, { color: theme.textSecondary }]}>حاول مرة أخرى! 💪</Text>}

          {podiumPlayers.length >= 2 && (
            <View style={styles.podiumRow}>
              {podiumOrder.map((pIdx) => {
                const p = podiumPlayers[pIdx];
                if (!p) return null;
                const isMe = p.id === socketId;
                const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
                const h = podiumHeights[pIdx];
                const isFirst = pIdx === 0;
                return (
                  <View key={p.id} style={styles.podiumSlot}>
                    <Text style={[styles.podiumMedal, isFirst && { fontSize: 32 }]}>{medals[pIdx] || "🎖️"}</Text>
                    <View style={[
                      styles.podiumAvatar,
                      isFirst && styles.podiumAvatarFirst,
                      { backgroundColor: skin.color + "33", borderWidth: 2.5, borderColor: podiumBorderColors[pIdx] || "#1E1E3A" },
                      isFirst && { shadowColor: Colors.gold, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
                    ]}>
                      <Text style={[styles.podiumEmoji, isFirst && styles.podiumEmojiFirst]}>{skin.emoji}</Text>
                    </View>
                    <Text style={[styles.podiumName, { color: isMe ? Colors.gold : theme.textPrimary }, isFirst && { fontFamily: "Cairo_700Bold" }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.podiumScore, { color: isFirst ? Colors.gold : theme.textSecondary }]}>{p.score} نقطة</Text>
                    <View style={[styles.podiumBase, { height: h, backgroundColor: podiumBaseColors[pIdx] || "#1E1E3A" }, isFirst && styles.podiumBaseFirst]}>
                      <Text style={[styles.podiumRank, { color: isFirst ? "#0A0A1A" : "#E8E8FF" }]}>{pIdx + 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.finalRankings}>
            {sortedPlayers.map((p, idx) => {
              const isMe = p.id === socketId;
              const rankColors = [Colors.rank1, Colors.rank2, Colors.rank3];
              const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
              return (
                <View key={p.id} style={[styles.finalRankRow, { backgroundColor: theme.card, borderColor: isMe ? Colors.gold + "60" : theme.cardBorder }]}>
                  <Text style={[styles.finalRankNum, { color: rankColors[idx] || theme.textMuted }]}>{medals[idx] || `${idx + 1}`}</Text>
                  <View style={[styles.finalRankAvatar, { backgroundColor: skin.color + "22" }]}>
                    <Text style={styles.finalRankEmoji}>{skin.emoji}</Text>
                  </View>
                  <Text style={[styles.finalRankName, { color: isMe ? Colors.gold : theme.textPrimary }]} numberOfLines={1}>
                    {p.name}{isMe ? " (أنت)" : ""}
                  </Text>
                  <View style={styles.finalRankRight}>
                    <Text style={[styles.finalRankScore, { color: theme.textPrimary }]}>{p.score}</Text>
                    <View style={styles.coinRewardBadge}>
                      <Ionicons name="star" size={10} color={Colors.gold} />
                      <Text style={styles.coinRewardText}>+{p.coins}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {streakReward && (streakReward.streakBonus > 0 || streakReward.coinEntryReward > 0) && (
            <View style={styles.bonusBanner}>
              {streakReward.streakBonus > 0 && (
                <View style={styles.bonusRow}>
                  <Ionicons name="flame" size={18} color={Colors.ruby} />
                  <Text style={styles.bonusText}>مكافأة السلسلة: +{streakReward.streakBonus} 🪙</Text>
                </View>
              )}
              {streakReward.coinEntryReward > 0 && (
                <View style={styles.bonusRow}>
                  <Ionicons name="trophy" size={18} color={Colors.gold} />
                  <Text style={styles.bonusText}>جائزة المباراة: +{streakReward.coinEntryReward} 🪙</Text>
                </View>
              )}
            </View>
          )}

          {gameCoinEntry > 0 && (
            <View style={styles.coinEntryInfo}>
              <Ionicons name="star" size={14} color={Colors.gold} />
              <Text style={styles.coinEntryInfoText}>مباراة بدخول {gameCoinEntry} عملة</Text>
            </View>
          )}

          <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }} style={styles.shareCardContainer}>
            <LinearGradient colors={["#0A0A1A", "#12122A", "#0E0E24"]} style={styles.shareCard}>
              <Text style={styles.shareCardTitle}>حروف المغرب 🇲🇦</Text>
              <View style={styles.shareCardDivider} />
              <Text style={styles.shareCardRank}>
                {amWinner ? "🏆" : myIdx === 1 ? "🥈" : myIdx === 2 ? "🥉" : "🎖️"} المركز {myIdx + 1}
              </Text>
              <Text style={styles.shareCardScore}>
                ⭐ {sortedPlayers.find(p => p.id === socketId)?.score ?? 0} نقطة
              </Text>
              <Text style={styles.shareCardScore}>
                🏅 {profile?.wins ?? 0} انتصار
              </Text>
              <Text style={styles.shareCardName}>
                {sortedPlayers.find(p => p.id === socketId)?.name ?? ""}
              </Text>
              <View style={styles.shareCardDivider} />
              <Text style={styles.shareCardFooter}>حمّل اللعبة وتحداني! 🔥</Text>
            </LinearGradient>
          </ViewShot>

          <View style={styles.emoteRow}>
            {[
              { emote: "🤝", label: "أحسنت" },
              { emote: "🔥", label: "نار" },
              { emote: "😢", label: "حظ" },
              { emote: "👏", label: "برافو" },
            ].map((e) => (
              <TouchableOpacity
                key={e.emote}
                style={[styles.emoteBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  socket.emit("send_emote", { roomId, emote: e.emote, playerName: profile.name });
                  setFloatingEmote({ emote: e.emote, playerName: profile.name });
                  emoteAnim.setValue(0);
                  Animated.sequence([
                    Animated.spring(emoteAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
                    Animated.delay(2000),
                    Animated.timing(emoteAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
                  ]).start(() => setFloatingEmote(null));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.emoteBtnEmoji}>{e.emote}</Text>
                <Text style={[styles.emoteBtnLabel, { color: theme.textMuted }]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {floatingEmote && (
            <Animated.View style={[styles.floatingEmote, {
              opacity: emoteAnim,
              transform: [
                { scale: emoteAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                { translateY: emoteAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
              ],
            }]}>
              <Text style={styles.floatingEmoteText}>{floatingEmote.emote}</Text>
              <Text style={styles.floatingEmoteName}>{floatingEmote.playerName}</Text>
            </Animated.View>
          )}

          <View style={styles.gameOverActions}>
            <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain} activeOpacity={0.85}>
              <Ionicons name="refresh" size={18} color={"#0A0A1A"} style={{ marginRight: 8 }} />
              <Text style={styles.playAgainBtnText}>{t.playAgain}</Text>
            </TouchableOpacity>

            <View style={styles.gameOverBtnRow}>
              <TouchableOpacity
                style={styles.shareBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    if (Platform.OS === "web") {
                      const myPlayer = sortedPlayers.find(p => p.id === socketId);
                      const myScore = myPlayer?.score ?? 0;
                      const rank = myIdx + 1;
                      const totalPlayers = sortedPlayers.length;
                      const wins = profile?.wins ?? 0;
                      const rankText = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                      const message = `${rankText} حصلت على المركز ${rank} من ${totalPlayers} في حروف المغرب!\n⭐ النتيجة: ${myScore} نقطة\n🏅 الانتصارات: ${wins}\n🔥 حمّل اللعبة وتحداني!\n#حروف_المغرب`;
                      await Share.share({ message });
                    } else {
                      const uri = await captureRef(shareCardRef, { format: "png", quality: 1 });
                      await Share.share(
                        { url: uri },
                        { dialogTitle: "شارك نتيجتك" }
                      );
                    }
                  } catch (err) {
                    const myPlayer = sortedPlayers.find(p => p.id === socketId);
                    const myScore = myPlayer?.score ?? 0;
                    const rank = myIdx + 1;
                    const totalPlayers = sortedPlayers.length;
                    const wins = profile?.wins ?? 0;
                    const rankText = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const message = `${rankText} حصلت على المركز ${rank} من ${totalPlayers} في حروف المغرب!\n⭐ النتيجة: ${myScore} نقطة\n🏅 الانتصارات: ${wins}\n🔥 حمّل اللعبة وتحداني!\n#حروف_المغرب`;
                    await Share.share({ message });
                  }
                }}
              >
                <Ionicons name="share-social" size={18} color="#BF00FF" />
                <Text style={styles.shareBtnText}>مشاركة 📤</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.homeBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => router.replace("/")} activeOpacity={0.8}>
                <Ionicons name="home-outline" size={16} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.homeBtnText, { color: theme.textSecondary }]}>{t.backToHome}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </Animated.View>
      </View>
    );
  }

  // Round results screen
  if (roundResults) {
    const isHost = socketId && gamePlayers.length > 0 && gamePlayers[0].id === socketId;
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
        <View style={[styles.roundResultsHeader, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.cardBorder }]}>
          <Text style={[styles.roundResultsTitle, { color: theme.textPrimary }]}>{t.results} - {t.round} {currentRound}/{numTotalRounds}</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.roundResultsContent} showsVerticalScrollIndicator={false}>
          {roundResults.map((result) => {
            const isMe = result.playerId === socketId;
            return (
              <View key={result.playerId} style={[styles.resultPlayerCard, { backgroundColor: theme.card, borderColor: isMe ? Colors.gold + "60" : theme.cardBorder }]}>
                <View style={styles.resultPlayerHeader}>
                  <Text style={[styles.resultPlayerName, { color: theme.textPrimary }]}>{result.playerName}{isMe ? " (أنت)" : ""}</Text>
                  <View style={styles.resultTotalBadge}>
                    <Text style={styles.resultTotalText}>+{result.roundTotal}</Text>
                  </View>
                </View>
                {GAME_CATEGORIES.map((cat) => {
                  const ans = result.answers[cat] || "";
                  const sc = result.scores[cat] || 0;
                  const st = result.status[cat] || "empty";
                  const statusColor = st === "correct" ? Colors.scoreCorrect : st === "duplicate" ? Colors.scoreDuplicate : Colors.scoreEmpty;
                  return (
                    <View key={cat} style={[styles.resultCatRow, { borderTopColor: theme.cardBorder + "50" }]}>
                      <Text style={[styles.resultCatName, { color: theme.textMuted }]}>{t[cat as keyof typeof t] as string}</Text>
                      <Text style={[styles.resultAnswer, { color: theme.textPrimary }, !ans && { color: theme.textMuted }]}>{ans || "—"}</Text>
                      <View style={[styles.resultScoreBadge, { backgroundColor: statusColor + "22" }]}>
                        <Text style={[styles.resultScoreText, { color: statusColor }]}>{sc > 0 ? `+${sc}` : "0"}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={[styles.scoreSummary, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.scoreSummaryTitle, { color: theme.textPrimary }]}>المجموع الكلي</Text>
            {[...gamePlayers].sort((a, b) => b.score - a.score).map((p, idx) => (
              <View key={p.id} style={styles.scoreSummaryRow}>
                <Text style={styles.scoreSummaryRank}>{idx + 1}</Text>
                <Text style={[styles.scoreSummaryName, { color: theme.textPrimary }]}>{p.name}</Text>
                <Text style={[styles.scoreSummaryTotal, { color: theme.textPrimary }]}>{p.score}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        {isHost ? (
          <TouchableOpacity style={styles.nextRoundBtn} onPress={handleNextRound}>
            <Text style={styles.nextRoundBtnText}>{currentRound >= numTotalRounds ? t.gameOver : t.nextRound}</Text>
            <Ionicons name="arrow-forward" size={20} color={"#000000"} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.waitingNextRound, { backgroundColor: theme.card }]}>
            <Text style={[styles.waitingNextRoundText, { color: theme.textSecondary }]}>في انتظار المضيف...</Text>
          </View>
        )}
      </View>
    );
  }

  // Game play screen
  return (
    <View style={[styles.container, { paddingTop: topInset, backgroundColor: theme.background }]}>

      {/* ─── CHAT BUBBLES OVERLAY ─── */}
      {chatBubbles.length > 0 && (
        <View style={styles.bubblesOverlay} pointerEvents="none">
          {chatBubbles.map((bubble) => (
            <ChatBubbleView key={bubble.id} bubble={bubble} />
          ))}
        </View>
      )}

      <View style={[styles.gameTopBar, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.cardBorder }]}>
        {/* Exit button */}
        <TouchableOpacity style={[styles.exitGameBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={handleExitPress} activeOpacity={0.75}>
          <Ionicons name="exit-outline" size={17} color={Colors.ruby} />
        </TouchableOpacity>

        <Animated.View
          style={[styles.letterDisplay, {
            transform: [
              { scale: letterAnim },
              { rotate: letterAnim.interpolate({ inputRange: [0, 1], outputRange: ["20deg", "0deg"] }) },
            ],
          }]}
        >
          <Text style={styles.letterText}>{currentLetter}</Text>
        </Animated.View>

        <View style={styles.gameInfoRight}>
          <Text style={[styles.roundLabel, { color: theme.textSecondary }]}>{t.round} {currentRound}/{numTotalRounds}</Text>
          <View style={styles.timerContainer}>
            <View style={styles.timerTrack}>
              <View style={[styles.timerFill, { width: `${timerProgress * 100}%` as any, backgroundColor: timerColor }]} />
            </View>
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        </View>

        {/* Quick chat button */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => setShowChatPanel(true)}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {submittedPlayers.length > 0 && (
        <View style={styles.submittedBar}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.emerald} />
          <Text style={styles.submittedText}>{submittedPlayers.length} {t.players} أرسلوا إجاباتهم</Text>
        </View>
      )}

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.inputsContent, { paddingBottom: bottomInset + 150 }]}
        showsVerticalScrollIndicator={false}
        bottomOffset={150}
        keyboardShouldPersistTaps="handled"
      >
        {GAME_CATEGORIES.map((cat, idx) => (
          <View key={cat} style={styles.categoryInputRow}>
            <Text style={[styles.categoryLabel, { color: theme.textSecondary }]}>{t[cat as keyof typeof t] as string}</Text>
            <TextInput
              style={[
                styles.categoryInput,
                { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText },
                submitted && styles.categoryInputSubmitted,
                !!(answers[cat]) && styles.categoryInputFilled,
              ]}
              value={answers[cat] || ""}
              onChangeText={(val) => { if (!submitted) setAnswers((prev) => ({ ...prev, [cat]: val })); }}
              placeholder={`${currentLetter}...`}
              placeholderTextColor={theme.inputPlaceholder}
              editable={!submitted && !isFrozen}
              textAlign="right"
              returnKeyType={idx < GAME_CATEGORIES.length - 1 ? "next" : "done"}
              autoCorrect={false}
            />
          </View>
        ))}
      </KeyboardAwareScrollView>

      {/* ─── POWER TOAST ─── */}
      {powerToast && (
        <View style={[styles.powerToast, { backgroundColor: powerToast.color + "22", borderColor: powerToast.color + "66", bottom: bottomInset + 140 }]}>
          <Text style={[styles.powerToastText, { color: powerToast.color }]}>{powerToast.msg}</Text>
        </View>
      )}

      {/* ─── OPPONENT FROZEN INDICATOR (visible to caster) ─── */}
      {opponentFrozenCountdown > 0 && (
        <View style={styles.opponentFrozenBadge} pointerEvents="none">
          <View style={styles.opponentFrozenInner}>
            <Text style={styles.opponentFrozenIcon}>❄️</Text>
            <Text style={styles.opponentFrozenText}>المنافس مجمّد</Text>
            <View style={styles.opponentFrozenCountBubble}>
              <Text style={styles.opponentFrozenCount}>{opponentFrozenCountdown}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ─── POWER CARDS ROW ─── */}
      {!submitted && (
        <View style={[styles.powerCardsRow, { bottom: bottomInset + 74 }]}>
          {POWER_CARD_DEFS.map((card) => {
            const usedThisRound = usedCards.has(card.id);
            const cardCount = profile.powerCards?.[card.id] ?? 0;
            const disabled = usedThisRound || cardCount <= 0;
            return (
              <TouchableOpacity
                key={card.id}
                style={[styles.powerCard, disabled && styles.powerCardUsed, { borderColor: disabled ? theme.cardBorder : card.color + "66" }]}
                onPress={() => usePowerCard(card.id)}
                disabled={disabled}
                activeOpacity={0.75}
              >
                <Text style={styles.powerCardIcon}>{card.icon}</Text>
                <Text style={[styles.powerCardLabel, { color: disabled ? theme.textMuted : card.color }]}>{card.label}</Text>
                <Text style={[styles.powerCardDesc, { color: disabled ? theme.textMuted : theme.textSecondary }]}>
                  {usedThisRound ? "مستخدمة" : card.desc}
                </Text>
                <View style={[styles.powerCardCountBadge, { backgroundColor: disabled ? theme.cardBorder : card.color }]}>
                  <Text style={styles.powerCardCountText}>{cardCount}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── FREEZE OVERLAY ─── */}
      <FreezeOverlay visible={isFrozen} countdown={frozenCountdown} cracking={showCrack} />

      {!submitted ? (
        <TouchableOpacity
          style={[styles.submitBtn, { bottom: bottomInset + 12 }, isFrozen && { opacity: 0.45 }]}
          onPress={handleSubmit}
          disabled={isFrozen}
        >
          <Ionicons name="send" size={20} color={"#000000"} style={{ marginRight: 8 }} />
          <Text style={styles.submitBtnText}>{t.submit}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.submittedState, { bottom: bottomInset + 12 }]}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.emerald} />
          <Text style={styles.submittedStateText}>تم الإرسال! في انتظار اللاعبين الآخرين...</Text>
        </View>
      )}

      {/* ─── QUICK CHAT PANEL ─── */}
      <Modal visible={showChatPanel} transparent animationType="slide" onRequestClose={() => setShowChatPanel(false)}>
        <TouchableOpacity style={[styles.chatPanelOverlay, { backgroundColor: theme.overlay }]} activeOpacity={1} onPress={() => setShowChatPanel(false)}>
          <View style={[styles.chatPanel, { backgroundColor: theme.backgroundSecondary, borderColor: theme.cardBorder }]}>
            <Text style={[styles.chatPanelTitle, { color: theme.textPrimary }]}>رسالة سريعة</Text>
            <View style={styles.chatMessagesGrid}>
              {QUICK_MESSAGES.map((msg) => (
                <TouchableOpacity key={msg} style={[styles.chatMessageBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => sendQuickChat(msg)}>
                  <Text style={[styles.chatMessageText, { color: theme.textPrimary }]}>{msg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── EXIT CONFIRMATION POPUP ─── */}
      <Modal visible={showExitConfirm} transparent animationType="none" onRequestClose={() => setShowExitConfirm(false)}>
        <View style={[styles.exitOverlay, { backgroundColor: theme.overlay }]}>
          <Animated.View style={[styles.exitPopupWrapper, { transform: [{ scale: exitScaleAnim }] }]}>
            <LinearGradient
              colors={["#0A0A1A", "#0E0E24", "#0A0A1A"]}
              style={styles.exitPopup}
            >
              {/* Warning icon */}
              <View style={styles.exitIconCircle}>
                <Ionicons name="exit-outline" size={28} color={Colors.ruby} />
              </View>

              <Text style={[styles.exitTitle, { color: theme.textPrimary }]}>الخروج من المباراة؟</Text>
              <Text style={[styles.exitMessage, { color: theme.textSecondary }]}>هل أنت متأكد أنك تريد مغادرة المباراة؟</Text>

              {gameCoinEntry > 0 && (
                <View style={styles.exitCoinWarning}>
                  <Ionicons name="star" size={13} color={Colors.ruby} />
                  <Text style={styles.exitCoinWarningText}>
                    ستخسر {gameCoinEntry} نقود دخول
                  </Text>
                </View>
              )}

              <View style={styles.exitDivider} />

              <View style={styles.exitBtnsRow}>
                <TouchableOpacity
                  style={[styles.exitActionBtn, styles.exitBtnNo]}
                  onPress={() => setShowExitConfirm(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exitBtnNoText}>لا، أكمل</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exitActionBtn, styles.exitBtnYes]}
                  onPress={handleExitConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exitBtnYesText}>نعم، اخرج</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function ChatBubbleView({ bubble }: { bubble: ChatBubble }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={[
        styles.chatBubble,
        bubble.isMe ? styles.chatBubbleMe : styles.chatBubbleOther,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.chatBubbleSender}>{bubble.playerName}</Text>
      <Text style={styles.chatBubbleMessage}>{bubble.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },

  // Chat bubbles overlay
  bubblesOverlay: {
    position: "absolute", top: 100, left: 16, right: 16, zIndex: 100,
    flexDirection: "column", gap: 8, alignItems: "flex-end",
  },
  chatBubble: {
    maxWidth: "60%", borderRadius: 16, padding: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  chatBubbleMe: { backgroundColor: Colors.gold, alignSelf: "flex-end" },
  chatBubbleOther: { backgroundColor: "#12122A", alignSelf: "flex-start", borderWidth: 1, borderColor: "#1E1E3A" },
  chatBubbleSender: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#000000" + "88", marginBottom: 2 },
  chatBubbleMessage: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#000000" },

  // Game top bar
  gameTopBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 12, backgroundColor: "#0E0E24",
    borderBottomWidth: 1, borderBottomColor: "#1E1E3A",
  },
  letterDisplay: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center", marginRight: 12,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  letterText: { fontFamily: "Cairo_700Bold", fontSize: 36, color: "#000000", lineHeight: 48 },
  gameInfoRight: { flex: 1 },
  roundLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC", marginBottom: 8, textAlign: "right" },
  timerContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  timerTrack: { flex: 1, height: 8, backgroundColor: "#1E1E3A", borderRadius: 4, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 4 },
  timerText: { fontFamily: "Cairo_700Bold", fontSize: 22, minWidth: 32, textAlign: "center" },
  chatBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: "#12122A",
    justifyContent: "center", alignItems: "center", marginLeft: 8,
    borderWidth: 1, borderColor: "#1E1E3A",
  },

  submittedBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.emerald + "15", paddingHorizontal: 16, paddingVertical: 8,
  },
  submittedText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.emerald },
  inputsContent: { padding: 12, gap: 8 },
  categoryInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#9898CC", width: 72, textAlign: "right" },
  categoryInput: {
    flex: 1, backgroundColor: "#0E0E24", borderRadius: 12, borderWidth: 1,
    borderColor: "#1E1E3A", paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, fontFamily: "Cairo_400Regular", color: "#E8E8FF",
  },
  categoryInputFilled: { borderColor: Colors.gold + "80", backgroundColor: Colors.gold + "10" },
  categoryInputSubmitted: { opacity: 0.6 },
  // Power cards
  powerCardsRow: {
    position: "absolute", left: 12, right: 12,
    flexDirection: "row", gap: 8,
  },
  powerCard: {
    flex: 1, backgroundColor: "#12122A", borderRadius: 14, paddingVertical: 8,
    alignItems: "center", borderWidth: 1.5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  powerCardUsed: {
    backgroundColor: "#0A0A1A", opacity: 0.5,
  },
  powerCardIcon: { fontSize: 20, marginBottom: 1 },
  powerCardLabel: { fontFamily: "Cairo_700Bold", fontSize: 11 },
  powerCardDesc: { fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: 1 },
  powerCardCountBadge: {
    position: "absolute", top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },
  powerCardCountText: { fontFamily: "Cairo_700Bold", fontSize: 10, color: "#fff" },
  // Opponent frozen indicator (shown to caster)
  opponentFrozenBadge: {
    position: "absolute", top: 72, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    zIndex: 50,
  },
  opponentFrozenInner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(26,163,219,0.22)",
    borderWidth: 1, borderColor: "#3498DB66",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  opponentFrozenIcon: { fontSize: 16 },
  opponentFrozenText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#A8E6FF" },
  opponentFrozenCountBubble: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#3498DB",
    justifyContent: "center", alignItems: "center",
  },
  opponentFrozenCount: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#fff" },
  powerToast: {
    position: "absolute", left: 24, right: 24, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1.5,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  powerToastText: { fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "center" },

  submitBtn: {
    position: "absolute", left: 16, right: 16, backgroundColor: Colors.gold,
    borderRadius: 16, paddingVertical: 16, flexDirection: "row",
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000000" },
  submittedState: {
    position: "absolute", left: 16, right: 16, backgroundColor: Colors.emerald + "22",
    borderRadius: 16, paddingVertical: 16, flexDirection: "row",
    justifyContent: "center", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: Colors.emerald + "40",
  },
  submittedStateText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.emerald },

  // Quick chat panel
  chatPanelOverlay: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)",
  },
  chatPanel: {
    backgroundColor: "#0E0E24", borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, paddingBottom: 40,
    borderTopWidth: 1, borderColor: "#1E1E3A",
  },
  chatPanelTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF", textAlign: "center", marginBottom: 16 },
  chatMessagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  chatMessageBtn: {
    backgroundColor: "#12122A", borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, borderWidth: 1, borderColor: "#1E1E3A",
  },
  chatMessageText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E8E8FF" },

  // Round results
  roundResultsHeader: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1E1E3A", backgroundColor: "#0E0E24" },
  roundResultsTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF", textAlign: "center" },
  roundResultsContent: { padding: 12, gap: 12, paddingBottom: 100 },
  resultPlayerCard: { backgroundColor: "#12122A", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#1E1E3A" },
  resultPlayerCardMe: { borderColor: Colors.gold + "60" },
  resultPlayerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  resultPlayerName: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#E8E8FF" },
  resultTotalBadge: { backgroundColor: Colors.gold + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  resultTotalText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  resultCatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderTopWidth: 1, borderTopColor: "#1E1E3A" + "50" },
  resultCatName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#5A5A88", width: 64, textAlign: "right" },
  resultAnswer: { flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: "#E8E8FF", textAlign: "center", paddingHorizontal: 6 },
  resultAnswerEmpty: { color: "#5A5A88" },
  resultScoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, minWidth: 32, alignItems: "center" },
  resultScoreText: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  scoreSummary: { backgroundColor: "#12122A", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#1E1E3A" },
  scoreSummaryTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#E8E8FF", textAlign: "center", marginBottom: 10 },
  scoreSummaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  scoreSummaryRank: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold, width: 30, textAlign: "center" },
  scoreSummaryName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E8E8FF", paddingHorizontal: 10 },
  scoreSummaryTotal: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF" },
  nextRoundBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16,
    marginHorizontal: 16, marginVertical: 12, flexDirection: "row",
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  nextRoundBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000000" },
  waitingNextRound: { paddingVertical: 16, paddingHorizontal: 16, backgroundColor: "#12122A", marginHorizontal: 16, marginVertical: 12, borderRadius: 16, alignItems: "center" },
  waitingNextRoundText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC" },

  // Game over
  gameOverContent: { padding: 20, alignItems: "center", paddingBottom: 40 },
  gameOverTitle: { fontFamily: "Cairo_700Bold", fontSize: 28, color: "#E8E8FF", textAlign: "center", marginBottom: 6 },
  gameOverSub: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#9898CC", textAlign: "center", marginBottom: 20 },
  podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, width: "100%", marginBottom: 24 },
  podiumSlot: { alignItems: "center", flex: 1 },
  podiumMedal: { fontSize: 24, marginBottom: 4 },
  podiumAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  podiumAvatarFirst: { width: 64, height: 64, borderRadius: 32 },
  podiumEmoji: { fontSize: 26 },
  podiumEmojiFirst: { fontSize: 32 },
  podiumName: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#E8E8FF", textAlign: "center", marginBottom: 2 },
  podiumScore: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#9898CC", marginBottom: 4 },
  podiumBase: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#1E1E3A" },
  podiumBaseFirst: { backgroundColor: Colors.gold + "60" },
  podiumRank: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#E8E8FF" },
  finalRankings: { width: "100%", gap: 10, marginBottom: 24 },
  finalRankRow: { backgroundColor: "#12122A", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#1E1E3A", gap: 10 },
  finalRankRowMe: { borderColor: Colors.gold + "60", backgroundColor: Colors.gold + "08" },
  finalRankNum: { fontFamily: "Cairo_700Bold", fontSize: 20, width: 32, textAlign: "center" },
  finalRankAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  finalRankEmoji: { fontSize: 18 },
  finalRankName: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E8E8FF" },
  finalRankRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  finalRankScore: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF" },
  bonusBanner: {
    backgroundColor: Colors.gold + "15", borderRadius: 14, padding: 14,
    width: "100%", gap: 8, borderWidth: 1, borderColor: Colors.gold + "30", marginBottom: 16,
  },
  bonusRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  bonusText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold },
  coinEntryInfo: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#12122A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 16,
  },
  coinEntryInfoText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#9898CC" },
  coinRewardBadge: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.gold + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 3 },
  coinRewardText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: Colors.gold },
  gameOverActions: { width: "100%", gap: 12, marginTop: 4 },
  gameOverBtnRow: { flexDirection: "row", gap: 10 },
  playAgainBtn: {
    backgroundColor: Colors.gold, borderRadius: 16, paddingVertical: 16,
    paddingHorizontal: 40,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  playAgainBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000000" },
  shareCardContainer: { width: 320, alignSelf: "center", marginBottom: 16, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: "#F5C84240" },
  shareCard: { padding: 24, alignItems: "center", gap: 8 },
  shareCardTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#F5C842" },
  shareCardDivider: { width: 60, height: 2, backgroundColor: "#F5C84230", borderRadius: 1, marginVertical: 4 },
  shareCardRank: { fontFamily: "Cairo_700Bold", fontSize: 28, color: "#00F5FF" },
  shareCardScore: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  shareCardName: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#9898CC" },
  shareCardFooter: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#BF00FF" },
  shareBtn: {
    flex: 1, backgroundColor: "rgba(191,0,255,0.12)", borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: "rgba(191,0,255,0.3)",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  shareBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#BF00FF" },
  homeBtn: { flex: 1, backgroundColor: "#12122A", borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#1E1E3A", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  homeBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#9898CC" },

  // Exit game button (top-left of gameTopBar)
  exitGameBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.ruby + "18",
    justifyContent: "center", alignItems: "center",
    marginRight: 8,
    borderWidth: 1, borderColor: Colors.ruby + "44",
  },

  // Exit confirmation popup overlay
  exitOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 28,
  },
  exitPopupWrapper: {
    width: "100%", maxWidth: 340,
    borderRadius: 24,
    shadowColor: Colors.ruby, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 20,
  },
  exitPopup: {
    borderRadius: 24, paddingHorizontal: 24, paddingVertical: 28,
    alignItems: "center",
    borderWidth: 1.5, borderColor: Colors.ruby + "44",
  },
  exitIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.ruby + "18",
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
    borderWidth: 1.5, borderColor: Colors.ruby + "40",
  },
  exitTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 20,
    color: "#E8E8FF", textAlign: "center", marginBottom: 8,
  },
  exitMessage: {
    fontFamily: "Cairo_400Regular", fontSize: 14,
    color: "#9898CC", textAlign: "center", lineHeight: 22,
  },
  exitCoinWarning: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12, backgroundColor: Colors.ruby + "15",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.ruby + "30",
  },
  exitCoinWarningText: {
    fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.ruby,
  },
  exitDivider: {
    width: "100%", height: 1, backgroundColor: "#1E1E3A",
    marginVertical: 20,
  },
  exitBtnsRow: {
    flexDirection: "row", gap: 12, width: "100%",
  },
  exitActionBtn: {
    flex: 1, minHeight: 48, borderRadius: 16,
    justifyContent: "center", alignItems: "center", borderWidth: 1.5,
  },
  exitBtnNo: {
    backgroundColor: Colors.emerald + "18", borderColor: Colors.emerald + "60",
  },
  exitBtnYes: {
    backgroundColor: Colors.ruby + "18", borderColor: Colors.ruby + "60",
  },
  exitBtnNoText: {
    fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.emerald,
  },
  exitBtnYesText: {
    fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.ruby,
  },
  emoteRow: {
    flexDirection: "row", justifyContent: "center", gap: 10,
    marginVertical: 12, paddingHorizontal: 16,
  },
  emoteBtn: {
    alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
    backgroundColor: "#12122A", borderColor: "#1E1E3A",
  },
  emoteBtnEmoji: { fontSize: 24 },
  emoteBtnLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#5A5A88" },
  floatingEmote: {
    position: "absolute", top: "30%", alignSelf: "center",
    alignItems: "center", zIndex: 200,
    backgroundColor: "rgba(10,10,26,0.9)", borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 16,
    borderWidth: 1.5, borderColor: Colors.gold + "50",
  },
  floatingEmoteText: { fontSize: 48 },
  floatingEmoteName: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.gold, marginTop: 4 },
});
