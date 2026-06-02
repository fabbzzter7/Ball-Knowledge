import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, CheckCircle2, XCircle, Trash2, X } from "lucide-react";
import { ANSWER_ALIASES, LAST_WORD_BLACKLIST } from "./answerAliases";
import PlayerAvatar, { getAvatarConfig } from "./components/PlayerAvatar";
import GuessInput from "./components/GuessInput";
import PlayerPicker from "./components/PlayerPicker";

import { QUESTIONS } from "./QUESTIONS";
import { CAREER_QUESTIONS } from "./CAREER_QUESTIONS";
import { DAILY_LIST_CHALLENGES } from "./DAILY_LIST_CHALLENGES";
import { WORLD_CUP_QUESTIONS } from "./WORLD_CUP_QUESTIONS";
import { CONNECTIONS_PUZZLES } from "./CONNECTIONS_PUZZLES";
import { WHO_AM_I_QUESTIONS } from "./WHO_AM_I_QUESTIONS";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  createProfile,
  fetchProfile,
  getDefaultProfile,
  getOrCreatePlayerId,
  syncLocalStatsToProfile,
  updateProfile,
} from "./lib/profileService";
import { fetchFindPlayerPool } from "./lib/playerService";
import { isPlayerAnswerMatch } from "./lib/playerAnswer";
import {
  buildPlayerDistanceRanking,
  getDistanceBarPercent,
  getDistanceColor,
  getDistanceLabel,
  getFindPlayerPoints,
  pickDailyFindPlayerTargets,
  rankGuessAgainstTarget,
} from "./lib/playerDistance";
import {
  addStat,
  createXpEvent,
  getInitialProgression,
  getProgressionView,
  maxStat,
  persistLocalProgression,
} from "./lib/progressionService";
import {
  getMultiplayerQuestionsByIds,
  pickMultiplayerQuestionIds,
} from "./multiplayerQuestionBank";
import {
  createLeague,
  fetchLeagueDashboard,
  fetchMyLeagues,
  getOrCreateLeagueDay,
  joinLeague,
  submitLeagueDailyResult,
} from "./lib/leagueService";
import {
  getLeagueQuestionsByIds,
  getLeagueSettingsSummary,
  getLeagueTop10Challenge,
  getLeagueTop10ChallengeById,
  getLeagueWhoAmIQuestionsByIds,
} from "./lib/leagueChallengeUtils";
import { findOrCreatePublicMatch } from "./lib/matchmakingService";
import {
  isSoundEnabled,
  playButtonTapSound,
  playCoinSound,
  playCorrectSound,
  playLevelUpSound,
  playStreakSound,
  playWrongSound,
  setSoundEnabled,
} from "./lib/soundManager";

import stadiumBg from "./assets/stadium-bg.png";
import quizBg from "./assets/quiz-bg.png";

const HARD_TIME_LIMIT = 15;
const MULTIPLAYER_TIME_LIMIT = 8;
const MULTIPLAYER_TIMEOUT_VALUE = "__time_up__";
const DAILY_SCAN_STEP_MS = 210;
const STREAK_TARGETS = [5, 10, 20, 30, 50];
const AVATAR_ICON_OPTIONS = [
  "⚽",
  "🏆",
  "🔥",
  "🧠",
  "🐐",
  "⭐",
  "👑",
  "🧤",
  "⚡",
  "🦁",
  "🦊",
  "🐺",
  "🐉",
  "🦅",
];
const AVATAR_STYLE_OPTIONS = [
  { value: "classic", label: "Classic" },
  { value: "captain", label: "Captain" },
  { value: "legend", label: "Legend" },
  { value: "goalkeeper", label: "Keeper" },
  { value: "striker", label: "Striker" },
  { value: "mystery", label: "Mystery" },
];
const AVATAR_COLOR_OPTIONS = [
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "gold", label: "Gold" },
  { value: "pink", label: "Pink" },
  { value: "ice", label: "Ice" },
];
const AVATAR_BG_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "stadium", label: "Stadium" },
  { value: "neon", label: "Neon" },
  { value: "pitch", label: "Pitch" },
  { value: "trophy", label: "Trophy" },
  { value: "night", label: "Night" },
];
const MULTIPLAYER_CATEGORIES = [
  { id: "general", label: "General Knowledge", mode: "general", available: true },
  { id: "world_cup", label: "World Cup", mode: "world_cup", available: true },
  {
    id: "premier_league",
    label: "Premier League",
    mode: "premier_league",
    available: true,
  },
  { id: "career_path", label: "Career Path", mode: "career_path", available: true },
];

const LEAGUE_FORMATS = {
  balanced: {
    label: "Balanced",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "5 quick questions + 1 Top 10",
  },
  quick_quiz: {
    label: "Quick Quiz",
    quizCount: 10,
    top10Count: 0,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "10 quick questions",
  },
  top10_only: {
    label: "Top 10 Only",
    quizCount: 0,
    top10Count: 1,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "1 Top 10 list",
  },
  mystery_mix: {
    label: "Mystery Mix",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 1,
    findPlayerCount: 0,
    description: "5 quick questions + Top 10 + Who Am I",
  },
  whoami_only: {
    label: "Who Am I Only",
    quizCount: 0,
    top10Count: 0,
    whoamiCount: 5,
    findPlayerCount: 0,
    description: "5 mystery players",
  },
  find_player: {
    label: "Find the Player",
    quizCount: 0,
    top10Count: 0,
    whoamiCount: 0,
    findPlayerCount: 1,
    findPlayerScoringMode: "attempts",
    description: "1 distance puzzle",
  },
  long_mix: {
    label: "Long Mix",
    quizCount: 10,
    top10Count: 1,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "10 quick questions + 1 Top 10",
  },
  custom: {
    label: "Custom",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "Choose your daily structure",
  },
};

const LEAGUE_DURATIONS = [
  { label: "Infinite", value: null },
  { label: "10 days", value: 10 },
  { label: "20 days", value: 20 },
  { label: "30 days", value: 30 },
];

const CUSTOM_QUIZ_COUNTS = [0, 5, 10, 15];
const CUSTOM_TOP10_COUNTS = [0, 1, 2];
const CUSTOM_WHOAMI_COUNTS = [0, 1, 3, 5];
const CUSTOM_FIND_PLAYER_COUNTS = [0, 1, 2, 3];

const CLUB_THEME_MAP = {
  "manchester united": "manchester-united",
  "man united": "manchester-united",
  "real madrid": "real-madrid",
  barcelona: "barcelona",
  juventus: "juventus",
  psg: "psg",
  milan: "milan",
  "ac milan": "milan",
  inter: "inter",
  "bayern munich": "bayern",
  bayern: "bayern",
  liverpool: "liverpool",
  arsenal: "arsenal",
  chelsea: "chelsea",
  ajax: "ajax",
  tottenham: "tottenham",
  "sporting cp": "sporting",
  sporting: "sporting",
  benfica: "benfica",
  dortmund: "dortmund",
  "borussia dortmund": "dortmund",
};

const DAILY_STREAK_REWARDS = [
  { dayInRoad: 1, reward: 10 },
  { dayInRoad: 2, reward: 20 },
  { dayInRoad: 3, reward: 25 },
  { dayInRoad: 4, reward: 35 },
  { dayInRoad: 5, reward: 60 },
  { dayInRoad: 6, reward: 45 },
  { dayInRoad: 7, reward: 100 },
];

