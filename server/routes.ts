import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import {
  createRoom,
  joinRoom,
  removePlayer,
  startGame,
  submitAnswers,
  calculateRoundScores,
  nextRound,
  getRoom,
  resetRoom,
  findAvailableRoom,
  getActiveCategories,
  type PlayerAnswers,
  type WordCategoryId,
} from "./gameLogic";
import { validateWord, CATEGORY_MAP, getWordsForLetter, type WordCategory } from "./wordDatabase";
import { ARABIC_LETTERS } from "./gameLogic";
import { db } from "./db";
import { playerProfiles, dailySpins, winStreaks, tournaments, tournamentPlayers, tournamentMatches, friends, friendRequests, playerDailyTasks, playerAchievements, roomInvites, dailyTaskDefs, achievementDefs, coinGifts, seasons, clans, clanMembers, battlePassTiers, playerBattlePass } from "@shared/schema";
import { eq, and, desc, asc, or, ilike, ne, isNotNull, sql } from "drizzle-orm";
import cron from "node-cron";
import { sendPushNotification, sendDailyTaskReminders, sendStreakResetWarnings, sendSeasonEndingNotifications } from "./notifications";

// ── TASK POOL — larger random pool, 3 are picked per player per day ──────────
const TASK_POOL = [
  { key: "win_2",     titleAr: "اربح مباريتين",    descAr: "فُز بـ 2 مباريات اليوم",       icon: "🏆", target: 2,   type: "wins",   rewardCoins: 30,  rewardXp: 15 },
  { key: "win_3",     titleAr: "اربح 3 مباريات",   descAr: "فُز بـ 3 مباريات اليوم",       icon: "🏆", target: 3,   type: "wins",   rewardCoins: 50,  rewardXp: 0  },
  { key: "win_5",     titleAr: "اربح 5 مباريات",   descAr: "فُز بـ 5 مباريات اليوم",       icon: "🏆", target: 5,   type: "wins",   rewardCoins: 80,  rewardXp: 40 },
  { key: "play_3",    titleAr: "العب 3 مباريات",   descAr: "شارك في 3 مباريات اليوم",      icon: "🎮", target: 3,   type: "games",  rewardCoins: 20,  rewardXp: 10 },
  { key: "play_5",    titleAr: "العب 5 مباريات",   descAr: "شارك في 5 مباريات اليوم",      icon: "🎮", target: 5,   type: "games",  rewardCoins: 30,  rewardXp: 20 },
  { key: "play_10",   titleAr: "العب 10 مباريات",  descAr: "شارك في 10 مباريات اليوم",     icon: "🎮", target: 10,  type: "games",  rewardCoins: 60,  rewardXp: 40 },
  { key: "score_100", titleAr: "اكسب 100 نقطة",   descAr: "حصّل 100 نقطة في مبارياتك",   icon: "⭐", target: 100, type: "score",  rewardCoins: 25,  rewardXp: 15 },
  { key: "score_200", titleAr: "اكسب 200 نقطة",   descAr: "حصّل 200 نقطة في مبارياتك",   icon: "⭐", target: 200, type: "score",  rewardCoins: 40,  rewardXp: 30 },
  { key: "score_500", titleAr: "اكسب 500 نقطة",   descAr: "حصّل 500 نقطة في مبارياتك",   icon: "⭐", target: 500, type: "score",  rewardCoins: 80,  rewardXp: 60 },
  { key: "emoji_5",   titleAr: "أرسل 5 رموز",     descAr: "أرسل 5 رسائل سريعة اليوم",    icon: "😊", target: 5,   type: "emojis", rewardCoins: 20,  rewardXp: 10 },
  { key: "emoji_10",  titleAr: "أرسل 10 رموز",    descAr: "أرسل 10 رسائل سريعة اليوم",   icon: "😊", target: 10,  type: "emojis", rewardCoins: 35,  rewardXp: 20 },
];
const TASKS_PER_PLAYER = 3;
const DAILY_TASK_DEFS = TASK_POOL; // backward-compat alias

// ── ACHIEVEMENT DEFINITIONS ─────────────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { key: "first_win", titleAr: "أول انتصار", descAr: "فُز بأول مباراة لك", target: 1, type: "wins", rewardCoins: 50, rewardXp: 50, icon: "🥇" },
  { key: "win_10", titleAr: "10 انتصارات", descAr: "اربح 10 مباريات", target: 10, type: "wins", rewardCoins: 200, rewardXp: 100, icon: "🏆" },
  { key: "win_25", titleAr: "25 انتصاراً", descAr: "اربح 25 مباراة", target: 25, type: "wins", rewardCoins: 350, rewardXp: 200, icon: "🎖️" },
  { key: "win_50", titleAr: "50 انتصاراً", descAr: "اربح 50 مباراة", target: 50, type: "wins", rewardCoins: 500, rewardXp: 300, icon: "👑" },
  { key: "win_100", titleAr: "100 انتصار", descAr: "اربح 100 مباراة", target: 100, type: "wins", rewardCoins: 1000, rewardXp: 500, icon: "💎" },
  { key: "play_10", titleAr: "10 مباريات", descAr: "شارك في 10 مباريات", target: 10, type: "games", rewardCoins: 100, rewardXp: 50, icon: "🎮" },
  { key: "play_50", titleAr: "50 مباراة", descAr: "شارك في 50 مباراة", target: 50, type: "games", rewardCoins: 200, rewardXp: 120, icon: "🕹️" },
  { key: "play_100", titleAr: "100 مباراة", descAr: "شارك في 100 مباراة", target: 100, type: "games", rewardCoins: 300, rewardXp: 200, icon: "💯" },
  { key: "play_500", titleAr: "500 مباراة", descAr: "شارك في 500 مباراة", target: 500, type: "games", rewardCoins: 800, rewardXp: 400, icon: "🎯" },
  { key: "level_5", titleAr: "المستوى 5", descAr: "ابلغ المستوى الخامس", target: 5, type: "level", rewardCoins: 150, rewardXp: 0, icon: "⚡" },
  { key: "level_10", titleAr: "المستوى 10", descAr: "ابلغ المستوى العاشر", target: 10, type: "level", rewardCoins: 500, rewardXp: 0, icon: "🌟" },
  { key: "level_15", titleAr: "المستوى 15", descAr: "ابلغ المستوى الخامس عشر", target: 15, type: "level", rewardCoins: 750, rewardXp: 0, icon: "🔮" },
  { key: "level_20", titleAr: "المستوى 20", descAr: "ابلغ المستوى العشرين", target: 20, type: "level", rewardCoins: 1200, rewardXp: 0, icon: "🏰" },
  { key: "streak_3", titleAr: "3 انتصارات متتالية", descAr: "اربح 3 مباريات على التوالي", target: 3, type: "streak", rewardCoins: 100, rewardXp: 75, icon: "🔥" },
  { key: "streak_5", titleAr: "5 انتصارات متتالية", descAr: "اربح 5 مباريات على التوالي", target: 5, type: "streak", rewardCoins: 250, rewardXp: 150, icon: "⚡" },
  { key: "streak_10", titleAr: "10 انتصارات متتالية", descAr: "اربح 10 مباريات على التوالي", target: 10, type: "streak", rewardCoins: 500, rewardXp: 300, icon: "💥" },
  { key: "login_7", titleAr: "7 أيام متتالية", descAr: "سجل دخولك 7 أيام متتالية", target: 7, type: "login_streak", rewardCoins: 200, rewardXp: 100, icon: "📅" },
  { key: "login_30", titleAr: "30 يوم متتالي", descAr: "سجل دخولك 30 يوم متتالي", target: 30, type: "login_streak", rewardCoins: 1000, rewardXp: 500, icon: "🗓️" },
  { key: "score_5000", titleAr: "5000 نقطة", descAr: "اجمع 5000 نقطة إجمالية", target: 5000, type: "total_score", rewardCoins: 500, rewardXp: 250, icon: "⭐" },
  { key: "first_tournament", titleAr: "أول بطولة", descAr: "شارك في بطولة واحدة", target: 1, type: "tournaments", rewardCoins: 150, rewardXp: 100, icon: "🏟️" },
] as const;

// ── PLAYER ID & NAME GENERATION ─────────────────────────────────────────────
const RANDOM_NAME_WORDS = [
  "Lion", "Atlas", "Falcon", "Wolf", "Eagle", "Tiger", "Storm", "Blaze",
  "Cobra", "Shark", "Hawk", "Bear", "Fox", "Lynx", "Viper", "Phoenix",
  "Raven", "Drake", "Orion", "Zephyr", "Titan", "Nova", "Rex", "Ace",
];

function generatePlayerCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `WM-${num}`;
}

function generateRandomPlayerName(): string {
  const word = RANDOM_NAME_WORDS[Math.floor(Math.random() * RANDOM_NAME_WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}_${num}`;
}

async function ensurePlayerCode(playerId: string): Promise<string> {
  let code = generatePlayerCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles)
      .where(eq(playerProfiles.playerCode, code));
    if (existing.length === 0) break;
    code = generatePlayerCode();
    attempts++;
  }
  return code;
}

async function generateUniqueReferralCode(): Promise<string> {
  let code = "WM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  for (let attempt = 0; attempt < 10; attempt++) {
    const dup = await db.select({ id: playerProfiles.id }).from(playerProfiles).where(eq(playerProfiles.referralCode, code));
    if (dup.length === 0) break;
    code = "WM-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  return code;
}

async function ensureReferralCode(playerId: string): Promise<string> {
  const [existing] = await db.select({ referralCode: playerProfiles.referralCode }).from(playerProfiles).where(eq(playerProfiles.id, playerId));
  if (existing?.referralCode) return existing.referralCode;
  const code = await generateUniqueReferralCode();
  await db.update(playerProfiles).set({ referralCode: code }).where(eq(playerProfiles.id, playerId));
  return code;
}

async function generateUniquePlayerTag(): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tag = Math.floor(1000 + Math.random() * 9000);
    const existing = await db.select({ id: playerProfiles.id }).from(playerProfiles)
      .where(eq(playerProfiles.playerTag, tag)).limit(1);
    if (existing.length === 0) return tag;
  }
  return Math.floor(1000 + Math.random() * 9000);
}
function generatePlayerTag(): number {
  return Math.floor(1000 + Math.random() * 9000);
}

function pickDailyTasks(): typeof TASK_POOL {
  const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5);
  const picked: typeof TASK_POOL = [];
  const usedTypes = new Set<string>();
  for (const t of shuffled) {
    if (picked.length >= TASKS_PER_PLAYER) break;
    if (!usedTypes.has(t.type)) { picked.push(t); usedTypes.add(t.type); }
  }
  for (const t of shuffled) {
    if (picked.length >= TASKS_PER_PLAYER) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}

// ── SEED TASK & ACHIEVEMENT DEFINITIONS ─────────────────────────────────────
async function fixMissingPlayerCodes() {
  try {
    const missing = await db.select({ id: playerProfiles.id })
      .from(playerProfiles)
      .where(sql`player_code IS NULL OR player_tag IS NULL`);
    if (missing.length === 0) return;
    console.log(`[fix] Assigning playerCode/playerTag to ${missing.length} players...`);
    for (const { id } of missing) {
      const updates: Record<string, unknown> = {};
      updates.playerCode = await ensurePlayerCode(id);
      updates.playerTag = await generateUniquePlayerTag();
      await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, id));
    }
    console.log(`[fix] Done assigning codes to ${missing.length} players.`);
  } catch (e) {
    console.error("[fix] Failed to fix missing player codes:", e);
  }
}

async function seedTaskAndAchievementDefs() {
  try {
    const existingTasks = await db.select().from(dailyTaskDefs);
    if (existingTasks.length === 0) {
      await db.insert(dailyTaskDefs).values([
        { key: "win_3",     titleAr: "اربح 3 مباريات",  descAr: "فُز بـ 3 مباريات اليوم",              icon: "🏆", target: 3,   type: "wins",  rewardCoins: 50, rewardXp: 0  },
        { key: "play_5",    titleAr: "العب 5 مباريات",   descAr: "شارك في 5 مباريات اليوم",              icon: "🎮", target: 5,   type: "games", rewardCoins: 30, rewardXp: 20 },
        { key: "score_200", titleAr: "اكسب 200 نقطة",   descAr: "حصّل 200 نقطة في مبارياتك",           icon: "⭐", target: 200, type: "score", rewardCoins: 40, rewardXp: 30 },
      ]);
      console.log("[seed] Inserted default daily task definitions");
    }

    const existingAch = await db.select().from(achievementDefs);
    if (existingAch.length === 0) {
      await db.insert(achievementDefs).values([
        { key: "first_win", titleAr: "أول انتصار",            descAr: "فُز بأول مباراة لك",         icon: "🥇", target: 1,   type: "wins",   rewardCoins: 50,  rewardXp: 50  },
        { key: "win_10",    titleAr: "10 انتصارات",           descAr: "اربح 10 مباريات",             icon: "🏆", target: 10,  type: "wins",   rewardCoins: 200, rewardXp: 100 },
        { key: "win_50",    titleAr: "50 انتصاراً",           descAr: "اربح 50 مباراة",              icon: "👑", target: 50,  type: "wins",   rewardCoins: 500, rewardXp: 300 },
        { key: "play_10",   titleAr: "10 مباريات",            descAr: "شارك في 10 مباريات",          icon: "🎮", target: 10,  type: "games",  rewardCoins: 100, rewardXp: 50  },
        { key: "play_100",  titleAr: "100 مباراة",            descAr: "شارك في 100 مباراة",          icon: "💯", target: 100, type: "games",  rewardCoins: 300, rewardXp: 200 },
        { key: "level_5",   titleAr: "المستوى 5",             descAr: "ابلغ المستوى الخامس",         icon: "⚡", target: 5,   type: "level",  rewardCoins: 150, rewardXp: 0   },
        { key: "level_10",  titleAr: "المستوى 10",            descAr: "ابلغ المستوى العاشر",         icon: "🌟", target: 10,  type: "level",  rewardCoins: 500, rewardXp: 0   },
        { key: "streak_3",  titleAr: "3 انتصارات متتالية",   descAr: "اربح 3 مباريات على التوالي", icon: "🔥", target: 3,   type: "streak", rewardCoins: 100, rewardXp: 75  },
      ]);
      console.log("[seed] Inserted default achievement definitions");
    }
  } catch (e) {
    console.error("[seed] Failed to seed task/achievement definitions:", e);
  }
}

// Track which room each socket is currently in
const socketRoomMap = new Map<string, string>();
  const socketPlayerIdMap = new Map<string, string>();

const MIN_PLAYERS = 2;

// ── RAPID MODE ─────────────────────────────────────────────────────────
const RAPID_CATEGORIES = ["girlName", "boyName", "animal", "fruit", "vegetable", "object", "city", "country"];
const RAPID_ROUND_TIME = 10;
const RAPID_TOTAL_ROUNDS = 5;
const RAPID_COINS_WIN = 15;
const RAPID_COINS_LOSE = 5;
const RAPID_XP_WIN = 30;
const RAPID_XP_LOSE = 10;

type RapidQueueEntry = { id: string; name: string; skin: string; playerId?: string };
let rapidQueue: RapidQueueEntry[] = [];

type RapidRoom = {
  id: string;
  players: { socketId: string; name: string; skin: string; playerId?: string }[];
  scores: Record<string, number>;
  currentRound: number;
  currentLetter: string;
  currentCategory: string;
  roundTimer: ReturnType<typeof setTimeout> | null;
  roundWon: boolean;
  lastAttempts: Record<string, string>;
  letterQueue: string[];
  letterIndex: number;
};

const rapidRooms = new Map<string, RapidRoom>();

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextRapidLetter(room: RapidRoom): string {
  if (room.letterIndex >= room.letterQueue.length) {
    room.letterQueue = shuffleArr(ARABIC_LETTERS);
    room.letterIndex = 0;
  }
  return room.letterQueue[room.letterIndex++];
}

function pickRapidCategory(usedCategories: string[] = []): string {
  const available = RAPID_CATEGORIES.filter((c) => !usedCategories.includes(c));
  const pool = available.length > 0 ? available : RAPID_CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}
// ────────────────────────────────────────────────────────────────────────

// ── TOURNAMENT MODE ──────────────────────────────────────────────────
const TOURNAMENT_SIZE = 8;
const TOURNAMENT_ENTRY_FEE = 100;
const TOURNAMENT_PRIZES = { 1: 500, 2: 200, 3: 100 };
const TOURNAMENT_XP = { 1: 150, 2: 75, 3: 50 };

// Returns ordered round names from first round → final for a given player count.
// 4 players:  ["semi", "final"]
// 8 players:  ["quarter", "semi", "final"]
// 16 players: ["round1", "quarter", "semi", "final"]
function getTournamentRounds(maxPlayers: number): string[] {
  if (maxPlayers === 4) return ["semi", "final"];
  if (maxPlayers === 16) return ["round1", "quarter", "semi", "final"];
  return ["quarter", "semi", "final"];
}

type ActiveTournament = {
  id: string;
  maxPlayers: number;
  players: { playerId: string; socketId: string; name: string; skin: string; eliminated: boolean }[];
  matches: {
    id: string;
    roundName: string;
    matchIndex: number;
    player1Id: string | null;
    player1Name: string | null;
    player2Id: string | null;
    player2Name: string | null;
    winnerId: string | null;
    winnerName: string | null;
    roomId: string | null;
    status: string;
  }[];
  currentRound: string;
  status: string;
};

const activeTournaments = new Map<string, ActiveTournament>();
const playerTournamentMap = new Map<string, string>();
const roomTournamentMap = new Map<string, { tournamentId: string; matchId: string }>();
const tournamentPlayerSocketMap = new Map<string, string>();

function generateTournamentBracket(tournamentId: string, players: { playerId: string; name: string }[], maxPlayers: number = 8): ActiveTournament["matches"] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const rounds = getTournamentRounds(maxPlayers);
  const matches: ActiveTournament["matches"] = [];

  for (let r = 0; r < rounds.length; r++) {
    const roundName = rounds[r];
    const matchCount = maxPlayers / Math.pow(2, r + 1);
    const isFirstRound = r === 0;
    const prefix = roundName === "final" ? "f" : roundName === "semi" ? "s" : roundName === "quarter" ? "q" : "r";

    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `${tournamentId}_${prefix}${i}`,
        roundName,
        matchIndex: i,
        player1Id: isFirstRound ? (shuffled[i * 2]?.playerId || null) : null,
        player1Name: isFirstRound ? (shuffled[i * 2]?.name || null) : null,
        player2Id: isFirstRound ? (shuffled[i * 2 + 1]?.playerId || null) : null,
        player2Name: isFirstRound ? (shuffled[i * 2 + 1]?.name || null) : null,
        winnerId: null,
        winnerName: null,
        roomId: null,
        status: "pending",
      });
    }
  }

  return matches;
}

function advanceTournamentWinner(tournament: ActiveTournament, matchId: string, winnerId: string, winnerName: string) {
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;
  match.winnerId = winnerId;
  match.winnerName = winnerName;
  match.status = "completed";

  const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
  if (loserId) {
    const loserPlayer = tournament.players.find(p => p.playerId === loserId);
    if (loserPlayer) loserPlayer.eliminated = true;
  }

  const rounds = getTournamentRounds(tournament.maxPlayers);
  const currentRoundIdx = rounds.indexOf(match.roundName);

  if (match.roundName === "final") {
    tournament.status = "completed";
    tournament.currentRound = "completed";
  } else if (currentRoundIdx >= 0 && currentRoundIdx < rounds.length - 1) {
    const nextRoundName = rounds[currentRoundIdx + 1];
    const nextMatchIndex = Math.floor(match.matchIndex / 2);
    const nextMatch = tournament.matches.find(m => m.roundName === nextRoundName && m.matchIndex === nextMatchIndex);
    if (nextMatch) {
      if (match.matchIndex % 2 === 0) {
        nextMatch.player1Id = winnerId;
        nextMatch.player1Name = winnerName;
      } else {
        nextMatch.player2Id = winnerId;
        nextMatch.player2Name = winnerName;
      }
    }
  }

  const currentRoundMatches = tournament.matches.filter(m => m.roundName === tournament.currentRound);
  const allDone = currentRoundMatches.every(m => m.status === "completed");
  if (allDone && tournament.status !== "completed") {
    const currentIdx = rounds.indexOf(tournament.currentRound);
    if (currentIdx >= 0 && currentIdx < rounds.length - 1) {
      tournament.currentRound = rounds[currentIdx + 1];
    }
  }
}
async function handleTournamentMatchResult(
  io: SocketIOServer,
  tournamentId: string,
  matchId: string,
  winnerId: string,
  winnerName: string,
) {
  const active = activeTournaments.get(tournamentId);
  if (!active) return;

  const match = active.matches.find(m => m.id === matchId);
  if (!match || match.status === "completed") return;
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) return;

  advanceTournamentWinner(active, matchId, winnerId, winnerName);

  await db.update(tournamentMatches).set({
    winnerId,
    winnerName,
    status: "completed",
    completedAt: new Date(),
  }).where(eq(tournamentMatches.id, matchId)).catch(() => {});

  if (match.roundName === "quarter" || match.roundName === "semi") {
    const nextRoundName = match.roundName === "quarter" ? "semi" : "final";
    const nextIdx = match.roundName === "quarter" ? Math.floor(match.matchIndex / 2) : 0;
    const slot = match.roundName === "quarter" ? (match.matchIndex % 2 === 0 ? "player1" : "player2") : (match.matchIndex === 0 ? "player1" : "player2");
    const nextMatch = active.matches.find(m => m.roundName === nextRoundName && m.matchIndex === nextIdx);
    if (nextMatch) {
      const p1Update = slot === "player1" ? { player1Id: winnerId, player1Name: winnerName } : {};
      const p2Update = slot === "player2" ? { player2Id: winnerId, player2Name: winnerName } : {};
      await db.update(tournamentMatches).set({ ...p1Update, ...p2Update }).where(eq(tournamentMatches.id, nextMatch.id)).catch(() => {});
    }
  }

  if (active.status === "completed") {
    await db.update(tournaments).set({
      status: "completed",
      winnerId,
      winnerName,
      completedAt: new Date(),
    }).where(eq(tournaments.id, tournamentId)).catch(() => {});

    const finalMatch = active.matches.find(m => m.roundName === "final");
    const finalLoserId = finalMatch ? (finalMatch.player1Id === winnerId ? finalMatch.player2Id : finalMatch.player1Id) : null;
    const semiLosers = active.matches
      .filter(m => m.roundName === "semi" && m.winnerId)
      .map(m => m.player1Id === m.winnerId ? m.player2Id : m.player1Id)
      .filter(Boolean) as string[];

    const placements: { pid: string; rank: 1 | 2 | 3 }[] = [
      { pid: winnerId, rank: 1 },
    ];
    if (finalLoserId) placements.push({ pid: finalLoserId, rank: 2 });
    for (const sl of semiLosers) {
      if (sl !== winnerId && sl !== finalLoserId) {
        placements.push({ pid: sl, rank: 3 });
      }
    }

    for (const { pid, rank } of placements) {
      const prize = TOURNAMENT_PRIZES[rank] || 0;
      const xp = TOURNAMENT_XP[rank] || 0;
      try {
        const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, pid));
        if (profile) {
          await db.update(playerProfiles).set({
            coins: profile.coins + prize,
            xp: profile.xp + xp,
            level: Math.floor((profile.xp + xp) / 100) + 1,
            updatedAt: new Date(),
          }).where(eq(playerProfiles.id, pid));
        }
      } catch {}
      await db.update(tournamentPlayers).set({ placement: rank }).where(
        and(eq(tournamentPlayers.tournamentId, tournamentId), eq(tournamentPlayers.playerId, pid))
      ).catch(() => {});
    }

    for (const p of active.players) {
      playerTournamentMap.delete(p.playerId);
      tournamentPlayerSocketMap.delete(p.playerId);
    }
    activeTournaments.delete(tournamentId);
  } else {
    const readyMatches = active.matches.filter(
      m => m.roundName === active.currentRound && m.status === "pending" && m.player1Id && m.player2Id
    );
    if (readyMatches.length > 0) {
      setTimeout(() => startTournamentRoundMatches(io, active), 5000);
    }
  }

  io.emit("tournament_update", {
    tournamentId,
    matches: active.matches,
    currentRound: active.currentRound,
    status: active.status,
    winnerId: active.status === "completed" ? winnerId : null,
    winnerName: active.status === "completed" ? winnerName : null,
  });
}

function startTournamentRoundMatches(
  io: SocketIOServer,
  tournament: ActiveTournament,
) {
  const roundMatches = tournament.matches.filter(
    m => m.roundName === tournament.currentRound && m.status === "pending" && m.player1Id && m.player2Id
  );

  for (const match of roundMatches) {
    const p1 = tournament.players.find(p => p.playerId === match.player1Id);
    const p2 = tournament.players.find(p => p.playerId === match.player2Id);
    if (!p1 || !p2) continue;

    const room = createRoom(p1.socketId, p1.name, p1.skin);
    joinRoom(room.id, p2.socketId, p2.name, p2.skin);
    match.roomId = room.id;
    match.status = "in_progress";

    roomTournamentMap.set(room.id, { tournamentId: tournament.id, matchId: match.id });

    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    if (s1) { s1.join(room.id); socketRoomMap.set(p1.socketId, room.id); }
    if (s2) { s2.join(room.id); socketRoomMap.set(p2.socketId, room.id); }

    const roomPlayers = room.players.map(p => ({ id: p.id, name: p.name, skin: p.skin }));
    emitCountdownThenStart(io, room.id, roomPlayers, () => {
      clearHintsForRoom(room.id);
      const gameResult = startGame(room.id);
      if (!gameResult.success || !gameResult.room) return;
      const gameData = {
        roomId: room.id,
        letter: gameResult.room.currentLetter,
        round: gameResult.room.currentRound,
        totalRounds: gameResult.room.totalRounds,
        players: gameResult.room.players.map(p => ({ id: p.id, name: p.name, skin: p.skin })),
        coinEntry: 0,
        tournamentId: tournament.id,
        tournamentRound: match.roundName,
        wordCategory: gameResult.room.wordCategory || "general",
      };
      io.to(room.id).emit("matchFound", gameData);
      gameResult.room.timer = setTimeout(() => {
        const results = calculateRoundScores(room.id);
        const updatedRoom = getRoom(room.id);
        if (!updatedRoom) return;
        io.to(room.id).emit("round_results", {
          results,
          round: updatedRoom.currentRound,
          totalRounds: updatedRoom.totalRounds,
          players: updatedRoom.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
        });
      }, 51000);
    });
  }
}
// ────────────────────────────────────────────────────────────────────────

// Countdown then emit game_started — used by both join_room and findMatch flows
function emitCountdownThenStart(
  io: SocketIOServer,
  roomId: string,
  players: { id: string; name: string; skin: string }[],
  onStart: () => void
) {
  let count = 3;
  io.to(roomId).emit("countdown", { count, players });
  const tick = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(tick);
      onStart();
    } else {
      io.to(roomId).emit("countdown", { count, players });
    }
  }, 1000);
}

// Global matchmaking queue
type QueueEntry = { id: string; name: string; skin: string; coinEntry?: number; playerId?: string };
let matchmakingQueue: QueueEntry[] = [];

const COIN_ENTRY_OPTIONS = [
  { entry: 50, reward: 100 },
  { entry: 100, reward: 200 },
  { entry: 500, reward: 1000 },
  { entry: 1000, reward: 2500 },
];

const SPIN_REWARDS = [
  { type: "coins" as const,     amount: 50,  label: "50 عملة",   weight: 25 },
  { type: "coins" as const,     amount: 100, label: "100 عملة",  weight: 18 },
  { type: "coins" as const,     amount: 200, label: "200 عملة",  weight: 10 },
  { type: "coins" as const,     amount: 500, label: "500 عملة",  weight: 3  },
  { type: "xp" as const,        amount: 100, label: "100 XP",    weight: 20 },
  { type: "xp" as const,        amount: 200, label: "200 XP",    weight: 10 },
  { type: "powerCard" as const, amount: 1,   label: "بطاقة قوة", weight: 14 },
];

const STREAK_MILESTONES = [
  { wins: 3, reward: 50 },
  { wins: 5, reward: 100 },
  { wins: 10, reward: 300 },
];

function pickSpinReward() {
  const totalWeight = SPIN_REWARDS.reduce((s, r) => s + r.weight, 0);
  let rnd = Math.random() * totalWeight;
  for (const reward of SPIN_REWARDS) {
    rnd -= reward.weight;
    if (rnd <= 0) return reward;
  }
  return SPIN_REWARDS[0];
}

const roomCoinEntries = new Map<string, number>();
const roomPendingDeductions = new Map<string, string[]>();

// ── RANKED SEASON HELPERS ─────────────────────────────────────────────────────

function calcDivision(elo: number): string {
  if (elo < 800)  return "bronze";
  if (elo < 1100) return "silver";
  if (elo < 1400) return "gold";
  if (elo < 1700) return "platinum";
  return "diamond";
}

function calcElo(
  winnerElo: number,
  loserElo: number,
  K = 32
): { winner: number; loser: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const newWinner = Math.round(winnerElo + K * (1 - expectedWinner));
  const newLoser  = Math.max(100, Math.round(loserElo  + K * (0 - (1 - expectedWinner))));
  return { winner: newWinner, loser: newLoser };
}

async function seedCurrentSeason() {
  try {
    const existing = await db.select().from(seasons)
      .where(eq(seasons.status, "active")).limit(1);
    if (existing.length > 0) return;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const name = `موسم ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    await db.insert(seasons).values({ name, startDate: now, endDate, status: "active" });
    console.log(`[ranked] Seeded new season: ${name}`);
  } catch (e) {
    console.error("[ranked] seedCurrentSeason error:", e);
  }
}

