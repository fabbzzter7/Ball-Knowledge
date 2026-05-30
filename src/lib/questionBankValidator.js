export function validateMultipleChoiceBank(bank, bankName = "question bank") {
  const issues = [];
  const ids = new Map();
  const questions = new Map();

  bank.forEach((question, index) => {
    const label = question.id || `${bankName}[${index}]`;
    const normalizedQuestion = String(question.question || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!question.id) issues.push(`${label}: missing id`);
    if (!question.question) issues.push(`${label}: missing question`);
    if (!question.answer) issues.push(`${label}: missing answer`);

    if (question.id) {
      if (ids.has(question.id)) {
        issues.push(`${label}: duplicate id with index ${ids.get(question.id)}`);
      }
      ids.set(question.id, index);
    }

    if (normalizedQuestion) {
      if (questions.has(normalizedQuestion)) {
        issues.push(`${label}: duplicate question with index ${questions.get(normalizedQuestion)}`);
      }
      questions.set(normalizedQuestion, index);
    }

    if (!Array.isArray(question.options)) {
      issues.push(`${label}: options must be an array`);
      return;
    }

    if (question.options.length !== 4) {
      issues.push(`${label}: expected 4 options, got ${question.options.length}`);
    }

    if (new Set(question.options).size !== question.options.length) {
      issues.push(`${label}: duplicate options`);
    }

    if (!question.options.includes(question.answer)) {
      issues.push(`${label}: answer is not included in options`);
    }
  });

  return issues;
}

export function warnQuestionBankIssues(banks) {
  if (typeof import.meta !== "undefined" && !import.meta.env?.DEV) return [];

  const issues = Object.entries(banks).flatMap(([name, bank]) =>
    validateMultipleChoiceBank(bank, name).map((issue) => `${name}: ${issue}`)
  );

  if (issues.length) {
    console.warn("Question bank validation issues", issues);
  }

  return issues;
}
