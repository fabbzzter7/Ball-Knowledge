import React from "react";

const QuizHud = React.memo(function QuizHud({
  score,
  highScore,
  lives,
  streak,
}) {
  return (
    <div className="gk-hud" aria-label="General Knowledge run stats">
      <div className="gk-hud-card gk-hud-card--score">
        <span>Score</span>
        <strong>{score}</strong>
      </div>

      <div className="gk-hud-card">
        <span>Best</span>
        <strong>{highScore}</strong>
      </div>

      <div className={`gk-hud-card ${lives <= 1 ? "is-danger" : ""}`}>
        <span>Lives</span>
        <strong>{lives}</strong>
      </div>

      <div className={`gk-hud-card ${streak > 0 ? "is-hot" : ""}`}>
        <span>Combo</span>
        <strong>x{streak}</strong>
      </div>
    </div>
  );
});

export default QuizHud;
