import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const AnswerButton = React.memo(function AnswerButton({
  option,
  tone,
  answer,
  selected,
  onChoose,
  onPlayClick,
  disabled = false,
}) {
  const isCorrect = option === answer;
  const isChosen = selected === option;
  const showCorrect = selected && isCorrect;
  const showWrong = selected && isChosen && !isCorrect;
  const isMuted = selected && !showCorrect && !showWrong;

  return (
    <button
      type="button"
      disabled={Boolean(selected) || disabled}
      onClick={() => {
        onPlayClick?.();
        onChoose(option);
      }}
      className={[
        "gk-answer-card",
        `gk-answer-card--${tone}`,
        showCorrect ? "is-correct" : "",
        showWrong ? "is-wrong" : "",
        isMuted ? "is-muted" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="gk-answer-accent" />
      <strong>{option}</strong>
      {showCorrect && <CheckCircle2 size={22} aria-hidden="true" />}
      {showWrong && <XCircle size={22} aria-hidden="true" />}
    </button>
  );
});

const AnswerGrid = React.memo(function AnswerGrid({
  options,
  answer,
  selected,
  onChoose,
  onPlayClick,
  disabled = false,
}) {
  const tones = ["emerald", "gold", "violet", "cyan"];

  return (
    <div className="gk-answer-grid">
      {options.map((option, index) => (
        <AnswerButton
          key={option}
          option={option}
          tone={tones[index % tones.length]}
          answer={answer}
          selected={selected}
          onChoose={onChoose}
          onPlayClick={onPlayClick}
          disabled={disabled}
        />
      ))}
    </div>
  );
});

export default AnswerGrid;
