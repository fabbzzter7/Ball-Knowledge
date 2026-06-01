import React from "react";
import PlayerPicker from "./PlayerPicker";

export default function GuessInput({
  answerType = "text",
  value = "",
  onTextChange,
  selectedPlayer,
  onSelectPlayer,
  onSubmit,
  placeholder = "Type answer...",
  disabled = false,
  buttonLabel = "Guess",
  autoSubmitOnSelect = false,
  showMeta = true,
  maxSuggestions = 4,
  rowClassName = "",
  inputClassName = "",
  buttonClassName = "",
  autoFocus = false,
}) {
  const isPlayerAnswer = answerType === "player";
  const canSubmit = Boolean(selectedPlayer || value.trim()) && !disabled;

  return (
    <div className={`guess-input-row ${isPlayerAnswer ? "player" : "text"} ${rowClassName}`}>
      {isPlayerAnswer ? (
        <PlayerPicker
          value={selectedPlayer}
          onSelect={onSelectPlayer}
          onSelectPlayer={onSelectPlayer}
          inputValue={value}
          onInputChange={onTextChange}
          onChangeText={onTextChange}
          onSubmit={onSubmit}
          autoSubmitOnSelect={autoSubmitOnSelect}
          showMeta={showMeta}
          maxSuggestions={maxSuggestions}
          placeholder={placeholder}
          disabled={disabled}
          compact
          autoFocus={autoFocus}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onTextChange?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit?.();
          }}
          placeholder={placeholder}
          className={inputClassName}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      )}

      <button
        className={buttonClassName}
        onClick={onSubmit}
        disabled={!canSubmit}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
