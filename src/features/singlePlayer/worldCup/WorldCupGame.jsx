import ClassicQuizGame from "../quiz/ClassicQuizGame";
import { useClassicQuizRuntime } from "../quiz/useClassicQuizRuntime";

export default function WorldCupGame({
  questions,
  coins,
  highScore,
  playerLevel,
  xpProgressPercent,
  xpProgressLabel,
  xpToast,
  xpToastOverlay,
  objectiveProgressModal,
  initialSnapshot,
  isAnswerCorrect,
  onCorrectAnswer,
  onCoinsChange,
  onFinish,
  onExit,
  onOpenCoinShop,
  playClickSound,
  playCorrectSound,
  playWrongSound,
  playCoinSound,
  coinShopModal,
  dailyRewardMeterModal,
  quizBackgroundImage,
}) {
  const game = useClassicQuizRuntime({
    mode: "world-cup",
    questions,
    coins,
    initialSnapshot,
    isAnswerCorrect,
    onCorrectAnswer,
    onCoinsChange,
    onFinish,
    playCorrectSound,
    playWrongSound,
    playCoinSound,
  });

  if (!game.current) return null;

  return (
    <ClassicQuizGame
      gameMode="world-cup"
      current={game.current}
      questionIndex={game.questionIndex}
      currentRoundQuestionNumber={game.currentRoundQuestionNumber}
      score={game.score}
      highScore={highScore}
      coins={coins}
      lives={game.lives}
      selected={game.selected}
      textAnswer={game.textAnswer}
      careerSelectedPlayer={game.selectedPlayer}
      isTimedQuestion={game.isTimedQuestion}
      timeLeft={game.timeLeft}
      playerLevel={playerLevel}
      xpProgressPercent={xpProgressPercent}
      xpProgressLabel={xpProgressLabel}
      xpToast={xpToast}
      rewardPopup={game.rewardPopup}
      coinShopModal={coinShopModal}
      dailyRewardMeterModal={dailyRewardMeterModal}
      xpToastOverlay={xpToastOverlay}
      objectiveProgressModal={objectiveProgressModal}
      quizBackgroundImage={quizBackgroundImage}
      onHome={() => {
        playClickSound();
        onExit(game.getSnapshot());
      }}
      onOpenCoinShop={onOpenCoinShop}
      onCollectReward={game.collectReward}
      onTextAnswerChange={game.setTextAnswer}
      onCareerPlayerSelect={game.setSelectedPlayer}
      onSubmitTextAnswer={game.submitTextAnswer}
      onChooseAnswer={game.chooseAnswer}
      isCorrectAnswer={isAnswerCorrect}
      playClickSound={playClickSound}
    />
  );
}
