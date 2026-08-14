import { AnimatePresence, motion } from "framer-motion";
import BKIcon from "../../../components/BKIcon";
import GuessInput from "../../../components/GuessInput";
import { ScreenTransition } from "../shared/SinglePlayerFrame";
import {
  GameplayShell,
  GameplayTopBar,
} from "../../gameplay/GameplayShell";
import useWhoAmIRuntime from "./useWhoAmIRuntime";

export default function WhoAmIGame({
  question,
  dateLabel,
  todayKey,
  dateKey,
  initialSnapshot,
  coinShopModal,
  dailyRewardMeterModal,
  coinRewardToastOverlay,
  xpToastOverlay,
  stadiumBackgroundImage,
  isCorrectAnswer,
  onSolved,
  onMissed,
  onBack,
  onStartDate,
  playClickSound,
  playCorrectSound,
  playWrongSound,
}) {
  const game = useWhoAmIRuntime({
    question,
    dateKey,
    initialSnapshot,
    isCorrectAnswer,
    onSolved,
    onMissed,
    playCorrectSound,
    playWrongSound,
  });

  if (!question) return null;

  return (
    <GameplayShell
      theme="whoami"
      backgroundImage={stadiumBackgroundImage}
      coinShopModal={coinShopModal}
      dailyRewardMeterModal={dailyRewardMeterModal}
      coinRewardToastOverlay={coinRewardToastOverlay}
      xpToastOverlay={xpToastOverlay}
    >
      <ScreenTransition className="gp-gameplay-shell gp-whoami-shell">
        <GameplayTopBar
          label="Back"
          eyebrow="Daily Puzzle"
          title="Who Am I"
          metaLabel="Clue"
          metaValue={`${game.clueIndex + 1}/10`}
          onClick={() => {
            playClickSound();
            onBack(game.getSnapshot());
          }}
        />

        <motion.div
          className={`gp-mystery-card gp-whoami-card ${game.shake ? "shake" : ""}`}
          key={question.id}
          animate={game.shake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="gp-whoami-top">
            <div>
              <div className="gp-kicker">Mystery player</div>
              <h1>Daily Who Am I</h1>
            </div>
            <div className={`gp-whoami-difficulty ${question.difficulty.toLowerCase()}`}>
              {question.difficulty}
            </div>
          </div>

          <div className="gp-whoami-date-row">
            <button onClick={() => onStartDate(-1)}>Previous Day</button>
            <strong>{dateLabel}</strong>
            <button onClick={() => onStartDate(0)} disabled={dateKey >= todayKey}>
              Today
            </button>
            <button onClick={() => onStartDate(1)} disabled={dateKey >= todayKey}>
              Next Day
            </button>
          </div>

          <div className="gp-whoami-hud">
            <span>Score <strong>{game.score}</strong></span>
            <span>Streak <strong>{game.streak}</strong></span>
            <span>Clues <strong>{game.clueIndex + 1}/10</strong></span>
          </div>

          <div className="gp-whoami-mystery">
            <div className="gp-whoami-silhouette">
              <BKIcon name="whoAmI" size={64} />
            </div>
            <div>
              <span>Clue {game.clueIndex + 1} / 10</span>
              <strong>{game.pointsAvailable} points available</strong>
            </div>
          </div>

          <div className="gp-whoami-clues">
            <AnimatePresence initial={false}>
              {game.visibleClues.map((clue, index) => (
                <motion.div
                  className={`gp-whoami-clue ${index === game.clueIndex ? "latest" : ""}`}
                  key={`${question.id}-${index}`}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <span>{index + 1}</span>
                  <p>{clue}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {game.feedback && (
              <motion.div
                className={`gp-feedback ${game.feedback.type}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
              >
                {game.feedback.text}
              </motion.div>
            )}
          </AnimatePresence>

          {game.gameOver ? (
            <motion.div
              className="gp-whoami-gameover"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
            >
              <strong>Game Over</strong>
              <span>Final score: {game.score}</span>
              <button onClick={() => onStartDate(null)}>Play Again</button>
            </motion.div>
          ) : (
            <GuessInput
              answerType="player"
              value={game.input}
              onTextChange={game.setInput}
              selectedPlayer={game.selectedPlayer}
              onSelectPlayer={game.setSelectedPlayer}
              onSubmit={() => {
                playClickSound();
                game.submitGuess();
              }}
              placeholder="Search player or type full name..."
              disabled={Boolean(game.feedback?.locked)}
              buttonLabel="Guess"
              rowClassName="gp-input-row gp-whoami-answer-row"
              inputClassName="gp-text-input"
              buttonClassName="gp-submit-button"
              maxSuggestions={4}
              autoFocus
            />
          )}
        </motion.div>
      </ScreenTransition>
    </GameplayShell>
  );
}
