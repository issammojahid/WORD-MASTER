export type Language = "ar" | "en";

export type Translations = {
  // General
  appName: string;
  play: string;
  playOffline: string;
  settings: string;
  back: string;
  confirm: string;
  cancel: string;
  ok: string;
  loading: string;
  error: string;
  retry: string;
  privacyOptions: string;
  privacyOptionsHint: string;
  privacyOptionsUnavailable: string;
  advertisement: string;

  // Home
  homeSubtitle: string;
  welcome: string;
  gamesPlayed: string;
  wins: string;
  explore: string;
  rewardsAndProgress: string;
  missionsHint: string;
  achievementsHint: string;
  dailyChallengeHint: string;
  clansHint: string;
  onlineMode: string;
  onlineModeHint: string;
  coins: string;
  level: string;
  xp: string;
  missions: string;
  achievements: string;
  dailyChallenge: string;
  clans: string;
  playOfflineHint: string;
  playOnline: string;
  chooseGameMode: string;
  swipeToChooseMode: string;
  dailyLoginReward: string;
  claimReward: string;

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

  // Online
  randomMatch: string;
  privateRooms: string;
  findOpponent: string;
  searchingOpponent: string;
  cancelSearch: string;
  matchFound: string;
  readyToPlay: string;
  ready: string;
  createRoom: string;
  joinRoom: string;
  roomCode: string;
  copyRoomCode: string;
  shareRoomCode: string;
  copied: string;
  maxPlayers: string;
  rounds: string;
  secondsPerRound: string;
  startMatch: string;
  waitingForPlayers: string;
  connectedPlayers: string;
  host: string;
  leaveRoom: string;
  forfeitMatch: string;
  reconnecting: string;
  noMatchCoins: string;
  onlineUnavailable: string;
  roomNotFound: string;
  roomFull: string;
  alreadyInMatch: string;
  needMorePlayers: string;
  playersNotReady: string;
  hostOnly: string;
  readyTimeout: string;
  matchCancelled: string;
  alreadySubmitted: string;
  roundExpired: string;
  invalidPayload: string;
  invalidSettings: string;
  matchInProgress: string;
  rateLimited: string;
  opponentDisconnected: string;
  onlineResult: string;

  // Offline
  offlineMode: string;
  singlePlayer: string;
  botMatchTitle: string;
  botMatchDescription: string;
  chooseBotDifficulty: string;
  difficultyEasy: string;
  difficultyEasyHint: string;
  difficultyNormal: string;
  difficultyNormalHint: string;
  difficultyHard: string;
  difficultyHardHint: string;
  difficultyLegendary: string;
  difficultyLegendaryHint: string;
  startBotMatch: string;
  botNameOne: string;
  botNameTwo: string;
  botNameThree: string;
  matchStandings: string;
  roundBotScores: string;
  botAnswers: string;
  finalStandings: string;
  youBeatBots: string;
  matchDraw: string;
  botsWon: string;

  // Errors
  connectionError: string;
  invalidWord: string;
};

