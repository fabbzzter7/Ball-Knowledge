import { Fragment } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import BKIcon from "../../../components/BKIcon";
import GuessInput from "../../../components/GuessInput";
import {
  GameplayHud,
  GameplayShell,
  GameplayTopBar,
  GameplayXpMeter,
} from "../../gameplay/GameplayShell";

function getCareerPathClubs(question = "") {
  return String(question)
    .split("→")
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
          <Fragment key={`${club}-${index}`}>
            <motion.span
              className="gp-career-club"
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.045, duration: 0.2 }}
            >
              {club}
            </motion.span>
            {index < clubs.length - 1 && (
              <div className="gp-career-arrow">{"\u2192"}</div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

export default function ClassicQuizGame({
  gameMode,
  current,
  questionIndex,
  currentRoundQuestionNumber,
  score,
  highScore,
  coins,
  lives,
  selected,
  textAnswer,
  careerSelectedPlayer,
  isTimedQuestion,
  timeLeft,
  playerLevel,
  xpProgressPercent,
  xpProgressLabel,
  xpToast,
  rewardPopup,
  coinShopModal,
  dailyRewardMeterModal,
  xpToastOverlay,
  objectiveProgressModal,
  quizBackgroundImage,
  onHome,
  onOpenCoinShop,
  onCollectReward,
  onTextAnswerChange,
  onCareerPlayerSelect,
  onSubmitTextAnswer,
  onChooseAnswer,
  isCorrectAnswer,
  playClickSound,
}) {
  if (!current) return null;

  const isCareer = gameMode === "career";
  const modeTitle = isCareer ? "Career Path" : "World Cup";
  const levelLabel = playerLevel?.levelNumber
    ? `LVL ${playerLevel.levelNumber}`
    : "LEVEL";
  const nextLabel = playerLevel?.next
    ? `Next: ${playerLevel.next.name}`
    : "Max level";

  return (
    <GameplayShell
      theme={isCareer ? "career" : "world-cup"}
      backgroundImage={quizBackgroundImage}
      coinShopModal={coinShopModal}
      dailyRewardMeterModal={dailyRewardMeterModal}
      xpToastOverlay={xpToastOverlay}
      objectiveProgressModal={objectiveProgressModal}
    >
      <AnimatePresence>
        {rewardPopup && (
          <motion.div
            className="gp-reward-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="gp-reward-card"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.22 }}
            >
              <BKIcon name="dailyStreak" size={42} />
              <h2>{rewardPopup.streak} in a row</h2>
              <p>+{rewardPopup.coins} coins earned</p>
              <button
                className="gp-action-button"
                type="button"
                onClick={() => {
                  playClickSound();
                  onCollectReward();
                }}
              >
                Collect
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="gp-gameplay-shell">
        <GameplayTopBar
          label="Exit"
          eyebrow="Single Player"
          title={modeTitle}
          metaLabel="Question"
          metaValue={currentRoundQuestionNumber}
          onClick={onHome}
        />

        <GameplayHud
          items={[
            { label: "Score", value: score, featured: true },
            { label: "Best", value: highScore },
            { label: "Coins", value: coins, onClick: onOpenCoinShop },
            { label: "Lives", value: lives },
          ]}
        />

        <GameplayXpMeter
          levelLabel={levelLabel}
          progressLabel={xpProgressLabel}
          progressPercent={xpProgressPercent}
          nextLabel={nextLabel}
        />

        <AnimatePresence mode="wait">
          <motion.div
            className="gp-stage"
            key={questionIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {isTimedQuestion && (
              <div
                className={`gp-timer ${
                  current.difficulty === "Very Hard" ? "very-hard" : ""
                } ${timeLeft <= 3 ? "danger" : ""}`}
              >
                {timeLeft}s
              </div>
            )}

            {isCareer ? (
              <CareerPathQuestionView question={current.question} />
            ) : (
              <section className="gp-question-card">
                <div className="gp-kicker">World Cup Challenge</div>
                <h1>{current.question}</h1>
                <span className="gp-question-card__watermark" aria-hidden="true">
                  <BKIcon name="leagues" size={72} />
                </span>
              </section>
            )}

            {isCareer || gameMode === "world-cup" ? (
              <>
                <GuessInput
                  answerType={isCareer ? "player" : "text"}
                  value={textAnswer}
                  onTextChange={onTextAnswerChange}
                  selectedPlayer={careerSelectedPlayer}
                  onSelectPlayer={onCareerPlayerSelect}
                  onSubmit={onSubmitTextAnswer}
                  placeholder={
                    gameMode === "world-cup"
                      ? "Type your answer..."
                      : "Search player or type full name..."
                  }
                  disabled={Boolean(selected)}
                  buttonLabel="Guess"
                  rowClassName={`gp-input-row ${
                    isCareer ? "gp-input-row--career" : "gp-input-row--world-cup"
                  }`}
                  inputClassName="gp-text-input"
                  buttonClassName="gp-submit-button"
                  maxSuggestions={4}
                />

                {selected && (
                  <div
                    className={`gp-feedback ${
                      isCorrectAnswer(selected, current.answer)
                        ? "correct"
                        : "wrong"
                    }`}
                  >
                    {isCorrectAnswer(selected, current.answer) ? (
                      <>Correct. {current.answer}</>
                    ) : (
                      <>Correct answer: {current.answer}</>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="gp-answer-grid">
                {current.options.map((option) => {
                  const isCorrect = option === current.answer;
                  const isChosen = selected === option;
                  const showCorrect = selected && isCorrect;
                  const showWrong = selected && isChosen && !isCorrect;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onChooseAnswer(option);
                      }}
                      className={`gp-answer-card ${
                        showCorrect ? "correct" : showWrong ? "wrong" : ""
                      }`}
                    >
                      <span>{option}</span>
                      {showCorrect && <CheckCircle2 size={24} />}
                      {showWrong && <XCircle size={24} />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="gp-xp-inline-slot">
              <AnimatePresence>
                {xpToast && xpToast.placement === "inline" && (
                  <motion.div
                    key={xpToast.key}
                    className={`gp-xp-inline-toast ${
                      xpToast.amount > 5 ? "bonus" : ""
                    }`}
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <span>XP</span>
                    <strong>+{xpToast.amount}</strong>
                    <em>{xpToast.label || "Progress"}</em>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </GameplayShell>
  );
}
