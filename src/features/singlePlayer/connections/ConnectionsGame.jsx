import { AnimatePresence, motion } from "framer-motion";
import BKIcon from "../../../components/BKIcon";
import { ScreenTransition } from "../shared/SinglePlayerFrame";
import {
  GameplayShell,
  GameplayTopBar,
} from "../../gameplay/GameplayShell";
import useConnectionsRuntime from "./useConnectionsRuntime";

export default function ConnectionsGame({
  puzzle,
  rewardModal,
  rewardOverlay,
  coinShopModal,
  dailyRewardMeterModal,
  coinRewardToastOverlay,
  xpToastOverlay,
  stadiumBackgroundImage,
  onBack,
  onComplete,
  onTryNewPuzzle,
  playClickSound,
  playCorrectSound,
  playWrongSound,
}) {
  const {
    solved,
    visibleTiles,
    selected,
    mistakes,
    mistakesLeft,
    feedback,
    shake,
    gameComplete,
    gameOver,
    toggleTile,
    clearSelection,
    shuffleTiles,
    submitSelection,
  } = useConnectionsRuntime({
    puzzle,
    rewardModal,
    onComplete,
    playClickSound,
    playCorrectSound,
    playWrongSound,
  });

  if (!puzzle) return null;

  const revealedGroups = puzzle.groups.map((group, index) => ({
    ...group,
    index,
    solvedItems: group.items,
  }));
  const groupsToShow = gameOver ? revealedGroups : solved;

  return (
    <GameplayShell
      theme="connections"
      className="gp-connections-screen"
      backgroundImage={stadiumBackgroundImage}
      coinShopModal={coinShopModal}
      dailyRewardMeterModal={dailyRewardMeterModal}
      coinRewardToastOverlay={coinRewardToastOverlay}
      xpToastOverlay={!rewardModal ? xpToastOverlay : null}
    >
      {rewardOverlay}
      <ScreenTransition className="gp-gameplay-shell gp-connections-shell">
        <GameplayTopBar
          label="Back"
          eyebrow="Single Player"
          title="Connections"
          metaLabel="Mistakes"
          metaValue={`${mistakesLeft} left`}
          onClick={onBack}
        />

        <div className="gp-puzzle-card gp-connections-card">
          <div className="gp-connections-header">
            <div>
              <div className="gp-connections-title-row">
                <div className="gp-kicker">Pattern board</div>
                <div className={`gp-connections-difficulty ${puzzle.difficulty?.toLowerCase() || "easy"}`}>
                  {puzzle.difficulty || "Easy"}
                </div>
              </div>
              <h1>Connections</h1>
              <p>Find the 4 football groups</p>
            </div>

            <div className="gp-connections-mistakes">
              <span>Mistakes</span>
              <strong>
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={index}
                    className={index < mistakes ? "mistake-used" : ""}
                  >
                    <BKIcon name="lives" size={16} />
                  </span>
                ))}
              </strong>
              <small>{mistakesLeft} left</small>
            </div>
          </div>

          <div className="gp-connections-solved-list">
            <AnimatePresence>
              {groupsToShow.map((group) => (
                <motion.div
                  key={group.category}
                  className={`gp-connections-solved-card ${group.color}`}
                  initial={{ opacity: 0, scale: 0.88, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.28 }}
                >
                  <strong>{group.category}</strong>
                  <span>{group.solvedItems.join(" \u2022 ")}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="gp-connections-feedback-slot">
            <AnimatePresence mode="wait">
              {feedback && (
                <motion.div
                  key={`${feedback.type}-${shake}`}
                  className={`gp-feedback ${feedback.type}`}
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    x: feedback.type === "wrong" ? [0, -5, 5, -3, 3, 0] : 0,
                  }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                >
                  {feedback.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!gameComplete && !gameOver && (
            <motion.div
              className="gp-connections-grid"
              key={shake}
              animate={feedback?.type === "wrong" ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.28 }}
            >
              {visibleTiles.map((tile) => {
                const selectedOrder = selected.indexOf(tile.id);
                const selectedTile = selectedOrder !== -1;

                return (
                  <button
                    key={tile.id}
                    className={`gp-connections-tile ${
                      selectedTile ? "selected selected-strong" : ""
                    }`}
                    onClick={() => toggleTile(tile)}
                  >
                    {selectedTile && (
                      <span className="gp-connections-selection-index">
                        {selectedOrder + 1}
                      </span>
                    )}

                    <span>{tile.item}</span>
                  </button>
                );
              })}
            </motion.div>
          )}

          {gameOver && (
            <motion.div
              className="gp-connections-end-card"
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <strong>Game Over</strong>
              <span>Categories revealed. Run it back.</span>
              <button onClick={onTryNewPuzzle}>Try New Puzzle</button>
            </motion.div>
          )}

          {!gameComplete && !gameOver && (
            <div className="gp-connections-actions">
              <button
                className="gp-secondary-button"
                onClick={clearSelection}
                disabled={selected.length === 0}
              >
                Deselect
              </button>

              <button
                className="gp-secondary-button"
                onClick={shuffleTiles}
              >
                Shuffle
              </button>

              <button
                className="gp-action-button"
                onClick={submitSelection}
                disabled={selected.length !== 4}
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </ScreenTransition>
    </GameplayShell>
  );
}
