import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getInitialState(initialSnapshot) {
  return {
    clueIndex: initialSnapshot?.clueIndex || 0,
    input: initialSnapshot?.input || "",
    selectedPlayer: initialSnapshot?.selectedPlayer || null,
    score: initialSnapshot?.score || 0,
    streak: initialSnapshot?.streak || 0,
    feedback: initialSnapshot?.feedback || null,
    shake: initialSnapshot?.shake || 0,
    gameOver: Boolean(initialSnapshot?.gameOver),
  };
}

export default function useWhoAmIRuntime({
  question,
  dateKey,
  initialSnapshot,
  isCorrectAnswer,
  onSolved,
  onMissed,
  playCorrectSound,
  playWrongSound,
}) {
  const initialState = useMemo(
    () => getInitialState(initialSnapshot),
    [initialSnapshot]
  );
  const [clueIndex, setClueIndex] = useState(initialState.clueIndex);
  const [input, setInput] = useState(initialState.input);
  const [selectedPlayer, setSelectedPlayer] = useState(initialState.selectedPlayer);
  const [score, setScore] = useState(initialState.score);
  const [streak, setStreak] = useState(initialState.streak);
  const [feedback, setFeedback] = useState(initialState.feedback);
  const [shake, setShake] = useState(initialState.shake);
  const [gameOver, setGameOver] = useState(initialState.gameOver);
  const timeoutRefs = useRef([]);

  const visibleClues = useMemo(
    () => (question ? question.clues.slice(0, clueIndex + 1) : []),
    [clueIndex, question]
  );
  const pointsAvailable = Math.max(1, 10 - clueIndex);

  const snapshot = useCallback(
    (overrides = {}) => ({
      mode: "whoAmI",
      questionId: question?.id || null,
      dateKey,
      clueIndex,
      input,
      selectedPlayer,
      score,
      streak,
      feedback,
      shake,
      gameOver,
      ...overrides,
    }),
    [
      clueIndex,
      dateKey,
      feedback,
      gameOver,
      input,
      question?.id,
      score,
      selectedPlayer,
      shake,
      streak,
    ]
  );

  const schedule = useCallback((callback, delay) => {
    const timeout = window.setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter((item) => item !== timeout);
      callback();
    }, delay);
    timeoutRefs.current.push(timeout);
    return timeout;
  }, []);

  const moveToGameOver = useCallback(() => {
    setGameOver(true);
  }, []);

  const submitGuess = useCallback(
    (playerOverride = null) => {
      if (!question || feedback?.locked || gameOver) return;

      const guessedPlayer = playerOverride || selectedPlayer;
      const trimmedGuess = input.trim();
      if (!trimmedGuess && !guessedPlayer) return;

      if (isCorrectAnswer(guessedPlayer, question, trimmedGuess)) {
        const points = pointsAvailable;
        const clueNumber = clueIndex + 1;
        const earlyBonus = clueNumber <= 3 ? 50 : clueNumber <= 6 ? 25 : 0;
        const nextScore = score + points;
        const nextStreak = streak + 1;

        setScore(nextScore);
        setStreak(nextStreak);
        onSolved({
          mode: "whoAmI",
          question,
          dateKey,
          score: nextScore,
          streak: nextStreak,
          cluesUsed: clueNumber,
          points,
          earlyBonus,
        });
        setFeedback({
          type: "correct",
          text: `Correct! +${points} points`,
          locked: true,
        });
        setInput("");
        setSelectedPlayer(null);
        playCorrectSound();
        schedule(moveToGameOver, 1150);
        return;
      }

      setShake((value) => value + 1);
      setInput("");
      setSelectedPlayer(null);

      if (clueIndex < question.clues.length - 1) {
        setClueIndex((index) => index + 1);
        setFeedback({ type: "wrong", text: "Not yet. New clue unlocked." });
        playWrongSound();
        schedule(() => setFeedback(null), 900);
        return;
      }

      setStreak(0);
      setFeedback({
        type: "reveal",
        text: `Answer: ${question.answer}`,
        locked: true,
      });
      onMissed({
        mode: "whoAmI",
        question,
        dateKey,
        score,
        streak: 0,
        cluesUsed: question.clues.length,
      });
      playWrongSound();
      schedule(moveToGameOver, 1600);
    },
    [
      clueIndex,
      dateKey,
      feedback?.locked,
      gameOver,
      input,
      isCorrectAnswer,
      moveToGameOver,
      onMissed,
      onSolved,
      playCorrectSound,
      playWrongSound,
      pointsAvailable,
      question,
      schedule,
      score,
      selectedPlayer,
      streak,
    ]
  );

  useEffect(
    () => () => {
      timeoutRefs.current.forEach((timeout) => window.clearTimeout(timeout));
      timeoutRefs.current = [];
    },
    []
  );

  return {
    clueIndex,
    input,
    selectedPlayer,
    score,
    streak,
    feedback,
    shake,
    gameOver,
    visibleClues,
    pointsAvailable,
    setInput,
    setSelectedPlayer,
    submitGuess,
    getSnapshot: snapshot,
  };
}
