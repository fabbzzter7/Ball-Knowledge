import { normalizePlayerAnswer } from "./playerAnswer";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [value];
}

function normalizedSet(values) {
  return new Set(asArray(values).map(normalizePlayerAnswer).filter(Boolean));
}

function intersectionSize(a, b) {
  let count = 0;
  a.forEach((value) => {
    if (b.has(value)) count += 1;
  });
  return count;
}

export function normalizePlayerForDistance(player = {}) {
  return {
    ...player,
    normalizedName: normalizePlayerAnswer(player.name),
    nationalityKey: normalizePlayerAnswer(player.nationality),
    nationalTeamKey: normalizePlayerAnswer(player.national_team || player.nationality),
    positionGroupKey: normalizePlayerAnswer(player.position_group || player.position || "Unknown"),
    clubsSet: normalizedSet([...(asArray(player.main_clubs)), ...(asArray(player.clubs))]),
    birthYear: Number(player.birth_year) || null,
    activeFrom: Number(player.active_from) || null,
    activeTo: Number(player.active_to) || null,
    popularityScore: Number(player.popularity_score) || 0,
  };
}

export function calculatePlayerDistance(guess, target) {
  const guessPlayer = normalizePlayerForDistance(guess);
  const targetPlayer = normalizePlayerForDistance(target);

  if (guessPlayer.id && targetPlayer.id && guessPlayer.id === targetPlayer.id) return 0;
  if (guessPlayer.normalizedName && guessPlayer.normalizedName === targetPlayer.normalizedName) {
    return 0;
  }

  let distance = 3200;

  if (guessPlayer.nationalityKey && guessPlayer.nationalityKey === targetPlayer.nationalityKey) {
    distance -= 620;
  } else {
    distance += 240;
  }

  if (
    guessPlayer.nationalTeamKey &&
    guessPlayer.nationalTeamKey === targetPlayer.nationalTeamKey
  ) {
    distance -= 520;
  }

  if (
    guessPlayer.positionGroupKey &&
    guessPlayer.positionGroupKey === targetPlayer.positionGroupKey
  ) {
    distance -= 560;
  } else {
    distance += 280;
  }

  if (guessPlayer.birthYear && targetPlayer.birthYear) {
    const diff = Math.abs(guessPlayer.birthYear - targetPlayer.birthYear);
    distance += diff * 95;
    if (diff <= 2) distance -= 360;
    else if (diff <= 5) distance -= 180;
  }

  if (
    guessPlayer.activeFrom &&
    guessPlayer.activeTo &&
    targetPlayer.activeFrom &&
    targetPlayer.activeTo
  ) {
    const overlap =
      Math.min(guessPlayer.activeTo, targetPlayer.activeTo) -
      Math.max(guessPlayer.activeFrom, targetPlayer.activeFrom);
    if (overlap > 0) distance -= Math.min(520, overlap * 55);
    else distance += Math.min(760, Math.abs(overlap) * 60);
  }

  const sharedClubs = intersectionSize(guessPlayer.clubsSet, targetPlayer.clubsSet);
  if (sharedClubs > 0) {
    distance -= 850 + (sharedClubs - 1) * 340;
  }

  const popularityGap = Math.abs(guessPlayer.popularityScore - targetPlayer.popularityScore);
  distance += Math.min(260, Math.round(popularityGap / 18));

  return Math.max(0, Math.round(distance));
}

export function getDistanceLabel(distance) {
  if (distance === 0) return "Perfect";
  if (distance <= 650) return "Very close";
  if (distance <= 1200) return "Close";
  if (distance <= 2100) return "Getting closer";
  if (distance <= 3300) return "Far away";
  return "Ice cold";
}

export function getDistanceColor(distance) {
  if (distance === 0) return "perfect";
  if (distance <= 650) return "very-close";
  if (distance <= 1200) return "close";
  if (distance <= 2100) return "warm";
  if (distance <= 3300) return "far";
  return "cold";
}

