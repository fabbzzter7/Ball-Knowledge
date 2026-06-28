import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  RotateCcw,
  Trophy,
  X,
  XCircle,
  Trash2,
} from "lucide-react";
import { ANSWER_ALIASES, LAST_WORD_BLACKLIST } from "./answerAliases";
import PlayerAvatar, { getAvatarConfig } from "./components/PlayerAvatar";
import GuessInput from "./components/GuessInput";
import GameTopNav from "./components/GameTopNav";
import BKIcon from "./components/BKIcon";
import LevelIcon from "./components/LevelIcon";

import { QUESTIONS } from "./QUESTIONS";
import { CAREER_QUESTIONS } from "./CAREER_QUESTIONS";
import {
  DAILY_LIST_CHALLENGES,
  auditDailyListChallenges,
} from "./DAILY_LIST_CHALLENGES";
import { WORLD_CUP_QUESTIONS } from "./WORLD_CUP_QUESTIONS";
import { CONNECTIONS_PUZZLES } from "./CONNECTIONS_PUZZLES";
import { WHO_AM_I_QUESTIONS } from "./WHO_AM_I_QUESTIONS";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  createProfile,
  fetchProfile,
  getDefaultProfile,
  getOrCreatePlayerId,
  mergeLocalProgressIntoProfile,
  PROFILE_SELECT,
  syncLocalStatsToProfile,
  updateProfile,
} from "./lib/profileService";
import { isPlayerAnswerMatch } from "./lib/playerAnswer";
import {
  findMatchingAnswer,
  isPlayerAnswerCorrect,
  normalizeAnswerText,
} from "./lib/playerAnswerMatcher";
import {
  addDaysToDateKey,
  formatDisplayDate,
  getTodayDateKey,
} from "./lib/dailyDateUtils";
import {
  selectDailyChallenge,
  selectDailyWhoAmIQuestion,
} from "./lib/dailyContentDiversity";
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
  getLevelById,
  getInitialProgression,
  getProgressionView,
  maxStat,
  persistLocalProgression,
} from "./lib/progressionService";
import { safeLocalStorage as localStorage } from "./lib/safeStorage";
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
  leaveLeague,
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
  getCurrentSession,
  normalizeUsername,
  signInWithEmail,
  signOut,
  signUpWithEmailUsername,
} from "./lib/authService";
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

const PlayerPicker = React.lazy(() => import("./components/PlayerPicker"));

function loadPlayerService() {
  return import("./lib/playerService");
}

async function searchPlayersLazy(query, limit) {
  const { searchPlayers } = await loadPlayerService();
  return searchPlayers(query, limit);
}

async function fetchFindPlayerPoolLazy() {
  const { fetchFindPlayerPool } = await loadPlayerService();
  return fetchFindPlayerPool();
}

function preloadPlayerSearchLazy() {
  loadPlayerService()
    .then(({ preloadPlayerSearchIndex }) => preloadPlayerSearchIndex?.())
    .catch(() => {});
}

async function filterSearchablePlayerGuessQuestionsLazy(questions, context) {
  const { filterSearchablePlayerGuessQuestions } = await loadPlayerService();
  return filterSearchablePlayerGuessQuestions(questions, context);
}

const HARD_TIME_LIMIT = 15;
const MULTIPLAYER_TIME_LIMIT = 8;
const MULTIPLAYER_CAREER_TIME_LIMIT = 15;
const MULTIPLAYER_TIMEOUT_VALUE = "__time_up__";
const TOP_10_REQUIRED_ANSWER_COUNT = 10;
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
  "🎯",
  "🥶",
  "💎",
  "🛡️",
  "🚀",
  "🥅",
  "👟",
  "🎮",
  "🏟️",
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
  { value: "ultra", label: "Ultra" },
  { value: "champion", label: "Champion" },
  { value: "academy", label: "Academy" },
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
  { value: "teal", label: "Teal" },
  { value: "violet", label: "Violet" },
];
const AVATAR_BG_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "stadium", label: "Stadium" },
  { value: "neon", label: "Neon" },
  { value: "pitch", label: "Pitch" },
  { value: "trophy", label: "Trophy" },
  { value: "night", label: "Night" },
  { value: "derby", label: "Derby" },
  { value: "galaxy", label: "Galaxy" },
];
const FAVORITE_NATION_OPTIONS = [
  { country: "Argentina", flag: "🇦🇷" },
  { country: "Brazil", flag: "🇧🇷" },
  { country: "England", flag: "🏴" },
  { country: "France", flag: "🇫🇷" },
  { country: "Germany", flag: "🇩🇪" },
  { country: "Spain", flag: "🇪🇸" },
  { country: "Portugal", flag: "🇵🇹" },
  { country: "Netherlands", flag: "🇳🇱" },
  { country: "Italy", flag: "🇮🇹" },
  { country: "Sweden", flag: "🇸🇪" },
  { country: "Denmark", flag: "🇩🇰" },
  { country: "Norway", flag: "🇳🇴" },
  { country: "USA", flag: "🇺🇸" },
  { country: "Mexico", flag: "🇲🇽" },
  { country: "Japan", flag: "🇯🇵" },
  { country: "South Korea", flag: "🇰🇷" },
  { country: "Morocco", flag: "🇲🇦" },
  { country: "Croatia", flag: "🇭🇷" },
  { country: "Belgium", flag: "🇧🇪" },
  { country: "Uruguay", flag: "🇺🇾" },
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
  custom: {
    label: "Custom",
    icon: "custom",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "Choose everything manually",
  },
  classic: {
    label: "Classic",
    icon: "classic",
    quizCount: 10,
    top10Count: 0,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "10 quick questions",
  },
  daily_mix: {
    label: "Daily Mix",
    icon: "dailyMix",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 1,
    findPlayerCount: 1,
    findPlayerScoringMode: "attempts",
    description: "5 quiz + Top 10 + mystery + find",
  },
  party_mode: {
    label: "Party Mode",
    icon: "partyMode",
    quizCount: 3,
    top10Count: 2,
    whoamiCount: 2,
    findPlayerCount: 1,
    findPlayerScoringMode: "attempts",
    description: "More chaotic daily mix",
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
const DAILY_STREAK_RESET_HOURS = 30;
const DAILY_STREAK_RESET_MS = DAILY_STREAK_RESET_HOURS * 60 * 60 * 1000;
const DAILY_STREAK_ACTIVITY_KEY = "footballQuizLastDailyActivityAt";

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
  return normalizeAnswerText(text);
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
  return isPlayerAnswerCorrect({
    selectedPlayer: player,
    correctAnswer,
    acceptedAnswers: getAcceptedAnswers(correctAnswer),
  });
}

function isPlayerLike(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !("nativeEvent" in value) &&
      (value.name ||
        value.full_name ||
        value.search_name ||
        Array.isArray(value.aliases))
  );
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

function getSeededIndex(seedText, length) {
  if (!length) return 0;

  let seed = 0;
  for (const char of String(seedText)) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  return seed % length;
}

function getDailyWhoAmIQuestion(dateKey) {
  const questions = Array.isArray(WHO_AM_I_QUESTIONS)
    ? WHO_AM_I_QUESTIONS.filter((question) => question?.id && question?.answer)
    : [];

  return selectDailyWhoAmIQuestion(questions, dateKey) || null;
}

function saveDailyModeResult(mode, dateKey, puzzleId, result) {
  if (!mode || !dateKey || !puzzleId) return;

  const storageKey = `ballKnowledgeDailyModeResult:${mode}:${dateKey}:${puzzleId}`;
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      mode,
      date: dateKey,
      puzzleId,
      ...result,
      updatedAt: new Date().toISOString(),
    })
  );
}

function getDailyModeResult(mode, dateKey, puzzleId) {
  if (!mode || !dateKey || !puzzleId) return null;

  try {
    return JSON.parse(
      localStorage.getItem(`ballKnowledgeDailyModeResult:${mode}:${dateKey}:${puzzleId}`) ||
        "null"
    );
  } catch {
    return null;
  }
}

function isDateKeyBeforeToday(dateKey) {
  return String(dateKey || "") < getDailyDateKey();
}

function isDateKeyAfterToday(dateKey) {
  return String(dateKey || "") > getDailyDateKey();
}

function hasMissedDailyStreakDay(lastPlayedDate, today = getDailyDateKey()) {
  if (!lastPlayedDate) return false;
  return addDaysToDateKey(lastPlayedDate, 1) < today;
}

function getDailyDateKey() {
  return getTodayDateKey();
}

function getYesterdayDateKey() {
  return addDaysToDateKey(getTodayDateKey(), -1);
}

function getTodayChallenge() {
  const validChallenges = (DAILY_LIST_CHALLENGES || []).filter(
    (challenge) => challenge && challenge.disabled !== true && getChallengeAnswers(challenge).length > 0
  );

  if (validChallenges.length === 0) {
    if (import.meta.env?.DEV) {
      console.warn("No valid Daily/Top 10 challenges available");
    }

    return {
      id: "fallback",
      label: "Daily Challenge",
      question: "Challenge unavailable.",
      answers: [],
    };
  }

  return selectDailyChallenge(validChallenges, getDailyDateKey()) || validChallenges[0];
}

function getRawChallengeAnswers(challenge) {
  return Array.isArray(challenge?.answers) ? challenge.answers : [];
}

function getChallengeAnswers(challenge) {
  return getRawChallengeAnswers(challenge).slice(0, TOP_10_REQUIRED_ANSWER_COUNT);
}

function getChallengeTargetCount(challenge) {
  const answerCount = getChallengeAnswers(challenge).length;
  return Math.min(answerCount, TOP_10_REQUIRED_ANSWER_COUNT);
}

function getChallengeRuleHint(challenge) {
  const answerCount = getChallengeAnswers(challenge).length;
  const targetCount = getChallengeTargetCount(challenge);

  if (!answerCount) return "";
  if (targetCount < TOP_10_REQUIRED_ANSWER_COUNT) {
    return `Find ${targetCount}. Any order accepted.`;
  }

  return "Any order accepted.";
}

function getFindPlayerClues(player = {}) {
  if (!player) return [];

  const mainClub =
    (Array.isArray(player.main_clubs) && player.main_clubs[0]) ||
    (Array.isArray(player.clubs) && player.clubs[0]) ||
    "";
  const birthYear = Number(player.birth_year) || null;
  const era = birthYear
    ? birthYear < 1980
      ? "classic/legend era"
      : birthYear < 1990
      ? "2000s into 2010s era"
      : birthYear < 2000
      ? "modern Champions League era"
      : "new generation era"
    : "";

  return [
    player.nationality ? `Nationality: ${player.nationality}` : "",
    player.position_group || player.position
      ? `Position: ${player.position_group || player.position}`
      : "",
    mainClub ? `Known club: ${mainClub}` : "",
    era ? `Era: ${era}` : "",
  ].filter(Boolean);
}

const REQUIRED_PLAYER_SEARCH_NAMES = [
  "Emmanuel Emenike",
  "Jamal Musiala",
  "N'Golo Kanté",
  "Lionel Messi",
  "Claudio Marchisio",
  "Harry Kewell",
  "Kylian Mbappé",
  "Sergio Agüero",
  "Mesut Özil",
  "Luka Modrić",
  "Gerard Piqué",
  "Zlatan Ibrahimović",
  "Kevin De Bruyne",
  "Virgil van Dijk",
];

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

function isDailyStreakExpired(lastActivityAt, now = Date.now()) {
  const timestamp = Number(lastActivityAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return now - timestamp > DAILY_STREAK_RESET_MS;
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
    <motion.div className={`${className} app-page-content`} {...screenTransition}>
      {children}
    </motion.div>
  );
}

