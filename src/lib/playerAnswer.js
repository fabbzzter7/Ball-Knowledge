export function normalizePlayerAnswer(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/['"]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalized(values) {
  return [...new Set(values.map(normalizePlayerAnswer).filter(Boolean))];
}

export function getQuestionAnswerCandidates(questionOrAnswer) {
  if (!questionOrAnswer) return [];

  if (typeof questionOrAnswer === "string") {
    return uniqueNormalized([questionOrAnswer]);
  }

  return uniqueNormalized([
    questionOrAnswer.answer,
    questionOrAnswer.name,
    questionOrAnswer.label,
    ...(Array.isArray(questionOrAnswer.acceptedAnswers)
      ? questionOrAnswer.acceptedAnswers
      : []),
    ...(Array.isArray(questionOrAnswer.aliases) ? questionOrAnswer.aliases : []),
  ]);
}

export function getSelectedPlayerCandidates(player) {
  if (!player) return [];

  return uniqueNormalized([
    player.name,
    player.full_name,
    player.search_name,
    ...(Array.isArray(player.aliases) ? player.aliases : []),
  ]);
}

function hasLooseNameMatch(guesses, expected) {
  return guesses.some((guess) =>
    expected.some((answer) => {
      if (guess === answer) return true;
      if (guess.length >= 5 && answer.length >= 5) {
        return guess.includes(answer) || answer.includes(guess);
      }
      return false;
    })
  );
}

export function isPlayerAnswerMatch({ typedText = "", selectedPlayer = null, answer }) {
  const expected = getQuestionAnswerCandidates(answer);
  const typedCandidates = uniqueNormalized([typedText]);
  const playerCandidates = getSelectedPlayerCandidates(selectedPlayer);
  const guesses = uniqueNormalized([...typedCandidates, ...playerCandidates]);

  if (!expected.length || !guesses.length) return false;

  const matched = hasLooseNameMatch(guesses, expected);

  if (!matched && selectedPlayer && import.meta.env.DEV) {
    console.warn("Player answer did not match", {
      selectedPlayer,
      normalizedSelectedNames: playerCandidates,
      normalizedTypedText: typedCandidates,
      expectedAnswerAliases: expected,
    });
  }

  return matched;
}
