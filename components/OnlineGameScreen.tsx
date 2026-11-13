import {PostMatchAdPrompt} from "./PostMatchAdPrompt";
import { ScaledText as Text } from "@/components/ScaledText";
import {rankedOutcome} from "@/lib/match-outcome";
import {useResultSound} from "@/lib/use-result-sound";
import {RoomSettingsSummary} from "@/components/RoomSettingsSummary";
import {AnswerSheet} from "@/components/AnswerSheet";
import {EntryFeePicker} from "@/components/EntryFeePicker";
import {RoomLobbyRoster} from "@/components/RoomLobbyRoster";
import {MatchRoster} from "@/components/MatchRoster";
import {RoomQuickChatButton} from "@/components/RoomQuickChatButton";
import {KeyboardAwareScrollViewCompat} from "@/components/KeyboardAwareScrollViewCompat";
import { RoomVoiceChat } from "@/components/RoomVoiceChat";
import { PUBLIC_MODE_COPY,publicQueueSize,type PublicQueueMode } from "@shared/public-game";
import { RoomTeamBoard } from "@/components/RoomTeamBoard";
import type { TeamMode, TeamId, RoomTeamScore, QuickRoomMessage } from "@shared/friends-room";
import { privateRoomPayload } from "@shared/friends-room";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GameIcon, GameIllustration } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Socket } from "socket.io-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { GAME_CATEGORIES, type GameCategory } from "@/constants/i18n";
import { connectOnlineSocket, disconnectOnlineSocket, fetchOnlineWallet } from "@/services/socket";
import { GameButton, GameHeader, GameScreenBackground, GameInput, StatusBadge, VictoryCosmeticEffect } from "@/components/GameUi";
import { RoyalSurface } from "@/components/RoyalUi";

type OnlineSettings = { entryFee?:number; teamMode?:TeamMode; matchmakingMode?:PublicQueueMode; maxPlayers: 2 | 4 | 6 | 8; rounds: 3 | 5 | 7; secondsPerRound: 45 | 60 | 90 };
type RoomPlayer = { abandoned?:boolean; isBot?:boolean; teamId?:TeamId|null; id: string; name: string; ready: boolean; host: boolean; connected: boolean; score: number };
type MatchSnapshot = {
  queueMode?:PublicQueueMode;
  botPractice?:boolean;
  teams?:RoomTeamScore[];
  messages?:QuickRoomMessage[];
  local?:boolean;
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
  teams?:RoomTeamScore[];
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
const CYAN = gameDesign.colors.offline;
const GREEN = gameDesign.colors.success;
const REWARDED_MATCHES_KEY = "online_rewarded_matches_v1";
const DEFAULT_SETTINGS: OnlineSettings = { maxPlayers: 4, rounds: 5, secondsPerRound: 60, teamMode:"solo" };

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
  queueMode?:PublicQueueMode;
};

