import { readFileSync } from "fs";
import { join } from "path";

export type WordCategory =
  | "girl_names"
  | "boy_names"
  | "animals"
  | "fruits"
  | "vegetables"
  | "cities"
  | "countries"
  | "objects";

export const CATEGORY_MAP: Record<string, WordCategory> = {
  girlName: "girl_names",
  boyName: "boy_names",
  animal: "animals",
  fruit: "fruits",
  vegetable: "vegetables",
  object: "objects",
  city: "cities",
  country: "countries",
};

// Load the category-based word database from JSON
function loadWordDatabase(): Record<WordCategory, string[]> {
  const cwd = process.cwd();
  const candidatePaths = [
    join(cwd, "server", "data", "wordDatabase.json"),
    join(cwd, "server_dist", "data", "wordDatabase.json"),
    join(cwd, "data", "wordDatabase.json"),
  ];

  for (const dbPath of candidatePaths) {
    try {
      const raw = readFileSync(dbPath, "utf-8");
      return JSON.parse(raw) as Record<WordCategory, string[]>;
    } catch {
      // try next path
    }
  }

  throw new Error(
    `wordDatabase.json not found. Tried: ${candidatePaths.join(", ")}`
  );
}

// Load the per-letter word database (words.json) — used as a general existence check
function loadLetterDatabase(): Record<string, string[]> {
  const cwd = process.cwd();
  const candidatePaths = [
    join(cwd, "server", "data", "words.json"),
    join(cwd, "server_dist", "data", "words.json"),
    join(cwd, "data", "words.json"),
  ];

  for (const dbPath of candidatePaths) {
    try {
      const raw = readFileSync(dbPath, "utf-8");
      return JSON.parse(raw) as Record<string, string[]>;
    } catch {
      // try next path
    }
  }

  // Return empty object if not found (non-fatal)
  console.warn("words.json not found — per-letter fallback disabled");
  return {};
}

const rawDatabase = loadWordDatabase();
const letterDatabase = loadLetterDatabase();

// Normalize an Arabic string for comparison:
// - Strip diacritics (harakat/tashkeel)
// - Normalize alef variants to ا
// - Normalize ta marbuta
// - Trim whitespace
function normalize(word: string): string {
  return word
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

// Build lookup sets: one exact set and one normalized set per category
const exactSets: Record<WordCategory, Set<string>> = {} as Record<WordCategory, Set<string>>;
const normalizedSets: Record<WordCategory, Set<string>> = {} as Record<WordCategory, Set<string>>;

for (const cat of Object.keys(rawDatabase) as WordCategory[]) {
  const words = rawDatabase[cat];
  exactSets[cat] = new Set(words);
  normalizedSets[cat] = new Set(words.map(normalize));
}

// Build per-letter normalized sets from words.json
const letterNormalizedSets: Record<string, Set<string>> = {};
for (const [letter, words] of Object.entries(letterDatabase)) {
  letterNormalizedSets[normalize(letter)] = new Set((words as string[]).map(normalize));
}

function normalizeLetter(letter: string): string {
  return letter
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .toLowerCase();
}

function stripArticle(normWord: string): string {
  if (normWord.startsWith("ال")) return normWord.slice(2);
  return normWord;
}

export function validateWord(
  word: string,
  category: WordCategory,
  letter: string
): { valid: boolean; reason?: string } {
  // Rule 1: word must have length > 1
  if (!word || word.trim().length < 2) {
    return { valid: false, reason: "too_short" };
  }

  const normWord = normalize(word);
  const normLetter = normalizeLetter(letter);

  // Rule 2: word must start with the required letter (allow ال prefix)
  const wordRoot = stripArticle(normWord);
  if (!normWord.startsWith(normLetter) && !wordRoot.startsWith(normLetter)) {
    return { valid: false, reason: "wrong_letter" };
  }

  // Rule 3: word must exist in database (category-specific check first)
  if (exactSets[category].has(word.trim())) {
    return { valid: true };
  }

  if (normalizedSets[category].has(normWord)) {
    return { valid: true };
  }

  const stripped = stripArticle(normWord);
  if (stripped !== normWord) {
    if (normalizedSets[category].has(stripped)) {
      return { valid: true };
    }
  } else {
    if (normalizedSets[category].has("ال" + normWord)) {
      return { valid: true };
    }
  }

  // Fallback: check per-letter words.json (general Arabic word existence check)
  const letterSet = letterNormalizedSets[normLetter];
  if (letterSet) {
    if (letterSet.has(normWord) || letterSet.has(stripped)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: "not_in_database" };
}

export function getWordsForLetter(
  category: WordCategory,
  letter: string
): string[] {
  const normLetter = normalizeLetter(letter);
  return rawDatabase[category].filter((w) => normalize(w).startsWith(normLetter));
}

export const wordDatabase = rawDatabase;