const ar: Translations = {
  appName: "حروف المغرب",
  play: "العب",
  playOffline: "العب أوفلاين",
  settings: "الإعدادات",
  back: "رجوع",
  confirm: "تأكيد",
  cancel: "إلغاء",
  ok: "حسناً",
  loading: "جاري التحميل...",
  error: "خطأ",
  retry: "إعادة المحاولة",
  privacyOptions: "اختيارات الخصوصية",
  privacyOptionsHint: "إدارة خيارات استخدام البيانات للإعلانات",
  privacyOptionsUnavailable: "تعذر فتح خيارات الخصوصية الآن. حاول مرة أخرى لاحقاً.",
  advertisement: "إعلان",

  homeSubtitle: "لعبة الكلمات العربية",
  welcome: "مرحباً",
  gamesPlayed: "مباريات",
  wins: "انتصارات",
  explore: "اكتشف المزيد",
  rewardsAndProgress: "مهامك ومكافآتك في مكان واحد",
  missionsHint: "أنجز واكسب",
  achievementsHint: "افتح جوائزك",
  dailyChallengeHint: "تحدٍ جديد اليوم",
  clansHint: "فوز جماعي",
  onlineMode: "اللعب عبر الإنترنت",
  onlineModeHint: "نافس لاعبين حقيقيين عبر الإنترنت",
  coins: "نقود",
  level: "المستوى",
  xp: "نقاط الخبرة",
  missions: "المهام",
  achievements: "الإنجازات",
  dailyChallenge: "التحدي اليومي",
  clans: "العشائر",
  playOfflineHint: "لعبة فردية بدون إنترنت",
  playOnline: "العب عبر الإنترنت",
  chooseGameMode: "اختر طريقة اللعب",
  swipeToChooseMode: "اسحب للتبديل بين أوضاع اللعب",
  dailyLoginReward: "مكافأة الدخول اليومية",
  claimReward: "استلم المكافأة",

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

  randomMatch: "مباراة عشوائية",
  privateRooms: "غرف خاصة",
  findOpponent: "ابحث عن خصم",
  searchingOpponent: "كنقلبو على خصم...",
  cancelSearch: "إلغاء البحث",
  matchFound: "لقينا خصم!",
  readyToPlay: "واش واجد تبدا؟",
  ready: "أنا واجد",
  createRoom: "إنشاء غرفة",
  joinRoom: "دخول لغرفة",
  roomCode: "كود الغرفة",
  copyRoomCode: "نسخ الكود",
  shareRoomCode: "مشاركة الكود",
  copied: "تنسخ الكود",
  maxPlayers: "عدد اللاعبين",
  rounds: "الجولات",
  secondsPerRound: "وقت الجولة",
  startMatch: "بدا المباراة",
  waitingForPlayers: "كنتسناو اللاعبين...",
  connectedPlayers: "اللاعبون المتصلون",
  host: "المضيف",
  leaveRoom: "الخروج من الغرفة",
  forfeitMatch: "الانسحاب من المباراة",
  reconnecting: "كنعاودو الاتصال...",
  noMatchCoins: "الغرف الخاصة بلا مكافآت عملات",
  onlineUnavailable: "اللعب عبر الإنترنت غير متاح حالياً",
  roomNotFound: "ما لقيناش هاد الغرفة",
  roomFull: "الغرفة عامرة",
  alreadyInMatch: "راك ديجا فمباراة",
  needMorePlayers: "خاص جوج لاعبين على الأقل",
  playersNotReady: "خاص جميع اللاعبين يكونو واجدين",
  hostOnly: "غير المضيف يقدر يدير هاد الإجراء",
  readyTimeout: "سال الوقت باش تأكد الاستعداد",
  matchCancelled: "تلغات المباراة بلا مكافآت",
  alreadySubmitted: "صيفطتي الأجوبة ديالك ديجا",
  roundExpired: "سالات مدة الجولة",
  invalidPayload: "المعلومات المرسلة غير صالحة",
  invalidSettings: "إعدادات الغرفة غير صالحة",
  matchInProgress: "المباراة جارية أو غير جاهزة",
  rateLimited: "تسنى شوية وعاود المحاولة",
  opponentDisconnected: "تقطع الاتصال بخصمك",
  onlineResult: "نتيجة المباراة",

  offlineMode: "وضع غير متصل",
  singlePlayer: "لاعب واحد",
  botMatchTitle: "تحدَّ منافسيك من الذكاء الاصطناعي",
  botMatchDescription: "ثلاثة منافسين يلعبون معك بدون إنترنت",
  chooseBotDifficulty: "اختر مستوى المنافسة",
  difficultyEasy: "سهل",
  difficultyEasyHint: "منافسون جدد — فرصة للفوز والتعلّم",
  difficultyNormal: "عادي",
  difficultyNormalHint: "تحدٍ متوازن للمباراة اليومية",
  difficultyHard: "صعب",
  difficultyHardHint: "منافسون أذكياء وإجابات أكثر",
  difficultyLegendary: "أسطوري",
  difficultyLegendaryHint: "أقوى المنافسين — هل أنت قدّها؟",
  startBotMatch: "ابدأ المباراة",
  botNameOne: "أمين",
  botNameTwo: "سلمى",
  botNameThree: "حمزة",
  matchStandings: "نتائج المباراة",
  roundBotScores: "نقاط المنافسين في هذه الجولة",
  botAnswers: "الإجابات",
  finalStandings: "الترتيب النهائي",
  youBeatBots: "فزت على المنافسين!",
  matchDraw: "تعادل! مباراة قوية",
  botsWon: "المنافسون فازوا هذه المرة",

  connectionError: "خطأ في الاتصال",
  invalidWord: "كلمة غير صالحة",
};

