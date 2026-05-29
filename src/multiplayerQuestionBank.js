import { QUESTIONS } from "./QUESTIONS";
import { CAREER_PATH_MULTI_QUESTIONS } from "./careerpathmulti";
import { PREMIER_LEAGUE_QUESTIONS } from "./premierleague";
import { WORLDCUP_MULTI_QUESTIONS } from "./worldcupmulti";

const CATEGORY_BANKS = {
  general: QUESTIONS.map((question, index) => ({
    ...question,
    id: question.id || `general_${index + 1}`,
    category: "general",
  })),
  world_cup: WORLDCUP_MULTI_QUESTIONS,
  premier_league: PREMIER_LEAGUE_QUESTIONS,
  career_path: CAREER_PATH_MULTI_QUESTIONS,
};

const CATEGORY_ALIASES = {
  "world-cup": "world_cup",
  legends: "general",
  clubs: "general",
};

function normalizeCategory(category) {
  return CATEGORY_ALIASES[category] || category;
}

function isValidMultiplayerQuestion(question) {
  return (
    question?.id &&
    question?.question &&
    question?.answer &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    question.options.every((option) => typeof option === "string" && option.trim())
  );
}

function shuffle(array) {
  const next = [...array];

  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

export function getMultiplayerQuestionsByCategory(category) {
  const normalizedCategory = normalizeCategory(category);

  return (CATEGORY_BANKS[normalizedCategory] || [])
    .filter(isValidMultiplayerQuestion)
    .map((question) => ({
      ...question,
      multiplayerId: `${normalizedCategory}:${question.id}`,
    }));
}

export function pickMultiplayerQuestionIds(category, count = 5) {
  const questions = getMultiplayerQuestionsByCategory(category);

  if (questions.length < count) {
    return [];
  }

  return shuffle(questions)
    .slice(0, count)
    .map((question) => question.multiplayerId);
}

export function getMultiplayerQuestionsByIds(ids) {
  return ids
    .map((storedId) => {
      const [category, ...idParts] = String(storedId).split(":");
      const id = idParts.join(":");
      const questions = getMultiplayerQuestionsByCategory(category);
      const directMatch = questions.find((question) => question.id === id);

      if (directMatch) return directMatch;

      const legacyIndex = Number(id);

      if (Number.isInteger(legacyIndex)) {
        return questions[legacyIndex] || null;
      }

      return null;
    })
    .filter(Boolean);
}
