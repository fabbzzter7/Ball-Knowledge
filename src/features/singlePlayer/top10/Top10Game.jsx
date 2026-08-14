import { AnimatePresence, motion } from "framer-motion";
import BKIcon from "../../../components/BKIcon";
import GameTopNav from "../../../components/GameTopNav";
import GuessInput from "../../../components/GuessInput";
import SinglePlayerFrame from "../shared/SinglePlayerFrame";
import "./Top10Game.css";
import useTop10Runtime from "./useTop10Runtime";

export default function Top10Game({
  unavailable,
  challenge,
  answers,
  ruleHint,
  targetCount,
  isPlayerChallenge,
  dateLabel,
  blocked,
  coinShopModal,
  dailyRewardMeterModal,
  xpToastOverlay,
  quizBackgroundImage,
  onHome,
  onAnswerFound,
  onFinished,
  playCorrectSound,
  playWrongSound,
  getAnswerKey,
  formatAnswerWithValue,
}) {
  const {
    foundAnswers,
    input,
    selectedPlayer,
    score,
    lives,
    reveal,
    celebratedAnswer,
    isRevealing,
    setInput,
    setSelectedPlayer,
    submitAnswer,
  } = useTop10Runtime({
    answers,
    targetCount,
    unavailable,
    blocked,
    getAnswerKey,
    onAnswerFound,
    onFinished,
    playCorrectSound,
    playWrongSound,
  });

  const foundCount = Math.min(foundAnswers.length, targetCount);

  return (
    <SinglePlayerFrame
      className="fullscreen-bg daily-game-bg daily-challenge-screen scrollable-game-screen"
      backgroundImage={quizBackgroundImage}
      coinShopModal={coinShopModal}
      dailyRewardMeterModal={dailyRewardMeterModal}
      xpToastOverlay={xpToastOverlay}
    >
      {unavailable ? (
        <div className="dc-shell dc-shell--empty">
          <GameTopNav
            className="dc-home-button"
            label="Home"
            variant="home"
            onClick={onHome}
          />

          <section className="dc-empty-card">
            <span className="dc-kicker">Daily Challenge</span>
            <h1>Challenge unavailable</h1>
            <p>
              Today{"\u2019"}s list challenge could not be loaded. Please go back home and try again.
            </p>
            <button className="dc-submit" type="button" onClick={onHome}>
              Back to Home
            </button>
          </section>
        </div>
      ) : (
        <>
          <AnimatePresence>
            {reveal?.phase === "result" && (
              <motion.div
                className={`rank-reveal-overlay ${reveal.type || ""}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.25 }}
              >
                <div className="rank-reveal-label">
                  {reveal.type === "wrong"
                    ? reveal.displayRank === 0
                      ? "NOT FOUND"
                      : "SEARCHING"
                    : reveal.displayRank === reveal.rank
                    ? "FOUND"
                    : "SCANNING"}
                </div>

                <div className="rank-reveal-number">
                  {reveal.displayRank > 0
                    ? `#${reveal.displayRank}`
                    : "OUT"}
                </div>

                {reveal.type === "correct" &&
                  reveal.displayRank === reveal.rank && (
                  <div className="rank-reveal-player">
                    {formatAnswerWithValue(reveal.answer)}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="dc-shell">
            <GameTopNav
              className="dc-home-button"
              label="Home"
              variant="home"
              onClick={onHome}
            />

            <header className="dc-header">
              <div className="dc-title-row">
                <div>
                  <span className="dc-kicker">Daily Challenge</span>
                  <h1>{challenge.label}</h1>
                </div>

                <div className="dc-date-pill" aria-label={`Challenge date ${dateLabel}`}>
                  <span>Today</span>
                  <strong>{dateLabel}</strong>
                </div>
              </div>

              <p className="dc-question">{challenge.question}</p>
              {ruleHint && (
                <p className="dc-rule">{ruleHint}</p>
              )}
            </header>

            <div className="dc-status-strip" aria-label="Daily Challenge progress">
              <span>
                Score <strong>{score}</strong>
              </span>

              <span>
                Found <strong>{foundCount}/{targetCount}</strong>
              </span>

              <span>
                Lives <strong>{lives}</strong>
              </span>
            </div>

            <section className="dc-board" aria-label={`Top ${targetCount} challenge answers`}>
              <div className="dc-board-head">
                <span>Top {targetCount}</span>
                <strong>{foundCount}/{targetCount}</strong>
              </div>

              <div className="dc-slot-list">
                {answers.map((answer, index) => {
                  const isFound = foundAnswers.includes(answer);
                  const rank = index + 1;
                  const isScanning = reveal?.displayRank === rank && isRevealing;
                  const isRevealTarget = reveal?.type === "correct" && reveal.rank === rank;
                  const isJustFound = celebratedAnswer === answer;

                  return (
                    <motion.div
                      key={getAnswerKey(answer, index)}
                      className={`dc-slot ${isFound ? "found" : ""} ${
                        isScanning ? "scanning" : ""
                      } ${isRevealTarget ? "reveal-target" : ""} ${
                        isJustFound ? "just-found" : ""
                      }`}
                      initial={false}
                      animate={
                        isJustFound
                          ? { scale: [1, 1.12, 1], y: [0, -7, 0] }
                          : isFound
                          ? { scale: [1, 1.08, 1] }
                          : {}
                      }
                      transition={{ duration: 0.45 }}
                    >
                      <span className="dc-slot-rank">#{rank}</span>
                      <span className="dc-slot-answer">
                        {isFound ? (
                          <strong>{formatAnswerWithValue(answer)}</strong>
                        ) : (
                          <em>Awaiting answer</em>
                        )}
                      </span>
                      <span className="dc-slot-state" aria-hidden="true">
                        {isFound ? (
                          <BKIcon name="dailyChallenge" size={18} />
                        ) : (
                          <BKIcon name="questionMark" size={15} />
                        )}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <section className="dc-input-panel" aria-label="Submit a guess">
              <GuessInput
                answerType={isPlayerChallenge ? "player" : "text"}
                value={input}
                onTextChange={setInput}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={setSelectedPlayer}
                onSubmit={submitAnswer}
                autoSubmitOnSelect
                placeholder={
                  isPlayerChallenge
                    ? "Search and select player..."
                    : "Type answer..."
                }
                buttonLabel="GUESS"
                rowClassName="dc-input-row"
                inputClassName="dc-text-input"
                buttonClassName="dc-submit"
                maxSuggestions={4}
                autoFocus
              />
            </section>
          </div>
        </>
      )}
    </SinglePlayerFrame>
  );
}
