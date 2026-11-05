import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { validateWord, CATEGORY_MAP, getWordsForLetter, type WordCategory } from "./wordDatabase";
import { ARABIC_LETTERS } from "../constants/i18n";
import { db } from "./db";
import { playerProfiles, dailySpins, winStreaks, tournamentPlayers, playerDailyTasks, playerAchievements, dailyTaskDefs, achievementDefs, seasons, clans, clanMembers, battlePassTiers, playerBattlePass, dailyChallenges, dailyChallengeEntries } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql } from "drizzle-orm";
import cron from "node-cron";
import { sendDailyTaskReminders, sendStreakResetWarnings } from "./notifications";
import { registerOnlineMultiplayer } from "./online-multiplayer";
import { registerSocialRoutes } from "./social";
import {
  AVATAR_CATALOG,
  COSMETIC_CATALOG,
  COSMETIC_KINDS,
  DEFAULT_EQUIPPED_COSMETICS,
  type CosmeticKind,
} from "@shared/cosmetics";

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

const BP_XP_PER_TIER = 500; // XP needed per tier
const BP_PREMIUM_COST = 900; // Coin cost for premium Battle Pass unlock
const BP_XP_WIN = 20;
const BP_XP_GAME = 10;

// ── Real-money premium pricing (RevenueCat / Google Play Billing) ──────────────
const BP_IAP_PRODUCT_ID = "battle_pass_premium_s1";
const BP_IAP_BASE_PRICE = { amount: 1.99, currency: "EUR", display: "€1.99" };
const BP_IAP_ENABLED = !!process.env.REVENUECAT_SECRET_API_KEY;

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
    const existing = await db.select({ id: battlePassTiers.id }).from(battlePassTiers).where(eq(battlePassTiers.seasonId, seasonId));
    if (existing.length >= 30) return; // fully seeded (or anomalous excess — leave alone, don't duplicate)
    if (existing.length > 0 && existing.length < 30) {
      // self-heal partial corruption
      console.warn(`[battle-pass] Partial seed detected for season ${seasonId} (${existing.length}/30). Wiping & re-seeding.`);
      await db.delete(battlePassTiers).where(eq(battlePassTiers.seasonId, seasonId));
    }
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
  // ON CONFLICT DO NOTHING prevents race conditions on simultaneous first-write
  await db.insert(playerBattlePass).values({
    playerId, seasonId, passXp: 0, currentTier: 0, premiumUnlocked: false, claimedTiers: [],
  }).onConflictDoNothing();
  const [pass] = await db.select().from(playerBattlePass)
    .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, seasonId))).limit(1);
  return pass;
}