export default function OnlineGameScreen({ mode,queueMode="solo" }: Props) {
  const isPrivateRoomScreen = mode === "private";
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { profile, addCoins, refreshCoins } = usePlayer();
  const { theme } = useTheme();
  const routeParams = useLocalSearchParams<{ roomCode?: string }>();
  const socketRef = useRef<Socket | null>(null);
  const creditedMatchesRef = useRef<Set<string>>(new Set());
  const creditInFlightRef = useRef<Set<string>>(new Set());
  const addCoinsRef = useRef(addCoins);
  const principalIdRef = useRef("");
  addCoinsRef.current = addCoins;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [searching, setSearching] = useState(false);
  const [botFallbackAvailable, setBotFallbackAvailable] = useState(false);
  const [queuePlayers,setQueuePlayers]=useState(0);
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
  const [entryFee,setEntryFee]=useState<number>(100);
  const feeRef=useRef(entryFee);feeRef.current=entryFee;
  const [onlineCoins,setOnlineCoins]=useState<number|null>(null),[entrySupported,setEntrySupported]=useState(false);
  principalIdRef.current = principalId;

  const roomPlayer = useMemo(
    () => match?.players.find((player) => player.id === principalId),
    [match?.players, principalId],
  );
  const isHost = !!roomPlayer?.host;
  const isLobby = !!match && match.phase === "waiting";
  const isPlaying = !!match && match.phase === "playing"&&!roomPlayer?.abandoned;
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
    setOnlineCoins(wallet.coins);void refreshCoins().catch(()=>{});setEntrySupported(wallet.entryFees);
    for (const claim of wallet.claims) {
      await creditVerifiedReward(claim.matchId, [{
        playerId,
        name: "",
        score: 0,
        rank: 0,
        coinsAwarded: claim.amount,
      }]);
    }
  }, [creditVerifiedReward,refreshCoins]);

  useEffect(() => {
    let active = true;
    let nextSocket: Socket | null = null;
    let removeListeners: (() => void) | null = null;
    void refreshCoins().then(()=>connectOnlineSocket(profile.name)).then((socket) => {
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
      const onDisconnect = () => {setConnected(false);setSearching(false);setQueuePlayers(0);};
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
      const onQueued = (data?:{players?:number;mode?:PublicQueueMode;entryFee?:number}) => {
        if((data?.mode&&data.mode!==queueMode)||(data?.entryFee!==undefined&&data.entryFee!==feeRef.current)){setSearching(false);setError("أنت في قائمة انتظار وضع آخر. ألغِ البحث الأول قبل البدء.");return;}
        setQueuePlayers(data?.players??1);
        setSearching(true);
        setError("");
      };
      const onSearchCancelled = () => { setSearching(false); setBotFallbackAvailable(false); };
      const onQueueTimeout = () => {
        setSearching(false);
        setBotFallbackAvailable(true);
        setError(queueMode==="solo"?t.opponentDisconnected:"لم يكتمل عدد اللاعبين. أعد البحث.");
      };
      const onFound = (data: MatchSnapshot) => {
        setSearching(false);
        setBotFallbackAvailable(false);
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
        setMatch((current) => current ? { ...current, phase: "results", teams:data.teams??current.teams } : current);
      };
      const onFinished = (data: { matchId: string; entryFee?:number;players: FinalPlayer[];teams?:RoomTeamScore[] }) => {
        setFinalPlayers(data.players);
        setMatch((current) => current ? { ...current, phase: "finished",teams:data.teams??current.teams } : current);
        if((data.entryFee??0)>0){void syncOnlineWallet(principalIdRef.current).catch(()=>setError(t.onlineUnavailable));return;}
        void creditVerifiedReward(data.matchId, data.players).catch((creditError: unknown) => {
          console.error("[online] Could not store reward receipt:", creditError);
          setError(t.onlineUnavailable);
        });
      };
      const onWalletReward = (data: { matchId: string;entryFee?:number;balance?:number; coinsAwarded: number }) => {
        if((data.entryFee??0)>0){if(Number.isSafeInteger(data.balance)&&data.balance!>=0)setOnlineCoins(data.balance!);void refreshCoins().catch(()=>{});return;}
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
      const onBalance=(data:{balance:number})=>{if(Number.isSafeInteger(data.balance)&&data.balance>=0){setOnlineCoins(data.balance);void refreshCoins().catch(()=>{});}};
      const onCancelled = (data: { reason?: string }) => {
        setSearching(false);
        setBotFallbackAvailable(false);
        setCountdown(null);
        setMatch(null);
        if(data.reason==="insufficient_online_coins"){setError("الرصيد غير كافٍ عند البداية. لم يُخصم الدخول من أي لاعب.");return;}
        translateServerError(data.reason === "ready_timeout" ? "ready_timeout" : "match_cancelled");
      };
      const onReconnecting = () => setError(t.reconnecting);
      const onServerError = (data: { code?: string }) => {if(data.code==="insufficient_online_coins")setError("رصيد العملات غير كافٍ لهذه القاعة. اختر مبلغاً أقل أو التدريب المجاني.");else if(data.code==="settlement_pending")setError("جارٍ تأكيد العملات. المبلغ محفوظ؛ لا تبدأ مباراة أخرى حتى تكتمل التسوية.");else if(data.code==="teams_require_four")setError("يتطلب وضع الفرق أربعة لاعبين، اثنين في كل فريق.");else if(data.code==="already_in_queue")setError("أنت في قائمة انتظار وضع آخر. ألغِ البحث الأول قبل البدء.");else if(data.code==="not_in_room")setError("يجب الانضمام إلى الغرفة أولاً.");else translateServerError(data.code ?? "connection_error");};

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
      socket.on("match:balance",onBalance);
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
        socket.off("match:balance",onBalance);
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
  }, [creditVerifiedReward, profile.name, queueMode, refreshCoins, syncOnlineWallet, t, translateServerError]);

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
    try { emit("room:create", privateRoomPayload(settings), response=>{
      if(isAck(response)&&!response.ok&&response.error==="invalid_settings"&&settings.teamMode==="duo"){
        setError("الخادم الحالي لا يقبل إعدادات 2 ضد 2. يلزم تحديث الخادم؛ يمكنك إنشاء غرفة «كل لاعب لنفسه» الآن.");
        return;
      }
      handleRoomAck(response);
    }); } catch {setError("اختر إعدادات صالحة: 2 أو 4 أو 6 أو 8 لاعبين، و3 أو 5 أو 7 جولات، و45 أو 60 أو 90 ثانية. الفرق تتطلب 4 لاعبين.");}
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
    if(match.mode==="random"&&match.phase==="match_found"){emit("match:decline",{matchId:match.matchId});return;}
    if(match.mode==="random"&&match.phase==="countdown"){setError("انتظر بداية الجولة، ثم يمكنك الانسحاب.");return;}
    if (match.mode === "private" && match.phase === "waiting") {
      emit("room:leave", { matchId: match.matchId });
      setMatch(null);
      setRoomCodeInput("");
      return;
    }
    if (["playing", "results", "countdown"].includes(match.phase)) {
      Alert.alert(t.forfeitMatch, t.forfeitMatch, [
        { text: t.cancel, style: "cancel" },
        { text: t.confirm, style: "destructive", onPress: () => emit(match.mode==="private"?"room:leave":"match:forfeit", { matchId: match.matchId }) },
      ]);
    }
  };

  const startNewMatch = () => {
    setBotFallbackAvailable(false);
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
    const next = { maxPlayers:currentSettings.maxPlayers,rounds:currentSettings.rounds,secondsPerRound:currentSettings.secondsPerRound,teamMode:currentSettings.teamMode??"solo", [key]: value };
    if(key==="teamMode"&&value==="duo")next.maxPlayers=4;
    if(key==="maxPlayers"&&value!==4)next.teamMode="solo";
    setSettings(next);
    if (match?.mode === "private" && match.phase === "waiting" && isHost && match.roomCode) {
      emit("room:update-settings", { roomCode: match.roomCode, settings: privateRoomPayload(next) });
    }
  };

  const renderTeamMode=(current:OnlineSettings)=><View style={{gap:8}}><Text style={[styles.settingLabel,{color:theme.textPrimary,textAlign:"right"}]}>طريقة اللعب</Text><View style={[styles.choiceRow,{flexDirection:"row-reverse"}]}>{(["solo","duo"] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:(current.teamMode??"solo")===value}} onPress={()=>updateSetting("teamMode",value)} style={[styles.choice,{flex:1,borderColor:(current.teamMode??"solo")===value?GOLD:theme.cardBorder,backgroundColor:theme.card}]}><Text style={{color:theme.textPrimary,fontFamily:"Cairo_700Bold"}}>{value==="duo"?"فريقان · 2 ضد 2":"كل لاعب لنفسه"}</Text></Pressable>)}</View>{current.teamMode==="duo"?<Text style={[styles.bodyText,{color:theme.textSecondary}]}>أربعة لاعبين · توزيع تلقائي متوازن · تُجمع نقاط كل زميلين</Text>:null}</View>;

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

  const ownTeam=match?.teams?.find(team=>team.playerIds.includes(principalId));
  const ownWinner=match?.settings.teamMode==="duo"?ownTeam?.rank===1&&!ownTeam.forfeited:finalPlayers?.find(player=>player.playerId===principalId)?.rank===1;
  const resultOutcome=match?.settings.teamMode==="duo"?rankedOutcome(ownTeam,match.teams??[]):rankedOutcome(finalPlayers?.find(player=>player.playerId===principalId),finalPlayers??[]);
  useResultSound(match?.phase==="finished"?match.matchId:null,resultOutcome);
  const pageTitle = match?.phase === "playing"
    ? `${t.round} ${match.round}/${match.totalRounds}`
    : match?.phase === "finished"
      ? t.onlineResult
      : (match?match.mode==="private":isPrivateRoomScreen) ? t.privateRooms : PUBLIC_MODE_COPY[match?.queueMode??queueMode][isRTL?"ar":"en"];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 12) }]}>
      <GameScreenBackground accent="online" />

      <GameHeader compact
        title={pageTitle}
        onBack={() => {
          if (match && match.phase !== "finished"){leaveCurrentMatch();return;}
          router.back();
        }}
        icon={isPrivateRoomScreen
          ? <Ionicons name="people-outline" size={23} color={CYAN} />
          : <GameIcon name="online" size={23} color={CYAN} />}
        trailing={
          <View style={{flexDirection:"row",alignItems:"center",gap:8}}>{match?.mode==="private"?<><RoomQuickChatButton socket={socketRef.current} matchId={match.matchId} connected={connected} history={match.messages}/><RoomVoiceChat socket={socketRef.current} matchId={match.matchId} connected={connected} players={match.players}/></>:null}{!match?<StatusBadge label={connected ? isRTL?"متصل":"Connected" : t.connectionError} tone={connected ? "success" : "warning"} />:null}</View>
        }
      />

      <KeyboardAwareScrollViewCompat contentContainerStyle={isPrivateRoomScreen ? styles.content : styles.publicQueueContent} keyboardShouldPersistTaps="handled" bottomOffset={30} showsVerticalScrollIndicator={false}>
        {roomPlayer?.abandoned&&match?.phase!=="finished"?<Text style={[styles.bodyText,{color:GOLD}]}>انسحبت من المباراة. يبقى الدخول محسوباً؛ انتظر نهايتها لتأكيد النتيجة.</Text>:null}
        {match&&match.settings.teamMode==="duo"&&match.teams?<RoomTeamBoard ownId={principalId} teams={match.teams} players={match.players} finished={match.phase==="finished"}/>:null}
        {match?.local?<Text style={[styles.bodyText,{color:theme.textSecondary}]}>معاينة محلية · عملات الأونلاين هنا تجريبية</Text>:null}
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
        {match?.botPractice ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: `${GOLD}88` }]}>
            <Text style={[styles.bodyText, { color: GOLD, textAlign: "center" }]}>لم نعثر على لاعب خلال 15 ثانية؛ هذه مباراة تدريب مجانية ضد خصم مؤقت. لا يوجد رهان أو مكافأة عملات.</Text>
          </View>
        ) : null}
        {botFallbackAvailable && !match && !isPrivateRoomScreen ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, gap: 10 }]}>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
              تدرب مجاناً ضد بوتات مؤقتة بأسماء عشوائية. لن يُخصم مبلغ الدخول، والبوتات لا تُسجّل في Supabase أو الترتيب.
            </Text>
            {renderButton("تدريب مجاني ضد البوتات", () => {
              setBotFallbackAvailable(false);
              router.push("/offline");
            }, { color: CYAN, icon: "hardware-chip-outline" })}
          </View>
        ) : null}

        {!connecting && !match && (
          <>
            <View style={[styles.hero, { backgroundColor: theme.card, borderColor: `${CYAN}55`,display:isPrivateRoomScreen?"flex":"none" }]}>
              {isPrivateRoomScreen
                ? <Ionicons name="people-outline" size={62} color={CYAN} />
                : <GameIllustration name="matchmaking" size={110} />}
              <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
                {isPrivateRoomScreen ? t.privateRooms : PUBLIC_MODE_COPY[queueMode][isRTL?"ar":"en"]}
              </Text>
              <Text style={[styles.bodyText, { color: theme.textSecondary }]}>
                {isPrivateRoomScreen ? t.privateRoomsInternetRequired : isRTL?PUBLIC_MODE_COPY[queueMode].description:t.onlineModeHint}
              </Text>
            </View>

            {isPrivateRoomScreen ? (
              <>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.createRoom}</Text>
                  <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{t.noMatchCoins}</Text>
                  {renderTeamMode(settings)}
                  <RoomSettingsSummary settings={settings} editable={connected} onSelect={(field,value)=>{if(field==="maxPlayers")updateSetting(field,value as 2|4|6|8);else if(field==="rounds")updateSetting(field,value as 3|5|7);else updateSetting(field,value as 45|60|90);}}/>
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
              <View style={isPrivateRoomScreen ? [styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }] : styles.publicEntryPanel}>
                <EntryFeePicker mode={queueMode} balance={onlineCoins} fee={entryFee} onSelect={setEntryFee} disabled={searching}/>
                {entryFee>0&&!entrySupported?<Text style={[styles.bodyText,{color:GOLD}]}>قاعات العملات تحتاج تحديث الخادم. التدريب المجاني متاح.</Text>:null}
                {entryFee>0&&onlineCoins!==null&&onlineCoins<entryFee?<Text style={[styles.bodyText,{color:GOLD}]}>رصيدك غير كافٍ لمبلغ الدخول المختار. اختر مبلغاً أقل أو التدريب المجاني.</Text>:null}
                {searching ? (
                  <View style={styles.searchingRow}>
                    <GameIllustration name="matchmaking" size={70} />
                    <Text style={[styles.bodyText, { color: CYAN, flex: 1 }]}>{queueMode==="solo"?t.searchingOpponent:(isRTL?"في انتظار اللاعبين":"Waiting for players")+" · "+queuePlayers+" / "+publicQueueSize(queueMode)}</Text>
                    {renderButton(t.cancelSearch, () => emit("match:cancel-search"), { color: "#FF738D" })}
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={queueMode==="solo"?t.findOpponent:isRTL?"ابحث عن لاعبين":"Find players"}
                    disabled={!connected||(entryFee>0&&(!entrySupported||onlineCoins===null||onlineCoins<entryFee))}
                    onPress={() => { setError(""); setBotFallbackAvailable(false); emit("match:find",{mode:queueMode,entryFee}); }}
                    style={styles.findPlayerPressable}
                  >
                    <RoyalSurface selected rounded style={styles.findPlayerSurface}>
                      <Ionicons name="sparkles" size={22} color="#F6D17B" />
                      <Text style={styles.findPlayerText}>{queueMode==="solo"?t.findOpponent:isRTL?"ابحث عن لاعبين":"Find players"}</Text>
                      <Ionicons name="sparkles" size={22} color="#F6D17B" />
                    </RoyalSurface>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" onPress={() => setEntryFee(0)} disabled={searching} style={styles.freePracticeLink}>
                  <Text style={[styles.bodyText, { color: theme.textSecondary }]}>أو تابع بتدريب مجاني دون رسوم</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {match?.phase === "match_found" && (
          <View style={[styles.card, styles.centerPanel, { backgroundColor: theme.card, borderColor: `${CYAN}66` }]}>
            <GameIllustration name="matchmaking" size={92} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{match.settings.maxPlayers===4?"اكتمل عدد اللاعبين":t.matchFound}</Text>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{(match.settings.entryFee??0)>0?"التأكيد يحجز "+match.settings.entryFee+" عملة من رصيد الأونلاين عند اكتمال استعداد الجميع. المجموع "+match.settings.entryFee!*match.settings.maxPlayers:t.readyToPlay}</Text>
            {(match.settings.maxPlayers===4?match.players:match.players.filter((player) => player.id !== principalId)).map((player) => (
              <Text key={player.id} style={[styles.opponentName, { color: CYAN }]}>{player.name}{player.id===principalId?" (أنت)":""}</Text>
            ))}
            {renderButton(roomPlayer?.ready ? t.waitingForPlayers : (match.settings.entryFee??0)>0?"أوافق وأستعد · "+match.settings.entryFee+" 🪙":t.ready, () => emit("match:ready", { matchId: match.matchId }), {
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
                    if (match.roomCode) {
                      const roomLink = Linking.createURL("/private-room", { queryParams: { roomCode: match.roomCode } });
                      const storeLink = "https://play.google.com/store/apps/details?id=com.huroofalmaghrib";
                      void Share.share({
                        title: "دعوة إلى غرفة حروف المغرب",
                        message: `انضم إلى غرفة الأصدقاء في حروف المغرب: ${roomLink}\nكود الغرفة: ${match.roomCode}\nإذا لم تكن اللعبة مثبتة، حمّلها من Google Play: ${storeLink}`,
                      });
                    }
                  }}
                  style={[styles.shareButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                >
                  <Ionicons name="share-social-outline" size={19} color={CYAN} />
                </Pressable>
              </View>
            </View>
            <RoomLobbyRoster players={match.players} ownId={principalId} capacity={match.settings.maxPlayers} onInvite={()=>{if(match.roomCode)router.push({pathname:"/friends",params:{roomCode:match.roomCode}});}}/>
            <Text style={[styles.bodyText,{color:theme.textSecondary}]}>{match.players.length} / {match.settings.maxPlayers} · {match.players.filter(p=>p.ready).length} مستعدون</Text>
            {isHost ? (
              <>
                {renderTeamMode(match.settings)}
                <RoomSettingsSummary settings={match.settings} editable={connected} onSelect={(field,value)=>{if(field==="maxPlayers")updateSetting(field,value as 2|4|6|8);else if(field==="rounds")updateSetting(field,value as 3|5|7);else updateSetting(field,value as 45|60|90);}}/>
                {renderButton(roomPlayer?.ready ? t.waitingForPlayers : t.ready, () => emit("room:ready", { matchId: match.matchId }), {
                  color: CYAN,
                  disabled: !connected,
                  icon: "checkmark-circle-outline",
                })}
                {renderButton(t.startMatch, () => emit("room:start", { matchId: match.matchId }), {
                  color: GREEN,
                  disabled: (match.settings.teamMode==="duo"&&match.players.length!==4) || match.players.length < 2 || !match.players.every((player) => player.ready && player.connected),
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

        {isPlaying && match && <View style={{gap:12}}>

          {match.settings.teamMode!=="duo"?<MatchRoster players={match.players} ownId={principalId}/>:null}
          <View style={{gap:7}}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={[styles.timerText,{color:secondsLeft<=10?"#FF8798":CYAN}]}>{secondsLeft}s</Text><Text style={[styles.bodyText,{color:theme.textSecondary}]}>{t.round} {match.round} / {match.totalRounds}</Text></View><View style={{height:8,borderRadius:8,overflow:"hidden",backgroundColor:theme.card}}><View style={{height:"100%",width:`${Math.max(0,Math.min(1,secondsLeft/match.settings.secondsPerRound))*100}%`,backgroundColor:secondsLeft<=10?"#FF8798":CYAN}}/></View></View>
          <View style={[styles.gameMeta,{justifyContent:"center",gap:14}]}><Text style={[styles.settingLabel,{color:theme.textSecondary}]}>{t.currentLetter}</Text><View style={[styles.letterBadge,{borderColor:CYAN,backgroundColor:theme.card}]}><Text style={styles.letterText}>{match.letter}</Text></View></View>
          <AnswerSheet answers={answers} onChange={(category,value)=>setAnswers(current=>({...current,[category]:value}))} onSubmit={submitAnswers} disabled={submitted||!connected||secondsLeft<=0}/>
          {renderButton(submitted?t.waitingForPlayers:t.submit,submitAnswers,{disabled:submitted||!connected||secondsLeft<=0,color:CYAN})}
          {match.mode==="random"?renderButton(t.forfeitMatch,leaveCurrentMatch,{color:"#5D314C"}):null}
        </View>}

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

            {match.mode==="random"?<PostMatchAdPrompt key={match.matchId} matchId={match.matchId} recoveryMatchId={resultOutcome==="lose"?match.matchId:undefined} entryFee={match.settings.entryFee??0} outcome={resultOutcome}/>:null}
            <View style={styles.onlineResultHero}>
              <GameIllustration
                name={ownWinner ? "victory" : "defeat"}
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
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { width: "100%", maxWidth: 760, alignSelf: "center", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backButton: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pageTitle: { flex: 1, fontSize: 20, fontWeight: "800", textAlign: "center" },
  connectionPill: { minHeight: 36, borderWidth: 2, borderRadius: 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  content: { padding: 12, paddingBottom: 36, gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" },
  publicQueueContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 36, gap: 12, width: "100%", maxWidth: 760, alignSelf: "center" },
  publicEntryPanel: { width: "100%", gap: 9 },
  findPlayerPressable: { width: "100%", minHeight: 76, borderRadius: 22, shadowColor: "#19D5CB", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.48, shadowRadius: 18, elevation: 8 },
  findPlayerSurface: { minHeight: 76, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 18 },
  findPlayerText: { color: "#FFF0D6", fontFamily: "Cairo_700Bold", fontSize: 23, textAlign: "center", flexShrink: 1 },
  freePracticeLink: { minHeight: 36, alignItems: "center", justifyContent: "center", paddingVertical: 5 },
  hero: { alignItems: "center", padding: 22, borderWidth: 2, borderRadius: 22, gap: 8 },
  heroIcon: { width: 56, height: 56, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: `${CYAN}20` },
  heroTitle: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  bodyText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 14 },
  sectionTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  settingGroup: { gap: 8 },
  settingLabel: { fontSize: 14, fontWeight: "700" },
  choiceRow: { flexDirection: "row", flexWrap:"wrap", gap: 8 },
  choice: { minWidth: 48, minHeight: 44, paddingHorizontal: 12, borderWidth: 2, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 50, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  buttonText: { color: "#071A17", fontSize: 15, fontWeight: "800", textAlign: "center" },
  divider: { height: 1, backgroundColor: "#D7D1CC", marginVertical: 2 },
  joinRow: { alignItems: "center", flexWrap:"wrap", gap: 8 },
  roomInput: { flex: 1, minWidth:120, minHeight: 48, borderWidth: 2, borderRadius: 4, paddingHorizontal: 12, fontSize: 16, letterSpacing: 2, fontWeight: "800" },
  errorBanner: { minHeight: 44, padding: 11, borderWidth: 1, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600" },
  searchingRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  centerPanel: { alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 30 },
  onlineResultHero: { alignItems: "center", justifyContent: "center", minHeight: 100 },
  opponentName: { fontSize: 20, fontWeight: "800" },
  lobbyHeader: { flexWrap:"wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  codeBadge: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 4, borderWidth: 2 },
  codeActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareButton: { width: 44, height: 44, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  codeText: { color: CYAN, fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  playerRow: { minHeight: 48, flexDirection: "row", flexWrap:"wrap", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  playerName: { flex: 1, minWidth:60, fontSize: 15, fontWeight: "700" },
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
