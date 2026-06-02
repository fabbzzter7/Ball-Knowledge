import { DAILY_LIST_CHALLENGES } from "../DAILY_LIST_CHALLENGES";
import { WHO_AM_I_QUESTIONS } from "../WHO_AM_I_QUESTIONS";
import { getMultiplayerQuestionsByCategory, getMultiplayerQuestionsByIds } from "../multiplayerQuestionBank";

const LEAGUE_QUIZ_CATEGORIES = ["general", "premier_league", "world_cup", "career_path"];

function shuffleWithSeed(items, seedText) {
  const next = [...items];
  let seed = 0;

  for (const char of seedText) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  for (let index = next.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function getValidLeagueQuizQuestions() {
  return LEAGUE_QUIZ_CATEGORIES.flatMap((category) =>
    getMultiplayerQuestionsByCategory(category)
  ).filter(
    (question) =>
      question &&
      typeof question === "object" &&
      question.multiplayerId &&
      question.question &&
      Array.isArray(question.options) &&
      question.options.length === 4 &&
      question.answer
  );
}

function getValidTop10Challenges() {
  if (!Array.isArray(DAILY_LIST_CHALLENGES)) return [];

  return DAILY_LIST_CHALLENGES.filter(
    (challenge) =>
      challenge &&
      typeof challenge === "object" &&
      challenge.id &&
      Array.isArray(challenge.answers) &&
      challenge.answers.length >= 10
  );
}

function getValidWhoAmIQuestions() {
  if (!Array.isArray(WHO_AM_I_QUESTIONS)) return [];

  return WHO_AM_I_QUESTIONS.filter(
    (question) =>
      question &&
      typeof question === "object" &&
      question.id &&
      question.answer &&
      Array.isArray(question.clues) &&
      question.clues.length > 0
  );
}

function getLeagueSettings(league = {}) {
  const quizCount = Number.isFinite(Number(league.quiz_count))
    ? Number(league.quiz_count)
    : 5;
  const top10Count = Number.isFinite(Number(league.top10_count))
    ? Number(league.top10_count)
    : 1;
  const whoamiCount = Number.isFinite(Number(league.whoami_count))
    ? Number(league.whoami_count)
    : 0;
  const findPlayerCount = Number.isFinite(Number(league.find_player_count))
    ? Number(league.find_player_count)
    : 0;

  return {
    quizCount: Math.max(0, quizCount),
    top10Count: Math.max(0, Math.min(2, top10Count)),
    whoamiCount: Math.max(0, whoamiCount),
    findPlayerCount: Math.max(0, Math.min(3, findPlayerCount)),
    findPlayerScoringMode: league.find_player_scoring_mode || "attempts",
  };
}

export function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getLeagueDayNumber(startDate, dayKey = getTodayKey()) {
  const start = new Date(`${startDate || dayKey}T00:00:00`);
  const current = new Date(`${dayKey}T00:00:00`);
  const diff = Math.floor((current - start) / (1000 * 60 * 60 * 24));

  return Math.max(1, diff + 1);
}

export function buildLeagueDailyQuestionIds(seedText, count = 5) {
  if (count <= 0) return [];

  const questions = getValidLeagueQuizQuestions();
  if (questions.length < count) return [];

  return shuffleWithSeed(questions, seedText)
    .slice(0, count)
    .map((question) => question?.multiplayerId)
    .filter(Boolean);
}

export function buildLeagueWhoAmIQuestionIds(seedText, count = 0) {
  if (count <= 0) return [];

  const questions = getValidWhoAmIQuestions();
  if (questions.length < count) return [];

  return shuffleWithSeed(questions, `${seedText}:whoami`)
    .slice(0, count)
    .map((question) => question?.id)
    .filter(Boolean);
}

export function getLeagueSettingsSummary(league = {}) {
  const {
    quizCount,
    top10Count,
    whoamiCount,
    findPlayerCount,
    findPlayerScoringMode,
  } = getLeagueSettings(league);
  const calculatedMaxDailyPoints =
    quizCount + top10Count * 10 + whoamiCount * 10 + findPlayerCount * 10;
  const storedMaxDailyPoints = Number(league.max_daily_points);
  const maxDailyPoints = Number.isFinite(storedMaxDailyPoints)
    ? Math.max(storedMaxDailyPoints, calculatedMaxDailyPoints)
    : calculatedMaxDailyPoints;

  return {
    durationDays:
      league.duration_days === null || league.duration_days === undefined
        ? null
        : Number(league.duration_days),
    leagueFormat: league.league_format || "balanced",
    quizCount,
    top10Count,
    whoamiCount,
    findPlayerCount,
    findPlayerScoringMode,
    maxDailyPoints,
  };
}

export function getLeagueQuestionsByIds(ids) {
  if (!Array.isArray(ids)) return [];

  return getMultiplayerQuestionsByIds(ids).filter(Boolean);
}

export function getLeagueTop10Challenge(seedText) {
  const challenges = getValidTop10Challenges();
  if (!challenges.length) return null;

  const [challenge] = shuffleWithSeed(challenges, seedText);
  return challenge || challenges[0];
}

export function getLeagueTop10ChallengeById(id, fallbackSeed = getTodayKey()) {
  const challenges = getValidTop10Challenges();

  return (
    challenges.find((challenge) => challenge.id === id) ||
    getLeagueTop10Challenge(fallbackSeed)
  );
}

export function hasLeagueTop10ChallengeId(id) {
  if (!id) return false;

  return getValidTop10Challenges().some((challenge) => challenge.id === id);
}

export function getLeagueWhoAmIQuestionsByIds(ids = []) {
  if (!Array.isArray(ids)) return [];

  const questionsById = new Map(
    getValidWhoAmIQuestions().map((question) => [question.id, question])
  );

  return ids
    .map((id) => questionsById.get(id))
    .filter(Boolean);
}
