import { QUESTIONS } from "../src/QUESTIONS.js";
import {
  auditGeneralKnowledgeQuestionBank,
  buildGeneralKnowledgeQuestions,
  getDifficultyScore,
  getGeneralKnowledgeQuestionKey,
} from "../src/features/generalKnowledge/questionSequencer.js";

function createSeededRng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTinyQuestionBank() {
  const makeQuestion = (difficulty, index) => ({
    difficulty,
    question: `${difficulty} test question ${index}?`,
    options: [`${difficulty} answer ${index}`, "Wrong A", "Wrong B", "Wrong C"],
    answer: `${difficulty} answer ${index}`,
    id: `${difficulty.toLowerCase().replaceAll(" ", "_")}_${index}`,
    category: "test",
  });

  return [
    ...Array.from({ length: 6 }, (_, index) => makeQuestion("Easy", index)),
    ...Array.from({ length: 3 }, (_, index) => makeQuestion("Medium", index)),
    ...Array.from({ length: 2 }, (_, index) => makeQuestion("Hard", index)),
    makeQuestion("Very Hard", 0),
  ];
}

function getSequenceKeys(sequence) {
  return sequence.map(getGeneralKnowledgeQuestionKey);
}

const audit = auditGeneralKnowledgeQuestionBank(QUESTIONS);
const sequence = buildGeneralKnowledgeQuestions(QUESTIONS, {
  rng: createSeededRng(1001),
});
const sequenceKeys = getSequenceKeys(sequence);
const uniqueKeys = new Set(sequenceKeys);

assert(sequence.length > 0, "Expected General Knowledge sequence to be non-empty");
assert(
  sequence.length === uniqueKeys.size,
  "Expected no duplicate normalized question+answer keys in one full run"
);
assert(
  sequence.slice(0, 5).every((question) => question.difficulty === "Easy"),
  "Expected questions 1-5 to be Easy"
);
assert(
  sequence.every((question) => question.options.includes(question.answer)),
  "Expected shuffled options to retain the correct answer"
);

let earlyDifficultyTotal = 0;
let lateDifficultyTotal = 0;
const earlySequences = new Set();

for (let seed = 1; seed <= 120; seed += 1) {
  const run = buildGeneralKnowledgeQuestions(QUESTIONS, {
    rng: createSeededRng(seed),
  });

  assert(
    run.slice(0, 5).every((question) => question.difficulty === "Easy"),
    `Expected questions 1-5 to be Easy in seed ${seed}`
  );
  assert(
    run.every((question) => getDifficultyScore(question.difficulty) > 0),
    `Expected every selected question to have a valid difficulty in seed ${seed}`
  );

  earlyDifficultyTotal += getDifficultyScore(run[2].difficulty);
  lateDifficultyTotal += getDifficultyScore(run[29].difficulty);
  earlySequences.add(getSequenceKeys(run.slice(0, 10)).join("|"));
}

assert(
  lateDifficultyTotal / 120 > earlyDifficultyTotal / 120 + 1,
  "Expected average difficulty around Q30 to be meaningfully higher than Q3"
);
assert(
  earlySequences.size > 1,
  "Expected separate seeded runs to produce varied early sequences"
);

const tinyRun = buildGeneralKnowledgeQuestions(makeTinyQuestionBank(), {
  rng: createSeededRng(7),
});
assert(tinyRun.length === 12, "Expected tiny bank run to consume every question");
assert(
  new Set(getSequenceKeys(tinyRun)).size === tinyRun.length,
  "Expected tiny bank fallback/exhaustion to avoid duplicates"
);

const runA = buildGeneralKnowledgeQuestions(QUESTIONS, {
  rng: createSeededRng(2001),
});
const recentKeys = getSequenceKeys(runA.slice(0, 45));
const runB = buildGeneralKnowledgeQuestions(QUESTIONS, {
  recentQuestionKeys: recentKeys,
  rng: createSeededRng(2002),
});
const earlyRunBKeys = getSequenceKeys(runB.slice(0, 20));
const earlyOverlap = earlyRunBKeys.filter((key) => recentKeys.includes(key));

assert(
  earlyOverlap.length === 0,
  "Expected recent questions to be avoided early when alternatives exist"
);

console.log(
  JSON.stringify(
    {
      audit: {
        total: audit.total,
        counts: audit.counts,
        duplicateIds: audit.duplicateIds.length,
        exactDuplicateQuestions: audit.exactDuplicateQuestions.length,
        normalizedDuplicateQuestions: audit.normalizedDuplicateQuestions.length,
        identicalQuestionAnswers: audit.identicalQuestionAnswers.length,
        malformed: audit.malformed.length,
      },
      selectedUniqueQuestionKeys: sequence.length,
      averageDifficulty: {
        q3: Number((earlyDifficultyTotal / 120).toFixed(2)),
        q30: Number((lateDifficultyTotal / 120).toFixed(2)),
      },
      variedEarlySequences: earlySequences.size,
      recentAvoidanceOverlapInFirst20: earlyOverlap.length,
    },
    null,
    2
  )
);
