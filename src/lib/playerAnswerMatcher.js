export function normalizeAnswerText(text = "") {
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

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [value];
}

function uniqueNormalized(values) {
  return [...new Set(values.map(normalizeAnswerText).filter(Boolean))];
}

function nameParts(value) {
  const normalized = normalizeAnswerText(value);
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length <= 1) return [normalized].filter(Boolean);

  return [
    normalized,
    ...parts.filter((part) => part.length >= 4),
    parts.at(-1),
    parts.slice(-2).join(" "),
  ].filter(Boolean);
}

export function getExpectedAnswerCandidates(answer = {}) {
  if (typeof answer === "string") {
    return uniqueNormalized([answer, ...nameParts(answer)]);
  }

  const values = [
    answer.answer,
    answer.correctAnswer,
    answer.playerName,
    answer.name,
    answer.label,
    answer.full_name,
    answer.search_name,
    ...asArray(answer.acceptedAnswers),
    ...asArray(answer.aliases),
    ...asArray(answer.answerAliases),
  ];

  return uniqueNormalized([
    ...values,
    ...values.flatMap(nameParts),
  ]);
}

export function getExpectedAnswers(question = {}) {
  return getExpectedAnswerCandidates(question);
}

export function getPlayerAnswerCandidates({ typedAnswer = "", selectedPlayer = null } = {}) {
  const playerValues = selectedPlayer
    ? [
        selectedPlayer.name,
        selectedPlayer.full_name,
        selectedPlayer.search_name,
        ...asArray(selectedPlayer.aliases),
      ]
    : [];

  return uniqueNormalized([
    typedAnswer,
    ...nameParts(typedAnswer),
    ...playerValues,
    ...playerValues.flatMap(nameParts),
  ]);
}

export function getAnswerCandidates({ typedAnswer = "", selectedPlayer = null } = {}) {
  return getPlayerAnswerCandidates({ typedAnswer, selectedPlayer });
}

function candidatesMatch(guesses, expected) {
  return guesses.some((guess) =>
    expected.some((answer) => {
      if (guess === answer) return true;
      if (guess.length >= 4 && answer.length >= 4) {
        return guess.includes(answer) || answer.includes(guess);
      }
      return false;
    })
  );
}

export function isPlayerAnswerCorrect({
  typedAnswer = "",
  selectedPlayer = null,
  correctAnswer,
  question,
  acceptedAnswers = [],
  debugContext = "",
} = {}) {
  const answerObject = question || correctAnswer;
  const accepted = asArray(acceptedAnswers);
  const expected = uniqueNormalized([
    ...getExpectedAnswerCandidates(answerObject),
    ...accepted,
    ...accepted.flatMap(nameParts),
  ]);
  const guesses = getPlayerAnswerCandidates({ typedAnswer, selectedPlayer });
  const matched = expected.length > 0 && guesses.length > 0 && candidatesMatch(guesses, expected);

  if (!matched && selectedPlayer && debugContext) {
    console.warn("Player answer did not match", {
      debugContext,
      selectedPlayer,
      normalizedSelectedCandidates: guesses,
      expectedNormalizedAnswers: expected,
      result: false,
    });
  }

  return matched;
}

if (import.meta.env?.DEV) {
  console.assert(
    isPlayerAnswerCorrect({
      typedAnswer: "",
      selectedPlayer: { name: "Daniele De Rossi", aliases: ["De Rossi"] },
      question: { answer: "Daniele De Rossi" },
    }) === true,
    "Daniele De Rossi should match"
  );

  console.assert(
    isPlayerAnswerCorrect({
      typedAnswer: "",
      selectedPlayer: { name: "Kelechi Iheanacho", aliases: ["Iheanacho"] },
      question: { answer: "Iheanacho" },
    }) === true,
    "Iheanacho should match"
  );

  console.assert(
    isPlayerAnswerCorrect({
      typedAnswer: "",
      selectedPlayer: { name: "Borja Valero Iglesias", aliases: ["Borja Valero"] },
      question: { answer: "Borja Valero" },
    }) === true,
    "Borja Valero should match"
  );
}
