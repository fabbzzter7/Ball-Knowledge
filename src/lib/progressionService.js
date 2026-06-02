import { LEVELS } from "../data/levelConfig";

const XP_EVENTS_KEY = "ballKnowledgeXpEvents";
const PROGRESSION_KEY = "ballKnowledgeProgression";
const LEVEL_REWARDS_KEY = "ballKnowledgeLevelRewards";

const DEFAULT_STATS = {
  best_general_score: 0,
  daily_challenges_completed: 0,
  best_daily_score: 0,
  whoami_solved: 0,
  connections_completed: 0,
  find_player_solved: 0,
  h2h_matches_completed: 0,
  h2h_wins: 0,
  league_days_completed: 0,
};

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getStoredProgression() {
  return safeJsonParse(localStorage.getItem(PROGRESSION_KEY), {});
}

export function getStoredXpEvents() {
  const parsed = safeJsonParse(localStorage.getItem(XP_EVENTS_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveStoredXpEvents(events) {
  localStorage.setItem(XP_EVENTS_KEY, JSON.stringify([...new Set(events)].slice(-800)));
}

export function getStoredLevelRewardIds() {
  const parsed = safeJsonParse(localStorage.getItem(LEVEL_REWARDS_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveStoredLevelRewardIds(ids) {
  localStorage.setItem(LEVEL_REWARDS_KEY, JSON.stringify([...new Set(ids)]));
}

export function getInitialProgression({ profile, highScore = 0 } = {}) {
  const local = getStoredProgression();
  const profileStats =
    profile?.progression_stats && typeof profile.progression_stats === "object"
      ? profile.progression_stats
      : {};
  const stats = {
    ...DEFAULT_STATS,
    ...local.stats,
    ...profileStats,
    best_general_score: Math.max(
      Number(highScore) || 0,
      Number(profile?.best_score) || 0,
      Number(profile?.high_score_general) || 0,
      Number(local.stats?.best_general_score) || 0,
      Number(profileStats.best_general_score) || 0
    ),
  };

  return {
    xpTotal: Math.max(
      0,
      Number(profile?.xp_total) || Number(local.xpTotal) || Number(local.xp_total) || 0
    ),
    levelId: Math.max(1, Number(profile?.level_id) || Number(local.levelId) || 1),
    claimedLevelIds: [
      ...new Set([
        ...getStoredLevelRewardIds(),
        ...(Array.isArray(profile?.level_up_claimed_ids)
          ? profile.level_up_claimed_ids
          : []),
      ]),
    ],
    stats,
  };
}

export function persistLocalProgression({ xpTotal, levelId, stats, claimedLevelIds }) {
  localStorage.setItem(
    PROGRESSION_KEY,
    JSON.stringify({ xpTotal, levelId, stats, updatedAt: new Date().toISOString() })
  );
  saveStoredLevelRewardIds(claimedLevelIds || []);
}

export function getLevelById(id) {
  return LEVELS.find((level) => level.id === id) || LEVELS[0];
}

export function getNextLevel(levelId) {
  return LEVELS.find((level) => level.id === levelId + 1) || null;
}

export function getObjectiveProgress(objective, { stats, xpTotal }) {
  const current =
    objective.statKey === "xp_total"
      ? xpTotal
      : Number(stats?.[objective.statKey]) || 0;
  const required = Math.max(0, Number(objective.required) || 0);

  return {
    ...objective,
    current,
    required,
    complete: current >= required,
    progress: required <= 0 ? 100 : Math.min(100, (current / required) * 100),
  };
}

export function getProgressionView({ xpTotal, levelId, stats }) {
  const currentLevel = getLevelById(levelId);
  const nextLevel = getNextLevel(levelId);

  // Objectives should belong to the current level.
  // If all current level objectives are complete, the user can level up to nextLevel.
  const objectiveLevel = currentLevel;

  const objectives = objectiveLevel.objectives.map((objective) =>
    getObjectiveProgress(objective, { stats, xpTotal })
  );

  const completedCount = objectives.filter((objective) => objective.complete).length;
  const allObjectivesComplete = objectives.every((objective) => objective.complete);

  return {
    currentLevel,
    nextLevel,
    objectiveLevel,
    objectives,
    canLevelUp: Boolean(nextLevel) && allObjectivesComplete,
    objectiveProgress:
      objectives.length > 0 ? Math.round((completedCount / objectives.length) * 100) : 100,
  };
}

export function createXpEvent({ key, amount, label }) {
  if (!key || !amount) return null;

  const events = getStoredXpEvents();
  if (events.includes(key)) return null;

  saveStoredXpEvents([...events, key]);
  return { key, amount, label };
}

export function addStat(stats, key, amount = 1) {
  return {
    ...DEFAULT_STATS,
    ...(stats || {}),
    [key]: (Number(stats?.[key]) || 0) + amount,
  };
}

export function maxStat(stats, key, value) {
  return {
    ...DEFAULT_STATS,
    ...(stats || {}),
    [key]: Math.max(Number(stats?.[key]) || 0, Number(value) || 0),
  };
}