const en: Translations = {
  appName: "Huroof Al Maghrib",
  play: "Play",
  playOffline: "Play Offline",
  settings: "Settings",
  back: "Back",
  confirm: "Confirm",
  cancel: "Cancel",
  ok: "OK",
  loading: "Loading...",
  error: "Error",
  retry: "Retry",
  privacyOptions: "Privacy choices",
  privacyOptionsHint: "Manage data-use choices for ads",
  privacyOptionsUnavailable: "Privacy choices are unavailable right now. Please try again later.",
  advertisement: "Advertisement",

  homeSubtitle: "Arabic Word Game",
  welcome: "Welcome",
  gamesPlayed: "Games",
  wins: "Wins",
  explore: "Explore",
  rewardsAndProgress: "Missions and rewards in one place",
  missionsHint: "Complete and earn",
  achievementsHint: "Unlock rewards",
  dailyChallengeHint: "Today's challenge",
  clansHint: "Win as a team",
  onlineMode: "Online Mode",
  onlineModeHint: "Compete against real players online",
  coins: "Coins",
  level: "Level",
  xp: "XP",
  missions: "Missions",
  achievements: "Achievements",
  dailyChallenge: "Daily Challenge",
  clans: "Clans",
  playOfflineHint: "Single-player, no internet needed",
  playOnline: "Play Online",
  chooseGameMode: "Choose your game mode",
  swipeToChooseMode: "Swipe to switch between game modes",
  dailyLoginReward: "Daily login reward",
  claimReward: "Claim reward",

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

  randomMatch: "Random Match",
  privateRooms: "Private Rooms",
  findOpponent: "Find Opponent",
  searchingOpponent: "Searching for an opponent...",
  cancelSearch: "Cancel Search",
  matchFound: "Opponent Found!",
  readyToPlay: "Ready to start?",
  ready: "I'm Ready",
  createRoom: "Create Room",
  joinRoom: "Join Room",
  roomCode: "Room Code",
  copyRoomCode: "Copy Code",
  shareRoomCode: "Share Code",
  copied: "Code copied",
  maxPlayers: "Players",
  rounds: "Rounds",
  secondsPerRound: "Round Timer",
  startMatch: "Start Match",
  waitingForPlayers: "Waiting for players...",
  connectedPlayers: "Connected Players",
  host: "Host",
  leaveRoom: "Leave Room",
  forfeitMatch: "Forfeit Match",
  reconnecting: "Reconnecting...",
  noMatchCoins: "Private rooms do not award coins",
  onlineUnavailable: "Online play is unavailable right now",
  roomNotFound: "Room not found",
  roomFull: "Room is full",
  alreadyInMatch: "You are already in a match",
  needMorePlayers: "At least two players are required",
  playersNotReady: "All players must be ready",
  hostOnly: "Only the host can do this",
  readyTimeout: "Ready confirmation timed out",
  matchCancelled: "Match cancelled; no rewards were issued",
  alreadySubmitted: "Your answers were already submitted",
  roundExpired: "Round time has expired",
  invalidPayload: "Invalid request",
  invalidSettings: "Invalid room settings",
  matchInProgress: "The match is in progress or not ready",
  rateLimited: "Please wait before trying again",
  opponentDisconnected: "Opponent disconnected",
  onlineResult: "Match Results",

  offlineMode: "Offline Mode",
  singlePlayer: "Single Player",
  botMatchTitle: "Challenge the AI rivals",
  botMatchDescription: "Three opponents play with you, no internet needed",
  chooseBotDifficulty: "Choose difficulty",
  difficultyEasy: "Easy",
  difficultyEasyHint: "New rivals — a chance to learn and win",
  difficultyNormal: "Normal",
  difficultyNormalHint: "A balanced everyday match",
  difficultyHard: "Hard",
  difficultyHardHint: "Smart rivals with more answers",
  difficultyLegendary: "Legendary",
  difficultyLegendaryHint: "The toughest rivals — ready for it?",
  startBotMatch: "Start match",
  botNameOne: "Amin",
  botNameTwo: "Salma",
  botNameThree: "Hamza",
  matchStandings: "Match standings",
  roundBotScores: "Rival points this round",
  botAnswers: "Answers",
  finalStandings: "Final standings",
  youBeatBots: "You beat the rivals!",
  matchDraw: "It's a draw! Great match",
  botsWon: "The rivals won this time",

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

export type WordCategoryId = "general" | "animals" | "countries" | "food" | "names" | "objects" | "cities";

export const WORD_CATEGORIES: {
  id: WordCategoryId;
  emoji: string;
  labelAr: string;
  labelEn: string;
  gameCategories: GameCategory[];
}[] = [
  { id: "general",   emoji: "🔤", labelAr: "عام",     labelEn: "General",   gameCategories: [...GAME_CATEGORIES] },
  { id: "animals",   emoji: "🦁", labelAr: "حيوانات", labelEn: "Animals",   gameCategories: ["animal"] },
  { id: "countries", emoji: "🌍", labelAr: "دول",     labelEn: "Countries", gameCategories: ["country", "city"] },
  { id: "food",      emoji: "🍕", labelAr: "طعام",    labelEn: "Food",      gameCategories: ["fruit", "vegetable"] },
  { id: "names",     emoji: "👤", labelAr: "أسماء",   labelEn: "Names",     gameCategories: ["boyName", "girlName"] },
  { id: "objects",   emoji: "📦", labelAr: "جمادات",  labelEn: "Objects",   gameCategories: ["object"] },
  { id: "cities",    emoji: "🏙️", labelAr: "مدن",     labelEn: "Cities",    gameCategories: ["city"] },
];

export const MAPS = [
  { id: "casablanca", color: "#1A3A5C" },
  { id: "marrakech", color: "#8B2500" },
  { id: "rabat", color: "#1A5C2A" },
  { id: "tangier", color: "#1A4A6B" },
  { id: "chefchaouen", color: "#1A3A7A" },
] as const;

export type MapId = typeof MAPS[number]["id"];
