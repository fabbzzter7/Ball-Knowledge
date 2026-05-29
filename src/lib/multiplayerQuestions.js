import { QUESTIONS } from "../QUESTIONS";
import { WORLD_CUP_QUESTIONS } from "../WORLD_CUP_QUESTIONS";

const QUESTION_BANKS = {
  general: QUESTIONS,
  "world-cup": WORLD_CUP_QUESTIONS,
  legends: QUESTIONS,
  clubs: QUESTIONS,
};

function shuffle(array) {
  const next = [...array];

  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

function stableNumber(seed) {
  return String(seed)
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
}

function stableOptionsForQuestion(question, bank, seed) {
  if (question.options?.length >= 4) {
    return question.options;
  }

  const wrongAnswers = bank
    .map((item) => item.answer)
    .filter((answer) => answer && answer !== question.answer);

  const start = stableNumber(seed) % Math.max(wrongAnswers.length, 1);
  const distractors = [];

  for (let i = 0; i < wrongAnswers.length && distractors.length < 3; i++) {
    const answer = wrongAnswers[(start + i) % wrongAnswers.length];

    if (!distractors.includes(answer)) {
      distractors.push(answer);
    }
  }

  const options = [question.answer, ...distractors].slice(0, 4);
  const rotateBy = stableNumber(`${seed}-${question.answer}`) % options.length;

  return [...options.slice(rotateBy), ...options.slice(0, rotateBy)];
}

export function selectMultiplayerQuestionIds(category, count = 5) {
  const bank = QUESTION_BANKS[category] || QUESTIONS;
  const available = bank
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => question.answer);

  return shuffle(available)
    .slice(0, count)
    .map(({ index }) => `${category}:${index}`);
}

export function resolveMultiplayerQuestions(questionIds) {
  return questionIds
    .map((questionId) => {
      const [category, indexText] = String(questionId).split(":");
      const bank = QUESTION_BANKS[category] || QUESTIONS;
      const index = Number(indexText);
      const question = bank[index];

      if (!question) return null;

      const options = stableOptionsForQuestion(question, bank, questionId);

      if (options.length < 4) return null;

      return {
        ...question,
        id: questionId,
        category,
        options,
      };
    })
    .filter(Boolean);
}
