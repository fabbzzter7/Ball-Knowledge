import { ANSWER_ALIASES } from "../answerAliases.js";

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

function compact(values) {
  return values.filter((value) => value !== null && value !== undefined && value !== "");
}

function expandKnownAliases(values) {
  const normalizedValues = uniqueNormalized(values);
  const expanded = new Set(normalizedValues);

  normalizedValues.forEach((value) => {
    (ANSWER_ALIASES[value] || []).forEach((alias) => {
      const normalizedAlias = normalizeAnswerText(alias);
      if (normalizedAlias) expanded.add(normalizedAlias);
    });

    Object.entries(ANSWER_ALIASES).forEach(([answer, aliases]) => {
      const normalizedAnswer = normalizeAnswerText(answer);
      const normalizedAliases = uniqueNormalized(aliases);

      if (value === normalizedAnswer || normalizedAliases.includes(value)) {
        expanded.add(normalizedAnswer);
        normalizedAliases.forEach((alias) => expanded.add(alias));
      }
    });
  });

  return [...expanded];
}

function getPrimaryAnswerValues(answer = {}) {
  if (typeof answer === "string") return [answer];

  return compact([
    answer.answer,
    answer.correctAnswer,
    answer.playerName,
    answer.name,
    answer.label,
    answer.full_name,
    answer.search_name,
  ]);
}

function getExplicitAliasValues(answer = {}) {
  if (!answer || typeof answer === "string") return [];

  return compact([
    ...asArray(answer.acceptedAnswers),
    ...asArray(answer.aliases),
    ...asArray(answer.answerAliases),
  ]);
}

function getStrictAnswerCandidates(answer = {}) {
  const primary = uniqueNormalized(getPrimaryAnswerValues(answer));
  const aliases = uniqueNormalized([
    ...getExplicitAliasValues(answer),
    ...primary.flatMap((value) => ANSWER_ALIASES[value] || []),
  ]);

  return {
    primary,
    aliases: aliases.filter((alias) => !primary.includes(alias)),
    all: uniqueNormalized([...primary, ...aliases]),
  };
}

function getTypedGuessCandidates(typedAnswer = "") {
  return uniqueNormalized([typedAnswer]);
}

function getSelectedPlayerStrictCandidates(selectedPlayer = null) {
  if (!selectedPlayer) return [];

  return uniqueNormalized([
    selectedPlayer.name,
    selectedPlayer.full_name,
    selectedPlayer.search_name,
    ...asArray(selectedPlayer.aliases),
  ]);
}

function getSelectedPlayerLooseCandidates(selectedPlayer = null) {
  if (!selectedPlayer) return [];

  return uniqueNormalized(
    getSelectedPlayerStrictCandidates(selectedPlayer).flatMap(nameParts)
  );
}

function getAmbiguousAnswerCandidates(answers = []) {
  const counts = new Map();

  answers.forEach((answer) => {
    getStrictAnswerCandidates(answer).all.forEach((candidate) => {
      counts.set(candidate, (counts.get(candidate) || 0) + 1);
    });
  });

  return counts;
}

function isUnambiguousCandidate(candidate, ambiguityCounts) {
  if (!ambiguityCounts) return true;
  return (ambiguityCounts.get(candidate) || 0) <= 1;
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
    return expandKnownAliases([answer, ...nameParts(answer)]);
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

  return expandKnownAliases([
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

  return expandKnownAliases([
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

function strictCandidatesMatch(guesses, expected, ambiguityCounts = null) {
  const primaryMatch = guesses.some((guess) => expected.primary.includes(guess));
  if (primaryMatch) return true;

  return guesses.some(
    (guess) =>
      expected.aliases.includes(guess) &&
      isUnambiguousCandidate(guess, ambiguityCounts)
  );
}

export function doesAnswerMatch({
  typedAnswer = "",
  selectedPlayer = null,
  answer,
  allAnswers = null,
} = {}) {
  const expected = getStrictAnswerCandidates(answer);
  const ambiguityCounts = Array.isArray(allAnswers)
    ? getAmbiguousAnswerCandidates(allAnswers)
    : null;

  if (strictCandidatesMatch(getTypedGuessCandidates(typedAnswer), expected, ambiguityCounts)) {
    return true;
  }

  if (
    strictCandidatesMatch(
      getSelectedPlayerStrictCandidates(selectedPlayer),
      expected,
      ambiguityCounts
    )
  ) {
    return true;
  }

  return strictCandidatesMatch(
    getSelectedPlayerLooseCandidates(selectedPlayer),
    expected,
    ambiguityCounts
  );
}

export function findMatchingAnswer({
  typedAnswer = "",
  selectedPlayer = null,
  answers = [],
} = {}) {
  if (!Array.isArray(answers)) return null;

  return (
    answers.find((answer) =>
      doesAnswerMatch({ typedAnswer, selectedPlayer, answer, allAnswers: answers })
    ) || null
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
  const expected = expandKnownAliases([
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

  console.assert(
    doesAnswerMatch({
      typedAnswer: "South Africa",
      answer: { answer: "South Korea" },
      allAnswers: [{ answer: "South Korea" }, { answer: "South Africa" }],
    }) === false,
    "South Africa must not match South Korea"
  );

  console.assert(
    doesAnswerMatch({
      typedAnswer: "Thomas Muller",
      answer: { answer: "Gerd Muller", aliases: ["Gerd Müller", "Muller"] },
      allAnswers: [
        { answer: "Gerd Muller", aliases: ["Gerd Müller", "Muller"] },
        { answer: "Thomas Muller", aliases: ["Thomas Müller", "Muller"] },
      ],
    }) === false,
    "Thomas Muller must not match Gerd Muller"
  );

  console.assert(
    doesAnswerMatch({
      typedAnswer: "Messi",
      answer: { answer: "Lionel Messi" },
    }) === true,
    "Messi should match Lionel Messi"
  );

  console.assert(
    doesAnswerMatch({
      typedAnswer: "Mbappe",
      answer: { answer: "Kylian Mbappé" },
    }) === true,
    "Mbappe should match Mbappé"
  );

  [
    ["Kante", "N'Golo Kanté"],
    ["Ngolo Kante", "N'Golo Kanté"],
    ["Emenike", "Emmanuel Emenike"],
    ["Musiala", "Jamal Musiala"],
    ["Marchisio", "Claudio Marchisio"],
    ["Aguero", "Sergio Agüero"],
    ["Ozil", "Mesut Özil"],
    ["Modric", "Luka Modrić"],
    ["Pique", "Gerard Piqué"],
  ].forEach(([typedAnswer, answer]) => {
    console.assert(
      isPlayerAnswerCorrect({ typedAnswer, correctAnswer: answer }) === true,
      `${typedAnswer} should match ${answer}`
    );
  });
}
