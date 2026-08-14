import React from "react";

const QuizTimer = React.memo(function QuizTimer({ difficulty, timeLeft }) {
  return (
    <div
      className={`gk-timer ${
        difficulty === "Very Hard" ? "very-hard" : ""
      } ${timeLeft <= 3 ? "danger" : ""}`}
    >
      {timeLeft}s
    </div>
  );
});

export default QuizTimer;