function CareerPathQuestionView({ question, className = "" }) {
  const clubs = getCareerPathClubs(question);

  return (
    <div className={`career-journey-card ${className}`}>
      <div className="career-journey-kicker">Guess the player</div>
      <div className="career-journey-path">
        {clubs.map((club, index) => (
          <React.Fragment key={`${club}-${index}`}>
            <motion.div
              className={`career-club-pill club-${getClubThemeClass(club)}`}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.045, duration: 0.2 }}
            >
              {club}
            </motion.div>
            {index < clubs.length - 1 && (
              <div className="career-path-arrow">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
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

function getRandomConnectionsPuzzle(difficulty = null) {
  const puzzles = difficulty
    ? CONNECTIONS_PUZZLES.filter((puzzle) => puzzle.difficulty === difficulty)
    : CONNECTIONS_PUZZLES;

  const safePuzzles = puzzles.length > 0 ? puzzles : CONNECTIONS_PUZZLES;

  return safePuzzles[Math.floor(Math.random() * safePuzzles.length)];
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
    const config = LEAGUE_FORMATS[format] || LEAGUE_FORMATS.custom;
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

function getMultiplayerQuestionTimeLimit(categoryId) {
  return categoryId === "career_path"
    ? MULTIPLAYER_CAREER_TIME_LIMIT
    : MULTIPLAYER_TIME_LIMIT;
}

function getLeagueScoreValue(source, snakeKey, camelKey = snakeKey) {
  return Number(source?.[snakeKey] ?? source?.[camelKey]) || 0;
}

function getLeagueDailyTotal(source) {
  return getLeagueScoreValue(source, "total_points", "totalPoints");
}

function getLeagueScoreItems(source, settings, top10MaxPoints, whoamiMaxPoints, findMaxPoints) {
  if (!source) return [];

  return [
    settings.quizCount > 0
      ? {
          key: "quick",
          label: "Quick",
          value: getLeagueScoreValue(source, "quiz_score", "quizScore"),
          max: settings.quizCount,
          display: `${getLeagueScoreValue(source, "quiz_score", "quizScore")}/${settings.quizCount}`,
        }
      : null,
    settings.top10Count > 0
      ? {
          key: "top10",
          label: "Top 10",
          value: getLeagueScoreValue(source, "top10_score", "top10Score"),
          max: top10MaxPoints,
          display: `${getLeagueScoreValue(source, "top10_score", "top10Score")} pts`,
        }
      : null,
    settings.whoamiCount > 0
      ? {
          key: "whoami",
          label: "Who Am I",
          value: getLeagueScoreValue(source, "whoami_score", "whoamiScore"),
          max: whoamiMaxPoints,
          display: `${getLeagueScoreValue(source, "whoami_score", "whoamiScore")} pts`,
        }
      : null,
    settings.findPlayerCount > 0
      ? {
          key: "find",
          label: "Find",
          value: getLeagueScoreValue(source, "find_player_score", "findPlayerScore"),
          max: findMaxPoints,
          display: `${getLeagueScoreValue(source, "find_player_score", "findPlayerScore")} pts`,
        }
      : null,
  ].filter(Boolean);
}

function getCurrentPlayerSlot(match, playerId, username) {
  if (!match) return null;

  if (match.player1_id && String(match.player1_id) === String(playerId)) return "player1";
  if (match.player2_id && String(match.player2_id) === String(playerId)) return "player2";
  if (match.player1_username === username) return "player1";
  if (match.player2_username === username) return "player2";

  return null;
}

function getOpponentName(match, playerId, username) {
  const playerSlot = getCurrentPlayerSlot(match, playerId, username);

  if (playerSlot === "player1") {
    return match?.player2_username || "your opponent";
  }

  if (playerSlot === "player2") {
    return match?.player1_username || "your opponent";
  }

  return match?.player2_username || match?.player1_username || "your opponent";
}

function isCurrentPlayersTurn(match, playerId, username) {
  if (!match) return false;

  if (match.current_turn_id) {
    return String(match.current_turn_id) === String(playerId);
  }

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

  if (match.is_public && match.phase === "waiting_for_opponent") {
    return match.player2_id
      ? "Waiting for your opponent"
      : "Waiting for random opponent";
  }

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

  if (match.is_public && match.phase === "waiting_for_opponent") {
    return "waiting";
  }

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
  if (match?.is_public && match.phase === "waiting_for_opponent") {
    return match.player2_id ? "Open Match" : "View Saved Score";
  }

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
  const dailyAnswers = getChallengeAnswers(todayChallenge);
  const dailyTargetCount = getChallengeTargetCount(todayChallenge);
  const dailyRuleHint = getChallengeRuleHint(todayChallenge);
  const dailyChallengeUnavailable = dailyAnswers.length === 0;

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
  const [playNowGames, setPlayNowGames] = useState([]);
  const [playNowGamesLoading, setPlayNowGamesLoading] = useState(false);
  const [playNowCategory, setPlayNowCategory] = useState("general");
  const [matchDeleteCandidate, setMatchDeleteCandidate] = useState(null);
  const [deletingMatchId, setDeletingMatchId] = useState(null);
  const [multiplayerNotice, setMultiplayerNotice] = useState("");
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [leagueDurationInput, setLeagueDurationInput] = useState(null);
  const [leagueFormatInput, setLeagueFormatInput] = useState("custom");
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
  const [leagueLeaveConfirmOpen, setLeagueLeaveConfirmOpen] = useState(false);
  const [leagueExitConfirmOpen, setLeagueExitConfirmOpen] = useState(false);
  const [leagueAttemptSubmitting, setLeagueAttemptSubmitting] = useState(false);
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
  const [leagueFindPlayerClueCount, setLeagueFindPlayerClueCount] = useState(0);
  const leagueFindPlayerSubmittingRef = useRef(false);
  const [leagueResult, setLeagueResult] = useState(null);
  const [isMockMultiplayer, setIsMockMultiplayer] = useState(false);
  const [mockOpponentScore, setMockOpponentScore] = useState(null);
  const [coinsMenuOpen, setCoinsMenuOpen] = useState(false);
  const [coinShopNotice, setCoinShopNotice] = useState("");
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [xpToast, setXpToast] = useState(null);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [levelLeaderboardRows, setLevelLeaderboardRows] = useState([]);
  const [leaderboardTab, setLeaderboardTab] = useState("general");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [gameMode, setGameMode] = useState("general");
  const [authSession, setAuthSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [guestMode, setGuestMode] = useState(
    () => localStorage.getItem("ballKnowledgeGuestMode") === "true"
  );
  const [authPrompt, setAuthPrompt] = useState(null);

  const [username, setUsername] = useState(() => {
    return localStorage.getItem("ballKnowledgeUsername") || "";
  });

  const [guestPlayerId] = useState(getOrCreatePlayerId);
  const effectiveAuthUser = authUser || authSession?.user || null;
  const effectiveAuthUserId = effectiveAuthUser?.id || null;
  const playerId = effectiveAuthUser?.id || guestPlayerId;
  const isGuest = !effectiveAuthUser;
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("local");
  const [profileError, setProfileError] = useState("");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [profileLookup, setProfileLookup] = useState({});
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [avatarEmoji, setAvatarEmoji] = useState(() => {
    return localStorage.getItem("ballKnowledgeAvatarEmoji") || "profile";
  });
  const [favoriteCountry, setFavoriteCountry] = useState(() => {
    return localStorage.getItem("ballKnowledgeFavoriteCountry") || "Argentina";
  });
  const [favoriteFlag, setFavoriteFlag] = useState(() => {
    return localStorage.getItem("ballKnowledgeFavoriteFlag") || "🇦🇷";
  });

  const [nameInput, setNameInput] = useState(() => {
    return localStorage.getItem("ballKnowledgeUsername") || "";
  });

  const [questions, setQuestions] = useState(() =>
    buildGameQuestions("general")
  );

  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    if (document.body.classList.contains("capacitor-ios")) return undefined;

    let cancelled = false;
    const runStartupAudits = async () => {
      const contentWarnings = auditDailyListChallenges();

      if (contentWarnings.length) {
        console.warn("Daily/Top 10 content audit warnings", contentWarnings);
      }

      const missing = [];
      const targets = [
        ...CAREER_QUESTIONS.map((question) => ({
          mode: "career",
          id: question.id || question.question,
          answer: question.answer,
        })),
        ...WHO_AM_I_QUESTIONS.map((question) => ({
          mode: "who-am-i",
          id: question.id || question.answer,
          answer: question,
        })),
        ...DAILY_LIST_CHALLENGES.filter(isPlayerAnswerType).flatMap((challenge) =>
          getChallengeAnswers(challenge).map((answer, index) => ({
            mode: "daily-list",
            id: `${challenge.id || "daily"}:${index}`,
            answer,
          }))
        ),
        ...REQUIRED_PLAYER_SEARCH_NAMES.map((answer) => ({
          mode: "required-player",
          id: answer,
          answer,
        })),
      ];

      for (const target of targets) {
        const answerLabel = getAnswerLabel(target.answer);
        if (!answerLabel) continue;
        const { players } = await searchPlayersLazy(answerLabel, 8);
        const found = players.some((player) =>
          isPlayerAnswerCorrect({
            selectedPlayer: player,
            correctAnswer: target.answer,
          })
        );

        if (!found) {
          const { players: closeMatches } = await searchPlayersLazy(answerLabel.split(" ").at(-1), 4);
          missing.push({
            mode: target.mode,
            id: target.id,
            answer: answerLabel,
            closest: closeMatches.map((player) => player.name),
          });
        }
      }

      if (!cancelled && missing.length) {
        console.warn("Player-answer content missing from shared search index", missing);
      }
    };

    const auditTimer = window.setTimeout(() => {
      runStartupAudits().catch((error) => {
        console.warn("Startup content audits failed", error);
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(auditTimer);
    };
  }, []);

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
  const [postGameStep, setPostGameStep] = useState("summary");

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
  const [lastDailyActivityAt, setLastDailyActivityAt] = useState(() => {
    return Number(localStorage.getItem(DAILY_STREAK_ACTIVITY_KEY)) || 0;
  });

  const [streakRewardEarned, setStreakRewardEarned] = useState(0);
  const [showDailyCompletePopup, setShowDailyCompletePopup] = useState(false);
  const [dailyRewardMeterOpen, setDailyRewardMeterOpen] = useState(false);

  const [levelUpPopup, setLevelUpPopup] = useState(null);
  const [connectionsPuzzle, setConnectionsPuzzle] = useState(null);
  const [connectionsDifficultyPickerOpen, setConnectionsDifficultyPickerOpen] = useState(false);
  const [connectionsTiles, setConnectionsTiles] = useState([]);
  const [connectionsSelected, setConnectionsSelected] = useState([]);
  const [connectionsSolved, setConnectionsSolved] = useState([]);
  const [connectionsMistakes, setConnectionsMistakes] = useState(0);
  const [connectionsFeedback, setConnectionsFeedback] = useState(null);
  const [connectionsShake, setConnectionsShake] = useState(0);
  const [connectionsRewardClaimed, setConnectionsRewardClaimed] =
    useState(false);
  const [connectionsRewardModal, setConnectionsRewardModal] = useState(null);
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
  const [whoAmIDate, setWhoAmIDate] = useState(getDailyDateKey);
  const [findPlayerPool, setFindPlayerPool] = useState([]);
  const [findPlayerTarget, setFindPlayerTarget] = useState(null);
  const [findPlayerSelected, setFindPlayerSelected] = useState(null);
  const [findPlayerGuesses, setFindPlayerGuesses] = useState([]);
  const [findPlayerStatus, setFindPlayerStatus] = useState("idle");
  const [findPlayerError, setFindPlayerError] = useState("");
  const [findPlayerStartedAt, setFindPlayerStartedAt] = useState(null);
  const [findPlayerElapsed, setFindPlayerElapsed] = useState(0);
  const [findPlayerDate, setFindPlayerDate] = useState(getDailyDateKey);
  const [findPlayerClueCount, setFindPlayerClueCount] = useState(0);
  const findPlayerSubmittingRef = useRef(false);

  const current = questions[questionIndex];
  const currentWhoAmI = whoAmIQuestions[whoAmIIndex];
  const currentQuestionNumber = questionIndex + 1;
  const currentRoundQuestionNumber = ((questionIndex % 10) + 1);
  const currentQuestionProgress =
    gameMode === "general" && !isMockMultiplayer
      ? getStreakProgress(streak)
      : Math.min(100, (currentRoundQuestionNumber / 10) * 100);
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
  const profileAvatarEmoji = profile?.avatar_icon || profile?.avatar_emoji || avatarEmoji || "profile";
  const profileAvatar = getAvatarConfig({
    ...(profile || {}),
    avatar_icon: profile?.avatar_icon || profileAvatarEmoji,
    avatar_emoji: profile?.avatar_emoji || profileAvatarEmoji,
    avatar_style: profile?.avatar_style || "classic",
    avatar_color: profile?.avatar_color || "green",
    avatar_bg: profile?.avatar_bg || "dark",
    favorite_country: profile?.favorite_country || favoriteCountry,
    favorite_flag: profile?.favorite_flag || favoriteFlag,
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
  const xpProgressPercent = xpObjective?.required
    ? Math.min(100, (Math.max(0, Number(xpTotal) || 0) / xpObjective.required) * 100)
    : progressionView.objectiveProgress;
  const xpProgressLabel = xpObjective?.required
    ? `${Math.min(Number(xpTotal) || 0, xpObjective.required).toLocaleString()} / ${xpObjective.required.toLocaleString()} XP`
    : `${(Number(xpTotal) || 0).toLocaleString()} XP`;
  const completedObjectiveCount = progressionView.objectives.filter(
    (objective) => objective.complete
  ).length;
  const levelObjectiveSummary = `${completedObjectiveCount}/${progressionView.objectives.length} objectives`;
  const generalRunXpTotal =
    generalRunXpSummary.correct +
    generalRunXpSummary.streak +
    generalRunXpSummary.highscore;
  const currentHomeViewKey = connectionsDifficultyPickerOpen
  ? "connections-difficulty"
  : profileOpen
  ? "profile"
  : leaderboardOpen
  ? "leaderboard"
  : multiplayerOpen
  ? `multiplayer-${multiplayerStep}`
  : modeMenuOpen
  ? "mode-menu"
  : "home";

  useEffect(() => {
    const iosLayoutDebug =
      import.meta.env?.DEV ||
      document.body.classList.contains("capacitor-ios-debug");

    if (!iosLayoutDebug) {
      return;
    }

    const pageName = leagueChallengeOpen
      ? `league-challenge:${leagueChallengePhase}`
      : gameStarted
      ? gameMode
      : currentHomeViewKey;

    console.log("[ios-page]", pageName);
    console.log("[ios-layout]", "mounted", pageName);
  }, [currentHomeViewKey, gameMode, gameStarted, leagueChallengeOpen, leagueChallengePhase]);

  useEffect(() => {
    const playerHeavyMode =
      gameStarted &&
      ["who-am-i", "find-player", "career", "daily-list"].includes(gameMode);

    if (playerHeavyMode || leagueChallengeOpen) {
      preloadPlayerSearchLazy();
    }
  }, [gameMode, gameStarted, leagueChallengeOpen]);

const isHomeScreen =
  !gameStarted &&
  !profileOpen &&
  !leaderboardOpen &&
  !multiplayerOpen &&
  !modeMenuOpen &&
  !connectionsDifficultyPickerOpen;
  const hasBothMultiplayerPlayers =
    Boolean(activeMatch?.player1_username) && Boolean(activeMatch?.player2_username);
  const isMultiplayerTurn = isCurrentPlayersTurn(activeMatch, playerId, username);
  const isH2HCreatorOpeningRound =
    activeMatch &&
    !activeMatch.is_public &&
    !activeMatch.player2_id &&
    activeMatch.phase === "choose_category" &&
    getCurrentPlayerSlot(activeMatch, playerId, username) === "player1";
  const canChooseMultiplayerCategory =
    (hasBothMultiplayerPlayers || isH2HCreatorOpeningRound) &&
    (activeMatch?.phase === "choose_category" ||
      activeMatch?.phase === "round_finished") &&
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
  const isH2HWaitingAfterCreatorRound =
    activeMatch &&
    !activeMatch.is_public &&
    !activeMatch.player2_id &&
    multiplayerPlayerSlot === "player1" &&
    activeMatch.phase === "round_active" &&
    hasPlayedActiveRound;
  const activeRoundQuestionIds = activeRound?.question_ids || [];
  const activeRoundQuestions = useMemo(
    () => getMultiplayerQuestionsByIds(activeRoundQuestionIds).map(withShuffledOptions),
    [activeRoundQuestionIds]
  );
  const currentMultiplayerRoundQuestion =
    activeRoundQuestions[multiplayerRoundIndex];
  const nextCategoryChooserName =
    activeMatch?.current_turn ||
    (isMultiplayerTurn ? username : getOpponentName(activeMatch, playerId, username));
  const nextCategoryWaitingName =
    nextCategoryChooserName && nextCategoryChooserName !== "Opponent"
      ? nextCategoryChooserName
      : "your opponent";
  const activeOpponentName = getOpponentName(activeMatch, playerId, username);
  const activeOpponentLabel =
    activeOpponentName && activeOpponentName !== "your opponent"
      ? activeOpponentName
      : "your opponent";

  useEffect(() => {
    const shouldLog =
      import.meta.env?.DEV ||
      document.body.classList.contains("capacitor-ios-debug");

    if (!shouldLog || !activeMatch?.id || activeMatch.phase !== "round_finished") {
      return;
    }

    console.log("[mp-next-category]", {
      currentUserId: playerId,
      nextChooserId: activeMatch.current_turn_id,
      isCurrentUserChooser: isMultiplayerTurn,
      matchId: activeMatch.id,
      roundNumber: activeMatch.round_number || activeRound?.round_number,
      phase: activeMatch.phase,
      status: activeMatch.status,
    });
  }, [
    activeMatch?.id,
    activeMatch?.current_turn_id,
    activeMatch?.phase,
    activeMatch?.round_number,
    activeMatch?.status,
    activeRound?.round_number,
    isMultiplayerTurn,
    playerId,
  ]);

  useEffect(() => {
    const shouldLog =
      import.meta.env?.DEV ||
      document.body.classList.contains("capacitor-ios-debug");

    if (!shouldLog || !activeMatch?.id || !activeMatch.is_public) {
      return;
    }

    const playerSlot = getCurrentPlayerSlot(activeMatch, playerId, username);
    const opponentSlot = playerSlot === "player1" ? "player2" : "player1";

    console.log("[play-now-match-flow]", {
      matchId: activeMatch.id,
      mode: activeMatch.mode,
      currentUserId: playerId,
      player1Id: activeMatch.player1_id,
      player2Id: activeMatch.player2_id,
      opponentId:
        opponentSlot === "player1" ? activeMatch.player1_id : activeMatch.player2_id,
      opponentName: getOpponentName(activeMatch, playerId, username),
      roundNumber: activeMatch.round_number || activeRound?.round_number,
      phase: activeMatch.phase,
      status: activeMatch.status,
      nextChooserId: activeMatch.current_turn_id,
      isCurrentUserChooser: isMultiplayerTurn,
    });
  }, [
    activeMatch?.id,
    activeMatch?.mode,
    activeMatch?.player1_id,
    activeMatch?.player2_id,
    activeMatch?.round_number,
    activeMatch?.phase,
    activeMatch?.status,
    activeMatch?.current_turn_id,
    activeMatch?.is_public,
    activeRound?.round_number,
    isMultiplayerTurn,
    playerId,
    username,
  ]);
  const activeLeague = leagueDashboard?.league || null;
  const activeLeagueDay = leagueDashboard?.leagueDay || null;
  const activeLeagueSubmission = leagueDashboard?.currentSubmission || null;
  const currentLeagueQuizQuestion = leagueQuizQuestions[leagueQuizIndex];
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
  const leagueTop10Score = leagueTop10Found.length;
  const leagueTop10TargetCount = getChallengeTargetCount(leagueTop10Challenge);
  const leagueTop10MaxPoints =
    leagueTop10Challenges.reduce(
      (total, challenge) => total + getChallengeTargetCount(challenge),
      0
    ) || leagueSettings.top10Count * 10;
  const leagueTop10TotalWithCurrent = leagueTop10TotalScore + leagueTop10Score;
  const isLeagueTop10PlayerChallenge = isPlayerAnswerType(leagueTop10Challenge);
  const currentLeagueWhoAmI = leagueWhoAmIQuestions[leagueWhoAmIIndex];
  const leagueWhoAmIVisibleClues = currentLeagueWhoAmI
    ? currentLeagueWhoAmI.clues.slice(0, leagueWhoAmIClueIndex + 1)
    : [];
  const leagueWhoAmIPointsAvailable = Math.max(1, 10 - leagueWhoAmIClueIndex);
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
  const findPlayerClues = useMemo(
    () => getFindPlayerClues(findPlayerTarget),
    [findPlayerTarget]
  );
  const leagueFindPlayerClues = useMemo(
    () => getFindPlayerClues(currentLeagueFindPlayerTarget),
    [currentLeagueFindPlayerTarget]
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

    playNowGames.forEach(({ match }) => {
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
  }, [activeGames, playNowGames, activeMatch, leagueDashboard, leaderboardRows]);

  useEffect(() => {
    if (!multiplayerRoundOpen || !currentMultiplayerRoundQuestion) return;

    setMultiplayerTimeLeft(getMultiplayerQuestionTimeLimit(activeRound?.category));
  }, [
    activeRound?.category,
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
          setMultiplayerTimeLeft(getMultiplayerQuestionTimeLimit(activeRound?.category));
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
    activeRound?.category,
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
    if (!isLeagueAttemptLocked()) return;

    saveLeagueAttempt();
  }, [
    leagueChallengeOpen,
    leagueChallengePhase,
    activeLeague?.id,
    activeLeagueDay?.id,
    leagueQuizScore,
    leagueTop10TotalWithCurrent,
    leagueWhoAmIScore,
    leagueFindPlayerScore,
    leagueFindPlayerAttemptTotal,
    leagueFindPlayerGuesses.length,
    leagueFindPlayerElapsed,
  ]);

  useEffect(() => {
    if (!isLeagueAttemptLocked()) return undefined;

    const handleBeforeUnload = (event) => {
      saveLeagueAttempt();
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    leagueChallengeOpen,
    leagueChallengePhase,
    activeLeague?.id,
    activeLeagueDay?.id,
    leagueQuizScore,
    leagueTop10TotalWithCurrent,
    leagueWhoAmIScore,
    leagueFindPlayerScore,
    leagueFindPlayerAttemptTotal,
    leagueFindPlayerGuesses.length,
    leagueFindPlayerElapsed,
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
    if (postGameStep === "xp") return;
    if (finished && gameMode === "general" && !isMockMultiplayer) return;

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
    postGameStep,
    finished,
    gameMode,
    isMockMultiplayer,
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
    if (postGameStep !== "xp") return;
    if (gameStarted) return;
    if (["general", "world-cup", "career"].includes(gameMode)) return;

    console.error("Invalid post-game progression state; recovering to home", {
      gameMode,
      postGameStep,
    });
    setPostGameStep("summary");
    setFinished(false);
    setGameStarted(false);
  }, [postGameStep, gameStarted, gameMode]);

  useEffect(() => {
    if (!gameStarted) return;
    if (!["general", "world-cup", "career"].includes(gameMode)) return;
    if (current) return;

    exitToHomeSafely("invalid-state");
  }, [gameStarted, gameMode, current]);

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

  useEffect(() => {
    if (
      !finished ||
      !gameStarted ||
      gameMode !== "general" ||
      isMockMultiplayer ||
      isGuest
    ) {
      return;
    }

    const onlineBestScore = Number(profile?.best_score) || 0;
    const nextBestScore = Math.max(score, highScore, onlineBestScore);

    if (nextBestScore <= onlineBestScore) return;

    updateOnlineProfile(
      {
        best_score: nextBestScore,
        coins,
        daily_streak: dailyStreak,
        xp_total: xpTotal,
        level_id: careerLevelId,
        progression_stats: {
          ...progressionStats,
          best_general_score: Math.max(
            Number(progressionStats.best_general_score) || 0,
            nextBestScore
          ),
        },
      },
      "ready"
    );
  }, [
    finished,
    gameStarted,
    gameMode,
    isMockMultiplayer,
    isGuest,
    score,
    highScore,
    profile?.best_score,
    coins,
    dailyStreak,
    xpTotal,
    careerLevelId,
    progressionStats,
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
      if (
        event.target.closest("button") &&
        typeof navigator !== "undefined" &&
        "vibrate" in navigator
      ) {
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
      isTimedQuestion && !selected && !rewardPopup && !objectiveProgressUpdate;

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
    objectiveProgressUpdate,
    current?.answer,
  ]);

  const playClickSound = () => {
    playButtonTapSound();
  };

  const showAuthPrompt = (message = "Create an account to save progress and compete.") => {
    playClickSound();
    setAuthPrompt(message);
    setAuthMode("signup");
    setAuthError("");
    setAuthNotice("");
  };

  const requireAccount = (message) => {
    if (!isGuest) return true;

    showAuthPrompt(message);
    return false;
  };

  const continueAsGuest = () => {
    playClickSound();
    const storedGuestName = localStorage.getItem("ballKnowledgeUsername");
    const guestName =
      username ||
      storedGuestName ||
      `Guest-${String(guestPlayerId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 5)}`;

    localStorage.setItem("ballKnowledgeGuestMode", "true");
    localStorage.setItem("ballKnowledgeUsername", guestName);
    setGuestMode(true);
    setUsername(guestName);
    setNameInput(guestName);
    setAuthPrompt(null);
    setAuthError("");
    setAuthNotice("");
  };

  const resetAuthFormFeedback = () => {
    setAuthError("");
    setAuthNotice("");
  };

  const prepareAuthenticatedIdentity = (user, fallbackUsername = "") => {
    const metadata = user?.user_metadata || {};
    const loadingName =
      fallbackUsername || metadata.username || metadata.display_name || "Loading profile...";

    setGuestMode(false);
    localStorage.removeItem("ballKnowledgeGuestMode");
    setProfile(null);
    setProfileStatus("syncing");
    setProfileError("");
    setUsername(loadingName);
    setNameInput(loadingName === "Loading profile..." ? "" : loadingName);
    setAuthPrompt(null);
  };

  const applyProfileToLocalState = (onlineProfile) => {
    if (!onlineProfile) return;

    const profileUsername =
      onlineProfile.display_name || onlineProfile.username || username;

    setProfile(onlineProfile);
    setUsername(profileUsername);
    setNameInput(profileUsername);
    localStorage.setItem("ballKnowledgeUsername", profileUsername);
    setAvatarEmoji(
      onlineProfile.avatar_icon || onlineProfile.avatar_emoji || avatarEmoji || "profile"
    );
    localStorage.setItem(
      "ballKnowledgeAvatarEmoji",
      onlineProfile.avatar_icon || onlineProfile.avatar_emoji || avatarEmoji || "profile"
    );
    setFavoriteCountry(onlineProfile.favorite_country || favoriteCountry || "Argentina");
    setFavoriteFlag(onlineProfile.favorite_flag || favoriteFlag || "🇦🇷");
    localStorage.setItem(
      "ballKnowledgeFavoriteCountry",
      onlineProfile.favorite_country || favoriteCountry || "Argentina"
    );
    localStorage.setItem(
      "ballKnowledgeFavoriteFlag",
      onlineProfile.favorite_flag || favoriteFlag || "🇦🇷"
    );
    setHighScore((score) => Math.max(score, Number(onlineProfile.best_score) || 0));
    setCoins((value) => Math.max(value, Number(onlineProfile.coins) || 0));
    const onlineStreak = Number(onlineProfile.daily_streak) || 0;
    const onlineProgressionStats = onlineProfile.progression_stats || {};
    const onlineActivityAt = Number(
      onlineProgressionStats.lastDailyActivityAt || 0
    );
    const onlineLastDailyPlayedDate =
      onlineProgressionStats.lastDailyPlayedDate || "";
    const onlineDailyListCompletion =
      onlineProgressionStats.dailyCompletions?.daily_list?.[getDailyDateKey()];
    const storedActivityAt =
      onlineActivityAt || Number(localStorage.getItem(DAILY_STREAK_ACTIVITY_KEY)) || 0;
    const storedLastDailyPlayedDate =
      onlineLastDailyPlayedDate ||
      localStorage.getItem("footballQuizLastDailyPlayedDate") ||
      "";
    const expired =
      hasMissedDailyStreakDay(storedLastDailyPlayedDate) ||
      isDailyStreakExpired(storedActivityAt);
    const hydratedStreak = expired ? 0 : onlineStreak;

    setDailyStreak((value) => (expired ? 0 : Math.max(value, hydratedStreak)));
    if (storedLastDailyPlayedDate) {
      setLastDailyPlayedDate(storedLastDailyPlayedDate);
      localStorage.setItem("footballQuizLastDailyPlayedDate", storedLastDailyPlayedDate);
    }
    if (onlineDailyListCompletion) {
      setDailyPlayed(true);
      localStorage.setItem("ballKnowledgeDailyDate", getDailyDateKey());
      localStorage.setItem(
        "ballKnowledgeDailyResult",
        JSON.stringify({
          date: getDailyDateKey(),
          title: onlineDailyListCompletion.title || "Daily Challenge",
          found: Number(onlineDailyListCompletion.found) || 0,
          total: Number(onlineDailyListCompletion.total) || 0,
          coins: Number(onlineDailyListCompletion.coins) || 0,
          streak: hydratedStreak,
          restoredFromProfile: true,
        })
      );
    }
    if (storedActivityAt) {
      setLastDailyActivityAt(storedActivityAt);
      localStorage.setItem(DAILY_STREAK_ACTIVITY_KEY, String(storedActivityAt));
    }
    hydrateProgressionFromProfile(onlineProfile);
    setProfileStatus("ready");
    setProfileError("");
  };

  const applyAuthFallbackIdentity = (user, fallbackUsername = "") => {
    const metadata = user?.user_metadata || {};
    const fallback =
      fallbackUsername ||
      metadata.username ||
      metadata.display_name ||
      user?.email?.split("@")[0] ||
      "Player";

    setUsername(fallback);
    setNameInput(fallback);
    localStorage.setItem("ballKnowledgeUsername", fallback);
  };

  const ensureProfileForAuthUser = async (user, fallbackUsername = "") => {
    if (!user || !isSupabaseConfigured || !supabase) return null;

    const metadata = user.user_metadata || {};
    const preferredUsername =
      fallbackUsername ||
      metadata.username ||
      metadata.display_name ||
      user.email?.split("@")[0] ||
      "ball.knowledge";

    const { profile: existingProfile, error: fetchError } = await fetchProfile(
      supabase,
      user.id
    );

    if (fetchError) {
      console.warn("Could not load auth profile", fetchError);
      applyAuthFallbackIdentity(user, preferredUsername);
      setProfileStatus("local");
      setProfileError("");
      return null;
    }

    if (existingProfile) {
      const mergedUpdates = mergeLocalProgressIntoProfile(existingProfile, {
        highScore,
        coins,
        dailyStreak,
        xpTotal,
        levelId: careerLevelId,
      progressionStats,
      avatarEmoji,
      favoriteCountry,
      favoriteFlag,
    });
      const { profile: mergedProfile, error: mergeError } = await updateProfile(
        supabase,
        user.id,
        mergedUpdates
      );
      const safeProfile = mergeError ? existingProfile : mergedProfile || existingProfile;

      applyProfileToLocalState(safeProfile);
      return safeProfile;
    }

    const defaultProfile = getDefaultProfile({
      playerId: user.id,
      username: preferredUsername,
      avatarEmoji,
      favoriteCountry,
      favoriteFlag,
      highScore,
      coins,
      dailyStreak,
    });

    const { profile: createdProfile, error: createError } = await createProfile(
      supabase,
      {
        ...defaultProfile,
        username_normalized: normalizeUsername(preferredUsername),
        xp_total: xpTotal,
        level_id: careerLevelId,
        progression_stats: progressionStats,
        favorite_country: favoriteCountry,
        favorite_flag: favoriteFlag,
      }
    );

    if (createError) {
      console.warn("Could not create auth profile", createError);
      applyAuthFallbackIdentity(user, preferredUsername);
      setProfileStatus(isNonBlockingProfileError(createError) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(createError) ? "" : getProfileErrorMessage(createError)
      );
      return null;
    }

    applyProfileToLocalState(createdProfile);
    return createdProfile;
  };

  const submitAuthForm = async (event) => {
    event?.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setAuthError("Online accounts are unavailable right now");
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");
    setAuthNotice("");

    const result =
      authMode === "signup"
        ? await signUpWithEmailUsername(supabase, {
            email: authEmail,
            password: authPassword,
            username: authUsername,
          })
        : await signInWithEmail(supabase, {
            email: authEmail,
            password: authPassword,
          });

    if (result.error) {
      setAuthSubmitting(false);
      const message = String(result.error.message || "").toLowerCase();
      setAuthError(
        message.includes("duplicate") ||
          message.includes("conflict") ||
          message.includes("already")
          ? "That username or email is already taken"
          : result.error.message || "Could not authenticate"
      );
      return;
    }

    if (result.session?.user || result.user) {
      const nextUser = result.session?.user || result.user;
      const preferredUsername = result.username || authUsername;

      setAuthSession(result.session || null);
      setAuthUser(nextUser);
      prepareAuthenticatedIdentity(nextUser, preferredUsername);
      await ensureProfileForAuthUser(nextUser, preferredUsername);
      setAuthNotice(authMode === "signup" ? "Account created" : "Welcome back");
    } else {
      setAuthNotice("Check your email to confirm your account, then log in.");
    }

    setAuthSubmitting(false);
  };

  const logout = async () => {
    playClickSound();
    await signOut(supabase);
    setAuthSession(null);
    setAuthUser(null);
    setProfile(null);
    setProfileStatus("local");
    setProfileError("");
    setGuestMode(false);
    localStorage.removeItem("ballKnowledgeGuestMode");
    localStorage.removeItem("ballKnowledgeUsername");
    setUsername("");
    setNameInput("");
    setAuthMode("login");
    setAuthEmail("");
    setAuthPassword("");
    setAuthUsername("");
    setAuthError("");
    setAuthNotice("");
    setAuthPrompt(null);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setLeaderboardOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);
  };

  const switchAccount = () => {
    playClickSound();
    setAuthSession(null);
    setAuthUser(null);
    setProfile(null);
    setProfileStatus("local");
    setProfileError("");
    setGuestMode(false);
    localStorage.removeItem("ballKnowledgeGuestMode");
    setUsername("");
    setNameInput("");
    setAuthMode("login");
    setAuthEmail("");
    setAuthPassword("");
    setAuthUsername("");
    setAuthError("");
    setAuthNotice("");
    setAuthPrompt(null);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setLeaderboardOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);
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

  const isNonBlockingProfileError = (error) => {
    const status = Number(error?.status || error?.code);
    const message = String(error?.message || "").toLowerCase();

    return (
      status === 400 ||
      status === 409 ||
      error?.code === "23505" ||
      message.includes("duplicate") ||
      message.includes("conflict")
    );
  };

  const getLeagueErrorMessage = (error, fallback = "Could not create league") => {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "");
    const status = Number(error?.status);

    if (
      status === 401 ||
      status === 403 ||
      code === "42501" ||
      message.includes("row-level security") ||
      message.includes("permission denied") ||
      message.includes("violates row-level security")
    ) {
      return effectiveAuthUser
        ? `League save was blocked by Supabase policy: ${error?.message || "permission denied"}`
        : "Create an account to save and manage leagues.";
    }

    if (message.includes("league challenge columns") || message.includes("latest league sql")) {
      return "League database needs the latest SQL migration.";
    }

    if (message.includes("not found")) return "League not found";
    if (message.includes("duplicate")) return "That league already exists";

    return error?.message || fallback;
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
      console.warn("Online profile unavailable; using local profile", fetchError);
      setProfileStatus(isNonBlockingProfileError(fetchError) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(fetchError) ? "" : getProfileErrorMessage(fetchError)
      );
      return null;
    }

    if (existingProfile) {
      setProfile(existingProfile);
      hydrateProgressionFromProfile(existingProfile);
      setAvatarEmoji(existingProfile.avatar_icon || existingProfile.avatar_emoji || "profile");
      localStorage.setItem(
        "ballKnowledgeAvatarEmoji",
        existingProfile.avatar_icon || existingProfile.avatar_emoji || "profile"
      );
      setFavoriteCountry(existingProfile.favorite_country || favoriteCountry || "Argentina");
      setFavoriteFlag(existingProfile.favorite_flag || favoriteFlag || "🇦🇷");
      localStorage.setItem(
        "ballKnowledgeFavoriteCountry",
        existingProfile.favorite_country || favoriteCountry || "Argentina"
      );
      localStorage.setItem(
        "ballKnowledgeFavoriteFlag",
        existingProfile.favorite_flag || favoriteFlag || "🇦🇷"
      );
      setProfileStatus("ready");
      return existingProfile;
    }

    const defaultProfile = getDefaultProfile({
      playerId,
      username: nextUsername,
      avatarEmoji,
      favoriteCountry,
      favoriteFlag,
      highScore,
      coins,
      dailyStreak,
    });

    const { profile: createdProfile, error: createError } = await createProfile(
      supabase,
      defaultProfile
    );

    if (createError) {
      console.warn("Online profile could not be created; using local profile", createError);
      setProfileStatus(isNonBlockingProfileError(createError) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(createError) ? "" : getProfileErrorMessage(createError)
      );
      return null;
    }

    setProfile(createdProfile);
    hydrateProgressionFromProfile(createdProfile);
    setAvatarEmoji(createdProfile.avatar_icon || createdProfile.avatar_emoji || "profile");
    localStorage.setItem(
      "ballKnowledgeAvatarEmoji",
      createdProfile.avatar_icon || createdProfile.avatar_emoji || "profile"
    );
    setFavoriteCountry(createdProfile.favorite_country || favoriteCountry || "Argentina");
    setFavoriteFlag(createdProfile.favorite_flag || favoriteFlag || "🇦🇷");
    localStorage.setItem(
      "ballKnowledgeFavoriteCountry",
      createdProfile.favorite_country || favoriteCountry || "Argentina"
    );
    localStorage.setItem(
      "ballKnowledgeFavoriteFlag",
      createdProfile.favorite_flag || favoriteFlag || "🇦🇷"
    );
    setProfileStatus("ready");
    return createdProfile;
  };

  const updateOnlineProfile = async (updates, successStatus = "ready") => {
    if (!isSupabaseConfigured || !supabase || !username) {
      return null;
    }

    const baseProfile = profile || (await ensureOnlineProfile(username));

    if (!baseProfile) return null;

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      updates
    );

    if (error) {
      console.warn("Online profile update unavailable", error);
      setProfileStatus(isNonBlockingProfileError(error) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(error) ? "" : getProfileErrorMessage(error)
      );
      return null;
    }

    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...(updatedProfile || {}),
      ...updates,
    }));
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
    const previousProfile = profile;
    const previousAvatar = profileAvatar;
    const updates = {
      avatar_emoji: nextAvatar.icon,
      avatar_icon: nextAvatar.icon,
      avatar_style: nextAvatar.style,
      avatar_color: nextAvatar.color,
      avatar_bg: nextAvatar.bg,
      favorite_country: nextAvatar.country,
      favorite_flag: nextAvatar.flag,
    };

    setAvatarEmoji(nextAvatar.icon);
    setFavoriteCountry(nextAvatar.country);
    setFavoriteFlag(nextAvatar.flag);
    localStorage.setItem("ballKnowledgeAvatarEmoji", nextAvatar.icon);
    localStorage.setItem("ballKnowledgeFavoriteCountry", nextAvatar.country);
    localStorage.setItem("ballKnowledgeFavoriteFlag", nextAvatar.flag);
    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...updates,
    }));

    const updatedProfile = await updateOnlineProfile(updates);

    if (!updatedProfile && !isGuest && isSupabaseConfigured && supabase) {
      setProfile(previousProfile);
      setAvatarEmoji(previousAvatar.icon);
      setFavoriteCountry(previousAvatar.country);
      setFavoriteFlag(previousAvatar.flag);
      localStorage.setItem("ballKnowledgeAvatarEmoji", previousAvatar.icon);
      localStorage.setItem("ballKnowledgeFavoriteCountry", previousAvatar.country);
      localStorage.setItem("ballKnowledgeFavoriteFlag", previousAvatar.flag);
      setAvatarNotice("Could not save avatar online. Try again.");
      return;
    }

    setAvatarNotice("Avatar saved");
    setAvatarPickerOpen(false);
  };

  const loadGeneralLeaderboard = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLeaderboardRows([]);
      setLevelLeaderboardRows([]);
      setLeaderboardError("Online leaderboard is unavailable");
      return;
    }

    setLeaderboardLoading(true);
    setLeaderboardError("");

    if (username && username !== "Loading profile...") {
      await ensureOnlineProfile(username);

      if (Number(highScore) > 0) {
        const savedLeaderboardProfile = await updateOnlineProfile(
          {
            best_score: highScore,
            coins,
            daily_streak: dailyStreak,
            xp_total: xpTotal,
            level_id: careerLevelId,
            progression_stats: {
              ...progressionStats,
              best_general_score: Math.max(
                Number(progressionStats.best_general_score) || 0,
                Number(highScore) || 0
              ),
            },
          },
          "ready"
        );

        if (!savedLeaderboardProfile && !isGuest) {
          console.error("Could not save leaderboard score to Supabase profile", {
            playerId,
            highScore,
            hasAuthUser: Boolean(effectiveAuthUser),
          });
        }
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .gt("best_score", 0)
      .order("best_score", { ascending: false })
      .limit(100);
    const { data: levelData, error: levelError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .limit(100);

    setLeaderboardLoading(false);

    if (error) {
      console.error("Could not load leaderboard profiles", error);
      setLeaderboardRows([]);
      setLeaderboardError(getProfileErrorMessage(error));
      return;
    }

    const medals = ["1", "2", "3"];
    setLeaderboardRows(
      (data || [])
        .filter((row) => (Number(row.best_score) || 0) > 0)
        .sort((a, b) => (Number(b.best_score) || 0) - (Number(a.best_score) || 0))
        .slice(0, 10)
        .map((row, index) => ({
          ...row,
          username: row.display_name || row.username || "Player",
          score: row.best_score || 0,
          rank: index + 1,
          medal: medals[index] || null,
          isCurrentUser: row.id === playerId,
        }))
    );

    if (levelError) {
      console.error("Could not load highest levels leaderboard", levelError);
      setLevelLeaderboardRows([]);
    } else {
      setLevelLeaderboardRows(
        (levelData || [])
          .sort((a, b) => {
            const levelDiff = (Number(b.level_id) || 1) - (Number(a.level_id) || 1);
            if (levelDiff !== 0) return levelDiff;
            const xpDiff = (Number(b.xp_total) || 0) - (Number(a.xp_total) || 0);
            if (xpDiff !== 0) return xpDiff;
            return (Number(b.best_score) || 0) - (Number(a.best_score) || 0);
          })
          .slice(0, 10)
          .map((row, index) => {
          const levelId = Math.max(1, Number(row.level_id) || 1);
          const level = getLevelById(levelId);

          return {
            ...row,
            username: row.display_name || row.username || "Player",
            levelId,
            levelName: level.name,
            xpTotal: Number(row.xp_total) || 0,
            rank: index + 1,
            medal: medals[index] || null,
            isCurrentUser: row.id === playerId,
          };
        })
      );
    }
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
        favorite_country: profile?.favorite_country || favoriteCountry,
        favorite_flag: profile?.favorite_flag || favoriteFlag,
      };
    }

    return (
      (id && profileLookup[id]) || {
        id,
        username: fallbackUsername,
        display_name: fallbackUsername,
        avatar_emoji: "profile",
        avatar_icon: "profile",
        avatar_style: "classic",
        avatar_color: "green",
        avatar_bg: "dark",
        favorite_country: "Argentina",
        favorite_flag: "🇦🇷",
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
    if (!isSupabaseConfigured || !supabase || !playerId || !username) return;

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
            username_normalized: normalizeUsername(finalName),
            display_name: finalName,
            avatar_emoji: profileAvatar.icon || avatarEmoji,
            avatar_icon: profileAvatar.icon || avatarEmoji,
            avatar_style: profileAvatar.style,
            avatar_color: profileAvatar.color,
            avatar_bg: profileAvatar.bg,
            favorite_country: profile?.favorite_country || favoriteCountry,
            favorite_flag: profile?.favorite_flag || favoriteFlag,
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
          favorite_country: profile?.favorite_country || favoriteCountry,
          favorite_flag: profile?.favorite_flag || favoriteFlag,
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
    const now = Date.now();
    const expired =
      hasMissedDailyStreakDay(lastDailyPlayedDate, today) ||
      isDailyStreakExpired(lastDailyActivityAt, now);
    const baseStreak = expired ? 0 : dailyStreak;
    const baseLastDailyPlayedDate = expired ? "" : lastDailyPlayedDate;
    const previousStreak = baseStreak;

    let newStreak = 1;
    let reward = 0;

    if (baseLastDailyPlayedDate === yesterday) {
      newStreak = baseStreak + 1;
    } else if (baseLastDailyPlayedDate === today) {
      newStreak = baseStreak;
      setStreakRewardEarned(0);
      return {
        previousStreak,
        newStreak,
        reward: 0,
      };
    }

    reward = getStreakReward(newStreak);

    setDailyStreak(newStreak);
    setLastDailyPlayedDate(today);
    setLastDailyActivityAt(now);
    setStreakRewardEarned(reward);

    localStorage.setItem("footballQuizDailyStreak", String(newStreak));
    localStorage.setItem("footballQuizLastDailyPlayedDate", today);
    localStorage.setItem(DAILY_STREAK_ACTIVITY_KEY, String(now));

    if (effectiveAuthUser && isSupabaseConfigured && supabase) {
      const nextProgressionStats = {
        ...(profile?.progression_stats || {}),
        ...(progressionStats || {}),
        lastDailyActivityAt: now,
        lastDailyPlayedDate: today,
      };

      updateProfile(supabase, effectiveAuthUser.id, {
        daily_streak: newStreak,
        progression_stats: nextProgressionStats,
      }).then(({ profile: updatedProfile, error }) => {
        if (error) {
          console.warn("Could not save daily streak timestamp", error);
          return;
        }

        if (updatedProfile) {
          setProfile((currentProfile) => ({
            ...(currentProfile || {}),
            daily_streak: updatedProfile.daily_streak,
            progression_stats: updatedProfile.progression_stats,
          }));
        }
      });
    }

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
      total: dailyTargetCount,
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

    if (effectiveAuthUser && isSupabaseConfigured && supabase) {
      const today = getDailyDateKey();
      const nextProgressionStats = {
        ...(profile?.progression_stats || {}),
        ...(progressionStats || {}),
        dailyCompletions: {
          ...((profile?.progression_stats || {}).dailyCompletions || {}),
          daily_list: {
            ...(((profile?.progression_stats || {}).dailyCompletions || {}).daily_list || {}),
            [today]: {
              puzzleId: todayChallenge.id,
              title: todayChallenge.label,
              found,
              total: dailyTargetCount,
              coins: earned,
              completedAt: new Date().toISOString(),
            },
          },
        },
        lastDailyPlayedDate: today,
        lastDailyActivityAt: Date.now(),
      };

      updateProfile(supabase, effectiveAuthUser.id, {
        daily_streak: streakInfo?.newStreak || dailyStreak,
        progression_stats: nextProgressionStats,
      }).then(({ profile: updatedProfile, error }) => {
        if (error) {
          console.warn("Could not save daily completion", error);
          return;
        }
        if (updatedProfile) {
          setProfile((currentProfile) => ({
            ...(currentProfile || {}),
            daily_streak: updatedProfile.daily_streak,
            progression_stats: updatedProfile.progression_stats,
          }));
        }
      });
    }
  };

  const resetConnectionsGame = (difficulty = null) => {
  const puzzle = getRandomConnectionsPuzzle(difficulty);

  setConnectionsPuzzle(puzzle);
  setConnectionsTiles(buildConnectionsTiles(puzzle));
  setConnectionsSelected([]);
  setConnectionsSolved([]);
  setConnectionsMistakes(0);
  setConnectionsFeedback(null);
  setConnectionsShake(0);
  setConnectionsRewardClaimed(false);
  setConnectionsRewardModal(null);
};

  const openConnectionsDifficultyPicker = () => {
  playClickSound();
  setShowDailyCompletePopup(false);
  setLeaderboardOpen(false);
  setProfileOpen(false);
  setMultiplayerOpen(false);
  setModeMenuOpen(false);
  setIsMockMultiplayer(false);
  setMockOpponentScore(null);
  setGameMode("connections");
  setGameStarted(false);
  setConnectionsDifficultyPickerOpen(true);
};

const startConnectionsGame = (difficulty = null) => {
  playClickSound();
  setShowDailyCompletePopup(false);
  setLeaderboardOpen(false);
  setProfileOpen(false);
  setMultiplayerOpen(false);
  setModeMenuOpen(false);
  setConnectionsDifficultyPickerOpen(false);
  setIsMockMultiplayer(false);
  setMockOpponentScore(null);
  setGameMode("connections");
  setFinished(false);
  setGameStarted(true);
  resetConnectionsGame(difficulty);
  window.scrollTo({ top: 0, behavior: "instant" });
};

  const resetWhoAmIGame = (dateKey = whoAmIDate) => {
    const dailyQuestion = getDailyWhoAmIQuestion(dateKey);
    setWhoAmIQuestions(dailyQuestion ? [dailyQuestion] : []);
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

    if (dailyQuestion) {
      filterSearchablePlayerGuessQuestionsLazy([dailyQuestion], "daily-whoami")
        .then(async (searchableQuestions) => {
          if (searchableQuestions.length) return;

          const fallbackQuestions = await filterSearchablePlayerGuessQuestionsLazy(
            WHO_AM_I_QUESTIONS.filter(
              (question) =>
                question?.id &&
                question?.answer &&
                Array.isArray(question.clues) &&
                question.clues.length > 0
            ),
            "daily-whoami-fallback"
          );
          const fallbackQuestion =
            fallbackQuestions[
              getSeededIndex(`daily-whoami-fallback:${dateKey}`, fallbackQuestions.length)
            ];

          if (fallbackQuestion) {
            setWhoAmIQuestions([fallbackQuestion]);
            setWhoAmIIndex(0);
            setWhoAmIClueIndex(0);
            setWhoAmIInput("");
            setWhoAmISelectedPlayer(null);
          }
        })
        .catch((error) => {
          if (import.meta.env?.DEV) {
            console.warn("Could not validate Daily Who Am I searchability", error);
          }
        });
    }
  };

  const startWhoAmIGame = (dateKey = whoAmIDate) => {
    if (isDateKeyAfterToday(dateKey)) return;

    preloadPlayerSearchLazy();
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
    setWhoAmIDate(dateKey);
    resetWhoAmIGame(dateKey);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const moveToNextWhoAmI = () => {
    if (whoAmIIndex >= whoAmIQuestions.length - 1) {
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

    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : whoAmISelectedPlayer;
    const trimmedGuess = whoAmIInput.trim();
    if (!trimmedGuess && !guessedPlayer) return;

    if (isCorrectWhoAmIPlayerAnswer(guessedPlayer, currentWhoAmI, trimmedGuess)) {
      const points = whoAmIPointsAvailable;
      const clueNumber = whoAmIClueIndex + 1;
      const earlyBonus = clueNumber <= 3 ? 50 : clueNumber <= 6 ? 25 : 0;
      const rewardKeyBase = `whoami_daily:${whoAmIDate}:${currentWhoAmI.id}`;
      const rewardEligible = !isDateKeyBeforeToday(whoAmIDate);
      const previousResult = getDailyModeResult(
        "whoami_daily",
        whoAmIDate,
        currentWhoAmI.id
      );
      const solvedBefore = Boolean(previousResult?.solved);
      setWhoAmIScore((value) => value + points);
      setWhoAmIStreak((value) => value + 1);
      const solvedXpAwarded =
        rewardEligible &&
        !solvedBefore &&
        awardXp({
          key: `${rewardKeyBase}:solved`,
          amount: 50,
          label: "Who Am I solved",
        });
      if (solvedXpAwarded) {
        updateProgressionStats((stats) => addStat(stats, "whoami_solved", 1));
      }
      if (rewardEligible && !solvedBefore && earlyBonus > 0) {
        awardXp({
          key: `${rewardKeyBase}:early-${clueNumber}`,
          amount: earlyBonus,
          label: "Early clue bonus",
        });
      }
      if (rewardEligible && !solvedBefore) {
        awardOneTimeCoins({
          key: `${rewardKeyBase}:coins`,
          amount: 50,
          title: "Who Am I solved",
        });
      }
      saveDailyModeResult("whoami_daily", whoAmIDate, currentWhoAmI.id, {
        solved: true,
        gaveUp: false,
        cluesUsed: clueNumber,
        xpAwarded: solvedXpAwarded,
        replay: solvedBefore,
        rewardEligible,
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

    setWhoAmIStreak(0);
    setWhoAmIFeedback({
      type: "reveal",
      text: `Answer: ${currentWhoAmI.answer}`,
      locked: true,
    });
    saveDailyModeResult("whoami_daily", whoAmIDate, currentWhoAmI.id, {
      solved: false,
      gaveUp: false,
      cluesUsed: currentWhoAmI.clues.length,
      xpAwarded: false,
    });
    playWrongSound();

    window.setTimeout(() => {
      if (whoAmIIndex >= whoAmIQuestions.length - 1) {
        setWhoAmIGameOver(true);
      } else {
        moveToNextWhoAmI();
      }
    }, 1600);
  };

  const loadFindPlayerPool = async () => {
    if (findPlayerPool.length) return findPlayerPool;

    const { players, error } = await fetchFindPlayerPoolLazy();
    if (error || !players.length) {
      console.error("Could not load Find the Player pool", error);
      throw new Error("Could not load player data");
    }

    setFindPlayerPool(players);
    return players;
  };

  const startFindPlayerGame = async (dateKey = findPlayerDate) => {
    if (isDateKeyAfterToday(dateKey)) return;

    preloadPlayerSearchLazy();
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
    setFindPlayerClueCount(0);
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
    const nextKey = addDaysToDateKey(findPlayerDate, days);
    if (nextKey > getDailyDateKey()) return;
    startFindPlayerGame(nextKey);
  };

  const submitFindPlayerGuess = (playerOverride = null) => {
    const guessedPlayer = playerOverride || findPlayerSelected;

    if (
      findPlayerStatus !== "playing" ||
      !guessedPlayer ||
      !findPlayerTarget
    ) {
      return;
    }

    if (findPlayerSubmittingRef.current) return;
    findPlayerSubmittingRef.current = true;
    window.setTimeout(() => {
      findPlayerSubmittingRef.current = false;
    }, 300);

    if (findPlayerGuesses.some((guess) => guess.player.id === guessedPlayer.id)) {
      setFindPlayerError("You already guessed that player");
      return;
    }

    const result =
      findPlayerRanking.byId.get(guessedPlayer.id) ||
      rankGuessAgainstTarget(guessedPlayer, findPlayerTarget, findPlayerPool);
    const nextGuess = {
      player: guessedPlayer,
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
    const isCorrect = result.distance === 0 || guessedPlayer.id === findPlayerTarget.id;

    setFindPlayerGuesses(nextGuesses);
    setFindPlayerSelected(null);
    setFindPlayerError("");

    if (isCorrect) {
      const rewardKeyBase = `find_player:${findPlayerDate}:${findPlayerTarget.id}`;
      const previousResult = getDailyModeResult(
        "find_player",
        findPlayerDate,
        findPlayerTarget.id
      );
      const solvedBefore = Boolean(previousResult?.solved);
      const rewardEligible = !isDateKeyBeforeToday(findPlayerDate);
      setFindPlayerStatus("won");

      if (solvedBefore && rewardEligible) {
        awardXp({
          key: `${rewardKeyBase}:replay`,
          amount: 10,
          label: "Replay solve",
        });
      } else if (rewardEligible) {
        const solvedXpAwarded = awardXp({
          key: `${rewardKeyBase}:solved`,
          amount: 100,
          label: "Find the Player solved",
        });
        if (solvedXpAwarded) {
          updateProgressionStats((stats) => addStat(stats, "find_player_solved", 1));
        }
        if (nextGuesses.length < 5) {
          awardXp({
            key: `${rewardKeyBase}:under-5`,
            amount: 100,
            label: "Sharp solve bonus",
          });
        } else if (nextGuesses.length < 10) {
          awardXp({
            key: `${rewardKeyBase}:under-10`,
            amount: 50,
            label: "Quick solve bonus",
          });
        }
        awardOneTimeCoins({
          key: `${rewardKeyBase}:coins`,
          amount: 100,
          title: "Find the Player solved",
        });
      }
      saveDailyModeResult("find_player", findPlayerDate, findPlayerTarget.id, {
        solved: true,
        gaveUp: false,
        attempts: nextGuesses.length,
        time_seconds: findPlayerElapsed,
        xpAwarded: rewardEligible && !solvedBefore,
        replay: solvedBefore,
        rewardEligible,
      });
      playCorrectSound();
      return;
    }

    playWrongSound();
  };

  const giveUpFindPlayer = () => {
    if (!findPlayerTarget || findPlayerStatus !== "playing") return;

    const previousResult = getDailyModeResult(
      "find_player",
      findPlayerDate,
      findPlayerTarget.id
    );
    setFindPlayerSelected(null);
    setFindPlayerStatus("gave-up");
    setFindPlayerError("");
    saveDailyModeResult("find_player", findPlayerDate, findPlayerTarget.id, {
      solved: Boolean(previousResult?.solved),
      gaveUp: true,
      attempts: findPlayerGuesses.length,
      time_seconds: findPlayerElapsed,
      xpAwarded: false,
    });
    playWrongSound();
  };

  const toggleConnectionTile = (tile) => {
    if (connectionsRewardModal || connectionsGameComplete || connectionsGameOver) return;

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
    if (connectionsRewardModal || connectionsGameComplete || connectionsGameOver) return;

    playClickSound();
    setConnectionsTiles((tiles) => shuffle(tiles));
  };

  const submitConnectionsSelection = () => {
    if (
      !connectionsPuzzle ||
      connectionsSelected.length !== 4 ||
      connectionsGameComplete ||
      connectionsGameOver ||
      connectionsRewardModal
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
    let xpEarned = 0;
    const completeXpAwarded = awardXp({
      key: `connections-complete:${connectionsPuzzle?.id || "session"}`,
      amount: 100,
      label: "Connections complete",
    });
    if (completeXpAwarded) xpEarned += 100;
    if (connectionsMistakes === 0) {
      const perfectXpAwarded = awardXp({
        key: `connections-perfect:${connectionsPuzzle?.id || "session"}`,
        amount: 50,
        label: "Perfect Connections",
      });
      if (perfectXpAwarded) xpEarned += 50;
    }
    awardOneTimeCoins({
      key: `connections:${connectionsPuzzle?.id || "session"}`,
      amount: 75,
      title: "Connections complete",
    });
    setConnectionsRewardModal({
      title: "Puzzle Complete",
      mode: "Connections",
      groupsSolved: connectionsSolved.length,
      coins: 75,
      xp: xpEarned,
      perfect: connectionsMistakes === 0,
    });
    setConnectionsRewardClaimed(true);
  };

  const startGame = (mode, options = {}) => {
    if (mode === "career") preloadPlayerSearchLazy();

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
    setPostGameStep("summary");
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

  const getMultiplayerAuthPlayerId = (actionLabel) => {
    const authPlayerId = effectiveAuthUser?.id;

    if (authPlayerId) {
      return authPlayerId;
    }

    setMultiplayerNotice("");
    setMultiplayerError(`Create an account to ${actionLabel}.`);
    return null;
  };

  const getMultiplayerPermissionErrorMessage = (error, fallback) => {
    const message = error?.message || "";

    if (
      error?.code === "42501" ||
      /row-level security|permission|forbidden|not authorized/i.test(message)
    ) {
      return "Match permissions are not ready yet. Run the Supabase matches RLS SQL, then try again.";
    }

    return fallback;
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

    const matchPlayerId = effectiveAuthUser?.id;
    if (!matchPlayerId) {
      setActiveGames([]);
      if (!silent) {
        setMultiplayerError("Create an account to view active matches.");
      }
      return;
    }

    if (!silent) {
      setActiveGamesLoading(true);
      setMultiplayerError("");
    }

    const playerFilters = [`player_id.eq.${matchPlayerId}`];

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
      (matches || [])
      .filter((match) => !match.is_public)
      .map(async (match) => {
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

  const loadPlayNowGames = async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = effectiveAuthUser?.id;
    if (!matchPlayerId) {
      setPlayNowGames([]);
      if (!silent) {
        setMultiplayerError("Create an account to view Play Now games.");
      }
      return;
    }

    if (!silent) {
      setPlayNowGamesLoading(true);
      setMultiplayerError("");
    }

    const playerFilters = [`player_id.eq.${matchPlayerId}`];

    const { data: players, error: playersError } = await supabase
      .from("match_players")
      .select("match_id")
      .or(playerFilters.join(","));

    if (playersError) {
      if (!silent) setPlayNowGamesLoading(false);
      setMultiplayerError("Could not load Play Now games");
      return;
    }

    const matchIds = [
      ...new Set((players || []).map((player) => player.match_id).filter(Boolean)),
    ];

    if (matchIds.length === 0) {
      setPlayNowGames([]);
      if (!silent) setPlayNowGamesLoading(false);
      return;
    }

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .in("id", matchIds)
      .eq("is_public", true)
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (matchesError) {
      if (!silent) setPlayNowGamesLoading(false);
      setMultiplayerError("Could not load Play Now games");
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

    setPlayNowGames(games);
    if (!silent) setPlayNowGamesLoading(false);
  };

  const openActiveGames = async () => {
    playClickSound();
    setMultiplayerStep("active-games");
    await fetchActiveGames();
  };

  const openPlayNowLobby = async () => {
    playClickSound();
    setMultiplayerStep("play-now");
    setMultiplayerError("");
    setMultiplayerNotice("");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    await loadPlayNowGames();
  };

  const openCurrentRandomMatches = async () => {
    playClickSound();
    setMultiplayerStep("play-now-active-games");
    setMultiplayerError("");
    setMultiplayerNotice("");
    await loadPlayNowGames();
  };

  const goBackMultiplayer = () => {
    playClickSound();

    if (multiplayerStep === "menu") {
      setMultiplayerOpen(false);
      return;
    }

    if (
      ["league-menu", "h2h-menu", "play-now", "play-now-waiting"].includes(
        multiplayerStep
      )
    ) {
      setMultiplayerStep("menu");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setMultiplayerError("");
      setMultiplayerNotice("");
      return;
    }

    if (multiplayerStep === "play-now-active-games") {
      setMultiplayerStep("play-now");
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

    if (activeMatch?.is_public && ["joined", "created"].includes(multiplayerStep)) {
      setMultiplayerStep("play-now-active-games");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setNextCategoryPickerOpen(false);
      setMultiplayerError("");
      loadPlayNowGames({ silent: true });
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
    if (match.is_public && match.phase === "waiting_for_opponent") {
      setMultiplayerStep(match.player2_id ? "joined" : "play-now-waiting");
    } else {
      setMultiplayerStep(!match.player2_id ? "created" : "joined");
    }
  };

  const openPlayNowGame = async (matchId) => {
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
      setMultiplayerError("Could not open Play Now game");
      return;
    }

    const latestRound = rounds[0] || null;
    const playerSlot = getCurrentPlayerSlot(match, playerId, username);
    const playerAlreadyPlayed = hasPlayerFinishedRound(latestRound, playerSlot);

    setActiveMatch(match);
    setActiveRound(latestRound);
    setMatchRounds(rounds);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || latestRound?.category || "general");

    if (
      latestRound &&
      !playerAlreadyPlayed &&
      match.phase === "round_active" &&
      match.status !== "completed"
    ) {
      openMultiplayerRoundFor(match, latestRound);
      return;
    }

    setMultiplayerStep(
      match.phase === "waiting_for_opponent" && !match.player2_id
        ? "play-now-waiting"
        : "joined"
    );
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
      console.error("Could not load league", error);
      setMultiplayerError(getLeagueErrorMessage(error, "Could not load league"));
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

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    const leagueUsername =
      username && username !== "Loading profile..."
        ? username
        : profile?.display_name ||
          profile?.username ||
          effectiveAuthUser?.user_metadata?.username ||
          effectiveAuthUser?.email?.split("@")[0] ||
          "Player";

    if (!leaguePlayerId || !leagueUsername) {
      setMultiplayerError("Still loading your profile. Try again in a moment.");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");

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

    await ensureOnlineProfile(leagueUsername);

    const { league, error } = await createLeague(supabase, {
      name: leagueNameInput,
      playerId: leaguePlayerId,
      username: leagueUsername,
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
      console.error("Could not create league", {
        error,
        playerId: leaguePlayerId,
        isGuest,
        hasAuthUser: Boolean(effectiveAuthUser),
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not create league"));
      return;
    }

    setLeagueNameInput("");
    setMultiplayerNotice("League created");
    setMyLeagues((currentLeagues) => [
      {
        league,
        member: {
          league_id: league.id,
          player_id: leaguePlayerId,
          username: leagueUsername,
          total_points: 0,
          days_played: 0,
        },
        memberCount: 1,
        rank: 1,
        todayPlayed: false,
      },
      ...currentLeagues.filter((row) => row.league?.id !== league.id),
    ]);
    setMultiplayerStep("league-dashboard");
    await loadLeagueDashboard(league.id);
  };

  const joinExistingLeague = async () => {
    if (!leagueCodeInput.trim()) return;

    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    const leagueUsername =
      username && username !== "Loading profile..."
        ? username
        : profile?.display_name ||
          profile?.username ||
          effectiveAuthUser?.user_metadata?.username ||
          effectiveAuthUser?.email?.split("@")[0] ||
          "Player";

    if (!leaguePlayerId || !leagueUsername) {
      setMultiplayerError("Still loading your profile. Try again in a moment.");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");

    await ensureOnlineProfile(leagueUsername);

    const { league, alreadyJoined, error } = await joinLeague(supabase, {
      code: leagueCodeInput,
      playerId: leaguePlayerId,
      username: leagueUsername,
    });

    setLeagueLoading(false);

    if (error || !league) {
      console.error("Could not join league", {
        error,
        playerId: leaguePlayerId,
        isGuest,
        hasAuthUser: Boolean(effectiveAuthUser),
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not join league"));
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

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    const leagueUsername =
      username && username !== "Loading profile..."
        ? username
        : profile?.display_name ||
          profile?.username ||
          effectiveAuthUser?.user_metadata?.username ||
          effectiveAuthUser?.email?.split("@")[0] ||
          "Player";

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");
    setMultiplayerStep("my-leagues");

    await ensureOnlineProfile(leagueUsername);

    const { leagues, error } = await fetchMyLeagues(supabase, leaguePlayerId);

    setLeagueLoading(false);

    if (error) {
      console.error("Could not load leagues", {
        error,
        playerId: leaguePlayerId,
        isGuest,
        hasAuthUser: Boolean(effectiveAuthUser),
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not load leagues"));
      return;
    }

    setMyLeagues(leagues);
  };

  const confirmLeaveActiveLeague = async () => {
    playClickSound();

    if (!activeLeague?.id) return;
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    if (!leaguePlayerId) {
      setMultiplayerError("Still loading your profile. Try again in a moment.");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");

    const { left, archived, transferredTo, error } = await leaveLeague(supabase, {
      leagueId: activeLeague.id,
      playerId: leaguePlayerId,
    });

    setLeagueLoading(false);

    if (error || !left) {
      console.error("Could not leave league", {
        error,
        leagueId: activeLeague.id,
        playerId: leaguePlayerId,
        isCreator: activeLeague.created_by_id === leaguePlayerId,
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not leave league"));
      return;
    }

    clearLeagueAttempt(activeLeagueDay?.id);
    setLeagueExitConfirmOpen(false);
    setLeagueDashboard(null);
    setLeagueChallengeOpen(false);
    setMyLeagues((currentLeagues) =>
      currentLeagues.filter((row) => row.league?.id !== activeLeague.id)
    );
    setMultiplayerStep("my-leagues");
    setMultiplayerNotice(
      archived
        ? "League archived"
        : transferredTo
        ? `Left league. Ownership moved to ${transferredTo.username || "another member"}.`
        : "Left league"
    );

    const { leagues, error: refreshError } = await fetchMyLeagues(supabase, leaguePlayerId);
    if (!refreshError) setMyLeagues(leagues);
  };

  const customizeLeaguePreset = (format) => {
    const preset = LEAGUE_FORMATS[format];
    if (!preset) return;

    setLeagueCustomQuizCount(preset.quizCount);
    setLeagueCustomTop10Count(preset.top10Count);
    setLeagueCustomWhoAmICount(preset.whoamiCount);
    setLeagueCustomFindPlayerCount(preset.findPlayerCount || 0);
    setLeagueFindPlayerScoringMode(preset.findPlayerScoringMode || "attempts");
    setLeagueFormatInput("custom");
  };

  const getLeagueAttemptKey = (leagueDayId = activeLeagueDay?.id) => {
    if (!leagueDayId) return "";
    return `ballKnowledgeLeagueAttempt:${playerId}:${leagueDayId}`;
  };

  const readLeagueAttempt = (leagueDayId) => {
    const key = getLeagueAttemptKey(leagueDayId);
    if (!key) return null;

    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const clearLeagueAttempt = (leagueDayId = activeLeagueDay?.id) => {
    const key = getLeagueAttemptKey(leagueDayId);
    if (key) localStorage.removeItem(key);
  };

  const buildCurrentLeagueAttempt = () => {
    if (!activeLeague || !activeLeagueDay) return null;

    return {
      status: "in_progress",
      leagueId: activeLeague.id,
      leagueDayId: activeLeagueDay.id,
      dayKey: activeLeagueDay.day_key,
      playerId,
      username,
      phase: leagueChallengePhase,
      quizScore: Number(leagueQuizScore) || 0,
      top10Score: Number(leagueTop10TotalWithCurrent) || 0,
      whoamiScore: Number(leagueWhoAmIScore) || 0,
      findPlayerScore: Number(leagueFindPlayerScore) || 0,
      findPlayerAttempts:
        Number(leagueFindPlayerAttemptTotal) +
        (leagueChallengePhase === "find-player" ? leagueFindPlayerGuesses.length : 0),
      findPlayerTimeSeconds: Number(leagueFindPlayerElapsed) || 0,
      updatedAt: new Date().toISOString(),
    };
  };

  const saveLeagueAttempt = (attempt = buildCurrentLeagueAttempt()) => {
    if (!attempt?.leagueDayId || attempt.status !== "in_progress") return;

    localStorage.setItem(
      getLeagueAttemptKey(attempt.leagueDayId),
      JSON.stringify(attempt)
    );
  };

  const submitStoredLeagueAttempt = async (attempt, league, leagueDay) => {
    if (!attempt || !league || !leagueDay || !supabase) {
      return { submission: null, error: new Error("Missing league attempt") };
    }

    const { submission, error } = await submitLeagueDailyResult(supabase, {
      league,
      leagueDay,
      playerId,
      username,
      quizScore: Number(attempt.quizScore) || 0,
      top10Score: Number(attempt.top10Score) || 0,
      whoamiScore: Number(attempt.whoamiScore) || 0,
      findPlayerScore: Number(attempt.findPlayerScore) || 0,
      findPlayerAttempts: Number(attempt.findPlayerAttempts) || 0,
      findPlayerTimeSeconds: Number(attempt.findPlayerTimeSeconds) || 0,
    });

    if (!error && submission) clearLeagueAttempt(leagueDay.id);

    return { submission, error };
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

      const storedAttempt = readLeagueAttempt(leagueDay.id);
      if (storedAttempt?.status === "in_progress") {
        const { submission, error: attemptError } = await submitStoredLeagueAttempt(
          storedAttempt,
          activeLeague,
          leagueDay
        );

        if (attemptError || !submission) {
          console.error("Could not lock previous league attempt", {
            error: attemptError,
            leagueId: activeLeague.id,
            leagueDayId: leagueDay.id,
            storedAttempt,
          });
          setMultiplayerError("Your league attempt is locked. Try refreshing the league.");
          return;
        }

        setMultiplayerNotice("Your previous attempt was submitted and locked.");
        await loadLeagueDashboard(activeLeague.id, { silent: true });
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
      setLeagueFindPlayerClueCount(0);
      setLeagueFindPlayerScore(0);
      setLeagueFindPlayerAttemptTotal(0);
      setLeagueFindPlayerStartedAt(null);
      setLeagueFindPlayerElapsed(0);
      setLeagueFindPlayerFeedback("");
      setLeagueResult(null);
      setLeagueChallengePhase("intro");
      setLeagueChallengeOpen(true);
      setLeagueLeaveConfirmOpen(false);
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
    const nextPhase =
      leagueQuizQuestions.length > 0
        ? "quiz"
        : leagueSettings.top10Count > 0
        ? "top10"
        : leagueSettings.whoamiCount > 0
        ? "whoami"
        : leagueSettings.findPlayerCount > 0
        ? "find-player"
        : "whoami";

    setLeagueChallengePhase(nextPhase);
    setLeagueTimeLeft(15);
    const initialAttempt = buildCurrentLeagueAttempt();
    if (initialAttempt) {
      saveLeagueAttempt({
        ...initialAttempt,
        phase: nextPhase,
      });
    }
    if (leagueSettings.findPlayerCount > 0 && !leagueQuizQuestions.length && leagueSettings.top10Count <= 0 && leagueSettings.whoamiCount <= 0) {
      setLeagueFindPlayerClueCount(0);
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
      setLeagueFindPlayerClueCount(0);
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
          setLeagueFindPlayerClueCount(0);
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
    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : leagueTop10SelectedPlayer;
    const guessText = guessedPlayer?.name || leagueTop10Input.trim();

    if (
      !guessText ||
      !leagueTop10Challenge ||
      leagueTop10Scanning ||
      leagueTop10Lives <= 0
    ) {
      return;
    }

    const leagueTop10Answers = getChallengeAnswers(leagueTop10Challenge);
    if (leagueTop10Answers.length === 0) return;

    const matchedAnswer = findMatchingAnswer({
      typedAnswer: guessText,
      selectedPlayer: guessedPlayer,
      answers: leagueTop10Answers,
    });
    const alreadyFound =
      matchedAnswer && leagueTop10Found.includes(matchedAnswer);
    const matchedRank = matchedAnswer
      ? leagueTop10Answers.indexOf(matchedAnswer) + 1
      : 0;
    let displayRank = leagueTop10Answers.length;

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

        if (leagueTop10Found.length + 1 >= leagueTop10TargetCount) {
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
          setLeagueFindPlayerClueCount(0);
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
    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : leagueWhoAmISelectedPlayer;

    if (
      !currentLeagueWhoAmI ||
      (!leagueWhoAmIInput.trim() && !guessedPlayer) ||
      leagueWhoAmIFeedback?.locked
    ) {
      return;
    }

    const guess = leagueWhoAmIInput.trim();
    const isCorrect = isPlayerAnswerCorrect({
      typedAnswer: guess,
      selectedPlayer: guessedPlayer,
      question: currentLeagueWhoAmI,
      acceptedAnswers: currentLeagueWhoAmI.acceptedAnswers || [],
    });

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

  const submitLeagueFindPlayerGuess = (playerOverride = null) => {
    const guessedPlayer = playerOverride || leagueFindPlayerSelected;

    if (
      leagueChallengePhase !== "find-player" ||
      !currentLeagueFindPlayerTarget ||
      !guessedPlayer ||
      leagueFindPlayerFeedback.startsWith("Correct") ||
      leagueFindPlayerFeedback.startsWith("Answer:")
    ) {
      return;
    }

    if (leagueFindPlayerSubmittingRef.current) return;
    leagueFindPlayerSubmittingRef.current = true;
    window.setTimeout(() => {
      leagueFindPlayerSubmittingRef.current = false;
    }, 300);

    if (
      leagueFindPlayerGuesses.some(
        (guess) => guess.player.id === guessedPlayer.id
      )
    ) {
      setLeagueFindPlayerFeedback("Already guessed");
      return;
    }

    const result =
      leagueFindPlayerRanking.byId.get(guessedPlayer.id) ||
      rankGuessAgainstTarget(
        guessedPlayer,
        currentLeagueFindPlayerTarget,
        findPlayerPool
      );
    const nextGuess = {
      player: guessedPlayer,
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
      guessedPlayer.id === currentLeagueFindPlayerTarget.id;
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
      setLeagueFindPlayerClueCount(0);
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
      setLeagueFindPlayerClueCount(0);
    }, 1100);
  };

  const completeLeagueChallenge = async ({
    quizScore = leagueQuizScore,
    top10Score = leagueTop10Score,
    whoamiScore = leagueWhoAmIScore,
    findPlayerScore = leagueFindPlayerScore,
    findPlayerAttempts = null,
    findPlayerTimeSeconds = null,
    abandoned = false,
  } = {}) => {
    if (!activeLeague || !activeLeagueDay || leagueResult) return false;

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
        quizScore,
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
      return false;
    }

    const leagueDayKey =
      activeLeagueDay.day_key || `${activeLeague.id}:${activeLeagueDay.day_number}`;
    if (!alreadySubmitted && !abandoned) {
      updateProgressionStats((stats) =>
        addStat(stats, "league_days_completed", 1)
      );
      awardXp({
        key: `league-day:${activeLeague.id}:${leagueDayKey}`,
        amount: 100,
        label: "League day complete",
      });
    }

    clearLeagueAttempt(activeLeagueDay.id);
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
      abandoned,
    });
    setLeagueChallengePhase("complete");
    await loadLeagueDashboard(activeLeague.id, { silent: true });
    return true;
  };

  const isLeagueAttemptLocked = () =>
    leagueChallengeOpen &&
    activeLeague &&
    activeLeagueDay &&
    !activeLeagueSubmission &&
    leagueChallengePhase !== "intro" &&
    leagueChallengePhase !== "complete";

  const closeLeagueChallenge = async ({ force = false } = {}) => {
    playClickSound();

    if (!force && isLeagueAttemptLocked()) {
      saveLeagueAttempt();
      setLeagueLeaveConfirmOpen(true);
      return;
    }

    setLeagueChallengeOpen(false);
    setLeagueLeaveConfirmOpen(false);
    setMultiplayerOpen(true);
    setMultiplayerStep("league-dashboard");
    if (activeLeague?.id) {
      await loadLeagueDashboard(activeLeague.id, { silent: true });
    }
  };

  const submitAndCloseLeagueAttempt = async () => {
    if (!activeLeague || !activeLeagueDay || leagueAttemptSubmitting) return;

    setLeagueAttemptSubmitting(true);
    saveLeagueAttempt();

    const saved = await completeLeagueChallenge({
      quizScore: leagueQuizScore,
      top10Score: leagueTop10TotalWithCurrent,
      whoamiScore: leagueWhoAmIScore,
      findPlayerScore: leagueFindPlayerScore,
      findPlayerAttempts:
        leagueFindPlayerAttemptTotal +
        (leagueChallengePhase === "find-player" ? leagueFindPlayerGuesses.length : 0),
      findPlayerTimeSeconds: leagueFindPlayerElapsed,
      abandoned: true,
    });

    setLeagueAttemptSubmitting(false);

    if (saved) {
      await closeLeagueChallenge({ force: true });
    }
  };

  const startPlayNow = async (categoryId = playNowCategory) => {
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = getMultiplayerAuthPlayerId("start Play Now matches");
    if (!matchPlayerId) return;

    setMultiplayerLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("Searching for opponent...");

    const { match, round, created, joined, error } = await findOrCreatePublicMatch(supabase, {
      playerId: matchPlayerId,
      username,
      categoryId,
    });

    setMultiplayerLoading(false);

    if (error || !match) {
      console.error("Could not start matchmaking", error);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(error, "Could not start matchmaking")
      );
      return;
    }

    setActiveMatch(match);
    setActiveRound(round || null);
    setMatchRounds(round ? [round] : []);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || "general");
    setMultiplayerNotice(
      joined ? "Random opponent found" : "Random challenge started"
    );
    loadPlayNowGames({ silent: true });

    if (round) {
      openMultiplayerRoundFor(match, round);
      return;
    }

    setMultiplayerStep(created ? "play-now-waiting" : "joined");
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
      setPlayNowGames((games) =>
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
    if (data.is_public && data.phase === "waiting_for_opponent" && !data.player2_id) {
      setMultiplayerStep("play-now-waiting");
    } else if (data.status === "ready") {
      setMultiplayerStep("joined");
    } else if (data.is_public && data.player2_id) {
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

    const matchPlayerId = getMultiplayerAuthPlayerId("create H2H matches");
    if (!matchPlayerId) return;

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
        current_turn_id: matchPlayerId,
        player1_username: username,
        player1_id: matchPlayerId,
        status: "active",
        phase: "choose_category",
        round_number: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (matchError || !match) {
      console.error("Could not create match", matchError);
      setMultiplayerLoading(false);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(matchError, "Could not create match")
      );
      return;
    }

    const { error: playerError } = await supabase.from("match_players").insert({
      match_id: match.id,
      username,
      player_id: matchPlayerId,
      player_slot: "player1",
    });

    setMultiplayerLoading(false);

    if (playerError) {
      console.error("Match created, but player join failed", playerError);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(playerError, "Match created, but player join failed")
      );
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

    const matchPlayerId = getMultiplayerAuthPlayerId("join H2H matches");
    if (!matchPlayerId) return;

    setMultiplayerLoading(true);
    setMultiplayerError("");

    const roomCode = joinRoomCode.trim().toUpperCase();
    const { data: match, error: lookupError } = await supabase
      .from("matches")
      .select("*")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (lookupError) {
      console.error("Could not join room", lookupError);
      setMultiplayerLoading(false);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(lookupError, "Could not join room")
      );
      return;
    }

    if (!match) {
      setMultiplayerLoading(false);
      setMultiplayerError("Room not found");
      return;
    }

    if (
      match.player1_id === matchPlayerId ||
      (!match.player1_id && match.player1_username === username)
    ) {
      setMultiplayerLoading(false);
      setMultiplayerError("This is your own match");
      return;
    }

    if (
      match.player2_id &&
      match.player2_id === matchPlayerId
    ) {
      setMultiplayerLoading(false);
      await openExistingMatch(match.id);
      return;
    }

    if (
      match.player2_id &&
      match.player2_id !== matchPlayerId
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

    const shouldKeepActiveRound = match.phase === "round_active";
    const { data: updatedMatch, error: updateError } = await supabase
      .from("matches")
      .update({
        player2_username: username,
        player2_id: matchPlayerId,
        status: shouldKeepActiveRound ? "active" : "ready",
        phase: shouldKeepActiveRound ? "round_active" : "choose_category",
        current_turn: shouldKeepActiveRound ? username : match.player1_username,
        current_turn_id: shouldKeepActiveRound ? matchPlayerId : match.player1_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id)
      .select()
      .single();

    if (updateError || !updatedMatch) {
      console.error("Could not update room", updateError);
      setMultiplayerLoading(false);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(updateError, "Could not update room")
      );
      return;
    }

    const { error: playerError } = await supabase.from("match_players").insert({
      match_id: updatedMatch.id,
      username,
      player_id: matchPlayerId,
      player_slot: "player2",
    });

    setMultiplayerLoading(false);

    if (playerError) {
      console.error("Joined room, but player save failed", playerError);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(playerError, "Joined room, but player save failed")
      );
      return;
    }

    const { rounds, error: roundLoadError } = await loadMatchById(updatedMatch.id);
    const latestRound = rounds?.[0] || null;

    setActiveMatch(updatedMatch);
    setActiveRound(latestRound);
    setMatchRounds(rounds || []);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(updatedMatch.room_code);
    setMultiplayerMode(updatedMatch.mode || latestRound?.category || multiplayerMode);

    if (roundLoadError) {
      console.error("Joined room, but round load failed", roundLoadError);
    }

    if (
      latestRound &&
      updatedMatch.phase === "round_active" &&
      !hasPlayerFinishedRound(latestRound, "player2")
    ) {
      openMultiplayerRoundFor(updatedMatch, latestRound);
      return;
    }

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
    openMultiplayerRoundFor(data, round);
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
    setMultiplayerTimeLeft(getMultiplayerQuestionTimeLimit(activeRound?.category));
    setMultiplayerRoundDone(false);
    setIsSubmittingRound(false);
    setMultiplayerRoundOpen(true);
    setMultiplayerOpen(false);
  };

  const openMultiplayerRoundFor = (match, round) => {
    if (!match || !round) {
      setMultiplayerError("Round questions are not ready");
      return;
    }

    const roundQuestions = getMultiplayerQuestionsByIds(round.question_ids || []);
    if (roundQuestions.length !== 5) {
      setMultiplayerError("Round questions are not ready");
      return;
    }

    const playerSlot = getCurrentPlayerSlot(match, playerId, username);
    if (hasPlayerFinishedRound(round, playerSlot)) {
      setActiveMatch(match);
      setActiveRound(round);
      setMatchRounds((rounds) => [
        round,
        ...rounds.filter((item) => item.id !== round.id),
      ]);
      setMultiplayerStep("joined");
      setMultiplayerNotice("Your score is already saved");
      return;
    }

    playClickSound();
    setActiveMatch(match);
    setActiveRound(round);
    setMatchRounds((rounds) => [
      round,
      ...rounds.filter((item) => item.id !== round.id),
    ]);
    setMultiplayerMode(match.mode || "general");
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerRoundIndex(0);
    setMultiplayerRoundSelected(null);
    setMultiplayerRoundScore(0);
    setMultiplayerTimeLeft(getMultiplayerQuestionTimeLimit(round.category));
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
        setMultiplayerTimeLeft(getMultiplayerQuestionTimeLimit(activeRound?.category));
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
    const isPublicPlayNowMatch = Boolean(activeMatch.is_public);

    if (otherPlayerFinished) {
      // Next chooser rule: the player who submits second chooses the next
      // category, which keeps async play moving without requiring both players
      // to be online together.
      matchPatch = {
        ...matchPatch,
        status: "active",
        phase: "round_finished",
        matchmaking_status: isPublicPlayNowMatch ? "matched" : activeMatch.matchmaking_status,
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
    } else if (isPublicPlayNowMatch && !activeMatch.player2_id) {
      matchPatch = {
        ...matchPatch,
        status: "waiting_for_opponent",
        phase: "waiting_for_opponent",
        matchmaking_status: "waiting_for_opponent",
        current_turn: null,
        current_turn_id: null,
      };
    } else if (isPublicPlayNowMatch) {
      matchPatch = {
        ...matchPatch,
        status: "active",
        phase: "round_active",
        matchmaking_status: "matched",
        current_turn: null,
        current_turn_id: null,
      };
    } else if (multiplayerPlayerSlot === "player1" && !activeMatch.player2_id) {
      matchPatch = {
        ...matchPatch,
        status: "waiting",
        phase: "round_active",
        current_turn: null,
        current_turn_id: null,
      };
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
    if (isPublicPlayNowMatch) {
      loadPlayNowGames({ silent: true });
    }
    setMultiplayerStep(
      isPublicPlayNowMatch && !otherPlayerFinished && !updatedMatch.player2_id
        ? "play-now-waiting"
        : !isPublicPlayNowMatch &&
          multiplayerPlayerSlot === "player1" &&
          !updatedMatch.player2_id
        ? "created"
        : "joined"
    );
  };

  const startDailyChallenge = () => {
    if (dailyPlayed) return;

    if (isDailyPlayerChallenge) preloadPlayerSearchLazy();
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
    setPostGameStep("summary");
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
    setPostGameStep("summary");
    setObjectiveProgressUpdate(null);
    setLevelUpPopup(null);

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

  const exitToHomeSafely = (reason = "manual") => {
    setGameStarted(false);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setConnectionsDifficultyPickerOpen(false);
    setCoinsMenuOpen(false);
    setGameMode("general");
    setFinished(false);
    setPostGameStep("summary");
    setObjectiveProgressUpdate(null);
    setRewardPopup(null);
    setWrongPopup(null);
    setLevelUpPopup(null);
    setSelected(null);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
    setQuestionIndex(0);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setRevivesUsed(0);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);

    if (reason === "invalid-state") {
      console.error("Recovered invalid game state by returning home", {
        gameStarted,
        gameMode,
        finished,
        postGameStep,
      });
    }
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

  const handleWrongAnswer = (correctAnswer) => {
    setStreak(0);

    const newLives = Math.max(lives - 1, 0);
    setLives(newLives);

    playWrongSound();

    if (newLives <= 0) {
      setSelected(correctAnswer);
      if (isMockMultiplayer) {
        setMockOpponentScore(createMockOpponentScore(score));
      }

      setTimeout(() => {
        setFinished(true);
      }, 1500);
    } else {
      setTimeout(() => {
        nextQuestion();
      }, 1200);
    }
  };

  const chooseAnswer = (option) => {
    if (selected || rewardPopup || objectiveProgressUpdate) return;

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
        updateOnlineProfile(
          {
            best_score: newScore,
            coins,
            daily_streak: dailyStreak,
            xp_total: xpTotal,
            level_id: careerLevelId,
            progression_stats: {
              ...progressionStats,
              best_general_score: Math.max(
                Number(progressionStats.best_general_score) || 0,
                newScore
              ),
            },
          },
          "ready"
        );
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

      if ((gameMode === "world-cup" || gameMode === "career") && !isMockMultiplayer) {
        if (awardXp({
          key: `${gameMode}-correct:${Date.now()}:${questionIndex}:${newScore}`,
          amount: 5,
          label: "Correct answer",
          placement: "inline",
        })) {
          setGeneralRunXpSummary((summary) => ({
            ...summary,
            correct: summary.correct + 5,
          }));
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
    if (dailyPlayed || localStorage.getItem("ballKnowledgeDailyDate") === getDailyDateKey()) {
      setFinished(true);
      return;
    }

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
    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : dailySelectedPlayer;
    const guessText = guessedPlayer?.name || dailyInput.trim();
    if (!guessText || dailyChallengeUnavailable || rewardPopup || wrongPopup || isRevealing) return;

    setDailyCelebratedAnswer(null);

    const matchedAnswer = findMatchingAnswer({
      typedAnswer: guessText,
      selectedPlayer: guessedPlayer,
      answers: dailyAnswers,
    });

    if (matchedAnswer && !foundAnswers.includes(matchedAnswer)) {
      const rank = dailyAnswers.indexOf(matchedAnswer) + 1;
      const rewardPerCorrect = 15;

      setDailyInput("");
      setDailySelectedPlayer(null);
      setIsRevealing(true);

      let displayRank = dailyAnswers.length;

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

            if (newFoundAnswers.length >= dailyTargetCount) {
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

      let displayRank = dailyAnswers.length;

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
    setPostGameStep("summary");
    setSelected(null);
  };

  const submitTextAnswer = () => {
    if ((!textAnswer.trim() && !careerSelectedPlayer) || selected) return;

    const careerTypedPlayerMatch =
      gameMode === "career" &&
      !careerSelectedPlayer &&
      isPlayerAnswerCorrect({
        typedAnswer: textAnswer,
        correctAnswer: current?.answer,
      });

    const submittedAnswer =
      gameMode === "career" &&
      ((careerSelectedPlayer &&
        isCorrectPlayerAnswer(careerSelectedPlayer, current?.answer)) ||
        careerTypedPlayerMatch)
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
            <div className="coin-shop-coin"><BKIcon name="coins" size={58} /></div>
            <h2 className="coin-shop-title">Coin Shop</h2>

            <div className="coin-shop-balance">
              <span>Current coins</span>
              <strong><BKIcon name="coins" size={22} /> {coins}</strong>
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
          <span><BKIcon name="coins" size={24} /></span>
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
          onClick={() => setDailyRewardMeterOpen(false)}
        >
          <motion.div
            className="daily-reward-popup daily-reward-view-card"
            initial={{ opacity: 0, scale: 0.84, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            transition={{ type: "spring", stiffness: 170, damping: 14 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="daily-reward-top">
              <div className="daily-reward-fire"><BKIcon name="dailyStreak" size={48} /></div>

              <div>
                <div className="daily-reward-title">Daily Streak</div>
                <div className="daily-reward-subtitle">
                  {dailyStreak} day{dailyStreak === 1 ? "" : "s"} strong
                </div>
              </div>
            </div>

            <div className="daily-reward-earned">
              <span>{dailyPlayed ? "Today completed" : "Today waiting"}</span>
              <strong>
                <BKIcon name={dailyPlayed ? "dailyStreak" : "dailyChallenge"} size={22} />
                {dailyPlayed ? "Reward locked in" : "Play Daily Challenge"}
              </strong>
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
                      <BKIcon
                        name={reached ? "dailyStreak" : currentDay ? "dailyChallenge" : "singlePlayer"}
                        size={26}
                      />
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
              <div className="level-progress-icon">
                <LevelIcon levelId={playerLevel.id} size={64} />
              </div>
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
                    Next: {playerLevel.next.name}
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

  const postGameProgressModal = (
    <AnimatePresence>
      {postGameStep === "xp" &&
        !gameStarted &&
        ["general", "world-cup", "career"].includes(gameMode) && (
        <motion.div
          className="level-progress-overlay post-game-progress-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`level-progress-card post-game-progress-card level-${playerLevel.color}`}
            initial={{ opacity: 0, scale: 0.9, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 18 }}
            transition={{ duration: 0.22 }}
          >
            <div className="objective-progress-kicker">Run Progress</div>
            <div className="level-progress-hero">
              <div className="level-progress-icon">
                <LevelIcon levelId={playerLevel.id} size={64} />
              </div>
              <div>
                <div className="level-progress-label">
                  {getModeLabel(gameMode)} • Level {playerLevel.levelNumber}
                </div>
                <h2>{playerLevel.name}</h2>
                <p>+{generalRunXpTotal} XP this run</p>
              </div>
            </div>

            <div className="level-progress-track">
              <div
                className="level-progress-fill"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
            <div className="level-progress-next">
              <strong>{xpProgressLabel}</strong>
              <span>
                {playerLevel.next
                  ? `Next: ${playerLevel.next.name}`
                  : "Legend status reached"}
              </span>
            </div>

            <div className="general-run-xp-summary post-game">
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
                  <span>Combo bonuses</span>
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
                <span>Total XP</span>
                <strong>+{generalRunXpTotal} XP</strong>
              </div>
            </div>

            {Array.isArray(objectiveProgressUpdate?.updates) && (
              <div className="objective-progress-list inline">
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
                        transition={{ duration: 0.55, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="level-progress-action" onClick={closePostGameProgress}>
              COLLECT & CONTINUE
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const connectionsRewardOverlay = (
    <AnimatePresence>
      {connectionsRewardModal && (
        <motion.div
          className="level-progress-overlay connections-reward-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`level-progress-card connections-reward-card level-${playerLevel.color}`}
            initial={{ opacity: 0, scale: 0.9, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 18 }}
            transition={{ duration: 0.22 }}
          >
            <div className="objective-progress-kicker">Victory</div>
            <div className="level-progress-hero">
              <div className="level-progress-icon"><BKIcon name="connections" size={56} /></div>
              <div>
                <div className="level-progress-label">
                  {connectionsRewardModal.mode}
                </div>
                <h2>{connectionsRewardModal.title}</h2>
                <p>
                  {connectionsRewardModal.groupsSolved}/4 groups solved
                  {connectionsRewardModal.perfect ? " • Perfect run" : ""}
                </p>
              </div>
            </div>

            <div className="reward-summary-grid">
              <div>
                <span>Coins</span>
                <strong><BKIcon name="coins" size={22} /> +{connectionsRewardModal.coins}</strong>
              </div>
              <div>
                <span>XP</span>
                <strong>+{connectionsRewardModal.xp}</strong>
              </div>
            </div>

            <div className="level-progress-track">
              <div
                className="level-progress-fill"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
            <div className="level-progress-next">
              <strong>{xpProgressLabel}</strong>
              <span>
                {playerLevel.next
                  ? `Next: ${playerLevel.next.name}`
                  : "Legend status reached"}
              </span>
            </div>

            <div className="reward-modal-actions">
              <button
                className="level-progress-action secondary"
                onClick={() => closeConnectionsReward()}
              >
                COLLECT
              </button>
              <button
                className="level-progress-action"
                onClick={() => closeConnectionsReward({ playAgain: true })}
              >
                PLAY AGAIN
              </button>
            </div>
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

            <div className="avatar-builder-scroll">
              <div className="avatar-builder-preview">
                <PlayerAvatar
                  profile={{
                    avatar_icon: avatarBuilderPreview.icon,
                    avatar_style: avatarBuilderPreview.style,
                    avatar_color: avatarBuilderPreview.color,
                    avatar_bg: avatarBuilderPreview.bg,
                    favorite_country: avatarBuilderPreview.country,
                    favorite_flag: avatarBuilderPreview.flag,
                  }}
                  size="large"
                />
                <div>
                  <strong>{displayName || "Player"}</strong>
                  <span>
                    {avatarBuilderPreview.flag} {avatarBuilderPreview.country} •{" "}
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
                <strong>Favorite Nation</strong>
                <div className="avatar-flag-grid">
                  {FAVORITE_NATION_OPTIONS.map((nation) => (
                    <button
                      key={nation.country}
                      className={`avatar-flag-option ${
                        nation.country === avatarBuilderPreview.country ? "selected" : ""
                      }`}
                      onClick={() =>
                        updateAvatarDraft({
                          country: nation.country,
                          flag: nation.flag,
                          favorite_country: nation.country,
                          favorite_flag: nation.flag,
                        })
                      }
                    >
                      <span>{nation.flag}</span>
                      <small>{nation.country}</small>
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
            </div>

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
    if (!lastDailyActivityAt || !isDailyStreakExpired(lastDailyActivityAt)) return;

    setDailyStreak(0);
    setLastDailyPlayedDate("");
    localStorage.setItem("footballQuizDailyStreak", "0");
    localStorage.removeItem("footballQuizLastDailyPlayedDate");
    if (effectiveAuthUser && isSupabaseConfigured && supabase) {
      updateProfile(supabase, effectiveAuthUser.id, {
        daily_streak: 0,
        progression_stats: {
          ...(profile?.progression_stats || {}),
          ...(progressionStats || {}),
          lastDailyActivityAt,
          streakResetAt: Date.now(),
        },
      }).then(({ error }) => {
        if (error) console.warn("Could not reset expired daily streak online", error);
      });
    }
  }, [lastDailyActivityAt, effectiveAuthUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase?.auth) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    getCurrentSession(supabase)
      .then(async ({ session, user, error }) => {
        if (!mounted) return;

        if (error) {
          console.warn("Could not load current auth session", error);
          setAuthSession(null);
          setAuthUser(null);
          setGuestMode(false);
          return;
        }

        setAuthSession(session);
        setAuthUser(user);

        if (user) {
          prepareAuthenticatedIdentity(user);
          await ensureProfileForAuthUser(user);
        }
      })
      .catch((error) => {
        console.warn("Supabase startup failed", error);
        if (!mounted) return;
        setAuthSession(null);
        setAuthUser(null);
        setGuestMode(false);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;

      setAuthSession(session || null);
      setAuthUser(user);

      if (user) {
        prepareAuthenticatedIdentity(user);
        window.setTimeout(() => {
          ensureProfileForAuthUser(user);
        }, 0);
      }
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!username || username === "Loading profile..." || (!effectiveAuthUser && !guestMode)) return;

    ensureOnlineProfile(username);
  }, [username, playerId, effectiveAuthUserId, guestMode]);

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
        .select(PROFILE_SELECT)
        .in("id", missingIds);

      if (cancelled) return;

      if (error) {
        console.warn("Could not load player avatars", error);
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
    if (
      !username ||
      username === "Loading profile..." ||
      (!effectiveAuthUser && !guestMode) ||
      profileStatus !== "ready" ||
      !isSupabaseConfigured ||
      !supabase
    ) {
      return;
    }

    const syncTimer = window.setTimeout(async () => {
      const { profile: updatedProfile, error } = await syncLocalStatsToProfile(
        supabase,
        playerId,
        { highScore, coins, dailyStreak }
      );

      if (error) {
        console.warn("Could not sync local stats to profile", error);
        setProfileStatus(isNonBlockingProfileError(error) ? "local" : "error");
        setProfileError(
          isNonBlockingProfileError(error) ? "" : getProfileErrorMessage(error)
        );
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
  }, [username, profileStatus, playerId, highScore, coins, dailyStreak, effectiveAuthUserId, guestMode]);

  useEffect(() => {
    if (
      !profileOpen ||
      !username ||
      username === "Loading profile..." ||
      (!effectiveAuthUser && !guestMode) ||
      !isSupabaseConfigured ||
      !supabase
    ) {
      return;
    }

    fetchActiveGames({ silent: true });
  }, [profileOpen, username, playerId, effectiveAuthUserId, guestMode]);

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
    } else if (
      ["general", "world-cup", "career"].includes(gameMode) &&
      !isMockMultiplayer &&
      postGameStep === "summary"
    ) {
      playClickSound();
      setRewardPopup(null);
      setWrongPopup(null);
      setLevelUpPopup(null);
      setPostGameStep("xp");
    } else if (
      ["general", "world-cup", "career"].includes(gameMode) &&
      !isMockMultiplayer &&
      postGameStep === "xp"
    ) {
      exitToHomeSafely("post-game-collect");
    } else {
      exitToHomeSafely("result-button");
    }
  };

  const closePostGameProgress = () => {
    playClickSound();
    exitToHomeSafely("post-game-collect");
  };

  const closeConnectionsReward = ({ playAgain = false } = {}) => {
    playClickSound();
    setConnectionsRewardModal(null);

    if (playAgain) {
      startConnectionsGame(connectionsPuzzle?.difficulty || null);
      return;
    }

    setGameStarted(false);
    setConnectionsDifficultyPickerOpen(true);
    setModeMenuOpen(false);
  };

  const leagueActiveAttempt = activeLeagueDay ? readLeagueAttempt(activeLeagueDay.id) : null;
  const leagueDashboardRows = (leagueDashboard?.members || []).map((member, index) => {
    const submission = (leagueDashboard?.submissions || []).find(
      (item) => item.player_id === member.player_id
    );
    const isCurrentUser = member.player_id === playerId;
    const attempt =
      isCurrentUser &&
      leagueActiveAttempt?.leagueDayId === activeLeagueDay?.id &&
      leagueActiveAttempt?.status === "in_progress"
        ? leagueActiveAttempt
        : null;
    const scoreSource = submission || attempt;
    const status = submission ? "completed" : attempt ? "in-progress" : "not-played";
    const totalToday = getLeagueDailyTotal(scoreSource);
    const scoreItems = getLeagueScoreItems(
      scoreSource,
      leagueSettings,
      leagueTop10MaxPoints,
      leagueWhoAmIMaxPoints,
      leagueFindPlayerMaxPoints
    );

    return {
      member,
      rank: index + 1,
      submission,
      attempt,
      scoreSource,
      status,
      statusLabel:
        status === "completed"
          ? "Completed"
          : status === "in-progress"
          ? "In progress"
          : "Not played yet",
      totalToday,
      scoreItems,
      isCurrentUser,
      isLeader: index === 0 && (Number(member.total_points) || 0) > 0,
    };
  });

  const authCard = (
    <motion.div
      className="auth-card"
      initial={{ opacity: 0, scale: 0.9, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      transition={{ type: "spring", stiffness: 160, damping: 16 }}
    >
      <div className="auth-orb"><BKIcon name="profile" size={46} /></div>
      <div className="auth-kicker">Ball Knowledge Club</div>
      <h1>Create your club identity</h1>
      <p>
        Lock your username, save progress, and compete without impersonation.
      </p>

      <div className="auth-tabs">
        <button
          type="button"
          className={authMode === "signup" ? "active" : ""}
          onClick={() => {
            setAuthMode("signup");
            resetAuthFormFeedback();
          }}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={authMode === "login" ? "active" : ""}
          onClick={() => {
            setAuthMode("login");
            resetAuthFormFeedback();
          }}
        >
          Login
        </button>
      </div>

      <form className="auth-form" onSubmit={submitAuthForm}>
        {authMode === "signup" && (
          <label>
            Username
            <input
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
              placeholder="fabian"
              autoComplete="username"
              maxLength={18}
            />
          </label>
        )}

        <label>
          Email
          <input
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            minLength={6}
          />
        </label>

        {authError && <div className="auth-message error">{authError}</div>}
        {authNotice && <div className="auth-message notice">{authNotice}</div>}

        <button className="auth-submit" type="submit" disabled={authSubmitting}>
          {authSubmitting
            ? "Working..."
            : authMode === "signup"
            ? "Create Account"
            : "Login"}
        </button>
      </form>

      <button className="auth-guest-button" type="button" onClick={continueAsGuest}>
        Continue as Guest
      </button>
    </motion.div>
  );

  const authPromptModal = (
    <AnimatePresence>
      {authPrompt && (
        <motion.div
          className="auth-prompt-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            className="auth-prompt-close"
            type="button"
            onClick={() => setAuthPrompt(null)}
            aria-label="Close auth prompt"
          >
            <X size={18} />
          </button>
          <div className="auth-prompt-copy">
            <strong>{authPrompt}</strong>
          </div>
          {authCard}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (authLoading) {
    return (
      <div
        className="fullscreen-bg auth-screen"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(0,0,0,0.52)), url(${stadiumBg})`,
        }}
      >
        <div className="auth-loading-card">Loading club identity...</div>
      </div>
    );
  }

  if (!effectiveAuthUser && !guestMode) {
    return (
      <div
        className="fullscreen-bg auth-screen"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(0,0,0,0.52)), url(${stadiumBg})`,
        }}
      >
        {authCard}
      </div>
    );
  }

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
            <div className="name-ball"><BKIcon name="profile" size={58} /></div>

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
        <GameTopNav
          className="multiplayer-round-back"
          label="League"
          onClick={closeLeagueChallenge}
        />

        <AnimatePresence>
          {leagueLeaveConfirmOpen && (
            <motion.div
              className="league-leave-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="league-leave-modal"
                initial={{ scale: 0.92, y: 18 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 10 }}
              >
                <div className="league-kicker">League attempt locked</div>
                <h2>Leave league challenge?</h2>
                <p>
                  Your current score will be submitted and today's league challenge
                  will be locked. You cannot replay it.
                </p>
                <div className="league-leave-score">
                  <span>Current score</span>
                  <strong>
                    {leagueQuizScore +
                      leagueTop10TotalWithCurrent +
                      leagueWhoAmIScore +
                      leagueFindPlayerScore}
                    /{leagueSettings.maxDailyPoints}
                  </strong>
                </div>
                <div className="league-leave-actions">
                  <button
                    type="button"
                    onClick={() => setLeagueLeaveConfirmOpen(false)}
                    disabled={leagueAttemptSubmitting}
                  >
                    Stay
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={submitAndCloseLeagueAttempt}
                    disabled={leagueAttemptSubmitting}
                  >
                    {leagueAttemptSubmitting
                      ? "Submitting..."
                      : "Submit current result"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ScreenTransition className="league-challenge-screen">
          {leagueChallengePhase === "intro" && (
            <div className="league-challenge-card">
              <div className="league-kicker"><BKIcon name="league" size={22} /> Daily League</div>
              <h1>{leagueDayLabel} Challenge</h1>
              <p>
                Max {leagueSettings.maxDailyPoints} points: {leagueDailyStructureText}.
              </p>
              <button onClick={startLeagueQuiz}>Start</button>
            </div>
          )}

          {leagueChallengePhase === "quiz" && currentLeagueQuizQuestion && (
            <div className="league-challenge-card league-quiz-card">
              <div className="league-quiz-top">
                <span>
                  Question {leagueQuizIndex + 1}/{leagueSettings.quizCount}
                </span>
                <strong className={leagueTimeLeft <= 3 ? "danger" : ""}>
                  {leagueTimeLeft}s
                </strong>
                <span>
                  {leagueQuizScore}/{leagueSettings.quizCount}
                </span>
              </div>

              <h1 className="question-title quiz-question-card neonGlassCard league-question-card">
                {currentLeagueQuizQuestion.question}
              </h1>

              <div className="answers-grid neonAnswerGrid league-answer-grid">
                {currentLeagueQuizQuestion.options.map((option) => {
                  const isCorrect = option === currentLeagueQuizQuestion.answer;
                  const isChosen = leagueQuizSelected === option;
                  const showCorrect = leagueQuizSelected && isCorrect;
                  const showWrong = leagueQuizSelected && isChosen && !isCorrect;

                  return (
                    <button
                      key={option}
                      className={`answer-button neonAnswerButton ${
                        showCorrect ? "correct" : showWrong ? "wrong" : ""
                      }`}
                      disabled={Boolean(leagueQuizSelected)}
                      onClick={() => chooseLeagueQuizAnswer(option)}
                    >
                      <span>{option}</span>
                      {showCorrect && <CheckCircle2 size={28} />}
                      {showWrong && <XCircle size={28} />}
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
                  {Math.min(leagueTop10Score, leagueTop10TargetCount)}/{leagueTop10TargetCount}
                </span>
                <span>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        index >= leagueTop10Lives ? "league-life-used" : ""
                      }
                    >
                      <BKIcon name="lives" size={18} />
                    </span>
                  ))}
                </span>
                <strong>
                  Total: {leagueQuizScore + leagueTop10TotalWithCurrent + leagueWhoAmIScore}/
                  {leagueSettings.maxDailyPoints}
                </strong>
              </div>

              <div className="league-top10-list">
                {getChallengeAnswers(leagueTop10Challenge).map((answer, index) => {
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
                      <strong>{found ? formatAnswerWithValue(answer) : <BKIcon name="questionMark" size={24} />}</strong>
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
                {Math.min(leagueTop10Score, leagueTop10TargetCount)}/{leagueTop10TargetCount} found. Review the list, then keep climbing.
              </p>

              <div className="league-top10-reveal-list">
                {getChallengeAnswers(leagueTop10Challenge).map((answer, index) => {
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
                    Top 10: {leagueTop10TotalWithCurrent}/{leagueTop10MaxPoints}
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
                <div className="whoami-mystery-icon"><BKIcon name="questionMark" size={34} /></div>
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
                    Top 10: {leagueTop10TotalWithCurrent}/{leagueTop10MaxPoints}
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
                <div className="whoami-mystery-icon"><BKIcon name="questionMark" size={34} /></div>
                <div>
                  <span>Guesses: {leagueFindPlayerGuesses.length}</span>
                  <strong>{formatElapsedTime(leagueFindPlayerElapsed)}</strong>
                  {leagueFindPlayerRanking.poolSize > 0 && (
                    <small>{leagueFindPlayerRanking.poolSize} players ranked</small>
                  )}
                </div>
              </div>

              <div className="find-player-clue-panel">
                <div className="find-player-clue-list">
                  {leagueFindPlayerClues.slice(0, leagueFindPlayerClueCount).map((clue) => (
                    <span key={clue}>{clue}</span>
                  ))}
                  {leagueFindPlayerClueCount === 0 && (
                    <small>Optional clue ready</small>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLeagueFindPlayerClueCount((count) =>
                      Math.min(count + 1, leagueFindPlayerClues.length)
                    )
                  }
                  disabled={
                    leagueFindPlayerClueCount >= leagueFindPlayerClues.length ||
                    leagueFindPlayerFeedback.startsWith("Correct") ||
                    leagueFindPlayerFeedback.startsWith("Answer:")
                  }
                >
                  Reveal clue
                </button>
              </div>

              <div className="find-player-input-row">
                <React.Suspense
                  fallback={
                    <input
                      className="player-picker-input"
                      placeholder="Loading player search..."
                      disabled
                    />
                  }
                >
                  <PlayerPicker
                    value={leagueFindPlayerSelected}
                    onSelect={setLeagueFindPlayerSelected}
                    onSubmit={submitLeagueFindPlayerGuess}
                    autoSubmitOnSelect
                    placeholder="Search exact player..."
                    compact
                    maxSuggestions={5}
                    disabled={
                      leagueFindPlayerFeedback.startsWith("Correct") ||
                      leagueFindPlayerFeedback.startsWith("Answer:")
                    }
                  />
                </React.Suspense>
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
              <div className="league-kicker"><BKIcon name="dailyStreak" size={22} /> Day Complete</div>
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
                      {leagueResult.top10Score}/{leagueTop10MaxPoints}
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
        <GameTopNav
          className="multiplayer-round-back"
          label="Save & Exit"
          onClick={() => submitMultiplayerRoundScore(multiplayerRoundScore)}
          disabled={isSubmittingRound || multiplayerLoading}
        />

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

          {activeRound?.category === "career_path" ? (
            <CareerPathQuestionView
              question={currentMultiplayerRoundQuestion.question}
              className="multiplayer-career-path-card"
            />
          ) : (
            <h1 className="question-title quiz-question-card neonGlassCard">
              {currentMultiplayerRoundQuestion.question}
            </h1>
          )}

          {multiplayerRoundSelected === MULTIPLAYER_TIMEOUT_VALUE && (
            <div className="multiplayer-timeup-card">Time's up!</div>
          )}

          <div className="answers-grid neonAnswerGrid">
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
                  className={`answer-button neonAnswerButton ${
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
  }  if (connectionsDifficultyPickerOpen) {
    const connectionDifficulties = [
      {
        label: "Easy",
        subtitle: "Warm-up groups",
        icon: "connections",
        className: "easy",
      },
      {
        label: "Medium",
        subtitle: "Real football knowledge",
        icon: "connections",
        className: "medium",
      },
      {
        label: "Hard",
        subtitle: "For ball knowledge people",
        icon: "connections",
        className: "hard",
      },
      {
        label: "Very Hard",
        subtitle: "Only for football nerds",
        icon: "dailyStreak",
        className: "very-hard",
      },
    ];

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.58)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {coinRewardToastOverlay}
        {xpToastOverlay}

        <ScreenTransition className="connections-difficulty-screen">
          <GameTopNav
            className="connections-back-button"
            label="Back"
            onClick={() => {
              playClickSound();
              setConnectionsDifficultyPickerOpen(false);
              setModeMenuOpen(true);
              setGameMode("general");
              setGameStarted(false);
            }}
          />

          <div className="connections-difficulty-panel">
            <div className="connections-difficulty-hero">
              <div className="connections-kicker">Single Player</div>
              <h1>Choose Connections Level</h1>
              <p>Pick the difficulty and solve four hidden football groups.</p>
            </div>

            <div className="connections-difficulty-grid">
              {connectionDifficulties.map((difficulty) => (
                <button
                  key={difficulty.label}
                  className={`connections-difficulty-card ${difficulty.className}`}
                  onClick={() => startConnectionsGame(difficulty.label)}
                >
                  <div className="difficulty-card-top">
                    <span className="difficulty-emoji"><BKIcon name={difficulty.icon} size={28} /></span>
                    <span className="difficulty-count">
                      {
                        CONNECTIONS_PUZZLES.filter(
                          (puzzle) => puzzle.difficulty === difficulty.label
                        ).length
                      }{" "}
                      puzzles
                    </span>
                  </div>

                  <strong>{difficulty.label}</strong>
                  <p>{difficulty.subtitle}</p>

                  <span className="difficulty-play">Play now →</span>
                </button>
              ))}
            </div>
          </div>
        </ScreenTransition>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div
        className={`fullscreen-bg ${isHomeScreen ? "home-landing-bg" : ""}`}
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(0,0,0,0.34)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {levelProgressModal}
        {postGameProgressModal}
        {avatarPickerModal}
        {authPromptModal}
        {postGameStep !== "xp" && xpToastOverlay}
        {postGameStep !== "xp" && objectiveProgressModal}
        <AnimatePresence>
          {showDailyCompletePopup && lastDailyResult && (
            <motion.div
              className="daily-reward-view-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="daily-reward-popup"
                initial={{ opacity: 0, scale: 0.82, y: 35 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.35 }}
              >
                <div className="daily-reward-top">
                <div className="daily-reward-fire"><BKIcon name="dailyStreak" size={48} /></div>

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
                <BKIcon name="dailyChallenge" size={58} />
              </motion.div>

              <div className="daily-reward-earned">
                <span>Today you earned</span>
                <strong><BKIcon name="coins" size={22} /> +{lastDailyResult.coins}</strong>
              </div>

              {lastDailyResult.streakBonus > 0 && (
                <div className="daily-reward-bonus">
                  <BKIcon name="dailyStreak" size={20} /> Streak bonus +{lastDailyResult.streakBonus}
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
                        <BKIcon
                          name={currentDay ? "dailyStreak" : reached ? "dailyChallenge" : "singlePlayer"}
                          size={26}
                        />
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
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
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
          <BKIcon name="rankings" size={54} />
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
            <LevelIcon levelId={levelUpPopup.oldLevel.id} size={76} />
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
                <LevelIcon levelId={level.id} size={76} />
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
          {levelUpPopup.coins ? (
            <span className="level-up-coin-bonus">
              <BKIcon name="coins" size={20} /> +{levelUpPopup.coins} coins
            </span>
          ) : null}
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
                  <div className="profile-name-pill">
                    <span>{profileAvatar.flag}</span> {displayName}
                  </div>
                  <button className="profile-edit-avatar-button" onClick={openAvatarBuilder}>
                    Edit Avatar
                  </button>
                  <div className={`profile-sync-pill ${profileStatus}`}>
                    {isGuest
                      ? "Guest profile"
                      : profileStatus === "ready"
                      ? "Online profile saved"
                      : profileStatus === "syncing"
                      ? "Syncing profile..."
                      : profileError || "Local profile"}
                  </div>
                  {!isGuest && effectiveAuthUser?.email && (
                    <div className="profile-account-email">{effectiveAuthUser.email}</div>
                  )}
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
                  <span><BKIcon name="dailyStreak" size={24} /></span>
                  <strong>{highScore}</strong>
                  <small>Best score</small>
                </div>

                <button
                  className="profile-stat-card profile-stat-button"
                  onClick={openCoinShop}
                >
                  <span><BKIcon name="coins" size={24} /></span>
                  <strong>{coins}</strong>
                  <small>Coins</small>
                </button>

                <button
                  className="profile-stat-card profile-stat-button"
                  onClick={openDailyRewardMeter}
                >
                  <span><BKIcon name="dailyChallenge" size={24} /></span>
                  <strong>{dailyStreak}</strong>
                  <small>Daily streak</small>
                </button>

                <div className="profile-stat-card">
                  <span><LevelIcon levelId={playerLevel.id} size={26} /></span>
                  <strong>{playerLevel.levelNumber}</strong>
                  <small>Level</small>
                </div>

                <div className="profile-stat-card">
                  <span><BKIcon name="h2h" size={24} /></span>
                  <strong>{profileStats.multiplayerWins}</strong>
                  <small>Wins</small>
                </div>

                <div className="profile-stat-card">
                  <span><BKIcon name="questionMark" size={24} /></span>
                  <strong>{profileStats.multiplayerLosses}</strong>
                  <small>Losses</small>
                </div>

                <div className="profile-stat-card">
                  <span><BKIcon name="multiplayer" size={24} /></span>
                  <strong>{profileStats.multiplayerDraws}</strong>
                  <small>Draws</small>
                </div>

                <div className="profile-stat-card">
                  <span><BKIcon name="activeMatches" size={24} /></span>
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
                {isGuest ? (
                  <>
                    <button
                      className="profile-change-name-button"
                      onClick={changeUsername}
                    >
                      CHANGE GUEST NAME
                    </button>
                    <button
                      className="profile-auth-button"
                      onClick={switchAccount}
                    >
                      SWITCH ACCOUNT
                    </button>
                  </>
                ) : (
                  <button className="profile-logout-button" onClick={logout}>
                    LOG OUT
                  </button>
                )}
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
                All Time • Real player profiles
              </p>

              <div className="leaderboard-tabs leaderboard-tabs-premium">
                <button
                  className={leaderboardTab === "general" ? "active" : ""}
                  onClick={() => setLeaderboardTab("general")}
                >
                  General Knowledge
                </button>
                <button
                  className={leaderboardTab === "levels" ? "active" : ""}
                  onClick={() => setLeaderboardTab("levels")}
                >
                  Highest Levels
                </button>
              </div>

              <div className="leaderboard-mode-pill">
                {leaderboardTab === "levels" ? "Highest Levels" : "General Knowledge"}
              </div>

              {leaderboardLoading ? (
                <div className="leaderboard-empty-state">
                  <strong>Loading scores...</strong>
                  <span>Finding the sharpest ball knowledge.</span>
                </div>
              ) : leaderboardTab === "general" && leaderboardRows.length > 0 ? (
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
              ) : leaderboardTab === "levels" && levelLeaderboardRows.length > 0 ? (
                <div className="leaderboard-list">
                  {levelLeaderboardRows.map((row) => (
                    <motion.div
                      key={row.id || row.username}
                      className={`leaderboard-row level-leaderboard-row rank-${row.rank} ${
                        row.isCurrentUser ? "current-user" : ""
                      }`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: row.rank * 0.035, duration: 0.22 }}
                    >
                      <div className="leaderboard-rank">
                        {row.medal || row.rank}
                      </div>

                      <PlayerAvatar profile={row} size="small" />

                      <div className="leaderboard-player">
                        <strong>{row.username}</strong>
                        <small>
                          Level {row.levelId} · {row.levelName}
                        </small>
                      </div>

                      <div className="leaderboard-score level-score">
                        <span><LevelIcon levelId={row.levelId} size={26} /></span>
                        <strong>{row.xpTotal.toLocaleString()}</strong>
                        <small>XP</small>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="leaderboard-empty-state">
                  <strong>
                    {leaderboardTab === "levels" ? "No levels yet" : "No rankings yet"}
                  </strong>
                  <span>
                    {leaderboardError ||
                      (leaderboardTab === "levels"
                        ? "Earn XP to appear on the levels leaderboard"
                        : "No rankings yet. Play a game to enter the leaderboard.")}
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
                <GameTopNav label="Back" onClick={goBackMultiplayer} />
              </div>

              <div className="multiplayer-badge">
                <BKIcon name="multiplayer" size={22} /> Arena
              </div>
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
                    onClick={openPlayNowLobby}
                    disabled={multiplayerLoading}
                  >
                    <span><BKIcon name="playNow" size={48} /></span>
                    <strong>Play Now</strong>
                    <small>Random async matches</small>
                  </button>

                  <button
                    className="arena-hub-card h2h"
                    onClick={() => openArenaSection("h2h-menu")}
                  >
                    <span><BKIcon name="h2h" size={48} /></span>
                    <strong>H2H</strong>
                    <small>Async 1v1 battles</small>
                  </button>

                  <button
                    className="arena-hub-card league"
                    onClick={() => openArenaSection("league-menu")}
                  >
                    <span><BKIcon name="league" size={48} /></span>
                    <strong>League</strong>
                    <small>Daily points with friends</small>
                  </button>
                </div>
              )}

              {multiplayerStep === "play-now" && (
                <div className="play-now-lobby">
                  <div className="play-now-lobby-hero">
                    <div>
                      <div className="league-kicker">Arena</div>
                      <h2>Play Now</h2>
                      <p>
                        Play a random async match. You play now, your opponent
                        answers later.
                      </p>
                    </div>
                  </div>

                  <div className="play-now-choice-grid">
                    <button
                      type="button"
                      className="play-now-choice-card current"
                      onClick={openCurrentRandomMatches}
                      disabled={playNowGamesLoading}
                    >
                      <span><BKIcon name="activeRandomMatches" size={42} /></span>
                      <strong>
                        {playNowGamesLoading
                          ? "Loading..."
                          : "Active Random Matches"}
                      </strong>
                      <small>Continue matches you already started.</small>
                    </button>

                    <button
                      type="button"
                      className="play-now-choice-card start"
                      onClick={() => startPlayNow(playNowCategory)}
                      disabled={multiplayerLoading}
                    >
                      <span><BKIcon name="startNewRandomMatch" size={42} /></span>
                      <strong>
                        {multiplayerLoading
                          ? "Finding..."
                          : "Start New Random Match"}
                      </strong>
                      <small>Find an opponent and start a new async match.</small>
                    </button>
                  </div>

                </div>
              )}

              {multiplayerStep === "play-now-active-games" && (
                <div className="active-games-page play-now-active-page">
                  <div className="active-games-page-header">
                    <div>
                      <div className="league-kicker">Arena</div>
                      <h2>Active Random Matches</h2>
                      <p>Continue random matches you already started.</p>
                    </div>
                    <button
                      type="button"
                      className="refresh-play-now-button"
                      onClick={() => loadPlayNowGames()}
                      disabled={playNowGamesLoading}
                    >
                      {playNowGamesLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  <div className="active-games-panel play-now-games-panel standalone">
                    {playNowGamesLoading ? (
                      <div className="active-games-empty">
                        <strong>Loading current matches...</strong>
                        <span>Checking your saved random matches.</span>
                      </div>
                    ) : playNowGames.length === 0 ? (
                      <div className="active-games-empty">
                        <strong>No current random matches</strong>
                        <span>Start a new random match when you are ready.</span>
                      </div>
                    ) : (
                      <div className="active-games-list play-now-games-list">
                        {playNowGames.map(({ match, latestRound }) => {
                          const playerSlot = getCurrentPlayerSlot(
                            match,
                            playerId,
                            username
                          );
                          const opponentSlot =
                            playerSlot === "player1" ? "player2" : "player1";
                          const opponentProfile = getMatchPlayerProfile(
                            match,
                            opponentSlot
                          );
                          const userFinished = hasPlayerFinishedRound(
                            latestRound,
                            playerSlot
                          );
                          const opponentFinished =
                            playerSlot === "player1"
                              ? Boolean(latestRound?.player2_finished)
                              : Boolean(latestRound?.player1_finished);
                          const userScore =
                            playerSlot === "player2"
                              ? latestRound?.player2_score ?? 0
                              : latestRound?.player1_score ?? 0;
                          const opponentScore =
                            playerSlot === "player2"
                              ? latestRound?.player1_score ?? 0
                              : latestRound?.player2_score ?? 0;
                          const opponentName = getOpponentName(match, playerId, username);
                          const opponentLabel =
                            opponentName && opponentName !== "your opponent"
                              ? opponentName
                              : match.player2_id
                              ? "your opponent"
                              : "random opponent";
                          const isCompleted = match.status === "completed";
                          const isChoosingNext = match.phase === "round_finished";
                          const isCurrentChooser = isCurrentPlayersTurn(
                            match,
                            playerId,
                            username
                          );
                          const category = latestRound?.category || match.selected_category;
                          let statusText = "Ready to play";
                          let detailText = `${opponentLabel} is waiting`;
                          let ctaText = "Play now";

                          if (isCompleted) {
                            const winner = latestRound?.winner;
                            statusText =
                              winner === "draw"
                                ? "Draw"
                                : winner === username
                                ? "You won"
                                : "You lost";
                            detailText = `${userScore} - ${opponentScore}`;
                            ctaText = "View Result";
                          } else if (isChoosingNext && isCurrentChooser) {
                            statusText = "Choose next category";
                            detailText = `Continue vs ${opponentLabel}`;
                            ctaText = "Choose Category";
                          } else if (isChoosingNext) {
                            statusText = `Waiting for ${opponentLabel}`;
                            detailText = `Waiting for ${opponentLabel} to choose the next category`;
                            ctaText = "Waiting";
                          } else if (userFinished && !opponentFinished) {
                            statusText = `Waiting for ${opponentLabel}`;
                            detailText = "Your score is saved";
                            ctaText = "Waiting";
                          } else if (!userFinished) {
                            statusText =
                              playerSlot === "player2"
                                ? `${opponentLabel} is waiting`
                                : "Ready to play";
                            detailText = getCategoryLabel(category);
                            ctaText = "Continue";
                          }

                          return (
                            <div
                              className={`active-game-card play-now-game-card ${getCategoryClass(
                                category
                              )}`}
                              key={match.id}
                            >
                              <div className="active-game-top">
                                <div className="active-game-player">
                                  <PlayerAvatar profile={opponentProfile} size="small" />
                                  <strong>
                                    {opponentLabel === "random opponent"
                                      ? "Searching random opponent"
                                      : opponentLabel}
                                  </strong>
                                </div>
                                <span>{match.room_code}</span>
                              </div>

                              {category && (
                                <div
                                  className={`active-game-category ${getCategoryClass(
                                    category
                                  )}`}
                                >
                                  {getCategoryLabel(category)}
                                </div>
                              )}

                              <div className="active-game-score">
                                Your score: {userFinished ? userScore : "-"} · Opponent:{" "}
                                {opponentFinished || isCompleted ? opponentScore : "-"}
                              </div>

                              <div
                                className={`active-game-status ${
                                  isCompleted
                                    ? "result"
                                    : userFinished
                                    ? "waiting"
                                    : "your-turn"
                                }`}
                              >
                                {statusText}
                              </div>

                              <small>{detailText}</small>

                              <div className="active-game-actions">
                                <button
                                  className="open-match-button"
                                  onClick={() => openPlayNowGame(match.id)}
                                  disabled={multiplayerLoading}
                                >
                                  {ctaText}
                                </button>

                                <button
                                  className="delete-match-button leave-play-now-button"
                                  onClick={() => requestDeleteMatch(match)}
                                  disabled={Boolean(deletingMatchId)}
                                  aria-label="Leave random match"
                                >
                                  <Trash2 size={16} />
                                  <span>Leave</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {multiplayerStep === "league-menu" && (
                <div className="arena-section-grid league-theme">
                  <button
                    className="multiplayer-action-card league-list"
                    onClick={loadMyLeagues}
                    disabled={leagueLoading}
                  >
                    <span><BKIcon name="myLeagues" size={42} /></span>
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
                    <span><BKIcon name="createLeague" size={42} /></span>
                    <strong>Create League</strong>
                  </button>

                  <button
                    className="multiplayer-action-card league-join"
                    onClick={() => {
                      playClickSound();
                      setMultiplayerStep("join-league");
                    }}
                  >
                    <span><BKIcon name="joinLeague" size={42} /></span>
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
                    <span><BKIcon name="activeMatches" size={42} /></span>
                    <strong>
                      {activeGamesLoading ? "Loading..." : "Active Matches"}
                    </strong>
                  </button>

                  <button
                    className="multiplayer-action-card create"
                    onClick={createMultiplayerMatch}
                    disabled={multiplayerLoading}
                  >
                    <span><BKIcon name="createMatch" size={42} /></span>
                    <strong>{multiplayerLoading ? "Creating..." : "Create Match"}</strong>
                  </button>

                  <button
                    className="multiplayer-action-card join"
                    onClick={() => {
                      playClickSound();
                      setMultiplayerStep("join");
                    }}
                  >
                    <span><BKIcon name="joinMatch" size={42} /></span>
                    <strong>Join Match</strong>
                  </button>
                </div>
              )}

              {multiplayerStep === "active-games" && (
                <div className="active-games-page h2h-active-page">
                  <div className="active-games-page-header">
                    <div>
                      <div className="league-kicker">Arena</div>
                      <h2>H2H Active Matches</h2>
                      <p>Continue friend and invite matches.</p>
                    </div>

                    <button onClick={fetchActiveGames} disabled={activeGamesLoading}>
                      {activeGamesLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  <div className="active-games-panel standalone">
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

                </div>
              )}

              {multiplayerStep === "create-league" && (
                <div className="league-form-card">
                  <div className="league-kicker">
                    <BKIcon name="createLeague" size={22} /> Create League
                  </div>
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
                          <b><BKIcon name={config.icon} size={34} /></b>
                          <span>{config.label}</span>
                          <small>{config.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  {leagueFormatInput !== "custom" && (
                    <button
                      type="button"
                      className="league-customize-link"
                      onClick={() => customizeLeaguePreset(leagueFormatInput)}
                    >
                      Customize this
                    </button>
                  )}

                  {leagueFormatInput === "custom" && (
                    <>
                      <div className="league-picker-section compact">
                        <strong>Length</strong>
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
                    </>
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
                    <span>Your league</span>
                    <strong>
                      {leagueSettings.quizCount} quiz · {leagueSettings.top10Count} Top 10 ·{" "}
                      {leagueSettings.whoamiCount} Who Am I ·{" "}
                      {leagueSettings.findPlayerCount || 0} Find
                    </strong>
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
                  <div className="league-kicker">
                    <BKIcon name="joinLeague" size={22} /> Join League
                  </div>
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
                <div className="active-games-page league-list-page">
                  <div className="active-games-page-header">
                    <div>
                      <div className="league-kicker">Arena</div>
                      <h2>My Leagues</h2>
                      <p>Open leagues you created or joined.</p>
                    </div>
                    <button onClick={loadMyLeagues} disabled={leagueLoading}>
                      {leagueLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  <div className="active-games-panel league-list-panel standalone">
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
                </div>
              )}

              {multiplayerStep === "league-dashboard" && leagueDashboard && (
                <div className="league-dashboard">
                  <div className="league-dashboard-hero">
                    <div className="league-dashboard-title-block">
                      <div className="league-kicker">
                        <BKIcon name="league" size={22} /> League
                      </div>
                      <h2>{leagueDashboard.league.name}</h2>
                    </div>
                    <div className="league-dashboard-actions">
                      <div className="league-code-pill">{leagueDashboard.league.league_code}</div>
                      <button
                        type="button"
                        className="league-leave-button"
                        onClick={() => setLeagueExitConfirmOpen(true)}
                        disabled={leagueLoading}
                      >
                        Leave league
                      </button>
                    </div>
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
                    <div className="league-daily-card-top">
                      <strong>Today's Challenge</strong>
                      <span className="league-daily-max">
                        Max {leagueSettings.maxDailyPoints} pts
                      </span>
                    </div>
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
                        <div className="league-daily-mini-stats">
                          {getLeagueScoreItems(
                            activeLeagueSubmission,
                            leagueSettings,
                            leagueTop10MaxPoints,
                            leagueWhoAmIMaxPoints,
                            leagueFindPlayerMaxPoints
                          ).map((item) => (
                            <span key={item.key}>
                              <em>{item.label}</em>
                              <b>{item.display}</b>
                            </span>
                          ))}
                        </div>
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
                  <div className="league-leaderboard premium-league-table">
                    {leagueDashboardRows.map((row) => (
                      <div
                        className={`league-row premium-league-row ${
                          row.isCurrentUser ? "current-user" : ""
                        } ${row.isLeader ? "league-leader" : ""}`}
                        key={row.member.id}
                      >
                        <div className="league-rank">
                          <span>#{row.rank}</span>
                        </div>
                        <div className="league-player-cell">
                          <PlayerAvatar
                            profile={getSocialProfile(row.member.player_id, row.member.username)}
                            size="small"
                          />
                          <div className="league-player-copy">
                            <strong>{row.member.username}</strong>
                            <small>{row.member.days_played || 0} days played</small>
                          </div>
                        </div>
                        <div className={`league-status-pill ${row.status}`}>
                          {row.statusLabel}
                        </div>
                        <div className="league-score-pill-grid">
                          {row.scoreItems.length > 0 ? (
                            row.scoreItems.map((item) => (
                              <span className="league-score-pill" key={item.key}>
                                <em>{item.label}</em>
                                <b>{item.display}</b>
                              </span>
                            ))
                          ) : (
                            <span className="league-score-pill muted">
                              <em>Today</em>
                              <b>-</b>
                            </span>
                          )}
                        </div>
                        <div className="league-total-stack">
                          <span>Today</span>
                          <strong>{row.totalToday}</strong>
                        </div>
                        <div className="league-total-stack overall">
                          <span>Total</span>
                          <strong>{row.member.total_points || 0}</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="league-section-title">Today</div>
                  <div className="league-results-list premium-today-list">
                    {leagueDashboardRows.map((row) => (
                      <div className={`league-result-row premium-today-row ${row.status}`} key={row.member.id}>
                        <div className="league-result-player">
                          <PlayerAvatar
                            profile={getSocialProfile(row.member.player_id, row.member.username)}
                            size="small"
                          />
                          <div className="league-player-copy">
                            <strong>{row.member.username}</strong>
                            <small>{row.statusLabel}</small>
                          </div>
                        </div>
                        <div className="league-today-score-grid">
                          {row.scoreItems.length > 0 ? (
                            row.scoreItems.map((item) => (
                              <span className="league-score-pill" key={item.key}>
                                <em>{item.label}</em>
                                <b>{item.display}</b>
                              </span>
                            ))
                          ) : (
                            <span className="league-score-pill muted">
                              <em>Score</em>
                              <b>-</b>
                            </span>
                          )}
                          <span className="league-score-pill total">
                            <em>Total today</em>
                            <b>{row.totalToday}/{leagueSettings.maxDailyPoints}</b>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {leagueExitConfirmOpen && (
                    <div className="match-delete-overlay">
                      <div className="match-delete-modal league-leave-modal">
                        <strong>Leave this league?</strong>
                        <span>Are you sure you want to leave this league?</span>
                        {activeLeague?.created_by_id === (effectiveAuthUser?.id || playerId) && (
                          <small>
                            If other members are still here, ownership will move to another member.
                            If not, the league will be archived.
                          </small>
                        )}
                        <div>
                          <button
                            type="button"
                            onClick={() => setLeagueExitConfirmOpen(false)}
                            disabled={leagueLoading}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={confirmLeaveActiveLeague}
                            disabled={leagueLoading}
                          >
                            {leagueLoading ? "Leaving..." : "Leave league"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {multiplayerStep === "play-now-waiting" && (
                <div className="multiplayer-room-card play-now-waiting-card">
                  <div className="room-status">Waiting for random opponent</div>
                  <p>Your score is saved. We will match you with a random player.</p>
                  <div className="multiplayer-player-list">
                    <span>
                      <PlayerAvatar
                        profile={getMatchPlayerProfile(
                          activeMatch,
                          multiplayerPlayerSlot || "player1"
                        )}
                        size="small"
                      />
                      {username}
                    </span>
                    <span className="waiting-opponent-profile">
                      <PlayerAvatar
                        profile={{
                          avatar_icon: "profile",
                          avatar_style: "mystery",
                          avatar_color: "purple",
                          avatar_bg: "night",
                        }}
                        size="small"
                        hideFlag
                      />
	                      Searching random opponent
                    </span>
                  </div>
                  {activeRound && (
                    <div className="multiplayer-round-result-card">
                      <strong>Your saved score</strong>
                      <span>{getCategoryLabel(activeRound.category)}</span>
                      <div className="round-score-grid">
                        <div>
                          <small>{username}</small>
                          <b>
                            {multiplayerPlayerSlot === "player2"
                              ? activeRound.player2_score ?? 0
                              : activeRound.player1_score ?? 0}
                          </b>
                        </div>
                        <div>
                          <small>Opponent</small>
                          <b>Waiting</b>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="room-code">Public match: {multiplayerRoomCode}</div>
                  <button onClick={refreshMultiplayerMatch} disabled={multiplayerLoading}>
                    {multiplayerLoading ? "Checking..." : "Check Now"}
                  </button>
                  <GameTopNav
                    className="multiplayer-back-button"
                    label="Home"
                    variant="home"
                    onClick={goBackMultiplayer}
                  />
                </div>
              )}

              {multiplayerStep === "created" && (
                <div className="multiplayer-room-card">
                  <div className="room-status">
                    {isH2HWaitingAfterCreatorRound
                      ? "Your round is complete"
                      : "Match created"}
                  </div>
                  {isH2HWaitingAfterCreatorRound && (
                    <p>
                      Share room code {multiplayerRoomCode} and wait for your opponent.
                    </p>
                  )}
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
                  ) : isH2HWaitingAfterCreatorRound ? (
                    <>
                      <div className="waiting-pulse">
                        <span />
                        <span />
                        <span />
                      </div>
                      <p>Your score is saved. Waiting for opponent to play.</p>
                    </>
                  ) : (
                    <>
                      <p>Choose a category and play your first round now.</p>
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
                        <span>
                          {isH2HWaitingAfterCreatorRound
                            ? `Share ${multiplayerRoomCode}. Waiting for opponent to join and play.`
                            : "Waiting for opponent to play this round"}
                        </span>
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
                        Next:{" "}
                        {isMultiplayerTurn
                          ? "you choose the next category"
                          : `${nextCategoryWaitingName} chooses the next category`}
                      </p>
                      {canChooseMultiplayerCategory ? (
                        <p>Pick the next category above.</p>
                      ) : (
                        <p>Waiting for {nextCategoryWaitingName} to choose the next category</p>
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
                  <div className="room-status">
                    {activeMatch?.is_public ? "Play Now Match" : "Joined room"}
                  </div>
                  {activeMatch?.is_public ? (
                    <div className="room-code">Random match vs {activeOpponentLabel}</div>
                  ) : (
                    <div className="room-code">Room code: {multiplayerRoomCode}</div>
                  )}
                  <div className="opponent-found">
                    {activeMatch?.is_public
                      ? `Opponent: ${activeOpponentLabel}`
                      : "Opponent found"}
                  </div>
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
	                        : `${nextCategoryWaitingName} chooses first`}
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
	                        <span>Waiting for {activeOpponentLabel} to play this round</span>
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
	                        Next:{" "}
	                        {isMultiplayerTurn
	                          ? "you choose the next category"
	                          : `${nextCategoryWaitingName} chooses the next category`}
	                      </p>
                      {canChooseMultiplayerCategory ? (
                        <p>Pick the next category above.</p>
                      ) : (
                        <p>Waiting for {nextCategoryWaitingName} to choose the next category</p>
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
                    <strong>
                      {matchDeleteCandidate.is_public
                        ? "Leave this random match?"
                        : "Delete this match?"}
                    </strong>
                    <span>
                      {matchDeleteCandidate.is_public
                        ? "This removes the Play Now match from Active Games."
                        : "This removes it from your Active Matches."}
                    </span>
                    <div>
                      <button onClick={cancelDeleteMatch}>Cancel</button>
                      <button
                        className="danger"
                        onClick={confirmDeleteMatch}
                        disabled={deletingMatchId === matchDeleteCandidate.id}
                      >
                        {deletingMatchId === matchDeleteCandidate.id
                          ? matchDeleteCandidate.is_public
                            ? "Leaving..."
                            : "Deleting..."
                          : matchDeleteCandidate.is_public
                          ? "Leave"
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
                  type="button"
                  className="home-stat-pill home-streak-pill stat-clickable"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDailyRewardMeter();
                  }}
                >
                  <span><BKIcon name="dailyStreak" size={24} /></span>
                  <strong>{dailyStreak}</strong>
                  <small>Daily streak</small>
                </button>

                <button
                  type="button"
                  className="home-stat-pill home-coins-pill coin-clickable"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCoinShop();
                  }}
                >
                  <span><BKIcon name="coins" size={24} /></span>
                  <strong>{coins}</strong>
                  <small>Coins</small>
                </button>
              </div>

              <div className="home-level-box">
                <div className="home-level-left">
                    <div className="home-level-emoji">
                      <LevelIcon levelId={playerLevel.id} size={48} />
                    </div>

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
              <span className="main-menu-icon app-icon">
                <BKIcon name="singlePlayer" size={42} />
              </span>
              <span className="main-menu-copy">
                <strong>SINGLE PLAYER</strong>
                <small>Train your ball knowledge</small>
              </span>
            </button>

            <button
              className="multiplayer-main-button home-action-card home-action-multiplayer"
              onClick={openMultiplayer}
            >
              <span className="main-menu-icon app-icon">
                <BKIcon name="multiplayer" size={42} />
              </span>
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
              <span className="main-menu-icon app-icon">
                <BKIcon name="dailyChallenge" size={42} />
              </span>
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
                <span className="main-menu-icon app-icon">
                  <BKIcon name="rankings" size={42} />
                </span>
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
              <span className="mode-card-icon app-icon">
                <BKIcon name="generalKnowledge" size={40} />
              </span>
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
              <span className="mode-card-icon app-icon">
                <BKIcon name="careerPath" size={40} />
              </span>
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
              <span className="mode-card-icon app-icon">
                <BKIcon name="worldCup" size={40} />
              </span>
              <span>
                <strong>World Cup</strong>
                <small>Tournament history</small>
              </span>
            </button>

            <button
              className="mode-button mode-card connections-mode-button"
              onClick={openConnectionsDifficultyPicker}
            >
              <span className="mode-card-icon app-icon">
                <BKIcon name="connections" size={40} />
              </span>
              <span>
                <strong>Connections</strong>
                <small>Find the 4 groups</small>
              </span>
            </button>

            <button
              className="mode-button mode-card mode-whoami"
              onClick={() => startWhoAmIGame(getDailyDateKey())}
            >
              <span className="mode-card-icon app-icon">
                <BKIcon name="whoAmI" size={40} />
              </span>
              <span>
                <strong>Who Am I?</strong>
                <small>Guess the player from clues</small>
              </span>
            </button>

            <button
              className="mode-button mode-card mode-find-player"
              onClick={() => startFindPlayerGame(getDailyDateKey())}
            >
              <span className="mode-card-icon app-icon">
                <BKIcon name="findThePlayer" size={40} />
              </span>
              <span>
                <strong>Find the Player</strong>
                <small>Guess by distance clues</small>
              </span>
            </button>

            <GameTopNav
              className="mode-back-button"
              label="Back"
              onClick={() => {
                playClickSound();
                setModeMenuOpen(false);
              }}
            />
          </div>
        )}
          </ScreenTransition>
        </AnimatePresence>
      </div>
    );
  }

  if (gameMode === "who-am-i" && currentWhoAmI) {
    const todayKey = getDailyDateKey();
    const whoAmIDateLabel = formatDisplayDate(whoAmIDate);

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
          <GameTopNav
            className="connections-back-button whoami-back-button premiumBackButton"
            label="Back"
            onClick={() => {
              playClickSound();
              setGameStarted(false);
              setModeMenuOpen(true);
              setGameMode("general");
              setWhoAmIFeedback(null);
            }}
          />

          <motion.div
            className={`whoami-card ${whoAmIShake ? "shake" : ""}`}
            key={currentWhoAmI.id}
            animate={whoAmIShake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className="whoami-top">
              <div>
                <div className="whoami-kicker">Daily Puzzle</div>
                <h1>Daily Who Am I</h1>
              </div>
              <div className={`whoami-difficulty ${currentWhoAmI.difficulty.toLowerCase()}`}>
                {currentWhoAmI.difficulty}
              </div>
            </div>

            <div className="find-player-date-row whoami-date-row">
              <button onClick={() => startWhoAmIGame(addDaysToDateKey(whoAmIDate, -1))}>
                Previous Day
              </button>
              <strong>{whoAmIDateLabel}</strong>
              <button
                onClick={() => startWhoAmIGame(todayKey)}
                disabled={whoAmIDate >= todayKey}
              >
                Today
              </button>
              <button
                onClick={() => startWhoAmIGame(addDaysToDateKey(whoAmIDate, 1))}
                disabled={whoAmIDate >= todayKey}
              >
                Next Day
              </button>
            </div>

            <div className="whoami-hud">
              <span>Score <strong>{whoAmIScore}</strong></span>
              <span>Completed <strong>{whoAmIStreak}</strong></span>
              <span>Rank <strong>-</strong></span>
            </div>

            <div className="whoami-mystery">
              <motion.div
                className="whoami-silhouette"
                animate={{ scale: [1, 1.04, 1], rotate: [0, -1, 1, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <BKIcon name="whoAmI" size={64} />
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
                <button onClick={() => startWhoAmIGame(whoAmIDate)}>Play Again</button>
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
    const findPlayerDateLabel = formatDisplayDate(findPlayerDate);
    const todayKey = getDailyDateKey();
    const findPlayerSavedResult = findPlayerTarget
      ? getDailyModeResult("find_player", findPlayerDate, findPlayerTarget.id)
      : null;
    const findPlayerSolvedBefore = Boolean(findPlayerSavedResult?.solved);
    const findPlayerGaveUpBefore =
      Boolean(findPlayerSavedResult?.gaveUp) && !findPlayerSolvedBefore;

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
          <GameTopNav
            className="connections-back-button whoami-back-button"
            label="Back"
            onClick={() => {
              playClickSound();
              setGameStarted(false);
              setModeMenuOpen(true);
              setGameMode("general");
            }}
          />

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
                <div className="whoami-mystery-icon">
                  <BKIcon name="findThePlayer" size={34} />
                </div>
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
                  <div className="whoami-mystery-icon">
                    <BKIcon name="findThePlayer" size={34} />
                  </div>
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
                    {findPlayerSolvedBefore ? (
                      <small>Replay mode · Full XP already claimed · Replay reward +10 XP</small>
                    ) : findPlayerGaveUpBefore ? (
                      <small>Try again · Full solve XP still available</small>
                    ) : (
                      <small>Solve to earn +100 XP</small>
                    )}
                  </div>
                </div>

                <div className="find-player-clue-panel">
                  <div className="find-player-clue-list">
                    {findPlayerClues.slice(0, findPlayerClueCount).map((clue) => (
                      <span key={clue}>{clue}</span>
                    ))}
                    {findPlayerClueCount === 0 && (
                      <small>Optional clue ready</small>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFindPlayerClueCount((count) =>
                        Math.min(count + 1, findPlayerClues.length)
                      )
                    }
                    disabled={
                      findPlayerClueCount >= findPlayerClues.length ||
                      findPlayerStatus !== "playing"
                    }
                  >
                    Reveal clue
                  </button>
                </div>

                {findPlayerStatus === "playing" && (
                  <div className="find-player-input-row">
                    <React.Suspense
                      fallback={
                        <input
                          className="player-picker-input"
                          placeholder="Loading player search..."
                          disabled
                        />
                      }
                    >
                      <PlayerPicker
                        value={findPlayerSelected}
                        onSelect={setFindPlayerSelected}
                        onSubmit={submitFindPlayerGuess}
                        autoSubmitOnSelect
                        placeholder="Search exact player..."
                        compact
                        maxSuggestions={5}
                      />
                    </React.Suspense>
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
        className="fullscreen-bg connections-game-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.48)), url(${stadiumBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {coinRewardToastOverlay}
        {!connectionsRewardModal && xpToastOverlay}
        {connectionsRewardOverlay}
        <ScreenTransition className="connections-screen">
          <GameTopNav
            className="connections-back-button"
            label="Back"
            onClick={() => {
              playClickSound();
              setGameStarted(false);
              setModeMenuOpen(true);
              setGameMode("general");
              setConnectionsFeedback(null);
            }}
          />

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
                      <BKIcon name="lives" size={16} />
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

            <div className="connections-feedback-slot">
              <AnimatePresence mode="wait">
                {connectionsFeedback && (
                  <motion.div
                    key={`${connectionsFeedback.type}-${connectionsShake}`}
                    className={`connections-feedback ${connectionsFeedback.type}`}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      x: connectionsFeedback.type === "wrong" ? [0, -5, 5, -3, 3, 0] : 0,
                    }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    {connectionsFeedback.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
  const selectedOrder = connectionsSelected.indexOf(tile.id);
  const selectedTile = selectedOrder !== -1;

  return (
    <button
      key={tile.id}
      className={`connections-tile ${
        selectedTile ? "selected selected-strong" : ""
      }`}
      onClick={() => toggleConnectionTile(tile)}
      style={{
        position: "relative",
        borderWidth: selectedTile ? 2 : undefined,
        zIndex: selectedTile ? 5 : 1,
      }}
    >
      {selectedTile && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            width: 26,
            height: 26,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "#ffffff",
            color: "#4f46e5",
            fontWeight: 1000,
            fontSize: 14,
            boxShadow: "0 0 18px rgba(255,255,255,0.85)",
          }}
        >
          {selectedOrder + 1}
        </span>
      )}

      <span
        style={{
          position: "relative",
          zIndex: 2,
          color: selectedTile ? "#ffffff" : undefined,
          textShadow: selectedTile ? "0 2px 12px rgba(0,0,0,0.35)" : undefined,
        }}
      >
        {tile.item}
      </span>
    </button>
  );
})}
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
        className="fullscreen-bg daily-game-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03), rgba(0,0,0,0.58)), url(${quizBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {xpToastOverlay}
      <GameTopNav
        className="home-button premiumBackButton"
        label="Home"
        variant="home"
        onClick={restart}
      />

        {dailyChallengeUnavailable ? (
          <div className="daily-list-wrapper">
            <div className="daily-question-card">
              <h2 className="daily-list-label">Daily Challenge</h2>
              <h1 className="daily-list-title">Challenge unavailable</h1>
              <p className="daily-list-question">
                Today’s list challenge could not be loaded. Please go back home and try again.
              </p>
              <button className="daily-submit-button" type="button" onClick={restart}>
                Back to Home
              </button>
            </div>
          </div>
        ) : (
          <>
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

            <div className="daily-list-wrapper">
              <div className="daily-date-card">
                <span>Daily</span>
                <strong>{formatDisplayDate(getDailyDateKey())}</strong>
                <span>Challenge</span>
              </div>

          <div className="daily-question-card">
            <h2 className="daily-list-label">
              <BKIcon name="dailyChallenge" size={34} /> DAILY CHALLENGE
            </h2>

            <h1 className="daily-list-title">{todayChallenge.label}</h1>

            <p className="daily-list-question">{todayChallenge.question}</p>
            {dailyRuleHint && (
              <p className="daily-list-rule-hint">{dailyRuleHint}</p>
            )}
          </div>

          <div className="daily-list-stats">
            <span className="daily-stat-pill daily-stat-score">
              Score <strong>{foundAnswers.length}</strong>
            </span>

            <span className="daily-stat-pill">
              Completed <strong>{Math.min(foundAnswers.length, dailyTargetCount)}/{dailyTargetCount}</strong>
            </span>

            <span className="daily-stat-pill">
              Rank <strong>-</strong>
            </span>
          </div>

              <div className="pyramid-list">
                {dailyAnswers.map((answer, index) => {
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
                  <span>{isFound ? formatAnswerWithValue(answer) : <BKIcon name="questionMark" size={28} />}</span>
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
          </>
        )}
      </div>
    );
  }

  if (finished) {
    const isDaily = gameMode === "daily-list";
    const dailyCompleted =
      isDaily && foundAnswers.length >= dailyTargetCount;
    const opponentScore =
      mockOpponentScore ?? createMockOpponentScore(score);
    const multiplayerWon = score >= opponentScore;
    const isGeneralPostGame = gameMode === "general" && !isMockMultiplayer;
    const showingGeneralXp = isGeneralPostGame && postGameStep === "xp";

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.62)), url(${quizBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {!isGeneralPostGame && xpToastOverlay}
        {!isGeneralPostGame && objectiveProgressModal}
        <div className={`result-card ${isDaily ? "daily-result-card" : ""}`}>
          <Trophy size={70} />

          <h2>
            {showingGeneralXp
              ? "XP & Level Progress"
              : dailyCompleted
              ? "Daily Complete"
              : isDaily
              ? "Daily Failed"
              : "Game Over"}
          </h2>

          {isDaily ? (
            <div className="daily-result-content">
              <div className="daily-result-badge">DAILY RESULT</div>

              <div className="daily-result-score">
                {Math.min(foundAnswers.length, dailyTargetCount)}/{dailyTargetCount}
              </div>

              <div className="daily-result-subtitle">players found</div>

              <div className="daily-result-coins">
                <BKIcon name="coins" size={24} /> +{lastDailyResult?.coins || dailyCoinsEarned} coins
              </div>

              <div className="daily-result-streak">
                <BKIcon name="dailyStreak" size={24} /> Streak: {lastDailyResult?.streak || dailyStreak} days
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
                    {dailyAnswers.map((answer, index) => {
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
                  <span><BKIcon name="profile" size={22} /> You</span>
                  <strong>{score}</strong>
                </div>

                <div className="versus-divider">VS</div>

                <div>
                  <span><BKIcon name="multiplayer" size={22} /> Opponent</span>
                  <strong>{opponentScore}</strong>
                </div>
              </div>

              <p className="multiplayer-result-note">Match complete.</p>
            </div>
          ) : (
            <>
              {!showingGeneralXp ? (
                <>
                  <p><BKIcon name="dailyStreak" size={22} /> Final Score: {score}</p>
                  <p><BKIcon name="rankings" size={22} /> Best Score: {highScore}</p>
                  {score > runStartHighScore && (
                    <div className="general-run-highscore compact">
                      <strong>New Highscore!</strong>
                      <span>{score} is your new best</span>
                    </div>
                  )}
                  {gameMode === "general" && (
                    <div className="general-run-xp-total compact">
                      <span>XP earned this run</span>
                      <strong>+{generalRunXpTotal} XP</strong>
                    </div>
                  )}
                </>
              ) : (
                <motion.div
                  className="general-run-xp-summary"
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.12, duration: 0.24 }}
                >
                  <div className="level-progress-hero inline">
                    <div className="level-progress-icon">
                      <LevelIcon levelId={playerLevel.id} size={64} />
                    </div>
                    <div>
                      <div className="level-progress-label">
                        Level {playerLevel.levelNumber}
                      </div>
                      <h3>{playerLevel.name}</h3>
                      <p>{xpTotal.toLocaleString()} XP total</p>
                    </div>
                  </div>

                  <div className="level-progress-track">
                    <div
                      className="level-progress-fill"
                      style={{ width: `${progressionView.objectiveProgress}%` }}
                    />
                  </div>

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

                  {Array.isArray(objectiveProgressUpdate?.updates) && (
                    <div className="objective-progress-list inline">
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
                              {objective.after.toLocaleString()} /{" "}
                              {objective.required.toLocaleString()}
                            </span>
                          </div>
                          <div className="objective-progress-bar">
                            <div
                              className="objective-progress-fill"
                              style={{ width: `${objective.afterProgress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          {!showingGeneralXp && !isDaily && !isMockMultiplayer && reviveCost && coins >= reviveCost && (
            <button className="play-again-button" onClick={revive}>
              <BKIcon name="lives" size={22} /> Buy extra life — {reviveCost} coins
            </button>
          )}

          {!showingGeneralXp && !isDaily && !isMockMultiplayer && revivesUsed >= 3 && (
            <div className="revive-note">Max revives used</div>
          )}

          {!showingGeneralXp &&
            !isDaily &&
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

              <button
                className="play-again-button"
                onClick={() => exitToHomeSafely("mock-result-home")}
              >
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
              ) : showingGeneralXp ? (
                "COLLECT & HOME"
              ) : isGeneralPostGame ? (
                "CONTINUE"
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
      <GameTopNav
        className="home-button"
        label="Home"
        variant="home"
        onClick={() => {
          playClickSound();
          restart();
        }}
      />

      <AnimatePresence>
        {rewardPopup && (
          <motion.div
            className="reward-overlay"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -30 }}
            transition={{ duration: 0.35 }}
          >
            <div className="reward-title"><BKIcon name="dailyStreak" size={34} /> {rewardPopup.streak} STREAK</div>
            <div className="reward-coins"><BKIcon name="coins" size={28} /> +{rewardPopup.coins} COINS</div>

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

      <div className="hud-row neon-stats-grid">
        <div className="hud-card statCard">
          <span className="hud-label">SCORE</span>
          <span className="hud-value"><BKIcon name="dailyStreak" size={22} /> {score}</span>
        </div>

        <div className="hud-card statCard">
          <span className="hud-label">BEST</span>
          <span className="hud-value"><BKIcon name="rankings" size={22} /> {highScore}</span>
        </div>

        <button className="hud-card hud-button statCard" type="button" onClick={openCoinShop}>
          <span className="hud-label">COINS</span>
          <span className="hud-value"><BKIcon name="coins" size={22} /> {coins}</span>
        </button>

        <div className="hud-card statCard">
          <span className="hud-label">
            {gameMode === "general" && !isMockMultiplayer ? "COMBO" : "LIVES"}
          </span>
          <span className="hud-value">
            {gameMode === "general" && !isMockMultiplayer
              ? (
                  <>
                    <BKIcon name="dailyStreak" size={20} /> x{streak}
                  </>
                )
              : Array.from({ length: lives }).map((_, i) => (
                  <BKIcon key={i} name="lives" size={20} />
                ))}
          </span>
        </div>
      </div>

      {!isMockMultiplayer && ["general", "world-cup", "career"].includes(gameMode) && (
        <div className="quiz-progress-card progressCard">
          <div className="quiz-progress-top">
            <strong>LEVEL {playerLevel.levelNumber} XP</strong>
            <span>
              {getModeLabel(gameMode)} • Question {currentRoundQuestionNumber}
            </span>
          </div>
          <div className="quiz-progress-track">
            <div
              className="quiz-progress-fill"
              style={{ width: `${xpProgressPercent}%` }}
            />
          </div>
          <div className="quiz-progress-xp-label">
            <span>{xpProgressLabel}</span>
            <span>
              {playerLevel.next
                ? `Next: ${playerLevel.next.name}`
                : "Max level"}
            </span>
          </div>
        </div>
      )}

      {gameMode === "general" && !isMockMultiplayer && (
        <div className="combo-dock">
          <div
            className={`streak-meter ${streak > 0 ? "combo-active" : ""} ${
              [5, 10, 20].includes(streak) ? "combo-milestone" : ""
            }`}
          >
            <div className="streak-meter-top">
              <div className="streak-left">
                <span className="streak-fire"><BKIcon name="dailyStreak" size={24} /></span>
                <span className="streak-title">COMBO x{streak}</span>
              </div>

              <div className="streak-right">
                {streak >= 20 ? "MAX BONUS" : `Next: x${getNextStreakTarget(streak)}`}
              </div>
            </div>

            <div className="streak-bar-outer">
              <div
                className="streak-bar-inner"
                style={{ width: `${getStreakProgress(streak)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -25 }}
          transition={{ duration: 0.25 }}
        >
          {isTimedQuestion && (
            <div
              className={`hard-timer ${
                current.difficulty === "Very Hard" ? "very-hard" : ""
              } ${timeLeft <= 3 ? "danger" : ""}`}
            >
              {timeLeft}s
            </div>
          )}

          {gameMode === "career" ? (
            <CareerPathQuestionView question={current.question} />
          ) : (
            <h1
              className={`question-title quiz-question-card ${
                gameMode === "world-cup" ? "world-cup-question-card" : ""
              } neonGlassCard`}
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
                    <>CORRECT! {current.answer}</>
                  ) : (
                    <>Correct answer: {current.answer}</>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`answers-grid ${
                  gameMode === "world-cup" ? "world-cup-answer-grid" : ""
                } neonAnswerGrid`}
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
                      } neonAnswerButton`}
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
