import React from "react";
import { motion } from "framer-motion";
import PlayerAvatar from "../../components/PlayerAvatar";
import AnswerGrid from "../generalKnowledge/AnswerGrid";
import QuestionCard from "../generalKnowledge/QuestionCard";
import "../generalKnowledge/GeneralKnowledgeGame.css";
import "./ActiveMatchRound.css";
import {
  GameplayShell,
} from "../gameplay/GameplayShell";
import useMultiplayerRoundRuntime from "./useMultiplayerRoundRuntime";

function getCareerPathClubs(question = "") {
  return String(question)
    .split(/\s*(?:→|->)\s*/)
    .map((club) => club.trim())
    .filter(Boolean);
}

function CareerPathQuestionView({ question, className = "" }) {
  const clubs = getCareerPathClubs(question);

  return (
    <section className={`gp-career-card ${className}`}>
      <div className="gp-kicker">Guess the player</div>
      <div className="gp-career-path">
        {clubs.map((club, index) => (
          <React.Fragment key={`${club}-${index}`}>
            <div className="gp-career-club">{club}</div>
            {index < clubs.length - 1 && (
              <div className="gp-career-arrow">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

export default function ActiveMatchRound({
  round,
  quizBackground,
  categoryClass,
  categoryLabel,
  match,
  playerSlot,
  playerProfile,
  opponentProfile,
  playerName,
  opponentName,
  timeLimit,
  isSubmitting,
  persistenceLoading,
  onSubmitScore,
  onRuntimeError,
  playCorrectSound,
  playWrongSound,
}) {
  const {
    TIMEOUT_VALUE,
    questions,
    loadStatus,
    currentQuestion,
    index,
    selected,
    score,
    timeLeft,
    done,
    chooseAnswer,
    saveAndExit,
  } = useMultiplayerRoundRuntime({
    round,
    timeLimit,
    onSubmitScore,
    onRuntimeError,
    playCorrectSound,
    playWrongSound,
  });
  const busy = Boolean(isSubmitting || persistenceLoading);
  const isLoadingQuestions = loadStatus === "loading" || !currentQuestion;
  const questionTotal = questions.length || 5;
  const opponentScore =
    playerSlot === "player2"
      ? round?.player1_score ?? 0
      : round?.player2_score ?? 0;
  const shellCategoryClass = categoryClass?.replace("category-", "") || "general";
  const opponentDisplayName =
    opponentName && opponentName !== "your opponent" ? opponentName : "";

  return (
    <GameplayShell
      theme="multiplayer"
      className={`gk-game mp-competitive-game mp-competitive-game--${shellCategoryClass}`}
      backgroundImage={`linear-gradient(rgba(6,12,18,0.08), rgba(0,0,0,0.68)), url(${quizBackground})`}
    >
      <div className="gk-gameplay-shell mp-round-shell">
        <div className="gk-topbar mp-round-topbar">
          <button
            type="button"
            className="game-top-nav gk-exit-button mp-save-exit-button"
            onClick={saveAndExit}
            disabled={busy || loadStatus === "loading"}
          >
            Save & Exit
          </button>

          <div className="gk-mode-meta">
            <span>H2H Arena</span>
            <strong>{categoryLabel}</strong>
          </div>

          <div className="gk-question-meta">
            <span>Round</span>
            <strong>{round?.round_number || match?.round_number || 1}</strong>
          </div>
        </div>

        <section className="mp-competitive-hud" aria-label="Match score">
          <div className="mp-competitor-card is-you">
            <PlayerAvatar profile={playerProfile} size="small" />
            <span>
              <small>You</small>
              <strong>{playerName || "You"}</strong>
            </span>
            <b>{score}</b>
          </div>

          <div className="mp-round-center">
            <span>VS</span>
            <strong>{score}-{opponentScore}</strong>
          </div>

          <div className="mp-competitor-card">
            <PlayerAvatar
              profile={opponentProfile}
              size="small"
              hideFlag={!opponentDisplayName}
            />
            <span>
              <small>Rival</small>
              <strong>{opponentDisplayName || "Waiting"}</strong>
            </span>
            <b>{opponentScore}</b>
          </div>
        </section>

        {isLoadingQuestions ? (
          <div className="mp-round-state-card">
            <strong>Loading round</strong>
            <span>Preparing your five questions.</span>
          </div>
        ) : (
          <>
            <div className="mp-round-meta-row">
              <span>Question {index + 1} / {questionTotal}</span>
              <div className={`mp-round-timer ${timeLeft <= 3 ? "danger" : ""}`}>
                <strong>{String(timeLeft).padStart(2, "0")}</strong>
              </div>
            </div>

            <motion.div
              className="gk-question-stage mp-question-stage"
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {round?.category === "career_path" ? (
                <>
                  <CareerPathQuestionView
                    question={currentQuestion.question}
                    className="gp-multiplayer-career-path-card"
                  />
                  <section className="mp-career-answer-card">
                    <div>
                      <span>Choose the player</span>
                      <strong>Career Path</strong>
                    </div>
                    <AnswerGrid
                      options={currentQuestion.options}
                      answer={currentQuestion.answer}
                      selected={selected}
                      onChoose={chooseAnswer}
                      disabled={busy}
                    />
                  </section>
                </>
              ) : (
                <>
                  <QuestionCard
                    question={currentQuestion.question}
                    category={categoryLabel}
                  />
                  <AnswerGrid
                    options={currentQuestion.options}
                    answer={currentQuestion.answer}
                    selected={selected}
                    onChoose={chooseAnswer}
                    disabled={busy}
                  />
                </>
              )}

              {selected === TIMEOUT_VALUE && (
                <div className="mp-round-feedback wrong">Time's up</div>
              )}

              {done && (
                <div className="mp-round-complete-card">
                  <span>Round complete</span>
                  <strong>{score} / {questionTotal}</strong>
                  <small>{busy ? "Submitting score..." : "Waiting for rival..."}</small>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </GameplayShell>
  );
}
