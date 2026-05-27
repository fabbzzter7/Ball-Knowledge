import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

import { QUESTIONS } from "./QUESTIONS";
import { CAREER_QUESTIONS } from "./CAREER_QUESTIONS";
import { DAILY_LIST_CHALLENGES } from "./DAILY_LIST_CHALLENGES";
import { WORLD_CUP_QUESTIONS } from "./WORLD_CUP_QUESTIONS";

import coinSound from "./assets/Coins.mp3";
import wrongSound from "./assets/wrong.wav";
import stadiumBg from "./assets/stadium-bg.png";
import quizBg from "./assets/quiz-bg.png";

const STREAK_MILESTONES = [
  { day: 2, reward: 25 },
  { day: 4, reward: 50 },
  { day: 6, reward: 75 },
  { day: 8, reward: 90 },
  { day: 10, reward: 100 },
];

function shuffle(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

const ANSWER_ALIASES = {
  "lionel messi": ["messi", "leo messi"],
  "cristiano ronaldo": ["ronaldo", "cr7", "c ronaldo", "cristiano"],
  "kylian mbappe": ["mbappe", "mbappé"],
  "zinedine zidane": ["zidane", "zizou"],
  "diego maradona": ["maradona"],
  "ronaldo": ["r9", "ronaldo nazario", "ronaldo nazário"],
  "ronaldo nazario": ["ronaldo", "r9", "ronaldo nazário"],
  "ronaldo nazário": ["ronaldo", "r9", "ronaldo nazario"],
  "roberto baggio": ["baggio"],
  "mario gotze": ["gotze", "götze", "mario götze"],
  "miroslav klose": ["klose"],
  "andres iniesta": ["iniesta", "andrés iniesta"],
  "emiliano martinez": ["martinez", "emiliano martínez", "dibu martinez"],
  "angel di maria": ["di maria", "ángel di maría", "di maría"],
  "james rodriguez": ["james", "james rodríguez", "rodriguez", "rodríguez"],
  "thomas muller": ["muller", "müller", "thomas müller"],
  "geoff hurst": ["hurst"],
  "gerd muller": ["muller", "müller", "gerd müller"],
  "luka modric": ["modric", "modrić"],
  "harry kane": ["kane"],
  "neymar": ["neymar jr", "neymar junior"],
  "zlatan ibrahimovic": ["zlatan", "ibrahimovic", "ibrahimović"],
  "mohamed salah": ["salah", "mo salah"],
  "sadio mane": ["mane", "mané", "sadio mané"],
  "kevin de bruyne": ["de bruyne", "kdb"],
  "erling haaland": ["haaland"],
  "robert lewandowski": ["lewandowski"],
  "bukayo saka": ["saka"],

  "netherlands": ["holland", "the netherlands"],
  "united states": ["usa", "us", "america", "united states of america"],
  "south korea": ["korea", "republic of korea"],
  "north korea": ["dpr korea"],
  "west germany": ["germany"],
  "czech republic": ["czechia"],
  "ivory coast": ["cote divoire", "côte d'ivoire"],
  "bosnia and herzogovina": ["bosnia"],
  "bosnia and herzegovina": ["bosnia"],
  "serbia and montenegro": ["serbia"],
  "soviet union": ["ussr"],
  "saudi arabia": ["saudi"],
  "south africa": ["rsa"],
  "new zealand": ["nz"],
  "united arab emirates": ["uae"],
};

const LAST_WORD_BLACKLIST = new Set([
  "united states",
  "south korea",
  "north korea",
  "west germany",
  "east germany",
  "czech republic",
  "ivory coast",
  "south africa",
  "saudi arabia",
  "bosnia and herzegovina",
  "serbia and montenegro",
  "soviet union",
  "real madrid",
  "manchester united",
  "manchester city",
  "bayern munich",
  "borussia dortmund",
  "atletico madrid",
  "atlético madrid",
  "ac milan",
  "inter miami",
  "inter milan",
]);

function normalizeAnswer(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

function getAcceptedAnswers(correctAnswer) {
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  const aliases = ANSWER_ALIASES[normalizedCorrect] || [];

  const accepted = [correctAnswer, ...aliases];

  const words = normalizedCorrect.split(" ");

  const canUseLastWord =
    words.length > 1 &&
    !LAST_WORD_BLACKLIST.has(normalizedCorrect) &&
    !normalizedCorrect.includes(" and ");

  if (canUseLastWord) {
    accepted.push(words.at(-1));
  }

  return accepted.map(normalizeAnswer);
}

function isCorrectAnswer(input, correctAnswer) {
  const userAnswer = normalizeAnswer(input);
  const acceptedAnswers = getAcceptedAnswers(correctAnswer);

  return acceptedAnswers.includes(userAnswer);
}

function getDailyDateKey() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getTodayChallenge() {
  if (!DAILY_LIST_CHALLENGES || DAILY_LIST_CHALLENGES.length === 0) {
    return {
      id: "fallback",
      label: "Daily Challenge",
      question: "No daily challenge found.",
      answers: [],
    };
  }

  const today = new Date();

  const startDate = new Date(2026, 0, 1);
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const oneDay = 1000 * 60 * 60 * 24;
  const daysPassed = Math.floor((todayDate - startDate) / oneDay);

  const index = daysPassed % DAILY_LIST_CHALLENGES.length;

  return DAILY_LIST_CHALLENGES[index];
}

function getStreakReward(streak) {
  if (streak >= 10) return 100;
  if (streak === 8) return 90;
  if (streak === 6) return 75;
  if (streak === 4) return 50;
  if (streak === 2) return 25;
  return 0;
}

function getNextMilestone(streak) {
  return STREAK_MILESTONES.find((milestone) => milestone.day > streak) || null;
}

function buildGameQuestions(mode = "general") {
  if (mode === "career") {
    return shuffle(CAREER_QUESTIONS).map((q) => ({
      ...q,
      options: shuffle(q.options || []),
    }));
  }

  if (mode === "world-cup") {
    const easy = WORLD_CUP_QUESTIONS.filter((q) => q.difficulty === "Easy");
    const medium = WORLD_CUP_QUESTIONS.filter((q) => q.difficulty === "Medium");
    const hard = WORLD_CUP_QUESTIONS.filter((q) => q.difficulty === "Hard");

    return [
      ...shuffle(easy).slice(0, 10),
      ...shuffle(medium).slice(0, 15),
      ...shuffle(hard),
    ];
  }

  const easy = QUESTIONS.filter((q) => q.difficulty === "Easy");
  const medium = QUESTIONS.filter((q) => q.difficulty === "Medium");
  const hard = QUESTIONS.filter((q) => q.difficulty === "Hard");

  const selectedQuestions = [
    ...shuffle(easy).slice(0, 10),
    ...shuffle(medium).slice(0, 20),
    ...shuffle(hard),
  ];

  return selectedQuestions.map((q) => ({
    ...q,
    options: shuffle(q.options),
  }));
}const PLAYER_LEVELS = [
  {
    min: 0,
    name: "Beginner",
    emoji: "🌱",
    color: "green",
  },
  {
    min: 5,
    name: "Bench Warmer",
    emoji: "🪑",
    color: "green",
  },
  {
    min: 10,
    name: "Sunday League",
    emoji: "⚽",
    color: "green",
  },
  {
    min: 20,
    name: "Rising Baller",
    emoji: "🔥",
    color: "yellow",
  },
  {
    min: 35,
    name: "Football Fan",
    emoji: "📣",
    color: "yellow",
  },
  {
    min: 50,
    name: "Semi Ball Knowledge",
    emoji: "🧠",
    color: "yellow",
  },
  {
    min: 70,
    name: "Sharp Scout",
    emoji: "🔎",
    color: "blue",
  },
  {
    min: 90,
    name: "Tactical Mind",
    emoji: "📋",
    color: "blue",
  },
  {
    min: 110,
    name: "Elite Ball Knowledge",
    emoji: "🏆",
    color: "blue",
  },
  {
    min: 140,
    name: "Champions League Brain",
    emoji: "⭐",
    color: "purple",
  },
  {
    min: 170,
    name: "World Class",
    emoji: "🌍",
    color: "purple",
  },
  {
    min: 210,
    name: "Football Professor",
    emoji: "🎓",
    color: "purple",
  },
  {
    min: 260,
    name: "GOAT Debate Expert",
    emoji: "🐐",
    color: "orange",
  },
  {
    min: 320,
    name: "Ball Knowledge Master",
    emoji: "👑",
    color: "orange",
  },
  {
    min: 400,
    name: "Ball Knowledge Legend",
    emoji: "💎",
    color: "legend",
  },
];

function getPlayerLevel(highScore) {
  let currentIndex = 0;

  for (let i = 0; i < PLAYER_LEVELS.length; i++) {
    if (highScore >= PLAYER_LEVELS[i].min) {
      currentIndex = i;
    }
  }

  const current = PLAYER_LEVELS[currentIndex];
  const next = PLAYER_LEVELS[currentIndex + 1];

  if (!next) {
    return {
      ...current,
      levelNumber: currentIndex + 1,
      totalLevels: PLAYER_LEVELS.length,
      next: null,
      progress: 100,
      currentMin: current.min,
      nextMin: null,
      pointsToNext: 0,
    };
  }

  const range = next.min - current.min;
  const progressInsideLevel = highScore - current.min;
  const progress = Math.max(
    0,
    Math.min(100, (progressInsideLevel / range) * 100)
  );

  return {
    ...current,
    levelNumber: currentIndex + 1,
    totalLevels: PLAYER_LEVELS.length,
    next,
    progress,
    currentMin: current.min,
    nextMin: next.min,
    pointsToNext: next.min - highScore,
  };
}

export default function FootballQuizMVP() {
  const STREAK_TARGETS = [5, 10, 20, 30, 50];

function getNextStreakTarget(streak) {
  return STREAK_TARGETS.find((target) => streak < target) ?? STREAK_TARGETS[STREAK_TARGETS.length - 1];
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

function getStreakProgress(streak) {
  const next = getNextStreakTarget(streak);
  const prev = getPrevStreakTarget(streak);

  if (streak >= STREAK_TARGETS[STREAK_TARGETS.length - 1]) {
    return 100;
  }

  const range = next - prev;
  const progress = streak - prev;

  return Math.max(0, Math.min(100, (progress / range) * 100));
}
  const todayChallenge = getTodayChallenge();

  const [gameStarted, setGameStarted] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [gameMode, setGameMode] = useState("general");

  const [questions, setQuestions] = useState(() =>
    buildGameQuestions("general")
  );
  const [questionIndex, setQuestionIndex] = useState(0);

  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);

  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem("footballQuizHighScore")) || 0;
  });

  const [coins, setCoins] = useState(() => {
    return Number(localStorage.getItem("footballQuizCoins")) || 0;
  });

  const [revivesUsed, setRevivesUsed] = useState(0);
  const [rewardPopup, setRewardPopup] = useState(null);
  const [wrongPopup, setWrongPopup] = useState(null);

  const [foundAnswers, setFoundAnswers] = useState([]);
  const [dailyInput, setDailyInput] = useState("");
  const [dailyCoinsEarned, setDailyCoinsEarned] = useState(0);
  const [dailyReveal, setDailyReveal] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const [dailyPlayed, setDailyPlayed] = useState(() => {
    return localStorage.getItem("ballKnowledgeDailyDate") === getDailyDateKey();
  });

  const [lastDailyResult, setLastDailyResult] = useState(() => {
    const saved = localStorage.getItem("ballKnowledgeDailyResult");
    return saved ? JSON.parse(saved) : null;
  });

  const [dailyStreak, setDailyStreak] = useState(() => {
    return Number(localStorage.getItem("footballQuizDailyStreak")) || 0;
  });

  const [lastDailyPlayedDate, setLastDailyPlayedDate] = useState(() => {
    return localStorage.getItem("footballQuizLastDailyPlayedDate") || "";
  });

  const [streakRewardEarned, setStreakRewardEarned] = useState(0);
  const [showDailyCompletePopup, setShowDailyCompletePopup] = useState(false);

  const current = questions[questionIndex];
