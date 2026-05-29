import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, CheckCircle2, XCircle, Trash2, X } from "lucide-react";
import { ANSWER_ALIASES, LAST_WORD_BLACKLIST } from "./answerAliases";

import { QUESTIONS } from "./QUESTIONS";
import { CAREER_QUESTIONS } from "./CAREER_QUESTIONS";
import { DAILY_LIST_CHALLENGES } from "./DAILY_LIST_CHALLENGES";
import { WORLD_CUP_QUESTIONS } from "./WORLD_CUP_QUESTIONS";
import { CONNECTIONS_PUZZLES } from "./CONNECTIONS_PUZZLES";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  createProfile,
  fetchProfile,
  getDefaultProfile,
  getOrCreatePlayerId,
  syncLocalStatsToProfile,
  updateProfile,
} from "./lib/profileService";
import {
  getMultiplayerQuestionsByIds,
  pickMultiplayerQuestionIds,
} from "./multiplayerQuestionBank";

import clickSound from "./assets/Click.mp3";
import coinSound from "./assets/Coins.mp3";
import wrongSound from "./assets/wrong.wav";
import stadiumBg from "./assets/stadium-bg.png";
import quizBg from "./assets/quiz-bg.png";

const HARD_TIME_LIMIT = 20;
const MULTIPLAYER_TIME_LIMIT = 8;
const MULTIPLAYER_TIMEOUT_VALUE = "__time_up__";
const DAILY_SCAN_STEP_MS = 210;
const STREAK_TARGETS = [5, 10, 20, 30, 50];
const AVATAR_EMOJI_OPTIONS = ["⚽", "🏆", "🔥", "🧠", "🐐", "⭐", "👑", "🧤", "🥶", "⚡"];
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

const STREAK_MILESTONES = [
  { day: 2, reward: 25 },
  { day: 4, reward: 50 },
  { day: 6, reward: 75 },
  { day: 8, reward: 90 },
  { day: 10, reward: 100 },
];

const PLAYER_LEVELS = [
  { min: 0, name: "Beginner", emoji: "🌱", color: "green" },
  { min: 5, name: "Bench Warmer", emoji: "🪑", color: "green" },
  { min: 10, name: "Sunday League", emoji: "⚽", color: "green" },
  { min: 20, name: "Rising Baller", emoji: "🔥", color: "yellow" },
  { min: 35, name: "Football Fan", emoji: "📣", color: "yellow" },
  { min: 50, name: "Semi Ball Knowledge", emoji: "🧠", color: "yellow" },
  { min: 70, name: "Sharp Scout", emoji: "🔎", color: "blue" },
  { min: 90, name: "Tactical Mind", emoji: "📋", color: "blue" },
  { min: 110, name: "Elite Ball Knowledge", emoji: "🏆", color: "blue" },
  { min: 140, name: "Champions League Brain", emoji: "⭐", color: "purple" },
  { min: 170, name: "World Class", emoji: "🌍", color: "purple" },
  { min: 210, name: "Football Professor", emoji: "🎓", color: "purple" },
  { min: 260, name: "GOAT Debate Expert", emoji: "🐐", color: "orange" },
  { min: 320, name: "Ball Knowledge Master", emoji: "👑", color: "orange" },
  { min: 400, name: "Ball Knowledge Legend", emoji: "💎", color: "legend" },
];

function shuffle(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
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
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const aliases = ANSWER_ALIASES[normalizedCorrect] || [];
  const accepted = [correctAnswer, ...aliases];
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
  if (streak >= 10) return 100;
  if (streak === 8) return 90;
  if (streak === 6) return 75;
  if (streak === 4) return 50;
  if (streak === 2) return 25;
  return 0;
}

