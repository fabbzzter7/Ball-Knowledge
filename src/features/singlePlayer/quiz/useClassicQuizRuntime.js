import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HARD_TIME_LIMIT = 15;

function getRewardForScore(newScore) {
  if (newScore % 50 === 0) return 1500;
  if (newScore % 30 === 0) return 200;
  if (newScore % 20 === 0) return 50;
  if (newScore % 10 === 0) return 25;
  if (newScore % 5 === 0) return 25;
  return 0;
}

function getInitialRunState(initialSnapshot) {
  return {
    questionIndex: initialSnapshot?.questionIndex || 0,
    selected: initialSnapshot?.selected || null,
    textAnswer: initialSnapshot?.textAnswer || "",
    selectedPlayer: initialSnapshot?.selectedPlayer || null,
    score: initialSnapshot?.score || 0,
    lives: initialSnapshot?.lives ?? 3,
    streak: initialSnapshot?.streak || 0,
    revivesUsed: initialSnapshot?.revivesUsed || 0,
    runXpSummary: initialSnapshot?.runXpSummary || {
      correct: 0,
      streak: 0,
      highscore: 0,
    },
  };
}

export function useClassicQuizRuntime({
  mode,
  questions,
  initialSnapshot,
  isAnswerCorrect,
  onCorrectAnswer,
  onCoinsChange,
  onFinish,
  timerEnabled = true,
  playCorrectSound,
  playWrongSound,
  playCoinSound,
  coins,
}) {
  const initialState = useMemo(
    () => getInitialRunState(initialSnapshot),
    [initialSnapshot]
  );
  const [questionIndex, setQuestionIndex] = useState(initialState.questionIndex);
  const [selected, setSelected] = useState(initialState.selected);
  const [textAnswer, setTextAnswer] = useState(initialState.textAnswer);
  const [selectedPlayer, setSelectedPlayer] = useState(initialState.selectedPlayer || null);
  const [score, setScore] = useState(initialState.score);
  const [lives, setLives] = useState(initialState.lives);
  const [streak, setStreak] = useState(initialState.streak);
  const [revivesUsed] = useState(initialState.revivesUsed);
  const [runXpSummary, setRunXpSummary] = useState(initialState.runXpSummary);
  const [rewardPopup, setRewardPopup] = useState(null);
  const [timeLeft, setTimeLeft] = useState(HARD_TIME_LIMIT);
  const timeoutRefs = useRef([]);
  const finishRef = useRef(onFinish);
  const wrongAnswerRef = useRef(null);

  const current = questions[questionIndex] || null;
  const isTimedQuestion = Boolean(
    timerEnabled && current && ["Hard", "Very Hard"].includes(current.difficulty)
  );

  const snapshot = useCallback(
    (overrides = {}) => ({
      mode,
      questionIndex,
      selected,
      textAnswer,
      selectedPlayer,
      score,
      lives,
      streak,
      revivesUsed,
      runXpSummary,
      ...overrides,
    }),
    [
      lives,
      mode,
      questionIndex,
      revivesUsed,
      runXpSummary,
      score,
      selected,
      selectedPlayer,
      streak,
      textAnswer,
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

  const finishRun = useCallback(
    (overrides = {}) => {
      finishRef.current(snapshot(overrides));
    },
    [snapshot]
  );

  const nextQuestion = useCallback(() => {
    setQuestionIndex((index) => (questions.length ? (index + 1) % questions.length : 0));
    setSelected(null);
    setTextAnswer("");
    setSelectedPlayer(null);
    setTimeLeft(HARD_TIME_LIMIT);
  }, [questions.length]);

  const handleWrongAnswer = useCallback(
    (correctAnswer) => {
      const newLives = Math.max(lives - 1, 0);
      setStreak(0);
      setLives(newLives);
      playWrongSound();

      if (newLives <= 0) {
        setSelected(correctAnswer);
        schedule(
          () =>
            finishRun({
              selected: correctAnswer,
              textAnswer: "",
              selectedPlayer: null,
              lives: newLives,
              streak: 0,
            }),
          1500
        );
        return;
      }

      schedule(nextQuestion, 1200);
    },
    [finishRun, lives, nextQuestion, playWrongSound, schedule]
  );

  const chooseAnswer = useCallback(
    (option) => {
      if (!current || selected || rewardPopup) return;

      setSelected(option);

      if (isAnswerCorrect(option, current.answer)) {
        const newScore = score + 1;
        const newStreak = streak + 1;
        const reward = getRewardForScore(newScore);

        setScore(newScore);
        setStreak(newStreak);

        if (
          onCorrectAnswer({
            key: `${mode}-correct:${Date.now()}:${questionIndex}:${newScore}`,
            amount: 5,
            label: "Correct answer",
          })
        ) {
          setRunXpSummary((summary) => ({
            ...summary,
            correct: summary.correct + 5,
          }));
        }

        if (reward > 0) {
          onCoinsChange(coins + reward);
          setRewardPopup({
            streak: newStreak,
            coins: reward,
            onCollect: "next-question",
          });
          playCorrectSound();
          return;
        }

        playCorrectSound();
        schedule(nextQuestion, 950);
        return;
      }

      handleWrongAnswer(current.answer);
    },
    [
      coins,
      current,
      handleWrongAnswer,
      isAnswerCorrect,
      mode,
      nextQuestion,
      onCoinsChange,
      onCorrectAnswer,
      playCorrectSound,
      questionIndex,
      rewardPopup,
      schedule,
      score,
      selected,
      streak,
    ]
  );

  const submitTextAnswer = useCallback((resolveSubmittedAnswer) => {
    if ((!textAnswer.trim() && !selectedPlayer) || selected) return;

    const submittedAnswer = typeof resolveSubmittedAnswer === "function"
      ? resolveSubmittedAnswer({ textAnswer, selectedPlayer, current })
      : textAnswer;

    chooseAnswer(submittedAnswer);
    setTextAnswer("");
    setSelectedPlayer(null);
  }, [chooseAnswer, current, selected, selectedPlayer, textAnswer]);

  const collectReward = useCallback(() => {
    const action = rewardPopup?.onCollect;
    setRewardPopup(null);
    playCoinSound();

    if (action === "next-question") {
      nextQuestion();
    }
  }, [nextQuestion, playCoinSound, rewardPopup]);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    wrongAnswerRef.current = handleWrongAnswer;
  }, [handleWrongAnswer]);

  useEffect(() => {
    const timerActive = isTimedQuestion && !selected && !rewardPopup;

    if (!timerActive || !current) return undefined;

    const interval = window.setInterval(() => {
      setTimeLeft((time) => {
        if (time <= 1) {
          window.clearInterval(interval);
          wrongAnswerRef.current?.(current.answer);
          return 0;
        }

        return time - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [current, isTimedQuestion, rewardPopup, selected]);

  useEffect(
    () => () => {
      timeoutRefs.current.forEach((timeout) => window.clearTimeout(timeout));
      timeoutRefs.current = [];
    },
    []
  );

  return {
    current,
    questionIndex,
    currentRoundQuestionNumber: (questionIndex % 10) + 1,
    selected,
    textAnswer,
    selectedPlayer,
    score,
    lives,
    streak,
    revivesUsed,
    runXpSummary,
    rewardPopup,
    timeLeft,
    isTimedQuestion,
    setTextAnswer,
    setSelectedPlayer,
    chooseAnswer,
    submitTextAnswer,
    collectReward,
    getSnapshot: snapshot,
  };
}