const playerLevel = getPlayerLevel(highScore);
  const revivePrices = [250, 400, 800, 1600, 5000];
  const reviveCost = revivePrices[revivesUsed] || 5000;

  const playCoinSound = () => {
    const audio = new Audio(coinSound);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const playWrongSound = () => {
    const audio = new Audio(wrongSound);
    audio.volume = 1;
    audio.currentTime = 0;
    audio.play().catch((err) => console.log("Wrong sound error:", err));
  };

  const saveCoins = (newCoins) => {
    setCoins(newCoins);
    localStorage.setItem("footballQuizCoins", String(newCoins));
  };

  const awardDailyStreakBonus = () => {
    const today = getDailyDateKey();
    const yesterday = getYesterdayDateKey();

    let newStreak = 1;

    if (lastDailyPlayedDate === yesterday) {
      newStreak = dailyStreak + 1;
    } else if (lastDailyPlayedDate === today) {
      newStreak = dailyStreak;
    }

    const reward = getStreakReward(newStreak);

    setDailyStreak(newStreak);
    setLastDailyPlayedDate(today);
    setStreakRewardEarned(reward);

    localStorage.setItem("footballQuizDailyStreak", String(newStreak));
    localStorage.setItem("footballQuizLastDailyPlayedDate", today);

    if (reward > 0) {
      const currentCoins =
        Number(localStorage.getItem("footballQuizCoins")) || coins;

      saveCoins(currentCoins + reward);
      playCoinSound();
    }

    return {
      newStreak,
      reward,
    };
  };

  const markDailyAsPlayed = (found, earned, streakInfo) => {
    const result = {
      date: getDailyDateKey(),
      found,
      total: todayChallenge.answers.length,
      coins: earned,
      streak: streakInfo?.newStreak || dailyStreak,
      streakBonus: streakInfo?.reward || 0,
      title: todayChallenge.label,
    };

    localStorage.setItem("ballKnowledgeDailyDate", getDailyDateKey());
    localStorage.setItem("ballKnowledgeDailyResult", JSON.stringify(result));

    setDailyPlayed(true);
    setLastDailyResult(result);
  };

  const startGame = (mode) => {
    setShowDailyCompletePopup(false);
    setGameMode(mode);
    setQuestions(buildGameQuestions(mode));
    setQuestionIndex(0);
    setSelected(null);
    setScore(0);
    setLives(3);
    setFinished(false);
    setRevivesUsed(0);
    setRewardPopup(null);
    setWrongPopup(null);
    setGameStarted(true);
  };

  const startDailyChallenge = () => {
    if (dailyPlayed) return;

    setShowDailyCompletePopup(false);
    setGameMode("daily-list");
    setFoundAnswers([]);
    setDailyInput("");
    setDailyCoinsEarned(0);
    setDailyReveal(null);
    setIsRevealing(false);
    setQuestionIndex(0);
    setSelected(null);
    setScore(0);
    setLives(3);
    setFinished(false);
    setRevivesUsed(0);
    setRewardPopup(null);
    setWrongPopup(null);
    setStreakRewardEarned(0);
    setGameStarted(true);
  };

  const restart = () => {
    setGameStarted(false);
    setModeMenuOpen(false);
    setGameMode("general");

    setQuestions(buildGameQuestions("general"));
    setQuestionIndex(0);

    setSelected(null);
    setScore(0);
    setLives(3);
    setFinished(false);
    setRevivesUsed(0);

    setRewardPopup(null);
    setWrongPopup(null);

    setFoundAnswers([]);
    setDailyInput("");
    setDailyCoinsEarned(0);
    setDailyReveal(null);
    setIsRevealing(false);
  };

  const nextQuestion = () => {
    setQuestionIndex((i) => (i + 1) % questions.length);
    setSelected(null);
  };

  const getRewardForScore = (newScore) => {
    if (newScore % 50 === 0) return 1500;
    if (newScore % 30 === 0) return 200;
    if (newScore % 20 === 0) return 50;
    if (newScore % 10 === 0) return 25;
    if (newScore % 5 === 0) return 25;
    return 0;
  };

  const handleWrongAnswer = (correctAnswer) => {
    const newLives = Math.max(lives - 1, 0);
    setLives(newLives);

    setWrongPopup({
      answer: correctAnswer,
    });

    playWrongSound();

    if (newLives <= 0) {
      setSelected(correctAnswer);

      setTimeout(() => {
        setWrongPopup(null);
        setFinished(true);
      }, 1500);
    } else {
      setTimeout(() => {
        setWrongPopup(null);
        nextQuestion();
      }, 1200);
    }
  };

  const chooseAnswer = (option) => {
    if (selected || rewardPopup || wrongPopup) return;
    setSelected(option);

    if (isCorrectAnswer(option, current.answer)) {
      const newScore = score + 1;
      setScore(newScore);
      const newStreak = streak + 1;
setStreak(newStreak);


      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem("footballQuizHighScore", String(newScore));
      }

      const reward = getRewardForScore(newScore);

      if (reward > 0) {
        const newCoins = coins + reward;
        saveCoins(newCoins);

        setRewardPopup({
          streak: newScore,
          coins: reward,
          onCollect: "next-question",
        });

        playCoinSound();
      } else {
        setTimeout(nextQuestion, 800);
      }
    } else {
      handleWrongAnswer(current.answer);
    }
  };

  const finishDaily = (found, earned) => {
    const streakInfo = awardDailyStreakBonus();
    const totalEarned = earned + streakInfo.reward;

    markDailyAsPlayed(found, totalEarned, streakInfo);

    setTimeout(() => {
      setFinished(true);
    }, 700);
  };

  const checkDailyAnswer = () => {
    if (!dailyInput.trim() || rewardPopup || wrongPopup || isRevealing) return;

    const input = normalizeAnswer(dailyInput);

    const matchedAnswer = todayChallenge.answers.find((answer) =>
  isCorrectAnswer(dailyInput, answer)
);

    if (matchedAnswer && !foundAnswers.includes(matchedAnswer)) {
      const rank = todayChallenge.answers.indexOf(matchedAnswer) + 1;
      const rewardPerCorrect = 15;

      setDailyInput("");
      setIsRevealing(true);

      let displayRank = todayChallenge.answers.length;

      setDailyReveal({
        answer: matchedAnswer,
        rank,
        displayRank,
      });

      const interval = setInterval(() => {
        displayRank -= 1;

        if (displayRank <= rank) {
          clearInterval(interval);

          setDailyReveal({
            answer: matchedAnswer,
            rank,
            displayRank: rank,
          });

          setTimeout(() => {
            const newFoundAnswers = [...foundAnswers, matchedAnswer];
            const newScore = score + 1;
            const newCoins = coins + rewardPerCorrect;
            const newDailyCoinsEarned = dailyCoinsEarned + rewardPerCorrect;

            setFoundAnswers(newFoundAnswers);
            setScore(newScore);
            setDailyCoinsEarned(newDailyCoinsEarned);
            saveCoins(newCoins);
            playCoinSound();

            setDailyReveal(null);
            setIsRevealing(false);

            if (newFoundAnswers.length === todayChallenge.answers.length) {
              finishDaily(newFoundAnswers.length, newDailyCoinsEarned);
            }
          }, 1100);
        } else {
          setDailyReveal({
            answer: matchedAnswer,
            rank,
            displayRank,
          });
        }
      }, 160);
    } else {
      const newLives = Math.max(lives - 1, 0);

      setLives(newLives);
      setDailyInput("");

      setWrongPopup({
        answer: matchedAnswer ? "Already guessed" : "Not in today’s Top 10",
      });

      playWrongSound();

      if (newLives <= 0) {
        setTimeout(() => {
          setWrongPopup(null);
          finishDaily(foundAnswers.length, dailyCoinsEarned);
        }, 1400);
      } else {
        setTimeout(() => {
          setWrongPopup(null);
        }, 1200);
      }
    }
  };

  const collectReward = () => {
    const action = rewardPopup?.onCollect;
    setRewardPopup(null);

    if (action === "next-question") {
      nextQuestion();
    }

    if (action === "finish") {
      setFinished(true);
    }
  };

  const revive = () => {
    const newCoins = coins - reviveCost;
    saveCoins(newCoins);

    setLives(1);
    setRevivesUsed((r) => r + 1);
    setFinished(false);
    setSelected(null);
  };

  const watchAdMock = () => {
    const newCoins = coins + 50;
    saveCoins(newCoins);
  };

  const handleResultButton = (isDaily) => {
    if (isDaily) {
      restart();
      setShowDailyCompletePopup(true);
    } else {
      restart();
    }
  };

  if (!gameStarted) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(0,0,0,0.34)), url(${stadiumBg})`,
        }}
      >
        <AnimatePresence>
          {showDailyCompletePopup && lastDailyResult && (
            <motion.div
              className="daily-reward-popup"
              initial={{ opacity: 0, scale: 0.82, y: 35 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="daily-reward-top">
                <div className="daily-reward-fire">🔥</div>

                <div>
                  <div className="daily-reward-title">Daily Reward</div>

                  <div className="daily-reward-subtitle">
                    Day {lastDailyResult.streak} complete
                  </div>
                </div>
              </div>

              <motion.div
                className="daily-reward-main-ball"
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 9 }}
              >
                ⚽
              </motion.div>

              <div className="daily-reward-earned">
                <span>Today you earned</span>
                <strong>🪙 +{lastDailyResult.coins}</strong>
              </div>

              {lastDailyResult.streakBonus > 0 && (
                <div className="daily-reward-bonus">
                  🔥 Streak bonus +{lastDailyResult.streakBonus}
                </div>
              )}

              <div className="daily-reward-road">
                {STREAK_MILESTONES.map((milestone) => {
                  const reached = lastDailyResult.streak >= milestone.day;
                  const current = lastDailyResult.streak === milestone.day;

                  return (
                    <div
                      key={milestone.day}
                      className={`daily-reward-day ${
                        reached ? "reached" : ""
                      } ${current ? "current" : ""}`}
                    >
                      <div className="daily-reward-ball">
                        {reached ? "✅" : "⚽"}
                      </div>

                      <div className="daily-reward-day-label">
                        Day {milestone.day}
                      </div>

                      <div className="daily-reward-day-coins">
                        +{milestone.reward}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="daily-reward-next">
                {getNextMilestone(lastDailyResult.streak)
                  ? `Next reward: Day ${
                      getNextMilestone(lastDailyResult.streak).day
                    } • +${
                      getNextMilestone(lastDailyResult.streak).reward
                    } coins`
                  : "Max reward reached • +100 coins every day"}
              </div>

              <button
                className="daily-reward-claim"
                onClick={() => setShowDailyCompletePopup(false)}
              >
                CLAIM
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!modeMenuOpen ? (
          <div className="main-menu">
            <h1 className="main-title">BALL KNOWLEDGE</h1><div className={`home-progress-card level-${playerLevel.color}`}>
  <div className="home-progress-top">
    <div className="home-stat-pill home-streak-pill">
      <span>🔥</span>
      <strong>{dailyStreak}</strong>
      <small>Daily streak</small>
    </div>

    <div className="home-stat-pill home-coins-pill">
      <span>🪙</span>
      <strong>{coins}</strong>
      <small>Coins</small>
    </div>
  </div>

  <div className="home-level-box">
    <div className="home-level-left">
      <div className="home-level-emoji">{playerLevel.emoji}</div>

      <div>
        <div className="home-level-label">
          Level {playerLevel.levelNumber} / {playerLevel.totalLevels}
        </div>

        <div className="home-level-name">{playerLevel.name}</div>
      </div>
    </div>

    <div className="home-level-score">
      Best: {highScore}
    </div>
  </div>

  <div className="home-level-bar-outer">
    <div
      className="home-level-bar-inner"
      style={{ width: `${playerLevel.progress}%` }}
    />
  </div>

  <div className="home-next-level">
    {playerLevel.next
      ? `${playerLevel.pointsToNext} more best-score points to unlock ${playerLevel.next.name}`
      : "Max level reached • true ball knowledge legend"}
  </div>
</div>

            <button
              className="main-menu-button"
              onClick={() => setModeMenuOpen(true)}
            >
              SINGLE PLAYER
            </button>

            <button
              className={`daily-main-button ${
                dailyPlayed ? "daily-completed" : ""
              }`}
              onClick={startDailyChallenge}
              disabled={dailyPlayed}
            >
              {dailyPlayed ? "✅ DAILY COMPLETED" : "🔥 DAILY CHALLENGE"}
            </button>

            {dailyPlayed && (
              <div className="daily-completed-note">
                Come back tomorrow
                {lastDailyResult && (
                  <span>
                    {" "}
                    • Last result: {lastDailyResult.found}/
                    {lastDailyResult.total}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mode-menu">
            <button
              className="mode-button"
              onClick={() => startGame("general")}
            >
              General Ball Knowledge
            </button>

            <button
              className="mode-button"
              onClick={() => startGame("career")}
            >
              Career Path
            </button><button
  className="mode-button"
  onClick={() => startGame("world-cup")}
>
  World Cup
</button>

            <button
              className="mode-back-button"
              onClick={() => setModeMenuOpen(false)}
            >
              Back
            </button>
          </div>
        )}
      </div>
    );
  }

  if (gameMode === "daily-list" && !finished) {
    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03), rgba(0,0,0,0.58)), url(${quizBg})`,
        }}
      >
        <button className="home-button" onClick={restart}>
          ← Home
        </button>

        <AnimatePresence>
          {dailyReveal && (
            <motion.div
              className="rank-reveal-overlay"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rank-reveal-label">RANKING</div>

              <div className="rank-reveal-number">
                #{dailyReveal.displayRank}
              </div>

              {dailyReveal.displayRank === dailyReveal.rank && (
                <div className="rank-reveal-player">
                  {dailyReveal.answer}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {wrongPopup && (
            <motion.div
              className="wrong-overlay"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="wrong-title">❌ WRONG</div>
              <div className="wrong-answer">{wrongPopup.answer}</div>
              <div className="wrong-life">-1 LIFE ❤️</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="daily-list-wrapper">
          <h2 className="daily-list-label">🔥 DAILY CHALLENGE</h2>

          <h1 className="daily-list-title">{todayChallenge.label}</h1>

          <p className="daily-list-question">{todayChallenge.question}</p>

          <div className="daily-list-stats">
            <span>
              {foundAnswers.length} / {todayChallenge.answers.length} FOUND
            </span>

            <span>
              {Array.from({ length: lives }).map((_, i) => (
                <span key={i}>❤️</span>
              ))}
            </span>
          </div>

          <div className="pyramid-list">
            {todayChallenge.answers.map((answer, index) => {
              const isFound = foundAnswers.includes(answer);
              const width = 46 + index * 4.6;

              return (
                <motion.div
                  key={answer}
                  className={`pyramid-slot ${isFound ? "found" : ""}`}
                  style={{ width: `${width}%` }}
                  initial={false}
                  animate={isFound ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.35 }}
                >
                  <span className="pyramid-rank">#{index + 1}</span>
                  <span>{isFound ? answer : "?????"}</span>
                </motion.div>
              );
            })}
          </div>

          <div className="daily-input-row">
            <input
              value={dailyInput}
              onChange={(e) => setDailyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkDailyAnswer();
              }}
              placeholder="Type player name..."
              className="daily-list-input"
              autoFocus
            />

            <button className="daily-submit-button" onClick={checkDailyAnswer}>
              GUESS
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const isDaily = gameMode === "daily-list";
    const dailyCompleted =
      isDaily && foundAnswers.length === todayChallenge.answers.length;

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.62)), url(${quizBg})`,
        }}
      >
        <div className={`result-card ${isDaily ? "daily-result-card" : ""}`}>
          <Trophy size={70} />

          <h2>
            {dailyCompleted
              ? "Daily Complete"
              : isDaily
              ? "Daily Failed"
              : "Game Over"}
          </h2>

          {isDaily ? (
            <div className="daily-result-content">
              <div className="daily-result-badge">DAILY RESULT</div>

              <div className="daily-result-score">
                {foundAnswers.length}/{todayChallenge.answers.length}
              </div>

              <div className="daily-result-subtitle">players found</div>

              <div className="daily-result-coins">
                🪙 +{lastDailyResult?.coins || dailyCoinsEarned} coins
              </div>

              <div className="daily-result-streak">
                🔥 Streak: {lastDailyResult?.streak || dailyStreak} days
              </div>

              {(lastDailyResult?.streakBonus || streakRewardEarned) > 0 && (
                <div className="daily-result-streak-bonus">
                  +{lastDailyResult?.streakBonus || streakRewardEarned} streak
                  bonus
                </div>
              )}
            </div>
          ) : (
            <>
              <p>🔥 Final Score: {score}</p>
              <p>🏆 Best Score: {highScore}</p>
            </>
          )}

          {!isDaily && coins >= reviveCost && (
            <button className="play-again-button" onClick={revive}>
              ❤️ Revive for {reviveCost} coins
            </button>
          )}

          {!isDaily && (
            <button className="play-again-button" onClick={watchAdMock}>
              ▶ Watch ad +50 coins
            </button>
          )}

          <button
            className="play-again-button"
            onClick={() => handleResultButton(isDaily)}
          >
            {isDaily ? (
              "COLLECT & HOME"
            ) : (
              <>
                <RotateCcw size={24} /> Play again
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fullscreen-bg"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.58)), url(${quizBg})`,
      }}
    >
      <button className="home-button" onClick={restart}>
        ← Home
      </button>

      <AnimatePresence>
        {rewardPopup && (
          <motion.div
            className="reward-overlay"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -30 }}
            transition={{ duration: 0.35 }}
          >
            <div className="reward-title">🔥 {rewardPopup.streak} STREAK</div>
            <div className="reward-coins">+{rewardPopup.coins} COINS</div>

            <button className="collect-button" onClick={collectReward}>
              COLLECT
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wrongPopup && (
          <motion.div
            className="wrong-overlay"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.25 }}
          >
            <div className="wrong-title">❌ WRONG</div>
            <div className="wrong-answer">Correct: {wrongPopup.answer}</div>
            <div className="wrong-life">-1 LIFE ❤️</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hud-row">
        <div className="streak-meter">
  <div className="streak-meter-top">
    <div className="streak-left">
      <span className="streak-fire">🔥</span>
      <span className="streak-title">STREAK {streak}</span>
    </div>

    <div className="streak-right">
      {streak >= 50 ? "MAXED" : `Next reward: ${getNextStreakTarget(streak)}`}
    </div>
  </div>

  <div className="streak-bar-outer">
    <div
      className="streak-bar-inner"
      style={{ width: `${getStreakProgress(streak)}%` }}
    />
  </div>