async function awardBattlePassXp(playerId: string, xpAmount: number) {
  try {
    const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
    if (!activeSeason) return;
    await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
    // Use atomic SQL increment to prevent lost updates from concurrent events
    await db.update(playerBattlePass).set({
      passXp: sql`pass_xp + ${xpAmount}`,
      currentTier: sql`LEAST(30, FLOOR((pass_xp + ${xpAmount}) / ${BP_XP_PER_TIER})::int)`,
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
  await registerOnlineMultiplayer(app, httpServer);
  registerSocialRoutes(app);

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

  function getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async function getOrCreateTodayChallenge(): Promise<{ date: string; word: string; letter: string }> {
    const today = getTodayDateString();
    const existing = await db.select().from(dailyChallenges).where(eq(dailyChallenges.date, today)).limit(1);
    if (existing.length > 0) return existing[0];

    const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
    const allCategories: WordCategory[] = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
    const candidateWords: string[] = [];
    for (const category of allCategories) {
      candidateWords.push(...getWordsForLetter(category, letter));
    }
    const filtered = candidateWords.filter((word) => word.length >= 3 && word.length <= 7);
    const pool = filtered.length > 0 ? filtered : candidateWords;
    if (pool.length === 0) {
      throw new Error(`No daily challenge words available for ${letter}`);
    }

    const word = pool[Math.floor(Math.random() * pool.length)];
    await db.insert(dailyChallenges).values({ date: today, word, letter }).onConflictDoNothing();
    const fresh = await db.select().from(dailyChallenges).where(eq(dailyChallenges.date, today)).limit(1);
    return fresh[0] ?? { date: today, word, letter };
  }

  function applyWordleColoring(guess: string, target: string): { letter: string; status: "correct" | "present" | "absent" }[] {
    const result: { letter: string; status: "correct" | "present" | "absent" }[] = [];
    const targetChars = [...target];
    const guessChars = [...guess];
    const used = new Array(targetChars.length).fill(false);

    for (let i = 0; i < guessChars.length; i++) {
      if (guessChars[i] === targetChars[i]) {
        result.push({ letter: guessChars[i], status: "correct" });
        used[i] = true;
      } else {
        result.push({ letter: guessChars[i], status: "absent" });
      }
    }

    for (let i = 0; i < guessChars.length; i++) {
      if (result[i].status === "correct") continue;
      const foundIdx = targetChars.findIndex((character, idx) => !used[idx] && character === guessChars[i]);
      if (foundIdx !== -1) {
        result[i] = { letter: guessChars[i], status: "present" };
        used[foundIdx] = true;
      }
    }

    return result;
  }

  app.get("/api/daily-challenge", async (req, res) => {
    try {
      const { playerId } = req.query as { playerId?: string };
      const challenge = await getOrCreateTodayChallenge();
      const wordLength = [...challenge.word].length;
      let entry: { guesses: string[]; completed: boolean; won: boolean; guessCount: number; startedAt: Date } | null = null;
      if (playerId) {
        const rows = await db.select().from(dailyChallengeEntries)
          .where(and(eq(dailyChallengeEntries.playerId, playerId), eq(dailyChallengeEntries.date, challenge.date))).limit(1);
        if (rows.length > 0) {
          const r = rows[0];
          entry = { guesses: r.guesses, completed: r.completed, won: r.won, guessCount: r.guessCount, startedAt: r.startedAt };
        }
      }
      // Reveal word only if completed
      const revealedWord = (entry?.completed) ? challenge.word : null;
      res.json({
        date: challenge.date,
        letter: challenge.letter,
        wordLength,
        entry,
        word: revealedWord,
      });
    } catch (e) {
      console.error("[daily-challenge] GET error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/daily-challenge/guess
  app.post("/api/daily-challenge/guess", async (req, res) => {
    try {
      const { playerId, guess } = req.body as { playerId: string; guess: string };
      if (!playerId || !guess) return res.status(400).json({ error: "missing_params" });
      const challenge = await getOrCreateTodayChallenge();
      const today = challenge.date;
      const MAX_GUESSES = 6;
      // Get or create entry
      let entryRows = await db.select().from(dailyChallengeEntries)
        .where(and(eq(dailyChallengeEntries.playerId, playerId), eq(dailyChallengeEntries.date, today))).limit(1);
      let isNew = false;
      if (entryRows.length === 0) {
        await db.insert(dailyChallengeEntries).values({ playerId, date: today });
        entryRows = await db.select().from(dailyChallengeEntries)
          .where(and(eq(dailyChallengeEntries.playerId, playerId), eq(dailyChallengeEntries.date, today))).limit(1);
        isNew = true;
      }
      const entry = entryRows[0];
      if (entry.completed) return res.status(400).json({ error: "already_completed" });
      const currentGuesses = entry.guesses as string[];
      if (currentGuesses.length >= MAX_GUESSES) return res.status(400).json({ error: "max_guesses_reached" });
      const guessChars = [...guess.trim()];
      const targetChars = [...challenge.word];
      if (guessChars.length !== targetChars.length) {
        return res.status(400).json({ error: "wrong_length", expected: targetChars.length });
      }
      const coloring = applyWordleColoring(guess.trim(), challenge.word);
      const newGuesses = [...currentGuesses, guess.trim()];
      const won = guess.trim() === challenge.word;
      const completed = won || newGuesses.length >= MAX_GUESSES;
      const now = new Date();
      const durationSeconds = Math.round((now.getTime() - entry.startedAt.getTime()) / 1000);
      await db.update(dailyChallengeEntries).set({
        guesses: newGuesses,
        guessCount: newGuesses.length,
        completed,
        won,
        finishedAt: completed ? now : null,
        durationSeconds: completed ? durationSeconds : entry.durationSeconds,
      }).where(and(eq(dailyChallengeEntries.playerId, playerId), eq(dailyChallengeEntries.date, today)));
      // Award coins on completion
      let coinsAwarded = 0;
      if (completed) {
        if (won) {
          coinsAwarded = Math.max(10, 60 - (newGuesses.length - 1) * 10);
          await db.update(playerProfiles).set({ coins: sql`coins + ${coinsAwarded}`, updatedAt: new Date() })
            .where(eq(playerProfiles.id, playerId));
        }
        // Compute rank among today's finishers
        const allEntries = await db.select({ guessCount: dailyChallengeEntries.guessCount, durationSeconds: dailyChallengeEntries.durationSeconds, won: dailyChallengeEntries.won })
          .from(dailyChallengeEntries).where(and(eq(dailyChallengeEntries.date, today), eq(dailyChallengeEntries.completed, true)));
        const sorted = allEntries.filter(e => e.won).sort((a, b) => a.guessCount - b.guessCount || a.durationSeconds - b.durationSeconds);
        const rank = won ? sorted.findIndex(e => e.guessCount === newGuesses.length && e.durationSeconds === durationSeconds) + 1 : null;
        if (rank) {
          await db.update(dailyChallengeEntries).set({ rank })
            .where(and(eq(dailyChallengeEntries.playerId, playerId), eq(dailyChallengeEntries.date, today)));
        }
      }
      return res.json({
        coloring,
        won,
        completed,
        guessCount: newGuesses.length,
        word: completed ? challenge.word : null,
        coinsAwarded: completed ? coinsAwarded : 0,
      });
    } catch (e) {
      console.error("[daily-challenge] POST guess error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/daily-challenge/leaderboard
  app.get("/api/daily-challenge/leaderboard", async (_req, res) => {
    try {
      const today = getTodayDateString();
      const rows = await db.select({
        playerId: dailyChallengeEntries.playerId,
        guessCount: dailyChallengeEntries.guessCount,
        durationSeconds: dailyChallengeEntries.durationSeconds,
        rank: dailyChallengeEntries.rank,
        finishedAt: dailyChallengeEntries.finishedAt,
        name: playerProfiles.name,
        skin: playerProfiles.equippedSkin,
        level: playerProfiles.level,
      }).from(dailyChallengeEntries)
        .innerJoin(playerProfiles, eq(dailyChallengeEntries.playerId, playerProfiles.id))
        .where(and(eq(dailyChallengeEntries.date, today), eq(dailyChallengeEntries.completed, true), eq(dailyChallengeEntries.won, true)))
        .orderBy(asc(dailyChallengeEntries.guessCount), asc(dailyChallengeEntries.durationSeconds))
        .limit(20);
      res.json(rows.map((r, idx) => ({ ...r, displayRank: idx + 1 })));
    } catch (e) {
      console.error("[daily-challenge] leaderboard error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });
  // ────────────────────────────────────────────────────────────────────────────

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const LOGIN_STREAK_REWARDS: Record<number, number> = {
    1: 15, 2: 20, 3: 30, 4: 25, 5: 35, 6: 50, 7: 100,
    14: 150, 21: 200, 30: 500,
  };

  function getLoginReward(day: number): number {
    return LOGIN_STREAK_REWARDS[day] ?? 15;
  }

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
          equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
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
      const allowedFields = ["name", "coins", "xp", "level", "equippedSkin", "ownedSkins", "equippedTitle", "ownedTitles", "totalScore", "gamesPlayed", "wins", "winStreak", "bestStreak", "lastStreakReward", "powerCards", "country"];
      for (const key of allowedFields) {
        if (data[key] !== undefined) {
          // Never overwrite country with null — DB default "MA" is the fallback
          if (key === "country" && data[key] === null) continue;
          updateData[key] = data[key];
        }
      }
      if (data.equippedCosmetics && typeof data.equippedCosmetics === "object") {
        const equipped = { ...existing.equippedCosmetics };
        const owned = existing.ownedCosmetics ?? {};
        for (const kind of COSMETIC_KINDS) {
          const itemId = data.equippedCosmetics[kind];
          if (typeof itemId === "string" && (owned[kind as CosmeticKind] ?? []).includes(itemId)) {
            equipped[kind] = itemId;
          }
        }
        updateData.equippedCosmetics = equipped;
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
      if (!itemType || !itemId || !Number.isSafeInteger(price) || price < 0) {
        return res.status(400).json({ error: "invalid_params" });
      }
      const avatarProduct = itemType === "skin"
        ? AVATAR_CATALOG.find((item) => item.id === itemId)
        : undefined;
      const cosmeticProduct = itemType === "cosmetic"
        ? COSMETIC_CATALOG.find((item) => item.id === itemId)
        : undefined;
      if ((itemType === "skin" && (!avatarProduct || price !== avatarProduct.price))
        || (itemType === "cosmetic" && (!cosmeticProduct || price !== cosmeticProduct.price))
        || !["skin", "title", "cosmetic"].includes(itemType)) {
        return res.status(400).json({ error: "invalid_item" });
      }
      if (itemType === "cosmetic" && cosmeticProduct) {
        const result = await db.transaction(async (tx) => {
          const [profile] = await tx.select().from(playerProfiles)
            .where(eq(playerProfiles.id, id))
            .for("update");
          if (!profile) return { status: 404 as const, error: "player_not_found" };
          if (profile.coins < price) return { status: 402 as const, error: "insufficient_coins" };
          const owned = profile.ownedCosmetics ?? {};
          const ownedInKind = owned[cosmeticProduct.kind as CosmeticKind] ?? [];
          if (ownedInKind.includes(itemId)) {
            return { status: 200 as const, profile, alreadyOwned: true };
          }
          const updatedOwned = {
            ...owned,
            [cosmeticProduct.kind]: [...ownedInKind, itemId],
          };
          const [updated] = await tx.update(playerProfiles)
            .set({
              coins: profile.coins - price,
              ownedCosmetics: updatedOwned,
              updatedAt: new Date(),
            })
            .where(eq(playerProfiles.id, id))
            .returning();
          return { status: 200 as const, profile: updated };
        });
        if (result.status !== 200) return res.status(result.status).json({ error: result.error });
        return res.json({ profile: result.profile, alreadyOwned: result.alreadyOwned ?? false });
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
      const { won } = req.body as { won: boolean };
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
      const isVip = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());
      const vipMultiplier = isVip ? 2 : 1;
      const totalCoins = (coinsEarned + streakBonus) * vipMultiplier;
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
      res.json({ profile: updated, streakBonus });

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

  app.get("/api/spin-rewards", (_req, res) => {
    res.json(SPIN_REWARDS.map(r => ({ type: r.type, amount: r.amount, label: r.label })));
  });

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
        // Real-money IAP info
        iap: {
          enabled: BP_IAP_ENABLED,
          productId: BP_IAP_PRODUCT_ID,
          price: BP_IAP_BASE_PRICE,
        },
        tiers,
      });
    } catch (e) {
      console.error("GET /api/battle-pass/:playerId error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/battle-pass/:playerId/unlock-premium-iap — unlock premium via real-money IAP (RevenueCat)
  // Security model: the RevenueCat App User ID MUST equal the in-game playerId. The mobile client
  // is required to call Purchases.logIn(playerId) before purchasing, so RevenueCat tracks entitlements
  // per-player. We therefore look up the subscriber by :playerId directly and IGNORE any client-supplied
  // user id, preventing one player from unlocking premium for another by knowing an entitled RC user id.
  // Server verifies (a) the entitlement object exists, (b) it is active (expires_date is null or future),
  // (c) it was granted by our expected product id.
  app.post("/api/battle-pass/:playerId/unlock-premium-iap", async (req, res) => {
    try {
      if (!BP_IAP_ENABLED) {
        return res.status(503).json({ error: "iap_not_configured", message: "Real-money premium is not yet available." });
      }
      const { playerId } = req.params;
      if (!playerId) return res.status(400).json({ error: "missing_player_id" });

      // Always look up by playerId (NOT by client-supplied id) — this binds RC user ↔ game player.
      const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(playerId)}`, {
        headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}` },
      });
      if (!rcRes.ok) {
        console.error("[battle-pass IAP] RevenueCat verify failed:", rcRes.status);
        return res.status(502).json({ error: "verify_failed" });
      }
      const rcData = await rcRes.json() as {
        subscriber?: {
          entitlements?: Record<string, { expires_date: string | null; product_identifier?: string }>;
        };
      };
      const ent = rcData.subscriber?.entitlements?.battle_pass_premium;
      if (!ent) return res.status(403).json({ error: "entitlement_missing" });

      // Active check: expires_date null = lifetime; otherwise must be in the future
      if (ent.expires_date !== null && ent.expires_date !== undefined) {
        const expiresMs = Date.parse(ent.expires_date);
        if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
          return res.status(403).json({ error: "entitlement_expired" });
        }
      }

      // Product check (FAIL CLOSED): entitlement MUST declare a product_identifier
      // that matches our expected SKU. Reject if missing or different — we never
      // grant premium based on entitlement existence alone.
      const prodId = ent.product_identifier;
      const productMatches =
        !!prodId && (prodId === BP_IAP_PRODUCT_ID || prodId.startsWith(`${BP_IAP_PRODUCT_ID}:`));
      if (!productMatches) {
        console.warn("[battle-pass IAP] product mismatch / missing:", prodId, "expected", BP_IAP_PRODUCT_ID);
        return res.status(403).json({ error: "product_mismatch" });
      }

      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });

      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      await db.update(playerBattlePass).set({ premiumUnlocked: true, updatedAt: new Date() })
        .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id)));

      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/battle-pass/:playerId/unlock-premium-iap error:", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/admin/dev-bp-unlock/:playerId — Dev tool: grant premium Battle Pass without payment.
  // Security: obscure path + only works in non-production or when ADMIN_UNLOCK_ENABLED=true.
  app.post("/api/admin/dev-bp-unlock/:playerId", async (req, res) => {
    const { playerId } = req.params;
    try {
      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });
      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      await db.update(playerBattlePass)
        .set({ premiumUnlocked: true })
        .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id)));
      return res.json({ ok: true, playerId, seasonId: activeSeason.id });
    } catch (e) {
      console.error("/api/admin/dev-bp-unlock error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/battle-pass/:playerId/buy-premium — unlock premium with in-game coins.
  // Deducts BP_PREMIUM_COST coins from the player's balance atomically, then sets
  // premium_unlocked = true for the active season. Returns 402 if insufficient coins.
  app.post("/api/battle-pass/:playerId/buy-premium", async (req, res) => {
    try {
      const { playerId } = req.params;
      if (!playerId) return res.status(400).json({ error: "missing_player_id" });

      const [activeSeason] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.status, "active")).limit(1);
      if (!activeSeason) return res.status(404).json({ error: "no_active_season" });

      const [player] = await db.select({ coins: playerProfiles.coins }).from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1);
      if (!player) return res.status(404).json({ error: "player_not_found" });

      // Idempotency: if already unlocked for this season, return success without deducting coins.
      const [existingPass] = await db.select({ premiumUnlocked: playerBattlePass.premiumUnlocked })
        .from(playerBattlePass)
        .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id)))
        .limit(1);
      if (existingPass?.premiumUnlocked) {
        return res.json({ ok: true, newCoins: player.coins ?? 0 });
      }

      if ((player.coins ?? 0) < BP_PREMIUM_COST) {
        return res.status(402).json({ error: "insufficient_coins", required: BP_PREMIUM_COST, current: player.coins ?? 0 });
      }

      // Deduct coins atomically — only if balance is still sufficient (guards concurrent requests).
      const deductResult = await db.update(playerProfiles)
        .set({ coins: sql`coins - ${BP_PREMIUM_COST}`, updatedAt: new Date() })
        .where(and(eq(playerProfiles.id, playerId), sql`coins >= ${BP_PREMIUM_COST}`))
        .returning({ newCoins: playerProfiles.coins });

      if (deductResult.length === 0) {
        return res.status(402).json({ error: "insufficient_coins", required: BP_PREMIUM_COST, current: player.coins ?? 0 });
      }

      await getOrCreatePlayerBattlePass(playerId, activeSeason.id);
      await db.update(playerBattlePass)
        .set({ premiumUnlocked: true, updatedAt: new Date() })
        .where(and(eq(playerBattlePass.playerId, playerId), eq(playerBattlePass.seasonId, activeSeason.id)));

      res.json({ ok: true, newCoins: deductResult[0].newCoins ?? 0 });
    } catch (e) {
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

        resultNewCoins = profile.coins;
        if (rewardType === "coins") {
          // Atomic coin increment to avoid stale-write under concurrent coin mutations
          const [updProf] = await tx.update(playerProfiles)
            .set({ coins: sql`coins + ${rewardAmt}`, updatedAt: new Date() })
            .where(eq(playerProfiles.id, playerId))
            .returning({ coins: playerProfiles.coins });
          resultNewCoins = updProf?.coins ?? profile.coins + rewardAmt;
          grantedLabel.push(`🪙 +${rewardAmt}`);
        } else if (rewardType === "powerCard" && rewardId) {
          const pc = profile.powerCards ?? { time: 0, freeze: 0, hint: 0 };
          const newPc = { ...pc, [rewardId]: ((pc as Record<string, number>)[rewardId] ?? 0) + rewardAmt };
          await tx.update(playerProfiles).set({ powerCards: newPc, updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));
          grantedLabel.push(`🃏 +${rewardAmt} ${rewardId}`);
        } else if (rewardType === "skin" && rewardId) {
          const owned = Array.isArray(profile.ownedSkins) ? (profile.ownedSkins as string[]) : [];
          if (!owned.includes(rewardId)) {
            await tx.update(playerProfiles).set({ ownedSkins: [...owned, rewardId], updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));
            grantedLabel.push(`👗 ${rewardId}`);
          }
        } else if (rewardType === "title" && rewardId) {
          const owned = Array.isArray(profile.ownedTitles) ? (profile.ownedTitles as string[]) : [];
          if (!owned.includes(rewardId)) {
            await tx.update(playerProfiles).set({ ownedTitles: [...owned, rewardId], updatedAt: new Date() }).where(eq(playerProfiles.id, playerId));
            grantedLabel.push(`👑 ${rewardId}`);
          }
        }
        // Atomic claim: append claimedKey only if NOT already present in the JSONB array
        // Uses PostgreSQL jsonb_array_elements to prevent duplicate claims from concurrent requests
        const updateResult = await tx.update(playerBattlePass).set({
          claimedTiers: sql`claimed_tiers || ${JSON.stringify([claimedKey])}::jsonb`,
          updatedAt: new Date(),
        }).where(and(
          eq(playerBattlePass.playerId, playerId),
          eq(playerBattlePass.seasonId, activeSeason.id),
          sql`NOT (claimed_tiers @> ${JSON.stringify([claimedKey])}::jsonb)`,
        )).returning({ id: playerBattlePass.id });
        if (updateResult.length === 0) throw Object.assign(new Error("already_claimed"), { statusCode: 400 });
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

  // ── DAILY LOGIN STREAK ────────────────────────────────────────────────────
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
        coins: updated[0].coins,
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
      const { playerId, taskType } = req.body;
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

  // Every Monday at 00:05 — distribute clan war rewards and reset scores
  cron.schedule("5 0 * * 1", () => {
    console.log("[cron] Clan war weekly payout (Monday 00:05)");
    handleClanWarWeeklyEnd().catch(console.error);
  });

  // Every day at 23:55 — pre-seed tomorrow's daily challenge word
  cron.schedule("55 23 * * *", async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const existing = await db.select({ id: dailyChallenges.id }).from(dailyChallenges)
        .where(eq(dailyChallenges.date, dateStr)).limit(1);
      if (existing.length > 0) return;
      const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
      const allCategories: WordCategory[] = ["animals", "fruits", "vegetables", "cities", "countries", "objects", "boy_names", "girl_names"];
      const candidateWords: string[] = [];
      for (const cat of allCategories) {
        const ws = getWordsForLetter(cat, letter);
        candidateWords.push(...ws);
      }
      const filtered = candidateWords.filter(w => w.length >= 3 && w.length <= 7);
      const pool = filtered.length > 0 ? filtered : candidateWords;
      if (pool.length === 0) return;
      const word = pool[Math.floor(Math.random() * pool.length)];
      await db.insert(dailyChallenges).values({ date: dateStr, word, letter }).onConflictDoNothing();
      console.log(`[cron] Daily challenge pre-seeded for ${dateStr}: ${word} (${letter})`);
    } catch (e) {
      console.error("[cron] daily challenge pre-seed error:", e);
    }
  });

  return httpServer;
}
