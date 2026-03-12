import { CATEGORY_MAP, validateWord, WordCategory } from "./wordDatabase";

export type GameCategory =
  | "girlName"
  | "boyName"
  | "animal"
  | "fruit"
  | "vegetable"
  | "object"
  | "city"
  | "country";

export const GAME_CATEGORIES: GameCategory[] = [
  "girlName",
  "boyName",
  "animal",
  "fruit",
  "vegetable",
  "object",
  "city",
  "country",
];

export const ARABIC_LETTERS = [
  "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
  "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
  "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

export type PlayerAnswers = Record<GameCategory, string>;

export type Player = {
  id: string;
  name: string;
  skin: string;
  score: number;
  roundScores: number[];
  coins: number;
  isReady: boolean;
  isHost: boolean;
};

export type RoundResult = {
  playerId: string;
  playerName: string;
  answers: PlayerAnswers;
  scores: Record<GameCategory, number>;
  roundTotal: number;
  status: Record<GameCategory, "correct" | "duplicate" | "empty" | "invalid">;
};

export type Room = {
  id: string;
  players: Player[];
  state: "waiting" | "playing" | "results" | "finished";
  currentLetter: string;
  currentRound: number;
  totalRounds: number;
  roundResults: RoundResult[][];
  submittedAnswers: Map<string, PlayerAnswers>;
  roundStartTime: number;
  timer: ReturnType<typeof setTimeout> | null;
  letterQueue: string[];
  letterIndex: number;
};

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextLetter(room: Room): string {
  if (room.letterIndex >= room.letterQueue.length) {
    room.letterQueue = shuffleArray(ARABIC_LETTERS);
    room.letterIndex = 0;
  }
  return room.letterQueue[room.letterIndex++];
}

export function createRoom(hostId: string, hostName: string, hostSkin: string): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const initialQueue = shuffleArray(ARABIC_LETTERS);
  const room: Room = {
    id: code,
    players: [
      {
        id: hostId,
        name: hostName,
        skin: hostSkin,
        score: 0,
        roundScores: [],
        coins: 0,
        isReady: false,
        isHost: true,
      },
    ],
    state: "waiting",
    currentLetter: initialQueue[0],
    currentRound: 0,
    totalRounds: 5,
    roundResults: [],
    submittedAnswers: new Map(),
    roundStartTime: 0,
    timer: null,
    letterQueue: initialQueue,
    letterIndex: 1,
  };

  rooms.set(code, room);
  return room;
}

function makeUniqueName(existingNames: string[], desiredName: string): string {
  if (!existingNames.includes(desiredName)) return desiredName;
  let counter = 2;
  while (existingNames.includes(`${desiredName}_${counter}`)) {
    counter++;
  }
  return `${desiredName}_${counter}`;
}

export function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string,
  playerSkin: string
): { success: boolean; room?: Room; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };
  if (room.players.length >= 8) return { success: false, error: "room_full" };
  if (room.state !== "waiting") return { success: false, error: "game_in_progress" };

  // Check if player already in room (by socket id)
  if (room.players.find((p) => p.id === playerId)) {
    return { success: true, room };
  }

  // Ensure unique username
  const existingNames = room.players.map((p) => p.name);
  const uniqueName = makeUniqueName(existingNames, playerName);

  room.players.push({
    id: playerId,
    name: uniqueName,
    skin: playerSkin,
    score: 0,
    roundScores: [],
    coins: 0,
    isReady: false,
    isHost: false,
  });

  return { success: true, room };
}

export function removePlayer(roomId: string, playerId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== playerId);

  if (room.players.length === 0) {
    if (room.timer) clearTimeout(room.timer);
    rooms.delete(roomId);
    return null;
  }

  // Transfer host if needed
  if (!room.players.find((p) => p.isHost)) {
    room.players[0].isHost = true;
  }

  return room;
}

export function startGame(roomId: string): { success: boolean; room?: Room; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };
  // Deduplicate players by socket id before checking count (safety net)
  const uniqueIds = new Set(room.players.map((p) => p.id));
  room.players = room.players.filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx);
  console.log(`[startGame] Room ${roomId}: ${room.players.length} unique players (${uniqueIds.size} unique IDs)`);
  if (room.players.length < 2) return { success: false, error: "need_more_players" };

  room.letterQueue = shuffleArray(ARABIC_LETTERS);
  room.letterIndex = 0;
  room.state = "playing";
  room.currentRound = 1;
  room.currentLetter = getNextLetter(room);
  room.submittedAnswers.clear();
  room.roundStartTime = Date.now();

  return { success: true, room };
}