async function handleSeasonEnd() {
  try {
    const activeSeason = await db.select().from(seasons)
      .where(eq(seasons.status, "active")).limit(1);
    if (!activeSeason.length) return;
    const season = activeSeason[0];
    if (new Date(season.endDate) > new Date()) return;

    console.log(`[ranked] Season ${season.name} ended — distributing rewards...`);

    const DIVISION_REWARDS: Record<string, { coins: number; title: string | null }> = {
      diamond:  { coins: 1000, title: "morocco_legend" },
      platinum: { coins: 600,  title: "champion_title" },
      gold:     { coins: 350,  title: "letter_king" },
      silver:   { coins: 150,  title: "word_master" },
      bronze:   { coins: 50,   title: null },
    };

    const players = await db.select({
      id: playerProfiles.id,
      division: playerProfiles.division,
      peakElo: playerProfiles.peakElo,
      ownedTitles: playerProfiles.ownedTitles,
    }).from(playerProfiles);

    for (const p of players) {
      const reward = DIVISION_REWARDS[p.division ?? "bronze"] ?? DIVISION_REWARDS.bronze;
      const newElo = Math.max(800, Math.floor((p.peakElo ?? 1000) * 0.75));
      const newDivision = calcDivision(newElo);
      const currentTitles: string[] = Array.isArray(p.ownedTitles) ? (p.ownedTitles as string[]) : [];
      const newTitles: string[] = reward.title && !currentTitles.includes(reward.title)
        ? [...currentTitles, reward.title]
        : currentTitles;
      await db.update(playerProfiles).set({
        coins: sql`coins + ${reward.coins}`,
        elo: newElo,
        division: newDivision,
        peakElo: newElo,
        seasonWins: 0,
        seasonLosses: 0,
        ownedTitles: newTitles,
        updatedAt: new Date(),
      }).where(eq(playerProfiles.id, p.id));
    }

    await db.update(seasons).set({ status: "completed" }).where(eq(seasons.id, season.id));

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const name = `موسم ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const [newSeason] = await db.insert(seasons).values({ name, startDate: now, endDate, status: "active" }).returning({ id: seasons.id });
    console.log(`[ranked] New season created: ${name}`);
    if (newSeason?.id) {
      // Note: seedBattlePassTiers is defined later in the file but hoisted as a named async function
      seedBattlePassTiers(newSeason.id).catch((e) => console.error("[battle-pass] season rollover seed error:", e));
    }
  } catch (e) {
    console.error("[ranked] handleSeasonEnd error:", e);
  }
}

// ── BATTLE PASS: 30-tier seed per season ─────────────────────────────────────

const BP_XP_PER_TIER = 500; // XP needed per tier
const BP_PREMIUM_COST = 1000;
const BP_XP_WIN = 20;
const BP_XP_GAME = 10;

// 30 tiers definition
const BP_TIER_DEFS: Array<{
  freeRewardType: string; freeRewardId: string | null; freeRewardAmount: number;
  premiumRewardType: string; premiumRewardId: string | null; premiumRewardAmount: number;
}> = [
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 50,   premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 100  },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 1,    premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 150  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 75,   premiumRewardType: "skin",      premiumRewardId: "djellaba",   premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 100,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 200  },
  { freeRewardType: "powerCard", freeRewardId: "freeze",      freeRewardAmount: 1,    premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 250  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 100,  premiumRewardType: "powerCard", premiumRewardId: "time",       premiumRewardAmount: 2    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 125,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 300  },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 2,    premiumRewardType: "skin",      premiumRewardId: "sport",      premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 150,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 350  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 150,  premiumRewardType: "title",     premiumRewardId: "eloquent",   premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 200,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 400  },
  { freeRewardType: "powerCard", freeRewardId: "freeze",      freeRewardAmount: 2,    premiumRewardType: "powerCard", premiumRewardId: "hint",       premiumRewardAmount: 3    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 200,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 450  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 225,  premiumRewardType: "skin",      premiumRewardId: "kaftan",     premiumRewardAmount: 0    },
  { freeRewardType: "powerCard", freeRewardId: "time",        freeRewardAmount: 2,    premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 500  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 250,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 550  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 250,  premiumRewardType: "powerCard", premiumRewardId: "freeze",     premiumRewardAmount: 3    },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 3,    premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 600  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 300,  premiumRewardType: "skin",      premiumRewardId: "ninja",      premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 300,  premiumRewardType: "title",     premiumRewardId: "lightning",  premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 350,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 700  },
  { freeRewardType: "powerCard", freeRewardId: "time",        freeRewardAmount: 3,    premiumRewardType: "powerCard", premiumRewardId: "time",       premiumRewardAmount: 3    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 400,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 750  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 400,  premiumRewardType: "skin",      premiumRewardId: "sahrawi",    premiumRewardAmount: 0    },
  { freeRewardType: "powerCard", freeRewardId: "freeze",      freeRewardAmount: 3,    premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 800  },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 450,  premiumRewardType: "title",     premiumRewardId: "word_master",premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 500,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 900  },
  { freeRewardType: "powerCard", freeRewardId: "hint",        freeRewardAmount: 3,    premiumRewardType: "skin",      premiumRewardId: "hacker",     premiumRewardAmount: 0    },
  { freeRewardType: "coins",     freeRewardId: null,          freeRewardAmount: 500,  premiumRewardType: "coins",     premiumRewardId: null,         premiumRewardAmount: 1000 },
  { freeRewardType: "skin",      freeRewardId: "champion",    freeRewardAmount: 0,    premiumRewardType: "title",     premiumRewardId: "letter_king",premiumRewardAmount: 0    },
];

async function seedBattlePassTiers(seasonId: string) {
  try {
    const existing = await db.select({ id: battlePassTiers.id }).from(battlePassTiers).where(eq(battlePassTiers.seasonId, seasonId)).limit(1);
    if (existing.length > 0) return;
    const rows = BP_TIER_DEFS.map((def, i) => ({
      seasonId,
      tier: i + 1,
      ...def,
    }));
    await db.insert(battlePassTiers).values(rows);
    console.log(`[battle-pass] Seeded 30 tiers for season ${seasonId}`);
  } catch (e) {
    console.error("[battle-pass] seedBattlePassTiers error:", e);
  }
}

async function getOrCreatePlayerBattlePass(playerId: string, seasonId: string) {
  const [existing] = await db.select().from(playerBattlePass)
    .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, seasonId))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(playerBattlePass).values({
    playerId, seasonId, passXp: 0, currentTier: 0, premiumUnlocked: false, claimedTiers: [],
  }).returning();
  return created;
}

async function awardBattlePassXp(playerId: string, xpAmount: number) {
  try {
    const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
    if (!activeSeason) return;
    const pass = await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
    const newXp = pass.passXp + xpAmount;
    const newTier = Math.min(30, Math.floor(newXp / BP_XP_PER_TIER));
    await db.update(playerBattlePass).set({
      passXp: newXp,
      currentTier: Math.max(pass.currentTier, newTier),
      updatedAt: new Date(),
    }).where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id)));
  } catch (e) {
    console.error("[battle-pass] awardBattlePassXp error:", e);
  }
}

// ── CLAN WAR: weekly reward distribution & score reset ────────────────────────
async function handleClanWarWeeklyEnd() {
  try {
    // Rank clans by totalWarScore
    const allClans = await db.select().from(clans).orderBy(desc(clans.totalWarScore));
    if (allClans.length === 0) return;

    const rewardsByRank: Record<number, number> = { 1: 300, 2: 150, 3: 75 };

    for (let i = 0; i < allClans.length; i++) {
      const clan = allClans[i];
      const rank = i + 1;
      const rewardPerMember = rewardsByRank[rank] ?? 0;

      const members = await db.select({ playerId: clanMembers.playerId }).from(clanMembers).where(eq(clanMembers.clanId, clan.id));

      if (rewardPerMember > 0) {
        for (const m of members) {
          const [prof] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq(playerProfiles.id, m.playerId)).limit(1);
          if (prof) {
            await db.update(playerProfiles).set({ coins: prof.coins + rewardPerMember, updatedAt: new Date() }).where(eq(playerProfiles.id, m.playerId));
          }
        }
      }

      // Reset war scores for all members
      await db.update(clanMembers).set({ warScore: 0 }).where(eq(clanMembers.clanId, clan.id));
      await db.update(clans).set({ totalWarScore: 0 }).where(eq(clans.id, clan.id));
    }

    console.log(`[clan-war] Weekly rewards distributed to top ${Math.min(allClans.length, 3)} clans`);
  } catch (e) {
    console.error("[clan-war] handleClanWarWeeklyEnd error:", e);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // On startup: seed static definitions and fix any players missing playerCode
  seedTaskAndAchievementDefs();
  fixMissingPlayerCodes();
  await seedCurrentSeason().catch(console.error);
  // Seed battle pass tiers for the current active season
  (async () => {
    try {
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (activeSeason) await seedBattlePassTiers(activeSeason.id);
    } catch (e) { console.error("[battle-pass] startup seed error:", e); }
  })();

  // REST endpoint: validate all answers for one round (used by offline mode)
  // POST /api/validate-round
  // Body: { letter: string, answers: Record<gameCategory, string>[] }
  // Returns: { results: { category, word, valid, reason }[] }[]
  // GET /api/words?letter=X — return all word-database words for that letter, per game category.
  // Used exclusively by the local AI-vs-player mode (no socket, no game state modified).
  app.get("/api/words", (req, res) => {
    const letter = req.query.letter as string | undefined;
    if (!letter) return res.status(400).json({ error: "letter required" });
    const result: Record<string, string[]> = {};
    for (const [gameKey, dbCategory] of Object.entries(CATEGORY_MAP)) {
      result[gameKey] = getWordsForLetter(dbCategory as WordCategory, letter);
    }
    return res.json(result);
  });

  const HINT_COST = 5;
  const MAX_HINTS_PER_GAME = 3;
  const hintUsage = new Map<string, number>();

  function clearHintsForRoom(roomId: string) {
    for (const key of hintUsage.keys()) {
      if (key.startsWith(`${roomId}:`)) hintUsage.delete(key);
    }
  }

  function getPlayerHintsUsed(roomId: string, playerId: string): number {
    return hintUsage.get(`${roomId}:${playerId}`) || 0;
  }

  app.post("/api/game/hint", async (req, res) => {
    try {
      const { roomId, playerId } = req.body as { roomId: string; playerId: string };
      if (!roomId || !playerId) return res.status(400).json({ error: "missing_params" });

      const room = getRoom(roomId);
      if (!room || room.state !== "playing") return res.status(400).json({ error: "no_active_game" });

      const playerInRoom = room.players.find(p => {
        const mappedId = socketPlayerIdMap.get(p.id);
        return mappedId === playerId;
      });
      if (!playerInRoom) return res.status(403).json({ error: "not_in_room" });

      const globalKey = `${roomId}:${playerId}`;
      const globalUsed = hintUsage.get(globalKey) || 0;
      if (globalUsed >= MAX_HINTS_PER_GAME) return res.status(400).json({ error: "max_hints_reached" });

      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
      if (!profile || profile.coins < HINT_COST) return res.status(400).json({ error: "not_enough_coins" });

      await db.update(playerProfiles).set({ coins: profile.coins - HINT_COST }).where(eq(playerProfiles.id, playerId));

      const activeCategories = getActiveCategories(room.wordCategory);
      const letter = room.currentLetter;
      const candidates: { category: string; word: string }[] = [];
      for (const cat of activeCategories) {
        const dbCat = CATEGORY_MAP[cat] as WordCategory;
        const words = getWordsForLetter(dbCat, letter);
        for (const w of words.slice(0, 10)) {
          candidates.push({ category: cat, word: w });
        }
      }

      if (candidates.length === 0) {
        await db.update(playerProfiles).set({ coins: profile.coins }).where(eq(playerProfiles.id, playerId));
        return res.status(400).json({ error: "no_hints_available" });
      }

      const hint = candidates[Math.floor(Math.random() * candidates.length)];
      hintUsage.set(globalKey, globalUsed + 1);

      return res.json({
        category: hint.category,
        word: hint.word,
        hintsUsed: globalUsed + 1,
        hintsRemaining: MAX_HINTS_PER_GAME - (globalUsed + 1),
        newCoinBalance: profile.coins - HINT_COST,
      });
    } catch (e) {
      console.error("[hint] Error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/validate-round", (req, res) => {
    try {
      const { letter, participantsAnswers } = req.body as {
        letter: string;
        participantsAnswers: Array<Record<string, string>>;
      };

      if (!letter || !Array.isArray(participantsAnswers)) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }

      const results = participantsAnswers.map((answers) => {
        const validation: Record<string, { valid: boolean; reason?: string }> = {};
        for (const [gameCategory, word] of Object.entries(answers)) {
          const dbCategory = CATEGORY_MAP[gameCategory] as WordCategory | undefined;
          if (!dbCategory) {
            validation[gameCategory] = { valid: false, reason: "unknown_category" };
          } else {
            validation[gameCategory] = validateWord(word || "", dbCategory, letter);
          }
        }
        return validation;
      });

      res.json({ results });
    } catch (e) {
      console.error("validate-round error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  const allowedOrigins = new Set<string>();

  if (process.env.REPLIT_DEV_DOMAIN) {
    allowedOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }
  if (process.env.REPLIT_DOMAINS) {
    process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
      allowedOrigins.add(`https://${d.trim()}`);
    });
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isLocalhost =
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:");
        if (isLocalhost || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Allow all for Expo
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("register_player_id", (data: { playerId: string }) => {
      if (data.playerId) socketPlayerIdMap.set(socket.id, data.playerId);
    });

    socket.on(
      "create_room",
      (
        data: { playerName: string; playerSkin: string; wordCategory?: WordCategoryId },
        cb: (res: { success: boolean; roomId?: string; error?: string }) => void
      ) => {
        try {
          const room = createRoom(socket.id, data.playerName, data.playerSkin, data.wordCategory || "general");
          socket.join(room.id);
          socketRoomMap.set(socket.id, room.id);
          console.log(`[create_room] Socket ${socket.id} created room ${room.id}. Players: ${room.players.map(p => p.name).join(", ")}`);
          cb({ success: true, roomId: room.id });
          io.to(room.id).emit("room_updated", sanitizeRoom(room));
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Join a room
    socket.on(
      "join_room",
      (
        data: { roomId: string; playerName: string; playerSkin: string },
        cb: (res: { success: boolean; room?: ReturnType<typeof sanitizeRoom>; error?: string }) => void
      ) => {
        try {
          const result = joinRoom(data.roomId, socket.id, data.playerName, data.playerSkin);
          if (!result.success || !result.room) {
            cb({ success: false, error: result.error });
            return;
          }

          // Deduplicate by socket.id (safety net)
          const uniquePlayers = result.room.players.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          );
          result.room.players = uniquePlayers;

          socket.join(data.roomId);
          socketRoomMap.set(socket.id, data.roomId);
          console.log(`[join_room] Socket ${socket.id} joined room ${data.roomId}. Players (${result.room.players.length}): ${result.room.players.map(p => p.name).join(", ")}`);

          cb({ success: true, room: sanitizeRoom(result.room) });
          io.to(data.roomId).emit("room_updated", sanitizeRoom(result.room));
          io.to(data.roomId).emit("player_joined", { playerName: data.playerName });
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Start game
    socket.on(
      "start_game",
      (
        data: { roomId: string },
        cb: (res: { success: boolean; error?: string }) => void
      ) => {
        try {
          clearHintsForRoom(data.roomId);
          const result = startGame(data.roomId);
          if (!result.success || !result.room) {
            cb({ success: false, error: result.error });
            return;
          }
          cb({ success: true });
          io.to(data.roomId).emit("game_started", {
            letter: result.room.currentLetter,
            round: result.room.currentRound,
            totalRounds: result.room.totalRounds,
            wordCategory: result.room.wordCategory || "general",
          });

          // Start 50-second timer
          const room = result.room;
          room.timer = setTimeout(() => {
            // Time's up - calculate scores for whoever has submitted
            const results = calculateRoundScores(data.roomId);
            const currentRoom = getRoom(data.roomId);
            if (!currentRoom) return;
            io.to(data.roomId).emit("round_results", {
              results,
              round: currentRoom.currentRound,
              totalRounds: currentRoom.totalRounds,
              players: currentRoom.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })),
            });
          }, 51000);
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Submit answers
    socket.on(
      "submit_answers",
      (data: { roomId: string; answers: PlayerAnswers }) => {
        try {
          const { allSubmitted, room } = submitAnswers(
            data.roomId,
            socket.id,
            data.answers
          );

          // Notify room that this player submitted
          io.to(data.roomId).emit("player_submitted", { playerId: socket.id });

          if (allSubmitted && room) {
            if (room.timer) {
              clearTimeout(room.timer);
              room.timer = null;
            }
            const results = calculateRoundScores(data.roomId);
            const updatedRoom = getRoom(data.roomId);
            io.to(data.roomId).emit("round_results", {
              results,
              round: updatedRoom?.currentRound || 0,
              totalRounds: updatedRoom?.totalRounds || 5,
              players: updatedRoom?.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })) || [],
            });
          }
        } catch (e) {
          console.error("submit_answers error:", e);
        }
      }
    );

    // Next round
    socket.on(
      "next_round",
      (
        data: { roomId: string },
        cb?: (res: { isGameOver: boolean; letter?: string }) => void
      ) => {
        try {
          const { isGameOver, room } = nextRound(data.roomId);
          if (isGameOver && room) {
            const tournamentInfo = roomTournamentMap.get(data.roomId);
            io.to(data.roomId).emit("game_over", {
              players: room.players.map((p) => {
                const pid = socketPlayerIdMap.get(p.id) || "";
                return {
                  id: p.id,
                  name: p.name,
                  score: p.score,
                  coins: p.coins,
                  skin: p.skin,
                  hintsUsed: getPlayerHintsUsed(data.roomId, pid),
                };
              }),
              tournamentId: tournamentInfo?.tournamentId || null,
              tournamentMatchId: tournamentInfo?.matchId || null,
            });

            cb?.({ isGameOver: true });

            // Background Elo update — only for 1v1 games with registered playerIds
            if (room.players.length === 2) {
              const p1Id = socketPlayerIdMap.get(room.players[0].id);
              const p2Id = socketPlayerIdMap.get(room.players[1].id);
              if (p1Id && p2Id) {
                (async () => {
                  try {
                    const [prof1] = await db.select({ elo: playerProfiles.elo, peakElo: playerProfiles.peakElo, seasonWins: playerProfiles.seasonWins, seasonLosses: playerProfiles.seasonLosses })
                      .from(playerProfiles).where(eq(playerProfiles.id, p1Id));
                    const [prof2] = await db.select({ elo: playerProfiles.elo, peakElo: playerProfiles.peakElo, seasonWins: playerProfiles.seasonWins, seasonLosses: playerProfiles.seasonLosses })
                      .from(playerProfiles).where(eq(playerProfiles.id, p2Id));
                    if (!prof1 || !prof2) return;

                    const score1 = room.players[0].score;
                    const score2 = room.players[1].score;
                    const isDraw = score1 === score2;

                    let elo1 = prof1.elo ?? 1000;
                    let elo2 = prof2.elo ?? 1000;

                    let newElo1: number, newElo2: number;
                    let wins1 = prof1.seasonWins ?? 0;
                    let losses1 = prof1.seasonLosses ?? 0;
                    let wins2 = prof2.seasonWins ?? 0;
                    let losses2 = prof2.seasonLosses ?? 0;

                    if (isDraw) {
                      const K = 32;
                      const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
                      newElo1 = Math.round(elo1 + K * (0.5 - expected1));
                      newElo2 = Math.round(elo2 + K * (0.5 - (1 - expected1)));
                    } else if (score1 > score2) {
                      const { winner, loser } = calcElo(elo1, elo2);
                      newElo1 = winner; newElo2 = loser;
                      wins1++; losses2++;
                    } else {
                      const { winner, loser } = calcElo(elo2, elo1);
                      newElo2 = winner; newElo1 = loser;
                      wins2++; losses1++;
                    }

                    const peak1 = Math.max(prof1.peakElo ?? 1000, newElo1);
                    const peak2 = Math.max(prof2.peakElo ?? 1000, newElo2);

                    await db.update(playerProfiles).set({
                      elo: newElo1, division: calcDivision(newElo1), peakElo: peak1,
                      seasonWins: wins1, seasonLosses: losses1, updatedAt: new Date(),
                    }).where(eq(playerProfiles.id, p1Id));

                    await db.update(playerProfiles).set({
                      elo: newElo2, division: calcDivision(newElo2), peakElo: peak2,
                      seasonWins: wins2, seasonLosses: losses2, updatedAt: new Date(),
                    }).where(eq(playerProfiles.id, p2Id));

                    // Notify both players of their new Elo
                    const sock1 = io.sockets.sockets.get(room.players[0].id);
                    const sock2 = io.sockets.sockets.get(room.players[1].id);
                    if (sock1) sock1.emit("elo_updated", { elo: newElo1, division: calcDivision(newElo1), delta: newElo1 - elo1 });
                    if (sock2) sock2.emit("elo_updated", { elo: newElo2, division: calcDivision(newElo2), delta: newElo2 - elo2 });
                  } catch (err) {
                    console.error("[ranked] Elo update error:", err);
                  }
                })();
              }
            }

            // ── Clan war score: winner's clan gets +1 ─────────────────────
            if (room.players.length >= 2) {
              const sortedByScore = [...room.players].sort((a, b) => b.score - a.score);
              const topScore = sortedByScore[0].score;
              const secondScore = sortedByScore[1].score;
              const hasClearWinner = topScore > secondScore;
              if (hasClearWinner) {
                const winnerId = socketPlayerIdMap.get(sortedByScore[0].id);
                if (winnerId) {
                  (async () => {
                    try {
                      const [winnerProf] = await db.select({ clanId: playerProfiles.clanId }).from(playerProfiles).where(eq(playerProfiles.id, winnerId)).limit(1);
                      if (winnerProf?.clanId) {
                        await db.update(clanMembers).set({ warScore: sql`war_score + 1` }).where(and(eq(clanMembers.clanId, winnerProf.clanId), eq(clanMembers.playerId, winnerId)));
                        await db.update(clans).set({ totalWarScore: sql`total_war_score + 1` }).where(eq(clans.id, winnerProf.clanId));
                      }
                    } catch (err) {
                      console.error("[clan-war] warScore update error:", err);
                    }
                  })();
                }
              }

              // ── Battle Pass XP: +10 per game played, +10 bonus for winner (= +20 total) ──
              (async () => {
                try {
                  const winnerSocketId = hasClearWinner ? sortedByScore[0].id : null;
                  for (const player of room.players) {
                    const pid = socketPlayerIdMap.get(player.id);
                    if (!pid) continue;
                    const xp = BP_XP_GAME + (hasClearWinner && player.id === winnerSocketId ? (BP_XP_WIN - BP_XP_GAME) : 0);
                    await awardBattlePassXp(pid, xp);
                  }
                } catch (err) {
                  console.error("[battle-pass] game xp award error:", err);
                }
              })();
            }
          } else if (room) {
            io.to(data.roomId).emit("new_round", {
              letter: room.currentLetter,
              round: room.currentRound,
              totalRounds: room.totalRounds,
            });
            cb?.({ isGameOver: false, letter: room.currentLetter });

            // Start new 50-second timer
            room.timer = setTimeout(() => {
              const results = calculateRoundScores(data.roomId);
              const updatedRoom = getRoom(data.roomId);
              if (!updatedRoom) return;
              io.to(data.roomId).emit("round_results", {
                results,
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                players: updatedRoom.players.map((p) => ({
                  id: p.id,
                  name: p.name,
                  score: p.score,
                })),
              });
            }, 51000);
          }
        } catch (e) {
          console.error("next_round error:", e);
        }
      }
    );

    // Quick match - find or create an available room
    socket.on(
      "quick_match",
      (
        data: { playerName: string; playerSkin: string },
        cb: (res: { success: boolean; roomId?: string; room?: ReturnType<typeof sanitizeRoom>; created?: boolean; error?: string }) => void
      ) => {
        try {
          // Prevent duplicate matchmaking: if this socket is already in a room, return it
          const existingRoomId = socketRoomMap.get(socket.id);
          if (existingRoomId) {
            const existingRoom = getRoom(existingRoomId);
            if (existingRoom && existingRoom.state === "waiting") {
              console.log(`[quick_match] Socket ${socket.id} already in room ${existingRoomId}, skipping duplicate join. Players: ${existingRoom.players.map(p => p.name).join(", ")}`);
              cb({ success: true, roomId: existingRoomId, room: sanitizeRoom(existingRoom), created: false });
              return;
            }
            // Room no longer valid (game started or gone), clear the mapping
            socketRoomMap.delete(socket.id);
          }

          // Find a waiting room with fewer than 8 players
          const availableRoom = findAvailableRoom();
          if (availableRoom) {
            const result = joinRoom(availableRoom.id, socket.id, data.playerName, data.playerSkin);
            if (result.success && result.room) {
              socket.join(availableRoom.id);
              socketRoomMap.set(socket.id, availableRoom.id);
              console.log(`[quick_match] Socket ${socket.id} joined existing room ${availableRoom.id}. Players: ${result.room.players.map(p => p.name).join(", ")}`);
              cb({ success: true, roomId: availableRoom.id, room: sanitizeRoom(result.room), created: false });
              io.to(availableRoom.id).emit("room_updated", sanitizeRoom(result.room));
              io.to(availableRoom.id).emit("player_joined", { playerName: data.playerName });
            } else {
              // That room became unavailable; create a new one
              const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
              socket.join(newRoom.id);
              socketRoomMap.set(socket.id, newRoom.id);
              console.log(`[quick_match] Socket ${socket.id} created new room ${newRoom.id} (fallback). Players: ${newRoom.players.map(p => p.name).join(", ")}`);
              cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
              io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
            }
          } else {
            const newRoom = createRoom(socket.id, data.playerName, data.playerSkin);
            socket.join(newRoom.id);
            socketRoomMap.set(socket.id, newRoom.id);
            console.log(`[quick_match] Socket ${socket.id} created new room ${newRoom.id}. Players: ${newRoom.players.map(p => p.name).join(", ")}`);
            cb({ success: true, roomId: newRoom.id, room: sanitizeRoom(newRoom), created: true });
            io.to(newRoom.id).emit("room_updated", sanitizeRoom(newRoom));
          }
        } catch (e) {
          cb({ success: false, error: "server_error" });
        }
      }
    );

    // Leave room
    socket.on(
      "leave_room",
      (data: { roomId: string }) => {
        const room = removePlayer(data.roomId, socket.id);
        socket.leave(data.roomId);
        socketRoomMap.delete(socket.id);
        console.log(`[leave_room] Socket ${socket.id} left room ${data.roomId}. Remaining: ${room ? room.players.map(p => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
          io.to(data.roomId).emit("player_left", { playerId: socket.id });
        }
      }
    );

    socket.on("request_hint", async (data: { roomId: string }, callback?: (resp: { error?: string; category?: string; word?: string; hintsUsed?: number; hintsRemaining?: number; newCoinBalance?: number }) => void) => {
      const respond = (resp: { error?: string; category?: string; word?: string; hintsUsed?: number; hintsRemaining?: number; newCoinBalance?: number }) => { if (callback) callback(resp); };
      try {
        const { roomId } = data;
        const playerId = socketPlayerIdMap.get(socket.id);
        if (!roomId || !playerId) return respond({ error: "missing_params" });

        const room = getRoom(roomId);
        if (!room || room.state !== "playing") return respond({ error: "no_active_game" });

        const isPlayerInRoom = room.players.some(p => p.id === socket.id);
        if (!isPlayerInRoom) return respond({ error: "not_in_room" });

        const globalKey = `${roomId}:${playerId}`;
        const globalUsed = hintUsage.get(globalKey) || 0;
        if (globalUsed >= MAX_HINTS_PER_GAME) return respond({ error: "max_hints_reached" });

        const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
        if (!profile || profile.coins < HINT_COST) return respond({ error: "not_enough_coins" });

        await db.update(playerProfiles).set({ coins: profile.coins - HINT_COST }).where(eq(playerProfiles.id, playerId));

        const activeCategories = getActiveCategories(room.wordCategory);
        const letter = room.currentLetter;
        const candidates: { category: string; word: string }[] = [];
        for (const cat of activeCategories) {
          const dbCat = CATEGORY_MAP[cat] as WordCategory;
          const words = getWordsForLetter(dbCat, letter);
          for (const w of words.slice(0, 10)) {
            candidates.push({ category: cat, word: w });
          }
        }

        if (candidates.length === 0) {
          await db.update(playerProfiles).set({ coins: profile.coins }).where(eq(playerProfiles.id, playerId));
          return respond({ error: "no_hints_available" });
        }

        const hint = candidates[Math.floor(Math.random() * candidates.length)];
        hintUsage.set(globalKey, globalUsed + 1);

        return respond({
          category: hint.category,
          word: hint.word,
          hintsUsed: globalUsed + 1,
          hintsRemaining: MAX_HINTS_PER_GAME - (globalUsed + 1),
          newCoinBalance: profile.coins - HINT_COST,
        });
      } catch (e) {
        console.error("[hint] Error:", e);
        return respond({ error: "server_error" });
      }
    });

    socket.on("forfeit_match", (data: { roomId: string }) => {
      const room = getRoom(data.roomId);
      if (!room) return;
      console.log(`[forfeit_match] Socket ${socket.id} forfeited room ${data.roomId}`);
      const gameOverPlayers = room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.id === socket.id ? 0 : Math.max(p.score || 0, 50),
        coins: p.id === socket.id ? 0 : 30,
        skin: p.skin || "student",
        forfeited: p.id === socket.id,
      }));
      io.to(data.roomId).emit("game_over", { players: gameOverPlayers, forfeitedBy: socket.id });
      removePlayer(data.roomId, socket.id);
      socket.leave(data.roomId);
      socketRoomMap.delete(socket.id);
    });

    // Play again
    socket.on(
      "play_again",
      (data: { roomId: string }) => {
        const room = resetRoom(data.roomId);
        if (room) {
          io.to(data.roomId).emit("room_updated", sanitizeRoom(room));
        }
      }
    );

    // Get room info
    socket.on(
      "get_room",
      (
        data: { roomId: string },
        cb: (res: { room?: ReturnType<typeof sanitizeRoom>; error?: string }) => void
      ) => {
        const room = getRoom(data.roomId);
        if (!room) {
          cb({ error: "room_not_found" });
        } else {
          cb({ room: sanitizeRoom(room) });
        }
      }
    );

    // ── NEW MATCHMAKING SYSTEM ──────────────────────────────────────────
    // findMatch: add player to global queue; create room when 2 are ready
    socket.on(
      "findMatch",
      async (data: { playerName: string; playerSkin: string; coinEntry?: number; playerId?: string; mode?: string }) => {
        if (data.mode === "rapid") {
          handleRapidJoin(socket.id, data.playerName, data.playerSkin, data.playerId);
          return;
        }
        // Never add the same socket twice
        if (matchmakingQueue.find((p) => p.id === socket.id)) {
          console.log(`[findMatch] Socket ${socket.id} already in queue – ignored`);
          return;
        }

        const requestedEntry = data.coinEntry || 0;
        if (requestedEntry > 0 && data.playerId) {
          try {
            const [p] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, data.playerId));
            if (!p || p.coins < requestedEntry) {
              socket.emit("matchError", { error: "insufficient_coins" });
              return;
            }
          } catch {}
        }

        const entry: QueueEntry = { id: socket.id, name: data.playerName, skin: data.playerSkin, coinEntry: requestedEntry, playerId: data.playerId };
        matchmakingQueue.push(entry);
        console.log(`[findMatch] Queue: ${matchmakingQueue.map((p) => `${p.name}(${p.coinEntry || 0})`).join(", ")} (${matchmakingQueue.length} players)`);

        // Find a match with same coinEntry
        const myCoinEntry = entry.coinEntry || 0;
        const matchIdx = matchmakingQueue.findIndex((p) => p.id !== socket.id && (p.coinEntry || 0) === myCoinEntry);

        if (matchIdx !== -1) {
          const opponent = matchmakingQueue[matchIdx];
          matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id && p.id !== opponent.id);
          const matched = [entry, opponent];
          console.log(`[findMatch] Match created: ${matched.map((p) => p.name).join(" vs ")} (entry: ${myCoinEntry})`);

          // Create room with first player as host, join second
          const room = createRoom(matched[0].id, matched[0].name, matched[0].skin);
          joinRoom(room.id, matched[1].id, matched[1].name, matched[1].skin);

          if (myCoinEntry > 0) {
            roomCoinEntries.set(room.id, myCoinEntry);
            roomPendingDeductions.set(room.id, matched.filter(p => !!p.playerId).map(p => p.playerId!));
          }

          // Join both sockets to the Socket.io room
          for (const player of matched) {
            const s = io.sockets.sockets.get(player.id);
            if (s) {
              s.join(room.id);
              socketRoomMap.set(player.id, room.id);
            }
          }

          // Countdown then start
          const roomPlayers = room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin }));
          console.log(`[findMatch] Countdown starting for room ${room.id}`);
          emitCountdownThenStart(io, room.id, roomPlayers, async () => {
            const pendingPlayerIds = roomPendingDeductions.get(room.id);
            if (pendingPlayerIds && myCoinEntry > 0) {
              for (const pid of pendingPlayerIds) {
                try {
                  const [p] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, pid));
                  if (p) {
                    await db.update(playerProfiles).set({ coins: Math.max(0, p.coins - myCoinEntry), updatedAt: new Date() }).where(eq(playerProfiles.id, pid));
                  }
                } catch {}
              }
              roomPendingDeductions.delete(room.id);
            }
            clearHintsForRoom(room.id);
            const gameResult = startGame(room.id);
            if (!gameResult.success || !gameResult.room) {
              console.error(`[findMatch] startGame failed for room ${room.id}`);
              return;
            }
            const gameData = {
              roomId: room.id,
              letter: gameResult.room.currentLetter,
              round: gameResult.room.currentRound,
              totalRounds: gameResult.room.totalRounds,
              players: gameResult.room.players.map((p) => ({ id: p.id, name: p.name, skin: p.skin })),
              coinEntry: myCoinEntry,
              wordCategory: gameResult.room.wordCategory || "general",
            };
            io.to(room.id).emit("matchFound", gameData);
            console.log(`[findMatch] Room ${room.id}: matchFound emitted, letter=${gameData.letter}, coinEntry=${myCoinEntry}`);
            gameResult.room.timer = setTimeout(() => {
              const results = calculateRoundScores(room.id);
              const updatedRoom = getRoom(room.id);
              if (!updatedRoom) return;
              io.to(room.id).emit("round_results", {
                results,
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                players: updatedRoom.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
              });
            }, 51000);
          });
        }
      }
    );

    // cancelMatch: remove from queue and refund coin entry server-side
    socket.on("cancelMatch", async () => {
      const queueEntry = matchmakingQueue.find((p) => p.id === socket.id);
      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);
      console.log(`[cancelMatch] Socket ${socket.id} removed from queue. Queue: ${matchmakingQueue.length}`);

      if (queueEntry?.coinEntry && queueEntry.coinEntry > 0 && queueEntry.playerId) {
        try {
          const [updated] = await db.update(playerProfiles)
            .set({ coins: sql`coins + ${queueEntry.coinEntry}`, updatedAt: new Date() })
            .where(eq(playerProfiles.id, queueEntry.playerId))
            .returning({ coins: playerProfiles.coins });
          socket.emit("coinRefunded", { amount: queueEntry.coinEntry, newCoins: updated?.coins });
          console.log(`[cancelMatch] Refunded ${queueEntry.coinEntry} coins to ${queueEntry.playerId}`);
        } catch (e) {
          console.error("[cancelMatch] Failed to refund coins:", e);
        }
      }
    });
    // ────────────────────────────────────────────────────────────────────

    // Quick chat relay — forward chat message to all players in the room
    socket.on("quick_chat", (data: { roomId: string; message: string; playerName: string }) => {
      socket.to(data.roomId).emit("quick_chat", { message: data.message, playerName: data.playerName });
    });

    socket.on("send_emote", (data: { roomId: string; emote: string; playerName: string }) => {
      socket.to(data.roomId).emit("receive_emote", { emote: data.emote, playerName: data.playerName });
    });

    // Power card relay — broadcast card activation to all OTHER players in the room
    socket.on("power_card", (data: { roomId: string; type: string; playerName: string }) => {
      socket.to(data.roomId).emit("power_card", { type: data.type, playerName: data.playerName });
    });

    // Voice data relay — forward audio chunks to all players in the room
    socket.on("voice_data", (data: { roomId: string; audio: string; isSpeaking: boolean }) => {
      socket.to(data.roomId).emit("voice_data", { audio: data.audio, from: socket.id, isSpeaking: data.isSpeaking });
    });

    socket.on("tournament_register_socket", (data: { playerId: string }) => {
      tournamentPlayerSocketMap.set(data.playerId, socket.id);
      const tournamentId = playerTournamentMap.get(data.playerId);
      if (tournamentId) {
        const active = activeTournaments.get(tournamentId);
        if (active) {
          const player = active.players.find(p => p.playerId === data.playerId);
          if (player) player.socketId = socket.id;
        }
      }
    });

    socket.on("tournament_match_result", async (data: {
      tournamentId: string;
      matchId: string;
      winnerId: string;
      winnerName: string;
      roomId: string;
    }) => {
      try {
        const active = activeTournaments.get(data.tournamentId);
        if (!active) return;
        const match = active.matches.find(m => m.id === data.matchId);
        if (!match || match.status === "completed") return;
        if (data.winnerId !== match.player1Id && data.winnerId !== match.player2Id) return;
        await handleTournamentMatchResult(io, data.tournamentId, data.matchId, data.winnerId, data.winnerName);
        roomTournamentMap.delete(data.roomId);
      } catch (e) {
        console.error("tournament_match_result error:", e);
      }
    });

    // ── RAPID MODE SOCKET EVENTS ────────────────────────────────────────
    function handleRapidJoin(socketId: string, playerName: string, playerSkin: string, playerId?: string) {
      if (rapidQueue.find((p) => p.id === socketId)) return;
      const entry: RapidQueueEntry = { id: socketId, name: playerName, skin: playerSkin, playerId };
      rapidQueue.push(entry);
      console.log(`[rapid_join] Queue: ${rapidQueue.length}`);

      const matchIdx = rapidQueue.findIndex((p) => p.id !== socketId);
      if (matchIdx === -1) return;

      const opponent = rapidQueue[matchIdx];
      rapidQueue = rapidQueue.filter((p) => p.id !== socketId && p.id !== opponent.id);

      const roomId = "rapid_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const rapidRoom: RapidRoom = {
        id: roomId,
        players: [
          { socketId: entry.id, name: entry.name, skin: entry.skin, playerId: entry.playerId },
          { socketId: opponent.id, name: opponent.name, skin: opponent.skin, playerId: opponent.playerId },
        ],
        scores: { [entry.id]: 0, [opponent.id]: 0 },
        currentRound: 0,
        currentLetter: "",
        currentCategory: "",
        roundTimer: null,
        roundWon: false,
        lastAttempts: {},
        letterQueue: shuffleArr(ARABIC_LETTERS),
        letterIndex: 0,
      };
      rapidRooms.set(roomId, rapidRoom);

      const s1 = io.sockets.sockets.get(entry.id);
      const s2 = io.sockets.sockets.get(opponent.id);
      if (s1) s1.join(roomId);
      if (s2) s2.join(roomId);

      io.to(entry.id).emit("rapid_start", {
        rapidRoomId: roomId,
        opponent: { id: opponent.id, name: opponent.name, skin: opponent.skin },
      });
      io.to(opponent.id).emit("rapid_start", {
        rapidRoomId: roomId,
        opponent: { id: entry.id, name: entry.name, skin: entry.skin },
      });

      console.log(`[rapid] Match: ${entry.name} vs ${opponent.name} in ${roomId}`);

      setTimeout(() => startRapidRound(io, roomId), 3500);
    }

    socket.on("rapid_join", (data: { playerName: string; playerSkin: string; playerId?: string }) => {
      handleRapidJoin(socket.id, data.playerName, data.playerSkin, data.playerId);
    });

    socket.on("rapid_cancel", () => {
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);
      console.log(`[rapid_cancel] Socket ${socket.id} removed from rapid queue`);
    });

    socket.on("rapid_word", (data: { rapidRoomId: string; word: string; category: string }) => {
      const room = rapidRooms.get(data.rapidRoomId);
      if (!room || room.roundWon) return;

      if (!room.players.some((p) => p.socketId === socket.id)) return;

      if (data.category !== room.currentCategory) {
        socket.emit("rapid_word_result", { valid: false, reason: "wrong_category" });
        return;
      }

      const dbCategory = CATEGORY_MAP[room.currentCategory] as WordCategory | undefined;
      if (!dbCategory) {
        socket.emit("rapid_word_result", { valid: false, reason: "unknown_category" });
        return;
      }
      room.lastAttempts[socket.id] = data.word;

      const useStrict = !!room.wordCategory && room.wordCategory !== "general";
      const validation = validateWord(data.word, dbCategory, room.currentLetter, useStrict);
      if (!validation.valid) {
        socket.emit("rapid_word_result", { valid: false, reason: validation.reason });
        return;
      }

      room.roundWon = true;
      socket.emit("rapid_word_result", { valid: true });

      room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;

      if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

      const resultData = {
        round: room.currentRound,
        winnerId: socket.id,
        winnerName: room.players.find((p) => p.socketId === socket.id)?.name || "",
        word: data.word,
        category: data.category,
        scores: { ...room.scores },
        isDraw: false,
        attempts: { ...room.lastAttempts },
      };
      io.to(data.rapidRoomId).emit("rapid_round_result", resultData);
      console.log(`[rapid] Round ${room.currentRound} won by ${resultData.winnerName} with "${data.word}" in ${data.rapidRoomId}`);

      setTimeout(() => {
        if (room.currentRound >= RAPID_TOTAL_ROUNDS) {
          endRapidGame(io, data.rapidRoomId);
        } else {
          startRapidRound(io, data.rapidRoomId);
        }
      }, 2500);
    });

    socket.on("rapid_leave", (data: { rapidRoomId: string }) => {
      const room = rapidRooms.get(data.rapidRoomId);
      if (!room) return;
      if (room.roundTimer) clearTimeout(room.roundTimer);

      const remaining = room.players.find((p) => p.socketId !== socket.id);
      if (remaining) {
        room.scores[remaining.socketId] = RAPID_TOTAL_ROUNDS;
        endRapidGame(io, data.rapidRoomId);
      } else {
        rapidRooms.delete(data.rapidRoomId);
      }
    });
    // ────────────────────────────────────────────────────────────────────

    // Disconnect
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      socketPlayerIdMap.delete(socket.id);

      // Refund coin entry for players who disconnect while in matchmaking queue
      const queueEntry = matchmakingQueue.find((p) => p.id === socket.id);
      if (queueEntry?.coinEntry && queueEntry.coinEntry > 0 && queueEntry.playerId) {
        db.update(playerProfiles)
          .set({ coins: sql`coins + ${queueEntry.coinEntry}`, updatedAt: new Date() })
          .where(eq(playerProfiles.id, queueEntry.playerId))
          .catch((e) => console.error("[disconnect] Failed to refund coins:", e));
        console.log(`[disconnect] Refunded ${queueEntry.coinEntry} coins to ${queueEntry.playerId}`);
      }

      matchmakingQueue = matchmakingQueue.filter((p) => p.id !== socket.id);

      // Remove from rapid matchmaking queue
      rapidQueue = rapidQueue.filter((p) => p.id !== socket.id);

      // Handle rapid room disconnect
      for (const [roomId, room] of rapidRooms) {
        const isInRoom = room.players.some((p) => p.socketId === socket.id);
        if (isInRoom) {
          if (room.roundTimer) clearTimeout(room.roundTimer);
          const remaining = room.players.find((p) => p.socketId !== socket.id);
          if (remaining) {
            room.scores[remaining.socketId] = RAPID_TOTAL_ROUNDS;
            endRapidGame(io, roomId);
          } else {
            rapidRooms.delete(roomId);
          }
        }
      }

      // Clean up from socketRoomMap first
      const trackedRoomId = socketRoomMap.get(socket.id);
      socketRoomMap.delete(socket.id);

      // Build list of rooms to clean up: prefer our tracked map, fallback to socket rooms
      const roomsToUpdate = new Set<string>();
      if (trackedRoomId) {
        roomsToUpdate.add(trackedRoomId);
      }
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          roomsToUpdate.add(roomId);
        }
      }

      for (const roomId of roomsToUpdate) {
        const room = removePlayer(roomId, socket.id);
        console.log(`[disconnect] Removed socket ${socket.id} from room ${roomId}. Remaining: ${room ? room.players.map(p => p.name).join(", ") : "room deleted"}`);
        if (room) {
          io.to(roomId).emit("room_updated", sanitizeRoom(room));
          io.to(roomId).emit("player_left", { playerId: socket.id });
        }
      }
    });
  });

  // ── RAPID MODE HELPERS ────────────────────────────────────────────────
  function startRapidRound(ioRef: SocketIOServer, roomId: string) {
    const room = rapidRooms.get(roomId);
    if (!room) return;

    room.currentRound += 1;
    room.currentLetter = getNextRapidLetter(room);
    room.currentCategory = pickRapidCategory();
    room.roundWon = false;
    room.lastAttempts = {};

    ioRef.to(roomId).emit("rapid_letter", {
      round: room.currentRound,
      letter: room.currentLetter,
      category: room.currentCategory,
      timeLimit: RAPID_ROUND_TIME,
    });
    console.log(`[rapid] Round ${room.currentRound} started in ${roomId}: letter=${room.currentLetter}, category=${room.currentCategory}`);

    room.roundTimer = setTimeout(() => {
      if (room.roundWon) return;
      room.roundWon = true;
      const resultData = {
        round: room.currentRound,
        winnerId: null,
        winnerName: "",
        word: "",
        category: room.currentCategory,
        scores: { ...room.scores },
        isDraw: true,
        attempts: { ...room.lastAttempts },
      };
      ioRef.to(roomId).emit("rapid_round_result", resultData);
      console.log(`[rapid] Round ${room.currentRound} timeout (draw) in ${roomId}`);

      setTimeout(() => {
        if (room.currentRound >= RAPID_TOTAL_ROUNDS) {
          endRapidGame(ioRef, roomId);
        } else {
          startRapidRound(ioRef, roomId);
        }
      }, 2500);
    }, RAPID_ROUND_TIME * 1000);
  }

  function endRapidGame(ioRef: SocketIOServer, roomId: string) {
    const room = rapidRooms.get(roomId);
    if (!room) return;
    if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

    const scores = room.scores;
    const playerIds = Object.keys(scores);
    let winnerId: string | null = null;
    if (playerIds.length === 2) {
      if (scores[playerIds[0]] > scores[playerIds[1]]) winnerId = playerIds[0];
      else if (scores[playerIds[1]] > scores[playerIds[0]]) winnerId = playerIds[1];
    }

    const rewards: Record<string, { coins: number; xp: number }> = {};
    for (const pid of playerIds) {
      if (pid === winnerId) {
        rewards[pid] = { coins: RAPID_COINS_WIN, xp: RAPID_XP_WIN };
      } else {
        rewards[pid] = { coins: RAPID_COINS_LOSE, xp: RAPID_XP_LOSE };
      }
    }
    if (!winnerId) {
      for (const pid of playerIds) {
        rewards[pid] = { coins: RAPID_COINS_LOSE, xp: RAPID_XP_LOSE };
      }
    }

    for (const pid of playerIds) {
      const s = ioRef.sockets.sockets.get(pid);
      if (s) {
        s.emit("rapid_game_over", {
          winnerId,
          scores: { ...scores },
          coinsEarned: rewards[pid].coins,
          xpEarned: rewards[pid].xp,
        });
      }
    }
    console.log(`[rapid] Game over in ${roomId}: winner=${winnerId || "draw"}`);
    rapidRooms.delete(roomId);
  }
  // ────────────────────────────────────────────────────────────────────────

  // REST API routes
  app.get("/api/room/:id", (req, res) => {
    const room = getRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(sanitizeRoom(room));
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── TASK & ACHIEVEMENT DEFINITION ENDPOINTS (non-player-specific) ──────────
  app.get("/api/daily-tasks", async (_req, res) => {
    try {
      const tasks = await db.select().from(dailyTaskDefs);
      if (tasks.length === 0) {
        await seedTaskAndAchievementDefs();
        const seeded = await db.select().from(dailyTaskDefs);
        return res.json(seeded);
      }
      res.json(tasks);
    } catch (e) {
      console.error("GET /api/daily-tasks error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/achievements", async (_req, res) => {
    try {
      const achievements = await db.select().from(achievementDefs);
      if (achievements.length === 0) {
        await seedTaskAndAchievementDefs();
        const seeded = await db.select().from(achievementDefs);
        return res.json(seeded);
      }
      res.json(achievements);
    } catch (e) {
      console.error("GET /api/achievements error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/player/:id", async (req, res) => {
    try {
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) {
        const playerCode = await ensurePlayerCode(req.params.id);
        const randomName = generateRandomPlayerName();
        const playerTag = await generateUniquePlayerTag();
        const refCode = await generateUniqueReferralCode();
        [profile] = await db.insert(playerProfiles).values({
          id: req.params.id,
          playerCode,
          playerTag,
          name: randomName,
          referralCode: refCode,
        }).returning();
      } else {
        const updates: Record<string, unknown> = {};
        if (!profile.playerCode) updates.playerCode = await ensurePlayerCode(req.params.id);
        if (!profile.playerTag) updates.playerTag = await generateUniquePlayerTag();
        if (Object.keys(updates).length > 0) {
          [profile] = await db.update(playerProfiles)
            .set(updates)
            .where(eq(playerProfiles.id, req.params.id))
            .returning();
        }
      }
      const displayId = profile.playerTag
        ? `WM-${profile.playerTag.toString().padStart(5, "0")}`
        : null;
      res.json({ ...profile, displayId });
    } catch (e) {
      console.error("GET /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.put("/api/player/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const [existing] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!existing) {
        const playerCode = await ensurePlayerCode(id);
        const playerTag = await generateUniquePlayerTag();
        const refCode = await generateUniqueReferralCode();
        const [created] = await db.insert(playerProfiles).values({
          id,
          playerCode,
          playerTag,
          referralCode: refCode,
          name: data.name || generateRandomPlayerName(),
          coins: data.coins ?? 100,
          xp: data.xp ?? 0,
          level: data.level ?? 1,
          equippedSkin: data.equippedSkin || "student",
          ownedSkins: data.ownedSkins || ["student"],
          totalScore: data.totalScore ?? 0,
          gamesPlayed: data.gamesPlayed ?? 0,
          wins: data.wins ?? 0,
          winStreak: data.winStreak ?? 0,
          bestStreak: data.bestStreak ?? 0,
          lastStreakReward: data.lastStreakReward ?? 0,
        }).returning();

        // Seed daily tasks for the new player
        try {
          const today = new Date().toISOString().slice(0, 10);
          const chosenTasks = pickDailyTasks();
          for (const def of chosenTasks) {
            await db.insert(playerDailyTasks).values({
              playerId: id,
              taskKey: def.key,
              assignedDate: today,
              progress: 0,
              baselineWins: 0,
              baselineGames: 0,
              baselineScore: 0,
            });
          }
        } catch (e) {
          console.error("[init] Failed to seed daily tasks for new player:", e);
        }

        // Seed achievement entries for the new player
        try {
          for (const def of ACHIEVEMENT_DEFS) {
            await db.insert(playerAchievements).values({
              playerId: id,
              achievementKey: def.key,
              progress: 0,
              unlocked: 0,
              claimed: 0,
            });
          }
        } catch (e) {
          console.error("[init] Failed to seed achievements for new player:", e);
        }

        return res.json(created);
      }
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (!existing.playerCode) updateData.playerCode = await ensurePlayerCode(id);
      if (!existing.playerTag) updateData.playerTag = await generateUniquePlayerTag();
      if (!existing.referralCode) updateData.referralCode = await generateUniqueReferralCode();
      const allowedFields = ["name", "coins", "xp", "level", "equippedSkin", "ownedSkins", "equippedTitle", "ownedTitles", "totalScore", "gamesPlayed", "wins", "winStreak", "bestStreak", "lastStreakReward", "powerCards"];
      for (const key of allowedFields) {
        if (data[key] !== undefined) updateData[key] = data[key];
      }
      const [updated] = await db.update(playerProfiles).set(updateData).where(eq(playerProfiles.id, id)).returning();
      res.json(updated);
    } catch (e) {
      console.error("PUT /api/player error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // Purchase endpoint: validates coins server-side and atomically deducts + grants item
  app.post("/api/player/:id/purchase", async (req, res) => {
    try {
      const id = req.params.id;
      const { itemType, itemId, price } = req.body as { itemType: string; itemId: string; price: number };
      if (!itemType || !itemId || typeof price !== "number" || price < 0) {
        return res.status(400).json({ error: "invalid_params" });
      }
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      if (profile.coins < price) return res.status(402).json({ error: "insufficient_coins" });

      const ownedSkins: string[] = Array.isArray(profile.ownedSkins) ? (profile.ownedSkins as string[]) : [];
      const ownedTitles: string[] = Array.isArray(profile.ownedTitles) ? (profile.ownedTitles as string[]) : [];

      if (itemType === "skin" && ownedSkins.includes(itemId)) {
        return res.json({ profile, alreadyOwned: true });
      }
      if (itemType === "title" && ownedTitles.includes(itemId)) {
        return res.json({ profile, alreadyOwned: true });
      }

      const updates: Partial<typeof profile> = { coins: profile.coins - price, updatedAt: new Date() };
      if (itemType === "skin") updates.ownedSkins = [...ownedSkins, itemId] as any;
      if (itemType === "title") updates.ownedTitles = [...ownedTitles, itemId] as any;

      const [updated] = await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, id)).returning();
      return res.json({ profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/purchase error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.patch("/api/player/change-name", async (req, res) => {
    try {
      const { player_id, new_name } = req.body as { player_id: string; new_name: string };
      if (!player_id || !new_name || new_name.trim().length === 0) {
        return res.status(400).json({ error: "missing_fields" });
      }
      const trimmed = new_name.trim();
      const [updated] = await db.update(playerProfiles)
        .set({ name: trimmed, updatedAt: new Date() })
        .where(eq(playerProfiles.id, player_id))
        .returning();
      if (!updated) return res.status(404).json({ error: "player_not_found" });
      res.json({ success: true, name: updated.name });
    } catch (e) {
      console.error("PATCH /api/player/change-name error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/player/:id/spin", async (req, res) => {
    try {
      const id = req.params.id;
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) {
        [profile] = await db.insert(playerProfiles).values({ id }).returning();
      }
      if (profile.lastSpinAt) {
        const elapsed = Date.now() - new Date(profile.lastSpinAt).getTime();
        if (elapsed < 24 * 60 * 60 * 1000) {
          const nextSpinAt = new Date(profile.lastSpinAt).getTime() + 24 * 60 * 60 * 1000;
          return res.status(429).json({ error: "too_early", nextSpinAt });
        }
      }
      const reward = pickSpinReward();
      const isVip = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());
      const coinMultiplier = isVip ? 2 : 1;
      const updates: Record<string, unknown> = { lastSpinAt: new Date(), updatedAt: new Date() };
      if (reward.type === "coins") {
        updates.coins = profile.coins + reward.amount * coinMultiplier;
      } else if (reward.type === "xp") {
        updates.xp = profile.xp + reward.amount;
        updates.level = Math.floor((profile.xp + reward.amount) / 100) + 1;
      } else if (reward.type === "powerCard") {
        const currentCards = (profile.powerCards as Record<string, number>) || {};
        const cardKeys = ["time", "freeze", "hint"] as const;
        const randomCard = cardKeys[Math.floor(Math.random() * cardKeys.length)];
        updates.powerCards = { ...currentCards, [randomCard]: (currentCards[randomCard] || 0) + 1 };
      }
      const [updated] = await db.update(playerProfiles).set(updates).where(eq(playerProfiles.id, id)).returning();
      await db.insert(dailySpins).values({
        playerId: id,
        rewardType: reward.type,
        rewardAmount: reward.amount,
      }).catch(() => {});
      res.json({ reward, profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/spin error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/player/:id/streak", async (req, res) => {
    try {
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) {
        return res.json({ winStreak: 0, bestStreak: 0, lastStreakReward: 0, milestones: STREAK_MILESTONES });
      }
      res.json({
        winStreak: profile.winStreak,
        bestStreak: profile.bestStreak,
        lastStreakReward: profile.lastStreakReward,
        milestones: STREAK_MILESTONES,
      });
    } catch (e) {
      console.error("GET /api/player/:id/streak error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/player/:id/game-result", async (req, res) => {
    try {
      const id = req.params.id;
      const { won, coinEntry } = req.body as { won: boolean; coinEntry?: number; };
      const score = Number(req.body.score) || 0;
      const coinsEarned = Number(req.body.coinsEarned) || 0;
      const xpEarned = Number(req.body.xpEarned) || 0;
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) {
        [profile] = await db.insert(playerProfiles).values({ id }).returning();
      }
      const newStreak = won ? profile.winStreak + 1 : 0;
      const newBest = Math.max(newStreak, profile.bestStreak);
      let streakBonus = 0;
      let newLastReward = profile.lastStreakReward;
      if (won) {
        for (const m of STREAK_MILESTONES) {
          if (newStreak >= m.wins && m.wins > profile.lastStreakReward) {
            streakBonus += m.reward;
            newLastReward = m.wins;
          }
        }
      } else {
        newLastReward = 0;
      }
      if (streakBonus > 0) {
        await db.insert(winStreaks).values({
          playerId: id,
          streakLength: newStreak,
          bonusAwarded: streakBonus,
          milestone: newLastReward,
        }).catch(() => {});
      }
      const coinEntryReward = won && coinEntry ? (COIN_ENTRY_OPTIONS.find(o => o.entry === coinEntry)?.reward || 0) : 0;
      const isVip = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());
      const vipMultiplier = isVip ? 2 : 1;
      const totalCoins = (coinsEarned + streakBonus + coinEntryReward) * vipMultiplier;
      const [updated] = await db.update(playerProfiles).set({
        coins: profile.coins + totalCoins,
        xp: profile.xp + xpEarned,
        level: Math.floor((profile.xp + xpEarned) / 100) + 1,
        totalScore: profile.totalScore + score,
        gamesPlayed: profile.gamesPlayed + 1,
        wins: won ? profile.wins + 1 : profile.wins,
        winStreak: newStreak,
        bestStreak: newBest,
        lastStreakReward: newLastReward,
        updatedAt: new Date(),
      }).where(eq(playerProfiles.id, id)).returning();
      res.json({ profile: updated, streakBonus, coinEntryReward });

      // Fire-and-forget: sync stored task progress with updated profile stats
      Promise.all([
        syncTaskProgress(id, updated).catch(() => {}),
        syncAchievementProgress(id, updated).catch(() => {}),
      ]).catch(() => {});
    } catch (e) {
      console.error("POST /api/player/:id/game-result error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/player/:id/activate-vip", async (req, res) => {
    try {
      const id = req.params.id;
      const { duration, subscriptionId } = req.body as { duration?: number; subscriptionId?: string };
      const durationDays = duration || 30;
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      const [updated] = await db.update(playerProfiles).set({
        isVip: true,
        vipExpiresAt: expiresAt,
        vipSubscriptionId: subscriptionId || null,
        updatedAt: new Date(),
      }).where(eq(playerProfiles.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "player_not_found" });
      res.json({ success: true, profile: updated });
    } catch (e) {
      console.error("POST /api/player/:id/activate-vip error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/player/:id/vip-status", async (req, res) => {
    try {
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, req.params.id));
      if (!profile) return res.status(404).json({ error: "player_not_found" });
      const isActive = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());
      res.json({
        isVip: isActive,
        vipExpiresAt: profile.vipExpiresAt,
        vipSubscriptionId: profile.vipSubscriptionId,
      });
    } catch (e) {
      console.error("GET /api/player/:id/vip-status error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/coin-entries", (_req, res) => {
    res.json(COIN_ENTRY_OPTIONS);
  });

  app.get("/api/spin-rewards", (_req, res) => {
    res.json(SPIN_REWARDS.map(r => ({ type: r.type, amount: r.amount, label: r.label })));
  });

  app.get("/api/tournaments/open", async (_req, res) => {
    try {
      const openTournaments = await db.select().from(tournaments).where(eq(tournaments.status, "open")).orderBy(desc(tournaments.createdAt));
      const result = [];
      for (const t of openTournaments) {
        const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id)).orderBy(asc(tournamentPlayers.joinedAt));
        const maxP = t.maxPlayers ?? TOURNAMENT_SIZE;
        result.push({
          ...t,
          playerCount: players.length,
          maxPlayers: maxP,
          entryFee: t.entryFee,
          hostPlayerName: players[0]?.playerName ?? null,
        });
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/tournaments/open error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/tournament/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const active = activeTournaments.get(id);
      if (active) {
        return res.json({
          id: active.id,
          status: active.status,
          currentRound: active.currentRound,
          maxPlayers: active.maxPlayers,
          players: active.players.map(p => ({ playerId: p.playerId, name: p.name, skin: p.skin, eliminated: p.eliminated })),
          matches: active.matches,
          prizes: TOURNAMENT_PRIZES,
        });
      }
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
      if (!t) return res.status(404).json({ error: "not_found" });
      const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
      const matches = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
      res.json({
        ...t,
        players: players.map(p => ({ playerId: p.playerId, name: p.playerName, skin: p.playerSkin, eliminated: p.eliminated === 1 })),
        matches: matches.map(m => ({
          id: m.id,
          roundName: m.roundName,
          matchIndex: m.matchIndex,
          player1Id: m.player1Id,
          player1Name: m.player1Name,
          player2Id: m.player2Id,
          player2Name: m.player2Name,
          winnerId: m.winnerId,
          winnerName: m.winnerName,
          roomId: m.roomId,
          status: m.status,
        })),
        prizes: TOURNAMENT_PRIZES,
      });
    } catch (e) {
      console.error("GET /api/tournament/:id error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/tournament/create", async (req, res) => {
    try {
      const rawSize = Number(req.body?.maxPlayers);
      const maxPlayers = [4, 8, 16].includes(rawSize) ? rawSize : 8;
      const [t] = await db.insert(tournaments).values({
        entryFee: TOURNAMENT_ENTRY_FEE,
        prizePool: 0,
        status: "open",
        maxPlayers,
      }).returning();
      // Broadcast to all clients so the new tournament appears in their list immediately
      io.emit("tournament_created", {
        id: t.id,
        status: "open",
        playerCount: 0,
        maxPlayers,
        entryFee: TOURNAMENT_ENTRY_FEE,
        prizePool: 0,
        createdAt: t.createdAt,
        hostPlayerName: null,
      });
      res.json(t);
    } catch (e) {
      console.error("POST /api/tournament/create error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/tournament/:id/join", async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { playerId, playerName, playerSkin, socketId } = req.body as {
        playerId: string;
        playerName: string;
        playerSkin: string;
        socketId: string;
      };

      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
      if (!t) return res.status(404).json({ error: "not_found" });
      if (t.status !== "open") return res.status(400).json({ error: "tournament_closed" });

      const existingPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId));
      if (existingPlayers.some(p => p.playerId === playerId)) return res.status(400).json({ error: "already_joined" });
      const maxCapacity = t.maxPlayers ?? TOURNAMENT_SIZE;
      if (existingPlayers.length >= maxCapacity) return res.status(400).json({ error: "tournament_full" });

      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile || profile.coins < TOURNAMENT_ENTRY_FEE) return res.status(400).json({ error: "insufficient_coins" });

      await db.update(playerProfiles).set({ coins: profile.coins - TOURNAMENT_ENTRY_FEE, updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));

      const seed = existingPlayers.length + 1;
      await db.insert(tournamentPlayers).values({ tournamentId, playerId, playerName, playerSkin, seed });
      tournamentPlayerSocketMap.set(playerId, socketId);

      const newPrizePool = t.prizePool + TOURNAMENT_ENTRY_FEE;
      await db.update(tournaments).set({ prizePool: newPrizePool }).where(eq(tournaments.id, tournamentId));

      const allPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId));
      const maxP = t.maxPlayers ?? TOURNAMENT_SIZE;

      if (allPlayers.length >= maxP) {
        await db.update(tournaments).set({ status: "in_progress", startedAt: new Date() }).where(eq(tournaments.id, tournamentId));

        const bracket = generateTournamentBracket(tournamentId, allPlayers.map(p => ({ playerId: p.playerId, name: p.playerName })), maxP);
        for (const m of bracket) {
          await db.insert(tournamentMatches).values({
            id: m.id,
            tournamentId,
            roundName: m.roundName,
            matchIndex: m.matchIndex,
            player1Id: m.player1Id,
            player1Name: m.player1Name,
            player2Id: m.player2Id,
            player2Name: m.player2Name,
            status: m.status,
          });
        }

        const activePlayers = allPlayers.map(p => ({
          playerId: p.playerId,
          socketId: tournamentPlayerSocketMap.get(p.playerId) || "",
          name: p.playerName,
          skin: p.playerSkin,
          eliminated: false,
        }));
        const rounds = getTournamentRounds(maxP);
        const active: ActiveTournament = {
          id: tournamentId,
          maxPlayers: maxP,
          players: activePlayers,
          matches: bracket,
          currentRound: rounds[0],
          status: "in_progress",
        };
        activeTournaments.set(tournamentId, active);
        for (const p of allPlayers) {
          playerTournamentMap.set(p.playerId, tournamentId);
        }

        io.emit("tournament_started", { tournamentId, bracket, players: activePlayers.map(p => ({ playerId: p.playerId, name: p.name, skin: p.skin })) });

        setTimeout(() => startTournamentRoundMatches(io, active), 3000);
      }

      io.emit("tournament_player_joined", { tournamentId, playerCount: allPlayers.length, maxPlayers: maxP, playerName });

      res.json({ success: true, playerCount: allPlayers.length, coins: profile.coins - TOURNAMENT_ENTRY_FEE });
    } catch (e) {
      console.error("POST /api/tournament/:id/join error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── LEAVE TOURNAMENT ──────────────────────────────────────────────────────
  // Allows a player to withdraw from an open (not yet started) tournament.
  // Refunds entry fee, updates the prize pool, broadcasts updated count,
  // and auto-deletes the tournament if it becomes empty.
  app.post("/api/tournament/:id/leave", async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { playerId } = req.body as { playerId: string };

      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
      if (!t) return res.status(404).json({ error: "not_found" });
      if (t.status !== "open") return res.status(400).json({ error: "tournament_already_started" });

      const [existing] = await db.select().from(tournamentPlayers).where(
        and(eq(tournamentPlayers.tournamentId, tournamentId), eq(tournamentPlayers.playerId, playerId))
      );
      if (!existing) return res.status(400).json({ error: "not_in_tournament" });

      const playerName = existing.playerName;

      // Remove the player
      await db.delete(tournamentPlayers).where(
        and(eq(tournamentPlayers.tournamentId, tournamentId), eq(tournamentPlayers.playerId, playerId))
      );
      tournamentPlayerSocketMap.delete(playerId);

      // Refund entry fee
      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (profile) {
        await db.update(playerProfiles).set({
          coins: profile.coins + TOURNAMENT_ENTRY_FEE,
          updatedAt: new Date(),
        }).where(eq(playerProfiles.id, playerId));
      }

      const remainingPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId));

      if (remainingPlayers.length === 0) {
        // Auto-delete the now-empty tournament
        await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId)).catch(() => {});
        await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tournamentId)).catch(() => {});
        await db.delete(tournaments).where(eq(tournaments.id, tournamentId)).catch(() => {});
        activeTournaments.delete(tournamentId);
        io.emit("tournament_cancelled", { tournamentId });
        console.log(`[leave] Tournament ${tournamentId} deleted — no players remaining`);
      } else {
        // Update prize pool
        const newPrizePool = Math.max(0, t.prizePool - TOURNAMENT_ENTRY_FEE);
        await db.update(tournaments).set({ prizePool: newPrizePool }).where(eq(tournaments.id, tournamentId));

        // Broadcast updated count to all clients
        io.emit("tournament_player_left", {
          tournamentId,
          playerCount: remainingPlayers.length,
          maxPlayers: t.maxPlayers ?? TOURNAMENT_SIZE,
          playerName,
        });
        console.log(`[leave] Player ${playerName} left tournament ${tournamentId} — ${remainingPlayers.length}/${t.maxPlayers ?? TOURNAMENT_SIZE} remaining`);
      }

      const [updatedProfile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      res.json({
        success: true,
        playerCount: remainingPlayers.length,
        coins: updatedProfile?.coins ?? (profile ? profile.coins + TOURNAMENT_ENTRY_FEE : 0),
      });
    } catch (e) {
      console.error("POST /api/tournament/:id/leave error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/tournament/:id/match-result", async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { matchId, winnerId, winnerName } = req.body as {
        matchId: string;
        winnerId: string;
        winnerName: string;
      };

      const active = activeTournaments.get(tournamentId);
      if (!active) return res.status(404).json({ error: "tournament_not_active" });

      const match = active.matches.find(m => m.id === matchId);
      if (!match) return res.status(404).json({ error: "match_not_found" });
      if (match.status === "completed") return res.status(400).json({ error: "match_already_completed" });
      if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
        return res.status(400).json({ error: "winner_not_in_match" });
      }

      await handleTournamentMatchResult(io, tournamentId, matchId, winnerId, winnerName);

      const updatedActive = activeTournaments.get(tournamentId);
      res.json({ success: true, status: updatedActive?.status || "unknown", currentRound: updatedActive?.currentRound || "unknown" });
    } catch (e) {
      console.error("POST /api/tournament/:id/match-result error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/player/:id/tournaments", async (req, res) => {
    try {
      const playerId = req.params.id;
      const entries = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.playerId, playerId));
      const result = [];
      for (const entry of entries) {
        const [t] = await db.select().from(tournaments).where(eq(tournaments.id, entry.tournamentId));
        if (t) {
          result.push({ ...t, placement: entry.placement, eliminated: entry.eliminated === 1 });
        }
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/player/:id/tournaments error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const type = (req.query.type as string) || "score";
      let players;
      if (type === "wins") {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.wins)).limit(50);
      } else if (type === "xp") {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.xp)).limit(50);
      } else if (type === "ranked") {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.elo)).limit(50);
      } else {
        players = await db.select().from(playerProfiles).orderBy(desc(playerProfiles.totalScore)).limit(50);
      }
      const result = players.map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        name: p.name,
        skin: p.equippedSkin,
        equippedTitle: p.equippedTitle || "beginner",
        level: p.level,
        wins: p.wins,
        score: p.totalScore,
        xp: p.xp,
        gamesPlayed: p.gamesPlayed,
        isVip: p.isVip && (!p.vipExpiresAt || new Date(p.vipExpiresAt) > new Date()),
        elo: p.elo ?? 1000,
        division: p.division ?? "silver",
        seasonWins: p.seasonWins ?? 0,
        seasonLosses: p.seasonLosses ?? 0,
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── RANKED SEASON ──────────────────────────────────────────────────────────
  app.get("/api/ranked/season", async (_req, res) => {
    try {
      const [season] = await db.select().from(seasons)
        .where(eq(seasons.status, "active")).limit(1);
      if (!season) return res.json({ season: null });
      const now = new Date();
      const daysLeft = Math.max(0, Math.ceil((new Date(season.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      res.json({ season: { ...season, daysLeft } });
    } catch (e) {
      console.error("GET /api/ranked/season error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── RANKED LEADERBOARD (dedicated endpoint) ────────────────────────────────
  app.get("/api/ranked/leaderboard", async (_req, res) => {
    try {
      const players = await db.select().from(playerProfiles)
        .orderBy(desc(playerProfiles.elo)).limit(50);
      const result = players.map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        name: p.name,
        skin: p.equippedSkin,
        equippedTitle: p.equippedTitle || "beginner",
        level: p.level,
        wins: p.wins,
        score: p.totalScore,
        xp: p.xp,
        gamesPlayed: p.gamesPlayed,
        isVip: p.isVip && (!p.vipExpiresAt || new Date(p.vipExpiresAt) > new Date()),
        elo: p.elo ?? 1000,
        division: p.division ?? "silver",
        seasonWins: p.seasonWins ?? 0,
        seasonLosses: p.seasonLosses ?? 0,
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/ranked/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── CLAN WARS ─────────────────────────────────────────────────────────────

  // GET /api/clans/leaderboard — top 10 clans by total war score
  app.get("/api/clans/leaderboard", async (_req, res) => {
    try {
      const top = await db.select().from(clans).orderBy(desc(clans.totalWarScore)).limit(10);
      const result = await Promise.all(top.map(async (c, idx) => {
        const memberCount = await db.select({ count: sql<number>`count(*)` }).from(clanMembers).where(eq(clanMembers.clanId, c.id));
        return { ...c, rank: idx + 1, memberCount: Number(memberCount[0]?.count ?? 0) };
      }));
      res.json(result);
    } catch (e) {
      console.error("GET /api/clans/leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/clans/search?q= — search clans by name
  app.get("/api/clans/search", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (q.length < 2) return res.json([]);
      const results = await db.select().from(clans).where(ilike(clans.name, `%${q}%`)).limit(20);
      const withCounts = await Promise.all(results.map(async (c) => {
        const memberCount = await db.select({ count: sql<number>`count(*)` }).from(clanMembers).where(eq(clanMembers.clanId, c.id));
        return { ...c, memberCount: Number(memberCount[0]?.count ?? 0) };
      }));
      return res.json(withCounts);
    } catch (e) {
      console.error("GET /api/clans/search error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/clans/:id — get clan detail with members
  app.get("/api/clans/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [clan] = await db.select().from(clans).where(eq(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });

      const members = await db.select({
        id: clanMembers.id,
        playerId: clanMembers.playerId,
        warScore: clanMembers.warScore,
        role: clanMembers.role,
        joinedAt: clanMembers.joinedAt,
        name: playerProfiles.name,
        equippedSkin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
      }).from(clanMembers)
        .innerJoin(playerProfiles, eq(clanMembers.playerId, playerProfiles.id))
        .where(eq(clanMembers.clanId, id))
        .orderBy(desc(clanMembers.warScore));

      const leaderboardRank = await db.select({ count: sql<number>`count(*)` }).from(clans).where(sql`total_war_score > ${clan.totalWarScore}`);
      const rank = Number(leaderboardRank[0]?.count ?? 0) + 1;

      res.json({ ...clan, members, rank });
    } catch (e) {
      console.error("GET /api/clans/:id error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/clans/create — costs 500 coins
  app.post("/api/clans/create", async (req, res) => {
    try {
      const { playerId, name, emoji } = req.body as { playerId: string; name: string; emoji: string };
      if (!playerId || !name?.trim() || !emoji) return res.status(400).json({ error: "missing_params" });

      const [player] = await db.select({ coins: playerProfiles.coins, clanId: playerProfiles.clanId }).from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      if (player.clanId) return res.status(400).json({ error: "already_in_clan" });
      if (player.coins < 500) return res.status(400).json({ error: "insufficient_coins" });

      const [existing] = await db.select({ id: clans.id }).from(clans).where(ilike(clans.name, name.trim())).limit(1);
      if (existing) return res.status(400).json({ error: "name_taken" });

      const result = await db.transaction(async (tx) => {
        const [newClan] = await tx.insert(clans).values({ name: name.trim(), emoji, leaderId: playerId }).returning();
        await tx.insert(clanMembers).values({ clanId: newClan.id, playerId, role: "leader", warScore: 0 });
        await tx.update(playerProfiles).set({ coins: player.coins - 500, clanId: newClan.id, updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));
        return { clan: newClan, coins: player.coins - 500 };
      });

      res.json(result);
    } catch (e) {
      console.error("POST /api/clans/create error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/clans/:id/join
  app.post("/api/clans/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body as { playerId: string };
      if (!playerId) return res.status(400).json({ error: "missing_params" });

      const [clan] = await db.select().from(clans).where(eq(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });

      const [player] = await db.select({ clanId: playerProfiles.clanId }).from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });
      if (player.clanId) return res.status(400).json({ error: "already_in_clan" });

      const memberCount = await db.select({ count: sql<number>`count(*)` }).from(clanMembers).where(eq(clanMembers.clanId, id));
      if (Number(memberCount[0]?.count ?? 0) >= 20) return res.status(400).json({ error: "clan_full" });

      await db.transaction(async (tx) => {
        await tx.insert(clanMembers).values({ clanId: id, playerId, role: "member", warScore: 0 });
        await tx.update(playerProfiles).set({ clanId: id, updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));
      });

      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/join error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/clans/:id/leave
  app.post("/api/clans/:id/leave", async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body as { playerId: string };
      if (!playerId) return res.status(400).json({ error: "missing_params" });

      const [clan] = await db.select().from(clans).where(eq(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });

      // Verify the player is actually a member of THIS clan
      const [membership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.playerId, playerId))).limit(1);
      if (!membership) return res.status(400).json({ error: "not_a_member" });

      await db.transaction(async (tx) => {
        await tx.delete(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.playerId, playerId)));
        // Only null the profile's clanId if it still points to THIS clan
        await tx.update(playerProfiles).set({ clanId: null, updatedAt: new Date() }).where(and(eq(playerProfiles.id, playerId), eq(playerProfiles.clanId, id)));

        // Recalculate totalWarScore after member left
        const remaining = await tx.select({ warScore: clanMembers.warScore }).from(clanMembers).where(eq(clanMembers.clanId, id));
        const total = remaining.reduce((sum, m) => sum + (m.warScore ?? 0), 0);
        await tx.update(clans).set({ totalWarScore: total }).where(eq(clans.id, id));

        // If leader left, disband or promote
        if (clan.leaderId === playerId) {
          const others = await tx.select().from(clanMembers).where(eq(clanMembers.clanId, id)).orderBy(desc(clanMembers.warScore)).limit(1);
          if (others.length > 0) {
            await tx.update(clans).set({ leaderId: others[0].playerId }).where(eq(clans.id, id));
            await tx.update(clanMembers).set({ role: "leader" }).where(and(eq(clanMembers.clanId, id), eq(clanMembers.playerId, others[0].playerId)));
          } else {
            await tx.delete(clans).where(eq(clans.id, id));
          }
        }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/leave error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/clans/:id/kick — leader kicks a member
  app.post("/api/clans/:id/kick", async (req, res) => {
    try {
      const { id } = req.params;
      const { leaderId, targetPlayerId } = req.body as { leaderId: string; targetPlayerId: string };
      if (!leaderId || !targetPlayerId) return res.status(400).json({ error: "missing_params" });

      const [clan] = await db.select().from(clans).where(eq(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      if (clan.leaderId !== leaderId) return res.status(403).json({ error: "not_leader" });
      if (targetPlayerId === leaderId) return res.status(400).json({ error: "cannot_kick_self" });

      // Verify target is actually a member of THIS clan before touching their profile
      const [targetMembership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.playerId, targetPlayerId))).limit(1);
      if (!targetMembership) return res.status(400).json({ error: "not_a_member" });

      await db.transaction(async (tx) => {
        await tx.delete(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.playerId, targetPlayerId)));
        // Only null profile.clanId if it still points to THIS clan
        await tx.update(playerProfiles).set({ clanId: null, updatedAt: new Date() }).where(and(eq(playerProfiles.id, targetPlayerId), eq(playerProfiles.clanId, id)));
        const remaining = await tx.select({ warScore: clanMembers.warScore }).from(clanMembers).where(eq(clanMembers.clanId, id));
        const total = remaining.reduce((sum, m) => sum + (m.warScore ?? 0), 0);
        await tx.update(clans).set({ totalWarScore: total }).where(eq(clans.id, id));
      });

      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/kick error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/clans/:id/rename — leader renames clan
  app.post("/api/clans/:id/rename", async (req, res) => {
    try {
      const { id } = req.params;
      const { leaderId, name } = req.body as { leaderId: string; name: string };
      if (!leaderId || !name?.trim()) return res.status(400).json({ error: "missing_params" });

      const [clan] = await db.select().from(clans).where(eq(clans.id, id)).limit(1);
      if (!clan) return res.status(404).json({ error: "not_found" });
      if (clan.leaderId !== leaderId) return res.status(403).json({ error: "not_leader" });

      // Enforce unique clan name on rename (same as create)
      const trimmed = name.trim();
      const [existing] = await db.select({ id: clans.id }).from(clans).where(and(ilike(clans.name, trimmed), sql`${clans.id} != ${id}`)).limit(1);
      if (existing) return res.status(400).json({ error: "name_taken" });

      await db.update(clans).set({ name: trimmed }).where(eq(clans.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/clans/:id/rename error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── BATTLE PASS ─────────────────────────────────────────────────────────────

  // GET /api/battle-pass/:playerId — returns current season state + tier list
  app.get("/api/battle-pass/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const [activeSeason] = await db.select().from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });

      const pass = await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      const tiers = await db.select().from(battlePassTiers)
        .where(eq(battlePassTiers.seasonId, activeSeason.id))
        .orderBy(asc(battlePassTiers.tier));

      res.json({
        season: { id: activeSeason.id, name: activeSeason.name, endDate: activeSeason.endDate },
        passXp: pass.passXp,
        currentTier: pass.currentTier,
        premiumUnlocked: pass.premiumUnlocked,
        claimedTiers: Array.isArray(pass.claimedTiers) ? pass.claimedTiers : [],
        xpPerTier: BP_XP_PER_TIER,
        premiumCost: BP_PREMIUM_COST,
        tiers,
      });
    } catch (e) {
      console.error("GET /api/battle-pass/:playerId error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/battle-pass/:playerId/buy-premium — deduct 1000 coins, unlock premium (atomic)
  app.post("/api/battle-pass/:playerId/buy-premium", async (req, res) => {
    try {
      const { playerId } = req.params;
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });

      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);

      let newCoins: number | undefined;
      await db.transaction(async (tx) => {
        // Lock the profile row and check coins atomically
        const [profile] = await tx.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
        if (!profile) throw Object.assign(new Error("player_not_found"), { statusCode: 404 });
        if (profile.coins < BP_PREMIUM_COST) throw Object.assign(new Error("insufficient_coins"), { statusCode: 400 });

        // Atomically unlock premium only if not already unlocked (prevents double spend on concurrent requests)
        const updated = await tx.update(playerBattlePass).set({ premiumUnlocked: true, updatedAt: new Date() })
          .where(and(
            eq(playerBattlePass.playerId, playerId),
            eq(playerBattlePass.seasonId, activeSeason.id),
            eq(playerBattlePass.premiumUnlocked, false),
          )).returning({ id: playerBattlePass.id });
        if (updated.length === 0) throw Object.assign(new Error("already_premium"), { statusCode: 400 });

        await tx.update(playerProfiles).set({ coins: profile.coins - BP_PREMIUM_COST, updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));
        newCoins = profile.coins - BP_PREMIUM_COST;
      });

      res.json({ ok: true, coins: newCoins });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      if (err.statusCode && err.message) return res.status(err.statusCode).json({ error: err.message });
      console.error("POST /api/battle-pass/:playerId/buy-premium error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/battle-pass/:playerId/claim/:tier — validate & grant reward
  app.post("/api/battle-pass/:playerId/claim/:tier", async (req, res) => {
    try {
      const { playerId, tier: tierStr } = req.params;
      const { track } = req.body as { track: "free" | "premium" };
      const tierNum = parseInt(tierStr, 10);
      if (isNaN(tierNum) || tierNum < 1 || tierNum > 30) return res.status(400).json({ error: "invalid_tier" });
      if (track !== "free" && track !== "premium") return res.status(400).json({ error: "invalid_track" });

      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });

      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);

      const [tierDef] = await db.select().from(battlePassTiers)
        .where(and(eq(battlePassTiers.seasonId, activeSeason.id), eq(battlePassTiers.tier, tierNum))).limit(1);
      if (!tierDef) return res.status(404).json({ error: "tier_not_found" });

      const rewardType = track === "free" ? tierDef.freeRewardType : tierDef.premiumRewardType;
      const rewardId   = track === "free" ? tierDef.freeRewardId   : tierDef.premiumRewardId;
      const rewardAmt  = track === "free" ? tierDef.freeRewardAmount : tierDef.premiumRewardAmount;
      const claimedKey = `${tierNum}_${track}`;

      let resultNewCoins = 0;
      const grantedLabel: string[] = [];

      await db.transaction(async (tx) => {
        // Re-read pass and profile inside transaction to prevent race conditions
        const [pass] = await tx.select().from(playerBattlePass)
          .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id))).limit(1);
        if (!pass) throw Object.assign(new Error("pass_not_found"), { statusCode: 404 });
        if (pass.currentTier < tierNum) throw Object.assign(new Error("tier_not_reached"), { statusCode: 400 });
        if (track === "premium" && !pass.premiumUnlocked) throw Object.assign(new Error("premium_not_unlocked"), { statusCode: 403 });

        const claimedArr: string[] = Array.isArray(pass.claimedTiers) ? pass.claimedTiers : [];
        if (claimedArr.includes(claimedKey)) throw Object.assign(new Error("already_claimed"), { statusCode: 400 });

        const [profile] = await tx.select().from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
        if (!profile) throw Object.assign(new Error("player_not_found"), { statusCode: 404 });

        const profileUpdates: Partial<typeof playerProfiles.$inferInsert> = { updatedAt: new Date() };

        if (rewardType === "coins") {
          profileUpdates.coins = profile.coins + rewardAmt;
          resultNewCoins = profile.coins + rewardAmt;
          grantedLabel.push(`🪙 +${rewardAmt}`);
        } else {
          resultNewCoins = profile.coins;
          if (rewardType === "powerCard" && rewardId) {
            const pc = profile.powerCards ?? { time: 0, freeze: 0, hint: 0 };
            profileUpdates.powerCards = { ...pc, [rewardId]: ((pc as Record<string, number>)[rewardId] ?? 0) + rewardAmt };
            grantedLabel.push(`🃏 +${rewardAmt} ${rewardId}`);
          } else if (rewardType === "skin" && rewardId) {
            const owned = Array.isArray(profile.ownedSkins) ? (profile.ownedSkins as string[]) : [];
            if (!owned.includes(rewardId)) {
              profileUpdates.ownedSkins = [...owned, rewardId];
              grantedLabel.push(`👗 ${rewardId}`);
            }
          } else if (rewardType === "title" && rewardId) {
            const owned = Array.isArray(profile.ownedTitles) ? (profile.ownedTitles as string[]) : [];
            if (!owned.includes(rewardId)) {
              profileUpdates.ownedTitles = [...owned, rewardId];
              grantedLabel.push(`👑 ${rewardId}`);
            }
          }
        }

        await tx.update(playerProfiles).set(profileUpdates as Parameters<typeof tx.update>[1]).where(eq(playerProfiles.id, playerId));
        await tx.update(playerBattlePass).set({
          claimedTiers: [...claimedArr, claimedKey],
          updatedAt: new Date(),
        }).where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id)));
      });

      res.json({
        ok: true,
        granted: grantedLabel,
        rewardType,
        rewardId: rewardId ?? null,
        rewardAmount: rewardAmt,
        newCoins: resultNewCoins,
      });
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number };
      if (err.statusCode && err.message) return res.status(err.statusCode).json({ error: err.message });
      console.error("POST /api/battle-pass/:playerId/claim/:tier error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── FRIENDS ───────────────────────────────────────────────────────────────
  app.get("/api/players/search", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      const myId = (req.query.playerId as string) || "";
      if (q.length < 2) return res.json([]);

      const selectFields = {
        id: playerProfiles.id,
        playerCode: playerProfiles.playerCode,
        playerTag: playerProfiles.playerTag,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
        wins: playerProfiles.wins,
      };

      // ── WM-XXXXX display ID search ───────────────────────────────────────
      const wmMatch = q.match(/^WM-?(\d+)$/i);
      if (wmMatch) {
        const tagNum = parseInt(wmMatch[1], 10);
        if (isNaN(tagNum)) return res.json([]);
        const whereClause = myId
          ? and(eq(playerProfiles.playerTag, tagNum), ne(playerProfiles.id, myId))
          : eq(playerProfiles.playerTag, tagNum);
        const rows = await db.select(selectFields).from(playerProfiles).where(whereClause).limit(5);
        return res.json(rows.map(r => ({ ...r, displayId: r.playerTag ? `WM-${r.playerTag.toString().padStart(5, "0")}` : null })));
      }

      if (q.includes("#")) {
        const hashIdx = q.lastIndexOf("#");
        const namePart = q.slice(0, hashIdx).trim();
        const tagStr = q.slice(hashIdx + 1).trim();
        const tagNum = parseInt(tagStr, 10);

        if (isNaN(tagNum)) return res.json([]);

        let whereClause;
        if (namePart) {
          // ── Name#tag format: exact name + exact tag ──────────────────────
          const nameCondition = ilike(playerProfiles.name, namePart);
          const tagCondition = eq(playerProfiles.playerTag, tagNum);
          whereClause = myId
            ? and(nameCondition, tagCondition, ne(playerProfiles.id, myId))
            : and(nameCondition, tagCondition);
        } else {
          // ── #tag only: search by tag number alone ──────────────────────
          const tagCondition = eq(playerProfiles.playerTag, tagNum);
          whereClause = myId ? and(tagCondition, ne(playerProfiles.id, myId)) : tagCondition;
        }

        const rows = await db.select(selectFields).from(playerProfiles)
          .where(whereClause)
          .limit(10);
        return res.json(rows.map(r => ({ ...r, displayId: r.playerTag ? `WM-${r.playerTag.toString().padStart(5, "0")}` : null })));
      }

      // ── Normal search: partial name OR playerCode match ──────────────────
      // isNotNull guard ensures NULL player_code doesn't break the OR condition
      const searchCondition = or(
        ilike(playerProfiles.name, `%${q}%`),
        and(isNotNull(playerProfiles.playerCode), ilike(playerProfiles.playerCode, `%${q}%`)),
      );
      const excludeSelf = myId ? ne(playerProfiles.id, myId) : undefined;
      const whereClause = excludeSelf ? and(searchCondition, excludeSelf) : searchCondition;

      const rows = await db.select(selectFields).from(playerProfiles)
        .where(whereClause)
        .orderBy(desc(playerProfiles.wins))
        .limit(20);

      // Auto-fix: if any returned player has no playerCode, assign one async
      const missing = rows.filter(r => !r.playerCode);
      if (missing.length > 0) {
        Promise.all(missing.map(async (r) => {
          const code = await ensurePlayerCode(r.id);
          await db.update(playerProfiles).set({ playerCode: code }).where(eq(playerProfiles.id, r.id));
        })).catch(() => {});
      }

      const withDisplayId = rows.map(r => ({
        ...r,
        displayId: r.playerTag ? `WM-${r.playerTag.toString().padStart(5, "0")}` : null,
      }));
      res.json(withDisplayId);
    } catch (e) {
      console.error("GET /api/players/search error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── FRIEND LIST ───────────────────────────────────────────────────────────
  app.get("/api/friends/list/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const rows = await db.select().from(friends).where(
        or(eq(friends.playerId, playerId), eq(friends.friendId, playerId))
      );
      const profileFields = {
        id: playerProfiles.id,
        playerTag: playerProfiles.playerTag,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
        wins: playerProfiles.wins,
      };
      const result = [];
      for (const row of rows) {
        const otherId = row.playerId === playerId ? row.friendId : row.playerId;
        const [p] = await db.select(profileFields).from(playerProfiles).where(eq(playerProfiles.id, otherId));
        if (p) result.push({ friendshipId: row.id, friend: p, since: row.createdAt });
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/friends/list error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── FRIEND REQUESTS ───────────────────────────────────────────────────────
  app.get("/api/friends/requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const rows = await db.select().from(friendRequests).where(
        and(
          or(eq(friendRequests.senderId, playerId), eq(friendRequests.receiverId, playerId)),
          eq(friendRequests.status, "pending")
        )
      ).orderBy(desc(friendRequests.createdAt));
      const profileFields = {
        id: playerProfiles.id,
        playerTag: playerProfiles.playerTag,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
        wins: playerProfiles.wins,
      };
      const result = [];
      for (const row of rows) {
        const otherId = row.senderId === playerId ? row.receiverId : row.senderId;
        const [p] = await db.select(profileFields).from(playerProfiles).where(eq(playerProfiles.id, otherId));
        if (p) result.push({ requestId: row.id, isSender: row.senderId === playerId, player: p, createdAt: row.createdAt });
      }
      res.json(result);
    } catch (e) {
      console.error("GET /api/friends/requests error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── SEND FRIEND REQUEST ───────────────────────────────────────────────────
  app.post("/api/friends/request", async (req, res) => {
    try {
      const { senderId, receiverId } = req.body as { senderId: string; receiverId: string };
      if (!senderId || !receiverId) return res.status(400).json({ error: "missing_fields" });
      if (senderId === receiverId) return res.status(400).json({ error: "cannot_add_self" });

      // Check not already friends
      const alreadyFriends = await db.select({ id: friends.id }).from(friends).where(
        or(
          and(eq(friends.playerId, senderId), eq(friends.friendId, receiverId)),
          and(eq(friends.playerId, receiverId), eq(friends.friendId, senderId))
        )
      ).limit(1);
      if (alreadyFriends.length > 0) return res.status(400).json({ error: "already_friends" });

      // Check no pending request already exists
      const existing = await db.select().from(friendRequests).where(
        and(
          or(
            and(eq(friendRequests.senderId, senderId), eq(friendRequests.receiverId, receiverId)),
            and(eq(friendRequests.senderId, receiverId), eq(friendRequests.receiverId, senderId))
          ),
          eq(friendRequests.status, "pending")
        )
      ).limit(1);
      if (existing.length > 0) return res.status(400).json({ error: "request_exists", status: existing[0].status });

      const [row] = await db.insert(friendRequests).values({ senderId, receiverId, status: "pending" }).returning();
      res.json({ success: true, requestId: row.id });
    } catch (e) {
      console.error("POST /api/friends/request error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── ACCEPT FRIEND REQUEST ─────────────────────────────────────────────────
  app.post("/api/friends/accept", async (req, res) => {
    try {
      const { requestId, playerId } = req.body as { requestId: string; playerId: string };
      if (!requestId || !playerId) return res.status(400).json({ error: "missing_fields" });

      const [req_] = await db.select().from(friendRequests)
        .where(and(eq(friendRequests.id, requestId), eq(friendRequests.receiverId, playerId), eq(friendRequests.status, "pending")));
      if (!req_) return res.status(404).json({ error: "request_not_found" });

      await db.transaction(async (tx) => {
        await tx.update(friendRequests).set({ status: "accepted" }).where(eq(friendRequests.id, requestId));
        // One canonical row per pair; list endpoint queries both directions via OR
        await tx.insert(friends).values({ playerId: req_.senderId, friendId: req_.receiverId });
      });
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/accept error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── DECLINE FRIEND REQUEST ────────────────────────────────────────────────
  app.post("/api/friends/decline", async (req, res) => {
    try {
      const { requestId, playerId } = req.body as { requestId: string; playerId: string };
      if (!requestId || !playerId) return res.status(400).json({ error: "missing_fields" });

      await db.update(friendRequests)
        .set({ status: "declined" })
        .where(and(eq(friendRequests.id, requestId), eq(friendRequests.receiverId, playerId)));
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/decline error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── REMOVE FRIEND ─────────────────────────────────────────────────────────
  app.delete("/api/friends/:playerId/:friendId", async (req, res) => {
    try {
      const { playerId, friendId } = req.params;
      await db.delete(friends).where(
        or(
          and(eq(friends.playerId, playerId), eq(friends.friendId, friendId)),
          and(eq(friends.playerId, friendId), eq(friends.friendId, playerId))
        )
      );
      res.json({ success: true });
    } catch (e) {
      console.error("DELETE /api/friends error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── DAILY LOGIN STREAK ────────────────────────────────────────────────────
  const LOGIN_STREAK_REWARDS: Record<number, number> = {
    1: 15, 2: 20, 3: 30, 4: 25, 5: 35, 6: 50, 7: 100,
    14: 150, 21: 200, 30: 500,
  };
  function getLoginReward(day: number): number {
    if (LOGIN_STREAK_REWARDS[day]) return LOGIN_STREAK_REWARDS[day];
    return 15;
  }

  app.post("/api/player/:id/daily-login", async (req, res) => {
    try {
      const { id: playerId } = req.params;
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }

      if (profile.lastLoginDate === today) {
        return res.json({
          success: false,
          error: "already_claimed",
          streak: profile.loginStreak,
          longestStreak: profile.longestLoginStreak,
          lastLoginDate: profile.lastLoginDate,
        });
      }

      const continuesStreak = profile.lastLoginDate === yesterdayStr;
      const newStreak = continuesStreak ? (profile.loginStreak ?? 0) + 1 : 1;
      const longestStreak = Math.max(newStreak, profile.longestLoginStreak ?? 0);
      const reward = getLoginReward(newStreak);

      const updated = await db.update(playerProfiles).set({
        loginStreak: newStreak,
        lastLoginDate: today,
        longestLoginStreak: longestStreak,
        coins: sql`coins + ${reward}`,
        updatedAt: new Date(),
      }).where(
        and(
          eq(playerProfiles.id, playerId),
          sql`${playerProfiles.lastLoginDate} IS DISTINCT FROM ${today}`
        )
      ).returning();

      if (!updated.length) {
        return res.json({ success: false, error: "already_claimed", streak: profile.loginStreak, longestStreak: profile.longestLoginStreak, lastLoginDate: profile.lastLoginDate });
      }

      syncAchievementProgress(playerId, updated[0]).catch(() => {});

      res.json({
        success: true,
        streak: newStreak,
        longestStreak,
        reward,
        lastLoginDate: today,
      });
    } catch (e) {
      console.error("POST /api/player/daily-login error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });

  // ── WEEKLY CHALLENGE ─────────────────────────────────────────────────────
  const WEEKLY_TASK_POOL = [
    { key: "weekly_win_20",    titleAr: "اربح 20 مباراة هذا الأسبوع",   descAr: "فُز بـ 20 مباراة خلال هذا الأسبوع", icon: "🏆", target: 20,  type: "wins",  rewardCoins: 200, rewardXp: 150 },
    { key: "weekly_play_30",   titleAr: "العب 30 مباراة هذا الأسبوع",   descAr: "شارك في 30 مباراة خلال هذا الأسبوع", icon: "🎮", target: 30,  type: "games", rewardCoins: 150, rewardXp: 100 },
    { key: "weekly_score_1000", titleAr: "اجمع 1000 نقطة هذا الأسبوع", descAr: "حصّل 1000 نقطة خلال هذا الأسبوع",    icon: "⭐", target: 1000, type: "score", rewardCoins: 250, rewardXp: 200 },
    { key: "weekly_win_10",    titleAr: "اربح 10 مباريات هذا الأسبوع",  descAr: "فُز بـ 10 مباريات خلال هذا الأسبوع", icon: "🎖️", target: 10,  type: "wins",  rewardCoins: 120, rewardXp: 80  },
  ];

  function getWeekId(): string {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset);
    const jan1 = new Date(monday.getFullYear(), 0, 1);
    const days = Math.floor((monday.getTime() - jan1.getTime()) / 86400000);
    const weekNum = Math.ceil((days + 1) / 7);
    return `${monday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  function pickWeeklyTask(): typeof WEEKLY_TASK_POOL[number] {
    const weekId = getWeekId();
    let hash = 0;
    for (let i = 0; i < weekId.length; i++) { hash = ((hash << 5) - hash) + weekId.charCodeAt(i); hash |= 0; }
    return WEEKLY_TASK_POOL[Math.abs(hash) % WEEKLY_TASK_POOL.length];
  }

  // ── DAILY TASKS ───────────────────────────────────────────────────────────
  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  async function syncTaskProgress(playerId: string, profile: { wins: number; gamesPlayed: number; totalScore: number }) {
    const today = getTodayDate();
    const rows = await db.select().from(playerDailyTasks)
      .where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));
    for (const row of rows) {
      if (row.claimed === 1) continue;
      const def = TASK_POOL.find(d => d.key === row.taskKey);
      if (!def) continue;
      let newProgress = row.progress ?? 0;
      if (def.type === "wins")  newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
      if (def.type === "games") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
      if (def.type === "score") newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
      if (newProgress !== (row.progress ?? 0)) {
        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq(playerDailyTasks.id, row.id));
      }
    }
  }

  async function syncAchievementProgress(playerId: string, profile: { wins: number; gamesPlayed: number; level: number; bestStreak: number; loginStreak?: number; longestLoginStreak?: number; totalScore?: number }) {
    let tournamentsPlayed: number | null = null;
    for (const def of ACHIEVEMENT_DEFS) {
      let progress = 0;
      if (def.type === "wins")         progress = Math.min(profile.wins, def.target);
      if (def.type === "games")        progress = Math.min(profile.gamesPlayed, def.target);
      if (def.type === "level")        progress = Math.min(profile.level, def.target);
      if (def.type === "streak")       progress = Math.min(profile.bestStreak, def.target);
      if (def.type === "login_streak") progress = Math.min(profile.longestLoginStreak ?? 0, def.target);
      if (def.type === "total_score")  progress = Math.min(profile.totalScore ?? 0, def.target);
      if (def.type === "tournaments") {
        if (tournamentsPlayed === null) {
          const result = await db.select({ count: sql<number>`count(*)` }).from(tournamentPlayers).where(eq(tournamentPlayers.playerId, playerId));
          tournamentsPlayed = Number(result[0]?.count ?? 0);
        }
        progress = Math.min(tournamentsPlayed, def.target);
      }
      const unlocked = progress >= def.target;
      const [existing] = await db.select().from(playerAchievements)
        .where(and(eq(playerAchievements.playerId, playerId), eq(playerAchievements.achievementKey, def.key)));
      if (existing) {
        if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
          await db.update(playerAchievements).set({
            progress, unlocked: unlocked ? 1 : 0,
            unlockedAt: unlocked && !existing.unlockedAt ? new Date() : existing.unlockedAt,
          }).where(eq(playerAchievements.id, existing.id));
        }
      } else {
        await db.insert(playerAchievements).values({
          playerId, achievementKey: def.key, progress, unlocked: unlocked ? 1 : 0,
          unlockedAt: unlocked ? new Date() : undefined,
        });
      }
    }
  }

  app.get("/api/tasks/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const today = getTodayDate();
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }

      let todayRows = await db.select().from(playerDailyTasks)
        .where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));

      if (todayRows.length === 0) {
        const chosen = pickDailyTasks();
        for (const def of chosen) {
          await db.insert(playerDailyTasks).values({
            playerId,
            taskKey: def.key,
            assignedDate: today,
            progress: 0,
            baselineWins: profile.wins,
            baselineGames: profile.gamesPlayed,
            baselineScore: profile.totalScore,
          });
        }
        todayRows = await db.select().from(playerDailyTasks)
          .where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));
      }

      const dailyResult = todayRows.map(row => {
        const def = TASK_POOL.find(d => d.key === row.taskKey);
        if (!def) return null;
        let progress = row.progress ?? 0;
        if (def.type === "wins")   progress = Math.max(progress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
        if (def.type === "games")  progress = Math.max(progress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
        if (def.type === "score")  progress = Math.max(progress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
        return {
          ...def,
          rowId: row.id,
          progress,
          completed: progress >= def.target,
          claimed: row.claimed === 1,
          isWeekly: false,
        };
      }).filter(Boolean);

      const weekId = getWeekId();
      const weeklyDef = pickWeeklyTask();
      const weeklyTaskKey = `${weeklyDef.key}_${weekId}`;
      let [weeklyRow] = await db.select().from(playerDailyTasks)
        .where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.taskKey, weeklyTaskKey)));

      if (!weeklyRow) {
        [weeklyRow] = await db.insert(playerDailyTasks).values({
          playerId,
          taskKey: weeklyTaskKey,
          assignedDate: weekId,
          progress: 0,
          baselineWins: profile.wins,
          baselineGames: profile.gamesPlayed,
          baselineScore: profile.totalScore,
        }).returning();
      }

      let weeklyProgress = weeklyRow.progress ?? 0;
      if (weeklyDef.type === "wins")  weeklyProgress = Math.max(weeklyProgress, Math.min(Math.max(0, profile.wins - (weeklyRow.baselineWins ?? 0)), weeklyDef.target));
      if (weeklyDef.type === "games") weeklyProgress = Math.max(weeklyProgress, Math.min(Math.max(0, profile.gamesPlayed - (weeklyRow.baselineGames ?? 0)), weeklyDef.target));
      if (weeklyDef.type === "score") weeklyProgress = Math.max(weeklyProgress, Math.min(Math.max(0, profile.totalScore - (weeklyRow.baselineScore ?? 0)), weeklyDef.target));

      const weeklyResult = {
        ...weeklyDef,
        key: weeklyTaskKey,
        rowId: weeklyRow.id,
        progress: weeklyProgress,
        completed: weeklyProgress >= weeklyDef.target,
        claimed: weeklyRow.claimed === 1,
        isWeekly: true,
      };

      res.json([weeklyResult, ...dailyResult]);
    } catch (e) {
      console.error("GET /api/tasks error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/tasks/:playerId/:taskKey/claim", async (req, res) => {
    try {
      const { playerId, taskKey } = req.params;
      const today = getTodayDate();

      const isWeekly = taskKey.startsWith("weekly_");
      let def: { key: string; titleAr: string; descAr: string; icon: string; target: number; type: string; rewardCoins: number; rewardXp: number } | undefined;
      if (isWeekly) {
        const baseKey = taskKey.replace(/_\d{4}-W\d{2}$/, "");
        def = WEEKLY_TASK_POOL.find(d => d.key === baseKey);
      } else {
        def = DAILY_TASK_DEFS.find(d => d.key === taskKey);
      }
      if (!def) return res.json({ success: false, error: "unknown_task" });

      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) return res.json({ success: false, error: "player_not_found" });

      const assignedDate = isWeekly ? getWeekId() : today;
      let [row] = await db.select().from(playerDailyTasks)
        .where(and(
          eq(playerDailyTasks.playerId, playerId),
          eq(playerDailyTasks.taskKey, taskKey),
          eq(playerDailyTasks.assignedDate, assignedDate),
        ));

      if (!row) {
        const [inserted] = await db.insert(playerDailyTasks).values({
          playerId,
          taskKey,
          assignedDate,
          progress: 0,
          baselineWins: profile.wins,
          baselineGames: profile.gamesPlayed,
          baselineScore: profile.totalScore,
        }).returning();
        row = inserted;
      }

      if (row.claimed === 1) return res.json({ success: false, error: "already_claimed" });

      let progress = row.progress ?? 0;
      if (def.type === "wins")  progress = Math.max(progress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
      if (def.type === "games") progress = Math.max(progress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
      if (def.type === "score") progress = Math.max(progress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));

      if (progress < def.target) return res.json({ success: false, error: "not_completed" });

      await db.update(playerDailyTasks)
        .set({ claimed: 1, claimedAt: new Date(), progress })
        .where(eq(playerDailyTasks.id, row.id));

      await db.update(playerProfiles).set({
        coins: sql`coins + ${def.rewardCoins}`,
        xp: sql`xp + ${def.rewardXp}`,
        updatedAt: new Date(),
      }).where(eq(playerProfiles.id, playerId));

      let titleAwarded: string | null = null;
      if (isWeekly) {
        const WEEKLY_TITLE_POOL = ["word_master", "lightning", "streak_lord"];
        const weekId = getWeekId();
        let titleHash = 0;
        for (let i = 0; i < weekId.length; i++) { titleHash = ((titleHash << 5) - titleHash) + weekId.charCodeAt(i); titleHash |= 0; }
        titleAwarded = WEEKLY_TITLE_POOL[Math.abs(titleHash) % WEEKLY_TITLE_POOL.length];

        const freshProfile = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
        if (freshProfile.length > 0) {
          const currentTitles: string[] = Array.isArray(freshProfile[0].ownedTitles) ? freshProfile[0].ownedTitles as string[] : [];
          if (!currentTitles.includes(titleAwarded)) {
            await db.update(playerProfiles).set({
              ownedTitles: [...currentTitles, titleAwarded],
              updatedAt: new Date(),
            }).where(eq(playerProfiles.id, playerId));
          }
        }
      }

      // ── Award Battle Pass XP for completing a task ─────────────────────
      awardBattlePassXp(playerId, BP_XP_GAME).catch((e) => console.error("[battle-pass] daily task xp error:", e));

      res.json({ success: true, coinsEarned: def.rewardCoins, xpEarned: def.rewardXp, titleAwarded });
    } catch (e) {
      console.error("POST /api/tasks/claim error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });

  // ── ACHIEVEMENTS ──────────────────────────────────────────────────────────
  app.get("/api/achievements/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      let [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) {
        const playerCode = await ensurePlayerCode(playerId);
        const randomName = generateRandomPlayerName();
        [profile] = await db.insert(playerProfiles).values({ id: playerId, playerCode, playerTag: await generateUniquePlayerTag(), name: randomName }).returning();
      }

      const rows = await db.select().from(playerAchievements).where(eq(playerAchievements.playerId, playerId));

      const tournamentCount = await db.select({ count: sql<number>`count(*)` }).from(tournamentPlayers).where(eq(tournamentPlayers.playerId, playerId));
      const tournamentsPlayed = Number(tournamentCount[0]?.count ?? 0);

      const result = ACHIEVEMENT_DEFS.map(def => {
        const row = rows.find(r => r.achievementKey === def.key);
        let progress = 0;
        if (def.type === "wins") progress = Math.min(profile.wins, def.target);
        if (def.type === "games") progress = Math.min(profile.gamesPlayed, def.target);
        if (def.type === "level") progress = Math.min(profile.level, def.target);
        if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
        if (def.type === "login_streak") progress = Math.min(profile.longestLoginStreak ?? 0, def.target);
        if (def.type === "total_score") progress = Math.min(profile.totalScore, def.target);
        if (def.type === "tournaments") progress = Math.min(tournamentsPlayed, def.target);
        const unlocked = progress >= def.target;
        return {
          ...def,
          rowId: row?.id,
          progress,
          unlocked,
          claimed: row?.claimed === 1,
        };
      });
      res.json(result);
    } catch (e) {
      console.error("GET /api/achievements error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  async function processAchievementClaim(playerId: string, key: string): Promise<{ success: boolean; error?: string; coinsEarned?: number; xpEarned?: number }> {
    const def = ACHIEVEMENT_DEFS.find(d => d.key === key);
    if (!def) return { success: false, error: "unknown_achievement" };

    const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
    if (!profile) return { success: false, error: "player_not_found" };

    const [existing] = await db.select().from(playerAchievements)
      .where(and(eq(playerAchievements.playerId, playerId), eq(playerAchievements.achievementKey, key)));

    if (existing?.claimed === 1) return { success: false, error: "already_claimed" };

    let liveProgress = 0;
    if (def.type === "wins")          liveProgress = profile.wins;
    if (def.type === "games")         liveProgress = profile.gamesPlayed;
    if (def.type === "level")         liveProgress = profile.level;
    if (def.type === "streak")        liveProgress = profile.bestStreak;
    if (def.type === "login_streak")  liveProgress = profile.longestLoginStreak ?? 0;
    if (def.type === "total_score")   liveProgress = profile.totalScore;
    if (def.type === "tournaments") {
      const tc = await db.select({ count: sql<number>`count(*)` }).from(tournamentPlayers).where(eq(tournamentPlayers.playerId, playerId));
      liveProgress = Number(tc[0]?.count ?? 0);
    }

    const storedUnlocked = existing?.unlocked === 1;
    const liveUnlocked = liveProgress >= def.target;
    if (!storedUnlocked && !liveUnlocked) return { success: false, error: "not_unlocked" };

    const finalProgress = Math.max(liveProgress, existing?.progress ?? 0);

    if (existing) {
      await db.update(playerAchievements).set({
        claimed: 1, claimedAt: new Date(), unlocked: 1,
        unlockedAt: existing.unlockedAt ?? new Date(),
        progress: finalProgress,
      }).where(eq(playerAchievements.id, existing.id));
    } else {
      await db.insert(playerAchievements).values({
        playerId, achievementKey: key, progress: finalProgress,
        unlocked: 1, claimed: 1, unlockedAt: new Date(), claimedAt: new Date(),
      });
    }

    // Atomic increment — avoids race condition with concurrent updates
    await db.update(playerProfiles).set({
      coins: sql`coins + ${def.rewardCoins}`,
      xp: sql`xp + ${def.rewardXp}`,
      updatedAt: new Date(),
    }).where(eq(playerProfiles.id, playerId));

    return { success: true, coinsEarned: def.rewardCoins, xpEarned: def.rewardXp };
  }

  app.post("/api/achievements/:playerId/claim/:key", async (req, res) => {
    try {
      const result = await processAchievementClaim(req.params.playerId, req.params.key);
      res.json(result);
    } catch (e) {
      console.error("POST /api/achievements/claim error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });

  app.post("/api/claim-achievement", async (req, res) => {
    try {
      const { playerId, achievementKey } = req.body;
      if (!playerId || !achievementKey) return res.json({ success: false, error: "missing_fields" });
      const result = await processAchievementClaim(playerId, achievementKey);
      res.json(result);
    } catch (e) {
      console.error("POST /api/claim-achievement error:", e);
      res.json({ success: false, error: "server_error" });
    }
  });

  // ── TASK PROGRESS (direct update) ─────────────────────────────────────────
  app.post("/api/task-progress", async (req, res) => {
    try {
      const { playerId, taskType, increment = 1 } = req.body;
      if (!playerId || !taskType) return res.status(400).json({ error: "missing_fields" });
      const today = getTodayDate();

      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) return res.status(404).json({ error: "player_not_found" });

      const todayRows = await db.select().from(playerDailyTasks)
        .where(and(eq(playerDailyTasks.playerId, playerId), eq(playerDailyTasks.assignedDate, today)));

      const updated: { taskKey: string; progress: number; completed: boolean }[] = [];

      for (const row of todayRows) {
        const def = TASK_POOL.find(d => d.key === row.taskKey && d.type === taskType);
        if (!def || row.claimed === 1) continue;

        let newProgress = row.progress ?? 0;
        if (def.type === "wins")   newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.wins - (row.baselineWins ?? 0)), def.target));
        if (def.type === "games")  newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.gamesPlayed - (row.baselineGames ?? 0)), def.target));
        if (def.type === "score")  newProgress = Math.max(newProgress, Math.min(Math.max(0, profile.totalScore - (row.baselineScore ?? 0)), def.target));
        if (def.type === "emojis") newProgress = Math.min(newProgress + increment, def.target);

        await db.update(playerDailyTasks).set({ progress: newProgress }).where(eq(playerDailyTasks.id, row.id));
        updated.push({ taskKey: row.taskKey, progress: newProgress, completed: newProgress >= def.target });
      }

      res.json({ updated });
    } catch (e) {
      console.error("POST /api/task-progress error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── ACHIEVEMENT PROGRESS (direct update) ───────────────────────────────────
  app.post("/api/achievement-progress", async (req, res) => {
    try {
      const { playerId, achievementType } = req.body;
      if (!playerId || !achievementType) return res.status(400).json({ error: "missing_fields" });

      const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!profile) return res.status(404).json({ error: "player_not_found" });

      const relevantDefs = ACHIEVEMENT_DEFS.filter(d => d.type === achievementType);
      const updated: { achievementKey: string; progress: number; unlocked: boolean }[] = [];

      for (const def of relevantDefs) {
        let progress = 0;
        if (def.type === "wins")   progress = Math.min(profile.wins, def.target);
        if (def.type === "games")  progress = Math.min(profile.gamesPlayed, def.target);
        if (def.type === "level")  progress = Math.min(profile.level, def.target);
        if (def.type === "streak") progress = Math.min(profile.bestStreak, def.target);
        const unlocked = progress >= def.target;

        const [existing] = await db.select().from(playerAchievements)
          .where(and(eq(playerAchievements.playerId, playerId), eq(playerAchievements.achievementKey, def.key)));

        if (existing) {
          if (existing.progress !== progress || existing.unlocked !== (unlocked ? 1 : 0)) {
            await db.update(playerAchievements).set({
              progress,
              unlocked: unlocked ? 1 : 0,
              unlockedAt: unlocked && !existing.unlockedAt ? new Date() : existing.unlockedAt,
            }).where(eq(playerAchievements.id, existing.id));
          }
        } else {
          await db.insert(playerAchievements).values({
            playerId, achievementKey: def.key, progress, unlocked: unlocked ? 1 : 0,
            unlockedAt: unlocked ? new Date() : undefined,
          });
        }
        updated.push({ achievementKey: def.key, progress, unlocked });
      }

      res.json({ updated });
    } catch (e) {
      console.error("POST /api/achievement-progress error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── ROOM INVITES ──────────────────────────────────────────────────────────
  app.post("/api/room-invites", async (req, res) => {
    try {
      const { fromPlayerId, toPlayerId, roomId, fromPlayerName } = req.body;
      if (!fromPlayerId || !toPlayerId || !roomId || !fromPlayerName) {
        return res.status(400).json({ error: "missing_fields" });
      }
      // Cancel any existing pending invite from same player to same room
      await db.update(roomInvites).set({ status: "cancelled" })
        .where(and(eq(roomInvites.fromPlayerId, fromPlayerId), eq(roomInvites.toPlayerId, toPlayerId), eq(roomInvites.status, "pending")));
      const [invite] = await db.insert(roomInvites)
        .values({ fromPlayerId, toPlayerId, roomId, fromPlayerName, status: "pending" })
        .returning();
      sendPushNotification(
        toPlayerId,
        `صديقك ${fromPlayerName} يتحداك! 🎮`,
        "دعوة للعب!",
        { type: "room_invite", roomId }
      ).catch(() => {});
      res.json({ success: true, inviteId: invite.id });
    } catch (e) {
      console.error("POST /api/room-invites error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/room-invites/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const pending = await db.select().from(roomInvites)
        .where(and(eq(roomInvites.toPlayerId, playerId), eq(roomInvites.status, "pending")))
        .orderBy(desc(roomInvites.createdAt))
        .limit(5);
      // Filter client-side to invites created within last 5 minutes
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const fresh = pending.filter(i => new Date(i.createdAt).getTime() > fiveMinutesAgo);
      res.json(fresh);
    } catch (e) {
      console.error("GET /api/room-invites error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.put("/api/room-invites/:inviteId/respond", async (req, res) => {
    try {
      const { inviteId } = req.params;
      const { action } = req.body; // "accept" | "decline"
      const status = action === "accept" ? "accepted" : "declined";
      const [invite] = await db.update(roomInvites).set({ status })
        .where(eq(roomInvites.id, inviteId)).returning();
      if (!invite) return res.status(404).json({ error: "not_found" });
      res.json({ success: true, roomId: invite.roomId, action });
    } catch (e) {
      console.error("PUT /api/room-invites respond error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Gift System — send coins to friends (max 1 gift per pair per day)
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/api/friends/gift", async (req, res) => {
    try {
      const { fromPlayerId, toPlayerId, amount } = req.body;
      if (!fromPlayerId || !toPlayerId || !amount) return res.status(400).json({ error: "missing_fields" });
      const validAmounts = [50, 100, 200];
      if (!validAmounts.includes(amount)) return res.status(400).json({ error: "invalid_amount" });

      const friendship = await db.select({ id: friends.id }).from(friends).where(
        or(
          and(eq(friends.playerId, fromPlayerId), eq(friends.friendId, toPlayerId)),
          and(eq(friends.playerId, toPlayerId), eq(friends.friendId, fromPlayerId))
        )
      ).limit(1);
      if (friendship.length === 0) return res.json({ error: "not_friends" });

      const today = new Date().toISOString().slice(0, 10);
      const recentGifts = await db.select().from(coinGifts).where(
        and(
          eq(coinGifts.fromPlayerId, fromPlayerId),
          eq(coinGifts.toPlayerId, toPlayerId),
          sql`DATE(${coinGifts.sentAt}) = ${today}`
        )
      );
      if (recentGifts.length > 0) return res.json({ error: "already_gifted_today" });

      const [sender] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq(playerProfiles.id, fromPlayerId));
      if (!sender || sender.coins < amount) return res.json({ error: "insufficient_coins" });

      await db.transaction(async (tx) => {
        await tx.update(playerProfiles).set({ coins: sql`coins - ${amount}` }).where(eq(playerProfiles.id, fromPlayerId));
        await tx.update(playerProfiles).set({ coins: sql`coins + ${amount}` }).where(eq(playerProfiles.id, toPlayerId));
        await tx.insert(coinGifts).values({ fromPlayerId, toPlayerId, amount });
      });

      const [senderProfile] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq(playerProfiles.id, fromPlayerId));
      sendPushNotification(
        toPlayerId,
        `${senderProfile?.name || "لاعب"} أرسل لك ${amount} عملة 🎁`,
        "هدية!",
        { type: "gift", amount }
      ).catch(() => {});

      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/friends/gift error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/friends/gifts/pending/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const pending = await db.select().from(coinGifts).where(
        and(eq(coinGifts.toPlayerId, playerId), eq(coinGifts.seen, false))
      ).orderBy(desc(coinGifts.sentAt));

      const enriched = [];
      for (const g of pending) {
        const [sender] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq(playerProfiles.id, g.fromPlayerId));
        enriched.push({ ...g, fromPlayerName: sender?.name || "لاعب" });
      }
      res.json(enriched);
    } catch (e) {
      console.error("GET /api/friends/gifts/pending error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.put("/api/friends/gifts/seen/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      await db.update(coinGifts).set({ seen: true }).where(and(eq(coinGifts.toPlayerId, playerId), eq(coinGifts.seen, false)));
      res.json({ success: true });
    } catch (e) {
      console.error("PUT /api/friends/gifts/seen error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/friends/gifts/history/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const sent = await db.select().from(coinGifts).where(eq(coinGifts.fromPlayerId, playerId)).orderBy(desc(coinGifts.sentAt)).limit(20);
      const received = await db.select().from(coinGifts).where(eq(coinGifts.toPlayerId, playerId)).orderBy(desc(coinGifts.sentAt)).limit(20);

      const enrichSent = [];
      for (const g of sent) {
        const [recipient] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq(playerProfiles.id, g.toPlayerId));
        enrichSent.push({ ...g, playerName: recipient?.name || "لاعب", type: "sent" as const });
      }
      const enrichReceived = [];
      for (const g of received) {
        const [sender] = await db.select({ name: playerProfiles.name }).from(playerProfiles).where(eq(playerProfiles.id, g.fromPlayerId));
        enrichReceived.push({ ...g, playerName: sender?.name || "لاعب", type: "received" as const });
      }
      const all = [...enrichSent, ...enrichReceived].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()).slice(0, 30);
      res.json(all);
    } catch (e) {
      console.error("GET /api/friends/gifts/history error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Referral System
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/referral/:playerId", async (req, res) => {
    try {
      const code = await ensureReferralCode(req.params.playerId);
      const [profile] = await db.select({ referralCount: playerProfiles.referralCount, referredBy: playerProfiles.referredBy, createdAt: playerProfiles.createdAt }).from(playerProfiles).where(eq(playerProfiles.id, req.params.playerId));
      const accountAgeHours = profile ? (Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60) : 9999;
      const referralEligible = !profile?.referredBy && accountAgeHours <= 24;
      res.json({ referralCode: code, referralCount: profile?.referralCount || 0, referredBy: profile?.referredBy || null, referralEligible });
    } catch (e) {
      console.error("GET /api/referral error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/referral/claim", async (req, res) => {
    try {
      const { playerId, referralCode } = req.body;
      if (!playerId || !referralCode) return res.status(400).json({ error: "missing_fields" });

      const [player] = await db.select({ referredBy: playerProfiles.referredBy, createdAt: playerProfiles.createdAt }).from(playerProfiles).where(eq(playerProfiles.id, playerId));
      if (!player) return res.status(404).json({ error: "not_found" });
      if (player.referredBy) return res.json({ error: "already_claimed" });

      const accountAgeHours = (Date.now() - new Date(player.createdAt).getTime()) / (1000 * 60 * 60);
      if (accountAgeHours > 24) return res.json({ error: "expired" });

      const [referrer] = await db.select({ id: playerProfiles.id, referralCode: playerProfiles.referralCode }).from(playerProfiles).where(eq(playerProfiles.referralCode, referralCode.toUpperCase()));
      if (!referrer) return res.json({ error: "invalid_code" });
      if (referrer.id === playerId) return res.json({ error: "self_referral" });

      const REFERRAL_REWARD = 100;
      await db.transaction(async (tx) => {
        const result = await tx.update(playerProfiles)
          .set({ referredBy: referralCode.toUpperCase() })
          .where(and(eq(playerProfiles.id, playerId), sql`referred_by IS NULL`));
        await tx.update(playerProfiles).set({
          referralCount: sql`referral_count + 1`,
          coins: sql`coins + ${REFERRAL_REWARD}`,
        }).where(eq(playerProfiles.id, referrer.id));
        await tx.update(playerProfiles).set({ coins: sql`coins + ${REFERRAL_REWARD}` }).where(eq(playerProfiles.id, playerId));
      });

      res.json({ success: true, reward: REFERRAL_REWARD });
    } catch (e) {
      console.error("POST /api/referral/claim error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tournament Auto-Cleanup
  // Removes empty or abandoned open tournament rooms automatically.
  // Rules:
  //   1. 0 players → delete immediately
  //   2. < 2 players and inactive for ≥ 60 seconds → delete
  // ─────────────────────────────────────────────────────────────────────────
  async function cleanupAbandonedTournaments() {
    try {
      const openTournaments = await db.select().from(tournaments).where(eq(tournaments.status, "open"));
      const now = Date.now();
      for (const t of openTournaments) {
        const players = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id));
        const ageMs = now - new Date(t.createdAt).getTime();
        // Grace period: a freshly-created tournament may have 0 players for a brief
        // window while the creator is seeing the confirm modal. Only delete after
        // 20 seconds to avoid destroying a tournament the user is about to join.
        const shouldDelete =
          (players.length === 0 && ageMs >= 20_000) ||
          (players.length < 2 && ageMs >= 60_000);
        if (shouldDelete) {
          await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, t.id)).catch(() => {});
          await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id)).catch(() => {});
          await db.delete(tournaments).where(eq(tournaments.id, t.id)).catch(() => {});
          activeTournaments.delete(t.id);
          console.log(`[cleanup] Deleted abandoned tournament ${t.id} (players: ${players.length}, age: ${Math.round(ageMs / 1000)}s)`);
          io.emit("tournament_cancelled", { tournamentId: t.id });
        }
      }
    } catch (e) {
      console.error("[cleanup] Tournament cleanup error:", e);
    }
  }

  cleanupAbandonedTournaments();
  setInterval(() => cleanupAbandonedTournaments(), 30_000);

  // ── Push Notification Endpoints ──────────────────────────────────────────
  app.post("/api/player/:id/push-token", async (req, res) => {
    try {
      const { id } = req.params;
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "missing_token" });
      await db.update(playerProfiles)
        .set({ expoPushToken: token, updatedAt: new Date() })
        .where(eq(playerProfiles.id, id));
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/player/:id/push-token error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.put("/api/player/:id/notifications", async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "invalid_value" });
      await db.update(playerProfiles)
        .set({ notificationsEnabled: enabled, updatedAt: new Date() })
        .where(eq(playerProfiles.id, id));
      res.json({ success: true, enabled });
    } catch (e) {
      console.error("PUT /api/player/:id/notifications error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/player/:id/notifications", async (req, res) => {
    try {
      const { id } = req.params;
      const [profile] = await db.select({
        notificationsEnabled: playerProfiles.notificationsEnabled,
        expoPushToken: playerProfiles.expoPushToken,
      }).from(playerProfiles).where(eq(playerProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "not_found" });
      res.json({
        enabled: profile.notificationsEnabled,
        tokenRegistered: !!profile.expoPushToken,
      });
    } catch (e) {
      console.error("GET /api/player/:id/notifications error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── Cron Jobs — Push Notification Schedules ──────────────────────────────
  cron.schedule("0 9 * * *", () => {
    console.log("[cron] Running daily task reminders (9:00 AM)");
    sendDailyTaskReminders().catch(console.error);
  });

  cron.schedule("0 20 * * *", () => {
    console.log("[cron] Running streak reset warnings (8:00 PM)");
    sendStreakResetWarnings().catch(console.error);
  });

  cron.schedule("0 12 * * *", () => {
    console.log("[cron] Running season ending notifications (12:00 PM)");
    sendSeasonEndingNotifications().catch(console.error);
  });

  cron.schedule("0 0 * * *", () => {
    console.log("[cron] Checking season end (midnight)");
    handleSeasonEnd().catch(console.error);
  });

  // Every Monday at 00:05 — distribute clan war rewards and reset scores
  cron.schedule("5 0 * * 1", () => {
    console.log("[cron] Clan war weekly payout (Monday 00:05)");
    handleClanWarWeeklyEnd().catch(console.error);
  });

  console.log("[cron] Push notification cron jobs scheduled");

  return httpServer;
}

function sanitizeRoom(room: ReturnType<typeof getRoom>) {
  if (!room) return null;
  return {
    id: room.id,
    state: room.state,
    currentLetter: room.currentLetter,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    wordCategory: room.wordCategory || "general",
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      score: p.score,
      roundScores: p.roundScores,
      coins: p.coins,
      isHost: p.isHost,
      isReady: p.isReady,
    })),
  };
}