function shuffle(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

function shuffleQuestionOptions(question) {
  if (!Array.isArray(question?.options)) return question;

  if (!question.options.includes(question.answer)) {
    console.warn("Question answer missing from options", question);
    return question;
  }

  return {
    ...question,
    options: shuffle(question.options),
  };
}

function normalizeAnswer(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

function getAcceptedAnswers(correctAnswer) {
  const answerText = getAnswerLabel(correctAnswer);
  const normalizedCorrect = normalizeAnswer(answerText);
  const aliases = [
    ...(ANSWER_ALIASES[normalizedCorrect] || []),
    ...getAnswerAliases(correctAnswer),
  ];
  const accepted = [answerText, ...aliases];
  const words = normalizedCorrect.split(" ");

  const canUseLastWord =
    words.length > 1 &&
    !LAST_WORD_BLACKLIST.has(normalizedCorrect) &&
    !normalizedCorrect.includes(" and ");

  if (canUseLastWord) {
    accepted.push(words.at(-1));
  }

  return accepted.map(normalizeAnswer);
}

function isCorrectAnswer(input, correctAnswer) {
  const userAnswer = normalizeAnswer(input);
  const acceptedAnswers = getAcceptedAnswers(correctAnswer);
  return acceptedAnswers.includes(userAnswer);
}

function isCorrectPlayerAnswer(player, correctAnswer) {
  if (!player) return false;

  const guesses = [player.name, ...(Array.isArray(player.aliases) ? player.aliases : [])];
  return guesses.some((guess) => isCorrectAnswer(guess, correctAnswer));
}

function isPlayerAnswerType(challenge) {
  return challenge?.answerType === "player";
}

function getAnswerLabel(answer) {
  if (typeof answer === "string") return answer;
  return answer?.answer || answer?.name || answer?.label || "";
}

function getAnswerAliases(answer) {
  if (!answer || typeof answer === "string") return [];
  return answer.aliases || answer.acceptedAnswers || [];
}

function getAnswerValue(answer) {
  if (!answer || typeof answer === "string") return "";
  return answer.value ?? answer.count ?? answer.stat ?? "";
}

function formatAnswerWithValue(answer) {
  const label = getAnswerLabel(answer);
  const value = getAnswerValue(answer);
  return value === "" || value === null || value === undefined
    ? label
    : `${label} — ${value}`;
}

function getAnswerKey(answer, fallback = "") {
  return `${getAnswerLabel(answer)}-${getAnswerValue(answer) || fallback}`;
}

function getGeneralHighscoreXpBonus(finalScore) {
  if (finalScore >= 101) return 5000;
  if (finalScore >= 76) return 3000;
  if (finalScore >= 51) return 2000;
  if (finalScore >= 41) return 1500;
  if (finalScore >= 31) return 1200;
  if (finalScore >= 21) return 900;
  if (finalScore >= 11) return 600;
  if (finalScore >= 1) return 300;
  return 0;
}

function getDailyDateKey() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getTodayChallenge() {
  if (!DAILY_LIST_CHALLENGES || DAILY_LIST_CHALLENGES.length === 0) {
    return {
      id: "fallback",
      label: "Daily Challenge",
      question: "No daily challenge found.",
      answers: [],
    };
  }

  const today = new Date();
  const startDate = new Date(2026, 0, 1);
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const oneDay = 1000 * 60 * 60 * 24;
  const daysPassed = Math.floor((todayDate - startDate) / oneDay);
  const index = daysPassed % DAILY_LIST_CHALLENGES.length;

  return DAILY_LIST_CHALLENGES[index];
}

function getStreakReward(streak) {
  const dayInRoad = ((Math.max(1, streak) - 1) % 7) + 1;

  return (
    DAILY_STREAK_REWARDS.find((reward) => reward.dayInRoad === dayInRoad)
      ?.reward || 10
  );
}

function getStreakRoadStart(streak) {
  return Math.floor(Math.max(0, streak - 1) / 7) * 7 + 1;
}

function getStreakRoadDays(streak) {
  const start = getStreakRoadStart(streak);

  return DAILY_STREAK_REWARDS.map((reward, index) => ({
    day: start + index,
    dayInRoad: reward.dayInRoad,
    reward: reward.reward,
  }));
}

function getNextStreakRewardInfo(streak, todayCompleted = false) {
  const nextDay = todayCompleted ? streak + 1 : Math.max(1, streak + 1);
  return {
    day: nextDay,
    reward: getStreakReward(nextDay),
  };
}

function getNextStreakTarget(streak) {
  return (
    STREAK_TARGETS.find((target) => streak < target) ??
    STREAK_TARGETS[STREAK_TARGETS.length - 1]
  );
}

function getPrevStreakTarget(streak) {
  let prev = 0;

  for (const target of STREAK_TARGETS) {
    if (streak >= target) {
      prev = target;
    }
  }

  return prev;
}

function getStreakProgress(streak) {
  const next = getNextStreakTarget(streak);
  const prev = getPrevStreakTarget(streak);

  if (streak >= STREAK_TARGETS[STREAK_TARGETS.length - 1]) {
    return 100;
  }

  const range = next - prev;
  const progress = streak - prev;

  return Math.max(0, Math.min(100, (progress / range) * 100));
}

function buildGameQuestions(mode = "general") {
  if (mode === "career") {
    return shuffle(CAREER_QUESTIONS);
  }

  if (mode === "world-cup") {
    const easy = WORLD_CUP_QUESTIONS.filter((q) => q.difficulty === "Easy");
    const medium = WORLD_CUP_QUESTIONS.filter((q) => q.difficulty === "Medium");
    const hard = WORLD_CUP_QUESTIONS.filter((q) => q.difficulty === "Hard");
    const veryHard = WORLD_CUP_QUESTIONS.filter(
      (q) => q.difficulty === "Very Hard"
    );

    return [
      ...shuffle(easy).slice(0, 10),
      ...shuffle(medium).slice(0, 15),
      ...shuffle(hard).slice(0, 25),
      ...shuffle(veryHard),
    ].map(shuffleQuestionOptions);
  }

  const easy = QUESTIONS.filter((q) => q.difficulty === "Easy");
  const medium = QUESTIONS.filter((q) => q.difficulty === "Medium");
  const hard = QUESTIONS.filter((q) => q.difficulty === "Hard");
  const veryHard = QUESTIONS.filter((q) => q.difficulty === "Very Hard");

  const selectedQuestions = [
    ...shuffle(easy).slice(0, 10),
    ...shuffle(medium).slice(0, 20),
    ...shuffle(hard).slice(0, 20),
    ...shuffle(veryHard),
    ...shuffle(hard).slice(20),
  ];

  return selectedQuestions.map(shuffleQuestionOptions);
}

const screenTransition = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.985 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

function ScreenTransition({ children, className = "screen-transition" }) {
  return (
    <motion.div className={className} {...screenTransition}>
      {children}
    </motion.div>
  );
}

function buildConnectionsTiles(puzzle) {
  return shuffle(
    puzzle.groups.flatMap((group, groupIndex) =>
      group.items.map((item) => ({
        id: `${puzzle.id}-${groupIndex}-${item}`,
        item,
        groupIndex,
      }))
    )
  );
}

function getRandomConnectionsPuzzle() {
  return CONNECTIONS_PUZZLES[
    Math.floor(Math.random() * CONNECTIONS_PUZZLES.length)
  ];
}

function getWhoAmIAcceptedAnswers(question) {
  const accepted = new Set([
    normalizeAnswer(question.answer),
    ...(question.acceptedAnswers || []).map(normalizeAnswer),
  ]);
  const words = normalizeAnswer(question.answer).split(" ");
  const lastName = words.at(-1);

  if (lastName && !["ronaldo"].includes(lastName)) {
    accepted.add(lastName);
  }

  return accepted;
}

function isCorrectWhoAmIAnswer(input, question) {
  return isPlayerAnswerMatch({ typedText: input, answer: question });
}

function isCorrectWhoAmIPlayerAnswer(player, question, typedText = "") {
  return isPlayerAnswerMatch({
    typedText,
    selectedPlayer: player,
    answer: question,
  });
}

function getSavedDailyResult() {
  const saved = localStorage.getItem("ballKnowledgeDailyResult");

  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem("ballKnowledgeDailyResult");
    return null;
  }
}

function getModeLabel(mode) {
  if (mode === "world-cup" || mode === "world_cup") return "World Cup";
  if (mode === "premier_league") return "Premier League";
  if (mode === "career" || mode === "career_path") return "Career Path";
  return "General";
}

function getCareerPathClubs(question = "") {
  return String(question)
    .split(/\s*(?:→|->)\s*/)
    .map((club) => club.trim())
    .filter(Boolean);
}

function getClubThemeClass(club) {
  const key = normalizeAnswer(club).replace(/-/g, " ");
  return CLUB_THEME_MAP[key] || "default";
}

function withShuffledOptions(question) {
  return shuffleQuestionOptions(question);
}

function formatElapsedTime(seconds = 0) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getLeagueFormatConfig(
  format,
  customQuizCount,
  customTop10Count,
  customWhoAmICount,
  customFindPlayerCount,
  findPlayerScoringMode = "attempts"
) {
  if (format !== "custom") {
    const config = LEAGUE_FORMATS[format] || LEAGUE_FORMATS.balanced;
    return {
      ...config,
      findPlayerScoringMode: config.findPlayerScoringMode || findPlayerScoringMode,
      maxDailyPoints:
        config.quizCount +
        config.top10Count * 10 +
        config.whoamiCount * 10 +
        (config.findPlayerCount || 0) * 10,
    };
  }

  const quizCount = Number(customQuizCount);
  const top10Count = Number(customTop10Count);
  const whoamiCount = Number(customWhoAmICount);
  const findPlayerCount = Number(customFindPlayerCount);
  const parts = [
    quizCount > 0 ? `${quizCount} quick questions` : "",
    top10Count > 0 ? `${top10Count} Top 10` : "",
    whoamiCount > 0 ? `${whoamiCount} Who Am I` : "",
    findPlayerCount > 0 ? `${findPlayerCount} Find the Player` : "",
  ].filter(Boolean);

  return {
    ...LEAGUE_FORMATS.custom,
    quizCount,
    top10Count,
    whoamiCount,
    findPlayerCount,
    findPlayerScoringMode,
    maxDailyPoints:
      quizCount + top10Count * 10 + whoamiCount * 10 + findPlayerCount * 10,
    description: parts.join(" + ") || "Choose your daily structure",
  };
}

function createMockRoomCode() {
  return `BK-${Math.floor(1000 + Math.random() * 9000)}`;
}

function createMockOpponentScore(finalScore) {
  const swing = Math.floor(Math.random() * 9) - 4;
  return Math.max(0, finalScore + swing);
}

function getCategoryLabel(categoryId) {
  if (categoryId === "world-cup") return "World Cup";
  if (categoryId === "premier_league") return "Premier League";
  if (categoryId === "career_path") return "Career Path";

  return (
    MULTIPLAYER_CATEGORIES.find((category) => category.id === categoryId)
      ?.label || "General"
  );
}

function getCurrentPlayerSlot(match, playerId, username) {
  if (!match) return null;

  if (match.player1_id && match.player1_id === playerId) return "player1";
  if (match.player2_id && match.player2_id === playerId) return "player2";
  if (match.player1_username === username) return "player1";
  if (match.player2_username === username) return "player2";

  return null;
}

function getOpponentName(match, playerId, username) {
  const playerSlot = getCurrentPlayerSlot(match, playerId, username);

  if (playerSlot === "player1") {
    return match?.player2_username || "Waiting opponent";
  }

  if (playerSlot === "player2") {
    return match?.player1_username || "Opponent";
  }

  return match?.player2_username || match?.player1_username || "Opponent";
}

function isCurrentPlayersTurn(match, playerId, username) {
  if (!match) return false;

  if (match.current_turn_id) return match.current_turn_id === playerId;

  return match.current_turn === username;
}

function hasPlayerFinishedRound(round, playerSlot) {
  if (!round || !playerSlot) return false;

  return playerSlot === "player1"
    ? Boolean(round.player1_finished)
    : Boolean(round.player2_finished);
}

function getMatchActionLabel(match, latestRound, playerSlot, isPlayerTurn) {
  if (!match) return "Open match";

  if (match.phase === "waiting_for_opponent" || match.status === "waiting") {
    return "Waiting for opponent to join";
  }

  if (match.phase === "choose_category") {
    return isPlayerTurn
      ? "Your turn: choose category"
      : "Waiting for opponent to choose";
  }

  if (match.phase === "round_active") {
    return hasPlayerFinishedRound(latestRound, playerSlot)
      ? "Waiting for opponent to answer"
      : "Your turn: play round";
  }

  if (match.phase === "round_finished") {
    return "Round finished";
  }

  return match.status || "Open match";
}

function getMatchActionKind(match, latestRound, playerSlot, isPlayerTurn) {
  if (!match) return "neutral";

  if (match.phase === "waiting_for_opponent" || match.status === "waiting") {
    return "waiting-join";
  }

  if (match.phase === "choose_category") {
    return isPlayerTurn ? "your-turn" : "waiting";
  }

  if (match.phase === "round_active") {
    return hasPlayerFinishedRound(latestRound, playerSlot) ? "waiting" : "your-turn";
  }

  if (match.phase === "round_finished") {
    return "result";
  }

  return "neutral";
}

function getMatchCtaLabel(actionKind, match) {
  if (actionKind === "your-turn" && match?.phase === "choose_category") {
    return "Choose Category";
  }

  if (actionKind === "your-turn" && match?.phase === "round_active") {
    return "Play Turn";
  }

  if (actionKind === "waiting") return "Waiting";
  if (actionKind === "result") return "View Result";

  return "Open Match";
}

function getCategoryClass(categoryId) {
  if (categoryId === "world-cup" || categoryId === "world_cup") {
    return "category-world-cup";
  }

  if (categoryId === "premier_league") return "category-premier-league";
  if (categoryId === "career_path") return "category-career-path";

  return "category-general";
}

export default function FootballQuizMVP() {
  const todayChallenge = getTodayChallenge();

  const [gameStarted, setGameStarted] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [multiplayerStep, setMultiplayerStep] = useState("menu");
  const [multiplayerMode, setMultiplayerMode] = useState("general");
  const [activeMatch, setActiveMatch] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [matchRounds, setMatchRounds] = useState([]);
  const [nextCategoryPickerOpen, setNextCategoryPickerOpen] = useState(false);
  const [multiplayerRoundOpen, setMultiplayerRoundOpen] = useState(false);
  const [multiplayerRoundIndex, setMultiplayerRoundIndex] = useState(0);
  const [multiplayerRoundSelected, setMultiplayerRoundSelected] = useState(null);
  const [multiplayerRoundScore, setMultiplayerRoundScore] = useState(0);
  const [multiplayerTimeLeft, setMultiplayerTimeLeft] = useState(
    MULTIPLAYER_TIME_LIMIT
  );
  const [multiplayerRoundDone, setMultiplayerRoundDone] = useState(false);
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [multiplayerRoomCode, setMultiplayerRoomCode] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [multiplayerLoading, setMultiplayerLoading] = useState(false);
  const [multiplayerError, setMultiplayerError] = useState("");
  const [activeGames, setActiveGames] = useState([]);
  const [activeGamesLoading, setActiveGamesLoading] = useState(false);
  const [matchDeleteCandidate, setMatchDeleteCandidate] = useState(null);
  const [deletingMatchId, setDeletingMatchId] = useState(null);
  const [multiplayerNotice, setMultiplayerNotice] = useState("");
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [leagueDurationInput, setLeagueDurationInput] = useState(null);
  const [leagueFormatInput, setLeagueFormatInput] = useState("balanced");
  const [leagueCustomQuizCount, setLeagueCustomQuizCount] = useState(5);
  const [leagueCustomTop10Count, setLeagueCustomTop10Count] = useState(1);
  const [leagueCustomWhoAmICount, setLeagueCustomWhoAmICount] = useState(0);
  const [leagueCustomFindPlayerCount, setLeagueCustomFindPlayerCount] = useState(0);
  const [leagueFindPlayerScoringMode, setLeagueFindPlayerScoringMode] =
    useState("attempts");
  const [leagueCodeInput, setLeagueCodeInput] = useState("");
  const [myLeagues, setMyLeagues] = useState([]);
  const [leagueDashboard, setLeagueDashboard] = useState(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueChallengeOpen, setLeagueChallengeOpen] = useState(false);
  const [leagueChallengePhase, setLeagueChallengePhase] = useState("intro");
  const [leagueQuizQuestions, setLeagueQuizQuestions] = useState([]);
  const [leagueQuizIndex, setLeagueQuizIndex] = useState(0);
  const [leagueQuizSelected, setLeagueQuizSelected] = useState(null);
  const [leagueQuizScore, setLeagueQuizScore] = useState(0);
  const [leagueTimeLeft, setLeagueTimeLeft] = useState(15);
  const [leagueTop10Challenge, setLeagueTop10Challenge] = useState(null);
  const [leagueTop10Challenges, setLeagueTop10Challenges] = useState([]);
  const [leagueTop10Index, setLeagueTop10Index] = useState(0);
  const [leagueTop10TotalScore, setLeagueTop10TotalScore] = useState(0);
  const [leagueTop10Input, setLeagueTop10Input] = useState("");
  const [leagueTop10SelectedPlayer, setLeagueTop10SelectedPlayer] = useState(null);
  const [leagueTop10Found, setLeagueTop10Found] = useState([]);
  const [leagueTop10Lives, setLeagueTop10Lives] = useState(3);
  const [leagueTop10Reveal, setLeagueTop10Reveal] = useState(null);
  const [leagueTop10Scanning, setLeagueTop10Scanning] = useState(false);
  const [leagueWhoAmIQuestions, setLeagueWhoAmIQuestions] = useState([]);
  const [leagueWhoAmIIndex, setLeagueWhoAmIIndex] = useState(0);
  const [leagueWhoAmIClueIndex, setLeagueWhoAmIClueIndex] = useState(0);
  const [leagueWhoAmIInput, setLeagueWhoAmIInput] = useState("");
  const [leagueWhoAmISelectedPlayer, setLeagueWhoAmISelectedPlayer] = useState(null);
  const [leagueWhoAmIScore, setLeagueWhoAmIScore] = useState(0);
  const [leagueWhoAmIFeedback, setLeagueWhoAmIFeedback] = useState(null);
  const [leagueWhoAmIShake, setLeagueWhoAmIShake] = useState(0);
  const [leagueFindPlayerTargets, setLeagueFindPlayerTargets] = useState([]);
  const [leagueFindPlayerIndex, setLeagueFindPlayerIndex] = useState(0);
  const [leagueFindPlayerSelected, setLeagueFindPlayerSelected] = useState(null);
  const [leagueFindPlayerGuesses, setLeagueFindPlayerGuesses] = useState([]);
  const [leagueFindPlayerScore, setLeagueFindPlayerScore] = useState(0);
  const [leagueFindPlayerAttemptTotal, setLeagueFindPlayerAttemptTotal] = useState(0);
  const [leagueFindPlayerStartedAt, setLeagueFindPlayerStartedAt] = useState(null);
  const [leagueFindPlayerElapsed, setLeagueFindPlayerElapsed] = useState(0);
  const [leagueFindPlayerFeedback, setLeagueFindPlayerFeedback] = useState("");
  const [leagueResult, setLeagueResult] = useState(null);
  const [isMockMultiplayer, setIsMockMultiplayer] = useState(false);
  const [mockOpponentScore, setMockOpponentScore] = useState(null);
  const [coinsMenuOpen, setCoinsMenuOpen] = useState(false);
  const [coinShopNotice, setCoinShopNotice] = useState("");
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [xpToast, setXpToast] = useState(null);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [gameMode, setGameMode] = useState("general");

  const [username, setUsername] = useState(() => {
    return localStorage.getItem("ballKnowledgeUsername") || "";
  });

  const [playerId] = useState(getOrCreatePlayerId);
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("local");
  const [profileError, setProfileError] = useState("");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [profileLookup, setProfileLookup] = useState({});
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [avatarEmoji, setAvatarEmoji] = useState(() => {
    return localStorage.getItem("ballKnowledgeAvatarEmoji") || "⚽";
  });

  const [nameInput, setNameInput] = useState(() => {
    return localStorage.getItem("ballKnowledgeUsername") || "";
  });

  const [questions, setQuestions] = useState(() =>
    buildGameQuestions("general")
  );
  const [questionIndex, setQuestionIndex] = useState(0);

  const [selected, setSelected] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [careerSelectedPlayer, setCareerSelectedPlayer] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(HARD_TIME_LIMIT);

  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem("footballQuizHighScore")) || 0;
  });
  const [runStartHighScore, setRunStartHighScore] = useState(() => {
    return Number(localStorage.getItem("footballQuizHighScore")) || 0;
  });
  const [runId, setRunId] = useState(() => Date.now());
  const [highScoreBonusAwarded, setHighScoreBonusAwarded] = useState(false);
  const [runStartProgression, setRunStartProgression] = useState(null);
  const [generalRunXpSummary, setGeneralRunXpSummary] = useState({
    correct: 0,
    streak: 0,
    highscore: 0,
  });
  const [objectiveProgressUpdate, setObjectiveProgressUpdate] = useState(null);

  const [coins, setCoins] = useState(() => {
    return Number(localStorage.getItem("footballQuizCoins")) || 0;
  });
  const [xpTotal, setXpTotal] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).xpTotal
  );
  const [progressionStats, setProgressionStats] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).stats
  );
  const [careerLevelId, setCareerLevelId] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).levelId
  );
  const [claimedLevelIds, setClaimedLevelIds] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).claimedLevelIds
  );

  const [revivesUsed, setRevivesUsed] = useState(0);
  const [rewardPopup, setRewardPopup] = useState(null);
  const [coinRewardToast, setCoinRewardToast] = useState(null);
  const [wrongPopup, setWrongPopup] = useState(null);

  const [foundAnswers, setFoundAnswers] = useState([]);
  const [dailyInput, setDailyInput] = useState("");
  const [dailySelectedPlayer, setDailySelectedPlayer] = useState(null);
  const [dailyCoinsEarned, setDailyCoinsEarned] = useState(0);
  const [dailyReveal, setDailyReveal] = useState(null);
  const [dailyCelebratedAnswer, setDailyCelebratedAnswer] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const [dailyPlayed, setDailyPlayed] = useState(() => {
    return localStorage.getItem("ballKnowledgeDailyDate") === getDailyDateKey();
  });

  const [lastDailyResult, setLastDailyResult] = useState(() => {
    return getSavedDailyResult();
  });

  const [dailyStreak, setDailyStreak] = useState(() => {
    return Number(localStorage.getItem("footballQuizDailyStreak")) || 0;
  });

  const [lastDailyPlayedDate, setLastDailyPlayedDate] = useState(() => {
    return localStorage.getItem("footballQuizLastDailyPlayedDate") || "";
  });

  const [streakRewardEarned, setStreakRewardEarned] = useState(0);
  const [showDailyCompletePopup, setShowDailyCompletePopup] = useState(false);
  const [dailyRewardMeterOpen, setDailyRewardMeterOpen] = useState(false);

  const [levelUpPopup, setLevelUpPopup] = useState(null);
  const [connectionsPuzzle, setConnectionsPuzzle] = useState(null);
  const [connectionsTiles, setConnectionsTiles] = useState([]);
  const [connectionsSelected, setConnectionsSelected] = useState([]);
  const [connectionsSolved, setConnectionsSolved] = useState([]);
  const [connectionsMistakes, setConnectionsMistakes] = useState(0);
  const [connectionsFeedback, setConnectionsFeedback] = useState(null);
  const [connectionsShake, setConnectionsShake] = useState(0);
  const [connectionsRewardClaimed, setConnectionsRewardClaimed] =
    useState(false);
  const [whoAmIQuestions, setWhoAmIQuestions] = useState([]);
  const [whoAmIIndex, setWhoAmIIndex] = useState(0);
  const [whoAmIClueIndex, setWhoAmIClueIndex] = useState(0);
  const [whoAmIInput, setWhoAmIInput] = useState("");
  const [whoAmISelectedPlayer, setWhoAmISelectedPlayer] = useState(null);
  const [whoAmIScore, setWhoAmIScore] = useState(0);
  const [whoAmIStreak, setWhoAmIStreak] = useState(0);
  const [whoAmILives, setWhoAmILives] = useState(3);
  const [whoAmIFeedback, setWhoAmIFeedback] = useState(null);
  const [whoAmIShake, setWhoAmIShake] = useState(0);
  const [whoAmIGameOver, setWhoAmIGameOver] = useState(false);
  const [findPlayerPool, setFindPlayerPool] = useState([]);
  const [findPlayerTarget, setFindPlayerTarget] = useState(null);
  const [findPlayerSelected, setFindPlayerSelected] = useState(null);
  const [findPlayerGuesses, setFindPlayerGuesses] = useState([]);
  const [findPlayerStatus, setFindPlayerStatus] = useState("idle");
  const [findPlayerError, setFindPlayerError] = useState("");
  const [findPlayerStartedAt, setFindPlayerStartedAt] = useState(null);
  const [findPlayerElapsed, setFindPlayerElapsed] = useState(0);
  const [findPlayerDate, setFindPlayerDate] = useState(getDailyDateKey);

  const current = questions[questionIndex];
  const currentWhoAmI = whoAmIQuestions[whoAmIIndex];
  const isDailyPlayerChallenge = isPlayerAnswerType(todayChallenge);
  const progressionView = useMemo(
    () =>
      getProgressionView({
        xpTotal,
        levelId: careerLevelId,
        stats: {
          ...progressionStats,
          best_general_score: Math.max(
            highScore,
            Number(progressionStats.best_general_score) || 0
          ),
        },
      }),
    [xpTotal, careerLevelId, progressionStats, highScore]
  );
  const playerLevel = {
    ...progressionView.currentLevel,
    levelNumber: progressionView.currentLevel.id,
    next: progressionView.nextLevel,
    progress: progressionView.objectiveProgress,
    pointsToNext: Math.max(
      0,
      Number(
        progressionView.objectives.find(
          (objective) => objective.statKey === "xp_total"
        )?.required
      ) - xpTotal
    ),
  };
  const displayName = profile?.display_name || profile?.username || username;
  const profileAvatarEmoji = profile?.avatar_emoji || avatarEmoji || "⚽";
  const profileAvatar = getAvatarConfig({
    avatar_emoji: profileAvatarEmoji,
    ...profile,
  });
  const avatarBuilderPreview = getAvatarConfig(avatarDraft || profileAvatar);
  const profileStats = {
    multiplayerWins: profile?.multiplayer_wins || 0,
    multiplayerLosses: profile?.multiplayer_losses || 0,
    multiplayerDraws: profile?.multiplayer_draws || 0,
    multiplayerMatches: profile?.multiplayer_matches || 0,
  };
  const xpObjective = progressionView.objectives.find(
    (objective) => objective.statKey === "xp_total"
  );
  const completedObjectiveCount = progressionView.objectives.filter(
    (objective) => objective.complete
  ).length;
  const levelObjectiveSummary = `${completedObjectiveCount}/${progressionView.objectives.length} objectives`;
  const generalRunXpTotal =
    generalRunXpSummary.correct +
    generalRunXpSummary.streak +
    generalRunXpSummary.highscore;
  const currentHomeViewKey = profileOpen
    ? "profile"
    : leaderboardOpen
    ? "leaderboard"
    : multiplayerOpen
    ? `multiplayer-${multiplayerStep}`
    : modeMenuOpen
    ? "mode-menu"
    : "home";
  const isHomeScreen =
    !gameStarted &&
    !profileOpen &&
    !leaderboardOpen &&
    !multiplayerOpen &&
    !modeMenuOpen;
  const hasBothMultiplayerPlayers =
    Boolean(activeMatch?.player1_username) && Boolean(activeMatch?.player2_username);
  const isMultiplayerTurn = isCurrentPlayersTurn(activeMatch, playerId, username);
  const canChooseMultiplayerCategory =
    hasBothMultiplayerPlayers &&
    (activeMatch?.phase === "choose_category" ||
      (activeMatch?.phase === "round_finished" && nextCategoryPickerOpen)) &&
    isMultiplayerTurn;
  const canOpenNextCategoryPicker =
    hasBothMultiplayerPlayers &&
    activeMatch?.phase === "round_finished" &&
    isMultiplayerTurn;
  const multiplayerPlayerSlot = getCurrentPlayerSlot(
    activeMatch,
    playerId,
    username
  );
  const hasPlayedActiveRound = hasPlayerFinishedRound(
    activeRound,
    multiplayerPlayerSlot
  );
  const activeRoundQuestionIds = activeRound?.question_ids || [];
  const activeRoundQuestions = useMemo(
    () => getMultiplayerQuestionsByIds(activeRoundQuestionIds).map(withShuffledOptions),
    [activeRoundQuestionIds]
  );
  const currentMultiplayerRoundQuestion =
    activeRoundQuestions[multiplayerRoundIndex];
  const activeLeague = leagueDashboard?.league || null;
  const activeLeagueDay = leagueDashboard?.leagueDay || null;
  const activeLeagueSubmission = leagueDashboard?.currentSubmission || null;
  const currentLeagueQuizQuestion = leagueQuizQuestions[leagueQuizIndex];
  const leagueTop10Score = leagueTop10Found.length;
  const leagueTop10TotalWithCurrent = leagueTop10TotalScore + leagueTop10Score;
  const isLeagueTop10PlayerChallenge = isPlayerAnswerType(leagueTop10Challenge);
  const currentLeagueWhoAmI = leagueWhoAmIQuestions[leagueWhoAmIIndex];
  const leagueWhoAmIVisibleClues = currentLeagueWhoAmI
    ? currentLeagueWhoAmI.clues.slice(0, leagueWhoAmIClueIndex + 1)
    : [];
  const leagueWhoAmIPointsAvailable = Math.max(1, 10 - leagueWhoAmIClueIndex);
  const leagueSettings = activeLeague
    ? getLeagueSettingsSummary(activeLeague)
    : getLeagueFormatConfig(
        leagueFormatInput,
        leagueCustomQuizCount,
        leagueCustomTop10Count,
        leagueCustomWhoAmICount,
        leagueCustomFindPlayerCount,
        leagueFindPlayerScoringMode
      );
  const leagueWhoAmIMaxPoints = leagueSettings.whoamiCount * 10;
  const leagueFindPlayerMaxPoints = (leagueSettings.findPlayerCount || 0) * 10;
  const currentLeagueFindPlayerTarget =
    leagueFindPlayerTargets[leagueFindPlayerIndex] || null;
  const findPlayerRanking = useMemo(
    () => buildPlayerDistanceRanking(findPlayerTarget, findPlayerPool),
    [findPlayerTarget, findPlayerPool]
  );
  const leagueFindPlayerRanking = useMemo(
    () => buildPlayerDistanceRanking(currentLeagueFindPlayerTarget, findPlayerPool),
    [currentLeagueFindPlayerTarget, findPlayerPool]
  );
  const leagueDayExpired =
    Boolean(activeLeague?.duration_days) &&
    Boolean(activeLeagueDay?.day_number) &&
    activeLeagueDay.day_number > Number(activeLeague.duration_days);
  const leagueDailyStructureText =
    [
      leagueSettings.quizCount > 0
        ? `${leagueSettings.quizCount} quick questions`
        : "",
      leagueSettings.top10Count > 0
        ? `${leagueSettings.top10Count} Top 10`
        : "",
      leagueSettings.whoamiCount > 0
        ? `${leagueSettings.whoamiCount} Who Am I`
        : "",
      leagueSettings.findPlayerCount > 0
        ? `${leagueSettings.findPlayerCount} Find the Player`
        : "",
    ]
      .filter(Boolean)
      .join(" + ") || "Daily challenge";
  const leagueDayLabel = activeLeagueDay
    ? activeLeague?.duration_days
      ? `Day ${activeLeagueDay.day_number} / ${activeLeague.duration_days}`
      : `Day ${activeLeagueDay.day_number}`
    : "Day";
  const careerPathClubs =
    gameMode === "career" && current ? getCareerPathClubs(current.question) : [];
  const connectionsSolvedIndexes = connectionsSolved.map((group) => group.index);
  const connectionsGameComplete = connectionsSolved.length === 4;
  const connectionsGameOver =
    gameMode === "connections" &&
    gameStarted &&
    connectionsMistakes >= 4 &&
    !connectionsGameComplete;
  const connectionsVisibleTiles = connectionsTiles.filter(
    (tile) => !connectionsSolvedIndexes.includes(tile.groupIndex)
  );
  const connectionsMistakesLeft = Math.max(0, 4 - connectionsMistakes);
  const visibleWhoAmIClues = currentWhoAmI
    ? currentWhoAmI.clues.slice(0, whoAmIClueIndex + 1)
    : [];
  const whoAmIPointsAvailable = Math.max(1, 10 - whoAmIClueIndex);
  const socialProfileIds = useMemo(() => {
    const ids = new Set();

    activeGames.forEach(({ match }) => {
      if (match?.player1_id) ids.add(match.player1_id);
      if (match?.player2_id) ids.add(match.player2_id);
    });

    if (activeMatch?.player1_id) ids.add(activeMatch.player1_id);
    if (activeMatch?.player2_id) ids.add(activeMatch.player2_id);

    leagueDashboard?.members?.forEach((member) => {
      if (member?.player_id) ids.add(member.player_id);
    });

    leaderboardRows.forEach((row) => {
      if (row?.id) ids.add(row.id);
    });

    return [...ids].filter(Boolean);
  }, [activeGames, activeMatch, leagueDashboard, leaderboardRows]);

  useEffect(() => {
    if (!multiplayerRoundOpen || !currentMultiplayerRoundQuestion) return;

    setMultiplayerTimeLeft(MULTIPLAYER_TIME_LIMIT);
  }, [
    currentMultiplayerRoundQuestion,
    multiplayerRoundIndex,
    multiplayerRoundOpen,
  ]);

  useEffect(() => {
    if (
      !multiplayerRoundOpen ||
      multiplayerRoundDone ||
      multiplayerRoundSelected ||
      !currentMultiplayerRoundQuestion
    ) {
      return;
    }

    if (multiplayerTimeLeft <= 0) {
      setMultiplayerRoundSelected(MULTIPLAYER_TIMEOUT_VALUE);

      setTimeout(() => {
        if (multiplayerRoundIndex >= activeRoundQuestions.length - 1) {
          setMultiplayerRoundDone(true);
          submitMultiplayerRoundScore(multiplayerRoundScore);
        } else {
          setMultiplayerRoundIndex((value) => value + 1);
          setMultiplayerRoundSelected(null);
          setMultiplayerTimeLeft(MULTIPLAYER_TIME_LIMIT);
        }
      }, 950);

      return;
    }

    const timer = setTimeout(() => {
      setMultiplayerTimeLeft((time) => time - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    activeRoundQuestions.length,
    currentMultiplayerRoundQuestion,
    multiplayerRoundDone,
    multiplayerRoundIndex,
    multiplayerRoundOpen,
    multiplayerRoundScore,
    multiplayerRoundSelected,
    multiplayerTimeLeft,
  ]);

  useEffect(() => {
    if (gameMode !== "find-player" || findPlayerStatus !== "playing" || !findPlayerStartedAt) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setFindPlayerElapsed(Math.max(0, Math.floor((Date.now() - findPlayerStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [findPlayerStartedAt, findPlayerStatus, gameMode]);

  useEffect(() => {
    if (
      !leagueChallengeOpen ||
      leagueChallengePhase !== "find-player" ||
      !leagueFindPlayerStartedAt
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLeagueFindPlayerElapsed(
        Math.max(0, Math.floor((Date.now() - leagueFindPlayerStartedAt) / 1000))
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [leagueChallengeOpen, leagueChallengePhase, leagueFindPlayerStartedAt]);

  useEffect(() => {
    if (
      !leagueChallengeOpen ||
      leagueChallengePhase !== "quiz" ||
      !currentLeagueQuizQuestion ||
      leagueQuizSelected
    ) {
      return;
    }

    if (leagueTimeLeft <= 0) {
      chooseLeagueQuizAnswer("__time_up__");
      return;
    }

    const timer = window.setTimeout(() => {
      setLeagueTimeLeft((time) => time - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [
    currentLeagueQuizQuestion,
    leagueChallengeOpen,
    leagueChallengePhase,
    leagueQuizSelected,
    leagueTimeLeft,
  ]);

  useEffect(() => {
    if (!multiplayerOpen || multiplayerStep !== "active-games") return;

    const interval = window.setInterval(() => {
      fetchActiveGames({ silent: true });
    }, 7000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, playerId, username]);

  useEffect(() => {
    if (!multiplayerOpen || multiplayerStep !== "league-dashboard" || !activeLeague?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      loadLeagueDashboard(activeLeague.id, { silent: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, activeLeague?.id, playerId]);

  useEffect(() => {
    if (!multiplayerOpen || multiplayerStep !== "play-now-waiting" || !activeMatch?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      refreshMultiplayerMatch({ silent: true });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, activeMatch?.id]);

  useEffect(() => {
    if (!multiplayerOpen || !activeMatch?.id || !supabase) return;

    const channel = supabase
      .channel(`ball-knowledge-match-${activeMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${activeMatch.id}`,
        },
        () => refreshMultiplayerMatch({ silent: true })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multiplayer_rounds",
          filter: `match_id=eq.${activeMatch.id}`,
        },
        () => refreshMultiplayerMatch({ silent: true })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_players",
          filter: `match_id=eq.${activeMatch.id}`,
        },
        () => refreshMultiplayerMatch({ silent: true })
      )
      .subscribe();

    const fallbackPoll = window.setInterval(() => {
      refreshMultiplayerMatch({ silent: true });
    }, 6000);

    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [activeMatch?.id, multiplayerOpen]);

  useEffect(() => {
    if (!username || !progressionView.canLevelUp) return;
    if (levelUpPopup) return;
    if (objectiveProgressUpdate) return;

    const oldLevel = progressionView.currentLevel;
    const newLevel = progressionView.nextLevel;
    if (!newLevel) return;

    const rewardAlreadyClaimed = claimedLevelIds.some(
      (id) => String(id) === String(newLevel.id)
    );
    const nextClaimedIds = rewardAlreadyClaimed
      ? claimedLevelIds
      : [...claimedLevelIds, newLevel.id];
    const nextLevelId = newLevel.id;
    const coinReward = rewardAlreadyClaimed ? 0 : 250;
    const newCoins = coins + coinReward;
    const popup = {
      oldLevel,
      newLevel,
      unlockedLevels: [newLevel],
      levelsGained: 1,
      coins: coinReward,
    };

    const popupTimer = window.setTimeout(() => {
      playLevelUpSound();
      if (coinReward > 0) {
        playCoinSound();
      }
      setLevelUpPopup(popup);
      setCareerLevelId(nextLevelId);
      setClaimedLevelIds(nextClaimedIds);
      if (coinReward > 0) {
        saveCoins(newCoins);
      }
      persistProgressionState({
        xpTotal,
        levelId: nextLevelId,
        stats: progressionStats,
        claimedLevelIds: nextClaimedIds,
      });
    }, 0);

    return () => window.clearTimeout(popupTimer);
  }, [
    username,
    progressionView.canLevelUp,
    progressionView.currentLevel,
    progressionView.nextLevel,
    levelUpPopup,
    objectiveProgressUpdate,
    claimedLevelIds,
    coins,
    xpTotal,
    progressionStats,
  ]);

  useEffect(() => {
    if (
      gameMode === "connections" &&
      gameStarted &&
      connectionsGameComplete &&
      !connectionsRewardClaimed
    ) {
      rewardConnectionsCompletion();
      setConnectionsFeedback({ type: "complete", text: "+75 coins earned" });
    }
  }, [
    gameMode,
    gameStarted,
    connectionsGameComplete,
    connectionsRewardClaimed,
  ]);

  useEffect(() => {
    if (gameMode !== "daily-list" || !gameStarted) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [gameMode, gameStarted]);

  useEffect(() => {
    if (
      !finished ||
      !gameStarted ||
      gameMode !== "general" ||
      isMockMultiplayer ||
      highScoreBonusAwarded
    ) {
      return;
    }

    const highscoreBonus =
      score > runStartHighScore ? getGeneralHighscoreXpBonus(score) : 0;
    const bonusAwarded =
      highscoreBonus > 0 &&
      awardXp({
        key: `general-highscore-finish:${runId}`,
        amount: highscoreBonus,
        label: "New Highscore",
        placement: "global",
      });

    if (bonusAwarded) {
      setGeneralRunXpSummary((summary) => ({
        ...summary,
        highscore: summary.highscore + highscoreBonus,
      }));
    }

    const afterView = getProgressionView({
      xpTotal: xpTotal + (bonusAwarded ? highscoreBonus : 0),
      levelId: careerLevelId,
      stats: {
        ...progressionStats,
        best_general_score: Math.max(
          score,
          highScore,
          Number(progressionStats.best_general_score) || 0
        ),
      },
    });

    const progressUpdate = buildObjectiveProgressUpdate(
      runStartProgression,
      afterView
    );
    if (progressUpdate) {
      window.setTimeout(() => setObjectiveProgressUpdate(progressUpdate), 550);
    }

    setHighScoreBonusAwarded(true);
  }, [
    finished,
    gameStarted,
    gameMode,
    isMockMultiplayer,
    highScoreBonusAwarded,
    score,
    runStartHighScore,
    runId,
    xpTotal,
    careerLevelId,
    progressionStats,
    highScore,
    runStartProgression,
  ]);

  const revivePrices = [500, 1000, 5000];
  const reviveCost = revivePrices[revivesUsed] || null;

  const isTimedQuestion =
    gameStarted &&
    !finished &&
    (gameMode === "general" || gameMode === "world-cup") &&
    ["Hard", "Very Hard"].includes(current?.difficulty);

  useEffect(() => {
    const handleButtonHaptic = (event) => {
      if (event.target.closest("button") && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
    };

    document.addEventListener("pointerdown", handleButtonHaptic, {
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", handleButtonHaptic);
    };
  }, []);

  useEffect(() => {
    if (!isTimedQuestion) return;

    setTimeLeft(HARD_TIME_LIMIT);
  }, [questionIndex, isTimedQuestion]);

  useEffect(() => {
    const timerActive =
      isTimedQuestion && !selected && !rewardPopup && !wrongPopup;

    if (!timerActive) return;

    if (timeLeft <= 0) {
      handleWrongAnswer(current.answer, "Time's up!");
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((time) => time - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    timeLeft,
    isTimedQuestion,
    selected,
    rewardPopup,
    wrongPopup,
    current?.answer,
  ]);

  const playClickSound = () => {
    playButtonTapSound();
  };

  const toggleSound = () => {
    const nextValue = !soundOn;

    setSoundEnabled(nextValue);
    setSoundOn(nextValue);

    if (nextValue) {
      playButtonTapSound();
    }
  };

  const getProfileErrorMessage = (error) => {
    if (!error) return "";

    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      String(error.message || "").toLowerCase().includes("profiles")
    ) {
      return "Online profile table is not ready yet";
    }

    return "Online profile sync is temporarily unavailable";
  };

  const hydrateProgressionFromProfile = (onlineProfile) => {
    const hydrated = getInitialProgression({
      profile: onlineProfile,
      highScore,
    });

    setXpTotal(hydrated.xpTotal);
    setCareerLevelId(hydrated.levelId);
    setClaimedLevelIds(hydrated.claimedLevelIds);
    setProgressionStats(hydrated.stats);
    persistLocalProgression({
      xpTotal: hydrated.xpTotal,
      levelId: hydrated.levelId,
      stats: hydrated.stats,
      claimedLevelIds: hydrated.claimedLevelIds,
    });
  };

  const ensureOnlineProfile = async (nextUsername = username) => {
    if (!nextUsername) return null;

    if (!isSupabaseConfigured || !supabase) {
      setProfileStatus("local");
      setProfileError("");
      return null;
    }

    setProfileStatus((status) => (status === "ready" ? "ready" : "syncing"));
    setProfileError("");

    const { profile: existingProfile, error: fetchError } = await fetchProfile(
      supabase,
      playerId
    );

    if (fetchError) {
      console.error("Could not fetch profile", fetchError);
      setProfileStatus("error");
      setProfileError(getProfileErrorMessage(fetchError));
      return null;
    }

    if (existingProfile) {
      setProfile(existingProfile);
      hydrateProgressionFromProfile(existingProfile);
      setAvatarEmoji(existingProfile.avatar_icon || existingProfile.avatar_emoji || "⚽");
      localStorage.setItem(
        "ballKnowledgeAvatarEmoji",
        existingProfile.avatar_icon || existingProfile.avatar_emoji || "⚽"
      );
      setProfileStatus("ready");
      return existingProfile;
    }

    const defaultProfile = getDefaultProfile({
      playerId,
      username: nextUsername,
      avatarEmoji,
      highScore,
      coins,
      dailyStreak,
    });

    const { profile: createdProfile, error: createError } = await createProfile(
      supabase,
      defaultProfile
    );

    if (createError) {
      console.error("Could not create profile", createError);
      setProfileStatus("error");
      setProfileError(getProfileErrorMessage(createError));
      return null;
    }

    setProfile(createdProfile);
    hydrateProgressionFromProfile(createdProfile);
    setAvatarEmoji(createdProfile.avatar_icon || createdProfile.avatar_emoji || "⚽");
    localStorage.setItem(
      "ballKnowledgeAvatarEmoji",
      createdProfile.avatar_icon || createdProfile.avatar_emoji || "⚽"
    );
    setProfileStatus("ready");
    return createdProfile;
  };

  const updateOnlineProfile = async (updates, successStatus = "ready") => {
    if (!isSupabaseConfigured || !supabase || !username) return null;

    const baseProfile = profile || (await ensureOnlineProfile(username));

    if (!baseProfile) return null;

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      updates
    );

    if (error) {
      console.error("Could not update profile", error);
      setProfileStatus("error");
      setProfileError(getProfileErrorMessage(error));
      return null;
    }

    setProfile({
      ...(updatedProfile || {}),
      ...updates,
    });
    setProfileStatus(successStatus);
    setProfileError("");
    return updatedProfile;
  };

  const openAvatarBuilder = () => {
    playClickSound();
    setAvatarDraft(profileAvatar);
    setAvatarNotice("");
    setAvatarPickerOpen(true);
  };

  const updateAvatarDraft = (updates) => {
    playClickSound();
    setAvatarDraft((currentDraft) => ({
      ...profileAvatar,
      ...currentDraft,
      ...updates,
    }));
  };

  const saveAvatarBuilder = async () => {
    playClickSound();
    const nextAvatar = getAvatarConfig(avatarDraft || profileAvatar);
    const updates = {
      avatar_emoji: nextAvatar.icon,
      avatar_icon: nextAvatar.icon,
      avatar_style: nextAvatar.style,
      avatar_color: nextAvatar.color,
      avatar_bg: nextAvatar.bg,
    };

    setAvatarEmoji(nextAvatar.icon);
    localStorage.setItem("ballKnowledgeAvatarEmoji", nextAvatar.icon);
    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...updates,
    }));

    const updatedProfile = await updateOnlineProfile(updates);

    if (!updatedProfile && isSupabaseConfigured && supabase) {
      setAvatarNotice("Avatar saved locally. Run the avatar SQL for online sync.");
      return;
    }

    setAvatarNotice("Avatar saved");
    setAvatarPickerOpen(false);
  };

  const loadGeneralLeaderboard = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLeaderboardRows([]);
      setLeaderboardError("Online leaderboard is unavailable");
      return;
    }

    setLeaderboardLoading(true);
    setLeaderboardError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .gt("best_score", 0)
      .order("best_score", { ascending: false })
      .limit(10);

    setLeaderboardLoading(false);

    if (error) {
      console.error("Could not load leaderboard profiles", error);
      setLeaderboardRows([]);
      setLeaderboardError(getProfileErrorMessage(error));
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    setLeaderboardRows(
      (data || []).map((row, index) => ({
        ...row,
        username: row.display_name || row.username || "Player",
        score: row.best_score || 0,
        rank: index + 1,
        medal: medals[index] || null,
        isCurrentUser: row.id === playerId,
      }))
    );
  };

  const getSocialProfile = (id, fallbackUsername = "Player") => {
    if (id && id === playerId) {
      return {
        ...(profile || {}),
        id,
        username: displayName || fallbackUsername,
        display_name: displayName || fallbackUsername,
        avatar_emoji: profileAvatar.icon,
        avatar_icon: profileAvatar.icon,
        avatar_style: profileAvatar.style,
        avatar_color: profileAvatar.color,
        avatar_bg: profileAvatar.bg,
      };
    }

    return (
      (id && profileLookup[id]) || {
        id,
        username: fallbackUsername,
        display_name: fallbackUsername,
        avatar_emoji: "⚽",
        avatar_icon: "⚽",
        avatar_style: "classic",
        avatar_color: "green",
        avatar_bg: "dark",
      }
    );
  };

  const getMatchPlayerProfile = (match, slot) => {
    const id = slot === "player1" ? match?.player1_id : match?.player2_id;
    const fallbackUsername =
      slot === "player1" ? match?.player1_username : match?.player2_username;

    return getSocialProfile(id, fallbackUsername || "Player");
  };

  const recordMultiplayerRoundResult = async (round, match) => {
    if (!round?.id || !round.winner || !match || !isSupabaseConfigured || !supabase) {
      return;
    }

    const countedKey = "ballKnowledgeCountedMultiplayerRounds";
    let countedRounds = [];

    try {
      countedRounds = JSON.parse(localStorage.getItem(countedKey) || "[]");
    } catch {
      countedRounds = [];
    }

    if (countedRounds.includes(round.id)) return;

    const playerSlot = getCurrentPlayerSlot(match, playerId, username);
    if (!playerSlot) return;

    const playerName =
      playerSlot === "player1" ? match.player1_username : match.player2_username;

    const { profile: latestProfile, error: latestError } = await fetchProfile(
      supabase,
      playerId
    );

    if (latestError || !latestProfile) {
      if (latestError) {
        console.error("Could not load profile for multiplayer stats", latestError);
      }
      return;
    }

    const resultPatch = {
      multiplayer_matches: (latestProfile.multiplayer_matches || 0) + 1,
    };

    // TODO: This counts completed multiplayer rounds. When full match ending
    // exists, move these counters to completed-match results instead.
    if (round.winner === "draw") {
      resultPatch.multiplayer_draws = (latestProfile.multiplayer_draws || 0) + 1;
    } else if (round.winner === playerName) {
      resultPatch.multiplayer_wins = (latestProfile.multiplayer_wins || 0) + 1;
    } else {
      resultPatch.multiplayer_losses = (latestProfile.multiplayer_losses || 0) + 1;
    }

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      resultPatch
    );

    if (error) {
      console.error("Could not update multiplayer profile stats", error);
      return;
    }

    localStorage.setItem(
      countedKey,
      JSON.stringify([...countedRounds, round.id].slice(-200))
    );
    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...(updatedProfile || {}),
    }));
    setProfileStatus("ready");
  };

  const saveCoins = (newCoins) => {
    setCoins(newCoins);
    localStorage.setItem("footballQuizCoins", String(newCoins));
  };

  const syncProgressionToProfile = async (nextProgression = {}) => {
    if (!isSupabaseConfigured || !supabase || !playerId) return;

    const updates = {
      xp_total: nextProgression.xpTotal ?? xpTotal,
      level_id: nextProgression.levelId ?? careerLevelId,
      level_up_claimed_ids: nextProgression.claimedLevelIds ?? claimedLevelIds,
      progression_stats: nextProgression.stats ?? progressionStats,
    };

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      updates
    );

    if (error) {
      console.error("Could not sync progression profile", error);
      return;
    }

    if (updatedProfile) {
      setProfile((currentProfile) => ({
        ...(currentProfile || {}),
        ...updatedProfile,
      }));
    }
  };

  const persistProgressionState = (next) => {
    persistLocalProgression(next);
    syncProgressionToProfile(next);
  };

  const showXpToast = ({ amount, label, placement = "global" }) => {
    if (!amount) return;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setXpToast({ key, amount, label, placement });
    window.setTimeout(() => {
      setXpToast((toast) => (toast?.key === key ? null : toast));
    }, 1200);
  };

  const awardXp = ({ key, amount, label, placement = "global" }) => {
    const event = createXpEvent({ key, amount, label });
    if (!event) return false;

    setXpTotal((currentXp) => {
      const nextXp = currentXp + event.amount;
      setProgressionStats((currentStats) => {
        const nextStats = { ...currentStats, xp_total: nextXp };
        persistProgressionState({
          xpTotal: nextXp,
          levelId: careerLevelId,
          stats: nextStats,
          claimedLevelIds,
        });
        return nextStats;
      });
      return nextXp;
    });
    showXpToast({ ...event, placement });
    return true;
  };

  const updateProgressionStats = (updater) => {
    setProgressionStats((currentStats) => {
      const nextStats = {
        ...currentStats,
        ...updater(currentStats),
      };
      const nextProgression = {
        xpTotal,
        levelId: careerLevelId,
        stats: nextStats,
        claimedLevelIds,
      };
      persistProgressionState(nextProgression);
      return nextStats;
    });
  };

  const buildObjectiveProgressUpdate = (beforeView, afterView) => {
    if (!beforeView || !afterView) return null;

    const updates = afterView.objectives
      .map((afterObjective) => {
        const beforeObjective = beforeView.objectives.find(
          (objective) => objective.statKey === afterObjective.statKey
        );

        if (!beforeObjective) return null;

        const progressed = afterObjective.current > beforeObjective.current;
        const newlyCompleted =
          !beforeObjective.complete && afterObjective.complete;

        if (!progressed && !newlyCompleted) return null;

        return {
          label: afterObjective.label,
          statKey: afterObjective.statKey,
          required: afterObjective.required,
          before: beforeObjective.current,
          after: afterObjective.current,
          beforeProgress: beforeObjective.progress,
          afterProgress: afterObjective.progress,
          complete: afterObjective.complete,
          newlyCompleted,
        };
      })
      .filter(Boolean);

    if (updates.length === 0) return null;

    return {
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      levelName: afterView.currentLevel.name,
      updates,
      allComplete: afterView.objectives.every((objective) => objective.complete),
    };
  };

  const awardOneTimeCoins = ({ key, amount, title }) => {
    if (!key || !amount) return false;

    const storageKey = "ballKnowledgeClaimedCoinRewards";
    let claimedRewardList = [];
    try {
      claimedRewardList = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      claimedRewardList = [];
    }
    const claimedRewards = new Set(
      Array.isArray(claimedRewardList) ? claimedRewardList : []
    );

    if (claimedRewards.has(key)) return false;

    const currentCoins = Number(localStorage.getItem("footballQuizCoins")) || coins;
    saveCoins(currentCoins + amount);
    claimedRewards.add(key);
    localStorage.setItem(storageKey, JSON.stringify([...claimedRewards]));
    setCoinRewardToast({ key, amount, title });
    playCoinSound();

    window.setTimeout(() => {
      setCoinRewardToast((reward) => (reward?.key === key ? null : reward));
    }, 1500);

    return true;
  };

  const saveUsername = () => {
    const cleanedName = nameInput.trim();

    if (!cleanedName) return;

    const finalName = cleanedName.slice(0, 16);

    playClickSound();
    setUsername(finalName);
    localStorage.setItem("ballKnowledgeUsername", finalName);
    setNameInput(finalName);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);

    if (isSupabaseConfigured && supabase) {
      (async () => {
        const onlineProfile =
          profile || (await ensureOnlineProfile(finalName));

        if (!onlineProfile) return;

        const { profile: updatedProfile, error } = await updateProfile(
          supabase,
          playerId,
          {
            username: finalName,
            display_name: finalName,
            avatar_emoji: profileAvatar.icon || avatarEmoji,
            avatar_icon: profileAvatar.icon || avatarEmoji,
            avatar_style: profileAvatar.style,
            avatar_color: profileAvatar.color,
            avatar_bg: profileAvatar.bg,
            best_score: highScore,
            coins,
            daily_streak: dailyStreak,
          }
        );

        if (error) {
          console.error("Could not sync username to profile", error);
          setProfileStatus("error");
          setProfileError(getProfileErrorMessage(error));
          return;
        }

        setProfile((currentProfile) => ({
          ...(currentProfile || {}),
          ...(updatedProfile || {}),
          username: finalName,
          display_name: finalName,
          avatar_emoji: profileAvatar.icon || avatarEmoji,
          avatar_icon: profileAvatar.icon || avatarEmoji,
          avatar_style: profileAvatar.style,
          avatar_color: profileAvatar.color,
          avatar_bg: profileAvatar.bg,
        }));
        setProfileStatus("ready");
        setProfileError("");
      })();
    }
  };

  const changeUsername = () => {
    playClickSound();
    setNameInput(username);
    localStorage.removeItem("ballKnowledgeUsername");
    setUsername("");
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);
  };

  const awardDailyStreakBonus = () => {
    const today = getDailyDateKey();
    const yesterday = getYesterdayDateKey();
    const previousStreak = dailyStreak;

    let newStreak = 1;

    if (lastDailyPlayedDate === yesterday) {
      newStreak = dailyStreak + 1;
    } else if (lastDailyPlayedDate === today) {
      newStreak = dailyStreak;
    }

    const reward = getStreakReward(newStreak);

    setDailyStreak(newStreak);
    setLastDailyPlayedDate(today);
    setStreakRewardEarned(reward);

    localStorage.setItem("footballQuizDailyStreak", String(newStreak));
    localStorage.setItem("footballQuizLastDailyPlayedDate", today);

    if (reward > 0) {
      const currentCoins =
        Number(localStorage.getItem("footballQuizCoins")) || coins;

      saveCoins(currentCoins + reward);
      playStreakSound();
      playCoinSound();
    }

    return {
      previousStreak,
      newStreak,
      reward,
    };
  };

  const markDailyAsPlayed = (found, earned, streakInfo) => {
    const result = {
      date: getDailyDateKey(),
      found,
      total: todayChallenge.answers.length,
      coins: earned,
      previousStreak: streakInfo?.previousStreak ?? Math.max(0, dailyStreak - 1),
      streak: streakInfo?.newStreak || dailyStreak,
      streakBonus: streakInfo?.reward || 0,
      title: todayChallenge.label,
    };

    localStorage.setItem("ballKnowledgeDailyDate", getDailyDateKey());
    localStorage.setItem("ballKnowledgeDailyResult", JSON.stringify(result));

    setDailyPlayed(true);
    setLastDailyResult(result);
  };

  const resetConnectionsGame = () => {
    const puzzle = getRandomConnectionsPuzzle();

    setConnectionsPuzzle(puzzle);
    setConnectionsTiles(buildConnectionsTiles(puzzle));
    setConnectionsSelected([]);
    setConnectionsSolved([]);
    setConnectionsMistakes(0);
    setConnectionsFeedback(null);
    setConnectionsShake(0);
    setConnectionsRewardClaimed(false);
  };

  const startConnectionsGame = () => {
    playClickSound();
    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setGameMode("connections");
    setFinished(false);
    setGameStarted(true);
    resetConnectionsGame();
  };

  const resetWhoAmIGame = () => {
    setWhoAmIQuestions(shuffle(WHO_AM_I_QUESTIONS));
    setWhoAmIIndex(0);
    setWhoAmIClueIndex(0);
    setWhoAmIInput("");
    setWhoAmISelectedPlayer(null);
    setWhoAmIScore(0);
    setWhoAmIStreak(0);
    setWhoAmILives(3);
    setWhoAmIFeedback(null);
    setWhoAmIShake(0);
    setWhoAmIGameOver(false);
  };

  const startWhoAmIGame = () => {
    playClickSound();
    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setGameMode("who-am-i");
    setFinished(false);
    setGameStarted(true);
    resetWhoAmIGame();
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const moveToNextWhoAmI = () => {
    if (whoAmILives <= 0 || whoAmIIndex >= whoAmIQuestions.length - 1) {
      setWhoAmIGameOver(true);
      return;
    }

    setWhoAmIIndex((index) => index + 1);
    setWhoAmIClueIndex(0);
    setWhoAmIInput("");
    setWhoAmISelectedPlayer(null);
    setWhoAmIFeedback(null);
  };

  const submitWhoAmIGuess = (playerOverride = null) => {
    if (!currentWhoAmI || whoAmIFeedback?.locked || whoAmIGameOver) return;

    const guessedPlayer = playerOverride || whoAmISelectedPlayer;
    const trimmedGuess = whoAmIInput.trim();
    if (!trimmedGuess && !guessedPlayer) return;

    if (isCorrectWhoAmIPlayerAnswer(guessedPlayer, currentWhoAmI, trimmedGuess)) {
      const points = whoAmIPointsAvailable;
      const clueNumber = whoAmIClueIndex + 1;
      const earlyBonus = clueNumber <= 3 ? 50 : clueNumber <= 6 ? 25 : 0;
      setWhoAmIScore((value) => value + points);
      setWhoAmIStreak((value) => value + 1);
      updateProgressionStats((stats) => addStat(stats, "whoami_solved", 1));
      awardXp({
        key: `whoami-solved:${currentWhoAmI.id}`,
        amount: 50,
        label: "Who Am I solved",
      });
      if (earlyBonus > 0) {
        awardXp({
          key: `whoami-early:${currentWhoAmI.id}`,
          amount: earlyBonus,
          label: "Early clue bonus",
        });
      }
      awardOneTimeCoins({
        key: `whoami:${currentWhoAmI.id}`,
        amount: 50,
        title: "Who Am I solved",
      });
      setWhoAmIFeedback({
        type: "correct",
        text: `Correct! +${points} points`,
        locked: true,
      });
      setWhoAmIInput("");
      setWhoAmISelectedPlayer(null);
      playCorrectSound();
      window.setTimeout(moveToNextWhoAmI, 1150);
      return;
    }

    setWhoAmIShake((value) => value + 1);
    setWhoAmIInput("");
    setWhoAmISelectedPlayer(null);

    if (whoAmIClueIndex < currentWhoAmI.clues.length - 1) {
      setWhoAmIClueIndex((index) => index + 1);
      setWhoAmIFeedback({ type: "wrong", text: "Not yet. New clue unlocked." });
      playWrongSound();
      window.setTimeout(() => setWhoAmIFeedback(null), 900);
      return;
    }

    const nextLives = Math.max(0, whoAmILives - 1);
    setWhoAmILives(nextLives);
    setWhoAmIStreak(0);
    setWhoAmIFeedback({
      type: "reveal",
      text: `Answer: ${currentWhoAmI.answer}`,
      locked: true,
    });
    playWrongSound();

    window.setTimeout(() => {
      if (nextLives <= 0) {
        setWhoAmIGameOver(true);
      } else {
        moveToNextWhoAmI();
      }
    }, 1600);
  };

  const loadFindPlayerPool = async () => {
    if (findPlayerPool.length) return findPlayerPool;

    const { players, error } = await fetchFindPlayerPool();
    if (error || !players.length) {
      console.error("Could not load Find the Player pool", error);
      throw new Error("Could not load player data");
    }

    setFindPlayerPool(players);
    return players;
  };

  const startFindPlayerGame = async (dateKey = findPlayerDate) => {
    playClickSound();
    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setGameMode("find-player");
    setFinished(false);
    setGameStarted(true);
    setFindPlayerDate(dateKey);
    setFindPlayerStatus("loading");
    setFindPlayerError("");
    setFindPlayerSelected(null);
    setFindPlayerGuesses([]);
    setFindPlayerElapsed(0);
    setFindPlayerStartedAt(null);
    window.scrollTo({ top: 0, behavior: "instant" });

    try {
      const pool = await loadFindPlayerPool();
      const [target] = pickDailyFindPlayerTargets(
        pool,
        `daily-find-player:${dateKey}`,
        1
      );

      if (!target) {
        throw new Error("No eligible Find the Player target available");
      }

      setFindPlayerTarget(target);
      setFindPlayerStartedAt(Date.now());
      setFindPlayerStatus("playing");
    } catch (error) {
      console.error("Find the Player failed to start", error);
      setFindPlayerError("Could not load today's player puzzle");
      setFindPlayerStatus("error");
    }
  };

  const shiftFindPlayerDate = (days) => {
    const date = new Date(`${findPlayerDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    const nextKey = date.toISOString().slice(0, 10);
    if (nextKey > getDailyDateKey()) return;
    startFindPlayerGame(nextKey);
  };

  const submitFindPlayerGuess = () => {
    if (
      findPlayerStatus !== "playing" ||
      !findPlayerSelected ||
      !findPlayerTarget
    ) {
      return;
    }

    if (findPlayerGuesses.some((guess) => guess.player.id === findPlayerSelected.id)) {
      setFindPlayerError("You already guessed that player");
      return;
    }

    const result =
      findPlayerRanking.byId.get(findPlayerSelected.id) ||
      rankGuessAgainstTarget(findPlayerSelected, findPlayerTarget, findPlayerPool);
    const nextGuess = {
      player: findPlayerSelected,
      distance: result.distance,
      rank: result.rank,
      poolSize: result.poolSize || findPlayerRanking.poolSize,
      label: result.label || getDistanceLabel(result.distance),
      color: result.color || getDistanceColor(result.distance),
      barPercent: result.barPercent || getDistanceBarPercent(result.distance),
      latest: true,
    };
    const nextGuesses = [
      nextGuess,
      ...findPlayerGuesses.map((guess) => ({ ...guess, latest: false })),
    ].sort((a, b) => (a.rank || 999999) - (b.rank || 999999));
    const isCorrect = result.distance === 0 || findPlayerSelected.id === findPlayerTarget.id;

    setFindPlayerGuesses(nextGuesses);
    setFindPlayerSelected(null);
    setFindPlayerError("");

    if (isCorrect) {
      setFindPlayerStatus("won");
      updateProgressionStats((stats) => addStat(stats, "find_player_solved", 1));
      awardXp({
        key: `find-player-solved:${findPlayerDate}`,
        amount: 100,
        label: "Find the Player solved",
      });
      if (nextGuesses.length < 5) {
        awardXp({
          key: `find-player-under-5:${findPlayerDate}`,
          amount: 100,
          label: "Sharp solve bonus",
        });
      } else if (nextGuesses.length < 10) {
        awardXp({
          key: `find-player-under-10:${findPlayerDate}`,
          amount: 50,
          label: "Quick solve bonus",
        });
      }
      awardOneTimeCoins({
        key: `find-player:${findPlayerDate}`,
        amount: 100,
        title: "Find the Player solved",
      });
      playCorrectSound();
      return;
    }

    playWrongSound();
  };

  const giveUpFindPlayer = () => {
    if (!findPlayerTarget || findPlayerStatus !== "playing") return;

    setFindPlayerSelected(null);
    setFindPlayerStatus("gave-up");
    setFindPlayerError("");
    playWrongSound();
  };

  const toggleConnectionTile = (tile) => {
    if (connectionsGameComplete || connectionsGameOver) return;

    playClickSound();
    setConnectionsFeedback(null);

    setConnectionsSelected((selectedTiles) => {
      if (selectedTiles.includes(tile.id)) {
        return selectedTiles.filter((tileId) => tileId !== tile.id);
      }

      if (selectedTiles.length >= 4) return selectedTiles;

      return [...selectedTiles, tile.id];
    });
  };

  const shuffleConnectionsTiles = () => {
    if (connectionsGameComplete || connectionsGameOver) return;

    playClickSound();
    setConnectionsTiles((tiles) => shuffle(tiles));
  };

  const submitConnectionsSelection = () => {
    if (
      !connectionsPuzzle ||
      connectionsSelected.length !== 4 ||
      connectionsGameComplete ||
      connectionsGameOver
    ) {
      return;
    }

    const selectedTiles = connectionsTiles.filter((tile) =>
      connectionsSelected.includes(tile.id)
    );
    const groupCounts = selectedTiles.reduce((counts, tile) => {
      counts[tile.groupIndex] = (counts[tile.groupIndex] || 0) + 1;
      return counts;
    }, {});
    const solvedGroupIndex = Number(
      Object.entries(groupCounts).find(([, count]) => count === 4)?.[0]
    );

    if (
      Number.isInteger(solvedGroupIndex) &&
      !connectionsSolvedIndexes.includes(solvedGroupIndex)
    ) {
      const solvedGroup = connectionsPuzzle.groups[solvedGroupIndex];

      setConnectionsSolved((groups) => [
        ...groups,
        {
          ...solvedGroup,
          index: solvedGroupIndex,
          solvedItems: selectedTiles.map((tile) => tile.item),
        },
      ]);
      setConnectionsSelected([]);
      setConnectionsFeedback({ type: "correct", text: "Correct group" });
      playCorrectSound();
      return;
    }

    const isOneAway = Object.values(groupCounts).some((count) => count === 3);
    const nextMistakes = connectionsMistakes + 1;

    setConnectionsMistakes(nextMistakes);
    setConnectionsFeedback({
      type: isOneAway ? "close" : "wrong",
      text: isOneAway ? "One away" : "Try again",
    });
    setConnectionsShake((value) => value + 1);
    playWrongSound();

    window.setTimeout(() => {
      setConnectionsSelected([]);
    }, 450);
  };

  const rewardConnectionsCompletion = () => {
    if (connectionsRewardClaimed) return;

    updateProgressionStats((stats) => addStat(stats, "connections_completed", 1));
    awardXp({
      key: `connections-complete:${connectionsPuzzle?.id || "session"}`,
      amount: 100,
      label: "Connections complete",
    });
    if (connectionsMistakes === 0) {
      awardXp({
        key: `connections-perfect:${connectionsPuzzle?.id || "session"}`,
        amount: 50,
        label: "Perfect Connections",
      });
    }
    awardOneTimeCoins({
      key: `connections:${connectionsPuzzle?.id || "session"}`,
      amount: 75,
      title: "Connections complete",
    });
    setConnectionsRewardClaimed(true);
  };

  const startGame = (mode, options = {}) => {
    const nextRunId = Date.now();
    const startingHighScore = highScore;
    const startingProgression = getProgressionView({
      xpTotal,
      levelId: careerLevelId,
      stats: {
        ...progressionStats,
        best_general_score: Math.max(
          startingHighScore,
          Number(progressionStats.best_general_score) || 0
        ),
      },
    });

    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setIsMockMultiplayer(Boolean(options.multiplayer));
    setMockOpponentScore(null);
    setGameMode(mode);
    setQuestions(buildGameQuestions(mode));
    setQuestionIndex(0);
    setSelected(null);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
    setRunStartHighScore(startingHighScore);
    setRunId(nextRunId);
    setHighScoreBonusAwarded(false);
    setRunStartProgression(mode === "general" && !options.multiplayer ? startingProgression : null);
    setGeneralRunXpSummary({ correct: 0, streak: 0, highscore: 0 });
    setObjectiveProgressUpdate(null);
    setRevivesUsed(0);
    setRewardPopup(null);
    setWrongPopup(null);
    setGameStarted(true);
  };

  const openMultiplayer = () => {
    playClickSound();
    setMultiplayerOpen(true);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerStep("menu");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode("");
    setJoinRoomCode("");
    setMultiplayerError("");
  };

  const openArenaSection = (section) => {
    playClickSound();
    setMultiplayerStep(section);
    setMultiplayerError("");
    setMultiplayerNotice("");
  };

  const loadMatchById = async (matchId) => {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return { match: null, rounds: [], error: matchError };
    }

    const { data: rounds, error: roundError } = await supabase
      .from("multiplayer_rounds")
      .select("*")
      .eq("match_id", match.id)
      .order("round_number", { ascending: false })
      .limit(5);

    return {
      match,
      rounds: rounds || [],
      error: roundError,
    };
  };

  const fetchActiveGames = async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    if (!silent) {
      setActiveGamesLoading(true);
      setMultiplayerError("");
    }

    const playerFilters = [`player_id.eq.${playerId}`];

    if (username) {
      playerFilters.push(`username.eq.${username}`);
    }

    const { data: players, error: playersError } = await supabase
      .from("match_players")
      .select("match_id")
      .or(playerFilters.join(","));

    if (playersError) {
      if (!silent) setActiveGamesLoading(false);
      setMultiplayerError("Could not load active matches");
      return;
    }

    const matchIds = [
      ...new Set((players || []).map((player) => player.match_id).filter(Boolean)),
    ];

    if (matchIds.length === 0) {
      setActiveGames([]);
      if (!silent) setActiveGamesLoading(false);
      return;
    }

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .in("id", matchIds)
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (matchesError) {
      if (!silent) setActiveGamesLoading(false);
      setMultiplayerError("Could not load matches");
      return;
    }

    const games = await Promise.all(
      (matches || []).map(async (match) => {
        const { data: rounds } = await supabase
          .from("multiplayer_rounds")
          .select("*")
          .eq("match_id", match.id)
          .order("round_number", { ascending: false })
          .limit(1);

        return {
          match,
          latestRound: rounds?.[0] || null,
        };
      })
    );

    setActiveGames(games);
    if (!silent) setActiveGamesLoading(false);
  };

  const openActiveGames = async () => {
    playClickSound();
    setMultiplayerStep("active-games");
    await fetchActiveGames();
  };

  const goBackMultiplayer = () => {
    playClickSound();

    if (multiplayerStep === "menu") {
      setMultiplayerOpen(false);
      return;
    }

    if (
      ["league-menu", "h2h-menu", "play-now-waiting"].includes(multiplayerStep)
    ) {
      setMultiplayerStep("menu");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setMultiplayerError("");
      setMultiplayerNotice("");
      return;
    }

    if (
      [
        "create-league",
        "join-league",
        "my-leagues",
        "league-dashboard",
      ].includes(multiplayerStep)
    ) {
      setMultiplayerStep("league-menu");
      setLeagueDashboard(null);
      setLeagueNameInput("");
      setLeagueCodeInput("");
      setMultiplayerError("");
      return;
    }

    if (["active-games", "created", "join", "joined"].includes(multiplayerStep)) {
      setMultiplayerStep("h2h-menu");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setNextCategoryPickerOpen(false);
      setMultiplayerError("");
      return;
    }

    setMultiplayerStep("menu");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerError("");
  };

  const openExistingMatch = async (matchId) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    playClickSound();
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const { match, rounds, error } = await loadMatchById(matchId);

    setMultiplayerLoading(false);

    if (error || !match) {
      setMultiplayerError("Could not open match");
      return;
    }

    setActiveMatch(match);
    setActiveRound(rounds[0] || null);
    setMatchRounds(rounds);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || "general");
    setMultiplayerStep(match.status === "waiting" ? "created" : "joined");
  };

  const loadLeagueDashboard = async (leagueId, { silent = false } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    if (!silent) {
      setLeagueLoading(true);
      setMultiplayerError("");
    }

    const { dashboard, error } = await fetchLeagueDashboard(
      supabase,
      leagueId,
      playerId
    );

    if (!silent) setLeagueLoading(false);

    if (error || !dashboard) {
      setMultiplayerError("Could not load league");
      return;
    }

    setLeagueDashboard(dashboard);
  };

  const openLeagueDashboard = async (leagueId) => {
    playClickSound();
    setMultiplayerStep("league-dashboard");
    await loadLeagueDashboard(leagueId);
  };

  const createNewLeague = async () => {
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");

    if (
      leagueSettings.quizCount +
        leagueSettings.top10Count +
        leagueSettings.whoamiCount +
        (leagueSettings.findPlayerCount || 0) <=
      0
    ) {
      setLeagueLoading(false);
      setMultiplayerError("Choose at least one daily challenge type");
      return;
    }

    const { league, error } = await createLeague(supabase, {
      name: leagueNameInput,
      playerId,
      username,
      settings: {
        durationDays: leagueDurationInput,
        quizCount: leagueSettings.quizCount,
        top10Count: leagueSettings.top10Count,
        whoamiCount: leagueSettings.whoamiCount,
        findPlayerCount: leagueSettings.findPlayerCount || 0,
        findPlayerScoringMode: leagueSettings.findPlayerScoringMode || "attempts",
        maxDailyPoints: leagueSettings.maxDailyPoints,
        leagueFormat: leagueFormatInput,
      },
    });

    setLeagueLoading(false);

    if (error || !league) {
      setMultiplayerError("Could not create league");
      return;
    }

    setLeagueNameInput("");
    setMultiplayerNotice("League created");
    await openLeagueDashboard(league.id);
  };

  const joinExistingLeague = async () => {
    if (!leagueCodeInput.trim()) return;

    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");

    const { league, alreadyJoined, error } = await joinLeague(supabase, {
      code: leagueCodeInput,
      playerId,
      username,
    });

    setLeagueLoading(false);

    if (error || !league) {
      setMultiplayerError(error?.message === "League not found" ? "League not found" : "Could not join league");
      return;
    }

    setLeagueCodeInput("");
    setMultiplayerNotice(alreadyJoined ? "League opened" : "Joined league");
    await openLeagueDashboard(league.id);
  };

  const loadMyLeagues = async () => {
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerStep("my-leagues");

    const { leagues, error } = await fetchMyLeagues(supabase, playerId);

    setLeagueLoading(false);

    if (error) {
      setMultiplayerError("Could not load leagues");
      return;
    }

    setMyLeagues(leagues);
  };

  const prepareLeagueChallenge = async () => {
    if (!activeLeague || activeLeagueSubmission) return;

    playClickSound();
    setLeagueLoading(true);
    setMultiplayerError("");

    try {
      const settings = getLeagueSettingsSummary(activeLeague);
      const { leagueDay, error } = await getOrCreateLeagueDay(
        supabase,
        activeLeague
      );

      if (error || !leagueDay) {
        console.error("Could not prepare league day", {
          error,
          leagueId: activeLeague.id,
          quiz_count: settings.quizCount,
          top10_count: settings.top10Count,
          whoami_count: settings.whoamiCount,
          find_player_count: settings.findPlayerCount,
        });
        setMultiplayerError(
          error?.message?.includes("columns")
            ? "League setup needs the latest Supabase columns"
            : "Today's league challenge is not ready"
        );
        return;
      }

      const quizQuestions = getLeagueQuestionsByIds(
        leagueDay.quiz_question_ids || []
      ).map(withShuffledOptions);
      const top10Challenge = getLeagueTop10ChallengeById(
        leagueDay.top10_challenge_id,
        `${activeLeague.id}:${leagueDay.day_key}`
      );
      const top10Challenges =
        settings.top10Count > 0
          ? Array.from({ length: settings.top10Count }, (_, index) =>
              index === 0
                ? top10Challenge
                : getLeagueTop10Challenge(
                    `${activeLeague.id}:${leagueDay.day_key}:top10:${index}`
                  )
            ).filter(Boolean)
          : [];
      const leagueWhoAmIItems = getLeagueWhoAmIQuestionsByIds(
        leagueDay.whoami_question_ids || []
      );
      const findPlayerPoolItems =
        settings.findPlayerCount > 0 ? await loadFindPlayerPool() : [];
      const findPlayerIds = Array.isArray(leagueDay.find_player_target_ids)
        ? leagueDay.find_player_target_ids
        : [];
      const findPlayerTargets =
        settings.findPlayerCount > 0
          ? findPlayerIds
              .map((id) => findPlayerPoolItems.find((player) => player.id === id))
              .filter(Boolean)
          : [];

      if (
        quizQuestions.length !== settings.quizCount ||
        leagueWhoAmIItems.length !== settings.whoamiCount ||
        findPlayerTargets.length !== settings.findPlayerCount ||
        (settings.top10Count > 0 &&
          top10Challenges.length !== settings.top10Count)
      ) {
        const quizQuestionIds = Array.isArray(leagueDay.quiz_question_ids)
          ? leagueDay.quiz_question_ids
          : [];
        const whoamiQuestionIds = Array.isArray(leagueDay.whoami_question_ids)
          ? leagueDay.whoami_question_ids
          : [];
        const loadedQuizIds = new Set(
          quizQuestions.map((question) => question.multiplayerId)
        );
        const loadedWhoAmIIds = new Set(
          leagueWhoAmIItems.map((question) => question.id)
        );
        const loadedFindPlayerIds = new Set(
          findPlayerTargets.map((player) => player.id)
        );

        console.error("Invalid league challenge payload", {
          leagueId: activeLeague.id,
          settings,
          dayKey: leagueDay.day_key,
          quiz_question_ids: quizQuestionIds,
          top10_challenge_id: leagueDay.top10_challenge_id,
          whoami_question_ids: whoamiQuestionIds,
          find_player_target_ids: findPlayerIds,
          quizQuestions: quizQuestions.length,
          leagueWhoAmIItems: leagueWhoAmIItems.length,
          findPlayerTargets: findPlayerTargets.length,
          top10Challenges: top10Challenges.length,
          missingQuizIds: quizQuestionIds.filter((id) => !loadedQuizIds.has(id)),
          missingWhoAmIIds: whoamiQuestionIds.filter(
            (id) => !loadedWhoAmIIds.has(id)
          ),
          missingFindPlayerIds: findPlayerIds.filter(
            (id) => !loadedFindPlayerIds.has(id)
          ),
        });
        setMultiplayerError("Today's league challenge is not ready");
        return;
      }

      setLeagueDashboard((dashboard) => ({
        ...dashboard,
        leagueDay,
      }));
      setLeagueQuizQuestions(quizQuestions);
      setLeagueTop10Challenges(top10Challenges);
      setLeagueTop10Challenge(top10Challenges[0] || null);
      setLeagueTop10Index(0);
      setLeagueTop10TotalScore(0);
      setLeagueWhoAmIQuestions(leagueWhoAmIItems);
      setLeagueFindPlayerTargets(findPlayerTargets);
      setLeagueQuizIndex(0);
      setLeagueQuizSelected(null);
      setLeagueQuizScore(0);
      setLeagueTimeLeft(15);
      setLeagueTop10Found([]);
      setLeagueTop10Lives(3);
      setLeagueTop10Reveal(null);
      setLeagueTop10Scanning(false);
      setLeagueTop10Input("");
      setLeagueTop10SelectedPlayer(null);
      setLeagueWhoAmIIndex(0);
      setLeagueWhoAmIClueIndex(0);
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      setLeagueWhoAmIScore(0);
      setLeagueWhoAmIFeedback(null);
      setLeagueWhoAmIShake(0);
      setLeagueFindPlayerIndex(0);
      setLeagueFindPlayerSelected(null);
      setLeagueFindPlayerGuesses([]);
      setLeagueFindPlayerScore(0);
      setLeagueFindPlayerAttemptTotal(0);
      setLeagueFindPlayerStartedAt(null);
      setLeagueFindPlayerElapsed(0);
      setLeagueFindPlayerFeedback("");
      setLeagueResult(null);
      setLeagueChallengePhase("intro");
      setLeagueChallengeOpen(true);
      setMultiplayerOpen(false);
    } catch (error) {
      console.error("League challenge loading failed", {
        error,
        leagueId: activeLeague?.id,
      });
      setMultiplayerError("Could not start today's league challenge");
    } finally {
      setLeagueLoading(false);
    }
  };

  const startLeagueQuiz = () => {
    playClickSound();
    setLeagueChallengePhase(
      leagueQuizQuestions.length > 0
        ? "quiz"
        : leagueSettings.top10Count > 0
        ? "top10"
        : leagueSettings.whoamiCount > 0
        ? "whoami"
        : leagueSettings.findPlayerCount > 0
        ? "find-player"
        : "whoami"
    );
    setLeagueTimeLeft(15);
    if (leagueSettings.findPlayerCount > 0 && !leagueQuizQuestions.length && leagueSettings.top10Count <= 0 && leagueSettings.whoamiCount <= 0) {
      setLeagueFindPlayerStartedAt(Date.now());
    }
  };

  const advanceAfterLeagueTop10 = (currentListScore = leagueTop10Score) => {
    const nextTotalTop10Score = leagueTop10TotalScore + currentListScore;

    if (leagueTop10Index < leagueTop10Challenges.length - 1) {
      const nextIndex = leagueTop10Index + 1;
      setLeagueTop10TotalScore(nextTotalTop10Score);
      setLeagueTop10Index(nextIndex);
      setLeagueTop10Challenge(leagueTop10Challenges[nextIndex]);
      setLeagueTop10Found([]);
      setLeagueTop10Lives(3);
      setLeagueTop10Reveal(null);
      setLeagueTop10Scanning(false);
      setLeagueTop10Input("");
      setLeagueTop10SelectedPlayer(null);
      return;
    }

    if (leagueSettings.whoamiCount > 0) {
      setLeagueTop10TotalScore(nextTotalTop10Score);
      setLeagueTop10Found([]);
      setLeagueTop10Reveal(null);
      setLeagueTop10Input("");
      setLeagueTop10SelectedPlayer(null);
      setLeagueChallengePhase("whoami");
      return;
    }

    if (leagueSettings.findPlayerCount > 0) {
      setLeagueTop10TotalScore(nextTotalTop10Score);
      setLeagueChallengePhase("find-player");
      setLeagueFindPlayerStartedAt(Date.now());
      return;
    }

    completeLeagueChallenge({
      top10Score: nextTotalTop10Score,
      whoamiScore: leagueWhoAmIScore,
      findPlayerScore: leagueFindPlayerScore,
    });
  };

  const chooseLeagueQuizAnswer = (option) => {
    if (leagueQuizSelected || !currentLeagueQuizQuestion) return;

    setLeagueQuizSelected(option);
    const isCorrect = option === currentLeagueQuizQuestion.answer;
    const nextScore = isCorrect ? leagueQuizScore + 1 : leagueQuizScore;

    if (isCorrect) {
      setLeagueQuizScore(nextScore);
      playCorrectSound();
    } else {
      playWrongSound();
    }

    window.setTimeout(() => {
      if (leagueQuizIndex >= leagueQuizQuestions.length - 1) {
        if (leagueSettings.top10Count > 0) {
          setLeagueChallengePhase("top10");
        } else if (leagueSettings.whoamiCount > 0) {
          setLeagueChallengePhase("whoami");
        } else if (leagueSettings.findPlayerCount > 0) {
          setLeagueChallengePhase("find-player");
          setLeagueFindPlayerStartedAt(Date.now());
        } else {
          completeLeagueChallenge({ top10Score: 0, whoamiScore: 0, findPlayerScore: 0 });
        }
      } else {
        setLeagueQuizIndex((index) => index + 1);
        setLeagueQuizSelected(null);
        setLeagueTimeLeft(15);
      }
    }, 750);
  };

  const submitLeagueTop10Answer = (playerOverride = null) => {
    const guessedPlayer = playerOverride || leagueTop10SelectedPlayer;
    const guessText = guessedPlayer?.name || leagueTop10Input.trim();

    if (
      !guessText ||
      !leagueTop10Challenge ||
      leagueTop10Scanning ||
      leagueTop10Lives <= 0
    ) {
      return;
    }

    const matchedAnswer = leagueTop10Challenge.answers.find(
      (answer) =>
        isCorrectPlayerAnswer(guessedPlayer, answer) ||
        isCorrectAnswer(guessText, answer)
    );
    const alreadyFound =
      matchedAnswer && leagueTop10Found.includes(matchedAnswer);
    const matchedRank = matchedAnswer
      ? leagueTop10Challenge.answers.indexOf(matchedAnswer) + 1
      : 0;
    let displayRank = leagueTop10Challenge.answers.length;

    setLeagueTop10Scanning(true);
    setLeagueTop10Reveal({
      phase: "scan",
      type: "scan",
      displayRank,
      rank: matchedRank,
      answer: matchedAnswer || guessText,
    });

    const interval = window.setInterval(() => {
      if (matchedRank && displayRank === matchedRank) {
        window.clearInterval(interval);
        setLeagueTop10Scanning(false);

        if (alreadyFound) {
          setLeagueTop10Reveal({
            phase: "result",
            type: "already",
            displayRank,
            rank: matchedRank,
            answer: matchedAnswer,
          });
          setLeagueTop10Input("");
          setLeagueTop10SelectedPlayer(null);
          window.setTimeout(() => setLeagueTop10Reveal(null), 900);
          return;
        }

        setLeagueTop10Found((answers) => [...answers, matchedAnswer]);
        setLeagueTop10Reveal({
          phase: "result",
          type: "correct",
          displayRank,
          rank: matchedRank,
          answer: matchedAnswer,
        });
        setLeagueTop10Input("");
        setLeagueTop10SelectedPlayer(null);
        playCorrectSound();

        if (leagueTop10Found.length + 1 >= leagueTop10Challenge.answers.length) {
          window.setTimeout(
            () => advanceAfterLeagueTop10(leagueTop10Found.length + 1),
            700
          );
        } else {
          window.setTimeout(() => setLeagueTop10Reveal(null), 900);
        }
        return;
      }

      displayRank -= 1;

      if (displayRank <= 0) {
        window.clearInterval(interval);
        const nextLives = Math.max(0, leagueTop10Lives - 1);
        setLeagueTop10Lives(nextLives);
        setLeagueTop10Scanning(false);
        setLeagueTop10Reveal({
          phase: "result",
          type: "wrong",
          displayRank: 0,
          rank: 0,
          answer: guessText,
        });
        setLeagueTop10Input("");
        setLeagueTop10SelectedPlayer(null);
        playWrongSound();

        if (nextLives <= 0) {
          window.setTimeout(() => {
            setLeagueTop10Reveal(null);
            setLeagueChallengePhase("top10-reveal");
          }, 850);
        } else {
          window.setTimeout(() => setLeagueTop10Reveal(null), 900);
        }
        return;
      }

      setLeagueTop10Reveal({
        phase: "scan",
        type: "scan",
        displayRank,
        rank: matchedRank,
        answer: matchedAnswer || guessText,
      });
    }, DAILY_SCAN_STEP_MS);
  };

  const moveToNextLeagueWhoAmI = (nextScore = leagueWhoAmIScore) => {
    window.setTimeout(() => {
      if (leagueWhoAmIIndex >= leagueWhoAmIQuestions.length - 1) {
        if (leagueSettings.findPlayerCount > 0) {
          setLeagueChallengePhase("find-player");
          setLeagueFindPlayerStartedAt(Date.now());
          return;
        }

        completeLeagueChallenge({
          top10Score: leagueTop10TotalWithCurrent,
          whoamiScore: nextScore,
          findPlayerScore: leagueFindPlayerScore,
        });
        return;
      }

      setLeagueWhoAmIIndex((index) => index + 1);
      setLeagueWhoAmIClueIndex(0);
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      setLeagueWhoAmIFeedback(null);
    }, 900);
  };

  const submitLeagueWhoAmIAnswer = (playerOverride = null) => {
    const guessedPlayer = playerOverride || leagueWhoAmISelectedPlayer;

    if (
      !currentLeagueWhoAmI ||
      (!leagueWhoAmIInput.trim() && !guessedPlayer) ||
      leagueWhoAmIFeedback?.locked
    ) {
      return;
    }

    const guess = leagueWhoAmIInput.trim();
    const isCorrect = isCorrectWhoAmIPlayerAnswer(
      guessedPlayer,
      currentLeagueWhoAmI,
      guess
    );

    if (isCorrect) {
      const earnedPoints = leagueWhoAmIPointsAvailable;
      const nextScore = leagueWhoAmIScore + earnedPoints;
      setLeagueWhoAmIScore(nextScore);
      setLeagueWhoAmIFeedback({
        type: "correct",
        text: `Correct: ${currentLeagueWhoAmI.answer}  +${earnedPoints}`,
        locked: true,
      });
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      playCorrectSound();
      moveToNextLeagueWhoAmI(nextScore);
      return;
    }

    if (leagueWhoAmIClueIndex < currentLeagueWhoAmI.clues.length - 1) {
      setLeagueWhoAmIClueIndex((index) => index + 1);
      setLeagueWhoAmIFeedback({
        type: "wrong",
        text: "New clue unlocked",
      });
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      setLeagueWhoAmIShake((value) => value + 1);
      playWrongSound();
      window.setTimeout(() => setLeagueWhoAmIFeedback(null), 650);
      return;
    }

    setLeagueWhoAmIFeedback({
      type: "wrong",
      text: `Answer: ${currentLeagueWhoAmI.answer}  0 points`,
      locked: true,
    });
    setLeagueWhoAmIInput("");
    setLeagueWhoAmISelectedPlayer(null);
    setLeagueWhoAmIShake((value) => value + 1);
    playWrongSound();
    moveToNextLeagueWhoAmI(leagueWhoAmIScore);
  };

  const submitLeagueFindPlayerGuess = () => {
    if (
      leagueChallengePhase !== "find-player" ||
      !currentLeagueFindPlayerTarget ||
      !leagueFindPlayerSelected ||
      leagueFindPlayerFeedback.startsWith("Answer:")
    ) {
      return;
    }

    if (
      leagueFindPlayerGuesses.some(
        (guess) => guess.player.id === leagueFindPlayerSelected.id
      )
    ) {
      setLeagueFindPlayerFeedback("Already guessed");
      return;
    }

    const result =
      leagueFindPlayerRanking.byId.get(leagueFindPlayerSelected.id) ||
      rankGuessAgainstTarget(
        leagueFindPlayerSelected,
        currentLeagueFindPlayerTarget,
        findPlayerPool
      );
    const nextGuess = {
      player: leagueFindPlayerSelected,
      distance: result.distance,
      rank: result.rank,
      poolSize: result.poolSize || leagueFindPlayerRanking.poolSize,
      label: result.label || getDistanceLabel(result.distance),
      color: result.color || getDistanceColor(result.distance),
      barPercent: result.barPercent || getDistanceBarPercent(result.distance),
      latest: true,
    };
    const nextGuesses = [
      nextGuess,
      ...leagueFindPlayerGuesses.map((guess) => ({ ...guess, latest: false })),
    ].sort((a, b) => (a.rank || 999999) - (b.rank || 999999));
    const solved =
      result.distance === 0 ||
      leagueFindPlayerSelected.id === currentLeagueFindPlayerTarget.id;
    const attempts = nextGuesses.length;
    const sectionDone = solved;
    const earned = sectionDone ? getFindPlayerPoints(attempts, solved) : 0;
    const nextScore = leagueFindPlayerScore + earned;

    setLeagueFindPlayerGuesses(nextGuesses);
    setLeagueFindPlayerSelected(null);
    setLeagueFindPlayerFeedback(
      solved ? `Correct: +${earned}` : nextGuess.label
    );

    if (!sectionDone) {
      playWrongSound();
      return;
    }

    if (solved) playCorrectSound();
    else playWrongSound();

    setLeagueFindPlayerScore(nextScore);

    window.setTimeout(() => {
      if (leagueFindPlayerIndex >= leagueFindPlayerTargets.length - 1) {
        completeLeagueChallenge({
          top10Score: leagueTop10TotalWithCurrent,
          whoamiScore: leagueWhoAmIScore,
          findPlayerScore: nextScore,
          findPlayerAttempts: leagueFindPlayerAttemptTotal + attempts,
          findPlayerTimeSeconds: leagueFindPlayerElapsed,
        });
        return;
      }

      setLeagueFindPlayerAttemptTotal((total) => total + attempts);
      setLeagueFindPlayerIndex((index) => index + 1);
      setLeagueFindPlayerGuesses([]);
      setLeagueFindPlayerSelected(null);
      setLeagueFindPlayerFeedback("");
    }, 950);
  };

  const giveUpLeagueFindPlayer = () => {
    if (
      leagueChallengePhase !== "find-player" ||
      !currentLeagueFindPlayerTarget ||
      leagueFindPlayerFeedback.startsWith("Answer:")
    ) {
      return;
    }

    const attempts = leagueFindPlayerGuesses.length;
    setLeagueFindPlayerFeedback(`Answer: ${currentLeagueFindPlayerTarget.name}  0 points`);
    setLeagueFindPlayerSelected(null);
    playWrongSound();

    window.setTimeout(() => {
      if (leagueFindPlayerIndex >= leagueFindPlayerTargets.length - 1) {
        completeLeagueChallenge({
          top10Score: leagueTop10TotalWithCurrent,
          whoamiScore: leagueWhoAmIScore,
          findPlayerScore: leagueFindPlayerScore,
          findPlayerAttempts: leagueFindPlayerAttemptTotal + attempts,
          findPlayerTimeSeconds: leagueFindPlayerElapsed,
        });
        return;
      }

      setLeagueFindPlayerAttemptTotal((total) => total + attempts);
      setLeagueFindPlayerIndex((index) => index + 1);
      setLeagueFindPlayerGuesses([]);
      setLeagueFindPlayerSelected(null);
      setLeagueFindPlayerFeedback("");
    }, 1100);
  };

  const completeLeagueChallenge = async ({
    top10Score = leagueTop10Score,
    whoamiScore = leagueWhoAmIScore,
    findPlayerScore = leagueFindPlayerScore,
    findPlayerAttempts = null,
    findPlayerTimeSeconds = null,
  } = {}) => {
    if (!activeLeague || !activeLeagueDay || leagueResult) return;

    playClickSound();
    setLeagueLoading(true);
    setMultiplayerError("");

    const { submission, alreadySubmitted, error } = await submitLeagueDailyResult(
      supabase,
      {
        league: activeLeague,
        leagueDay: activeLeagueDay,
        playerId,
        username,
        quizScore: leagueQuizScore,
        top10Score,
        whoamiScore,
        findPlayerScore,
        findPlayerAttempts,
        findPlayerTimeSeconds,
      }
    );

    setLeagueLoading(false);

    if (error || !submission) {
      setMultiplayerError("Could not save league score");
      return;
    }

    const leagueDayKey =
      activeLeagueDay.day_key || `${activeLeague.id}:${activeLeagueDay.day_number}`;
    if (!alreadySubmitted) {
      updateProgressionStats((stats) =>
        addStat(stats, "league_days_completed", 1)
      );
      awardXp({
        key: `league-day:${activeLeague.id}:${leagueDayKey}`,
        amount: 100,
        label: "League day complete",
      });
    }

    setLeagueResult({
      quizScore: submission.quiz_score,
      top10Score: submission.top10_score,
      whoamiScore: submission.whoami_score || whoamiScore,
      findPlayerScore: submission.find_player_score || findPlayerScore,
      findPlayerAttempts: submission.find_player_attempts || findPlayerAttempts,
      findPlayerTimeSeconds:
        submission.find_player_time_seconds || findPlayerTimeSeconds,
      totalPoints: submission.total_points,
      alreadySubmitted,
    });
    setLeagueChallengePhase("complete");
    await loadLeagueDashboard(activeLeague.id, { silent: true });
  };

  const closeLeagueChallenge = async () => {
    playClickSound();
    setLeagueChallengeOpen(false);
    setMultiplayerOpen(true);
    setMultiplayerStep("league-dashboard");
    if (activeLeague?.id) {
      await loadLeagueDashboard(activeLeague.id, { silent: true });
    }
  };

  const startPlayNow = async () => {
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    setMultiplayerLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("Searching for opponent...");

    const { match, created, error } = await findOrCreatePublicMatch(supabase, {
      playerId,
      username,
    });

    setMultiplayerLoading(false);

    if (error || !match) {
      setMultiplayerError("Could not start matchmaking");
      return;
    }

    setActiveMatch(match);
    setActiveRound(null);
    setMatchRounds([]);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || "general");

    if (created) {
      setMultiplayerStep("play-now-waiting");
      return;
    }

    setMultiplayerNotice("Opponent found");
    setMultiplayerStep("joined");
  };

  const requestDeleteMatch = (match) => {
    playClickSound();
    setMatchDeleteCandidate(match);
  };

  const cancelDeleteMatch = () => {
    playClickSound();
    setMatchDeleteCandidate(null);
  };

  const confirmDeleteMatch = async () => {
    if (!matchDeleteCandidate?.id || !supabase) return;

    const matchId = matchDeleteCandidate.id;

    playClickSound();
    setDeletingMatchId(matchId);
    setMultiplayerError("");
    setMultiplayerNotice("");

    const removeMatchLocally = (notice) => {
      setActiveGames((games) =>
        games.filter(({ match }) => match.id !== matchId)
      );

      if (activeMatch?.id === matchId) {
        setActiveMatch(null);
        setActiveRound(null);
        setMatchRounds([]);
        setMultiplayerStep("menu");
      }

      setMultiplayerNotice(notice);
      setMatchDeleteCandidate(null);
      setDeletingMatchId(null);
    };

    const { data: existingMatch, error: lookupError } = await supabase
      .from("matches")
      .select("id")
      .eq("id", matchId)
      .maybeSingle();

    if (lookupError) {
      console.error("Could not check match before delete", lookupError);
      setDeletingMatchId(null);
      setMultiplayerError("Could not delete match");
      return;
    }

    if (!existingMatch) {
      removeMatchLocally("Match already removed");
      return;
    }

    const { error: roundsDeleteError } = await supabase
      .from("multiplayer_rounds")
      .delete()
      .eq("match_id", matchId);

    if (roundsDeleteError) {
      console.error("Could not delete multiplayer rounds", roundsDeleteError);
      setDeletingMatchId(null);
      setMultiplayerError("Could not delete match");
      return;
    }

    const { error: playersDeleteError } = await supabase
      .from("match_players")
      .delete()
      .eq("match_id", matchId);

    if (playersDeleteError) {
      console.error("Could not delete match players", playersDeleteError);
      setDeletingMatchId(null);
      setMultiplayerError("Could not delete match");
      return;
    }

    const { data: deletedMatches, error: matchDeleteError } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId)
      .select("id");

    if (matchDeleteError) {
      console.error("Could not delete match", matchDeleteError);
      setDeletingMatchId(null);
      setMultiplayerError("Could not delete match");
      return;
    }

    removeMatchLocally(
      deletedMatches?.length ? "Match deleted" : "Match already removed"
    );
  };

  const refreshMultiplayerMatch = async ({ silent = false } = {}) => {
    if (!activeMatch?.id || !supabase) return;

    if (!silent) {
      setMultiplayerLoading(true);
      setMultiplayerError("");
    }

    const { match: data, rounds, error } = await loadMatchById(activeMatch.id);

    if (error || !data) {
      if (!silent) setMultiplayerLoading(false);
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setMultiplayerError("Could not refresh room");
      return;
    }

    if (!silent) setMultiplayerLoading(false);

    setActiveMatch(data);
    setActiveRound(rounds?.[0] || null);
    setMatchRounds(rounds || []);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(data.room_code);
    if (data.status === "ready") {
      setMultiplayerStep("joined");
    }
  };

  const createMultiplayerMatch = async () => {
    // TODO Supabase later: create match_rounds/match_questions records when
    // replacing Start Test Round with the real turn-based round flow.
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    setMultiplayerLoading(true);
    setMultiplayerError("");

    const roomCode = createMockRoomCode();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        room_code: roomCode,
        mode: multiplayerMode,
        created_by: username,
        current_turn: username,
        current_turn_id: playerId,
        player1_username: username,
        player1_id: playerId,
        status: "waiting",
        phase: "waiting_for_opponent",
        round_number: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (matchError || !match) {
      setMultiplayerLoading(false);
      setMultiplayerError("Could not create match");
      return;
    }

    const { error: playerError } = await supabase.from("match_players").insert({
      match_id: match.id,
      username,
      player_id: playerId,
      player_slot: "player1",
    });

    setMultiplayerLoading(false);

    if (playerError) {
      setMultiplayerError("Match created, but player join failed");
      return;
    }

    setActiveMatch(match);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerStep("created");
  };

  const joinMultiplayerMatch = async () => {
    // TODO Supabase later: replace manual Refresh with realtime updates or
    // polling for match status and opponent readiness.
    if (!joinRoomCode.trim()) return;

    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    setMultiplayerLoading(true);
    setMultiplayerError("");

    const roomCode = joinRoomCode.trim().toUpperCase();
    const { data: match, error: lookupError } = await supabase
      .from("matches")
      .select("*")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (lookupError) {
      setMultiplayerLoading(false);
      setMultiplayerError("Could not join room");
      return;
    }

    if (!match) {
      setMultiplayerLoading(false);
      setMultiplayerError("Room not found");
      return;
    }

    if (
      match.player1_id === playerId ||
      (!match.player1_id && match.player1_username === username)
    ) {
      setMultiplayerLoading(false);
      setMultiplayerError("This is your own match");
      return;
    }

    if (
      match.player2_id &&
      match.player2_id === playerId
    ) {
      setMultiplayerLoading(false);
      await openExistingMatch(match.id);
      return;
    }

    if (
      match.player2_id &&
      match.player2_id !== playerId
    ) {
      setMultiplayerLoading(false);
      setMultiplayerError("Room already full");
      return;
    }

    if (
      match.player2_username &&
      match.player2_username !== username &&
      !match.player2_id
    ) {
      setMultiplayerLoading(false);
      setMultiplayerError("Room already full");
      return;
    }

    const { data: updatedMatch, error: updateError } = await supabase
      .from("matches")
      .update({
        player2_username: username,
        player2_id: playerId,
        status: "ready",
        phase: "choose_category",
        current_turn: match.player1_username,
        current_turn_id: match.player1_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id)
      .select()
      .single();

    if (updateError || !updatedMatch) {
      setMultiplayerLoading(false);
      setMultiplayerError("Could not update room");
      return;
    }

    const { error: playerError } = await supabase.from("match_players").insert({
      match_id: updatedMatch.id,
      username,
      player_id: playerId,
      player_slot: "player2",
    });

    setMultiplayerLoading(false);

    if (playerError) {
      setMultiplayerError("Joined room, but player save failed");
      return;
    }

    setActiveMatch(updatedMatch);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(updatedMatch.room_code);
    setMultiplayerMode(updatedMatch.mode || multiplayerMode);
    setMultiplayerStep("joined");
  };

  const selectMultiplayerCategory = async (category) => {
    if (!category.available || !activeMatch?.id || !supabase || multiplayerLoading) {
      return;
    }

    playClickSound();
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const nextRoundNumber = (activeMatch.round_number || 0) + 1;
    const questionIds = pickMultiplayerQuestionIds(category.id, 5);

    if (questionIds.length !== 5) {
      setMultiplayerLoading(false);
      setMultiplayerError("Not enough questions in this category yet");
      return;
    }

    const { data: existingRound, error: existingRoundError } = await supabase
      .from("multiplayer_rounds")
      .select("*")
      .eq("match_id", activeMatch.id)
      .eq("round_number", nextRoundNumber)
      .maybeSingle();

    if (existingRoundError) {
      setMultiplayerLoading(false);
      setMultiplayerError("Could not check existing round");
      return;
    }

    if (existingRound) {
      setActiveRound(existingRound);
      setMatchRounds((rounds) => [
        existingRound,
        ...rounds.filter((round) => round.id !== existingRound.id),
      ]);
      setNextCategoryPickerOpen(false);
      setMultiplayerLoading(false);
      return;
    }

    const { data: round, error: roundError } = await supabase
      .from("multiplayer_rounds")
      .insert({
        match_id: activeMatch.id,
        round_number: nextRoundNumber,
        category: category.id,
        chosen_by: username,
        question_ids: questionIds,
        player1_score: 0,
        player2_score: 0,
        player1_finished: false,
        player2_finished: false,
        status: "active",
      })
      .select()
      .single();

    if (roundError) {
      const { data: duplicateRound } = await supabase
        .from("multiplayer_rounds")
        .select("*")
        .eq("match_id", activeMatch.id)
        .eq("round_number", nextRoundNumber)
        .maybeSingle();

      if (duplicateRound) {
        setActiveRound(duplicateRound);
        setMatchRounds((rounds) => [
          duplicateRound,
          ...rounds.filter((item) => item.id !== duplicateRound.id),
        ]);
        setNextCategoryPickerOpen(false);
        setMultiplayerLoading(false);
        return;
      }

      setMultiplayerLoading(false);
      setMultiplayerError("Could not create round");
      return;
    }

    if (!round) {
      setMultiplayerLoading(false);
      setMultiplayerError("Could not create round");
      return;
    }

    const { data, error } = await supabase
      .from("matches")
      .update({
        selected_category: category.id,
        mode: category.mode,
        phase: "round_active",
        round_number: nextRoundNumber,
        current_turn: username,
        current_turn_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeMatch.id)
      .select()
      .single();

    setMultiplayerLoading(false);

    if (error || !data) {
      setMultiplayerError("Could not update category");
      return;
    }

    setActiveMatch(data);
    setActiveRound(round);
    setMatchRounds((rounds) => [
      round,
      ...rounds.filter((item) => item.id !== round.id),
    ]);
    setNextCategoryPickerOpen(false);
    setMultiplayerMode(data.mode || category.mode);
    setMultiplayerStep("joined");
  };

  const startMockMultiplayerMatch = () => {
    // TODO Supabase: replace Start Test Round with real turn-based round flow.
    playClickSound();
    startGame(multiplayerMode, { multiplayer: true });
  };

  const startActiveMultiplayerRound = () => {
    if (!activeRound || activeRoundQuestions.length !== 5) {
      setMultiplayerError("Round questions are not ready");
      return;
    }

    if (hasPlayedActiveRound) {
      setMultiplayerError("You have already played this round");
      return;
    }

    playClickSound();
    setMultiplayerRoundIndex(0);
    setMultiplayerRoundSelected(null);
    setMultiplayerRoundScore(0);
    setMultiplayerTimeLeft(MULTIPLAYER_TIME_LIMIT);
    setMultiplayerRoundDone(false);
    setIsSubmittingRound(false);
    setMultiplayerRoundOpen(true);
    setMultiplayerOpen(false);
  };

  const chooseMultiplayerRoundAnswer = (option) => {
    if (
      multiplayerRoundSelected ||
      isSubmittingRound ||
      !currentMultiplayerRoundQuestion
    ) {
      return;
    }

    setMultiplayerRoundSelected(option);
    const isCorrect = isCorrectAnswer(option, currentMultiplayerRoundQuestion.answer);
    const nextScore = isCorrect ? multiplayerRoundScore + 1 : multiplayerRoundScore;

    if (isCorrect) {
      setMultiplayerRoundScore(nextScore);
      playCorrectSound();
    } else {
      playWrongSound();
    }

    setTimeout(() => {
      if (multiplayerRoundIndex >= activeRoundQuestions.length - 1) {
        setMultiplayerRoundDone(true);
        submitMultiplayerRoundScore(nextScore);
      } else {
        setMultiplayerRoundIndex((value) => value + 1);
        setMultiplayerRoundSelected(null);
        setMultiplayerTimeLeft(MULTIPLAYER_TIME_LIMIT);
      }
    }, 850);
  };

  const submitMultiplayerRoundScore = async (scoreOverride = multiplayerRoundScore) => {
    if (!supabase || !activeRound?.id || !activeMatch?.id || !multiplayerPlayerSlot) {
      setMultiplayerError("Could not submit round");
      return;
    }

    if (isSubmittingRound || hasPlayerFinishedRound(activeRound, multiplayerPlayerSlot)) {
      setMultiplayerRoundOpen(false);
      setMultiplayerOpen(true);
      setMultiplayerStep("joined");
      return;
    }

    setIsSubmittingRound(true);
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const scoreField =
      multiplayerPlayerSlot === "player1" ? "player1_score" : "player2_score";
    const finishedField =
      multiplayerPlayerSlot === "player1"
        ? "player1_finished"
        : "player2_finished";

    const roundPatch = {
      [scoreField]: scoreOverride,
      [finishedField]: true,
    };

    const otherPlayerFinished =
      multiplayerPlayerSlot === "player1"
        ? Boolean(activeRound.player2_finished)
        : Boolean(activeRound.player1_finished);

    let winner = null;

    if (otherPlayerFinished) {
      const player1Score =
        multiplayerPlayerSlot === "player1"
          ? scoreOverride
          : activeRound.player1_score || 0;
      const player2Score =
        multiplayerPlayerSlot === "player2"
          ? scoreOverride
          : activeRound.player2_score || 0;

      if (player1Score > player2Score) winner = activeMatch.player1_username;
      if (player2Score > player1Score) winner = activeMatch.player2_username;
      if (player1Score === player2Score) winner = "draw";

      roundPatch.winner = winner;
      roundPatch.status = "finished";
    }

    const { data: updatedRound, error: roundError } = await supabase
      .from("multiplayer_rounds")
      .update(roundPatch)
      .eq("id", activeRound.id)
      .select()
      .single();

    if (roundError || !updatedRound) {
      setMultiplayerLoading(false);
      setIsSubmittingRound(false);
      setMultiplayerError("Could not submit round");
      return;
    }

    let matchPatch = {
      updated_at: new Date().toISOString(),
    };

    if (otherPlayerFinished) {
      // Next chooser rule: the player who submits second chooses the next
      // category, which keeps async play moving without requiring both players
      // to be online together.
      matchPatch = {
        ...matchPatch,
        phase: "round_finished",
        current_turn: username,
        current_turn_id: playerId,
      };

      if (winner === activeMatch.player1_username) {
        matchPatch.player1_wins = (activeMatch.player1_wins || 0) + 1;
      }

      if (winner === activeMatch.player2_username) {
        matchPatch.player2_wins = (activeMatch.player2_wins || 0) + 1;
      }

      updateProgressionStats((stats) => {
        let nextStats = addStat(stats, "h2h_matches_completed", 1);
        if (winner === username) {
          nextStats = addStat(nextStats, "h2h_wins", 1);
        }
        return nextStats;
      });
      awardXp({
        key: `h2h-complete:${activeRound.id}`,
        amount: 50,
        label: "H2H complete",
      });
      if (winner === username) {
        awardXp({
          key: `h2h-win:${activeRound.id}`,
          amount: 100,
          label: "H2H win",
        });
      }
    }

    let updatedMatch = activeMatch;

    if (Object.keys(matchPatch).length > 0) {
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .update(matchPatch)
        .eq("id", activeMatch.id)
        .select()
        .single();

      if (matchError || !matchData) {
        setMultiplayerLoading(false);
        setIsSubmittingRound(false);
        setMultiplayerError("Round saved, but match update failed");
        return;
      }

      updatedMatch = matchData;
    }

    setMultiplayerLoading(false);
    setIsSubmittingRound(false);
    setMultiplayerNotice("Score submitted");
    setActiveRound(updatedRound);
    setMatchRounds((rounds) => [
      updatedRound,
      ...rounds.filter((round) => round.id !== updatedRound.id),
    ]);
    setActiveMatch(updatedMatch);
    setMultiplayerRoundOpen(false);
    setMultiplayerOpen(true);
    setMultiplayerStep("joined");
  };

  const startDailyChallenge = () => {
    if (dailyPlayed) return;

    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setGameMode("daily-list");
    setFoundAnswers([]);
    setDailyInput("");
    setDailySelectedPlayer(null);
    setDailyCoinsEarned(0);
    setDailyReveal(null);
    setDailyCelebratedAnswer(null);
    setIsRevealing(false);
    setQuestionIndex(0);
    setSelected(null);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
    setRevivesUsed(0);
    setRewardPopup(null);
    setWrongPopup(null);
    setStreakRewardEarned(0);
    awardXp({
      key: `daily-play:${getDailyDateKey()}`,
      amount: 25,
      label: "Daily played",
    });
    setGameStarted(true);
  };

  const restart = () => {
    setGameStarted(false);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setCoinsMenuOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setMultiplayerStep("menu");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode("");
    setJoinRoomCode("");
    setMultiplayerError("");
    setMultiplayerLoading(false);
    setGameMode("general");

    setQuestions(buildGameQuestions("general"));
    setQuestionIndex(0);

    setSelected(null);
    setTextAnswer("");
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
    setRevivesUsed(0);

    setRewardPopup(null);
    setWrongPopup(null);

    setFoundAnswers([]);
    setDailyInput("");
    setDailyCoinsEarned(0);
    setDailyReveal(null);
    setDailyCelebratedAnswer(null);
    setIsRevealing(false);
    setWhoAmIQuestions([]);
    setWhoAmIIndex(0);
    setWhoAmIClueIndex(0);
    setWhoAmIInput("");
    setWhoAmIScore(0);
    setWhoAmIStreak(0);
    setWhoAmILives(3);
    setWhoAmIFeedback(null);
    setWhoAmIShake(0);
    setWhoAmIGameOver(false);
  };

  const nextQuestion = () => {
    setQuestionIndex((i) => (i + 1) % questions.length);
    setSelected(null);
    setTextAnswer("");
  };

  const getRewardForScore = (newScore) => {
    if (newScore % 50 === 0) return 1500;
    if (newScore % 30 === 0) return 200;
    if (newScore % 20 === 0) return 50;
    if (newScore % 10 === 0) return 25;
    if (newScore % 5 === 0) return 25;
    return 0;
  };

  const handleWrongAnswer = (correctAnswer, message = "Wrong") => {
    setStreak(0);

    const newLives = Math.max(lives - 1, 0);
    setLives(newLives);

    setWrongPopup({
      answer: correctAnswer,
      message,
    });

    playWrongSound();

    if (newLives <= 0) {
      setSelected(correctAnswer);
      if (isMockMultiplayer) {
        setMockOpponentScore(createMockOpponentScore(score));
      }

      setTimeout(() => {
        setWrongPopup(null);
        setFinished(true);
      }, 1500);
    } else {
      setTimeout(() => {
        setWrongPopup(null);
        nextQuestion();
      }, 1200);
    }
  };

  const chooseAnswer = (option) => {
    if (selected || rewardPopup || wrongPopup) return;

    setSelected(option);

    if (isCorrectAnswer(option, current.answer)) {
      const newScore = score + 1;
      const newStreak = streak + 1;
      const reward = getRewardForScore(newScore);

      setScore(newScore);
      setStreak(newStreak);

      // TODO: add separate Supabase leaderboards per mode later. For now
      // profiles.best_score is the All Time General Knowledge leaderboard.
      if (gameMode === "general" && !isMockMultiplayer && newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem("footballQuizHighScore", String(newScore));
        updateProgressionStats((stats) =>
          maxStat(stats, "best_general_score", newScore)
        );
      }

      if (gameMode === "general" && !isMockMultiplayer) {
        if (awardXp({
          key: `general-correct:${Date.now()}:${questionIndex}:${newScore}`,
          amount: 5,
          label: "Correct answer",
          placement: "inline",
        })) {
          setGeneralRunXpSummary((summary) => ({
            ...summary,
            correct: summary.correct + 5,
          }));
        }

        if (newStreak === 5) {
          if (awardXp({
            key: `general-streak-5:${Date.now()}:${newScore}`,
            amount: 10,
            label: "Streak Bonus",
            placement: "inline",
          })) {
            setGeneralRunXpSummary((summary) => ({
              ...summary,
              streak: summary.streak + 10,
            }));
          }
        }
        if (newStreak === 10) {
          if (awardXp({
            key: `general-streak-10:${Date.now()}:${newScore}`,
            amount: 25,
            label: "Streak Bonus",
            placement: "inline",
          })) {
            setGeneralRunXpSummary((summary) => ({
              ...summary,
              streak: summary.streak + 25,
            }));
          }
        }
        if (newStreak === 20) {
          if (awardXp({
            key: `general-streak-20:${Date.now()}:${newScore}`,
            amount: 75,
            label: "Streak Bonus",
            placement: "inline",
          })) {
            setGeneralRunXpSummary((summary) => ({
              ...summary,
              streak: summary.streak + 75,
            }));
          }
        }
      }

      if (reward > 0) {
        const newCoins = coins + reward;
        saveCoins(newCoins);

        setRewardPopup({
          streak: newStreak,
          coins: reward,
          onCollect: "next-question",
        });

        playCorrectSound();
      } else {
        playCorrectSound();
        setTimeout(nextQuestion, 950);
      }
    } else {
      handleWrongAnswer(current.answer);
    }
  };

  const finishDaily = (found, earned) => {
    const streakInfo = awardDailyStreakBonus();
    const totalEarned = earned + streakInfo.reward;

    updateProgressionStats((stats) => ({
      ...addStat(stats, "daily_challenges_completed", 1),
      best_daily_score: Math.max(Number(stats.best_daily_score) || 0, found),
    }));
    awardXp({
      key: `daily-complete:${getDailyDateKey()}`,
      amount: 100,
      label: "Daily complete",
    });

    markDailyAsPlayed(found, totalEarned, streakInfo);

    setTimeout(() => {
      setFinished(true);
    }, 700);
  };

  const checkDailyAnswer = (playerOverride = null) => {
    const guessedPlayer = playerOverride || dailySelectedPlayer;
    const guessText = guessedPlayer?.name || dailyInput.trim();
    if (!guessText || rewardPopup || wrongPopup || isRevealing) return;

    setDailyCelebratedAnswer(null);

    const matchedAnswer = todayChallenge.answers.find((answer) =>
      isCorrectPlayerAnswer(guessedPlayer, answer) ||
      isCorrectAnswer(guessText, answer)
    );

    if (matchedAnswer && !foundAnswers.includes(matchedAnswer)) {
      const rank = todayChallenge.answers.indexOf(matchedAnswer) + 1;
      const rewardPerCorrect = 15;

      setDailyInput("");
      setDailySelectedPlayer(null);
      setIsRevealing(true);

      let displayRank = todayChallenge.answers.length;

      setDailyReveal({
        type: "correct",
        phase: "scan",
        answer: matchedAnswer,
        rank,
        displayRank,
      });

      const interval = setInterval(() => {
        displayRank -= 1;

        if (displayRank <= rank) {
          clearInterval(interval);

          setDailyReveal({
            type: "correct",
            phase: "result",
            answer: matchedAnswer,
            rank,
            displayRank: rank,
          });

          setTimeout(() => {
            const newFoundAnswers = [...foundAnswers, matchedAnswer];
            const newScore = score + 1;
            const newCoins = coins + rewardPerCorrect;
            const newDailyCoinsEarned = dailyCoinsEarned + rewardPerCorrect;

            setFoundAnswers(newFoundAnswers);
            setDailyCelebratedAnswer(matchedAnswer);
            setScore(newScore);
            setDailyCoinsEarned(newDailyCoinsEarned);
            saveCoins(newCoins);
            awardXp({
              key: `daily-found:${getDailyDateKey()}:${getAnswerKey(matchedAnswer, rank)}`,
              amount: 10,
              label: "Daily answer",
            });
            playCorrectSound();

            setDailyReveal(null);
            setIsRevealing(false);
            setTimeout(() => {
              setDailyCelebratedAnswer(null);
            }, 900);

            if (newFoundAnswers.length === todayChallenge.answers.length) {
              finishDaily(newFoundAnswers.length, newDailyCoinsEarned);
            }
          }, 900);
        } else {
          setDailyReveal({
            type: "correct",
            phase: "scan",
            answer: matchedAnswer,
            rank,
            displayRank,
          });
        }
      }, DAILY_SCAN_STEP_MS);
    } else {
      const newLives = Math.max(lives - 1, 0);
      const wrongMessage = matchedAnswer
        ? "Already guessed"
        : "Not in today’s Top 10";

      setLives(newLives);
      setDailyInput("");
      setDailySelectedPlayer(null);
      setIsRevealing(true);

      let displayRank = todayChallenge.answers.length;

      setDailyReveal({
        type: "wrong",
        phase: "scan",
        answer: wrongMessage,
        rank: 0,
        displayRank,
      });

      const interval = setInterval(() => {
        displayRank -= 1;

        if (displayRank <= 0) {
          clearInterval(interval);

          setDailyReveal({
            type: "wrong",
            phase: "result",
            answer: wrongMessage,
            rank: 0,
            displayRank: 0,
          });

          setTimeout(() => {
            setDailyReveal(null);
            setIsRevealing(false);
            setWrongPopup({
              answer: wrongMessage,
            });
            playWrongSound();

            if (newLives <= 0) {
              setTimeout(() => {
                setWrongPopup(null);
                finishDaily(foundAnswers.length, dailyCoinsEarned);
              }, 1400);
            } else {
              setTimeout(() => {
                setWrongPopup(null);
              }, 1200);
            }
          }, 260);
        } else {
          setDailyReveal({
            type: "wrong",
            phase: "scan",
            answer: wrongMessage,
            rank: 0,
            displayRank,
          });
        }
      }, DAILY_SCAN_STEP_MS);
    }
  };

  const collectReward = () => {
    const action = rewardPopup?.onCollect;
    setRewardPopup(null);
    playCoinSound();

    if (action === "next-question") {
      nextQuestion();
    }

    if (action === "finish") {
      setFinished(true);
    }
  };

  const revive = () => {
    if (!reviveCost || revivesUsed >= 3 || coins < reviveCost) return;

    const newCoins = coins - reviveCost;
    saveCoins(newCoins);

    setLives(1);
    setRevivesUsed((r) => r + 1);
    setFinished(false);
    setSelected(null);
  };

  const submitTextAnswer = () => {
    if ((!textAnswer.trim() && !careerSelectedPlayer) || selected) return;

    const submittedAnswer =
      gameMode === "career" &&
      careerSelectedPlayer &&
      isCorrectPlayerAnswer(careerSelectedPlayer, current?.answer)
        ? current.answer
        : careerSelectedPlayer?.name || textAnswer;

    chooseAnswer(submittedAnswer);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
  };

  const openCoinShop = () => {
    playClickSound();
    setCoinShopNotice("");
    setCoinsMenuOpen(true);
  };

  const openDailyRewardMeter = () => {
    playClickSound();
    setDailyRewardMeterOpen(true);
  };

  const openLevelModal = () => {
    playClickSound();
    setLevelModalOpen(true);
  };

  const coinShopModal = (
    <AnimatePresence>
      {coinsMenuOpen && (
        <motion.div
          className="coin-shop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="coin-shop-card"
            initial={{ scale: 0.86, y: 28 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 170, damping: 15 }}
          >
            <div className="coin-shop-coin">🪙</div>
            <h2 className="coin-shop-title">Coin Shop</h2>

            <div className="coin-shop-balance">
              <span>Current coins</span>
              <strong>🪙 {coins}</strong>
            </div>

            <div className="coin-shop-options">
              <div className="coin-shop-option featured">
                <div>
                  <strong>Earn coins</strong>
                  <small>Play quizzes, daily challenges and streaks</small>
                </div>
                <button onClick={() => setCoinsMenuOpen(false)}>Play</button>
                <em>No purchases needed</em>
              </div>

              <div className="coin-shop-option">
                <div>
                  <strong>Extra lives</strong>
                  <small>Use coins after game over</small>
                </div>
                <button onClick={() => setCoinsMenuOpen(false)}>Got it</button>
                <em>Revives start at 500 coins</em>
              </div>
            </div>

            <p className="coin-shop-note">
              Keep playing to build your coin balance.
              {coinShopNotice && <span> • {coinShopNotice}</span>}
            </p>

            <button
              className="coin-shop-close"
              onClick={() => {
                playClickSound();
                setCoinsMenuOpen(false);
              }}
            >
              CLOSE
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const coinRewardToastOverlay = (
    <AnimatePresence>
      {coinRewardToast && (
        <motion.div
          className="coin-reward-toast"
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.96 }}
          transition={{ duration: 0.22 }}
        >
          <span>🪙</span>
          <div>
            <strong>+{coinRewardToast.amount} coins</strong>
            <small>{coinRewardToast.title}</small>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const xpToastOverlay = (
    <AnimatePresence>
      {xpToast && xpToast.placement !== "inline" && (
        <motion.div
          className="xp-reward-toast"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <span>XP</span>
          <div>
            <strong>+{xpToast.amount} XP</strong>
            <small>{xpToast.label || "Progress earned"}</small>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const objectiveProgressModal = (
    <AnimatePresence>
      {objectiveProgressUpdate && (
        <motion.div
          className="objective-progress-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="objective-progress-card"
            initial={{ opacity: 0, y: 26, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 190, damping: 16 }}
          >
            <div className="objective-progress-kicker">Objective updated</div>
            <h2>{objectiveProgressUpdate.levelName}</h2>

            <div className="objective-progress-list">
              {objectiveProgressUpdate.updates.map((objective) => (
                <div
                  className={`objective-progress-row ${
                    objective.complete ? "complete" : ""
                  }`}
                  key={objective.statKey}
                >
                  <div className="objective-progress-row-top">
                    <strong>{objective.label}</strong>
                    <span>
                      {objective.before.toLocaleString()} →{" "}
                      {objective.after.toLocaleString()} /{" "}
                      {objective.required.toLocaleString()}
                    </span>
                  </div>

                  <div className="objective-progress-bar">
                    <motion.div
                      className="objective-progress-fill"
                      initial={{ width: `${objective.beforeProgress}%` }}
                      animate={{ width: `${objective.afterProgress}%` }}
                      transition={{ delay: 0.18, duration: 0.62, ease: "easeOut" }}
                    />
                  </div>

                  {objective.newlyCompleted && (
                    <motion.div
                      className="objective-progress-complete"
                      initial={{ opacity: 0, y: 8, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.45, duration: 0.22 }}
                    >
                      ✓ Completed
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {objectiveProgressUpdate.allComplete && (
              <div className="objective-progress-all-complete">
                All objectives complete. Level up incoming.
              </div>
            )}

            <button
              className="objective-progress-button"
              onClick={() => {
                playClickSound();
                setObjectiveProgressUpdate(null);
              }}
            >
              CONTINUE
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const dailyRewardTargetDay = dailyPlayed
    ? Math.max(1, dailyStreak)
    : Math.max(1, dailyStreak + 1);
  const dailyRewardRoadDays = getStreakRoadDays(dailyRewardTargetDay);
  const nextDailyReward = getNextStreakRewardInfo(dailyStreak, dailyPlayed);

  const dailyRewardMeterModal = (
    <AnimatePresence>
      {dailyRewardMeterOpen && (
        <motion.div
          className="daily-reward-view-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="daily-reward-popup daily-reward-view-card"
            initial={{ opacity: 0, scale: 0.84, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: "spring", stiffness: 170, damping: 14 }}
          >
            <div className="daily-reward-top">
              <div className="daily-reward-fire">🔥</div>

              <div>
                <div className="daily-reward-title">Daily Streak</div>
                <div className="daily-reward-subtitle">
                  {dailyStreak} day{dailyStreak === 1 ? "" : "s"} strong
                </div>
              </div>
            </div>

            <div className="daily-reward-earned">
              <span>{dailyPlayed ? "Today completed" : "Today waiting"}</span>
              <strong>{dailyPlayed ? "✅ Reward locked in" : "🎯 Play Daily Challenge"}</strong>
            </div>

            <div className="daily-reward-road">
              <div
                className="daily-reward-road-fill"
                style={{
                  width: `${
                    ((Math.min(7, ((dailyRewardTargetDay - 1) % 7) + 1) - 1) /
                      6) *
                    86
                  }%`,
                }}
              />
              {dailyRewardRoadDays.map((day) => {
                const reached = dailyStreak >= day.day;
                const currentDay = dailyRewardTargetDay === day.day;

                return (
                  <motion.div
                    key={day.day}
                    className={`daily-reward-day ${reached ? "reached" : ""} ${
                      currentDay ? "current" : ""
                    }`}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: currentDay ? 1.06 : 1 }}
                    transition={{ delay: day.dayInRoad * 0.035, duration: 0.22 }}
                  >
                    <div className="daily-reward-ball">
                      {reached ? "✅" : currentDay ? "🔥" : "⚽"}
                    </div>

                    <div className="daily-reward-day-label">
                      Day {day.day}
                    </div>

                    <div className="daily-reward-day-coins">
                      +{day.reward}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="daily-reward-next">
              Next reward: Day {nextDailyReward.day} • +{nextDailyReward.reward} coins
            </div>

            <button
              className="daily-reward-claim"
              onClick={() => {
                playClickSound();
                setDailyRewardMeterOpen(false);
              }}
            >
              CLOSE
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const levelProgressModal = (
    <AnimatePresence>
      {levelModalOpen && (
        <motion.div
          className="level-progress-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`level-progress-card level-${playerLevel.color}`}
            initial={{ opacity: 0, scale: 0.86, y: 34 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
          >
            <button
              className="level-progress-close"
              onClick={() => {
                playClickSound();
                setLevelModalOpen(false);
              }}
              aria-label="Close level progress"
            >
              <X size={22} />
            </button>

            <div className="level-progress-hero">
              <div className="level-progress-icon">{playerLevel.emoji}</div>
              <div>
                <div className="level-progress-label">
                  Level {playerLevel.levelNumber}
                </div>
                <h2>{playerLevel.name}</h2>
                <p>{xpTotal.toLocaleString()} XP earned</p>
              </div>
            </div>

            <div className="level-progress-track">
              <div
                className="level-progress-fill"
                style={{ width: `${progressionView.objectiveProgress}%` }}
              />
            </div>

            <div className="level-progress-next">
              {playerLevel.next ? (
                <>
                  <strong>{levelObjectiveSummary} ready</strong>
                  <span>
                    Next: {playerLevel.next.emoji} {playerLevel.next.name}
                  </span>
                </>
              ) : (
                <>
                  <strong>Legend status reached</strong>
                  <span>You are at the top of Ball Knowledge.</span>
                </>
              )}
            </div>

            <div className="level-objective-list">
              {progressionView.objectives.map((objective) => (
                <div
                  className={`level-objective-item ${
                    objective.complete ? "complete" : ""
                  }`}
                  key={`${objective.type}-${objective.statKey}`}
                >
                  <div className="level-objective-status">
                    {objective.complete ? "✓" : "•"}
                  </div>

                  <div className="level-objective-body">
                    <div className="level-objective-top">
                      <strong>{objective.label}</strong>
                      <span>
                        {Math.min(objective.current, objective.required).toLocaleString()} /{" "}
                        {objective.required.toLocaleString()}
                      </span>
                    </div>

                    <div className="level-objective-track">
                      <div
                        className="level-objective-fill"
                        style={{ width: `${objective.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="level-progress-action"
              onClick={() => {
                playClickSound();
                setLevelModalOpen(false);
              }}
            >
              KEEP CLIMBING
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const avatarPickerModal = (
    <AnimatePresence>
      {avatarPickerOpen && (
        <motion.div
          className="avatar-picker-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="avatar-picker-card"
            initial={{ opacity: 0, scale: 0.86, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
          >
            <div className="avatar-picker-top">
              <div>
                <strong>Avatar Builder</strong>
                <span>Build your match identity</span>
              </div>

              <button
                onClick={() => {
                  playClickSound();
                  setAvatarPickerOpen(false);
                }}
                aria-label="Close avatar picker"
              >
                <X size={20} />
              </button>
            </div>

            <div className="avatar-builder-preview">
              <PlayerAvatar
                profile={{
                  avatar_icon: avatarBuilderPreview.icon,
                  avatar_style: avatarBuilderPreview.style,
                  avatar_color: avatarBuilderPreview.color,
                  avatar_bg: avatarBuilderPreview.bg,
                }}
                size="large"
              />
              <div>
                <strong>{displayName || "Player"}</strong>
                <span>
                  {avatarBuilderPreview.style} • {avatarBuilderPreview.color}
                </span>
              </div>
            </div>

            <div className="avatar-builder-section">
              <strong>Icon</strong>
              <div className="avatar-picker-grid">
                {AVATAR_ICON_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className={emoji === avatarBuilderPreview.icon ? "selected" : ""}
                    onClick={() => updateAvatarDraft({ icon: emoji })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="avatar-builder-section">
              <strong>Color</strong>
              <div className="avatar-token-grid color-grid">
                {AVATAR_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    className={`avatar-token avatar-color-${color.value} ${
                      color.value === avatarBuilderPreview.color ? "selected" : ""
                    }`}
                    onClick={() => updateAvatarDraft({ color: color.value })}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="avatar-builder-section">
              <strong>Background</strong>
              <div className="avatar-token-grid">
                {AVATAR_BG_OPTIONS.map((bg) => (
                  <button
                    key={bg.value}
                    className={`avatar-token ${
                      bg.value === avatarBuilderPreview.bg ? "selected" : ""
                    }`}
                    onClick={() => updateAvatarDraft({ bg: bg.value })}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="avatar-builder-section">
              <strong>Style</strong>
              <div className="avatar-token-grid">
                {AVATAR_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.value}
                    className={`avatar-token ${
                      style.value === avatarBuilderPreview.style ? "selected" : ""
                    }`}
                    onClick={() => updateAvatarDraft({ style: style.value })}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {avatarNotice && <div className="avatar-builder-notice">{avatarNotice}</div>}

            <div className="avatar-builder-actions">
              <button
                type="button"
                className="avatar-builder-cancel"
                onClick={() => {
                  playClickSound();
                  setAvatarPickerOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="avatar-builder-save"
                onClick={saveAvatarBuilder}
              >
                Save Avatar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  useEffect(() => {
    if (!username) return;

    ensureOnlineProfile(username);
  }, [username, playerId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || socialProfileIds.length === 0) {
      return;
    }

    const missingIds = socialProfileIds.filter(
      (id) => id !== playerId && !profileLookup[id]
    );

    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadSocialProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", missingIds);

      if (cancelled) return;

      if (error) {
        console.error("Could not load player avatars", error);
        return;
      }

      setProfileLookup((currentLookup) => {
        const nextLookup = { ...currentLookup };

        (data || []).forEach((row) => {
          nextLookup[row.id] = row;
        });

        return nextLookup;
      });
    };

    loadSocialProfiles();

    return () => {
      cancelled = true;
    };
  }, [socialProfileIds, profileLookup, playerId]);

  useEffect(() => {
    if (!username || profileStatus !== "ready" || !isSupabaseConfigured || !supabase) {
      return;
    }

    const syncTimer = window.setTimeout(async () => {
      const { profile: updatedProfile, error } = await syncLocalStatsToProfile(
        supabase,
        playerId,
        { highScore, coins, dailyStreak }
      );

      if (error) {
        console.error("Could not sync local stats to profile", error);
        setProfileStatus("error");
        setProfileError(getProfileErrorMessage(error));
        return;
      }

      setProfile((currentProfile) => ({
        ...(currentProfile || {}),
        ...(updatedProfile || {}),
      }));
      setProfileStatus("ready");
      setProfileError("");
    }, 700);

    return () => window.clearTimeout(syncTimer);
  }, [username, profileStatus, playerId, highScore, coins, dailyStreak]);

  useEffect(() => {
    if (!profileOpen || !username || !isSupabaseConfigured || !supabase) return;

    fetchActiveGames({ silent: true });
  }, [profileOpen, username, playerId]);

  useEffect(() => {
    if (!leaderboardOpen) return;

    loadGeneralLeaderboard();
  }, [leaderboardOpen, playerId, highScore]);

  useEffect(() => {
    if (
      !activeRound ||
      activeRound.status !== "finished" ||
      !activeRound.winner ||
      !activeMatch ||
      !username
    ) {
      return;
    }

    recordMultiplayerRoundResult(activeRound, activeMatch);
  }, [activeRound?.id, activeRound?.status, activeRound?.winner, activeMatch?.id, username]);

  // TODO Supabase multiplayer foundation:
  // Add profiles/users table, matches table, match_players table,
  // match_rounds or match_questions table, submitted answers/scores,
  // match status values: waiting, active, finished, room code lookup,
  // and realtime updates or polling for opponent state.
  // TODO production multiplayer:
  // Add realtime subscriptions instead of manual Refresh, real user accounts,
  // server-side score validation to prevent cheating, friend list/rematch,
  // and push notifications when it is your turn.
  // TODO production profiles:
  // Add Supabase Auth / real login, secure RLS policies, spoofing protection,
  // friend system, user search, push notifications, and cross-device cloud save.
  // TODO App Store release:
  // Add Capacitor/iOS build, app icon, splash screen, privacy policy,
  // App Store screenshots, real rewarded ads, Apple In-App Purchases,
  // Supabase Auth, secure RLS policies, push notifications, and
  // anti-cheat/server-side validation.
  // TODO Career Path:
  // Future: add optional multiple-choice Career Path mode.

  const handleResultButton = (isDaily) => {
    if (isDaily) {
      restart();
      setShowDailyCompletePopup(true);
    } else {
      restart();
    }
  };

  if (!username) {
    return (
      <div
        className="fullscreen-bg daily-list-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.08), rgba(0,0,0,0.48)), url(${stadiumBg})`,
        }}
      >
        <div className="name-screen">
          <motion.div
            className="name-card"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 13 }}
          >
            <div className="name-ball">⚽</div>

            <h1 className="name-title">Choose your player name</h1>

            <p className="name-subtitle">
              Your name will show on your profile and future leaderboards.
            </p>

            <input
              className="name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveUsername();
              }}
              placeholder="ball.knowledge"
              maxLength={16}
              autoFocus
            />

            <button className="name-save-button" onClick={saveUsername}>
              START PLAYING
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (leagueChallengeOpen && activeLeague && activeLeagueDay) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.58)), url(${stadiumBg})`,
        }}
      >
        <button className="multiplayer-round-back" onClick={closeLeagueChallenge}>
          ← League
        </button>

        <ScreenTransition className="league-challenge-screen">
          {leagueChallengePhase === "intro" && (
            <div className="league-challenge-card">
              <div className="league-kicker">🏆 Daily League</div>
              <h1>{leagueDayLabel} Challenge</h1>
              <p>
                Max {leagueSettings.maxDailyPoints} points: {leagueDailyStructureText}.
              </p>
              <button onClick={startLeagueQuiz}>Start</button>
            </div>
          )}

          {leagueChallengePhase === "quiz" && currentLeagueQuizQuestion && (
            <div className="league-challenge-card">
              <div className="league-quiz-top">
                <span>
                  Question {leagueQuizIndex + 1}/{leagueSettings.quizCount}
                </span>
                <strong className={leagueTimeLeft <= 3 ? "danger" : ""}>
                  ⏱ {leagueTimeLeft}s
                </strong>
                <span>
                  {leagueQuizScore}/{leagueSettings.quizCount}
                </span>
              </div>

              <h2>{currentLeagueQuizQuestion.question}</h2>

              <div className="league-answer-grid">
                {currentLeagueQuizQuestion.options.map((option) => {
                  const isCorrect = option === currentLeagueQuizQuestion.answer;
                  const isChosen = leagueQuizSelected === option;
                  const showCorrect = leagueQuizSelected && isCorrect;
                  const showWrong = leagueQuizSelected && isChosen && !isCorrect;

                  return (
                    <button
                      key={option}
                      className={`${showCorrect ? "correct" : ""} ${
                        showWrong ? "wrong" : ""
                      }`}
                      disabled={Boolean(leagueQuizSelected)}
                      onClick={() => chooseLeagueQuizAnswer(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {leagueChallengePhase === "top10" && leagueTop10Challenge && (
            <div className="league-challenge-card league-top10-card">
              <div className="league-kicker">Top 10</div>
              <h1>{leagueTop10Challenge.label}</h1>
              <p>{leagueTop10Challenge.question}</p>

              <div className="league-score-strip">
                {leagueSettings.quizCount > 0 && (
                  <span>
                    Quiz: {leagueQuizScore}/{leagueSettings.quizCount}
                  </span>
                )}
                <span>
                  Top 10 {leagueTop10Index + 1}/{leagueSettings.top10Count}:{" "}
                  {leagueTop10Score}/10
                </span>
                <span>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        index >= leagueTop10Lives ? "league-life-used" : ""
                      }
                    >
                      ❤️
                    </span>
                  ))}
                </span>
                <strong>
                  Total: {leagueQuizScore + leagueTop10TotalWithCurrent + leagueWhoAmIScore}/
                  {leagueSettings.maxDailyPoints}
                </strong>
              </div>

              <AnimatePresence>
                {leagueTop10Reveal && (
                  <motion.div
                    className={`league-rank-reveal ${leagueTop10Reveal.type}`}
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <span>
                      {leagueTop10Reveal.type === "correct"
                        ? "FOUND"
                        : leagueTop10Reveal.type === "wrong"
                        ? "NOT FOUND"
                        : leagueTop10Reveal.type === "already"
                        ? "ALREADY FOUND"
                        : "SCANNING"}
                    </span>
                    <strong>
                      {leagueTop10Reveal.displayRank > 0
                        ? `#${leagueTop10Reveal.displayRank}`
                        : "OUT"}
                    </strong>
                    {leagueTop10Reveal.type === "correct" && (
                      <em>{formatAnswerWithValue(leagueTop10Reveal.answer)}</em>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="league-top10-list">
                {leagueTop10Challenge.answers.map((answer, index) => {
                  const found = leagueTop10Found.includes(answer);
                  const rank = index + 1;
                  const isScanning =
                    leagueTop10Reveal?.phase === "scan" &&
                    leagueTop10Reveal.displayRank === rank;
                  const isRevealTarget =
                    leagueTop10Reveal?.type === "correct" &&
                    leagueTop10Reveal.rank === rank;

                  return (
                    <div
                      key={getAnswerKey(answer, index)}
                      className={`${found ? "found" : ""} ${
                        isScanning ? "scanning" : ""
                      } ${isRevealTarget ? "reveal-target" : ""}`}
                    >
                      <span>#{index + 1}</span>
                      <strong>{found ? formatAnswerWithValue(answer) : "?????"}</strong>
                    </div>
                  );
                })}
              </div>

              <GuessInput
                answerType={isLeagueTop10PlayerChallenge ? "player" : "text"}
                value={leagueTop10Input}
                onTextChange={setLeagueTop10Input}
                selectedPlayer={leagueTop10SelectedPlayer}
                onSelectPlayer={setLeagueTop10SelectedPlayer}
                onSubmit={submitLeagueTop10Answer}
                autoSubmitOnSelect
                placeholder={
                  isLeagueTop10PlayerChallenge
                    ? "Search and select player..."
                    : "Type answer..."
                }
                disabled={leagueTop10Scanning || leagueTop10Lives <= 0}
                buttonLabel={leagueTop10Scanning ? "Scanning..." : "Guess"}
                rowClassName="daily-input-row league-input-row"
                inputClassName="daily-list-input"
                buttonClassName="daily-submit-button"
                maxSuggestions={4}
                autoFocus
              />

            </div>
          )}

          {leagueChallengePhase === "top10-reveal" && leagueTop10Challenge && (
            <div className="league-challenge-card league-top10-card league-top10-reveal-card">
              <div className="league-kicker">Top 10 Reveal</div>
              <h1>{leagueTop10Challenge.label}</h1>
              <p>
                {leagueTop10Score}/10 found. Review the list, then keep climbing.
              </p>

              <div className="league-top10-reveal-list">
                {leagueTop10Challenge.answers.map((answer, index) => {
                  const found = leagueTop10Found.includes(answer);

                  return (
                    <motion.div
                      key={getAnswerKey(answer, index)}
                      className={`league-top10-reveal-row ${
                        found ? "found" : "missed"
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.035 }}
                    >
                      <span>#{index + 1}</span>
                      <strong>{getAnswerLabel(answer)}</strong>
                      <em>{getAnswerValue(answer) || "-"}</em>
                      <small>{found ? "Found" : "Missed"}</small>
                    </motion.div>
                  );
                })}
              </div>

              <button
                className="league-reveal-continue-button"
                onClick={() => advanceAfterLeagueTop10(leagueTop10Found.length)}
              >
                {leagueTop10Index < leagueTop10Challenges.length - 1
                  ? "Next Top 10"
                  : leagueSettings.whoamiCount > 0
                  ? "Next Section"
                  : leagueSettings.findPlayerCount > 0
                  ? "Next Section"
                  : "See Results"}
              </button>
            </div>
          )}

          {leagueChallengePhase === "whoami" && currentLeagueWhoAmI && (
            <div className="league-challenge-card league-whoami-card">
              <div className="league-kicker">Who Am I?</div>
              <h1>Mystery Player</h1>

              <div className="league-score-strip">
                {leagueSettings.quizCount > 0 && (
                  <span>
                    Quiz: {leagueQuizScore}/{leagueSettings.quizCount}
                  </span>
                )}
                {leagueSettings.top10Count > 0 && (
                  <span>
                    Top 10: {leagueTop10TotalWithCurrent}/{leagueSettings.top10Count * 10}
                  </span>
                )}
                <span>
                  Who Am I: {leagueWhoAmIScore}/{leagueWhoAmIMaxPoints}
                </span>
                <strong>
                  Player {leagueWhoAmIIndex + 1}/{leagueSettings.whoamiCount}
                </strong>
              </div>

              <motion.div
                className={`league-whoami-panel ${leagueWhoAmIShake ? "shake" : ""}`}
                animate={leagueWhoAmIShake ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.28 }}
              >
                <div className="whoami-mystery-icon">?</div>
                <div className="whoami-clue-progress">
                  <span>Clue {leagueWhoAmIClueIndex + 1} / 10</span>
                  <strong>Worth {leagueWhoAmIPointsAvailable} points</strong>
                </div>

                <div className="whoami-clue-list">
                  {leagueWhoAmIVisibleClues.map((clue, index) => (
                    <motion.div
                      key={`${currentLeagueWhoAmI.id}-${index}`}
                      className={`whoami-clue ${
                        index === leagueWhoAmIClueIndex ? "latest" : ""
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {clue}
                    </motion.div>
                  ))}
                </div>

                {leagueWhoAmIFeedback && (
                  <div className={`whoami-feedback ${leagueWhoAmIFeedback.type}`}>
                    {leagueWhoAmIFeedback.text}
                  </div>
                )}
              </motion.div>

              <GuessInput
                answerType="player"
                value={leagueWhoAmIInput}
                onTextChange={setLeagueWhoAmIInput}
                selectedPlayer={leagueWhoAmISelectedPlayer}
                onSelectPlayer={setLeagueWhoAmISelectedPlayer}
                onSubmit={submitLeagueWhoAmIAnswer}
                placeholder="Search player or type full name..."
                disabled={Boolean(leagueWhoAmIFeedback?.locked)}
                buttonLabel="Guess"
                rowClassName="daily-input-row league-input-row"
                inputClassName="daily-list-input"
                buttonClassName="daily-submit-button"
                maxSuggestions={4}
                autoFocus
              />
            </div>
          )}

          {leagueChallengePhase === "find-player" && currentLeagueFindPlayerTarget && (
            <div className="league-challenge-card find-player-card">
              <div className="league-kicker">Find the Player</div>
              <h1>Hidden Footballer</h1>

              <div className="league-score-strip">
                {leagueSettings.quizCount > 0 && (
                  <span>
                    Quiz: {leagueQuizScore}/{leagueSettings.quizCount}
                  </span>
                )}
                {leagueSettings.top10Count > 0 && (
                  <span>
                    Top 10: {leagueTop10TotalWithCurrent}/{leagueSettings.top10Count * 10}
                  </span>
                )}
                {leagueSettings.whoamiCount > 0 && (
                  <span>
                    Who Am I: {leagueWhoAmIScore}/{leagueWhoAmIMaxPoints}
                  </span>
                )}
                <span>
                  Find: {leagueFindPlayerScore}/{leagueFindPlayerMaxPoints}
                </span>
                <strong>
                  Player {leagueFindPlayerIndex + 1}/{leagueSettings.findPlayerCount}
                </strong>
              </div>

              <div className="find-player-mystery-card">
                <div className="whoami-mystery-icon">?</div>
                <div>
                  <span>Guesses: {leagueFindPlayerGuesses.length}</span>
                  <strong>{formatElapsedTime(leagueFindPlayerElapsed)}</strong>
                  {leagueFindPlayerRanking.poolSize > 0 && (
                    <small>{leagueFindPlayerRanking.poolSize} players ranked</small>
                  )}
                </div>
              </div>

              <div className="find-player-input-row">
                <PlayerPicker
                  value={leagueFindPlayerSelected}
                  onSelect={setLeagueFindPlayerSelected}
                  placeholder="Search exact player..."
                  compact
                  maxSuggestions={5}
                  disabled={
                    leagueFindPlayerFeedback.startsWith("Correct") ||
                    leagueFindPlayerFeedback.startsWith("Answer:")
                  }
                />
                <button
                  className="daily-submit-button"
                  onClick={submitLeagueFindPlayerGuess}
                  disabled={
                    !leagueFindPlayerSelected ||
                    leagueFindPlayerFeedback.startsWith("Answer:")
                  }
                >
                  Guess
                </button>
                <button
                  className="find-player-give-up-button"
                  onClick={giveUpLeagueFindPlayer}
                  type="button"
                  disabled={leagueFindPlayerFeedback.startsWith("Answer:")}
                >
                  Give Up
                </button>
              </div>

              {leagueFindPlayerFeedback && (
                <div className="whoami-feedback reveal">{leagueFindPlayerFeedback}</div>
              )}

              <div className="find-player-guesses">
                {leagueFindPlayerGuesses.map((guess) => (
                  <div
                    key={`${guess.player.id}-${guess.distance}`}
                    className={`find-player-guess ${guess.color} ${
                      guess.latest ? "latest" : ""
                    }`}
                  >
                    <div
                      className="find-player-bar-fill"
                      style={{ width: `${guess.barPercent || 12}%` }}
                    />
                    <div className="find-player-guess-content">
                      <div>
                        <strong>{guess.player.name}</strong>
                        <span>
                          {guess.player.nationality || "Unknown"} •{" "}
                          {guess.player.position_group || guess.player.position || "Unknown"}
                        </span>
                      </div>
                      <em>#{guess.rank || "?"}</em>
                    </div>
                    <small>
                      Rank #{guess.rank || "?"}
                      {guess.poolSize ? ` / ${guess.poolSize}` : ""} • {guess.label}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leagueChallengePhase === "complete" && leagueResult && (
            <div className="league-challenge-card league-complete-card">
              <div className="league-kicker">✅ Day Complete</div>
              <h1>
                {leagueResult.totalPoints}/{leagueSettings.maxDailyPoints} points
              </h1>
              <div className="league-result-grid">
                {leagueSettings.quizCount > 0 && (
                  <div>
                    <span>Quiz</span>
                    <strong>
                      {leagueResult.quizScore}/{leagueSettings.quizCount}
                    </strong>
                  </div>
                )}
                {leagueSettings.top10Count > 0 && (
                  <div>
                    <span>Top 10</span>
                    <strong>
                      {leagueResult.top10Score}/{leagueSettings.top10Count * 10}
                    </strong>
                  </div>
                )}
                {leagueSettings.whoamiCount > 0 && (
                  <div>
                    <span>Who Am I</span>
                    <strong>
                      {leagueResult.whoamiScore}/{leagueWhoAmIMaxPoints}
                    </strong>
                  </div>
                )}
                {leagueSettings.findPlayerCount > 0 && (
                  <div>
                    <span>Find the Player</span>
                    <strong>
                      {leagueResult.findPlayerScore}/{leagueFindPlayerMaxPoints}
                    </strong>
                    <small>
                      {leagueResult.findPlayerAttempts ?? 0} guesses •{" "}
                      {formatElapsedTime(leagueResult.findPlayerTimeSeconds ?? 0)}
                    </small>
                  </div>
                )}
              </div>
              <button onClick={closeLeagueChallenge}>Back to League</button>
            </div>
          )}
        </ScreenTransition>
      </div>
    );
  }

  if (multiplayerRoundOpen && currentMultiplayerRoundQuestion) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.58)), url(${quizBg})`,
        }}
      >
        <button
          className="multiplayer-round-back"
          onClick={() => submitMultiplayerRoundScore(multiplayerRoundScore)}
          disabled={isSubmittingRound || multiplayerLoading}
        >
          Save & Exit
        </button>

        <div className="multiplayer-round-card">
          <div className={`difficulty-pill ${getCategoryClass(activeRound?.category)}`}>
            Async Round {activeRound?.round_number || 1} •{" "}
            {getCategoryLabel(activeRound?.category)}
          </div>

          <div className="multiplayer-round-progress">
            Question {multiplayerRoundIndex + 1} / {activeRoundQuestions.length}
          </div>

          <div
            className={`multiplayer-timer ${
              multiplayerTimeLeft <= 3 ? "danger" : ""
            }`}
          >
            <span>⏱</span>
            <strong>{multiplayerTimeLeft}s</strong>
          </div>

          <div className="multiplayer-live-score">
            Score {multiplayerRoundScore}/5
          </div>

          <h1 className="question-title">
            {currentMultiplayerRoundQuestion.question}
          </h1>

          {multiplayerRoundSelected === MULTIPLAYER_TIMEOUT_VALUE && (
            <div className="multiplayer-timeup-card">Time's up!</div>
          )}

          <div className="answers-grid">
            {currentMultiplayerRoundQuestion.options.map((option) => {
              const isCorrect = isCorrectAnswer(
                option,
                currentMultiplayerRoundQuestion.answer
              );
              const isChosen = multiplayerRoundSelected === option;
              const showCorrect = multiplayerRoundSelected && isCorrect;
              const showWrong =
                multiplayerRoundSelected && isChosen && !isCorrect;

              return (
                <button
                  key={option}
                  onClick={() => chooseMultiplayerRoundAnswer(option)}
                  disabled={Boolean(multiplayerRoundSelected) || isSubmittingRound}
                  className={`answer-button ${
                    showCorrect ? "correct" : showWrong ? "wrong" : ""
                  }`}
                >
                  <span>{option}</span>
                  {showCorrect && <CheckCircle2 size={28} />}
                  {showWrong && <XCircle size={28} />}
                </button>
              );
            })}
          </div>

          {multiplayerRoundDone && (
            <div className="multiplayer-submit-card">
              <strong>{multiplayerRoundScore}/5</strong>
              <span>
                {isSubmittingRound || multiplayerLoading
                  ? "Submitting score..."
                  : "Score submitted"}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(0,0,0,0.34)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {levelProgressModal}
        {avatarPickerModal}
        {xpToastOverlay}
        {objectiveProgressModal}
        <AnimatePresence>
          {showDailyCompletePopup && lastDailyResult && (
            <motion.div
              className="daily-reward-popup"
              initial={{ opacity: 0, scale: 0.82, y: 35 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="daily-reward-top">
                <div className="daily-reward-fire">🔥</div>

                <div>
                  <div className="daily-reward-title">Daily Reward</div>

                  <div className="daily-reward-subtitle">
                    Day {lastDailyResult.streak} complete
                  </div>
                </div>
              </div>

              <motion.div
                className="daily-reward-main-ball daily-reward-chest"
                initial={{ rotate: -12, scale: 0.72, y: 18 }}
                animate={{
                  rotate: [0, -7, 7, 0],
                  scale: [1, 1.14, 1.03],
                  y: [12, -8, 0],
                }}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              >
                🎁
              </motion.div>

              <div className="daily-reward-earned">
                <span>Today you earned</span>
                <strong>🪙 +{lastDailyResult.coins}</strong>
              </div>

              {lastDailyResult.streakBonus > 0 && (
                <div className="daily-reward-bonus">
                  🔥 Streak bonus +{lastDailyResult.streakBonus}
                </div>
              )}

              <div className="daily-reward-road">
                <div
                  className="daily-reward-road-fill"
                  style={{
                    width: `${
                      ((Math.min(7, ((lastDailyResult.streak - 1) % 7) + 1) -
                        1) /
                        6) *
                      86
                    }%`,
                  }}
                />
                {getStreakRoadDays(lastDailyResult.streak).map((day) => {
                  const reached = lastDailyResult.streak >= day.day;
                  const currentDay = lastDailyResult.streak === day.day;
                  const previousReached =
                    (lastDailyResult.previousStreak || 0) >= day.day;

                  return (
                    <motion.div
                      key={day.day}
                      className={`daily-reward-day ${
                        reached ? "reached" : ""
                      } ${currentDay ? "current newly-lit" : ""}`}
                      initial={{
                        opacity: previousReached ? 1 : 0.58,
                        y: currentDay ? 12 : 0,
                        scale: previousReached ? 1 : 0.95,
                      }}
                      animate={{
                        opacity: reached ? 1 : 0.78,
                        y: currentDay ? -6 : 0,
                        scale: currentDay ? [1, 1.14, 1.06] : 1,
                      }}
                      transition={{
                        delay: day.dayInRoad * 0.055,
                        duration: currentDay ? 0.62 : 0.24,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <div className="daily-reward-ball">
                        {currentDay ? "🔥" : reached ? "✅" : "⚽"}
                      </div>

                      <div className="daily-reward-day-label">
                        Day {day.day}
                      </div>

                      <div className="daily-reward-day-coins">
                        +{day.reward}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="daily-reward-next">
                Next reward: Day{" "}
                {getNextStreakRewardInfo(lastDailyResult.streak, true).day} • +
                {getNextStreakRewardInfo(lastDailyResult.streak, true).reward} coins
              </div>

              <button
                className="daily-reward-claim"
                onClick={() => setShowDailyCompletePopup(false)}
              >
                CLAIM
              </button>
            </motion.div>
          )}
        </AnimatePresence><AnimatePresence>
  {levelUpPopup && isHomeScreen && (
    <motion.div
      className="level-up-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`level-up-card level-${levelUpPopup.newLevel.color}`}
        initial={{ scale: 0.72, y: 60, rotate: -3 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        exit={{ scale: 0.86, y: -30, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 170,
          damping: 12,
        }}
      >
        <motion.div
          className="level-up-burst"
          initial={{ scale: 0, rotate: 0 }}
          animate={{ scale: 1, rotate: 180 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          ✨
        </motion.div>

        <motion.div
          className="level-up-title"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12 }}
        >
          LEVEL UP!
        </motion.div>

        <div className="level-up-evolution multi">
          <motion.div
            className="level-up-icon old"
            initial={{ scale: 1, x: 0 }}
            animate={{ scale: [1, 0.88, 1], x: [-4, 0, -4] }}
            transition={{ duration: 0.7, repeat: 1 }}
          >
            {levelUpPopup.oldLevel.emoji}
          </motion.div>

          {levelUpPopup.unlockedLevels.map((level, index) => (
            <React.Fragment key={`${level.name}-${level.id}`}>
              <motion.div
                className="level-up-arrow"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.25 + index * 0.18,
                  type: "spring",
                  stiffness: 220,
                }}
              >
                →
              </motion.div>

              <motion.div
                className={`level-up-icon ${
                  index === levelUpPopup.unlockedLevels.length - 1
                    ? "new"
                    : "middle"
                }`}
                initial={{ scale: 0.2, rotate: -20, opacity: 0 }}
                animate={{
                  scale: [0.2, 1.22, 1],
                  rotate: [-20, 8, 0],
                  opacity: 1,
                }}
                transition={{
                  delay: 0.35 + index * 0.18,
                  duration: 0.5,
                  ease: "easeOut",
                }}
              >
                {level.emoji}
              </motion.div>
            </React.Fragment>
          ))}
        </div>

        <motion.div
          className="level-up-unlocked"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.68 }}
        >
          {levelUpPopup.newLevel.name}
        </motion.div>

        <motion.div
          className="level-up-subtitle"
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.82 }}
        >
          {levelUpPopup.levelsGained > 1
            ? `${levelUpPopup.levelsGained} new ranks unlocked`
            : "New rank unlocked"}
          {levelUpPopup.coins ? ` • +${levelUpPopup.coins} coins` : ""}
        </motion.div>

        <motion.div
          className="level-up-progress-glow"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.85, duration: 0.75 }}
        />

        <button
          className="level-up-button"
          onClick={() => {
            playClickSound();
            setLevelUpPopup(null);
          }}
        >
          AWESOME
        </button>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <ScreenTransition key={currentHomeViewKey}>
        {profileOpen ? (
          <div className="profile-screen">
            <button
              className="profile-top-back-button"
              onClick={() => {
                playClickSound();
                setProfileOpen(false);
              }}
            >
              BACK
            </button>
            <motion.div
              className={`profile-card level-${playerLevel.color}`}
              initial={{ opacity: 0, scale: 0.9, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 14 }}
            >
              <div className="profile-hero-row">
                <PlayerAvatar
                  profile={{
                    ...profile,
                    avatar_emoji: profileAvatarEmoji,
                    avatar_icon: profileAvatar.icon,
                    avatar_style: profileAvatar.style,
                    avatar_color: profileAvatar.color,
                    avatar_bg: profileAvatar.bg,
                  }}
                  size="large"
                  button
                  className="profile-avatar-button"
                  onClick={openAvatarBuilder}
                  label="Edit avatar"
                />

                <div className="profile-name-wrap">
                  <div className="profile-title">Your Profile</div>
                  <div className="profile-name-pill">👤 {displayName}</div>
                  <button className="profile-edit-avatar-button" onClick={openAvatarBuilder}>
                    Edit Avatar
                  </button>
                  <div className={`profile-sync-pill ${profileStatus}`}>
                    {profileStatus === "ready"
                      ? "Online profile saved"
                      : profileStatus === "syncing"
                      ? "Syncing profile..."
                      : profileError || "Local profile"}
                  </div>
                </div>
              </div>

              <div className="profile-level-name">{playerLevel.name}</div>

              <button className="profile-level-button" onClick={openLevelModal}>
                <div className="home-level-label">
                  Level {playerLevel.levelNumber}
                </div>

                <div className="profile-bar-outer">
                  <div
                    className="profile-bar-inner"
                    style={{ width: `${playerLevel.progress}%` }}
                  />
                </div>

                <div className="profile-next-level">
                  {playerLevel.next
                    ? `${levelObjectiveSummary} toward ${playerLevel.next.name}`
                    : "Legend status reached"}
                </div>
              </button>

              <div className="profile-stats-grid">
                <div className="profile-stat-card">
                  <span>🔥</span>
                  <strong>{highScore}</strong>
                  <small>Best score</small>
                </div>

                <button
                  className="profile-stat-card profile-stat-button"
                  onClick={openCoinShop}
                >
                  <span>🪙</span>
                  <strong>{coins}</strong>
                  <small>Coins</small>
                </button>

                <button
                  className="profile-stat-card profile-stat-button"
                  onClick={openDailyRewardMeter}
                >
                  <span>📅</span>
                  <strong>{dailyStreak}</strong>
                  <small>Daily streak</small>
                </button>

                <div className="profile-stat-card">
                  <span>🏆</span>
                  <strong>{playerLevel.levelNumber}</strong>
                  <small>Level</small>
                </div>

                <div className="profile-stat-card">
                  <span>⚔️</span>
                  <strong>{profileStats.multiplayerWins}</strong>
                  <small>Wins</small>
                </div>

                <div className="profile-stat-card">
                  <span>💥</span>
                  <strong>{profileStats.multiplayerLosses}</strong>
                  <small>Losses</small>
                </div>

                <div className="profile-stat-card">
                  <span>🤝</span>
                  <strong>{profileStats.multiplayerDraws}</strong>
                  <small>Draws</small>
                </div>

                <div className="profile-stat-card">
                  <span>🎮</span>
                  <strong>{activeGames.length}</strong>
                  <small>Active</small>
                </div>
              </div>

              <div className="profile-record-strip">
                <strong>
                  {profileStats.multiplayerWins}-{profileStats.multiplayerLosses}
                  -{profileStats.multiplayerDraws}
                </strong>
                <span>
                  Multiplayer rounds counted: {profileStats.multiplayerMatches}
                </span>
              </div>

              <button
                className={`profile-sound-toggle ${soundOn ? "on" : "off"}`}
                onClick={toggleSound}
                aria-pressed={soundOn}
              >
                <span>Sound</span>
                <strong>{soundOn ? "On" : "Off"}</strong>
                <i />
              </button>

              <div className="profile-actions">
                <button
                  className="profile-change-name-button"
                  onClick={changeUsername}
                >
                  CHANGE NAME
                </button>
              </div>
            </motion.div>
          </div>
        ) : leaderboardOpen ? (
          <div className="leaderboard-screen">
            <motion.div
              className="leaderboard-card"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 14 }}
            >
              <div className="leaderboard-topbar">
                <div className="leaderboard-kicker">Community</div>
                <button
                  className="leaderboard-back-button"
                  onClick={() => {
                    playClickSound();
                    setLeaderboardOpen(false);
                  }}
                >
                  BACK
                </button>
              </div>

              <h1 className="leaderboard-title">Leaderboard</h1>
              <p className="leaderboard-subtitle">
                All Time • General Knowledge
              </p>

              <div className="leaderboard-mode-pill">General Knowledge</div>

              {leaderboardLoading ? (
                <div className="leaderboard-empty-state">
                  <strong>Loading scores...</strong>
                  <span>Finding the sharpest ball knowledge.</span>
                </div>
              ) : leaderboardRows.length > 0 ? (
                <div className="leaderboard-list">
                  {leaderboardRows.map((row) => (
                    <div
                      key={row.id || row.username}
                      className={`leaderboard-row rank-${row.rank} ${
                        row.isCurrentUser ? "current-user" : ""
                      }`}
                    >
                      <div className="leaderboard-rank">
                        {row.medal || row.rank}
                      </div>

                      <PlayerAvatar profile={row} size="small" />

                      <div className="leaderboard-player">
                        <strong>{row.username}</strong>
                        <small>
                          {row.isCurrentUser ? "You" : "General Knowledge"}
                        </small>
                      </div>

                      <div className="leaderboard-score">{row.score}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="leaderboard-empty-state">
                  <strong>No scores yet</strong>
                  <span>
                    {leaderboardError ||
                      "Play General Knowledge to set the first score"}
                  </span>
                </div>
              )}

            </motion.div>
          </div>
        ) : multiplayerOpen ? (
          <div className="multiplayer-screen">
            <motion.div
              className="multiplayer-card"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 14 }}
            >
              <div className="multiplayer-topbar">
                <button onClick={goBackMultiplayer}>← Back</button>
              </div>

              <div className="multiplayer-badge">⚔️ Arena</div>
              <h1 className="multiplayer-title">Arena</h1>

              {multiplayerError && (
                <div className="multiplayer-error">{multiplayerError}</div>
              )}

              {multiplayerNotice && (
                <div className="multiplayer-notice">{multiplayerNotice}</div>
              )}

              {multiplayerStep === "menu" && (
                <div className="arena-hub-grid">
                  <button
                    className="arena-hub-card play-now"
                    onClick={startPlayNow}
                    disabled={multiplayerLoading}
                  >
                    <span>⚡</span>
                    <strong>{multiplayerLoading ? "Finding..." : "Play Now"}</strong>
                    <small>Find a quick opponent</small>
                  </button>

                  <button
                    className="arena-hub-card h2h"
                    onClick={() => openArenaSection("h2h-menu")}
                  >
                    <span>⚔️</span>
                    <strong>H2H</strong>
                    <small>Async 1v1 battles</small>
                  </button>

                  <button
                    className="arena-hub-card league"
                    onClick={() => openArenaSection("league-menu")}
                  >
                    <span>🏆</span>
                    <strong>League</strong>
                    <small>Daily points with friends</small>
                  </button>
                </div>
              )}

              {multiplayerStep === "league-menu" && (
                <div className="arena-section-grid league-theme">
                  <button
                    className="multiplayer-action-card league-list"
                    onClick={loadMyLeagues}
                    disabled={leagueLoading}
                  >
                    <span>📊</span>
                    <strong>My Leagues</strong>
                  </button>

                  <button
                    className="multiplayer-action-card league-create"
                    onClick={() => {
                      playClickSound();
                      setLeagueNameInput(`${username}'s League`);
                      setMultiplayerStep("create-league");
                    }}
                  >
                    <span>🏆</span>
                    <strong>Create League</strong>
                  </button>

                  <button
                    className="multiplayer-action-card league-join"
                    onClick={() => {
                      playClickSound();
                      setMultiplayerStep("join-league");
                    }}
                  >
                    <span>👥</span>
                    <strong>Join League</strong>
                  </button>
                </div>
              )}

              {multiplayerStep === "h2h-menu" && (
                <div className="arena-section-grid h2h-theme">
                  <button
                    className="multiplayer-action-card active-games"
                    onClick={openActiveGames}
                    disabled={activeGamesLoading}
                  >
                    <span>🎮</span>
                    <strong>
                      {activeGamesLoading ? "Loading..." : "Active Matches"}
                    </strong>
                  </button>

                  <button
                    className="multiplayer-action-card create"
                    onClick={createMultiplayerMatch}
                    disabled={multiplayerLoading}
                  >
                    <span>⚔️</span>
                    <strong>{multiplayerLoading ? "Creating..." : "Create Match"}</strong>
                  </button>

                  <button
                    className="multiplayer-action-card join"
                    onClick={() => {
                      playClickSound();
                      setMultiplayerStep("join");
                    }}
                  >
                    <span>🔑</span>
                    <strong>Join Match</strong>
                  </button>
                </div>
              )}

              {multiplayerStep === "active-games" && (
                <div className="active-games-panel">
                  <div className="active-games-header">
                    <div>
                      <strong>Active Matches</strong>
                    </div>

                    <button onClick={fetchActiveGames} disabled={activeGamesLoading}>
                      {activeGamesLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  {activeGames.length === 0 && !activeGamesLoading ? (
                    <div className="active-games-empty">
                      <strong>No active matches yet</strong>
                      <span>Create a match or join with a room code</span>
                    </div>
                  ) : (
                    <div className="active-games-list">
                      {activeGames.map(({ match, latestRound }) => {
                        const playerSlot = getCurrentPlayerSlot(
                          match,
                          playerId,
                          username
                        );
                        const actionLabel = getMatchActionLabel(
                          match,
                          latestRound,
                          playerSlot,
                          isCurrentPlayersTurn(match, playerId, username)
                        );
                        const actionKind = getMatchActionKind(
                          match,
                          latestRound,
                          playerSlot,
                          isCurrentPlayersTurn(match, playerId, username)
                        );
                        const timestamp = match.updated_at || match.created_at;
                        const category = latestRound?.category || match.selected_category;
                        const opponentSlot = playerSlot === "player1" ? "player2" : "player1";
                        const opponentProfile = getMatchPlayerProfile(match, opponentSlot);

                        return (
                          <div
                            className={`active-game-card ${getCategoryClass(category)}`}
                            key={match.id}
                          >
                            <div className="active-game-top">
                              <div className="active-game-player">
                                <PlayerAvatar profile={opponentProfile} size="small" />
                                <strong>{getOpponentName(match, playerId, username)}</strong>
                              </div>
                              <span>{match.room_code}</span>
                            </div>

                            <div className="active-game-score">
                              Match score: {match.player1_wins || 0} -{" "}
                              {match.player2_wins || 0}
                            </div>

                            {category && (
                              <div className={`active-game-category ${getCategoryClass(category)}`}>
                                Round {latestRound?.round_number || match.round_number || 1} •{" "}
                                {getCategoryLabel(category)}
                              </div>
                            )}

                            <div className="active-game-phase">
                              {match.phase || match.status || "active"}
                            </div>

                            <div className={`active-game-status ${actionKind}`}>
                              {actionLabel}
                            </div>

                            <small>
                              {timestamp
                                ? new Date(timestamp).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Recently active"}
                            </small>

                            <div className="active-game-actions">
                              <button
                                className="open-match-button"
                                onClick={() => openExistingMatch(match.id)}
                                disabled={multiplayerLoading}
                              >
                                {getMatchCtaLabel(actionKind, match)}
                              </button>

                              <button
                                className="delete-match-button"
                                onClick={() => requestDeleteMatch(match)}
                                disabled={Boolean(deletingMatchId)}
                                aria-label="Delete match"
                              >
                                <Trash2 size={16} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {multiplayerStep === "create-league" && (
                <div className="league-form-card">
                  <div className="league-kicker">🏆 Create League</div>
                  <h2>Start a Daily League</h2>
                  <input
                    value={leagueNameInput}
                    onChange={(event) => setLeagueNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") createNewLeague();
                    }}
                    placeholder={`${username}'s League`}
                    autoFocus
                  />

                  <div className="league-picker-section">
                    <strong>Duration</strong>
                    <div className="league-duration-grid">
                      {LEAGUE_DURATIONS.map((duration) => (
                        <button
                          key={duration.label}
                          type="button"
                          className={`league-option-card ${
                            leagueDurationInput === duration.value ? "selected" : ""
                          }`}
                          onClick={() => setLeagueDurationInput(duration.value)}
                        >
                          {duration.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="league-picker-section">
                    <strong>Format</strong>
                    <div className="league-format-grid">
                      {Object.entries(LEAGUE_FORMATS).map(([format, config]) => (
                        <button
                          key={format}
                          type="button"
                          className={`league-option-card ${
                            leagueFormatInput === format ? "selected" : ""
                          }`}
                          onClick={() => setLeagueFormatInput(format)}
                        >
                          <span>{config.label}</span>
                          <small>{config.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  {leagueFormatInput === "custom" && (
                    <div className="league-custom-panel">
                      <div className="league-custom-row">
                        <span>Quick questions</span>
                        <div>
                          {CUSTOM_QUIZ_COUNTS.map((count) => (
                            <button
                              key={count}
                              type="button"
                              className={
                                leagueCustomQuizCount === count ? "selected" : ""
                              }
                              onClick={() => setLeagueCustomQuizCount(count)}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="league-custom-row">
                        <span>Top 10 lists</span>
                        <div>
                          {CUSTOM_TOP10_COUNTS.map((count) => (
                            <button
                              key={count}
                              type="button"
                              className={
                                leagueCustomTop10Count === count ? "selected" : ""
                              }
                              onClick={() => setLeagueCustomTop10Count(count)}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="league-custom-row">
                        <span>Who Am I</span>
                        <div>
                          {CUSTOM_WHOAMI_COUNTS.map((count) => (
                            <button
                              key={count}
                              type="button"
                              className={
                                leagueCustomWhoAmICount === count ? "selected" : ""
                              }
                              onClick={() => setLeagueCustomWhoAmICount(count)}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="league-custom-row">
                        <span>Find the Player</span>
                        <div>
                          {CUSTOM_FIND_PLAYER_COUNTS.map((count) => (
                            <button
                              key={count}
                              type="button"
                              className={
                                leagueCustomFindPlayerCount === count ? "selected" : ""
                              }
                              onClick={() => setLeagueCustomFindPlayerCount(count)}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {leagueSettings.findPlayerCount > 0 && (
                    <div className="league-custom-panel league-scoring-panel">
                      <div className="league-custom-row">
                        <span>Find scoring</span>
                        <div>
                          <button
                            type="button"
                            className={
                              leagueFindPlayerScoringMode === "attempts"
                                ? "selected"
                                : ""
                            }
                            onClick={() => setLeagueFindPlayerScoringMode("attempts")}
                          >
                            Fewest guesses
                          </button>
                          <button
                            type="button"
                            className={
                              leagueFindPlayerScoringMode === "time" ? "selected" : ""
                            }
                            onClick={() => setLeagueFindPlayerScoringMode("time")}
                          >
                            Fastest time
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="league-preview-card">
                    <span>Every day: {leagueDailyStructureText}</span>
                    <strong>Max daily score: {leagueSettings.maxDailyPoints}</strong>
                    {leagueSettings.findPlayerCount > 0 && (
                      <small>
                        Find scoring:{" "}
                        {leagueSettings.findPlayerScoringMode === "time"
                          ? "Fastest time"
                          : "Fewest guesses"}
                      </small>
                    )}
                    <small>
                      Duration:{" "}
                      {leagueDurationInput ? `${leagueDurationInput} days` : "Infinite"}
                    </small>
                  </div>

                  <button
                    onClick={createNewLeague}
                    disabled={
                      leagueLoading ||
                      leagueSettings.quizCount +
                        leagueSettings.top10Count +
                        leagueSettings.whoamiCount +
                        (leagueSettings.findPlayerCount || 0) <=
                        0
                    }
                  >
                    {leagueLoading ? "Creating..." : "Create League"}
                  </button>
                </div>
              )}

              {multiplayerStep === "join-league" && (
                <div className="league-form-card">
                  <div className="league-kicker">👥 Join League</div>
                  <h2>Enter League Code</h2>
                  <input
                    value={leagueCodeInput}
                    onChange={(event) => setLeagueCodeInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") joinExistingLeague();
                    }}
                    placeholder="LG-4821"
                    autoFocus
                  />
                  <button onClick={joinExistingLeague} disabled={leagueLoading}>
                    {leagueLoading ? "Joining..." : "Join League"}
                  </button>
                </div>
              )}

              {multiplayerStep === "my-leagues" && (
                <div className="active-games-panel league-list-panel">
                  <div className="active-games-header">
                    <div>
                      <strong>My Leagues</strong>
                    </div>
                    <button onClick={loadMyLeagues} disabled={leagueLoading}>
                      {leagueLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  {!leagueLoading && myLeagues.length === 0 ? (
                    <div className="active-games-empty">
                      <strong>No leagues yet</strong>
                      <span>Create a league or join with a code</span>
                    </div>
                  ) : (
                    <div className="active-games-list">
                      {myLeagues.map(({ league, member, memberCount, rank, todayPlayed }) => (
                        <div className="league-card" key={league.id}>
                          <div className="league-card-top">
                            <strong>{league.name}</strong>
                            <span>{league.league_code}</span>
                          </div>
                          <div className="league-card-stats">
                            <span>Rank #{rank || "-"}</span>
                            <span>{member?.total_points || 0} pts</span>
                            <span>{memberCount} players</span>
                          </div>
                          <div className={`league-today-status ${todayPlayed ? "played" : ""}`}>
                            {todayPlayed ? "Played today" : "Not played today"}
                          </div>
                          <button onClick={() => openLeagueDashboard(league.id)}>
                            Open League
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {multiplayerStep === "league-dashboard" && leagueDashboard && (
                <div className="league-dashboard">
                  <div className="league-dashboard-hero">
                    <div>
                      <div className="league-kicker">🏆 League</div>
                      <h2>{leagueDashboard.league.name}</h2>
                    </div>
                    <div className="league-code-pill">{leagueDashboard.league.league_code}</div>
                  </div>

                  <div className="league-meta-row">
                    <span>{leagueDashboard.members.length} players</span>
                    <span>{leagueDayLabel}</span>
                    <span>
                      {leagueDayExpired
                        ? "League finished"
                        : activeLeagueSubmission
                        ? "Played today"
                        : "Ready today"}
                    </span>
                  </div>

                  <div
                    className={`league-daily-card ${
                      !activeLeagueSubmission && !leagueDayExpired ? "pulse" : ""
                    } ${leagueDayExpired ? "finished" : ""}`}
                  >
                    <strong>Today's Challenge</strong>
                    {leagueDayExpired ? (
                      <>
                        <span>League finished</span>
                        <small>Final standings are locked in</small>
                      </>
                    ) : activeLeagueSubmission ? (
                      <>
                        <span>
                          Today's score: {activeLeagueSubmission.total_points}/
                          {leagueSettings.maxDailyPoints}
                        </span>
                        <small>Come back tomorrow</small>
                      </>
                    ) : (
                      <>
                        <span>{leagueDailyStructureText}</span>
                        <button onClick={prepareLeagueChallenge} disabled={leagueLoading}>
                          {leagueLoading ? "Loading..." : "Play Today's Challenge"}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="league-section-title">Leaderboard</div>
                  <div className="league-leaderboard">
                    {leagueDashboard.members.map((member, index) => (
                      <div
                        className={`league-row ${member.player_id === playerId ? "current-user" : ""}`}
                        key={member.id}
                      >
                        <div className="league-rank">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                        </div>
                        <PlayerAvatar
                          profile={getSocialProfile(member.player_id, member.username)}
                          size="small"
                        />
                        <div>
                          <strong>{member.username}</strong>
                          <small>{member.days_played || 0} days played</small>
                        </div>
                        <b>{member.total_points || 0}</b>
                      </div>
                    ))}
                  </div>

                  <div className="league-section-title">Today</div>
                  <div className="league-results-list">
                    {leagueDashboard.members.map((member) => {
                      const submission = leagueDashboard.submissions.find(
                        (item) => item.player_id === member.player_id
                      );

                      return (
                        <div className="league-result-row" key={member.id}>
                          <div className="league-result-player">
                            <PlayerAvatar
                              profile={getSocialProfile(member.player_id, member.username)}
                              size="small"
                            />
                            <strong>{member.username}</strong>
                          </div>
                          {submission ? (
                            <span>
                              {leagueSettings.quizCount > 0
                                ? `Quiz ${submission.quiz_score}/${leagueSettings.quizCount} • `
                                : ""}
                              {leagueSettings.top10Count > 0
                                ? `Top 10 ${submission.top10_score}/${leagueSettings.top10Count * 10} • `
                                : ""}
                              {leagueSettings.whoamiCount > 0
                                ? `Who Am I ${submission.whoami_score || 0}/${leagueSettings.whoamiCount * 10} • `
                                : ""}
                              {leagueSettings.findPlayerCount > 0
                                ? `Find ${submission.find_player_score || 0}/${leagueSettings.findPlayerCount * 10} • `
                                : ""}
                              <b>{submission.total_points} pts</b>
                            </span>
                          ) : (
                            <span>Not played yet</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {multiplayerStep === "play-now-waiting" && (
                <div className="multiplayer-room-card play-now-waiting-card">
                  <div className="room-status">Finding opponent...</div>
                  <div className="waiting-pulse">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="room-code">Public match: {multiplayerRoomCode}</div>
                  <button onClick={refreshMultiplayerMatch} disabled={multiplayerLoading}>
                    {multiplayerLoading ? "Checking..." : "Check Now"}
                  </button>
                  <button className="multiplayer-back-button" onClick={goBackMultiplayer}>
                    Cancel
                  </button>
                </div>
              )}

              {multiplayerStep === "created" && (
                <div className="multiplayer-room-card">
                  <div className="room-status">Match created</div>
                  <div className="room-code">Room code: {multiplayerRoomCode}</div>
                  <div className="multiplayer-player-list">
                    <span>
                      <PlayerAvatar
                        profile={getMatchPlayerProfile(activeMatch, "player1")}
                        size="small"
                      />
                      {activeMatch?.player1_username || username}
                    </span>
                    {activeMatch?.player2_username && (
                      <span>
                        <PlayerAvatar
                          profile={getMatchPlayerProfile(activeMatch, "player2")}
                          size="small"
                        />
                        {activeMatch.player2_username}
                      </span>
                    )}
                  </div>
                  {activeMatch?.status === "ready" ? (
                    <div className="opponent-found">Opponent found</div>
                  ) : (
                    <>
                      <div className="waiting-pulse">
                        <span />
                        <span />
                        <span />
                      </div>
                      <p>Waiting for opponent...</p>
                    </>
                  )}
                  {hasBothMultiplayerPlayers &&
                    activeMatch?.phase === "choose_category" && (
                      <div className="category-turn-note">
                        {canChooseMultiplayerCategory
                          ? "Your turn to choose a category"
                          : `${activeMatch.current_turn} chooses first`}
                      </div>
                    )}
                  {canChooseMultiplayerCategory && (
                    <div className="multiplayer-category-grid">
                      {MULTIPLAYER_CATEGORIES.map((category) => (
                        <button
                          key={category.id}
                          className={`${getCategoryClass(category.id)} ${
                            !category.available ? "coming-soon" : ""
                          }`}
                          disabled={!category.available || multiplayerLoading}
                          onClick={() => selectMultiplayerCategory(category)}
                        >
                          <strong>{category.label}</strong>
                          {!category.available && <small>Coming soon</small>}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeMatch?.phase === "category_selected" && (
                    <div className={`category-selected-card ${getCategoryClass(activeRound.category)}`}>
                      <strong>
                        Category selected:{" "}
                        {getCategoryLabel(activeMatch.selected_category)}
                      </strong>
                      <span>
                        Round {activeMatch.round_number || 1} is ready
                      </span>
                    </div>
                  )}
                  {activeMatch?.phase === "round_active" && activeRound && (
                    <div className="category-selected-card">
                      <strong>
                        Round {activeRound.round_number} •{" "}
                        {getCategoryLabel(activeRound.category)}
                      </strong>
                      {hasPlayedActiveRound ? (
                        <span>Waiting for opponent to play this round</span>
                      ) : (
                        <>
                          <span>Your 5-question round is ready</span>
                          <button onClick={startActiveMultiplayerRound}>
                            Play Round
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {activeMatch?.phase === "round_finished" && activeRound && (
                    <div className="multiplayer-round-result-card">
                      <strong>Round {activeRound.round_number} Result</strong>
                      <span>{getCategoryLabel(activeRound.category)}</span>
                      <div className="round-score-grid">
                        <div>
                          <small>{activeMatch.player1_username}</small>
                          <b>{activeRound.player1_score ?? 0}</b>
                        </div>
                        <div>
                          <small>{activeMatch.player2_username}</small>
                          <b>{activeRound.player2_score ?? 0}</b>
                        </div>
                      </div>
                      <em>
                        Winner:{" "}
                        {activeRound.winner === "draw"
                          ? "Draw"
                          : activeRound.winner}
                      </em>
                      <p>
                        Match wins: {activeMatch.player1_wins || 0} -{" "}
                        {activeMatch.player2_wins || 0}
                      </p>
                      <p>
                        Next: {activeMatch.current_turn} chooses a category
                      </p>
                      {canOpenNextCategoryPicker ? (
                        <button
                          onClick={() => {
                            playClickSound();
                            setNextCategoryPickerOpen(true);
                          }}
                        >
                          Choose Next Category
                        </button>
                      ) : (
                        <p>
                          Waiting for {activeMatch.current_turn} to choose the
                          next category
                        </p>
                      )}
                    </div>
                  )}
                  {matchRounds.length > 0 && (
                    <div className="match-history-card">
                      <strong>Rounds</strong>
                      {matchRounds.slice(0, 4).map((round) => (
                        <span
                          key={round.id}
                          className={getCategoryClass(round.category)}
                        >
                          Round {round.round_number} •{" "}
                          {getCategoryLabel(round.category)} •{" "}
                          {round.status === "finished"
                            ? `${activeMatch.player1_username} ${
                                round.player1_score ?? 0
                              } - ${round.player2_score ?? 0} ${
                                activeMatch.player2_username
                              }`
                            : "waiting"}
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={refreshMultiplayerMatch}>
                    {multiplayerLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              )}

              {multiplayerStep === "join" && (
                <div className="multiplayer-join-card">
                  <label htmlFor="room-code-input">Enter room code</label>
                  <input
                    id="room-code-input"
                    value={joinRoomCode}
                    onChange={(event) => setJoinRoomCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") joinMultiplayerMatch();
                    }}
                    placeholder="BK-4831"
                    autoFocus
                  />
                  <button
                    onClick={joinMultiplayerMatch}
                    disabled={multiplayerLoading}
                  >
                    {multiplayerLoading ? "Joining match..." : "Join Match"}
                  </button>
                </div>
              )}

              {multiplayerStep === "joined" && (
                <div className="multiplayer-room-card joined">
                  <div className="room-status">Joined room</div>
                  <div className="room-code">Room code: {multiplayerRoomCode}</div>
                  <div className="opponent-found">Opponent found</div>
                  {activeMatch && (
                    <div className="multiplayer-player-list">
                      <span>
                        <PlayerAvatar
                          profile={getMatchPlayerProfile(activeMatch, "player1")}
                          size="small"
                        />
                        {activeMatch.player1_username}
                      </span>
                      <span>
                        <PlayerAvatar
                          profile={getMatchPlayerProfile(activeMatch, "player2")}
                          size="small"
                        />
                        {activeMatch.player2_username}
                      </span>
                    </div>
                  )}
                  {activeMatch?.phase === "choose_category" && (
                    <div className="category-turn-note">
                      {canChooseMultiplayerCategory
                        ? "Your turn to choose a category"
                        : `${activeMatch.current_turn} chooses first`}
                    </div>
                  )}
                  {canChooseMultiplayerCategory && (
                    <div className="multiplayer-category-grid">
                      {MULTIPLAYER_CATEGORIES.map((category) => (
                        <button
                          key={category.id}
                          className={`${getCategoryClass(category.id)} ${
                            !category.available ? "coming-soon" : ""
                          }`}
                          disabled={!category.available || multiplayerLoading}
                          onClick={() => selectMultiplayerCategory(category)}
                        >
                          <strong>{category.label}</strong>
                          {!category.available && <small>Coming soon</small>}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeMatch?.phase === "category_selected" && (
                    <div className={`category-selected-card ${getCategoryClass(activeRound.category)}`}>
                      <strong>
                        Category selected:{" "}
                        {getCategoryLabel(activeMatch.selected_category)}
                      </strong>
                      <span>
                        Round {activeMatch.round_number || 1} is ready
                      </span>
                    </div>
                  )}
                  {activeMatch?.phase === "round_active" && activeRound && (
                    <div className="category-selected-card">
                      <strong>
                        Round {activeRound.round_number} •{" "}
                        {getCategoryLabel(activeRound.category)}
                      </strong>
                      {hasPlayedActiveRound ? (
                        <span>Waiting for opponent to play this round</span>
                      ) : (
                        <>
                          <span>Your 5-question round is ready</span>
                          <button onClick={startActiveMultiplayerRound}>
                            Play Round
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {activeMatch?.phase === "round_finished" && activeRound && (
                    <div className="multiplayer-round-result-card">
                      <strong>Round {activeRound.round_number} Result</strong>
                      <span>{getCategoryLabel(activeRound.category)}</span>
                      <div className="round-score-grid">
                        <div>
                          <small>{activeMatch.player1_username}</small>
                          <b>{activeRound.player1_score ?? 0}</b>
                        </div>
                        <div>
                          <small>{activeMatch.player2_username}</small>
                          <b>{activeRound.player2_score ?? 0}</b>
                        </div>
                      </div>
                      <em>
                        Winner:{" "}
                        {activeRound.winner === "draw"
                          ? "Draw"
                          : activeRound.winner}
                      </em>
                      <p>
                        Match wins: {activeMatch.player1_wins || 0} -{" "}
                        {activeMatch.player2_wins || 0}
                      </p>
                      <p>
                        Next: {activeMatch.current_turn} chooses a category
                      </p>
                      {canOpenNextCategoryPicker ? (
                        <button
                          onClick={() => {
                            playClickSound();
                            setNextCategoryPickerOpen(true);
                          }}
                        >
                          Choose Next Category
                        </button>
                      ) : (
                        <p>
                          Waiting for {activeMatch.current_turn} to choose the
                          next category
                        </p>
                      )}
                    </div>
                  )}
                  {matchRounds.length > 0 && (
                    <div className="match-history-card">
                      <strong>Rounds</strong>
                      {matchRounds.slice(0, 4).map((round) => (
                        <span
                          key={round.id}
                          className={getCategoryClass(round.category)}
                        >
                          Round {round.round_number} •{" "}
                          {getCategoryLabel(round.category)} •{" "}
                          {round.status === "finished"
                            ? `${activeMatch.player1_username} ${
                                round.player1_score ?? 0
                              } - ${round.player2_score ?? 0} ${
                                activeMatch.player2_username
                              }`
                            : "waiting"}
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={refreshMultiplayerMatch}>
                    {multiplayerLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              )}

              {matchDeleteCandidate && (
                <div className="match-delete-overlay">
                  <div className="match-delete-modal">
                    <strong>Delete this match?</strong>
                    <span>This removes it from your Active Matches.</span>
                    <div>
                      <button onClick={cancelDeleteMatch}>Cancel</button>
                      <button
                        className="danger"
                        onClick={confirmDeleteMatch}
                        disabled={deletingMatchId === matchDeleteCandidate.id}
                      >
                        {deletingMatchId === matchDeleteCandidate.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        ) : !modeMenuOpen ? (
          <div className="main-menu">
            <h1 className="main-title">BALL KNOWLEDGE</h1>

            <motion.div
              className={`home-progress-card home-progress-clickable level-${playerLevel.color}`}
              onClick={openLevelModal}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openLevelModal();
                }
              }}
              role="button"
              tabIndex={0}
              whileTap={{ scale: 0.985, y: 3 }}
            >
              <div className="home-progress-top">
                <button
                  className="home-stat-pill home-streak-pill stat-clickable"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDailyRewardMeter();
                  }}
                >
                  <span>🔥</span>
                  <strong>{dailyStreak}</strong>
                  <small>Daily streak</small>
                </button>

                <button
                  className="home-stat-pill home-coins-pill coin-clickable"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCoinShop();
                  }}
                >
                  <span>🪙</span>
                  <strong>{coins}</strong>
                  <small>Coins</small>
                </button>
              </div>

              <div className="home-level-box">
                <div className="home-level-left">
                    <div className="home-level-emoji">{playerLevel.emoji}</div>

                  <div>
                    <div className="profile-level-meta">
                      Level {playerLevel.levelNumber}
                    </div>

                    <div className="home-level-name">{playerLevel.name}</div>
                  </div>
                </div>

              <div className="home-level-score">Best: {highScore}</div>
              </div>

              <div className="home-level-bar-outer">
                <div
                  className="home-level-bar-inner"
                  style={{ width: `${playerLevel.progress}%` }}
                />
              </div>

              <div className="home-next-level">
                {playerLevel.next
                  ? `${levelObjectiveSummary} • Next: ${playerLevel.next.name}`
                  : "Legend status • true ball knowledge"}
              </div>

              <div className="home-level-tap-hint">Tap for progress</div>
            </motion.div>

            <button
              className="main-menu-button"
              onClick={() => {
                playClickSound();
                setModeMenuOpen(true);
              }}
            >
              <span className="main-menu-icon">⚽</span>
              <span className="main-menu-copy">
                <strong>SINGLE PLAYER</strong>
                <small>Train your ball knowledge</small>
              </span>
            </button>

            <button
              className="multiplayer-main-button home-action-card home-action-multiplayer"
              onClick={openMultiplayer}
            >
              <span className="main-menu-icon">⚔️</span>
              <span className="main-menu-copy">
                <strong>MULTIPLAYER</strong>
                <small>Battle friends & rivals</small>
              </span>
            </button>

            <button
              className={`daily-main-button home-action-card home-action-daily ${
                dailyPlayed ? "daily-completed" : ""
              }`}
              onClick={() => {
                playClickSound();
                startDailyChallenge();
              }}
              disabled={dailyPlayed}
            >
              <span className="main-menu-icon">{dailyPlayed ? "✅" : "🔥"}</span>
              <span className="main-menu-copy">
                <strong>{dailyPlayed ? "DAILY DONE" : "DAILY CHALLENGE"}</strong>
                <small>{dailyPlayed ? "Come back tomorrow" : "Come back every day"}</small>
              </span>
            </button>

            <div className="home-secondary-actions">
              <button
                className="profile-main-button home-action-card home-action-profile"
                onClick={() => {
                  playClickSound();
                  setProfileOpen(true);
                }}
              >
                <PlayerAvatar
                  profile={{
                    ...profile,
                    avatar_emoji: profileAvatarEmoji,
                    avatar_icon: profileAvatar.icon,
                    avatar_style: profileAvatar.style,
                    avatar_color: profileAvatar.color,
                    avatar_bg: profileAvatar.bg,
                  }}
                  size="small"
                />
                <span className="main-menu-copy">
                  <strong>PROFILE</strong>
                  <small>Your football identity</small>
                </span>
              </button>

              <button
                className="leaderboard-main-button home-action-card home-action-ranking"
                onClick={() => {
                  playClickSound();
                  setLeaderboardOpen(true);
                }}
              >
                <span className="main-menu-icon">🏆</span>
                <span className="main-menu-copy">
                  <strong>RANKINGS</strong>
                  <small>Climb the leaderboard</small>
                </span>
              </button>
            </div>

            {dailyPlayed && (
              <div className="daily-completed-note">
                Come back tomorrow
                {lastDailyResult && (
                  <span>
                    {" "}
                    • Last result: {lastDailyResult.found}/
                    {lastDailyResult.total}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mode-menu">
            <button
              className="mode-button mode-card mode-general"
              onClick={() => {
                playClickSound();
                startGame("general");
              }}
            >
              <span className="mode-card-icon">🧠</span>
              <span>
                <strong>General Knowledge</strong>
                <small>Classic football quiz</small>
              </span>
            </button>

            <button
              className="mode-button mode-card mode-career"
              onClick={() => {
                playClickSound();
                startGame("career");
              }}
            >
              <span className="mode-card-icon">✈️</span>
              <span>
                <strong>Career Path</strong>
                <small>Guess the player journey</small>
              </span>
            </button>

            <button
              className="mode-button mode-card mode-world-cup"
              onClick={() => {
                playClickSound();
                startGame("world-cup");
              }}
            >
              <span className="mode-card-icon">🏆</span>
              <span>
                <strong>World Cup</strong>
                <small>Tournament history</small>
              </span>
            </button>

            <button
              className="mode-button mode-card connections-mode-button"
              onClick={startConnectionsGame}
            >
              <span className="mode-card-icon">🧩</span>
              <span>
                <strong>Connections</strong>
                <small>Find the 4 groups</small>
              </span>
            </button>

            <button
              className="mode-button mode-card mode-whoami"
              onClick={startWhoAmIGame}
            >
              <span className="mode-card-icon">🕵️</span>
              <span>
                <strong>Who Am I?</strong>
                <small>Guess the player from clues</small>
              </span>
            </button>

            <button
              className="mode-button mode-card mode-find-player"
              onClick={() => startFindPlayerGame(findPlayerDate)}
            >
              <span className="mode-card-icon">🎯</span>
              <span>
                <strong>Find the Player</strong>
                <small>Guess by distance clues</small>
              </span>
            </button>

            <button
              className="mode-back-button"
              onClick={() => {
                playClickSound();
                setModeMenuOpen(false);
              }}
            >
              Back
            </button>
          </div>
        )}
          </ScreenTransition>
        </AnimatePresence>
      </div>
    );
  }

  if (gameMode === "who-am-i" && currentWhoAmI) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(10,8,35,0.18), rgba(0,0,0,0.58)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {coinRewardToastOverlay}
        {xpToastOverlay}
        <ScreenTransition className="whoami-screen">
          <button
            className="connections-back-button whoami-back-button"
            onClick={() => {
              playClickSound();
              setGameStarted(false);
              setModeMenuOpen(true);
              setGameMode("general");
              setWhoAmIFeedback(null);
            }}
          >
            Back
          </button>

          <motion.div
            className={`whoami-card ${whoAmIShake ? "shake" : ""}`}
            key={currentWhoAmI.id}
            animate={whoAmIShake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className="whoami-top">
              <div>
                <div className="whoami-kicker">Single Player</div>
                <h1>Who Am I?</h1>
              </div>
              <div className={`whoami-difficulty ${currentWhoAmI.difficulty.toLowerCase()}`}>
                {currentWhoAmI.difficulty}
              </div>
            </div>

            <div className="whoami-hud">
              <span>Score <strong>{whoAmIScore}</strong></span>
              <span>Streak <strong>{whoAmIStreak}</strong></span>
              <span>
                Lives <strong>{Array.from({ length: whoAmILives }).map((_, i) => <b key={i}>❤️</b>)}</strong>
              </span>
            </div>

            <div className="whoami-mystery">
              <motion.div
                className="whoami-silhouette"
                animate={{ scale: [1, 1.04, 1], rotate: [0, -1, 1, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                ?
              </motion.div>
              <div>
                <span>Clue {whoAmIClueIndex + 1} / 10</span>
                <strong>{whoAmIPointsAvailable} points available</strong>
              </div>
            </div>

            <div className="whoami-clues">
              <AnimatePresence initial={false}>
                {visibleWhoAmIClues.map((clue, index) => (
                  <motion.div
                    className={`whoami-clue ${index === whoAmIClueIndex ? "latest" : ""}`}
                    key={`${currentWhoAmI.id}-${index}`}
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span>{index + 1}</span>
                    <p>{clue}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {whoAmIFeedback && (
                <motion.div
                  className={`whoami-feedback ${whoAmIFeedback.type}`}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                >
                  {whoAmIFeedback.text}
                </motion.div>
              )}
            </AnimatePresence>

            {whoAmIGameOver ? (
              <motion.div
                className="whoami-gameover"
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
              >
                <strong>Game Over</strong>
                <span>Final score: {whoAmIScore}</span>
                <button onClick={startWhoAmIGame}>Play Again</button>
              </motion.div>
            ) : (
              <GuessInput
                answerType="player"
                value={whoAmIInput}
                onTextChange={setWhoAmIInput}
                selectedPlayer={whoAmISelectedPlayer}
                onSelectPlayer={setWhoAmISelectedPlayer}
                onSubmit={() => {
                  playClickSound();
                  submitWhoAmIGuess();
                }}
                placeholder="Search player or type full name..."
                disabled={Boolean(whoAmIFeedback?.locked)}
                buttonLabel="Guess"
                rowClassName="whoami-answer-row"
                maxSuggestions={4}
                autoFocus
              />
            )}
          </motion.div>
        </ScreenTransition>
      </div>
    );
  }

  if (gameMode === "find-player") {
    const findPlayerDateLabel = new Date(`${findPlayerDate}T00:00:00`).toLocaleDateString(
      undefined,
      { month: "long", day: "numeric", year: "numeric" }
    );
    const todayKey = getDailyDateKey();

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(9,14,36,0.18), rgba(0,0,0,0.62)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {coinRewardToastOverlay}
        {xpToastOverlay}
        <ScreenTransition className="whoami-screen find-player-screen">
          <button
            className="connections-back-button whoami-back-button"
            onClick={() => {
              playClickSound();
              setGameStarted(false);
              setModeMenuOpen(true);
              setGameMode("general");
            }}
          >
            Back
          </button>

          <motion.div className="whoami-card find-player-card">
            <div className="whoami-top">
              <div>
                <div className="whoami-kicker">Daily Puzzle</div>
                <h1>Find the Player</h1>
              </div>
              <div className="whoami-difficulty hard">Unlimited</div>
            </div>

            <div className="find-player-date-row">
              <button onClick={() => shiftFindPlayerDate(-1)}>Previous Day</button>
              <strong>{findPlayerDateLabel}</strong>
              <button
                onClick={() => startFindPlayerGame(todayKey)}
                disabled={findPlayerDate >= todayKey}
              >
                Today
              </button>
              <button
                onClick={() => shiftFindPlayerDate(1)}
                disabled={findPlayerDate >= todayKey}
              >
                Next Day
              </button>
            </div>

            {findPlayerStatus === "loading" && (
              <div className="find-player-mystery-card">
                <div className="whoami-mystery-icon">?</div>
                <strong>Loading today’s player...</strong>
              </div>
            )}

            {findPlayerStatus === "error" && (
              <div className="whoami-gameover">
                <strong>{findPlayerError || "Could not load puzzle"}</strong>
                <button onClick={() => startFindPlayerGame(findPlayerDate)}>Retry</button>
              </div>
            )}

            {findPlayerTarget && findPlayerStatus !== "loading" && findPlayerStatus !== "error" && (
              <>
                <div className="whoami-hud">
                  <span>
                    Guesses <strong>{findPlayerGuesses.length}</strong>
                  </span>
                  <span>
                    Time <strong>{formatElapsedTime(findPlayerElapsed)}</strong>
                  </span>
                  <span>
                    Status <strong>{findPlayerStatus === "won" ? "Solved" : findPlayerStatus === "gave-up" ? "Gave up" : "Hunting"}</strong>
                  </span>
                </div>

                <div className="find-player-mystery-card">
                  <div className="whoami-mystery-icon">?</div>
                  <div>
                    <span>Hidden footballer</span>
                    <strong>
                      {findPlayerStatus === "won" || findPlayerStatus === "gave-up"
                        ? findPlayerTarget.name
                        : `Guesses: ${findPlayerGuesses.length}`}
                    </strong>
                    {findPlayerRanking.poolSize > 0 && (
                      <small>{findPlayerRanking.poolSize} players ranked</small>
                    )}
                  </div>
                </div>

                {findPlayerStatus === "playing" && (
                  <div className="find-player-input-row">
                    <PlayerPicker
                      value={findPlayerSelected}
                      onSelect={setFindPlayerSelected}
                      placeholder="Search exact player..."
                      compact
                      maxSuggestions={5}
                    />
                    <button
                      className="daily-submit-button"
                      disabled={!findPlayerSelected}
                      onClick={submitFindPlayerGuess}
                    >
                      Guess
                    </button>
                    <button
                      className="find-player-give-up-button"
                      type="button"
                      onClick={giveUpFindPlayer}
                    >
                      Give Up
                    </button>
                  </div>
                )}

                {findPlayerError && (
                  <div className="whoami-feedback wrong">{findPlayerError}</div>
                )}

                {(findPlayerStatus === "won" || findPlayerStatus === "gave-up") && (
                  <motion.div
                    className={`whoami-feedback ${findPlayerStatus === "won" ? "correct" : "reveal"}`}
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                  >
                    {findPlayerStatus === "won"
                      ? `Solved in ${findPlayerGuesses.length} guesses • ${formatElapsedTime(findPlayerElapsed)}`
                      : `Answer: ${findPlayerTarget.name} • ${findPlayerGuesses.length} guesses • ${formatElapsedTime(findPlayerElapsed)}`}
                  </motion.div>
                )}

                <div className="find-player-guesses">
                  {findPlayerGuesses.map((guess) => (
                    <div
                      key={`${guess.player.id}-${guess.distance}`}
                      className={`find-player-guess ${guess.color} ${
                        guess.latest ? "latest" : ""
                      }`}
                    >
                      <div
                        className="find-player-bar-fill"
                        style={{ width: `${guess.barPercent || 12}%` }}
                      />
                      <div className="find-player-guess-content">
                        <div>
                          <strong>{guess.player.name}</strong>
                          <span>
                            {guess.player.nationality || "Unknown"} •{" "}
                            {guess.player.position_group || guess.player.position || "Unknown"}
                            {guess.player.birth_year ? ` • ${guess.player.birth_year}` : ""}
                          </span>
                        </div>
                        <em>#{guess.rank || "?"}</em>
                      </div>
                      <small>
                        Rank #{guess.rank || "?"}
                        {guess.poolSize ? ` / ${guess.poolSize}` : ""} • {guess.label}
                      </small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </ScreenTransition>
      </div>
    );
  }

  if (gameMode === "connections" && connectionsPuzzle) {
    const revealedGroups = connectionsPuzzle.groups.map((group, index) => ({
      ...group,
      index,
      solvedItems: group.items,
    }));
    const groupsToShow = connectionsGameOver ? revealedGroups : connectionsSolved;

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.48)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {coinRewardToastOverlay}
        {xpToastOverlay}
        <ScreenTransition className="connections-screen">
          <button
            className="connections-back-button"
            onClick={() => {
              playClickSound();
              setGameStarted(false);
              setModeMenuOpen(true);
              setGameMode("general");
              setConnectionsFeedback(null);
            }}
          >
            Back
          </button>

          <div className="connections-card">
            <div className="connections-header">
              <div>
                <div className="connections-title-row">
                  <div className="connections-kicker">Single Player</div>
                  <div className={`connections-difficulty ${connectionsPuzzle.difficulty?.toLowerCase() || "easy"}`}>
                    {connectionsPuzzle.difficulty || "Easy"}
                  </div>
                </div>
                <h1>Connections</h1>
                <p>Find the 4 football groups</p>
              </div>

              <div className="connections-mistakes">
                <span>Mistakes</span>
                <strong>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        index < connectionsMistakes ? "mistake-used" : ""
                      }
                    >
                      ❤️
                    </span>
                  ))}
                </strong>
                <small>{connectionsMistakesLeft} left</small>
              </div>
            </div>

            <div className="connections-solved-list">
              <AnimatePresence>
                {groupsToShow.map((group) => (
                  <motion.div
                    key={group.category}
                    className={`connections-solved-card ${group.color}`}
                    initial={{ opacity: 0, scale: 0.88, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.28 }}
                  >
                    <strong>{group.category}</strong>
                    <span>{group.solvedItems.join(" • ")}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {connectionsFeedback && (
                <motion.div
                  key={`${connectionsFeedback.type}-${connectionsShake}`}
                  className={`connections-feedback ${connectionsFeedback.type}`}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    x: connectionsFeedback.type === "wrong" ? [0, -8, 8, -5, 5, 0] : 0,
                  }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                >
                  {connectionsFeedback.text}
                </motion.div>
              )}
            </AnimatePresence>

            {!connectionsGameComplete && !connectionsGameOver && (
              <motion.div
                className="connections-grid"
                key={connectionsShake}
                animate={
                  connectionsFeedback?.type === "wrong"
                    ? { x: [0, -7, 7, -4, 4, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.28 }}
              >
                {connectionsVisibleTiles.map((tile) => {
                  const selectedTile = connectionsSelected.includes(tile.id);

                  return (
                    <motion.button
                      key={tile.id}
                      className={`connections-tile ${
                        selectedTile ? "selected" : ""
                      }`}
                      onClick={() => toggleConnectionTile(tile)}
                      whileTap={{ scale: 0.94 }}
                      animate={selectedTile ? { scale: 1.04 } : { scale: 1 }}
                      transition={{ duration: 0.12 }}
                    >
                      {tile.item}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {connectionsGameComplete && (
              <motion.div
                className="connections-complete-card"
                initial={{ opacity: 0, scale: 0.86, y: 22 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 14 }}
              >
                <strong>Puzzle Complete</strong>
                <span>+75 coins</span>
                <button onClick={startConnectionsGame}>Play Another</button>
              </motion.div>
            )}

            {connectionsGameOver && (
              <motion.div
                className="connections-gameover-card"
                initial={{ opacity: 0, scale: 0.9, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <strong>Game Over</strong>
                <span>Categories revealed. Run it back.</span>
                <button onClick={startConnectionsGame}>Try New Puzzle</button>
              </motion.div>
            )}

            {!connectionsGameComplete && !connectionsGameOver && (
              <div className="connections-actions">
                <button
                  className="connections-secondary-button"
                  onClick={() => {
                    playClickSound();
                    setConnectionsSelected([]);
                    setConnectionsFeedback(null);
                  }}
                  disabled={connectionsSelected.length === 0}
                >
                  Deselect
                </button>

                <button
                  className="connections-secondary-button"
                  onClick={shuffleConnectionsTiles}
                >
                  Shuffle
                </button>

                <button
                  className="connections-submit-button"
                  onClick={submitConnectionsSelection}
                  disabled={connectionsSelected.length !== 4}
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </ScreenTransition>
      </div>
    );
  }

  if (gameMode === "daily-list" && !finished) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03), rgba(0,0,0,0.58)), url(${quizBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {xpToastOverlay}
        <button className="home-button" onClick={restart}>
          ← Home
        </button>

        <AnimatePresence>
          {dailyReveal?.phase === "result" && (
            <motion.div
              className={`rank-reveal-overlay ${dailyReveal.type || ""}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rank-reveal-label">
                {dailyReveal.type === "wrong"
                  ? dailyReveal.displayRank === 0
                    ? "NOT FOUND"
                    : "SEARCHING"
                  : dailyReveal.displayRank === dailyReveal.rank
                  ? "FOUND"
                  : "SCANNING"}
              </div>

              <div className="rank-reveal-number">
                {dailyReveal.displayRank > 0
                  ? `#${dailyReveal.displayRank}`
                  : "OUT"}
              </div>

              {dailyReveal.type === "correct" &&
                dailyReveal.displayRank === dailyReveal.rank && (
                <div className="rank-reveal-player">
                  {formatAnswerWithValue(dailyReveal.answer)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {wrongPopup && (
            <motion.div
              className="wrong-overlay"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="wrong-title">❌ {wrongPopup.message || "WRONG"}</div>
              <div className="wrong-answer">{wrongPopup.answer}</div>
              <div className="wrong-life">-1 LIFE ❤️</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="daily-list-wrapper">
          <div className="daily-question-card">
            <h2 className="daily-list-label">🔥 DAILY CHALLENGE</h2>

            <h1 className="daily-list-title">{todayChallenge.label}</h1>

            <p className="daily-list-question">{todayChallenge.question}</p>
          </div>

          <div className="daily-list-stats">
            <span className="daily-stat-pill daily-stat-score">
              {foundAnswers.length} / {todayChallenge.answers.length} FOUND
            </span>

            <span className={`daily-stat-pill daily-stat-lives ${lives <= 1 ? "low" : ""}`}>
              {Array.from({ length: lives }).map((_, i) => (
                <span key={i}>❤️</span>
              ))}
            </span>
          </div>

          <div className="pyramid-list">
            {todayChallenge.answers.map((answer, index) => {
              const isFound = foundAnswers.includes(answer);
              const rank = index + 1;
              const isScanning =
                dailyReveal?.displayRank === rank && isRevealing;
              const isRevealTarget =
                dailyReveal?.type === "correct" && dailyReveal.rank === rank;
              const isJustFound = dailyCelebratedAnswer === answer;
              const width = 46 + index * 4.6;

              return (
                <motion.div
                  key={getAnswerKey(answer, index)}
                  className={`pyramid-slot ${isFound ? "found" : ""} ${
                    isScanning ? "scanning" : ""
                  } ${isRevealTarget ? "reveal-target" : ""} ${
                    isJustFound ? "just-found" : ""
                  }`}
                  style={{ width: `${width}%` }}
                  initial={false}
                  animate={
                    isJustFound
                      ? { scale: [1, 1.12, 1], y: [0, -7, 0] }
                      : isFound
                      ? { scale: [1, 1.08, 1] }
                      : {}
                  }
                  transition={{ duration: 0.45 }}
                >
                  <span className="pyramid-rank">#{rank}</span>
                  <span>{isFound ? formatAnswerWithValue(answer) : "?????"}</span>
                </motion.div>
              );
            })}
          </div>

          <GuessInput
            answerType={isDailyPlayerChallenge ? "player" : "text"}
            value={dailyInput}
            onTextChange={setDailyInput}
            selectedPlayer={dailySelectedPlayer}
            onSelectPlayer={setDailySelectedPlayer}
            onSubmit={checkDailyAnswer}
            autoSubmitOnSelect
            placeholder={
              isDailyPlayerChallenge
                ? "Search and select player..."
                : "Type answer..."
            }
            buttonLabel="GUESS"
            rowClassName="daily-input-row"
            inputClassName="daily-list-input"
            buttonClassName="daily-submit-button"
            maxSuggestions={4}
            autoFocus
          />
        </div>
      </div>
    );
  }

  if (finished) {
    const isDaily = gameMode === "daily-list";
    const dailyCompleted =
      isDaily && foundAnswers.length === todayChallenge.answers.length;
    const opponentScore =
      mockOpponentScore ?? createMockOpponentScore(score);
    const multiplayerWon = score >= opponentScore;

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.62)), url(${quizBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {xpToastOverlay}
        {objectiveProgressModal}
        <div className={`result-card ${isDaily ? "daily-result-card" : ""}`}>
          <Trophy size={70} />

          <h2>
            {dailyCompleted
              ? "Daily Complete"
              : isDaily
              ? "Daily Failed"
              : "Game Over"}
          </h2>

          {isDaily ? (
            <div className="daily-result-content">
              <div className="daily-result-badge">DAILY RESULT</div>

              <div className="daily-result-score">
                {foundAnswers.length}/{todayChallenge.answers.length}
              </div>

              <div className="daily-result-subtitle">players found</div>

              <div className="daily-result-coins">
                🪙 +{lastDailyResult?.coins || dailyCoinsEarned} coins
              </div>

              <div className="daily-result-streak">
                🔥 Streak: {lastDailyResult?.streak || dailyStreak} days
              </div>

              {(lastDailyResult?.streakBonus || streakRewardEarned) > 0 && (
                <div className="daily-result-streak-bonus">
                  +{lastDailyResult?.streakBonus || streakRewardEarned} streak
                  bonus
                </div>
              )}

              {!dailyCompleted && (
                <div className="daily-missing-answers">
                  <div className="daily-missing-title">Missing answers</div>

                  <div className="daily-missing-list">
                    {todayChallenge.answers.map((answer, index) => {
                      const found = foundAnswers.includes(answer);

                      return (
                        <div
                          key={getAnswerKey(answer, index)}
                          className={`daily-missing-row ${
                            found ? "found" : "missed"
                          }`}
                        >
                          <span>#{index + 1}</span>
                          <strong>{formatAnswerWithValue(answer)}</strong>
                          <em>{found ? "Found" : "Missed"}</em>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : isMockMultiplayer ? (
            <div className="multiplayer-result-content">
              <div className="daily-result-badge">MULTIPLAYER RESULT</div>
              <h3>{multiplayerWon ? "You Win" : "You Lose"}</h3>

              <div className="versus-card">
                <div>
                  <span>👤 You</span>
                  <strong>{score}</strong>
                </div>

                <div className="versus-divider">VS</div>

                <div>
                  <span>⚔️ Opponent</span>
                  <strong>{opponentScore}</strong>
                </div>
              </div>

              <p className="multiplayer-result-note">Match complete.</p>
            </div>
          ) : (
            <>
              <p>🔥 Final Score: {score}</p>
              <p>🏆 Best Score: {highScore}</p>
              {gameMode === "general" && generalRunXpTotal > 0 && (
                <motion.div
                  className="general-run-xp-summary"
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.12, duration: 0.24 }}
                >
                  {score > runStartHighScore && (
                    <div className="general-run-highscore">
                      <strong>New Highscore!</strong>
                      <span>
                        +{generalRunXpSummary.highscore || getGeneralHighscoreXpBonus(score)} XP
                      </span>
                    </div>
                  )}

                  <div className="general-run-xp-line">
                    <span>Correct answers</span>
                    <strong>+{generalRunXpSummary.correct} XP</strong>
                  </div>

                  {generalRunXpSummary.streak > 0 && (
                    <div className="general-run-xp-line">
                      <span>Streak bonuses</span>
                      <strong>+{generalRunXpSummary.streak} XP</strong>
                    </div>
                  )}

                  {generalRunXpSummary.highscore > 0 && (
                    <div className="general-run-xp-line">
                      <span>Highscore bonus</span>
                      <strong>+{generalRunXpSummary.highscore} XP</strong>
                    </div>
                  )}

                  <div className="general-run-xp-total">
                    <span>Total XP this run</span>
                    <strong>+{generalRunXpTotal} XP</strong>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {!isDaily && !isMockMultiplayer && reviveCost && coins >= reviveCost && (
            <button className="play-again-button" onClick={revive}>
              ❤️ Buy extra life — {reviveCost} coins
            </button>
          )}

          {!isDaily && !isMockMultiplayer && revivesUsed >= 3 && (
            <div className="revive-note">Max revives used</div>
          )}

          {!isDaily &&
            !isMockMultiplayer &&
            reviveCost &&
            coins < reviveCost &&
            revivesUsed < 3 && (
              <div className="revive-note">Need {reviveCost} coins for an extra life</div>
            )}

          {isMockMultiplayer ? (
            <>
              <button
                className="play-again-button"
                onClick={() => startMockMultiplayerMatch()}
              >
                <RotateCcw size={24} /> Play Again
              </button>

              <button className="play-again-button" onClick={restart}>
                Back to Home
              </button>
            </>
          ) : (
            <button
              className="play-again-button"
              onClick={() => handleResultButton(isDaily)}
            >
              {isDaily ? (
                "COLLECT & HOME"
              ) : (
                <>
                  Back to Home
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fullscreen-bg"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.58)), url(${quizBg})`,
      }}
    >
      {coinShopModal}
      {dailyRewardMeterModal}
      {xpToastOverlay}
      {objectiveProgressModal}
      <button
        className="home-button"
        onClick={() => {
          playClickSound();
          restart();
        }}
      >
        ← Home
      </button>

      <AnimatePresence>
        {rewardPopup && (
          <motion.div
            className="reward-overlay"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -30 }}
            transition={{ duration: 0.35 }}
          >
            <div className="reward-title">🔥 {rewardPopup.streak} STREAK</div>
            <div className="reward-coins">+{rewardPopup.coins} COINS</div>

            <button
              className="collect-button"
              onClick={() => {
                playClickSound();
                collectReward();
              }}
            >
              COLLECT
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wrongPopup && (
          <motion.div
            className="wrong-overlay"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.25 }}
          >
              <div className="wrong-title">❌ {wrongPopup.message || "WRONG"}</div>
            <div className="wrong-answer">Correct: {wrongPopup.answer}</div>
            <div className="wrong-life">-1 LIFE ❤️</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hud-row">
        <div className="streak-meter">
          <div className="streak-meter-top">
            <div className="streak-left">
              <span className="streak-fire">🔥</span>
              <span className="streak-title">STREAK {streak}</span>
            </div>

            <div className="streak-right">
              {streak >= 50
                ? "MAXED"
                : `Next reward: ${getNextStreakTarget(streak)}`}
            </div>
          </div>

          <div className="streak-bar-outer">
            <div
              className="streak-bar-inner"
              style={{ width: `${getStreakProgress(streak)}%` }}
            />
          </div>
        </div>

        <div className="hud-card">
          <span className="hud-label">SCORE</span>
          <span className="hud-value">🔥 {score}</span>
        </div>

        <div className="hud-card">
          <span className="hud-label">BEST</span>
          <span className="hud-value">🏆 {highScore}</span>
        </div>

        <button className="hud-card hud-button" onClick={openCoinShop}>
          <span className="hud-label">COINS</span>
          <span className="hud-value">🪙 {coins}</span>
        </button>

        <div className="hud-card">
          <span className="hud-label">LIVES</span>
          <span className="hud-value">
            {Array.from({ length: lives }).map((_, i) => (
              <span key={i}>❤️</span>
            ))}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -25 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className={`difficulty-pill ${
              current.difficulty === "Very Hard" ? "very-hard" : ""
            }`}
          >
            {isMockMultiplayer
              ? `Multiplayer • ${getModeLabel(gameMode)}`
              : gameMode === "career"
              ? "Career Path"
              : gameMode === "world-cup"
              ? `World Cup • ${current.difficulty}`
              : current.difficulty}
          </div>

          {isTimedQuestion && (
            <div
              className={`hard-timer ${
                current.difficulty === "Very Hard" ? "very-hard" : ""
              } ${timeLeft <= 3 ? "danger" : ""}`}
            >
              ⏱ {timeLeft}s
            </div>
          )}

          {gameMode === "career" ? (
            <div className="career-journey-card">
              <div className="career-journey-kicker">Guess the player</div>
              <div className="career-journey-path">
                {careerPathClubs.map((club, index) => (
                  <React.Fragment key={`${club}-${index}`}>
                    <motion.div
                      className={`career-club-pill club-${getClubThemeClass(club)}`}
                      initial={{ opacity: 0, y: 12, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.045, duration: 0.2 }}
                    >
                      {club}
                    </motion.div>
                    {index < careerPathClubs.length - 1 && (
                      <div className="career-path-arrow">→</div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <h1
              className={`question-title quiz-question-card ${
                gameMode === "world-cup" ? "world-cup-question-card" : ""
              }`}
            >
              {current.question}
            </h1>
          )}

          {gameMode === "career" || gameMode === "world-cup" ? (
            <>
              <GuessInput
                answerType={gameMode === "career" ? "player" : "text"}
                value={textAnswer}
                onTextChange={setTextAnswer}
                selectedPlayer={careerSelectedPlayer}
                onSelectPlayer={setCareerSelectedPlayer}
                onSubmit={submitTextAnswer}
                placeholder={
                  gameMode === "world-cup"
                    ? "Type your answer..."
                    : "Search player or type full name..."
                }
                disabled={Boolean(selected)}
                buttonLabel="Guess"
                rowClassName={`career-answer-box ${
                  gameMode === "career" ? "career-premium-answer" : ""
                }`}
                inputClassName="career-input"
                buttonClassName="career-submit-button"
                maxSuggestions={4}
              />

              {selected && (
                <div
                  className={`career-feedback ${
                    isCorrectAnswer(selected, current.answer)
                      ? "correct"
                      : "wrong"
                  }`}
                >
                  {isCorrectAnswer(selected, current.answer) ? (
                    <>✅ CORRECT! {current.answer}</>
                  ) : (
                    <>❌ Correct answer: {current.answer}</>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`answers-grid ${
                  gameMode === "world-cup" ? "world-cup-answer-grid" : ""
                }`}
              >
                {current.options.map((option) => {
                  const isCorrect = option === current.answer;
                  const isChosen = selected === option;
                  const showCorrect = selected && isCorrect;
                  const showWrong = selected && isChosen && !isCorrect;

                  return (
                    <button
                      key={option}
                      onClick={() => {
                        playClickSound();
                        chooseAnswer(option);
                      }}
                      className={`answer-button ${
                        showCorrect ? "correct" : showWrong ? "wrong" : ""
                      }`}
                    >
                      <span>{option}</span>
                      {showCorrect && <CheckCircle2 size={28} />}
                      {showWrong && <XCircle size={28} />}
                    </button>
                  );
                })}
              </div>
              <div className="quiz-xp-inline-slot">
                <AnimatePresence>
                  {xpToast && xpToast.placement === "inline" && (
                    <motion.div
                      key={xpToast.key}
                      className={`quiz-xp-inline-toast ${
                        xpToast.amount > 5 ? "bonus" : ""
                      }`}
                      initial={{ opacity: 0, y: 10, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <span>XP</span>
                      <strong>+{xpToast.amount}</strong>
                      <em>{xpToast.label || "Progress"}</em>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
