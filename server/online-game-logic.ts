import { randomBytes } from "node:crypto";
import {
  ARABIC_LETTERS,
  GAME_CATEGORIES,
  type GameCategory,
} from "../constants/i18n";
import { CATEGORY_MAP, validateWord } from "./wordDatabase";

export type OnlineMode = "random" | "private";
export type RoomCapacity = 2 | 4 | 6 | 8;
export type RoundCount = 3 | 5 | 7;
export type RoundDuration = 45 | 60 | 90;

export type OnlineRoomSettings = {
  maxPlayers: RoomCapacity;
  rounds: RoundCount;
  secondsPerRound: RoundDuration;
};

export type OnlinePlayerAnswer = Partial<Record<GameCategory, string>>;
export type OnlinePlayerInput = {
  id: string;
  name: string;
  answers: OnlinePlayerAnswer;
};
export type MatchQueueResult<T> =
  | { status: "queued" }
  | { status: "duplicate" }
  | { status: "paired"; opponentId: string; opponent: T };

export class OnlineMatchQueue<T> {
  private readonly entries = new Map<string, T>();

  enqueue(playerId: string, entry: T): MatchQueueResult<T> {
    if (this.entries.has(playerId)) return { status: "duplicate" };
    for (const [opponentId, opponent] of this.entries) {
      if (opponentId === playerId) continue;
      this.entries.delete(opponentId);
      return { status: "paired", opponentId, opponent };
    }
    this.entries.set(playerId, entry);
    return { status: "queued" };
  }

  cancel(playerId: string): T | undefined {
    const entry = this.entries.get(playerId);
    this.entries.delete(playerId);
    return entry;
  }

  has(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  entriesList(): [string, T][] {
    return [...this.entries.entries()];
  }
}

export type OnlineAnswerStatus = "correct" | "duplicate" | "empty" | "invalid";
export type OnlineRoundPlayerResult = {
  playerId: string;
  playerName: string;
  answers: OnlinePlayerAnswer;
  scores: Record<GameCategory, number>;
  status: Record<GameCategory, OnlineAnswerStatus>;
  roundTotal: number;
};

export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase();
}

export function scoreOnlineRound(
  players: OnlinePlayerInput[],
  letter: string,
): OnlineRoundPlayerResult[] {
  const validation = new Map<string, Map<GameCategory, boolean>>();
  const duplicateCounts = new Map<GameCategory, Map<string, number>>();

  for (const category of GAME_CATEGORIES) duplicateCounts.set(category, new Map());

  for (const player of players) {
    const playerValidity = new Map<GameCategory, boolean>();
    for (const category of GAME_CATEGORIES) {
      const answer = player.answers[category]?.trim() ?? "";
      const valid = answer.length > 0
        && answer.length <= 80
        && validateWord(answer, CATEGORY_MAP[category]!, letter).valid;
      playerValidity.set(category, valid);
      if (valid) {
        const normalized = normalizeAnswer(answer);
        const counts = duplicateCounts.get(category)!;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    validation.set(player.id, playerValidity);
  }

  return players.map((player) => {
    const scores = {} as Record<GameCategory, number>;
    const status = {} as Record<GameCategory, OnlineAnswerStatus>;
    let roundTotal = 0;

    for (const category of GAME_CATEGORIES) {
      const answer = player.answers[category]?.trim() ?? "";
      const valid = validation.get(player.id)?.get(category) ?? false;
      if (!answer) {
        scores[category] = 0;
        status[category] = "empty";
      } else if (!valid) {
        scores[category] = 0;
        status[category] = "invalid";
      } else {
        const count = duplicateCounts.get(category)!.get(normalizeAnswer(answer)) ?? 0;
        scores[category] = count > 1 ? 5 : 10;
        status[category] = count > 1 ? "duplicate" : "correct";
      }
      roundTotal += scores[category];
    }

    return {
      playerId: player.id,
      playerName: player.name,
      answers: player.answers,
      scores,
      status,
      roundTotal,
    };
  });
}

export function getRandomMatchBaseRewards(
  players: { id: string; score: number; abandoned: boolean }[],
): Map<string, number> {
  const rewards = new Map(players.map((player) => [player.id, 0]));
  if (players.length !== 2) return rewards;
  const [first, second] = players;
  if (first.abandoned && second.abandoned) return rewards;
  if (first.abandoned) {
    rewards.set(second.id, 20);
    return rewards;
  }
  if (second.abandoned) {
    rewards.set(first.id, 20);
    return rewards;
  }
  if (first.score === second.score) {
    rewards.set(first.id, 10);
    rewards.set(second.id, 10);
  } else {
    rewards.set(first.score > second.score ? first.id : second.id, 20);
    rewards.set(first.score > second.score ? second.id : first.id, 5);
  }
  return rewards;
}

export function applyDailyRewardLimit(baseReward: number, completedMatchesToday: number): number {
  if (completedMatchesToday < 10) return baseReward;
  if (completedMatchesToday < 20) return Math.floor(baseReward / 2);
  return 0;
}

export function createRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export function getRandomLetter(): string {
  return ARABIC_LETTERS[randomBytes(4).readUInt32BE(0) % ARABIC_LETTERS.length];
}
