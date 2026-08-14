import { addDaysToDateKey } from "./dailyDateUtils";
import { normalizePlayerAnswer } from "./playerAnswer";

const HISTORY_DAYS = 21;

const COUNTRY_ALIASES = {
  england: ["england", "english", "premier league"],
  spain: ["spain", "spanish", "la liga"],
  italy: ["italy", "italian", "serie a"],
  germany: ["germany", "german", "bundesliga"],
  france: ["france", "french", "ligue 1"],
  brazil: ["brazil", "brazilian"],
  argentina: ["argentina", "argentine"],
  portugal: ["portugal", "portuguese"],
  netherlands: ["netherlands", "dutch", "holland"],
  belgium: ["belgium", "belgian"],
  uruguay: ["uruguay", "uruguayan"],
  mexico: ["mexico", "mexican"],
  usa: ["united states", "usa", "american", "mls"],
  sweden: ["sweden", "swedish"],
  denmark: ["denmark", "danish"],
  norway: ["norway", "norwegian"],
  croatia: ["croatia", "croatian"],
  serbia: ["serbia", "serbian"],
  ghana: ["ghana", "ghanaian"],
  ivory_coast: ["ivory coast", "cote d ivoire", "ivorian"],
  turkey: ["turkey", "turkish"],
};

const CLUB_ALIASES = {
  real_madrid: ["real madrid"],
  barcelona: ["barcelona", "fc barcelona"],
  man_united: ["man united", "manchester united", "man utd"],
  man_city: ["man city", "manchester city"],
  liverpool: ["liverpool"],
  arsenal: ["arsenal"],
  chelsea: ["chelsea"],
  tottenham: ["tottenham", "spurs", "tottenham hotspur"],
  juventus: ["juventus"],
  ac_milan: ["ac milan", "milan"],
  inter: ["inter", "inter milan", "internazionale"],
  roma: ["roma"],
  napoli: ["napoli"],
  psg: ["psg", "paris saint germain", "paris saint-germain"],
  bayern: ["bayern", "bayern munich"],
  dortmund: ["dortmund", "borussia dortmund"],
  ajax: ["ajax"],
  porto: ["porto"],
  benfica: ["benfica"],
  atletico: ["atletico madrid", "atlético madrid"],
};

