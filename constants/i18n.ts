export type Language = "ar" | "en";

export type Translations = {
  // General
  appName: string;
  play: string;
  playOnline: string;
  playOffline: string;
  leaderboard: string;
  shop: string;
  settings: string;
  back: string;
  confirm: string;
  cancel: string;
  ok: string;
  loading: string;
  error: string;
  retry: string;

  // Home
  homeSubtitle: string;
  welcome: string;
  coins: string;
  level: string;
  xp: string;

  // Lobby
  createRoom: string;
  joinRoom: string;
  roomCode: string;
  enterRoomCode: string;
  players: string;
  minPlayers: string;
  maxPlayers: string;
  waitingForPlayers: string;
  startGame: string;
  readyPlayers: string;
  copyCode: string;
  codeCopied: string;

  // Game
  currentLetter: string;
  timeLeft: string;
  submit: string;
  round: string;
  stop: string;
  allPlayersSubmitted: string;

  // Categories
  girlName: string;
  boyName: string;
  animal: string;
  fruit: string;
  vegetable: string;
  object: string;
  city: string;
  country: string;

  // Results
  results: string;
  correct: string;
  duplicate: string;
  empty: string;
  points: string;
  totalScore: string;
  nextRound: string;
  gameOver: string;
  winner: string;
  coinsEarned: string;
  xpEarned: string;
  playAgain: string;
  backToHome: string;

  // Score labels
  correctPoints: string;
  duplicatePoints: string;
  emptyPoints: string;

  // Leaderboard
  rank: string;
  player: string;
  score: string;
  yourRank: string;
  topPlayers: string;

  // Shop
  buy: string;
  equipped: string;
  equip: string;
  notEnoughCoins: string;
  skinStudent: string;
  skinDjellaba: string;
  skinSport: string;
  skinChampion: string;

  // Settings
  language: string;
  arabic: string;
  english: string;
  map: string;
  selectMap: string;
  casablanca: string;
  marrakech: string;
  rabat: string;
  tangier: string;
  chefchaouen: string;

  // Offline
  offlineMode: string;
  aiPlayers: string;
  singlePlayer: string;

  // Errors
  roomNotFound: string;
  roomFull: string;
  connectionError: string;
  invalidWord: string;
};

const ar: Translations = {
  appName: "حروف المغرب",
  play: "العب",
  playOnline: "العب أونلاين",
  playOffline: "العب أوفلاين",
  leaderboard: "لوحة الصدارة",
  shop: "المتجر",
  settings: "الإعدادات",
  back: "رجوع",
  confirm: "تأكيد",
  cancel: "إلغاء",
  ok: "حسناً",
  loading: "جاري التحميل...",
  error: "خطأ",
  retry: "إعادة المحاولة",

  homeSubtitle: "لعبة الكلمات العربية",
  welcome: "مرحباً",
  coins: "نقود",
  level: "المستوى",
  xp: "نقاط الخبرة",

  createRoom: "إنشاء غرفة",
  joinRoom: "الانضمام لغرفة",
  roomCode: "رمز الغرفة",
  enterRoomCode: "أدخل رمز الغرفة",
  players: "لاعبون",
  minPlayers: "الحد الأدنى ٣ لاعبين",
  maxPlayers: "الحد الأقصى ٨ لاعبين",
  waitingForPlayers: "في انتظار اللاعبين...",
  startGame: "ابدأ اللعبة",
  readyPlayers: "لاعبون جاهزون",
  copyCode: "نسخ الرمز",
  codeCopied: "تم نسخ الرمز!",

  currentLetter: "الحرف الحالي",
  timeLeft: "الوقت المتبقي",
  submit: "إرسال",
  round: "الجولة",
  stop: "وقف!",
  allPlayersSubmitted: "جميع اللاعبين أرسلوا إجاباتهم",

  girlName: "اسم بنت",
  boyName: "اسم ولد",
  animal: "حيوان",
  fruit: "فاكهة",
  vegetable: "خضرة",
  object: "شيء",
  city: "مدينة",
  country: "دولة",

  results: "النتائج",
  correct: "صحيح",
  duplicate: "مكرر",
  empty: "فارغ",
  points: "نقاط",
  totalScore: "المجموع",
  nextRound: "الجولة التالية",
  gameOver: "انتهت اللعبة",
  winner: "الفائز",
  coinsEarned: "النقود المكتسبة",
  xpEarned: "الخبرة المكتسبة",
  playAgain: "العب مجدداً",
  backToHome: "العودة للرئيسية",

  correctPoints: "٣ نقاط",
  duplicatePoints: "٠ نقاط (مكرر)",
  emptyPoints: "٠ نقاط (فارغ)",

  rank: "المرتبة",
  player: "اللاعب",
  score: "النقاط",
  yourRank: "مرتبتك",
  topPlayers: "أفضل اللاعبين",

  buy: "شراء",
  equipped: "مجهز",
  equip: "تجهيز",
  notEnoughCoins: "النقود غير كافية",
  skinStudent: "الطالب",
  skinDjellaba: "الجلابة",
  skinSport: "الرياضي",
  skinChampion: "البطل",

  language: "اللغة",
  arabic: "العربية",
  english: "الإنجليزية",
  map: "الخريطة",
  selectMap: "اختر الخريطة",
  casablanca: "الدار البيضاء",
  marrakech: "مراكش",
  rabat: "الرباط",
  tangier: "طنجة",
  chefchaouen: "شفشاون",

  offlineMode: "وضع غير متصل",
  aiPlayers: "لاعبون آليون",
  singlePlayer: "لاعب واحد",

  roomNotFound: "الغرفة غير موجودة",
  roomFull: "الغرفة ممتلئة",
  connectionError: "خطأ في الاتصال",
  invalidWord: "كلمة غير صالحة",
};

