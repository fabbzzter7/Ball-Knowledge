const DIFFICULTIES = ["Easy", "Medium", "Hard", "Very Hard"];
const DIFFICULTY_RANK = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  "Very Hard": 4,
};

export const GENERAL_KNOWLEDGE_RECENT_HISTORY_KEY =
  "ballKnowledgeRecentGeneralQuestionKeys";
export const GENERAL_KNOWLEDGE_RECENT_HISTORY_LIMIT = 45;

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getGeneralKnowledgeQuestionKey(question) {
  const questionKey = normalizeText(question?.question);
  const answerKey = normalizeText(question?.answer);

  if (questionKey && answerKey) {
    return `${questionKey}::${answerKey}`;
  }

  return question?.id ? `id:${question.id}` : "";
}

function shuffle(array, rng = Math.random) {
  const next = [...array];

  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

function shuffleQuestionOptions(question, rng = Math.random) {
  if (!Array.isArray(question?.options)) return { ...question };

  if (!question.options.includes(question.answer)) {
    return { ...question, options: [...question.options] };
  }

  return {
    ...question,
    options: shuffle(question.options, rng),
  };
}

function dedupeQuestions(questions) {
  const seen = new Set();
  const unique = [];

  questions.forEach((question) => {
    const key = getGeneralKnowledgeQuestionKey(question);
    if (!key || seen.has(key)) return;

    seen.add(key);
    unique.push(question);
  });

  return unique;
}

export function getGeneralKnowledgeDifficultyWeights(questionNumber) {
  if (questionNumber <= 5) {
    return { Easy: 1 };
  }

  if (questionNumber <= 10) {
    return { Easy: 0.7, Medium: 0.3 };
  }

  if (questionNumber <= 20) {
    return { Easy: 0.2, Medium: 0.65, Hard: 0.15 };
  }

  if (questionNumber <= 35) {
    return { Medium: 0.2, Hard: 0.7, "Very Hard": 0.1 };
  }

  return { Hard: 0.62, "Very Hard": 0.38 };
}

function createDifficultyBags(questions, recentQuestionKeys = [], rng = Math.random) {
  const recentSet = new Set(recentQuestionKeys);
  const grouped = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [difficulty, { fresh: [], recent: [] }])
  );

  dedupeQuestions(questions).forEach((question) => {
    if (!DIFFICULTIES.includes(question?.difficulty)) return;

    const key = getGeneralKnowledgeQuestionKey(question);
    const targetBag = recentSet.has(key) ? "recent" : "fresh";
    grouped[question.difficulty][targetBag].push(question);
  });

  return Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      {
        fresh: shuffle(grouped[difficulty].fresh, rng),
        recent: shuffle(grouped[difficulty].recent, rng),
      },
    ])
  );
}

function hasAvailableQuestion(bags, difficulty, usedKeys) {
  const bag = bags[difficulty];
  if (!bag) return false;

  return [...bag.fresh, ...bag.recent].some(
    (question) => !usedKeys.has(getGeneralKnowledgeQuestionKey(question))
  );
}

function takeFromBag(candidates, usedKeys) {
  while (candidates.length) {
    const question = candidates.pop();
    const key = getGeneralKnowledgeQuestionKey(question);

    if (key && !usedKeys.has(key)) {
      return question;
    }
  }

  return null;
}

function pickWeightedDifficulty(weights, bags, usedKeys, rng = Math.random) {
  const weightedDifficulties = Object.entries(weights).filter(([difficulty]) =>
    hasAvailableQuestion(bags, difficulty, usedKeys)
  );

  if (!weightedDifficulties.length) {
    return DIFFICULTIES.find((difficulty) =>
      hasAvailableQuestion(bags, difficulty, usedKeys)
    );
  }

  const totalWeight = weightedDifficulties.reduce(
    (sum, [, weight]) => sum + weight,
    0
  );
  let roll = rng() * totalWeight;

  for (const [difficulty, weight] of weightedDifficulties) {
    roll -= weight;
    if (roll <= 0) return difficulty;
  }

  return weightedDifficulties[weightedDifficulties.length - 1][0];
}

function pickNextQuestion({ bags, questionNumber, usedKeys, rng }) {
  const difficulty = pickWeightedDifficulty(
    getGeneralKnowledgeDifficultyWeights(questionNumber),
    bags,
    usedKeys,
    rng
  );

  if (!difficulty) return null;

  const bag = bags[difficulty];
  const question = takeFromBag(bag.fresh, usedKeys) || takeFromBag(bag.recent, usedKeys);

  if (!question) return null;

  usedKeys.add(getGeneralKnowledgeQuestionKey(question));
  return question;
}

export function buildGeneralKnowledgeQuestions(
  questionBank = [],
  { recentQuestionKeys = [], rng = Math.random } = {}
) {
  const bags = createDifficultyBags(questionBank, recentQuestionKeys, rng);
  const uniqueCount = DIFFICULTIES.reduce(
    (sum, difficulty) =>
      sum + bags[difficulty].fresh.length + bags[difficulty].recent.length,
    0
  );
  const usedKeys = new Set();
  const selected = [];

  for (let index = 0; index < uniqueCount; index += 1) {
    const question = pickNextQuestion({
      bags,
      questionNumber: index + 1,
      usedKeys,
      rng,
    });

    if (!question) break;
    selected.push(shuffleQuestionOptions(question, rng));
  }

  return selected;
}

export function auditGeneralKnowledgeQuestionBank(questionBank = []) {
  const counts = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, 0]));
  const malformed = [];
  const ids = new Map();
  const exactQuestions = new Map();
  const normalizedQuestions = new Map();
  const identicalQuestionAnswers = new Map();

  questionBank.forEach((question, index) => {
    if (DIFFICULTIES.includes(question?.difficulty)) {
      counts[question.difficulty] += 1;
    } else {
      malformed.push({
        index,
        id: question?.id || null,
        difficulty: question?.difficulty || null,
        question: question?.question || "",
      });
    }

    const id = question?.id || "(missing)";
    ids.set(id, [...(ids.get(id) || []), index]);

    const exact = String(question?.question || "");
    exactQuestions.set(exact, [...(exactQuestions.get(exact) || []), question?.id || null]);

    const normalizedQuestion = normalizeText(question?.question);
    normalizedQuestions.set(normalizedQuestion, [
      ...(normalizedQuestions.get(normalizedQuestion) || []),
      question?.id || null,
    ]);

    const qaKey = `${normalizedQuestion}::${normalizeText(question?.answer)}`;
    identicalQuestionAnswers.set(qaKey, [
      ...(identicalQuestionAnswers.get(qaKey) || []),
      question?.id || null,
    ]);
  });

  const toDuplicates = (entries) =>
    [...entries]
      .filter(([key, values]) => key && values.length > 1)
      .map(([key, values]) => ({ key, ids: values }));

  return {
    total: questionBank.length,
    counts,
    malformed,
    duplicateIds: [...ids]
      .filter(([id, indexes]) => id === "(missing)" || indexes.length > 1)
      .map(([id, indexes]) => ({ id, indexes })),
    exactDuplicateQuestions: toDuplicates(exactQuestions),
    normalizedDuplicateQuestions: toDuplicates(normalizedQuestions),
    identicalQuestionAnswers: toDuplicates(identicalQuestionAnswers),
  };
}

export function getDifficultyScore(difficulty) {
  return DIFFICULTY_RANK[difficulty] || 0;
}