function hashSeed(seedText = "") {
  let hash = 2166136261;
  for (const char of String(seedText)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seedText = "") {
  let seed = hashSeed(seedText);
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function normalizedText(value) {
  return normalizePlayerAnswer(String(value || ""));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function findAliases(text, aliasMap) {
  const haystack = normalizedText(text);
  return Object.entries(aliasMap)
    .filter(([, aliases]) => aliases.some((alias) => haystack.includes(normalizedText(alias))))
    .map(([key]) => key);
}

function getYears(text) {
  return [...String(text || "").matchAll(/\b(19[5-9]\d|20[0-3]\d)\b/g)]
    .map((match) => Number(match[1]))
    .filter(Boolean);
}

function getEraFromYears(years = []) {
  if (!years.length) return "";
  const average = years.reduce((sum, year) => sum + year, 0) / years.length;
  if (average < 1985) return "classic";
  if (average < 2000) return "nineties";
  if (average < 2012) return "two_thousands";
  if (average < 2020) return "twenty_tens";
  return "modern";
}

function getGenerationFromQuestionText(text) {
  const era = getEraFromYears(getYears(text));
  if (era) return era;
  const normalized = normalizedText(text);
  if (normalized.includes("legend") || normalized.includes("classic")) return "classic";
  if (normalized.includes("since 2000")) return "two_thousands";
  if (normalized.includes("modern") || normalized.includes("active")) return "modern";
  return "";
}

function overlapCount(a = [], b = []) {
  const bSet = new Set(b);
  return a.reduce((count, value) => count + (bSet.has(value) ? 1 : 0), 0);
}

function profileFromChallenge(challenge = {}) {
  const answers = Array.isArray(challenge.answers) ? challenge.answers : [];
  const answerText = answers
    .map((answer) =>
      typeof answer === "string"
        ? answer
        : `${answer.answer || ""} ${answer.value || ""} ${(answer.aliases || []).join(" ")}`
    )
    .join(" ");
  const text = `${challenge.id || ""} ${challenge.label || ""} ${challenge.question || ""} ${challenge.answerType || ""} ${answerText}`;

  return {
    id: challenge.id,
    countries: unique(findAliases(text, COUNTRY_ALIASES)),
    clubs: unique(findAliases(text, CLUB_ALIASES)),
    leagues: unique(findAliases(text, COUNTRY_ALIASES)),
    eras: unique([getGenerationFromQuestionText(text)]),
    positionGroups: [],
    type: challenge.answerType || "",
  };
}

function profileFromWhoAmI(question = {}) {
  const cluesText = Array.isArray(question.clues) ? question.clues.join(" ") : "";
  const text = `${question.id || ""} ${question.answer || ""} ${(question.acceptedAnswers || []).join(" ")} ${question.difficulty || ""} ${cluesText}`;
  const era = getGenerationFromQuestionText(text);
  const archetype = normalizedText(text).includes("am/was")
    ? "retired_or_legend"
    : normalizedText(text).includes("i am ")
    ? "active_or_modern"
    : "";

  return {
    id: question.id,
    countries: unique(findAliases(text, COUNTRY_ALIASES)),
    clubs: unique(findAliases(text, CLUB_ALIASES)),
    leagues: unique(findAliases(text, COUNTRY_ALIASES)),
    eras: unique([era, archetype]),
    positionGroups: unique([
      normalizedText(text).includes("goalkeeper") ? "gk" : "",
      normalizedText(text).includes("defender") || normalizedText(text).includes("back") ? "def" : "",
      normalizedText(text).includes("midfielder") ? "mid" : "",
      normalizedText(text).includes("striker") || normalizedText(text).includes("attacker") || normalizedText(text).includes("forward") ? "fw" : "",
    ]),
    type: question.difficulty || "",
  };
}

function scoreCandidate(profile, recentProfiles, seedText, index, options = {}) {
  const exactRecentWindow = options.exactRecentWindow ?? 14;
  let score = 100 + seededUnit(`${seedText}:${profile.id}:${index}`) * 28;

  recentProfiles.forEach((recent, recentIndex) => {
    const recency = Math.max(0.2, 1 - recentIndex / Math.max(1, recentProfiles.length));
    if (profile.id && profile.id === recent.id) {
      score -= (recentIndex < exactRecentWindow ? 1000 : 260) * recency;
    }

    score -= overlapCount(profile.countries, recent.countries) * (recentIndex === 0 ? 54 : 22) * recency;
    score -= overlapCount(profile.clubs, recent.clubs) * (recentIndex === 0 ? 48 : 18) * recency;
    score -= overlapCount(profile.leagues, recent.leagues) * 12 * recency;
    score -= overlapCount(profile.eras, recent.eras) * 18 * recency;
    score -= overlapCount(profile.positionGroups, recent.positionGroups) * (options.positionPenalty || 0) * recency;

    if (profile.type && profile.type === recent.type) {
      score -= (options.typePenalty || 6) * recency;
    }
  });

  return score;
}

function selectDiverseItem(items, dateKey, namespace, getProfile, options = {}) {
  const candidates = items
    .map((item) => ({ item, profile: getProfile(item) }))
    .filter(({ profile }) => profile?.id);

  if (!candidates.length) return null;

  const recentProfiles = [];
  const anchorDate = options.anchorDate || "2026-01-01";
  const daysSinceAnchor = Math.max(
    0,
    Math.floor((new Date(`${dateKey}T00:00:00`) - new Date(`${anchorDate}T00:00:00`)) / 86400000)
  );
  const startOffset = Math.max(0, daysSinceAnchor - (options.historyDays || HISTORY_DAYS));

  for (let offset = startOffset; offset < daysSinceAnchor; offset += 1) {
    const historyDate = addDaysToDateKey(anchorDate, offset);
    const picked = pickSingleWithoutHistory(candidates, historyDate, namespace, recentProfiles, options);
    if (picked?.profile) recentProfiles.unshift(picked.profile);
  }

  return pickSingleWithoutHistory(candidates, dateKey, namespace, recentProfiles, options)?.item || candidates[0].item;
}

function pickSingleWithoutHistory(candidates, dateKey, namespace, recentProfiles, options) {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      score: scoreCandidate(
        candidate.profile,
        recentProfiles,
        `${namespace}:${dateKey}`,
        index,
        options
      ),
    }))
    .sort((a, b) => b.score - a.score || String(a.profile.id).localeCompare(String(b.profile.id)))[0];
}

export function selectDailyChallenge(challenges = [], dateKey) {
  return selectDiverseItem(
    challenges,
    dateKey,
    "daily-challenge",
    profileFromChallenge,
    { exactRecentWindow: 18, historyDays: 28, typePenalty: 10 }
  );
}

export function selectDailyWhoAmIQuestion(questions = [], dateKey) {
  return selectDiverseItem(
    questions,
    dateKey,
    "daily-whoami",
    profileFromWhoAmI,
    { exactRecentWindow: 30, historyDays: 30, positionPenalty: 10, typePenalty: 18 }
  );
}