export function submitAnswers(
  roomId: string,
  playerId: string,
  answers: PlayerAnswers
): { allSubmitted: boolean; room: Room | null } {
  const room = rooms.get(roomId);
  if (!room || room.state !== "playing") return { allSubmitted: false, room: null };

  room.submittedAnswers.set(playerId, answers);

  const allSubmitted = room.players.every((p) => room.submittedAnswers.has(p.id));
  return { allSubmitted, room };
}

export function calculateRoundScores(roomId: string): RoundResult[] {
  const room = rooms.get(roomId);
  if (!room) return [];

  const letter = room.currentLetter;
  const results: RoundResult[] = [];

  // Collect all answers per category for duplicate detection
  const answersByCategory: Partial<Record<GameCategory, string[]>> = {};
  for (const cat of GAME_CATEGORIES) {
    answersByCategory[cat] = [];
  }

  for (const [, answers] of room.submittedAnswers) {
    for (const cat of GAME_CATEGORIES) {
      const ans = answers[cat]?.trim().toLowerCase() || "";
      if (ans) {
        answersByCategory[cat]!.push(ans);
      }
    }
  }

  // Count duplicates
  const duplicateCounts: Partial<Record<GameCategory, Map<string, number>>> = {};
  for (const cat of GAME_CATEGORIES) {
    const counts = new Map<string, number>();
    for (const ans of answersByCategory[cat]!) {
      counts.set(ans, (counts.get(ans) || 0) + 1);
    }
    duplicateCounts[cat] = counts;
  }

  for (const player of room.players) {
    const answers = room.submittedAnswers.get(player.id) || ({} as PlayerAnswers);
    const scores: Record<GameCategory, number> = {} as Record<GameCategory, number>;
    const status: Record<GameCategory, "correct" | "duplicate" | "empty" | "invalid"> =
      {} as Record<GameCategory, "correct" | "duplicate" | "empty" | "invalid">;
    let roundTotal = 0;

    for (const cat of GAME_CATEGORIES) {
      const ans = answers[cat]?.trim() || "";
      if (!ans) {
        scores[cat] = 0;
        status[cat] = "empty";
      } else {
        const dbCategory = CATEGORY_MAP[cat] as WordCategory;
        const validation = validateWord(ans, dbCategory, letter);

        if (!validation.valid) {
          scores[cat] = 0;
          status[cat] = "invalid";
        } else {
          const ansLower = ans.toLowerCase();
          const count = duplicateCounts[cat]!.get(ansLower) || 0;
          if (count > 1) {
            scores[cat] = 0;
            status[cat] = "duplicate";
          } else {
            scores[cat] = 3;
            status[cat] = "correct";
          }
        }
      }
      roundTotal += scores[cat];
    }

    results.push({
      playerId: player.id,
      playerName: player.name,
      answers,
      scores,
      roundTotal,
      status,
    });

    // Update player score
    player.score += roundTotal;
    player.roundScores.push(roundTotal);
  }

  room.roundResults.push(results);
  room.state = "results";

  return results;
}

export function nextRound(roomId: string): { isGameOver: boolean; room: Room | null } {
  const room = rooms.get(roomId);
  if (!room) return { isGameOver: false, room: null };

  if (room.currentRound >= room.totalRounds) {
    room.state = "finished";

    // Calculate coin rewards
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const coinRewards = [20, 15, 10, 5];
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].coins = coinRewards[Math.min(i, coinRewards.length - 1)];
    }

    return { isGameOver: true, room };
  }

  room.currentRound += 1;
  room.currentLetter = getNextLetter(room);
  room.submittedAnswers.clear();
  room.state = "playing";
  room.roundStartTime = Date.now();

  return { isGameOver: false, room };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function findAvailableRoom(): Room | null {
  for (const [, room] of rooms) {
    if (room.state === "waiting" && room.players.length > 0 && room.players.length < 8) {
      return room;
    }
  }
  return null;
}

export function resetRoom(roomId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.letterQueue = shuffleArray(ARABIC_LETTERS);
  room.letterIndex = 0;
  room.state = "waiting";
  room.currentRound = 0;
  room.currentLetter = getNextLetter(room);
  room.submittedAnswers.clear();
  room.roundResults = [];

  for (const player of room.players) {
    player.score = 0;
    player.roundScores = [];
    player.coins = 0;
    player.isReady = false;
  }

  return room;
}