const en: Translations = {
  appName: "Huroof Al Maghrib",
  play: "Play",
  playOnline: "Play Online",
  playOffline: "Play Offline",
  leaderboard: "Leaderboard",
  shop: "Shop",
  settings: "Settings",
  back: "Back",
  confirm: "Confirm",
  cancel: "Cancel",
  ok: "OK",
  loading: "Loading...",
  error: "Error",
  retry: "Retry",

  homeSubtitle: "Arabic Word Game",
  welcome: "Welcome",
  coins: "Coins",
  level: "Level",
  xp: "XP",

  createRoom: "Create Room",
  joinRoom: "Join Room",
  roomCode: "Room Code",
  enterRoomCode: "Enter room code",
  players: "Players",
  minPlayers: "Min 3 players",
  maxPlayers: "Max 8 players",
  waitingForPlayers: "Waiting for players...",
  startGame: "Start Game",
  readyPlayers: "Ready Players",
  copyCode: "Copy Code",
  codeCopied: "Code Copied!",

  currentLetter: "Current Letter",
  timeLeft: "Time Left",
  submit: "Submit",
  round: "Round",
  stop: "STOP!",
  allPlayersSubmitted: "All players submitted",

  girlName: "Girl's Name",
  boyName: "Boy's Name",
  animal: "Animal",
  fruit: "Fruit",
  vegetable: "Vegetable",
  object: "Object",
  city: "City",
  country: "Country",

  results: "Results",
  correct: "Correct",
  duplicate: "Duplicate",
  empty: "Empty",
  points: "Points",
  totalScore: "Total",
  nextRound: "Next Round",
  gameOver: "Game Over",
  winner: "Winner",
  coinsEarned: "Coins Earned",
  xpEarned: "XP Earned",
  playAgain: "Play Again",
  backToHome: "Back to Home",

  correctPoints: "3 points",
  duplicatePoints: "0 points (duplicate)",
  emptyPoints: "0 points (empty)",

  rank: "Rank",
  player: "Player",
  score: "Score",
  yourRank: "Your Rank",
  topPlayers: "Top Players",

  buy: "Buy",
  equipped: "Equipped",
  equip: "Equip",
  notEnoughCoins: "Not enough coins",
  skinStudent: "Student",
  skinDjellaba: "Djellaba",
  skinSport: "Sport",
  skinChampion: "Champion",

  language: "Language",
  arabic: "Arabic",
  english: "English",
  map: "Map",
  selectMap: "Select Map",
  casablanca: "Casablanca",
  marrakech: "Marrakech",
  rabat: "Rabat",
  tangier: "Tangier",
  chefchaouen: "Chefchaouen",

  offlineMode: "Offline Mode",
  aiPlayers: "AI Players",
  singlePlayer: "Single Player",

  roomNotFound: "Room not found",
  roomFull: "Room is full",
  connectionError: "Connection error",
  invalidWord: "Invalid word",
};

export const translations: Record<Language, Translations> = { ar, en };

export const ARABIC_LETTERS = [
  "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
  "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
  "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

export const GAME_CATEGORIES = [
  "girlName",
  "boyName",
  "animal",
  "fruit",
  "vegetable",
  "object",
  "city",
  "country",
] as const;

export type GameCategory = typeof GAME_CATEGORIES[number];

export type WordCategoryId = "general" | "animals" | "countries" | "food" | "sports" | "movies" | "cities";

export const WORD_CATEGORIES: {
  id: WordCategoryId;
  emoji: string;
  labelAr: string;
  labelEn: string;
  gameCategories: GameCategory[];
}[] = [
  { id: "general",   emoji: "🔤", labelAr: "عام",     labelEn: "General",   gameCategories: [...GAME_CATEGORIES] },
  { id: "animals",   emoji: "🦁", labelAr: "حيوانات", labelEn: "Animals",   gameCategories: ["animal", "country", "object"] },
  { id: "countries", emoji: "🌍", labelAr: "دول",     labelEn: "Countries", gameCategories: ["country", "city", "boyName"] },
  { id: "food",      emoji: "🍕", labelAr: "طعام",    labelEn: "Food",      gameCategories: ["fruit", "vegetable", "object"] },
  { id: "sports",    emoji: "⚽", labelAr: "رياضة",   labelEn: "Sports",    gameCategories: ["boyName", "country", "city"] },
  { id: "movies",    emoji: "🎬", labelAr: "أفلام",   labelEn: "Movies",    gameCategories: ["boyName", "girlName", "city"] },
  { id: "cities",    emoji: "🏙️", labelAr: "مدن",     labelEn: "Cities",    gameCategories: ["city", "country", "object"] },
];

export const MAPS = [
  { id: "casablanca", color: "#1A3A5C" },
  { id: "marrakech", color: "#8B2500" },
  { id: "rabat", color: "#1A5C2A" },
  { id: "tangier", color: "#1A4A6B" },
  { id: "chefchaouen", color: "#1A3A7A" },
] as const;

export type MapId = typeof MAPS[number]["id"];
