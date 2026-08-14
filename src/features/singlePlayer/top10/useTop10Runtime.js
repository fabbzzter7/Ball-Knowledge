import { useEffect, useRef, useState } from "react";
import { findMatchingAnswer } from "../../../lib/playerAnswerMatcher";

const DAILY_SCAN_STEP_MS = 210;
const REWARD_PER_CORRECT = 15;

function isPlayerLike(value) {
  return Boolean(value && typeof value === "object" && value.name);
}

export default function useTop10Runtime({
  answers,
  targetCount,
  unavailable,
  blocked,
  getAnswerKey,
  onAnswerFound,
  onFinished,
  playCorrectSound,
  playWrongSound,
}) {
  const [foundAnswers, setFoundAnswers] = useState([]);
  const [input, setInput] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [reveal, setReveal] = useState(null);
  const [celebratedAnswer, setCelebratedAnswer] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const timersRef = useRef([]);
  const intervalsRef = useRef([]);
  const finishedRef = useRef(false);

  const clearRuntimeTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    intervalsRef.current.forEach((interval) => window.clearInterval(interval));
    timersRef.current = [];
    intervalsRef.current = [];
  };

  useEffect(() => clearRuntimeTimers, []);

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== timer);
      callback();
    }, delay);
    timersRef.current.push(timer);
    return timer;
  };

  const finish = (snapshot) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished?.(snapshot);
  };

  const submitAnswer = (playerOverride = null) => {
    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : selectedPlayer;
    const guessText = guessedPlayer?.name || input.trim();

    if (!guessText || unavailable || blocked || isRevealing) return;

    setCelebratedAnswer(null);

    const matchedAnswer = findMatchingAnswer({
      typedAnswer: guessText,
      selectedPlayer: guessedPlayer,
      answers,
    });

    if (matchedAnswer && !foundAnswers.includes(matchedAnswer)) {
      const rank = answers.indexOf(matchedAnswer) + 1;
      let displayRank = answers.length;

      setInput("");
      setSelectedPlayer(null);
      setIsRevealing(true);
      setReveal({
        type: "correct",
        phase: "scan",
        answer: matchedAnswer,
        rank,
        displayRank,
      });

      const interval = window.setInterval(() => {
        displayRank -= 1;

        if (displayRank <= rank) {
          window.clearInterval(interval);
          intervalsRef.current = intervalsRef.current.filter(
            (item) => item !== interval
          );

          setReveal({
            type: "correct",
            phase: "result",
            answer: matchedAnswer,
            rank,
            displayRank: rank,
          });

          schedule(() => {
            const nextFoundAnswers = [...foundAnswers, matchedAnswer];
            const nextScore = score + 1;
            const nextCoinsEarned = coinsEarned + REWARD_PER_CORRECT;

            setFoundAnswers(nextFoundAnswers);
            setCelebratedAnswer(matchedAnswer);
            setScore(nextScore);
            setCoinsEarned(nextCoinsEarned);
            onAnswerFound?.({
              answer: matchedAnswer,
              rank,
              reward: REWARD_PER_CORRECT,
              answerKey: getAnswerKey(matchedAnswer, rank),
            });
            playCorrectSound?.();

            setReveal(null);
            setIsRevealing(false);
            schedule(() => {
              setCelebratedAnswer(null);
            }, 900);

            if (nextFoundAnswers.length >= targetCount) {
              finish({
                found: nextFoundAnswers.length,
                earned: nextCoinsEarned,
                foundAnswers: nextFoundAnswers,
                score: nextScore,
                lives,
              });
            }
          }, 900);
        } else {
          setReveal({
            type: "correct",
            phase: "scan",
            answer: matchedAnswer,
            rank,
            displayRank,
          });
        }
      }, DAILY_SCAN_STEP_MS);
      intervalsRef.current.push(interval);
      return;
    }

    const nextLives = Math.max(lives - 1, 0);
    const wrongMessage = matchedAnswer ? "Already guessed" : "Not in today's Top 10";
    let displayRank = answers.length;

    setLives(nextLives);
    setInput("");
    setSelectedPlayer(null);
    setIsRevealing(true);
    setReveal({
      type: "wrong",
      phase: "scan",
      answer: wrongMessage,
      rank: 0,
      displayRank,
    });

    const interval = window.setInterval(() => {
      displayRank -= 1;

      if (displayRank <= 0) {
        window.clearInterval(interval);
        intervalsRef.current = intervalsRef.current.filter(
          (item) => item !== interval
        );

        setReveal({
          type: "wrong",
          phase: "result",
          answer: wrongMessage,
          rank: 0,
          displayRank: 0,
        });

        schedule(() => {
          setReveal(null);
          setIsRevealing(false);
          playWrongSound?.();

          if (nextLives <= 0) {
            schedule(() => {
              finish({
                found: foundAnswers.length,
                earned: coinsEarned,
                foundAnswers,
                score,
                lives: nextLives,
              });
            }, 1400);
          }
        }, 260);
      } else {
        setReveal({
          type: "wrong",
          phase: "scan",
          answer: wrongMessage,
          rank: 0,
          displayRank,
        });
      }
    }, DAILY_SCAN_STEP_MS);
    intervalsRef.current.push(interval);
  };

  return {
    foundAnswers,
    input,
    selectedPlayer,
    score,
    lives,
    reveal,
    celebratedAnswer,
    isRevealing,
    setInput,
    setSelectedPlayer,
    submitAnswer,
  };
}
