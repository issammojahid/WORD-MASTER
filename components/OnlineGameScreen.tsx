import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GameIcon, GameIllustration } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Socket } from "socket.io-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { GAME_CATEGORIES, type GameCategory } from "@/constants/i18n";
import { connectOnlineSocket, disconnectOnlineSocket, fetchOnlineWallet } from "@/services/socket";
import { GameButton, GameHeader, GameScreenBackground, GameInput, StatusBadge, VictoryCosmeticEffect } from "@/components/GameUi";

type OnlineSettings = { maxPlayers: 2 | 4 | 6 | 8; rounds: 3 | 5 | 7; secondsPerRound: 45 | 60 | 90 };
type RoomPlayer = { id: string; name: string; ready: boolean; host: boolean; connected: boolean; score: number };
type MatchSnapshot = {
  matchId: string;
  mode: "random" | "private";
  phase: string;
  roomCode: string | null;
  hostId: string;
  settings: OnlineSettings;
  round: number;
  totalRounds: number;
  letter: string;
  deadline: number;
  players: RoomPlayer[];
};
type RoundResult = {
  round: number;
  letter: string;
  results: {
    playerId: string;
    playerName: string;
    answers: Partial<Record<GameCategory, string>>;
    scores: Record<GameCategory, number>;
    status: Record<GameCategory, "correct" | "duplicate" | "empty" | "invalid">;
    roundTotal: number;
    totalScore?: number;
  }[];
};
type FinalPlayer = { playerId: string; name: string; score: number; rank: number; coinsAwarded: number };
type SocketAck = { ok: boolean; error?: string; roomCode?: string; match?: MatchSnapshot };

const GOLD = gameDesign.colors.coins;
const CYAN = gameDesign.colors.online;
const GREEN = gameDesign.colors.success;
const REWARDED_MATCHES_KEY = "online_rewarded_matches_v1";
const DEFAULT_SETTINGS: OnlineSettings = { maxPlayers: 4, rounds: 5, secondsPerRound: 60 };

const SERVER_ERROR_TRANSLATIONS: Record<string, keyof ReturnType<typeof useLanguage>["t"]> = {
  rate_limited: "rateLimited",
  online_unavailable: "onlineUnavailable",
  room_not_found: "roomNotFound",
  room_full: "roomFull",
  already_in_match: "alreadyInMatch",
  need_more_players: "needMorePlayers",
  players_not_ready: "playersNotReady",
  host_only: "hostOnly",
  ready_timeout: "readyTimeout",
  match_cancelled: "matchCancelled",
  already_submitted: "alreadySubmitted",
  round_expired: "roundExpired",
  invalid_payload: "invalidPayload",
  invalid_settings: "invalidSettings",
  opponent_disconnected: "opponentDisconnected",
  game_in_progress: "matchInProgress",
  capacity_below_current_players: "roomFull",
  room_not_waiting: "matchInProgress",
  match_not_playing: "matchInProgress",
  match_not_ready: "matchInProgress",
  cannot_forfeit: "matchInProgress",
};

function isAck(value: unknown): value is SocketAck {
  return typeof value === "object" && value !== null && "ok" in value;
}

type Props = {
  mode: "online" | "private";
};

