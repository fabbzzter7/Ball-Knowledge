import { useCallback } from "react";
import ClassicQuizGame from "../quiz/ClassicQuizGame";
import { useClassicQuizRuntime } from "../quiz/useClassicQuizRuntime";

export default function CareerPathGame({
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
  isCorrectPlayerAnswer,
  isTypedPlayerAnswerCorrect,
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
    mode: "career",
    questions,
    coins,
    initialSnapshot,
    isAnswerCorrect,
    onCorrectAnswer,
    onCoinsChange,
    onFinish,
    timerEnabled: false,
    playCorrectSound,
    playWrongSound,
    playCoinSound,
  });

  const resolveSubmittedAnswer = useCallback(
    ({ textAnswer, selectedPlayer, current }) => {
      const typedPlayerMatch =
        !selectedPlayer &&
        isTypedPlayerAnswerCorrect({
          typedAnswer: textAnswer,
          correctAnswer: current?.answer,
        });

      return (selectedPlayer && isCorrectPlayerAnswer(selectedPlayer, current?.answer)) ||
        typedPlayerMatch
        ? current.answer
        : selectedPlayer?.name || textAnswer;
    },
    [isCorrectPlayerAnswer, isTypedPlayerAnswerCorrect]
  );

  if (!game.current) return null;

  return (
    <ClassicQuizGame
      gameMode="career"
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
      onSubmitTextAnswer={() => game.submitTextAnswer(resolveSubmittedAnswer)}
      onChooseAnswer={game.chooseAnswer}
      isCorrectAnswer={isAnswerCorrect}
      playClickSound={playClickSound}
    />
  );
}