function getNextMilestone(streak) {
  return STREAK_MILESTONES.find((milestone) => milestone.day > streak) || null;
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
    ];
  }

  const easy = QUESTIONS.filter((q) => q.difficulty === "Easy");
  const medium = QUESTIONS.filter((q) => q.difficulty === "Medium");
  const hard = QUESTIONS.filter((q) => q.difficulty === "Hard");

  const selectedQuestions = [
    ...shuffle(easy).slice(0, 10),
    ...shuffle(medium).slice(0, 20),
    ...shuffle(hard),
  ];

  return selectedQuestions.map((q) => ({
    ...q,
    options: shuffle(q.options),
  }));
}

function getPlayerLevel(highScore) {
  let currentIndex = 0;

  for (let i = 0; i < PLAYER_LEVELS.length; i++) {
    if (highScore >= PLAYER_LEVELS[i].min) {
      currentIndex = i;
    }
  }

  const current = PLAYER_LEVELS[currentIndex];
  const next = PLAYER_LEVELS[currentIndex + 1];

  if (!next) {
    return {
      ...current,
      levelNumber: currentIndex + 1,
      totalLevels: PLAYER_LEVELS.length,
      next: null,
      progress: 100,
      currentMin: current.min,
      nextMin: null,
      pointsToNext: 0,
    };
  }

  const range = next.min - current.min;
  const progressInsideLevel = highScore - current.min;
  const progress = Math.max(
    0,
    Math.min(100, (progressInsideLevel / range) * 100)
  );

  return {
    ...current,
    levelNumber: currentIndex + 1,
    totalLevels: PLAYER_LEVELS.length,
    next,
    progress,
    currentMin: current.min,
    nextMin: next.min,
    pointsToNext: next.min - highScore,
  };
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

function getSavedLastSeenLevel() {
  const savedLevel = Number(localStorage.getItem("ballKnowledgeLastSeenLevel"));

  if (Number.isFinite(savedLevel) && savedLevel >= 1) {
    return Math.min(savedLevel, PLAYER_LEVELS.length);
  }

  const savedHighScore =
    Number(localStorage.getItem("footballQuizHighScore")) || 0;

  return getPlayerLevel(savedHighScore).levelNumber;
}

function getModeLabel(mode) {
  if (mode === "world-cup" || mode === "world_cup") return "World Cup";
  if (mode === "premier_league") return "Premier League";
  if (mode === "career" || mode === "career_path") return "Career Path";
  return "General";
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
  const [isMockMultiplayer, setIsMockMultiplayer] = useState(false);
  const [mockOpponentScore, setMockOpponentScore] = useState(null);
  const [coinsMenuOpen, setCoinsMenuOpen] = useState(false);
  const [coinShopNotice, setCoinShopNotice] = useState("");
  const [levelModalOpen, setLevelModalOpen] = useState(false);
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
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(HARD_TIME_LIMIT);

  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem("footballQuizHighScore")) || 0;
  });

  const [coins, setCoins] = useState(() => {
    return Number(localStorage.getItem("footballQuizCoins")) || 0;
  });

  const [revivesUsed, setRevivesUsed] = useState(0);
  const [rewardPopup, setRewardPopup] = useState(null);
  const [wrongPopup, setWrongPopup] = useState(null);

  const [foundAnswers, setFoundAnswers] = useState([]);
  const [dailyInput, setDailyInput] = useState("");
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

  const [lastSeenLevel, setLastSeenLevel] = useState(getSavedLastSeenLevel);
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

  const current = questions[questionIndex];
  const playerLevel = getPlayerLevel(highScore);
  const displayName = profile?.display_name || profile?.username || username;
  const profileAvatarEmoji = profile?.avatar_emoji || avatarEmoji || "⚽";
  const profileStats = {
    multiplayerWins: profile?.multiplayer_wins || 0,
    multiplayerLosses: profile?.multiplayer_losses || 0,
    multiplayerDraws: profile?.multiplayer_draws || 0,
    multiplayerMatches: profile?.multiplayer_matches || 0,
  };
  const upcomingLevels = PLAYER_LEVELS.slice(
    playerLevel.levelNumber,
    playerLevel.levelNumber + 3
  );
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
    () => getMultiplayerQuestionsByIds(activeRoundQuestionIds),
    [activeRoundQuestionIds]
  );
  const currentMultiplayerRoundQuestion =
    activeRoundQuestions[multiplayerRoundIndex];
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
    if (!multiplayerOpen || multiplayerStep !== "active-games") return;

    const interval = window.setInterval(() => {
      fetchActiveGames({ silent: true });
    }, 7000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, playerId, username]);

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
    if (!isHomeScreen || !username) return;

    const newLevel = getPlayerLevel(highScore);
    const safeLastSeenLevel = Math.max(
      1,
      Math.min(lastSeenLevel, PLAYER_LEVELS.length)
    );

    if (newLevel.levelNumber <= safeLastSeenLevel) return;

    const oldLevel = PLAYER_LEVELS[safeLastSeenLevel - 1] || PLAYER_LEVELS[0];
    const unlockedLevels = PLAYER_LEVELS.slice(
      safeLastSeenLevel,
      newLevel.levelNumber
    );

    const popup = {
      oldLevel,
      newLevel,
      unlockedLevels,
      levelsGained: newLevel.levelNumber - safeLastSeenLevel,
    };

    const popupTimer = window.setTimeout(() => {
      setLevelUpPopup(popup);
      setLastSeenLevel(newLevel.levelNumber);
      localStorage.setItem(
        "ballKnowledgeLastSeenLevel",
        String(newLevel.levelNumber)
      );
    }, 0);

    return () => window.clearTimeout(popupTimer);
  }, [isHomeScreen, username, highScore, lastSeenLevel]);

  useEffect(() => {
    if (
      gameMode === "connections" &&
      gameStarted &&
      connectionsGameComplete &&
      !connectionsRewardClaimed
    ) {
      rewardConnectionsCompletion();
      setConnectionsFeedback({ type: "complete", text: "+50 coins earned" });
    }
  }, [
    gameMode,
    gameStarted,
    connectionsGameComplete,
    connectionsRewardClaimed,
  ]);

  const revivePrices = [250, 400, 800, 1600, 5000];
  const reviveCost = revivePrices[revivesUsed] || 5000;

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
      handleWrongAnswer(current.answer);
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

  const playCoinSound = () => {
    const audio = new Audio(coinSound);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const playWrongSound = () => {
    const audio = new Audio(wrongSound);
    audio.volume = 1;
    audio.currentTime = 0;
    audio.play().catch((err) => console.log("Wrong sound error:", err));
  };

  const playClickSound = () => {
    const audio = new Audio(clickSound);
    audio.volume = 0.22;

    audio.addEventListener("loadedmetadata", () => {
      audio.currentTime = 0.43;
      audio.play().catch(() => {});
    });
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
      setAvatarEmoji(existingProfile.avatar_emoji || "⚽");
      localStorage.setItem(
        "ballKnowledgeAvatarEmoji",
        existingProfile.avatar_emoji || "⚽"
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
    setAvatarEmoji(createdProfile.avatar_emoji || "⚽");
    localStorage.setItem(
      "ballKnowledgeAvatarEmoji",
      createdProfile.avatar_emoji || "⚽"
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

    setProfile(updatedProfile);
    setProfileStatus(successStatus);
    setProfileError("");
    return updatedProfile;
  };

  const chooseAvatarEmoji = (emoji) => {
    playClickSound();
    setAvatarEmoji(emoji);
    localStorage.setItem("ballKnowledgeAvatarEmoji", emoji);
    setAvatarPickerOpen(false);

    updateOnlineProfile({ avatar_emoji: emoji });
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
      .select("id, username, display_name, best_score, avatar_emoji")
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
    setProfile(updatedProfile);
    setProfileStatus("ready");
  };

  const saveCoins = (newCoins) => {
    setCoins(newCoins);
    localStorage.setItem("footballQuizCoins", String(newCoins));
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
            avatar_emoji: avatarEmoji,
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

        setProfile(updatedProfile);
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
      playCoinSound();
    }

    return {
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
      playCoinSound();
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

    const newCoins = coins + 50;
    saveCoins(newCoins);
    playCoinSound();
    setConnectionsRewardClaimed(true);
  };

  const startGame = (mode, options = {}) => {
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
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
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
    if (!category.available || !activeMatch?.id || !supabase) return;

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
      playCoinSound();
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
    setDailyCoinsEarned(0);
    setDailyReveal(null);
    setDailyCelebratedAnswer(null);
    setIsRevealing(false);
    setQuestionIndex(0);
    setSelected(null);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
    setRevivesUsed(0);
    setRewardPopup(null);
    setWrongPopup(null);
    setStreakRewardEarned(0);
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
  };

  const nextQuestion = () => {
    setQuestionIndex((i) => (i + 1) % questions.length);
    setSelected(null);
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

    setWrongPopup({
      answer: correctAnswer,
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
      }

      if (reward > 0) {
        const newCoins = coins + reward;
        saveCoins(newCoins);

        setRewardPopup({
          streak: newStreak,
          coins: reward,
          onCollect: "next-question",
        });

        playCoinSound();
      } else {
        playCoinSound();
        setTimeout(nextQuestion, 950);
      }
    } else {
      handleWrongAnswer(current.answer);
    }
  };

  const finishDaily = (found, earned) => {
    const streakInfo = awardDailyStreakBonus();
    const totalEarned = earned + streakInfo.reward;

    markDailyAsPlayed(found, totalEarned, streakInfo);

    setTimeout(() => {
      setFinished(true);
    }, 700);
  };

  const checkDailyAnswer = () => {
    if (!dailyInput.trim() || rewardPopup || wrongPopup || isRevealing) return;

    setDailyCelebratedAnswer(null);

    const matchedAnswer = todayChallenge.answers.find((answer) =>
      isCorrectAnswer(dailyInput, answer)
    );

    if (matchedAnswer && !foundAnswers.includes(matchedAnswer)) {
      const rank = todayChallenge.answers.indexOf(matchedAnswer) + 1;
      const rewardPerCorrect = 15;

      setDailyInput("");
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
            playCoinSound();

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

    if (action === "next-question") {
      nextQuestion();
    }

    if (action === "finish") {
      setFinished(true);
    }
  };

  const revive = () => {
    const newCoins = coins - reviveCost;
    saveCoins(newCoins);

    setLives(1);
    setRevivesUsed((r) => r + 1);
    setFinished(false);
    setSelected(null);
  };

  const watchAdMock = () => {
    const newCoins = coins + 50;
    saveCoins(newCoins);
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

  const claimVideoRewardMock = () => {
    saveCoins(coins + 100);
    playCoinSound();
    setCoinShopNotice("+100 coins added");
  };

  const showMockPurchaseNotice = () => {
    playClickSound();
    setCoinShopNotice("Coming soon");
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
                  <strong>Watch video ad</strong>
                  <small>Ad reward mockup</small>
                </div>
                <button onClick={claimVideoRewardMock}>Watch video</button>
                <em>+100 coins</em>
              </div>

              {[
                ["Small coin pack", "500 coins", "$0.99"],
                ["Big coin pack", "2,500 coins", "$3.99"],
                ["Mega coin pack", "10,000 coins", "$9.99"],
              ].map(([title, amount, price]) => (
                <div className="coin-shop-option" key={title}>
                  <div>
                    <strong>{title}</strong>
                    <small>{amount}</small>
                  </div>
                  <button onClick={showMockPurchaseNotice}>{price}</button>
                  <em>Mock pack</em>
                </div>
              ))}
            </div>

            <p className="coin-shop-note">
              Purchases are mockups for now
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
              {STREAK_MILESTONES.map((milestone) => {
                const reached = dailyStreak >= milestone.day;
                const nextMilestone = getNextMilestone(dailyStreak);
                const currentMilestone = nextMilestone?.day === milestone.day;

                return (
                  <div
                    key={milestone.day}
                    className={`daily-reward-day ${reached ? "reached" : ""} ${
                      currentMilestone ? "current" : ""
                    }`}
                  >
                    <div className="daily-reward-ball">
                      {reached ? "✅" : "⚽"}
                    </div>

                    <div className="daily-reward-day-label">
                      Day {milestone.day}
                    </div>

                    <div className="daily-reward-day-coins">
                      +{milestone.reward}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="daily-reward-next">
              {getNextMilestone(dailyStreak)
                ? `Next reward: Day ${getNextMilestone(dailyStreak).day} • +${
                    getNextMilestone(dailyStreak).reward
                  } coins`
                : "Max reward reached • +100 coins every day"}
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
                  Level {playerLevel.levelNumber}/{playerLevel.totalLevels}
                </div>
                <h2>{playerLevel.name}</h2>
                <p>Best score: {highScore}</p>
              </div>
            </div>

            <div className="level-progress-track">
              <div
                className="level-progress-fill"
                style={{ width: `${playerLevel.progress}%` }}
              />
            </div>

            <div className="level-progress-next">
              {playerLevel.next ? (
                <>
                  <strong>{playerLevel.pointsToNext} points to next level</strong>
                  <span>
                    Next: {playerLevel.next.emoji} {playerLevel.next.name}
                  </span>
                </>
              ) : (
                <>
                  <strong>Max level reached</strong>
                  <span>You are at the top of Ball Knowledge.</span>
                </>
              )}
            </div>

            {upcomingLevels.length > 0 && (
              <div className="level-progress-road">
                {upcomingLevels.map((level, index) => (
                  <div className="level-road-step" key={level.name}>
                    <div className="level-road-lock">🔒</div>
                    <div>
                      <strong>
                        {level.emoji} {level.name}
                      </strong>
                      <span>
                        Level {playerLevel.levelNumber + index + 1} • {level.min} points
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                <strong>Choose avatar</strong>
                <span>Your local player identity</span>
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

            <div className="avatar-picker-grid">
              {AVATAR_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className={emoji === profileAvatarEmoji ? "selected" : ""}
                  onClick={() => chooseAvatarEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
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

      setProfile(updatedProfile);
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
        className="fullscreen-bg"
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
                className="daily-reward-main-ball"
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 9 }}
              >
                ⚽
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
                {STREAK_MILESTONES.map((milestone) => {
                  const reached = lastDailyResult.streak >= milestone.day;
                  const currentMilestone = lastDailyResult.streak === milestone.day;

                  return (
                    <div
                      key={milestone.day}
                      className={`daily-reward-day ${
                        reached ? "reached" : ""
                      } ${currentMilestone ? "current" : ""}`}
                    >
                      <div className="daily-reward-ball">
                        {reached ? "✅" : "⚽"}
                      </div>

                      <div className="daily-reward-day-label">
                        Day {milestone.day}
                      </div>

                      <div className="daily-reward-day-coins">
                        +{milestone.reward}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="daily-reward-next">
                {getNextMilestone(lastDailyResult.streak)
                  ? `Next reward: Day ${
                      getNextMilestone(lastDailyResult.streak).day
                    } • +${
                      getNextMilestone(lastDailyResult.streak).reward
                    } coins`
                  : "Max reward reached • +100 coins every day"}
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
            <React.Fragment key={`${level.name}-${level.min}`}>
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
            <motion.div
              className={`profile-card level-${playerLevel.color}`}
              initial={{ opacity: 0, scale: 0.9, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 14 }}
            >
              <div className="profile-hero-row">
                <button
                  className="profile-avatar profile-avatar-button"
                  onClick={() => {
                    playClickSound();
                    setAvatarPickerOpen(true);
                  }}
                  aria-label="Change avatar"
                >
                  {profileAvatarEmoji}
                </button>

                <div className="profile-name-wrap">
                  <div className="profile-title">Your Profile</div>
                  <div className="profile-name-pill">👤 {displayName}</div>
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
                    ? `${playerLevel.pointsToNext} more best-score points to unlock ${playerLevel.next.name}`
                    : "Max level reached"}
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

              <div className="profile-actions">
                <button
                  className="profile-change-name-button"
                  onClick={changeUsername}
                >
                  CHANGE NAME
                </button>

                <button
                  className="profile-back-button"
                  onClick={() => {
                    playClickSound();
                    setProfileOpen(false);
                  }}
                >
                  BACK
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
              <p className="multiplayer-subtitle">
                Your async football battles
              </p>

              {multiplayerStep === "menu" && (
                <div className="multiplayer-mode-pills">
                {MULTIPLAYER_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    className={multiplayerMode === category.mode ? "active" : ""}
                    onClick={() => {
                      playClickSound();
                      setMultiplayerMode(category.mode);
                    }}
                  >
                    {category.label}
                  </button>
                ))}
                </div>
              )}

              {multiplayerError && (
                <div className="multiplayer-error">{multiplayerError}</div>
              )}

              {multiplayerNotice && (
                <div className="multiplayer-notice">{multiplayerNotice}</div>
              )}

              {multiplayerStep === "menu" && (
                <div className="multiplayer-actions">
                  <button
                    className="multiplayer-action-card active-games"
                    onClick={openActiveGames}
                    disabled={activeGamesLoading}
                  >
                    <span>🎮</span>
                    <strong>
                      {activeGamesLoading ? "Loading matches..." : "Active Matches"}
                    </strong>
                    <small>Your turn, results, and waiting rooms</small>
                  </button>

                  <button
                    className="multiplayer-action-card create"
                    onClick={createMultiplayerMatch}
                    disabled={multiplayerLoading}
                  >
                    <span>🏟️</span>
                    <strong>
                      {multiplayerLoading ? "Creating match..." : "Create New Match"}
                    </strong>
                    <small>Start a private room</small>
                  </button>

                  <button
                    className="multiplayer-action-card join"
                    onClick={() => {
                      playClickSound();
                      setMultiplayerStep("join");
                    }}
                  >
                    <span>👤</span>
                    <strong>Join Match</strong>
                    <small>Enter a room code</small>
                  </button>
                </div>
              )}

              {multiplayerStep === "active-games" && (
                <div className="active-games-panel">
                  <div className="active-games-header">
                    <div>
                      <strong>Active Matches</strong>
                      <span>Your Quizkampen-style inbox</span>
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

                        return (
                          <div
                            className={`active-game-card ${getCategoryClass(category)}`}
                            key={match.id}
                          >
                            <div className="active-game-top">
                              <strong>{getOpponentName(match, playerId, username)}</strong>
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

              {multiplayerStep === "created" && (
                <div className="multiplayer-room-card">
                  <div className="room-status">Match created</div>
                  <div className="room-code">Room code: {multiplayerRoomCode}</div>
                  <div className="multiplayer-player-list">
                    <span>👤 {activeMatch?.player1_username || username}</span>
                    {activeMatch?.player2_username && (
                      <span>⚔️ {activeMatch.player2_username}</span>
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
                      <span>👤 {activeMatch.player1_username}</span>
                      <span>⚔️ {activeMatch.player2_username}</span>
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

              <div className="multiplayer-todo-note">
                Live updates are on. Manual Refresh stays as backup.
              </div>

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

            <div className="main-username-pill">
              {profileAvatarEmoji} {displayName}
            </div>

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
                  ? `${playerLevel.pointsToNext} more best-score points to unlock ${playerLevel.next.name}`
                  : "Max level reached • true ball knowledge legend"}
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
              SINGLE PLAYER
            </button>

            <button
              className="multiplayer-main-button"
              onClick={openMultiplayer}
            >
              ⚔️ MULTIPLAYER
            </button>

            <button
              className={`daily-main-button ${dailyPlayed ? "daily-completed" : ""}`}
              onClick={() => {
                playClickSound();
                startDailyChallenge();
              }}
              disabled={dailyPlayed}
            >
              {dailyPlayed ? "✅ DAILY COMPLETED" : "🔥 DAILY CHALLENGE"}
            </button>

            <div className="home-secondary-actions">
              <button
                className="profile-main-button"
                onClick={() => {
                  playClickSound();
                  setProfileOpen(true);
                }}
              >
                👤 PROFILE
              </button>

              <button
                className="leaderboard-main-button"
                onClick={() => {
                  playClickSound();
                  setLeaderboardOpen(true);
                }}
              >
                🏆 RANKINGS
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
                <p>{connectionsPuzzle.title || "Find the 4 football groups"}</p>
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
                <span>+50 coins</span>
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
                  {dailyReveal.answer}
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
              <div className="wrong-title">❌ WRONG</div>
              <div className="wrong-answer">{wrongPopup.answer}</div>
              <div className="wrong-life">-1 LIFE ❤️</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="daily-list-wrapper">
          <h2 className="daily-list-label">🔥 DAILY CHALLENGE</h2>

          <h1 className="daily-list-title">{todayChallenge.label}</h1>

          <p className="daily-list-question">{todayChallenge.question}</p>

          <div className="daily-list-stats">
            <span>
              {foundAnswers.length} / {todayChallenge.answers.length} FOUND
            </span>

            <span>
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
                  key={answer}
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
                  <span>{isFound ? answer : "?????"}</span>
                </motion.div>
              );
            })}
          </div>

          <div className="daily-input-row">
            <input
              value={dailyInput}
              onChange={(e) => setDailyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkDailyAnswer();
              }}
              placeholder="Type player name..."
              className="daily-list-input"
              autoFocus
            />

            <button className="daily-submit-button" onClick={checkDailyAnswer}>
              GUESS
            </button>
          </div>
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
                          key={answer}
                          className={`daily-missing-row ${
                            found ? "found" : "missed"
                          }`}
                        >
                          <span>#{index + 1}</span>
                          <strong>{answer}</strong>
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

              <p className="multiplayer-result-note">
                Mock opponent score. Realtime match results come later.
              </p>
            </div>
          ) : (
            <>
              <p>🔥 Final Score: {score}</p>
              <p>🏆 Best Score: {highScore}</p>
            </>
          )}

          {!isDaily && !isMockMultiplayer && coins >= reviveCost && (
            <button className="play-again-button" onClick={revive}>
              ❤️ Revive for {reviveCost} coins
            </button>
          )}

          {!isDaily && !isMockMultiplayer && (
            <button className="play-again-button" onClick={watchAdMock}>
              ▶ Watch ad +50 coins
            </button>
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
                Back Home
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
                  <RotateCcw size={24} /> Play again
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
            <div className="wrong-title">❌ WRONG</div>
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
          <div className="difficulty-pill">
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
              } ${timeLeft <= 5 ? "danger" : ""}`}
            >
              ⏱ {timeLeft}s
            </div>
          )}

          <h1 className="question-title">{current.question}</h1>

          {gameMode === "career" || gameMode === "world-cup" ? (
            <>
              <div className="career-answer-box">
                <input
                  type="text"
                  placeholder={
                    gameMode === "world-cup"
                      ? "Type your answer..."
                      : "Type player name..."
                  }
                  className="career-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      chooseAnswer(e.target.value);
                      e.target.value = "";
                    }
                  }}
                />
              </div>

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
            <div className="answers-grid">
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
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
