import {
  getExpectedAnswerCandidates,
  getPlayerAnswerCandidates,
  isPlayerAnswerCorrect,
  normalizeAnswerText,
} from "./playerAnswerMatcher";

export const normalizePlayerAnswer = normalizeAnswerText;

export function getQuestionAnswerCandidates(questionOrAnswer) {
  return getExpectedAnswerCandidates(questionOrAnswer);
}

export function getSelectedPlayerCandidates(player) {
  return getPlayerAnswerCandidates({ selectedPlayer: player });
}

export function isPlayerAnswerMatch({ typedText = "", selectedPlayer = null, answer }) {
  return isPlayerAnswerCorrect({
    typedAnswer: typedText,
    selectedPlayer,
    correctAnswer: answer,
  });
}
