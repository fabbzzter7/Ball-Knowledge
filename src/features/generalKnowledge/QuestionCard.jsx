import React from "react";

function formatCategory(category) {
  if (!category) return "General Knowledge";
  if (String(category).toLowerCase() === "general") return "General Knowledge";

  return String(category)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const QuestionCard = React.memo(function QuestionCard({ question, category }) {
  return (
    <section className="gk-question-card" aria-label="Current question">
      <div className="gk-question-kicker">
        <span />
        <strong>{formatCategory(category)}</strong>
      </div>
      <h1>{question}</h1>
      <div className="gk-question-watermark" aria-hidden="true">?</div>
    </section>
  );
});

export default QuestionCard;
