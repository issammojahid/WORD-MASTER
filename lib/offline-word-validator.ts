import categoryDatabase from "@/server/data/wordDatabase.json";
import letterWordDatabase from "@/server/data/words.json";
import type { GameCategory } from "@/constants/i18n";

const letterDatabase: Record<string, string[]> = letterWordDatabase;

const CATEGORY_MAP = {
  girlName: "girl_names",
  boyName: "boy_names",
  animal: "animals",
  fruit: "fruits",
  vegetable: "vegetables",
  object: "objects",
  city: "cities",
  country: "countries",
} as const;

function normalize(word: string): string {
  return word
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function stripArticle(word: string): string {
  return word.startsWith("ال") ? word.slice(2) : word;
}

export function validateOfflineWord(
  word: string,
  category: GameCategory,
  letter: string,
): boolean {
  if (!word || word.trim().length < 2) return false;

  const normalizedWord = normalize(word);
  const normalizedLetter = normalize(letter);
  const wordRoot = stripArticle(normalizedWord);
  if (!normalizedWord.startsWith(normalizedLetter) && !wordRoot.startsWith(normalizedLetter)) {
    return false;
  }

  const categoryWords = categoryDatabase[CATEGORY_MAP[category]];
  if (categoryWords.some((entry) => normalize(entry) === normalizedWord)) return true;
  if (wordRoot !== normalizedWord && categoryWords.some((entry) => normalize(entry) === wordRoot)) return true;
  if (wordRoot === normalizedWord && categoryWords.some((entry) => normalize(entry) === `ال${normalizedWord}`)) return true;

  const letterWords = letterDatabase[letter] || letterDatabase[normalizedLetter];
  return Array.isArray(letterWords)
    && letterWords.some((entry) => {
      const normalizedEntry = normalize(entry);
      return normalizedEntry === normalizedWord || normalizedEntry === wordRoot;
    });
}

export function getOfflineWordsForCategory(
  category: GameCategory,
  letter: string,
): string[] {
  const normalizedLetter = normalize(letter);
  return Array.from(new Set(
    categoryDatabase[CATEGORY_MAP[category]]
      .filter((word) => {
        if (word.trim().length < 2) return false;
        const normalizedWord = normalize(word);
        const wordRoot = stripArticle(normalizedWord);
        return normalizedWord.startsWith(normalizedLetter) || wordRoot.startsWith(normalizedLetter);
      }),
  ));
}
