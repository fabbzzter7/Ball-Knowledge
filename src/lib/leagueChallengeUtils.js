import { DAILY_LIST_CHALLENGES } from "../DAILY_LIST_CHALLENGES";
import { getMultiplayerQuestionsByCategory, getMultiplayerQuestionsByIds } from "../multiplayerQuestionBank";

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

function getLeagueSettings(league = {}) {
  const quizCount = Number.isFinite(Number(league.quiz_count))
    ? Number(league.quiz_count)
    : 5;
  const top10Count = Number.isFinite(Number(league.top10_count))
    ? Number(league.top10_count)
    : 1;

  return {
    quizCount: Math.max(0, quizCount),
    top10Count: Math.max(0, Math.min(1, top10Count)),
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
  const categories = ["general", "premier_league", "world_cup", "career_path"];
  const questions = categories.flatMap((category) =>
    getMultiplayerQuestionsByCategory(category)
  );

  return shuffleWithSeed(questions, seedText)
    .slice(0, count)
    .map((question) => question.multiplayerId);
}

export function getLeagueSettingsSummary(league = {}) {
  const { quizCount, top10Count } = getLeagueSettings(league);
  const maxDailyPoints = Number(league.max_daily_points) || quizCount + top10Count * 10;

  return {
    durationDays:
      league.duration_days === null || league.duration_days === undefined
        ? null
        : Number(league.duration_days),
    leagueFormat: league.league_format || "balanced",
    quizCount,
    top10Count,
    maxDailyPoints,
  };
}

export function getLeagueQuestionsByIds(ids) {
  return getMultiplayerQuestionsByIds(ids);
}

export function getLeagueTop10Challenge(seedText) {
  if (!DAILY_LIST_CHALLENGES.length) return null;

  const [challenge] = shuffleWithSeed(DAILY_LIST_CHALLENGES, seedText);
  return challenge || DAILY_LIST_CHALLENGES[0];
}

export function getLeagueTop10ChallengeById(id, fallbackSeed = getTodayKey()) {
  return (
    DAILY_LIST_CHALLENGES.find((challenge) => challenge.id === id) ||
    getLeagueTop10Challenge(fallbackSeed)
  );
}
