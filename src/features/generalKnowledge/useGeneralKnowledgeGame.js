import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HARD_TIME_LIMIT = 15;
const STREAK_TARGETS = [5, 10, 20, 30, 50];

function getNextStreakTarget(streak) {
  return (
    STREAK_TARGETS.find((target) => streak < target) ??
    STREAK_TARGETS[STREAK_TARGETS.length - 1]
  );
}

function getPrevStreakTarget(streak) {
  let prev = 0;

  for (const target of STREAK_TARGETS) {
    if (streak >= target) {
      prev = target;
    }
  }

  return prev;
}

export function getStreakProgress(streak) {
  const next = getNextStreakTarget(streak);
  const prev = getPrevStreakTarget(streak);

  if (streak >= STREAK_TARGETS[STREAK_TARGETS.length - 1]) {
    return 100;
  }

  const range = next - prev;
  const progress = streak - prev;

  return Math.max(0, Math.min(100, (progress / range) * 100));
}

export { getNextStreakTarget };

function getRewardForStreak(streakCount) {
  if (streakCount <= 0 || streakCount % 5 !== 0) return 0;
  if (streakCount % 50 === 0) return 1500;
  if (streakCount % 30 === 0) return 200;
  if (streakCount % 20 === 0) return 50;
  if (streakCount % 10 === 0) return 25;
  if (streakCount % 5 === 0) return 25;
  return 0;
}

function getInitialRunState(initialSnapshot) {
  return {
    questionIndex: initialSnapshot?.questionIndex || 0,
    selected: initialSnapshot?.selected || null,
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

export function useGeneralKnowledgeGame({
  questions,
  highScore,
  coins,
  runId,
  initialSnapshot,
  isAnswerCorrect,
  onCorrectAnswer,
  onHighScore,
  onCoinsChange,
  onFinish,
  playCorrectSound,
  playWrongSound,
  playCoinSound,
}) {
  const initialState = useMemo(
    () => getInitialRunState(initialSnapshot),
    [initialSnapshot]
  );
  const [questionIndex, setQuestionIndex] = useState(initialState.questionIndex);
  const [selected, setSelected] = useState(initialState.selected);
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
    current && ["Hard", "Very Hard"].includes(current.difficulty)
  );

  const snapshot = useCallback(
    (overrides = {}) => ({
      questionIndex,
      selected,
      score,
      lives,
      streak,
      revivesUsed,
      runXpSummary,
      ...overrides,
    }),
    [questionIndex, selected, score, lives, streak, revivesUsed, runXpSummary]
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
    setTimeLeft(HARD_TIME_LIMIT);
  }, [questions.length]);

  const addRunXp = useCallback((key, amount, label) => {
    if (!onCorrectAnswer({ key, amount, label })) return;

    setRunXpSummary((summary) => ({
      ...summary,
      [key.includes("streak") ? "streak" : "correct"]:
        summary[key.includes("streak") ? "streak" : "correct"] + amount,
    }));
  }, [onCorrectAnswer]);

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
        const reward = getRewardForStreak(newStreak);

        setScore(newScore);
        setStreak(newStreak);

        if (newScore > highScore) {
          onHighScore(newScore);
        }

        addRunXp(`general-correct:${Date.now()}:${questionIndex}:${newScore}`, 5, "Correct answer");

        if (newStreak === 5) {
          addRunXp(`general-streak-5:${Date.now()}:${newScore}`, 10, "Streak Bonus");
        }
        if (newStreak === 10) {
          addRunXp(`general-streak-10:${Date.now()}:${newScore}`, 25, "Streak Bonus");
        }
        if (newStreak === 20) {
          addRunXp(`general-streak-20:${Date.now()}:${newScore}`, 75, "Streak Bonus");
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
      addRunXp,
      coins,
      current,
      handleWrongAnswer,
      highScore,
      isAnswerCorrect,
      nextQuestion,
      onCoinsChange,
      onHighScore,
      playCorrectSound,
      questionIndex,
      rewardPopup,
      schedule,
      score,
      selected,
      streak,
    ]
  );

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
    score,
    lives,
    streak,
    selected,
    rewardPopup,
    timeLeft,
    isTimedQuestion,
    runXpSummary,
    chooseAnswer,
    collectReward,
    getSnapshot: snapshot,
    runId,
  };
}
