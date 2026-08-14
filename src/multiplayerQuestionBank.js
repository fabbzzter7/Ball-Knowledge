const CATEGORY_ALIASES = {
  "world-cup": "world_cup",
  legends: "general",
  clubs: "general",
};

const categoryLoaders = {
  async general() {
    const { QUESTIONS } = await import("./QUESTIONS");
    return QUESTIONS.map((question, index) => ({
      ...question,
      id: question.id || `general_${index + 1}`,
      category: "general",
    }));
  },
  async world_cup() {
    const { WORLDCUP_MULTI_QUESTIONS } = await import("./worldcupmulti");
    return WORLDCUP_MULTI_QUESTIONS;
  },
  async premier_league() {
    const { PREMIER_LEAGUE_QUESTIONS } = await import("./premierleague");
    return PREMIER_LEAGUE_QUESTIONS;
  },
  async career_path() {
    const { CAREER_PATH_MULTI_QUESTIONS } = await import("./careerpathmulti");
    return CAREER_PATH_MULTI_QUESTIONS;
  },
};

const categoryCache = new Map();

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
    question.options.every((option) => typeof option === "string" && option.trim()) &&
    question.options.includes(question.answer)
  );
}

function withMultiplayerId(question, normalizedCategory) {
  return {
    ...question,
    multiplayerId: `${normalizedCategory}:${question.id}`,
  };
}

function shuffle(array) {
  const next = [...array];

  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

export async function getMultiplayerQuestionsByCategory(category) {
  const normalizedCategory = normalizeCategory(category);
  const loader = categoryLoaders[normalizedCategory];
  if (!loader) return [];

  if (!categoryCache.has(normalizedCategory)) {
    categoryCache.set(
      normalizedCategory,
      loader().then((questions) =>
        (questions || [])
          .filter(isValidMultiplayerQuestion)
          .map((question) => withMultiplayerId(question, normalizedCategory))
      )
    );
  }

  return categoryCache.get(normalizedCategory);
}

export async function getMultiplayerQuestionsByCategories(categories) {
  const banks = await Promise.all(
    categories.map((category) => getMultiplayerQuestionsByCategory(category))
  );

  return banks.flat();
}

export async function pickMultiplayerQuestionIds(category, count = 5) {
  const questions = await getMultiplayerQuestionsByCategory(category);

  if (questions.length < count) {
    return [];
  }

  return shuffle(questions)
    .slice(0, count)
    .map((question) => question.multiplayerId);
}

export async function getMultiplayerQuestionsByIds(ids) {
  const groupedIds = new Map();

  ids.forEach((storedId, index) => {
    const [category, ...idParts] = String(storedId).split(":");
    const normalizedCategory = normalizeCategory(category);
    const id = idParts.join(":");
    const existing = groupedIds.get(normalizedCategory) || [];
    existing.push({ id, index });
    groupedIds.set(normalizedCategory, existing);
  });

  const loadedGroups = await Promise.all(
    [...groupedIds.entries()].map(async ([category, entries]) => ({
      category,
      entries,
      questions: await getMultiplayerQuestionsByCategory(category),
    }))
  );

  const questionsByOriginalIndex = new Map();

  loadedGroups.forEach(({ entries, questions }) => {
    entries.forEach(({ id, index }) => {
      const directMatch = questions.find((question) => question.id === id);

      if (directMatch) {
        questionsByOriginalIndex.set(index, directMatch);
        return;
      }

      const legacyIndex = Number(id);

      if (Number.isInteger(legacyIndex) && questions[legacyIndex]) {
        questionsByOriginalIndex.set(index, questions[legacyIndex]);
      }
    });
  });

  return ids
    .map((_, index) => questionsByOriginalIndex.get(index))
    .filter(Boolean);
}