export default function OnlineGameScreen({ mode }: Props) {
  const isPrivateRoomScreen = mode === "private";
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { profile, addCoins } = usePlayer();
  const { theme } = useTheme();
  const routeParams = useLocalSearchParams<{ roomCode?: string }>();
  const socketRef = useRef<Socket | null>(null);
  const answerInputRefs = useRef<(import("react-native").TextInput | null)[]>([]);
  const creditedMatchesRef = useRef<Set<string>>(new Set());
  const creditInFlightRef = useRef<Set<string>>(new Set());
  const addCoinsRef = useRef(addCoins);
  const principalIdRef = useRef("");
  addCoinsRef.current = addCoins;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<MatchSnapshot | null>(null);
  const [principalId, setPrincipalId] = useState("");
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [finalPlayers, setFinalPlayers] = useState<FinalPlayer[] | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<GameCategory, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const autoJoinRoomRef = useRef("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState("");
  principalIdRef.current = principalId;

  const roomPlayer = useMemo(
    () => match?.players.find((player) => player.id === principalId),
    [match?.players, principalId],
  );
  const isHost = !!roomPlayer?.host;
  const isLobby = !!match && match.phase === "waiting";
  const isPlaying = !!match && match.phase === "playing";
  const isRoundResults = !!match && match.phase === "results";
  const isFinished = !!match && match.phase === "finished";

  const translateServerError = useCallback((code: string) => {
    const key = SERVER_ERROR_TRANSLATIONS[code];
    setError(key ? t[key] : t.connectionError);
  }, [t]);

  const creditVerifiedReward = useCallback(async (matchId: string, players: FinalPlayer[]) => {
    if (creditedMatchesRef.current.has(matchId) || creditInFlightRef.current.has(matchId)) return;
    creditInFlightRef.current.add(matchId);
    try {
      const stored = await AsyncStorage.getItem(REWARDED_MATCHES_KEY);
      if (stored) {
        try {
          const ids = JSON.parse(stored);
          if (Array.isArray(ids)) ids.forEach((id) => typeof id === "string" && creditedMatchesRef.current.add(id));
        } catch {
          console.warn("[online] Ignoring invalid local reward receipt cache.");
        }
      }
      if (creditedMatchesRef.current.has(matchId)) return;
      const reward = players.find((player) => player.playerId === principalIdRef.current)?.coinsAwarded ?? 0;
      await AsyncStorage.setItem(
        REWARDED_MATCHES_KEY,
        JSON.stringify([...creditedMatchesRef.current, matchId].slice(-100)),
      );
      creditedMatchesRef.current.add(matchId);
      if (reward > 0) addCoinsRef.current(reward);
    } finally {
      creditInFlightRef.current.delete(matchId);
    }
  }, []);

  const syncOnlineWallet = useCallback(async (playerId: string) => {
    const wallet = await fetchOnlineWallet();
    for (const claim of wallet.claims) {
      await creditVerifiedReward(claim.matchId, [{
        playerId,
        name: "",
        score: 0,
        rank: 0,
        coinsAwarded: claim.amount,
      }]);
    }
  }, [creditVerifiedReward]);

  useEffect(() => {
    let active = true;
    let nextSocket: Socket | null = null;
    let removeListeners: (() => void) | null = null;
    void connectOnlineSocket(profile.name).then((socket) => {
      if (!active) {
        disconnectOnlineSocket();
        return;
      }
      nextSocket = socket;
      socketRef.current = socket;
      const onConnect = () => {
        setConnected(true);
        setConnecting(false);
        setError("");
      };
      const onDisconnect = () => setConnected(false);
      const onConnectError = () => {
        setConnecting(false);
        setConnected(false);
        setError(t.onlineUnavailable);
      };
      const onReady = (data: { playerId?: string }) => {
        if (data.playerId) {
          principalIdRef.current = data.playerId;
          setPrincipalId(data.playerId);
          void syncOnlineWallet(data.playerId).catch((walletError: unknown) => {
            console.error("[online] Could not sync wallet claims:", walletError);
            setError(t.onlineUnavailable);
          });
        }
      };
      const onQueued = () => {
        setSearching(true);
        setError("");
      };
      const onSearchCancelled = () => setSearching(false);
      const onQueueTimeout = () => {
        setSearching(false);
        setError(t.opponentDisconnected);
      };
      const onFound = (data: MatchSnapshot) => {
        setSearching(false);
        setMatch(data);
        setRoundResult(null);
        setFinalPlayers(null);
      };
      const onRestored = (data: MatchSnapshot & { roundResults?: RoundResult | null }) => {
        setSearching(false);
        setMatch(data);
        if (data.roundResults) setRoundResult(data.roundResults);
      };
      const onRoomUpdate = (data: MatchSnapshot) => {
        setMatch(data);
        if (data.mode === "private") setSettings(data.settings);
      };
      const onCountdown = (data: { count: number }) => {
        setCountdown(data.count);
        setMatch((current) => current ? { ...current, phase: "countdown" } : current);
      };
      const onRound = (data: MatchSnapshot) => {
        setMatch(data);
        setAnswers({});
        setSubmitted(false);
        setRoundResult(null);
        setCountdown(null);
      };
      const onRoundResults = (data: RoundResult & { matchId: string }) => {
        setRoundResult(data);
        setSubmitted(true);
        setMatch((current) => current ? { ...current, phase: "results" } : current);
      };
      const onFinished = (data: { matchId: string; players: FinalPlayer[] }) => {
        setFinalPlayers(data.players);
        setMatch((current) => current ? { ...current, phase: "finished" } : current);
        void creditVerifiedReward(data.matchId, data.players).catch((creditError: unknown) => {
          console.error("[online] Could not store reward receipt:", creditError);
          setError(t.onlineUnavailable);
        });
      };
      const onWalletReward = (data: { matchId: string; coinsAwarded: number }) => {
        if (!principalIdRef.current || !Number.isInteger(data.coinsAwarded) || data.coinsAwarded < 0) return;
        void creditVerifiedReward(data.matchId, [{
          playerId: principalIdRef.current,
          name: "",
          score: 0,
          rank: 0,
          coinsAwarded: data.coinsAwarded,
        }]).catch((creditError: unknown) => {
          console.error("[online] Could not store wallet reward receipt:", creditError);
          setError(t.onlineUnavailable);
        });
      };
      const onCancelled = (data: { reason?: string }) => {
        setSearching(false);
        setCountdown(null);
        setMatch(null);
        translateServerError(data.reason === "ready_timeout" ? "ready_timeout" : "match_cancelled");
      };
      const onReconnecting = () => setError(t.reconnecting);
      const onServerError = (data: { code?: string }) => translateServerError(data.code ?? "connection_error");

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);
      socket.on("session:ready", onReady);
      socket.on("match:queued", onQueued);
      socket.on("match:search-cancelled", onSearchCancelled);
      socket.on("match:queue-timeout", onQueueTimeout);
      socket.on("match:found", onFound);
      socket.on("match:restored", onRestored);
      socket.on("room:update", onRoomUpdate);
      socket.on("match:countdown", onCountdown);
      socket.on("match:round", onRound);
      socket.on("match:round-results", onRoundResults);
      socket.on("match:finished", onFinished);
      socket.on("match:wallet", onWalletReward);
      socket.on("match:cancelled", onCancelled);
      socket.on("match:reconnecting", onReconnecting);
      socket.on("online:error", onServerError);

      removeListeners = () => {
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);
        socket.off("session:ready", onReady);
        socket.off("match:queued", onQueued);
        socket.off("match:search-cancelled", onSearchCancelled);
        socket.off("match:queue-timeout", onQueueTimeout);
        socket.off("match:found", onFound);
        socket.off("match:restored", onRestored);
        socket.off("room:update", onRoomUpdate);
        socket.off("match:countdown", onCountdown);
        socket.off("match:round", onRound);
        socket.off("match:round-results", onRoundResults);
        socket.off("match:finished", onFinished);
        socket.off("match:wallet", onWalletReward);
        socket.off("match:cancelled", onCancelled);
        socket.off("match:reconnecting", onReconnecting);
        socket.off("online:error", onServerError);
      };
      socket.connect();
    }).catch((connectError: unknown) => {
      console.error("[online] Could not connect:", connectError);
      if (active) {
        setConnecting(false);
        setError(t.onlineUnavailable);
      }
    });

    return () => {
      active = false;
      removeListeners?.();
      nextSocket?.disconnect();
      disconnectOnlineSocket();
    };
  }, [creditVerifiedReward, profile.name, syncOnlineWallet, t, translateServerError]);

  useEffect(() => {
    if (!match?.deadline || match.phase !== "playing") {
      setSecondsLeft(0);
      return;
    }
    const updateTimer = () => setSecondsLeft(Math.max(0, Math.ceil((match.deadline - Date.now()) / 1000)));
    updateTimer();
    const timer = setInterval(updateTimer, 250);
    return () => clearInterval(timer);
  }, [match?.deadline, match?.phase]);

  const emit = useCallback((event: string, payload?: unknown, ack?: (response: unknown) => void) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError(t.onlineUnavailable);
      return;
    }
    socket.emit(event, payload, ack);
  }, [t.onlineUnavailable]);

  const handleRoomAck = useCallback((response: unknown) => {
    if (!isAck(response)) {
      setError(t.connectionError);
      return;
    }
    if (!response.ok) {
      translateServerError(response.error ?? "connection_error");
      return;
    }
    if (response.match) setMatch(response.match);
    if (response.roomCode) setRoomCodeInput(response.roomCode);
    setError("");
  }, [t.connectionError, translateServerError]);

  const createRoom = () => {
    emit("room:create", settings, handleRoomAck);
  };

  const joinRoom = () => {
    emit("room:join", { roomCode: roomCodeInput.trim().toUpperCase() }, handleRoomAck);
  };

  useEffect(() => {
    const roomCode = typeof routeParams.roomCode === "string"
      ? routeParams.roomCode.trim().toUpperCase()
      : "";
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode)) return;
    setRoomCodeInput(roomCode);
    if (connected && !match && autoJoinRoomRef.current !== roomCode) {
      autoJoinRoomRef.current = roomCode;
      emit("room:join", { roomCode }, handleRoomAck);
    }
  }, [connected, emit, handleRoomAck, match, routeParams.roomCode]);

  const leaveCurrentMatch = () => {
    if (!match) return;
    if (match.mode === "private" && match.phase === "waiting") {
      emit("room:leave", { matchId: match.matchId });
      setMatch(null);
      setRoomCodeInput("");
      return;
    }
    if (match.mode === "random" && ["playing", "results"].includes(match.phase)) {
      Alert.alert(t.forfeitMatch, t.forfeitMatch, [
        { text: t.cancel, style: "cancel" },
        { text: t.confirm, style: "destructive", onPress: () => emit("match:forfeit", { matchId: match.matchId }) },
      ]);
    }
  };

  const startNewMatch = () => {
    setMatch(null);
    setFinalPlayers(null);
    setRoundResult(null);
    setAnswers({});
    setSearching(false);
    setError("");
  };

  const submitAnswers = () => {
    if (!match || submitted) return;
    emit("match:submit", { matchId: match.matchId, answers });
    setSubmitted(true);
  };

  const updateSetting = <K extends keyof OnlineSettings>(key: K, value: OnlineSettings[K]) => {
    const currentSettings = match?.mode === "private" && match.phase === "waiting"
      ? match.settings
      : settings;
    const next = { ...currentSettings, [key]: value };
    setSettings(next);
    if (match?.mode === "private" && match.phase === "waiting" && isHost && match.roomCode) {
      emit("room:update-settings", { roomCode: match.roomCode, settings: next });
    }
  };

  const renderButton = (
    label: string,
    action: () => void,
    options: { color?: string; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap } = {},
  ) => (
    <GameButton
      accessibilityHint={label}
      label={label}
      onPress={action}
      disabled={options.disabled}
      accent={options.color ?? GREEN}
      style={styles.button}
    >
      {options.icon ? <Ionicons name={options.icon} size={19} color="#FFFFFF" /> : null}
      <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>{label}</Text>
    </GameButton>
  );

  const renderChoiceRow = <T extends number>(
    label: string,
    values: readonly T[],
    value: T,
    onChange: (choice: T) => void,
  ) => (
    <View style={styles.settingGroup}>
      <Text style={[styles.settingLabel, { color: theme.textSecondary, textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <View style={[styles.choiceRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {values.map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="button"
            accessibilityState={{ selected: choice === value }}
            onPress={() => onChange(choice)}
            style={[
              styles.choice,
              { borderColor: choice === value ? CYAN : theme.cardBorder, backgroundColor: choice === value ? `${CYAN}18` : theme.card },
            ]}
          >
            <Text style={{ color: choice === value ? CYAN : theme.textPrimary, fontWeight: "700" }}>
              {label === t.secondsPerRound ? `${choice}s` : choice}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const pageTitle = match?.phase === "playing"
    ? `${t.round} ${match.round}/${match.totalRounds}`
    : match?.phase === "finished"
      ? t.onlineResult
      : isPrivateRoomScreen ? t.privateRooms : t.onlineMode;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12) }]}>
      <GameScreenBackground accent="online" />
      <GameHeader
        title={pageTitle}
        onBack={() => {
          if (match && match.phase !== "finished") leaveCurrentMatch();
          router.back();
        }}
        icon={isPrivateRoomScreen
          ? <Ionicons name="people-outline" size={23} color={CYAN} />
          : <GameIcon name="online" size={23} color={CYAN} />}
        trailing={
          <StatusBadge label={connected ? t.onlineMode : t.connectionError} tone={connected ? "success" : "warning"} />
        }
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {connecting ? (
          <View style={styles.centerPanel}>
            <ActivityIndicator size="large" color={CYAN} />
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.loading}</Text>
          </View>
        ) : null}

        {!!error && (
          <View style={[styles.errorBanner, { backgroundColor: `${gameDesign.colors.danger}12`, borderColor: `${gameDesign.colors.danger}66` }]} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={gameDesign.colors.danger} />
            <Text style={[styles.errorText, { color: gameDesign.colors.dangerText }]}>{error}</Text>
          </View>
        )}

        {!connecting && !match && (
          <>
            <View style={[styles.hero, { backgroundColor: theme.card, borderColor: `${CYAN}55` }]}>
              {isPrivateRoomScreen
                ? <Ionicons name="people-outline" size={62} color={CYAN} />
                : <GameIllustration name="matchmaking" size={110} />}
              <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
                {isPrivateRoomScreen ? t.privateRooms : t.onlineMode}
              </Text>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                {isPrivateRoomScreen ? t.privateRoomsInternetRequired : t.onlineModeHint}
              </Text>
            </View>

            {isPrivateRoomScreen ? (
              <>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.createRoom}</Text>
                  <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.noMatchCoins}</Text>
                  {renderChoiceRow(t.maxPlayers, [2, 4, 6, 8] as const, settings.maxPlayers, (value) => updateSetting("maxPlayers", value))}
                  {renderChoiceRow(t.rounds, [3, 5, 7] as const, settings.rounds, (value) => updateSetting("rounds", value))}
                  {renderChoiceRow(t.secondsPerRound, [45, 60, 90] as const, settings.secondsPerRound, (value) => updateSetting("secondsPerRound", value))}
                  {renderButton(t.createRoom, createRoom, { color: CYAN, disabled: !connected, icon: "add-circle-outline" })}
                </View>

                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.joinRoomByCode}</Text>
                  <Text style={[styles.settingLabel, { color: theme.textSecondary, textAlign: isRTL ? "right" : "left" }]}>{t.roomCode}</Text>
                  <View style={[styles.joinRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <GameInput
                      accessibilityLabel={t.roomCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={6}
                      onChangeText={(text) => setRoomCodeInput(text.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                      placeholder="ABC234"
                      placeholderTextColor={theme.textMuted}
                      style={[styles.roomInput, { color: theme.textPrimary, borderColor: theme.cardBorder, textAlign: "center" }]}
                      value={roomCodeInput}
                    />
                    {renderButton(t.joinRoomByCode, joinRoom, { color: GOLD, disabled: !connected || roomCodeInput.length !== 6 })}
                  </View>
                </View>
              </>
            ) : (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.randomMatch}</Text>
                <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.readyToPlay}</Text>
                {searching ? (
                  <View style={styles.searchingRow}>
                    <GameIllustration name="matchmaking" size={70} />
                    <Text style={[styles.bodyText, { color: CYAN, flex: 1 }]}>{t.searchingOpponent}</Text>
                    {renderButton(t.cancelSearch, () => emit("match:cancel-search"), { color: "#FF738D" })}
                  </View>
                ) : renderButton(t.findOpponent, () => {
                  setError("");
                  emit("match:find");
                }, { icon: "search-outline", disabled: !connected })}
              </View>
            )}
          </>
        )}

        {match?.phase === "match_found" && (
          <View style={[styles.card, styles.centerPanel, { backgroundColor: theme.card, borderColor: `${CYAN}66` }]}>
            <GameIllustration name="matchmaking" size={92} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.matchFound}</Text>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.readyToPlay}</Text>
            {match.players.filter((player) => player.id !== principalId).map((player) => (
              <Text key={player.id} style={[styles.opponentName, { color: CYAN }]}>{player.name}</Text>
            ))}
            {renderButton(roomPlayer?.ready ? t.waitingForPlayers : t.ready, () => emit("match:ready", { matchId: match.matchId }), {
              disabled: !connected || roomPlayer?.ready,
              icon: "checkmark-circle-outline",
            })}
          </View>
        )}

        {isLobby && match && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.lobbyHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.privateRooms}</Text>
                <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.noMatchCoins}</Text>
              </View>
              <View style={styles.codeActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isRTL ? "دعوة الأصدقاء" : "Invite friends"}
                  onPress={() => {
                    if (match.roomCode) {
                      router.push({ pathname: "/friends", params: { roomCode: match.roomCode } });
                    }
                  }}
                  style={[styles.shareButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <GameIcon name="invitations" size={22} color={CYAN} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.copyRoomCode}
                  onPress={() => {
                    if (match.roomCode) {
                      void Clipboard.setStringAsync(match.roomCode).then(() => Alert.alert(t.copied));
                    }
                  }}
                  style={[styles.codeBadge, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <Text style={styles.codeText}>{match.roomCode}</Text>
                  <Ionicons name="copy-outline" size={17} color={CYAN} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.shareRoomCode}
                  onPress={() => {
                    if (match.roomCode) void Share.share({ message: `${t.roomCode}: ${match.roomCode}` });
                  }}
                  style={[styles.shareButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <Ionicons name="share-social-outline" size={19} color={CYAN} />
                </Pressable>
              </View>
            </View>
            <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>{t.connectedPlayers}</Text>
            {match.players.map((player) => (
              <View key={player.id} style={[styles.playerRow, { borderColor: theme.cardBorder, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Ionicons name={player.connected ? "person-circle-outline" : "cloud-offline-outline"} size={22} color={player.connected ? CYAN : GOLD} />
                <Text style={[styles.playerName, { color: theme.textPrimary }]}>{player.name}</Text>
                {player.host ? <Text style={styles.hostLabel}>{t.host}</Text> : null}
                <Text style={[styles.readyLabel, { color: player.ready ? GREEN : theme.textMuted }]}>
                  {player.ready ? t.ready : t.waitingForPlayers}
                </Text>
              </View>
            ))}
            {isHost ? (
              <>
                {renderChoiceRow(t.maxPlayers, [2, 4, 6, 8] as const, match.settings.maxPlayers, (value) => updateSetting("maxPlayers", value))}
                {renderChoiceRow(t.rounds, [3, 5, 7] as const, match.settings.rounds, (value) => updateSetting("rounds", value))}
                {renderChoiceRow(t.secondsPerRound, [45, 60, 90] as const, match.settings.secondsPerRound, (value) => updateSetting("secondsPerRound", value))}
                {renderButton(roomPlayer?.ready ? t.waitingForPlayers : t.ready, () => emit("room:ready", { matchId: match.matchId }), {
                  color: CYAN,
                  disabled: !connected,
                  icon: "checkmark-circle-outline",
                })}
                {renderButton(t.startMatch, () => emit("room:start", { matchId: match.matchId }), {
                  color: GREEN,
                  disabled: match.players.length < 2 || !match.players.every((player) => player.ready && player.connected),
                })}
              </>
            ) : renderButton(t.ready, () => emit("room:ready", { matchId: match.matchId }), {
              color: CYAN,
              disabled: !connected,
              icon: "checkmark-circle-outline",
            })}
            {renderButton(t.leaveRoom, leaveCurrentMatch, { color: "#455064" })}
          </View>
        )}

        {match?.phase === "countdown" && (
          <View style={[styles.card, styles.centerPanel, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.startMatch}</Text>
            <Text style={[styles.countdown, { color: GOLD }]}>{countdown ?? 3}</Text>
          </View>
        )}

        {isPlaying && match && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.gameMeta}>
              <View style={[styles.letterBadge, { backgroundColor: `${CYAN}20` }]}>
                <Text style={styles.letterText}>{match.letter}</Text>
              </View>
              <View style={[styles.timerBadge, { backgroundColor: theme.card }]}>
                <Ionicons name="timer-outline" size={20} color={secondsLeft <= 10 ? "#FF738D" : CYAN} />
                <Text style={[styles.timerText, { color: secondsLeft <= 10 ? "#FF738D" : theme.textPrimary }]}>{secondsLeft}s</Text>
              </View>
            </View>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              {t.round} {match.round} / {match.totalRounds}
            </Text>
            {GAME_CATEGORIES.map((category, index) => (
              <View key={category} style={styles.answerGroup}>
                <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>{t[category]}</Text>
                <GameInput
                  accessibilityLabel={t[category]}
                  ref={(input) => { answerInputRefs.current[index] = input; }}
                  editable={!submitted && connected && secondsLeft > 0}
                  maxLength={80}
                  onChangeText={(value) => setAnswers((current) => ({ ...current, [category]: value }))}
                  placeholder={`${t.currentLetter}: ${match.letter}`}
                  placeholderTextColor={theme.textMuted}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    if (index < GAME_CATEGORIES.length - 1) answerInputRefs.current[index + 1]?.focus();
                    else submitAnswers();
                  }}
                  style={[styles.answerInput, { color: theme.textPrimary, borderColor: theme.cardBorder }]}
                  value={answers[category] ?? ""}
                />
              </View>
            ))}
            {renderButton(submitted ? t.waitingForPlayers : t.submit, submitAnswers, { disabled: submitted || !connected || secondsLeft <= 0 })}
            {match.mode === "random" ? renderButton(t.forfeitMatch, leaveCurrentMatch, { color: "#873F4A" }) : null}
          </View>
        )}

        {isRoundResults && roundResult && match && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.results} · {roundResult.letter}</Text>
            {roundResult.results.map((result) => (
              <View key={result.playerId} style={[styles.resultPlayer, { borderColor: theme.cardBorder }]}>
                <View style={[styles.lobbyHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={[styles.playerName, { color: theme.textPrimary }]}>{result.playerName}</Text>
                  <Text style={styles.scoreText}>+{result.roundTotal}</Text>
                </View>
                {GAME_CATEGORIES.map((category) => (
                  <Text key={category} style={[styles.resultLine, { color: theme.textSecondary }]}>
                    {t[category]}: {result.answers[category] || "—"} · {result.scores[category]} {t.points}
                  </Text>
                ))}
              </View>
            ))}
            <Text style={[styles.bodyText, { color: theme.textSecondary, textAlign: "center" }]}>
              {t.waitingForPlayers}
            </Text>
          </View>
        )}

        {isFinished && match && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.onlineResultHero}>
              <GameIllustration
                name={finalPlayers?.find((player) => player.playerId === principalId)?.rank === 1 ? "victory" : "defeat"}
                size={92}
              />
            </View>
            {finalPlayers?.find((player) => player.playerId === principalId)?.rank === 1
              ? <VictoryCosmeticEffect effectId={profile.equippedCosmetics.victory} />
              : null}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.onlineResult}</Text>
            {finalPlayers?.map((player) => (
              <View key={player.playerId} style={[styles.finalRow, { borderColor: theme.cardBorder }]}>
                <Text style={[styles.rankText, { color: player.rank === 1 ? GOLD : theme.textSecondary }]}>#{player.rank}</Text>
                <Text style={[styles.playerName, { color: theme.textPrimary }]}>{player.name}</Text>
                <Text style={styles.scoreText}>{player.score}</Text>
                {match.mode === "random" ? (
                  <View style={styles.rewardTextRow}>
                    <GameIcon name="coins" size={18} color={GOLD} secondaryColor="#FFE2A3" />
                    <Text style={[styles.rewardText, { color: GREEN }]}>+{player.coinsAwarded} {t.coins}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {match.mode === "private" ? <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.noMatchCoins}</Text> : null}
            {match.mode === "private"
              ? renderButton(t.playAgain, () => emit("room:rematch", { matchId: match.matchId }), {
                color: CYAN,
                disabled: !isHost || !connected,
              })
              : renderButton(t.playAgain, startNewMatch)}
          </View>
        )}

        {match?.phase === "settling" && (
          <View style={styles.centerPanel}>
            <ActivityIndicator size="large" color={CYAN} />
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.loading}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backButton: { width: 48, height: 48, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pageTitle: { flex: 1, fontSize: 20, fontWeight: "800", textAlign: "center" },
  connectionPill: { minHeight: 36, borderWidth: 2, borderRadius: 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 36, gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" },
  hero: { alignItems: "center", padding: 22, borderWidth: 2, borderRadius: 5, gap: 8 },
  heroIcon: { width: 56, height: 56, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: `${CYAN}20` },
  heroTitle: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  bodyText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  card: { borderWidth: 2, borderRadius: 5, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  settingGroup: { gap: 8 },
  settingLabel: { fontSize: 14, fontWeight: "700" },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: { minWidth: 48, minHeight: 44, paddingHorizontal: 12, borderWidth: 2, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  buttonText: { color: "#071A17", fontSize: 15, fontWeight: "800", textAlign: "center" },
  divider: { height: 1, backgroundColor: "#D7D1CC", marginVertical: 2 },
  joinRow: { alignItems: "center", gap: 8 },
  roomInput: { flex: 1, minHeight: 48, borderWidth: 2, borderRadius: 4, paddingHorizontal: 12, fontSize: 16, letterSpacing: 2, fontWeight: "800" },
  errorBanner: { minHeight: 44, padding: 11, borderWidth: 1, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600" },
  searchingRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  centerPanel: { alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 30 },
  onlineResultHero: { alignItems: "center", justifyContent: "center", minHeight: 100 },
  opponentName: { fontSize: 20, fontWeight: "800" },
  lobbyHeader: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  codeBadge: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 4, borderWidth: 2 },
  codeActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareButton: { width: 44, height: 44, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  codeText: { color: CYAN, fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  playerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  playerName: { flex: 1, fontSize: 15, fontWeight: "700" },
  hostLabel: { color: GOLD, fontSize: 12, fontWeight: "800" },
  readyLabel: { fontSize: 12, fontWeight: "700" },
  countdown: { fontSize: 70, lineHeight: 84, fontWeight: "900" },
  gameMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  letterBadge: { width: 62, height: 62, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  letterText: { color: GOLD, fontSize: 32, fontWeight: "900" },
  timerBadge: { minHeight: 44, minWidth: 84, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 4, borderWidth: 2 },
  timerText: { fontSize: 18, fontWeight: "900" },
  answerGroup: { gap: 5 },
  answerInput: { minHeight: 48, borderWidth: 2, borderRadius: 4, paddingHorizontal: 12, fontSize: 16, textAlign: "auto" },
  resultPlayer: { borderWidth: 2, borderRadius: 4, padding: 12, gap: 5 },
  resultLine: { fontSize: 13, lineHeight: 20 },
  scoreText: { color: GOLD, fontSize: 16, fontWeight: "900" },
  finalRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  rankText: { width: 34, fontWeight: "900", fontSize: 16 },
  rewardTextRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rewardText: { fontSize: 13, fontWeight: "800" },
});
