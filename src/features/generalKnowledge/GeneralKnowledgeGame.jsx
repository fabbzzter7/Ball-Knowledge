import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import GameTopNav from "../../components/GameTopNav";
import { CoinEmblem } from "../../components/RewardEmblems";
import quizBg from "../../assets/quiz-bg.png";
import AnswerGrid from "./AnswerGrid";
import QuestionCard from "./QuestionCard";
import QuizHud from "./QuizHud";
import QuizTimer from "./QuizTimer";
import "./GeneralKnowledgeGame.css";
import { useGeneralKnowledgeGame } from "./useGeneralKnowledgeGame";

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function InlineXpToast({ xpToast, isSuppressed = false }) {
  return (
    <div className="gk-xp-float-slot" aria-live="polite">
      <AnimatePresence>
        {xpToast && xpToast.placement === "inline" && !isSuppressed && (
          <motion.div
            key={xpToast.key}
            className={`gk-xp-float ${
              xpToast.amount > 5 ? "bonus" : ""
            }`}
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [8, 0, -7, -12],
              scale: [0.96, 1, 1, 0.98],
            }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          >
            <strong>+{xpToast.amount} XP</strong>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function XpProgressMeter({
  playerLevel,
  xpProgressPercent,
  xpProgressLabel,
}) {
  const progress = clampProgress(xpProgressPercent);
  const levelLabel = playerLevel?.levelNumber
    ? `LVL ${playerLevel.levelNumber}`
    : "LEVEL";
  const valueLabel = xpProgressLabel || "Progress";
  const nextLabel = playerLevel?.next?.name
    ? `Next: ${playerLevel.next.name}`
    : playerLevel?.name
    ? `${playerLevel.name}`
    : "Max level";

  return (
    <section className="gk-xp-meter" aria-label="Level progress">
      <div className="gk-xp-meter__top">
        <strong>{levelLabel}</strong>
        <span>{valueLabel}</span>
      </div>

      <div className="gk-xp-meter__rail" aria-hidden="true">
        <div
          className="gk-xp-meter__fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <small>{nextLabel}</small>
    </section>
  );
}

function MilestoneReward({ reward, onContinue }) {
  if (!reward) return null;

  return (
    <motion.div
      className="gk-milestone-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gk-milestone-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="gk-milestone-card"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="gk-milestone-icon" aria-hidden="true">
          <Trophy size={34} />
        </span>

        <span className="gk-milestone-eyebrow">Milestone</span>

        <motion.h2
          id="gk-milestone-title"
          initial={{ scale: 0.94 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {reward.streak} IN A ROW
        </motion.h2>

        <p>You're heating up.</p>

        {reward.coins > 0 && (
          <motion.div
            className="gk-milestone-reward"
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.22, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <span aria-hidden="true"><CoinEmblem size={22} /></span>
            <strong>+{reward.coins} Coins</strong>
          </motion.div>
        )}

        <button
          type="button"
          className="gk-milestone-action"
          onClick={onContinue}
          autoFocus
        >
          Collect
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function GeneralKnowledgeGame({
  questions,
  highScore,
  coins,
  playerLevel,
  xpProgressPercent,
  xpProgressLabel,
  xpToast,
  xpToastOverlay,
  objectiveProgressModal,
  initialSnapshot,
  runId,
  isAnswerCorrect,
  onCorrectAnswer,
  onHighScore,
  onCoinsChange,
  onFinish,
  onExit,
  playClickSound,
  playCorrectSound,
  playWrongSound,
  playCoinSound,
  coinShopModal,
  dailyRewardMeterModal,
}) {
  const handleFinish = useCallback(
    (snapshot) => {
      onFinish(snapshot);
    },
    [onFinish]
  );

  const game = useGeneralKnowledgeGame({
    questions,
    highScore,
    coins,
    runId,
    initialSnapshot,
    isAnswerCorrect,
    onCorrectAnswer,
    onHighScore,
    onCoinsChange,
    onFinish: handleFinish,
    playCorrectSound,
    playWrongSound,
    playCoinSound,
  });

  if (!game.current) {
    return null;
  }

  return (
    <div
      className="fullscreen-bg gk-game scrollable-game-screen"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(2, 12, 22, 0.5), rgba(0,0,0,0.68)), url(${quizBg})`,
      }}
    >
      {coinShopModal}
      {dailyRewardMeterModal}
      {xpToastOverlay}
      {objectiveProgressModal}
      <AnimatePresence>
        {game.rewardPopup && (
          <MilestoneReward
            reward={game.rewardPopup}
            onContinue={() => {
              playClickSound();
              game.collectReward();
            }}
          />
        )}
      </AnimatePresence>

      <div className="gk-gameplay-shell">
        <div className="gk-topbar">
          <GameTopNav
            className="gk-exit-button"
            label="Exit"
            variant="back"
            onClick={() => {
              playClickSound();
              onExit(game.getSnapshot());
            }}
          />

          <div className="gk-mode-meta">
            <span>Live Quiz</span>
            <strong>General Knowledge</strong>
          </div>

          <div className="gk-question-meta">
            <span>Question</span>
            <strong>{game.questionIndex + 1}</strong>
          </div>
        </div>

        <QuizHud
          score={game.score}
          highScore={highScore}
          lives={game.lives}
          streak={game.streak}
        />

        <AnimatePresence mode="wait">
          <motion.div
            className="gk-question-stage"
            key={game.questionIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {game.isTimedQuestion && (
              <QuizTimer
                difficulty={game.current.difficulty}
                timeLeft={game.timeLeft}
              />
            )}

            <QuestionCard
              question={game.current.question}
              category={game.current.category}
            />

            <AnswerGrid
              options={game.current.options}
              answer={game.current.answer}
              selected={game.selected}
              onChoose={game.chooseAnswer}
              onPlayClick={playClickSound}
            />

            <div className="gk-footer-stats">
              <div>
                <span>Best run</span>
                <strong>{highScore} correct</strong>
              </div>
              <div>
                <span>Current</span>
                <strong>{game.score} correct</strong>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="gk-bottom-rewards">
          <InlineXpToast
            xpToast={xpToast}
            isSuppressed={Boolean(game.rewardPopup)}
          />
          <XpProgressMeter
            playerLevel={playerLevel}
            xpProgressPercent={xpProgressPercent}
            xpProgressLabel={xpProgressLabel}
          />
        </div>
      </div>
    </div>
  );
}