</div>
        <div className="hud-card">
          <span className="hud-label">SCORE</span>
          <span className="hud-value">🔥 {score}</span>
        </div>

        <div className="hud-card">
          <span className="hud-label">BEST</span>
          <span className="hud-value">🏆 {highScore}</span>
        </div>

        <div className="hud-card">
          <span className="hud-label">COINS</span>
          <span className="hud-value">🪙 {coins}</span>
        </div>

        <div className="hud-card">
          <span className="hud-label">LIVES</span>
          <span className="hud-value">
            {Array.from({ length: lives }).map((_, i) => (
              <span key={i}>❤️</span>
            ))}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -25 }}
          transition={{ duration: 0.25 }}
        >
          <div className="difficulty-pill">
  {gameMode === "career"
    ? "Career Path"
    : gameMode === "world-cup"
    ? `World Cup • ${current.difficulty}`
    : current.difficulty}
</div>

          <h1 className="question-title">{current.question}</h1>

          {gameMode === "career" || gameMode === "world-cup" ? (
            <>
              <div className="career-answer-box">
                <input
                  type="text"
                  placeholder={
  gameMode === "world-cup"
    ? "Type your answer..."
    : "Type player name..."
}
                  className="career-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      chooseAnswer(e.target.value);
                      e.target.value = "";
                    }
                  }}
                />
              </div>

              {selected && (
                <div className="career-correct-answer">
                  Correct answer: {current.answer}
                </div>
              )}
            </>
          ) : (
            <div className="answers-grid">
              {current.options.map((option) => {
                const isCorrect = option === current.answer;
                const isChosen = selected === option;
                const showCorrect = selected && isCorrect;
                const showWrong = selected && isChosen && !isCorrect;

                return (
                  <button
                    key={option}
                    onClick={() => chooseAnswer(option)}
                    className={`answer-button ${
                      showCorrect ? "correct" : showWrong ? "wrong" : ""
                    }`}
                  >
                    <span>{option}</span>
                    {showCorrect && <CheckCircle2 size={28} />}
                    {showWrong && <XCircle size={28} />}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}