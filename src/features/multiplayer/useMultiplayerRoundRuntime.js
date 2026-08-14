import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeAnswerText } from "../../lib/playerAnswerMatcher";
import { getMultiplayerQuestionsByIds } from "../../multiplayerQuestionBank";

const TIMEOUT_VALUE = "__time_up__";

function hashSeed(seedText = "") {
  let hash = 2166136261;
  for (const char of String(seedText)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seedText = "") {
  let seed = hashSeed(seedText);
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function shuffleWithSeed(items = [], seedText = "") {
  return [...items]
    .map((item, index) => ({
      item,
      score: seededUnit(`${seedText}:${index}:${item}`),
    }))
    .sort((a, b) => a.score - b.score || String(a.item).localeCompare(String(b.item)))
    .map(({ item }) => item);
}

function normalizeAnswer(text) {
  return normalizeAnswerText(text);
}

function isCorrectAnswer(input, correctAnswer) {
  return normalizeAnswer(input) === normalizeAnswer(correctAnswer);
}

function withStableOptions(question, seedText) {
  if (!Array.isArray(question?.options)) return question;
  if (!question.options.includes(question.answer)) return question;

  return {
    ...question,
    options: shuffleWithSeed(question.options, `${seedText}:${question.multiplayerId || question.id}`),
  };
}

export default function useMultiplayerRoundRuntime({
  round,
  timeLimit,
  onSubmitScore,
  onRuntimeError,
  playCorrectSound,
  playWrongSound,
}) {
  const questionIds = Array.isArray(round?.question_ids)
    ? round.question_ids.filter(Boolean)
    : [];
  const questionKey = questionIds.join("|");
  const optionSeed = `${round?.id || "round"}:${round?.round_number || 1}:${questionKey}`;
  const completionRef = useRef(false);
  const transitionTimeoutRef = useRef(null);
  const [questions, setQuestions] = useState([]);
  const [loadStatus, setLoadStatus] = useState(questionIds.length ? "loading" : "idle");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [done, setDone] = useState(false);
  const currentQuestion = questions[index] || null;

  useEffect(() => {
    let cancelled = false;
    const ids = questionKey ? questionKey.split("|").filter(Boolean) : [];

    if (!ids.length) {
      return undefined;
    }

    getMultiplayerQuestionsByIds(ids)
      .then((roundQuestions) => {
        if (cancelled) return;
        if (roundQuestions.length !== ids.length) {
          setQuestions([]);
          setLoadStatus("error");
          onRuntimeError?.("Round questions are not ready");
          return;
        }

        setQuestions(
          roundQuestions.map((question) => withStableOptions(question, optionSeed))
        );
        setLoadStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setQuestions([]);
        setLoadStatus("error");
        onRuntimeError?.("Round questions are not ready");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(transitionTimeoutRef.current);
    };
  }, [optionSeed, questionKey, onRuntimeError]);

  const completeRound = useCallback((finalScore) => {
    if (completionRef.current) return;
    completionRef.current = true;
    setDone(true);
    onSubmitScore?.(finalScore);
  }, [onSubmitScore]);

  const advanceAfterAnswer = useCallback((nextScore, delayMs) => {
    window.clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = window.setTimeout(() => {
      if (index >= questions.length - 1) {
        completeRound(nextScore);
        return;
      }

      setIndex((value) => value + 1);
      setSelected(null);
      setTimeLeft(timeLimit);
    }, delayMs);
  }, [completeRound, index, questions.length, timeLimit]);

  useEffect(() => {
    if (loadStatus !== "ready" || done || selected || !currentQuestion) return undefined;

    const timer = window.setTimeout(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          setSelected(TIMEOUT_VALUE);
          advanceAfterAnswer(score, 950);
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [advanceAfterAnswer, currentQuestion, done, loadStatus, score, selected, timeLeft]);

  const chooseAnswer = (option) => {
    if (loadStatus !== "ready" || selected || done || !currentQuestion) return;

    setSelected(option);
    const correct = isCorrectAnswer(option, currentQuestion.answer);
    const nextScore = correct ? score + 1 : score;

    if (correct) {
      setScore(nextScore);
      playCorrectSound?.();
    } else {
      playWrongSound?.();
    }

    advanceAfterAnswer(nextScore, 850);
  };

  const saveAndExit = () => {
    completeRound(score);
  };

  return {
    TIMEOUT_VALUE,
    questions,
    loadStatus,
    currentQuestion,
    index,
    selected,
    score,
    timeLeft,
    done,
    chooseAnswer,
    saveAndExit,
  };
}