export function getRankLabel(rank, poolSize = 0) {
  if (rank === 1) return "Perfect";
  if (rank <= 10) return "Very close";
  if (rank <= 100) return "Close";
  if (rank <= 500) return "Warm";

  const farCutoff = poolSize ? poolSize * 0.55 : 1700;
  return rank <= farCutoff ? "Far" : "Ice cold";
}

export function getRankColor(rank, poolSize = 0) {
  const label = getRankLabel(rank, poolSize);
  if (label === "Perfect") return "perfect";
  if (label === "Very close") return "very-close";
  if (label === "Close") return "close";
  if (label === "Warm") return "warm";
  if (label === "Far") return "far";
  return "cold";
}

export function getRankBarPercent(rank, poolSize = 0) {
  if (rank <= 1) return 100;
  if (!poolSize || poolSize <= 1) return 50;

  const percent = 100 - ((rank - 1) / (poolSize - 1)) * 88;
  return Math.max(12, Math.round(percent));
}

export function getDistanceBarPercent(distance) {
  if (distance === 0) return 100;

  const maxDistance = 5200;
  const percent = 100 - (Math.min(distance, maxDistance) / maxDistance) * 88;
  return Math.max(12, Math.round(percent));
}

export function buildPlayerDistanceRanking(target, candidatePool = []) {
  if (!target || !candidatePool.length) {
    return { byId: new Map(), poolSize: 0 };
  }

  const uniquePlayers = new Map();
  candidatePool.filter(Boolean).forEach((player) => {
    if (player.id) uniquePlayers.set(player.id, player);
  });
  if (target.id) uniquePlayers.set(target.id, target);

  const rankedPlayers = [...uniquePlayers.values()]
    .map((player) => ({
      player,
      distance: calculatePlayerDistance(player, target),
    }))
    .sort(
      (a, b) => {
        if (a.player.id === target.id) return -1;
        if (b.player.id === target.id) return 1;
        return (
          a.distance - b.distance ||
          String(a.player.id).localeCompare(String(b.player.id))
        );
      }
    );

  const byId = new Map();
  rankedPlayers.forEach((entry, index) => {
    const rank = index + 1;
    byId.set(entry.player.id, {
      distance: entry.distance,
      rank,
      poolSize: rankedPlayers.length,
      label: getRankLabel(rank, rankedPlayers.length),
      color: getRankColor(rank, rankedPlayers.length),
      barPercent: getRankBarPercent(rank, rankedPlayers.length),
    });
  });

  return { byId, poolSize: rankedPlayers.length };
}

export function rankGuessAgainstTarget(guess, target, candidatePool = []) {
  const guessDistance = calculatePlayerDistance(guess, target);
  const ranking = buildPlayerDistanceRanking(target, candidatePool);
  const rankedGuess = guess?.id ? ranking.byId.get(guess.id) : null;

  if (rankedGuess) {
    return rankedGuess;
  }

  if (!candidatePool.length) {
    return {
      distance: guessDistance,
      rank: guessDistance === 0 ? 1 : null,
      label: getDistanceLabel(guessDistance),
      color: getDistanceColor(guessDistance),
    };
  }

  const sortedDistances = candidatePool
    .map((player) => calculatePlayerDistance(player, target))
    .sort((a, b) => a - b);
  const rank = sortedDistances.findIndex((distance) => distance >= guessDistance) + 1;

  return {
    distance: guessDistance,
    rank: guessDistance === 0 ? 1 : Math.max(1, rank),
    label: getDistanceLabel(guessDistance),
    color: getDistanceColor(guessDistance),
  };
}

export function hashDateSeed(seedText = "") {
  let hash = 2166136261;
  for (const char of seedText) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickDailyFindPlayerTargets(pool = [], seedText = "", count = 1) {
  if (!pool.length || count <= 0) return [];

  const picked = [];
  let seed = hashDateSeed(seedText);
  const available = [...pool].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  while (picked.length < count && available.length) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const index = seed % available.length;
    picked.push(available.splice(index, 1)[0]);
  }

  return picked;
}

export function getFindPlayerPoints(attempts, solved) {
  if (!solved) return 0;
  const table = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  return table[Math.max(0, Math.min(table.length - 1, attempts - 1))] || 1;
}
