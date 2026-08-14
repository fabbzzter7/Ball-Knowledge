import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Coins,
  Flame,
  RotateCcw,
  Trophy,
  XCircle,
  Trash2,
} from "lucide-react";
import { ANSWER_ALIASES, LAST_WORD_BLACKLIST } from "./answerAliases";
import PlayerAvatar, { getAvatarConfig } from "./components/PlayerAvatar";
import GuessInput from "./components/GuessInput";
import GameTopNav from "./components/GameTopNav";
import BKIcon from "./components/BKIcon";
import LevelIcon from "./components/LevelIcon";
import AppScreen from "./components/ui/AppScreen";
import AuthNotice from "./components/ui/AuthNotice";
import BackButton from "./components/ui/BackButton";
import Button from "./components/ui/Button";
import EmptyState from "./components/ui/EmptyState";
import FormField from "./components/ui/FormField";
import Modal from "./components/ui/Modal";
import ProgressBar from "./components/ui/ProgressBar";
import ScreenHeader from "./components/ui/ScreenHeader";
import SegmentedControl from "./components/ui/SegmentedControl";
import StatGrid from "./components/ui/StatGrid";
import StatusBadge from "./components/ui/StatusBadge";
import SurfaceCard from "./components/ui/SurfaceCard";

import {
  DAILY_LIST_CHALLENGES,
  auditDailyListChallenges,
} from "./DAILY_LIST_CHALLENGES";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import {
  createProfile,
  fetchProfile,
  getDefaultProfile,
  getOrCreatePlayerId,
  mergeLocalProgressIntoProfile,
  PROFILE_SELECT,
  syncLocalStatsToProfile,
  updateProfile,
} from "./lib/profileService";
import { isPlayerAnswerMatch } from "./lib/playerAnswer";
import {
  findMatchingAnswer,
  isPlayerAnswerCorrect,
  normalizeAnswerText,
} from "./lib/playerAnswerMatcher";
import {
  addDaysToDateKey,
  formatDisplayDate,
  getTodayDateKey,
} from "./lib/dailyDateUtils";
import {
  selectDailyChallenge,
  selectDailyWhoAmIQuestion,
} from "./lib/dailyContentDiversity";
import {
  addStat,
  createXpEvent,
  getLevelById,
  getInitialProgression,
  getProgressionView,
  maxStat,
  persistLocalProgression,
} from "./lib/progressionService";
import { safeLocalStorage as localStorage } from "./lib/safeStorage";
import {
  pickMultiplayerQuestionIds,
} from "./multiplayerQuestionBank";
import {
  createLeague,
  fetchLeagueDashboard,
  fetchMyLeagues,
  getOrCreateLeagueDay,
  joinLeague,
  leaveLeague,
  submitLeagueDailyResult,
} from "./lib/leagueService";
import {
  getLeagueQuestionsByIds,
  getLeagueSettingsSummary,
  getLeagueTop10Challenge,
  getLeagueTop10ChallengeById,
  getLeagueWhoAmIQuestionsByIds,
} from "./lib/leagueChallengeUtils";
import {
  findOrCreatePublicMatch,
  getPrivateJoinErrorMessage,
  joinPrivateMatchByRoomCode,
  normalizeRoomCode,
} from "./lib/matchmakingService";
import {
  getFriendlyAuthErrorMessage,
  getCurrentSession,
  isAnonymousAuthUser,
  normalizeUsername,
  signInAnonymously,
  signInWithEmail,
  signOut,
  signUpWithEmailUsername,
  upgradeAnonymousUserWithEmail,
} from "./lib/authService";
import {
  isSoundEnabled,
  playButtonTapSound,
  playCoinSound,
  playCorrectSound,
  playLevelUpSound,
  playStreakSound,
  playWrongSound,
  setSoundEnabled,
} from "./lib/soundManager";
import {
  GENERAL_KNOWLEDGE_RECENT_HISTORY_KEY,
  GENERAL_KNOWLEDGE_RECENT_HISTORY_LIMIT,
  auditGeneralKnowledgeQuestionBank,
  buildGeneralKnowledgeQuestions,
  getGeneralKnowledgeQuestionKey,
} from "./features/generalKnowledge/questionSequencer";
import AnswerGrid from "./features/generalKnowledge/AnswerGrid";
import QuestionCard from "./features/generalKnowledge/QuestionCard";
import QuizTimer from "./features/generalKnowledge/QuizTimer";
import "./features/generalKnowledge/GeneralKnowledgeGame.css";
import "./features/singlePlayer/top10/Top10Game.css";
import "./features/gameplay/GameplayShell.css";

import stadiumBg from "./assets/stadium-bg.png";
import quizBg from "./assets/quiz-bg.png";

const GeneralKnowledgeGame = React.lazy(() => import("./features/generalKnowledge/GeneralKnowledgeGame"));
const WorldCupGame = React.lazy(() => import("./features/singlePlayer/worldCup/WorldCupGame"));
const CareerPathGame = React.lazy(() => import("./features/singlePlayer/careerPath/CareerPathGame"));
const WhoAmIGame = React.lazy(() => import("./features/singlePlayer/whoAmI/WhoAmIGame"));
const ConnectionsGame = React.lazy(() => import("./features/singlePlayer/connections/ConnectionsGame"));
const Top10Game = React.lazy(() => import("./features/singlePlayer/top10/Top10Game"));
const ActiveMatchRound = React.lazy(() => import("./features/multiplayer/ActiveMatchRound"));

function SinglePlayerFeatureFallback() {
  return <div className="fullscreen-bg" />;
}

const STARTUP_MIN_DISPLAY_MS = 1650;

function StartupExperience({ isWorking = true }) {
  return (
    <div
      className="fullscreen-bg startup-screen"
    >
      <motion.div
        className="startup-shell"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="startup-copy" aria-live="polite">
          <motion.h1
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.64, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            Ball Knowledge
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            Prove you know the game
          </motion.p>
        </div>

        <motion.div
          className="startup-loading-slot"
          initial={{ opacity: 0 }}
          animate={{ opacity: isWorking ? 1 : 0 }}
          transition={{ duration: 0.24, delay: isWorking ? 0.58 : 0 }}
        >
          {isWorking && (
            <div
              className="startup-loading"
              aria-label="Ball Knowledge is starting"
            >
              <div className="startup-loading-line" />
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function ArenaOptionCard({
  tone = "primary",
  icon,
  iconSize = 30,
  eyebrow,
  title,
  description,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={`bk-mp-option bk-mp-option--${tone}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="bk-mp-option__icon">
        <BKIcon name={icon} size={iconSize} />
      </span>

      <span className="bk-mp-option__copy">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>

      <span className="bk-mp-option__arrow">›</span>
    </button>
  );
}

const MULTIPLAYER_CATEGORY_PRESENTATION = {
  general: {
    tone: "general",
    icon: "generalKnowledge",
    eyebrow: "Classic",
    description: "Four football knowledge questions.",
  },
  world_cup: {
    tone: "world-cup",
    icon: "worldCup",
    eyebrow: "Trophy",
    description: "International history and glory.",
  },
  premier_league: {
    tone: "premier-league",
    icon: "rankings",
    eyebrow: "League",
    description: "English football knowledge.",
  },
  career_path: {
    tone: "career-path",
    icon: "careerPath",
    eyebrow: "Journey",
    description: "Follow the clubs. Name the player.",
  },
};

function getMultiplayerCategoryPresentation(categoryId) {
  return (
    MULTIPLAYER_CATEGORY_PRESENTATION[categoryId] ||
    MULTIPLAYER_CATEGORY_PRESENTATION.general
  );
}

function MultiplayerCategoryGrid({
  categories,
  onSelect,
  disabled = false,
  className = "",
}) {
  return (
    <div className={["bk-battle-category-grid", className].filter(Boolean).join(" ")}>
      {categories.map((category) => {
        const categoryPresentation = getMultiplayerCategoryPresentation(category.id);

        return (
          <button
            type="button"
            key={category.id}
            className={`bk-battle-category-card bk-battle-category-card--${categoryPresentation.tone}`}
            disabled={!category.available || disabled}
            onClick={() => onSelect(category)}
          >
            <span className="bk-battle-category-card__icon">
              <BKIcon name={categoryPresentation.icon} size={34} />
            </span>
            <span className="bk-battle-category-card__copy">
              <small>{categoryPresentation.eyebrow}</small>
              <strong>{category.label}</strong>
              <span>
                {category.available
                  ? categoryPresentation.description
                  : "Coming soon"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function getMatchSlotData(match, slot, profiles, currentUsername = "") {
  const prefix = slot === "player2" ? "player2" : "player1";
  const fallbackName =
    match?.[`${prefix}_username`] ||
    (slot === "player1" ? currentUsername : "") ||
    "Waiting...";

  return {
    slot,
    id: match?.[`${prefix}_id`] || "",
    name: fallbackName,
    profile: profiles?.[slot],
    wins: Number(match?.[`${prefix}_wins`]) || 0,
  };
}

function getMatchPerspective(match, currentPlayerSlot, profiles, currentUsername = "") {
  const safeSlot =
    currentPlayerSlot === "player2"
      ? "player2"
      : currentPlayerSlot === "player1"
      ? "player1"
      : "player1";
  const rivalSlot = safeSlot === "player1" ? "player2" : "player1";

  return {
    you: getMatchSlotData(match, safeSlot, profiles, currentUsername),
    rival: getMatchSlotData(match, rivalSlot, profiles, currentUsername),
  };
}

function getRoundWinnerSlot(round, match) {
  if (!round?.winner || round.winner === "draw") return round?.winner || null;
  if (round.winner === match?.player1_username) return "player1";
  if (round.winner === match?.player2_username) return "player2";
  return null;
}

function getRoundOutcomeText(round, match, perspective) {
  const winnerSlot = getRoundWinnerSlot(round, match);
  if (winnerSlot === "draw") return "Draw";
  if (winnerSlot === perspective.you.slot) return "You won the round";
  if (winnerSlot === perspective.rival.slot) return "Rival won the round";
  return round?.status === "finished" ? "Round complete" : "Waiting";
}

function getRoundScoreForSlot(round, slot) {
  return slot === "player2"
    ? round?.player2_score ?? 0
    : round?.player1_score ?? 0;
}

function MultiplayerMatchScoreboard({
  activeMatch,
  activeRound,
  playerOneProfile,
  playerTwoProfile,
  currentPlayerSlot,
  currentUsername,
  hasBothPlayers,
}) {
  const profiles = { player1: playerOneProfile, player2: playerTwoProfile };
  const perspective = getMatchPerspective(
    activeMatch,
    currentPlayerSlot,
    profiles,
    currentUsername
  );
  const roundLabel = activeRound?.round_number
    ? `Round ${activeRound.round_number}`
    : activeMatch?.phase === "round_finished"
    ? `Round ${activeMatch.round_number || 1} complete`
    : activeMatch?.round_number
    ? `Round ${activeMatch.round_number}`
    : "Opening round";
  const categoryLabel = activeRound?.category
    ? getCategoryLabel(activeRound.category)
    : activeMatch?.selected_category
    ? getCategoryLabel(activeMatch.selected_category)
    : "Choose category";

  return (
    <section className="bk-match-scoreboard" aria-label="Match score">
      <div className="bk-match-scoreboard__player">
        <PlayerAvatar profile={perspective.you.profile} size="medium" />
        <span>
          <small>You</small>
          <strong>{perspective.you.name || "You"}</strong>
        </span>
      </div>

      <div className="bk-match-scoreboard__score" aria-label="Overall round wins">
        <small>Match score</small>
        <strong>
          {perspective.you.wins}<span>–</span>{perspective.rival.wins}
        </strong>
        <em>{roundLabel}</em>
      </div>

      <div className={`bk-match-scoreboard__player ${hasBothPlayers ? "" : "is-waiting"}`}>
        <PlayerAvatar
          profile={perspective.rival.profile}
          size="medium"
          hideFlag={!hasBothPlayers}
        />
        <span>
          <small>Rival</small>
          <strong>{hasBothPlayers ? perspective.rival.name : "Waiting..."}</strong>
        </span>
      </div>

      <div className="bk-match-scoreboard__round">
        <span>{categoryLabel}</span>
      </div>
    </section>
  );
}

function MultiplayerRoundStatus({
  activeMatch,
  activeRound,
  hasBothPlayers,
  hasPlayedActiveRound,
  isMultiplayerTurn,
  nextCategoryWaitingName,
  activeOpponentLabel,
}) {
  let title = "Waiting for rival";
  let detail = "Share the room code to start the battle.";

  if (activeMatch?.is_public && activeMatch.phase === "waiting_for_opponent") {
    title = "Score saved";
    detail = "Waiting for a random rival to finish the same round.";
  } else if (!hasBothPlayers && !activeMatch?.is_public) {
    title = "Waiting for rival";
    detail = "Your room is ready. Share the code when you want to play.";
  } else if (activeMatch?.phase === "choose_category") {
    title = isMultiplayerTurn ? "Your turn" : "Rival choosing";
    detail = isMultiplayerTurn
      ? "Choose the next category."
      : `Waiting for ${nextCategoryWaitingName} to choose.`;
  } else if (activeMatch?.phase === "round_active" && activeRound) {
    title = hasPlayedActiveRound ? "Round submitted" : "Your turn";
    detail = hasPlayedActiveRound
      ? `Waiting for ${activeOpponentLabel} to play this round.`
      : "Your five-question round is ready.";
  } else if (activeMatch?.phase === "round_finished" && activeRound) {
    title = "Round complete";
    detail = "The match score has been updated.";
  } else if (activeMatch?.status === "ready") {
    title = "Rival joined";
    detail = "The private battle is ready.";
  }

  return (
    <section className="bk-match-status-card">
      <span>{activeRound ? getCategoryLabel(activeRound.category) : "Match state"}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </section>
  );
}

function MultiplayerRoundResult({
  activeMatch,
  activeRound,
  currentPlayerSlot,
  playerOneProfile,
  playerTwoProfile,
  currentUsername,
  isMultiplayerTurn,
  nextCategoryWaitingName,
}) {
  if (!activeMatch || !activeRound || activeMatch.phase !== "round_finished") return null;

  const perspective = getMatchPerspective(
    activeMatch,
    currentPlayerSlot,
    { player1: playerOneProfile, player2: playerTwoProfile },
    currentUsername
  );
  const youRoundScore = getRoundScoreForSlot(activeRound, perspective.you.slot);
  const rivalRoundScore = getRoundScoreForSlot(activeRound, perspective.rival.slot);

  return (
    <SurfaceCard variant="selected" className="bk-match-result-card">
      <span>Round {activeRound.round_number} complete</span>
      <strong>{youRoundScore}<em>–</em>{rivalRoundScore}</strong>
      <p>{getRoundOutcomeText(activeRound, activeMatch, perspective)}</p>
      <small>
        Match score {perspective.you.wins}–{perspective.rival.wins}
      </small>
      <small>
        {isMultiplayerTurn
          ? "Next: you choose the category."
          : `Next: waiting for ${nextCategoryWaitingName}.`}
      </small>
    </SurfaceCard>
  );
}

function MultiplayerRoundHistory({
  activeMatch,
  activeRound,
  matchRounds,
  currentPlayerSlot,
  playerOneProfile,
  playerTwoProfile,
  currentUsername,
}) {
  const previousRounds = (matchRounds || []).filter((round) => (
    round.id !== activeRound?.id && round.status === "finished"
  ));

  if (!activeMatch || !previousRounds.length) return null;

  const perspective = getMatchPerspective(
    activeMatch,
    currentPlayerSlot,
    { player1: playerOneProfile, player2: playerTwoProfile },
    currentUsername
  );

  return (
    <SurfaceCard className="bk-battle-history">
      <strong>Previous rounds</strong>
      {previousRounds.slice(0, 5).map((round) => {
        const youScore = getRoundScoreForSlot(round, perspective.you.slot);
        const rivalScore = getRoundScoreForSlot(round, perspective.rival.slot);
        const outcome = getRoundOutcomeText(round, activeMatch, perspective);

        return (
          <span key={round.id} className="bk-round-history-row">
            <small>R{round.round_number}</small>
            <strong>{getCategoryLabel(round.category)}</strong>
            <b>{youScore}–{rivalScore}</b>
            <em>{outcome}</em>
          </span>
        );
      })}
    </SurfaceCard>
  );
}

function LeagueContextHeader({
  leagueName,
  dayLabel,
  modeLabel,
  metaLabel = "Score",
  metaValue,
}) {
  return (
    <header className="league-play-context">
      <div>
        <span>League</span>
        <strong>{leagueName}</strong>
      </div>
      <div>
        <span>{dayLabel}</span>
        <strong>{modeLabel}</strong>
      </div>
      <div>
        <span>{metaLabel}</span>
        <strong>{metaValue}</strong>
      </div>
    </header>
  );
}

function LeagueProgressStrip({ items }) {
  return (
    <div className="league-modern-score-strip" aria-label="League challenge score">
      {items.filter(Boolean).map((item) => (
        <span key={item.label}>
          <em>{item.label}</em>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

function LeagueTop10Board({
  answers,
  foundAnswers,
  reveal,
  isRevealing,
  getAnswerKey,
  formatAnswerWithValue,
  revealAll = false,
}) {
  return (
    <section className="dc-board league-modern-top10-board" aria-label="League Top 10 answers">
      <div className="dc-slot-list">
        {answers.map((answer, index) => {
          const rank = index + 1;
          const found = foundAnswers.includes(answer);
          const isScanning = reveal?.phase === "scan" && reveal.displayRank === rank;
          const isRevealTarget = reveal?.type === "correct" && reveal.rank === rank;

          return (
            <motion.div
              key={getAnswerKey(answer, index)}
              className={`dc-slot ${found ? "found" : ""} ${
                isScanning || isRevealing ? "scanning" : ""
              } ${isRevealTarget ? "reveal-target" : ""} ${
                revealAll && !found ? "missed" : ""
              }`}
              initial={revealAll ? { opacity: 0, y: 10 } : false}
              animate={revealAll ? { opacity: 1, y: 0 } : {}}
              transition={revealAll ? { delay: index * 0.035 } : undefined}
            >
              <span className="dc-slot-rank">#{rank}</span>
              <span className="dc-slot-answer">
                {found || revealAll ? (
                  <strong>{formatAnswerWithValue(answer)}</strong>
                ) : (
                  <em>Awaiting answer</em>
                )}
              </span>
              <span className="dc-slot-state">
                {revealAll ? (
                  <em>{found ? "Found" : "Missed"}</em>
                ) : found ? (
                  <BKIcon name="dailyChallenge" size={18} />
                ) : (
                  <BKIcon name="questionMark" size={15} />
                )}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function LeagueDashboardHero({
  league,
  dayLabel,
  memberCount,
  statusLabel,
  statusTone,
  onLeave,
  loading,
}) {
  return (
    <section className="bk-league-hero-v2" aria-labelledby="league-dashboard-title">
      <div className="bk-league-hero-v2__identity">
        <p className="bk-type-label">
          <BKIcon name="league" size={20} /> League
        </p>
        <h2 id="league-dashboard-title">{league.name}</h2>
        <div className="bk-league-hero-v2__meta">
          <span>{dayLabel}</span>
          <span>{memberCount} players</span>
          <span>{league.league_code}</span>
        </div>
      </div>
      <div className="bk-league-hero-v2__actions">
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        <Button
          type="button"
          variant="ghost"
          onClick={onLeave}
          disabled={loading}
        >
          Leave
        </Button>
      </div>
    </section>
  );
}

function LeagueModeProgress({ item }) {
  return (
    <span className={`bk-league-mode-progress bk-league-mode-progress--${item.key}`}>
      <em>{item.label}</em>
      <strong>{item.display}</strong>
    </span>
  );
}

function LeagueTodayChallengeCard({
  expired,
  submission,
  settings,
  scoreItems,
  structureText,
  loading,
  onPlay,
}) {
  const total = submission?.total_points ?? 0;

  return (
    <section
      className={`bk-league-today-card ${
        !expired && !submission ? "is-playable" : "is-complete"
      }`}
      aria-labelledby="league-today-title"
    >
      <div className="bk-league-today-card__top">
        <div>
          <p className="bk-type-label">Today's Challenge</p>
          <h3 id="league-today-title">
            {expired ? "League finished" : submission ? "Today complete" : "Ready to play"}
          </h3>
        </div>
        <div className="bk-league-today-card__score">
          <span>Today</span>
          <strong>
            {submission ? total : 0}/{settings.maxDailyPoints}
          </strong>
        </div>
      </div>

      <div className="bk-league-today-progress" aria-label="Today's mode scores">
        {submission ? (
          scoreItems.map((item) => <LeagueModeProgress item={item} key={item.key} />)
        ) : (
          <>
            {settings.quizCount > 0 && (
              <LeagueModeProgress
                item={{
                  key: "quiz",
                  label: "Quick",
                  display: `0/${settings.quizCount}`,
                }}
              />
            )}
            {settings.top10Count > 0 && (
              <LeagueModeProgress
                item={{ key: "top10", label: "Top 10", display: "0 pts" }}
              />
            )}
            {settings.whoamiCount > 0 && (
              <LeagueModeProgress
                item={{ key: "whoami", label: "Who Am I", display: "0 pts" }}
              />
            )}
          </>
        )}
      </div>

      <div className="bk-league-today-card__footer">
        <span>{expired ? "Final standings are locked in" : structureText}</span>
        {!expired && !submission && (
          <Button onClick={onPlay} disabled={loading}>
            {loading ? "Loading..." : "Play Today's Challenge"}
          </Button>
        )}
      </div>
    </section>
  );
}

function LeagueStandingRow({ row, compact = false }) {
  const statusTone =
    row.status === "completed" ? "success" : row.status === "in-progress" ? "info" : "warning";

  return (
    <div
      className={`bk-league-standing-row ${compact ? "is-compact" : ""} ${
        row.isCurrentUser ? "is-current" : ""
      } ${row.isLeader ? "is-leader" : ""}`}
    >
      <div className="bk-league-standing-rank">
        {row.rank === 1 ? <Trophy size={15} /> : null}
        <span>#{row.rank}</span>
      </div>
      <div className="bk-league-standing-player">
        <PlayerAvatar profile={row.profile} size="small" />
        <div>
          <strong>{row.member.username}</strong>
          <small>
            {row.isCurrentUser ? "You" : `${row.member.days_played || 0} days played`}
          </small>
        </div>
      </div>
      <div className="bk-league-standing-metrics" aria-label={`${row.member.username} scores`}>
        <span>
          <em>Today</em>
          <b>{row.totalToday}</b>
        </span>
        <span>
          <em>Total</em>
          <b>{row.member.total_points || 0}</b>
        </span>
      </div>
      <StatusBadge tone={statusTone}>{row.statusLabel}</StatusBadge>
    </div>
  );
}

function LeagueStandings({ rows }) {
  const topRows = rows.slice(0, Math.min(rows.length, 3));
  const lowerRows = rows.slice(topRows.length);
  const showRivalry = rows.length === 2;

  if (rows.length === 0) {
    return (
      <section className="bk-league-standings-v2">
        <div className="bk-league-section-head">
          <p className="bk-type-label">Standings</p>
          <h3>League table</h3>
        </div>
        <EmptyState icon={<BKIcon name="league" size={26} />} title="No players yet">
          Invite players with the league code.
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="bk-league-standings-v2" aria-labelledby="league-standings-title">
      <div className="bk-league-section-head">
        <p className="bk-type-label">Standings</p>
        <h3 id="league-standings-title">
          {showRivalry ? "Head to head table" : "League table"}
        </h3>
      </div>

      <div className={`bk-league-top-table ${showRivalry ? "is-rivalry" : ""}`}>
        {topRows.map((row) => (
          <LeagueStandingRow row={row} key={row.member.id} />
        ))}
      </div>

      {lowerRows.length > 0 && (
        <div className="bk-league-compact-table">
          {lowerRows.map((row) => (
            <LeagueStandingRow row={row} compact key={row.member.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function PrivateBattleLobby({
  roomCode,
  activeMatch,
  activeRound,
  matchRounds,
  canChooseCategory,
  categories,
  multiplayerLoading,
  copyStatus,
  isWaitingAfterCreatorRound,
  hasBothPlayers,
  hasPlayedActiveRound,
  isMultiplayerTurn,
  nextCategoryWaitingName,
  playerOneProfile,
  playerTwoProfile,
  currentPlayerSlot,
  currentUsername,
  onCopyCode,
  onSelectCategory,
  onStartRound,
  onRefresh,
}) {
  const waitingForRival = !hasBothPlayers;
  const roomCodeHero = (
    <section
      className={`bk-room-code-hero ${hasBothPlayers ? "is-secondary" : ""}`}
      aria-label="Private room code"
    >
      <span>Private room</span>
      <strong>{roomCode || "Room code"}</strong>
      <p>Share this code with your rival.</p>
      {roomCode && (
        <Button
          type="button"
          variant="secondary"
          onClick={onCopyCode}
          disabled={multiplayerLoading}
        >
          {copyStatus || "Copy Code"}
        </Button>
      )}
    </section>
  );

  return (
    <section className="bk-private-battle">
      <header className="bk-private-battle__header">
        <span>H2H Arena</span>
        <h2>Private Battle</h2>
        <p>
          {isWaitingAfterCreatorRound
            ? "Your score is saved. Share the room and wait for your rival."
            : "Share the room, pick the opening category, and start the duel."}
        </p>
      </header>

      {waitingForRival && roomCodeHero}

      <MultiplayerMatchScoreboard
        activeMatch={activeMatch}
        activeRound={activeRound}
        playerOneProfile={playerOneProfile}
        playerTwoProfile={playerTwoProfile}
        currentPlayerSlot={currentPlayerSlot}
        currentUsername={currentUsername}
        hasBothPlayers={hasBothPlayers}
      />

      {!waitingForRival && roomCodeHero}

      <div className="bk-battle-status-row">
        <span className={`bk-battle-status-dot ${waitingForRival ? "is-waiting" : ""}`} />
        <strong>
          {activeMatch?.status === "ready"
            ? "Rival joined"
            : isWaitingAfterCreatorRound
            ? "Waiting for rival"
            : waitingForRival
            ? "Waiting for rival"
            : "Battle ready"}
        </strong>
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={multiplayerLoading}
        >
          {multiplayerLoading ? "Checking..." : "Check for rival"}
        </Button>
      </div>

      <MultiplayerRoundStatus
        activeMatch={activeMatch}
        activeRound={activeRound}
        hasBothPlayers={hasBothPlayers}
        hasPlayedActiveRound={hasPlayedActiveRound}
        isMultiplayerTurn={isMultiplayerTurn}
        nextCategoryWaitingName={nextCategoryWaitingName}
        activeOpponentLabel="rival"
      />

      {canChooseCategory && (
        <section className="bk-battle-section">
          <div className="bk-battle-section__top">
            <span>Choose category</span>
            <strong>{activeRound ? "Next round" : "Opening round"}</strong>
          </div>
          <MultiplayerCategoryGrid
            categories={categories}
            onSelect={onSelectCategory}
            disabled={multiplayerLoading}
          />
        </section>
      )}

      {activeMatch?.phase === "category_selected" && (
        <SurfaceCard variant="selected" className="bk-battle-state-card">
          <strong>Category selected: {getCategoryLabel(activeMatch.selected_category)}</strong>
          <span>Round {activeMatch.round_number || 1} is ready.</span>
        </SurfaceCard>
      )}

      {activeMatch?.phase === "round_active" && activeRound && (
        <SurfaceCard variant="selected" className="bk-battle-state-card">
          <strong>
            Round {activeRound.round_number} · {getCategoryLabel(activeRound.category)}
          </strong>
          {hasPlayedActiveRound ? (
            <span>
              {isWaitingAfterCreatorRound
                ? `Share ${roomCode}. Waiting for rival to join and play.`
                : "Waiting for rival to play this round."}
            </span>
          ) : (
            <>
              <span>Your 5-question round is ready.</span>
              <Button onClick={onStartRound} disabled={multiplayerLoading}>
                Play Round
              </Button>
            </>
          )}
        </SurfaceCard>
      )}

      <MultiplayerRoundResult
        activeMatch={activeMatch}
        activeRound={activeRound}
        currentPlayerSlot={currentPlayerSlot}
        playerOneProfile={playerOneProfile}
        playerTwoProfile={playerTwoProfile}
        currentUsername={currentUsername}
        isMultiplayerTurn={isMultiplayerTurn}
        nextCategoryWaitingName={nextCategoryWaitingName}
      />

      <MultiplayerRoundHistory
        activeMatch={activeMatch}
        activeRound={activeRound}
        matchRounds={matchRounds}
        currentPlayerSlot={currentPlayerSlot}
        playerOneProfile={playerOneProfile}
        playerTwoProfile={playerTwoProfile}
        currentUsername={currentUsername}
      />
    </section>
  );
}

function getLeaderboardTone(rank) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "standard";
}

function LeaderboardMetric({ type, row }) {
  if (type === "levels") {
    return (
      <span className="bk-leaderboard-metric bk-leaderboard-metric--level">
        <LevelIcon levelId={row.levelId} size={30} />
        <span>
          <strong>Level {row.levelId}</strong>
          <small>{row.xpTotal.toLocaleString()} XP</small>
        </span>
      </span>
    );
  }

  return (
    <span className="bk-leaderboard-metric">
      <strong>{Number(row.score || 0).toLocaleString()}</strong>
      <small>Best score</small>
    </span>
  );
}

function LeaderboardPodiumCard({ row, type }) {
  const tone = getLeaderboardTone(row.rank);

  return (
    <motion.div
      className={`bk-leaderboard-podium-card bk-leaderboard-podium-card--${tone} ${
        row.isCurrentUser ? "is-current" : ""
      }`}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: row.rank * 0.045, duration: 0.24 }}
    >
      <span className="bk-leaderboard-crown">
        <BKIcon name={row.rank === 1 ? "league" : "rankings"} size={34} />
      </span>
      <span className="bk-leaderboard-rank-label">#{row.rank}</span>
      <PlayerAvatar profile={row} size={row.rank === 1 ? "large" : "medium"} />
      <strong>{row.username}</strong>
      <small>
        {row.isCurrentUser ? "You" : row.favorite_flag || row.levelName || "Ball Knowledge"}
      </small>
      <LeaderboardMetric type={type} row={row} />
    </motion.div>
  );
}

function LeaderboardRow({ row, type, featured = false }) {
  return (
    <motion.div
      className={`bk-leaderboard-row-v2 ${featured ? "is-featured" : ""} ${
        row.isCurrentUser ? "is-current" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(row.rank, 12) * 0.025, duration: 0.2 }}
    >
      <span className={`bk-leaderboard-row-rank bk-leaderboard-row-rank--${getLeaderboardTone(row.rank)}`}>
        {row.rank <= 3 ? `#${row.rank}` : row.rank}
      </span>
      <PlayerAvatar profile={row} size="small" />
      <span className="bk-leaderboard-player-copy">
        <strong>{row.username}</strong>
        <small>
          {row.isCurrentUser
            ? "You"
            : type === "levels"
            ? row.levelName
            : row.favorite_flag || "General Knowledge"}
        </small>
      </span>
      <LeaderboardMetric type={type} row={row} />
      {row.isCurrentUser && <em className="bk-leaderboard-you-badge">You</em>}
    </motion.div>
  );
}

function LeaderboardPodium({ rows, type }) {
  const topThree = rows.slice(0, 3);
  if (topThree.length < 3) return null;

  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  return (
    <div className="bk-leaderboard-podium" aria-label="Top three players">
      <LeaderboardPodiumCard row={second} type={type} />
      <LeaderboardPodiumCard row={first} type={type} />
      <LeaderboardPodiumCard row={third} type={type} />
    </div>
  );
}

function LeaderboardLoadingState({ type = "general" }) {
  return (
    <div className="bk-leaderboard-board bk-leaderboard-board--state" aria-label="Loading leaderboard">
      <div className="bk-leaderboard-board-top">
        <StatusBadge tone={type === "levels" ? "info" : "success"}>
          {type === "levels" ? "Level ranking" : "Best score ranking"}
        </StatusBadge>
        <span>Loading</span>
      </div>

      <div className="bk-leaderboard-loading">
        <div className="bk-leaderboard-skeleton-podium">
          <span />
          <span />
          <span />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="bk-leaderboard-skeleton-row" key={index}>
            <span />
            <b />
            <em />
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardEmptyState({ type = "general", message }) {
  return (
    <div className="bk-leaderboard-board bk-leaderboard-board--state">
      <div className="bk-leaderboard-board-top">
        <StatusBadge tone={type === "levels" ? "info" : "success"}>
          {type === "levels" ? "Level ranking" : "Best score ranking"}
        </StatusBadge>
        <span>0 real players</span>
      </div>

      <div className="bk-leaderboard-empty-compact">
        <div className="bk-leaderboard-empty-podium" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <strong>{type === "levels" ? "No levels yet" : "No rankings yet"}</strong>
        <small>
          {message ||
            (type === "levels"
              ? "Earn XP to appear on the levels leaderboard."
              : "Play General Knowledge and be the first player on the board.")}
        </small>
      </div>
    </div>
  );
}

function loadPlayerService() {
  return import("./lib/playerService");
}

async function searchPlayersLazy(query, limit) {
  const { searchPlayers } = await loadPlayerService();
  return searchPlayers(query, limit);
}

function preloadPlayerSearchLazy() {
  loadPlayerService()
    .then(({ preloadPlayerSearchIndex }) => preloadPlayerSearchIndex?.())
    .catch(() => {});
}

async function filterSearchablePlayerGuessQuestionsLazy(questions, context) {
  const { filterSearchablePlayerGuessQuestions } = await loadPlayerService();
  return filterSearchablePlayerGuessQuestions(questions, context);
}

async function loadGeneralQuestions() {
  const { QUESTIONS } = await import("./QUESTIONS");
  return QUESTIONS;
}

async function loadCareerQuestions() {
  const { CAREER_QUESTIONS } = await import("./CAREER_QUESTIONS");
  return CAREER_QUESTIONS;
}

async function loadWorldCupQuestions() {
  const { WORLD_CUP_QUESTIONS } = await import("./WORLD_CUP_QUESTIONS");
  return WORLD_CUP_QUESTIONS;
}

async function loadConnectionsPuzzles() {
  const { CONNECTIONS_PUZZLES } = await import("./CONNECTIONS_PUZZLES");
  return CONNECTIONS_PUZZLES;
}

async function loadWhoAmIQuestions() {
  const { WHO_AM_I_QUESTIONS } = await import("./WHO_AM_I_QUESTIONS");
  return WHO_AM_I_QUESTIONS;
}

const HARD_TIME_LIMIT = 15;
const MULTIPLAYER_TIME_LIMIT = 8;
const MULTIPLAYER_CAREER_TIME_LIMIT = 15;
const TOP_10_REQUIRED_ANSWER_COUNT = 10;
const DAILY_SCAN_STEP_MS = 210;
const AVATAR_ICON_OPTIONS = [
  "⚽",
  "🏆",
  "🔥",
  "🧠",
  "🐐",
  "⭐",
  "👑",
  "🧤",
  "⚡",
  "🎯",
  "🥶",
  "💎",
  "🛡️",
  "🚀",
  "🥅",
  "👟",
  "🎮",
  "🏟️",
  "🦁",
  "🦊",
  "🐺",
  "🐉",
  "🦅",
];
const AVATAR_STYLE_OPTIONS = [
  { value: "classic", label: "Classic" },
  { value: "captain", label: "Captain" },
  { value: "legend", label: "Legend" },
  { value: "goalkeeper", label: "Keeper" },
  { value: "striker", label: "Striker" },
  { value: "ultra", label: "Ultra" },
  { value: "champion", label: "Champion" },
  { value: "academy", label: "Academy" },
  { value: "mystery", label: "Mystery" },
];
const AVATAR_COLOR_OPTIONS = [
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "gold", label: "Gold" },
  { value: "pink", label: "Pink" },
  { value: "ice", label: "Ice" },
  { value: "teal", label: "Teal" },
  { value: "violet", label: "Violet" },
];
const AVATAR_BG_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "stadium", label: "Stadium" },
  { value: "neon", label: "Neon" },
  { value: "pitch", label: "Pitch" },
  { value: "trophy", label: "Trophy" },
  { value: "night", label: "Night" },
  { value: "derby", label: "Derby" },
  { value: "galaxy", label: "Galaxy" },
];
const FAVORITE_NATION_OPTIONS = [
  { country: "Argentina", flag: "🇦🇷" },
  { country: "Brazil", flag: "🇧🇷" },
  { country: "England", flag: "🏴" },
  { country: "France", flag: "🇫🇷" },
  { country: "Germany", flag: "🇩🇪" },
  { country: "Spain", flag: "🇪🇸" },
  { country: "Portugal", flag: "🇵🇹" },
  { country: "Netherlands", flag: "🇳🇱" },
  { country: "Italy", flag: "🇮🇹" },
  { country: "Sweden", flag: "🇸🇪" },
  { country: "Denmark", flag: "🇩🇰" },
  { country: "Norway", flag: "🇳🇴" },
  { country: "USA", flag: "🇺🇸" },
  { country: "Mexico", flag: "🇲🇽" },
  { country: "Japan", flag: "🇯🇵" },
  { country: "South Korea", flag: "🇰🇷" },
  { country: "Morocco", flag: "🇲🇦" },
  { country: "Croatia", flag: "🇭🇷" },
  { country: "Belgium", flag: "🇧🇪" },
  { country: "Uruguay", flag: "🇺🇾" },
];
const MULTIPLAYER_CATEGORIES = [
  { id: "general", label: "General Knowledge", mode: "general", available: true },
  { id: "world_cup", label: "World Cup", mode: "world_cup", available: true },
  {
    id: "premier_league",
    label: "Premier League",
    mode: "premier_league",
    available: true,
  },
  { id: "career_path", label: "Career Path", mode: "career_path", available: true },
];

const LEAGUE_FORMATS = {
  custom: {
    label: "Custom",
    icon: "custom",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "Choose everything manually",
  },
  classic: {
    label: "Classic",
    icon: "classic",
    quizCount: 10,
    top10Count: 0,
    whoamiCount: 0,
    findPlayerCount: 0,
    description: "10 quick questions",
  },
  daily_mix: {
    label: "Daily Mix",
    icon: "dailyMix",
    quizCount: 5,
    top10Count: 1,
    whoamiCount: 1,
    findPlayerCount: 0,
    description: "5 quiz + Top 10 + mystery",
  },
  party_mode: {
    label: "Party Mode",
    icon: "partyMode",
    quizCount: 3,
    top10Count: 2,
    whoamiCount: 2,
    findPlayerCount: 0,
    description: "More Top 10 and mystery rounds",
  },
};

const LEAGUE_DURATIONS = [
  { label: "Infinite", value: null },
  { label: "10 days", value: 10 },
  { label: "20 days", value: 20 },
  { label: "30 days", value: 30 },
];

const CUSTOM_QUIZ_COUNTS = [0, 5, 10, 15];
const CUSTOM_TOP10_COUNTS = [0, 1, 2];
const CUSTOM_WHOAMI_COUNTS = [0, 1, 3, 5];

const CLUB_THEME_MAP = {
  "manchester united": "manchester-united",
  "man united": "manchester-united",
  "real madrid": "real-madrid",
  barcelona: "barcelona",
  juventus: "juventus",
  psg: "psg",
  milan: "milan",
  "ac milan": "milan",
  inter: "inter",
  "bayern munich": "bayern",
  bayern: "bayern",
  liverpool: "liverpool",
  arsenal: "arsenal",
  chelsea: "chelsea",
  ajax: "ajax",
  tottenham: "tottenham",
  "sporting cp": "sporting",
  sporting: "sporting",
  benfica: "benfica",
  dortmund: "dortmund",
  "borussia dortmund": "dortmund",
};

const DAILY_STREAK_REWARDS = [
  { dayInRoad: 1, reward: 10 },
  { dayInRoad: 2, reward: 20 },
  { dayInRoad: 3, reward: 25 },
  { dayInRoad: 4, reward: 35 },
  { dayInRoad: 5, reward: 60 },
  { dayInRoad: 6, reward: 45 },
  { dayInRoad: 7, reward: 100 },
];
const DAILY_STREAK_RESET_HOURS = 30;
const DAILY_STREAK_RESET_MS = DAILY_STREAK_RESET_HOURS * 60 * 60 * 1000;
const DAILY_STREAK_ACTIVITY_KEY = "footballQuizLastDailyActivityAt";

function readRecentGeneralQuestionKeys() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(GENERAL_KNOWLEDGE_RECENT_HISTORY_KEY) || "[]"
    );
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveRecentGeneralQuestionKeys(questionKeys) {
  const uniqueNewest = new Map();

  questionKeys.filter(Boolean).forEach((key) => {
    if (uniqueNewest.has(key)) uniqueNewest.delete(key);
    uniqueNewest.set(key, true);
  });

  const nextKeys = [...uniqueNewest.keys()].slice(
    -GENERAL_KNOWLEDGE_RECENT_HISTORY_LIMIT
  );
  localStorage.setItem(
    GENERAL_KNOWLEDGE_RECENT_HISTORY_KEY,
    JSON.stringify(nextKeys)
  );
}

function rememberGeneralQuestionsServed(questions, snapshot = {}) {
  const currentIndex = Number(snapshot.questionIndex) || 0;
  const seenCount = Math.min(questions.length, Math.max(0, currentIndex) + 1);
  const servedKeys = questions
    .slice(0, seenCount)
    .map(getGeneralKnowledgeQuestionKey)
    .filter(Boolean);

  if (!servedKeys.length) return;

  saveRecentGeneralQuestionKeys([
    ...readRecentGeneralQuestionKeys(),
    ...servedKeys,
  ]);
}

function shuffle(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

function shuffleQuestionOptions(question) {
  if (!Array.isArray(question?.options)) return question;

  if (!question.options.includes(question.answer)) {
    console.warn("Question answer missing from options", question);
    return question;
  }

  return {
    ...question,
    options: shuffle(question.options),
  };
}

function normalizeAnswer(text) {
  return normalizeAnswerText(text);
}

function getAcceptedAnswers(correctAnswer) {
  const answerText = getAnswerLabel(correctAnswer);
  const normalizedCorrect = normalizeAnswer(answerText);
  const aliases = [
    ...(ANSWER_ALIASES[normalizedCorrect] || []),
    ...getAnswerAliases(correctAnswer),
  ];
  const accepted = [answerText, ...aliases];
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

function isCorrectPlayerAnswer(player, correctAnswer) {
  return isPlayerAnswerCorrect({
    selectedPlayer: player,
    correctAnswer,
    acceptedAnswers: getAcceptedAnswers(correctAnswer),
  });
}

function isPlayerLike(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !("nativeEvent" in value) &&
      (value.name ||
        value.full_name ||
        value.search_name ||
        Array.isArray(value.aliases))
  );
}

function isPlayerAnswerType(challenge) {
  return challenge?.answerType === "player";
}

function getAnswerLabel(answer) {
  if (typeof answer === "string") return answer;
  return answer?.answer || answer?.name || answer?.label || "";
}

function getAnswerAliases(answer) {
  if (!answer || typeof answer === "string") return [];
  return answer.aliases || answer.acceptedAnswers || [];
}

function getAnswerValue(answer) {
  if (!answer || typeof answer === "string") return "";
  return answer.value ?? answer.count ?? answer.stat ?? "";
}

function formatAnswerWithValue(answer) {
  const label = getAnswerLabel(answer);
  const value = getAnswerValue(answer);
  return value === "" || value === null || value === undefined
    ? label
    : `${label} — ${value}`;
}

function getAnswerKey(answer, fallback = "") {
  return `${getAnswerLabel(answer)}-${getAnswerValue(answer) || fallback}`;
}

function getGeneralHighscoreXpBonus(finalScore) {
  if (finalScore >= 101) return 5000;
  if (finalScore >= 76) return 3000;
  if (finalScore >= 51) return 2000;
  if (finalScore >= 41) return 1500;
  if (finalScore >= 31) return 1200;
  if (finalScore >= 21) return 900;
  if (finalScore >= 11) return 600;
  if (finalScore >= 1) return 300;
  return 0;
}

function getSeededIndex(seedText, length) {
  if (!length) return 0;

  let seed = 0;
  for (const char of String(seedText)) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  return seed % length;
}

function getDailyWhoAmIQuestionFromBank(questionBank, dateKey) {
  const questions = Array.isArray(questionBank)
    ? questionBank.filter((question) => question?.id && question?.answer)
    : [];

  return selectDailyWhoAmIQuestion(questions, dateKey) || null;
}

function saveDailyModeResult(mode, dateKey, puzzleId, result) {
  if (!mode || !dateKey || !puzzleId) return;

  const storageKey = `ballKnowledgeDailyModeResult:${mode}:${dateKey}:${puzzleId}`;
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      mode,
      date: dateKey,
      puzzleId,
      ...result,
      updatedAt: new Date().toISOString(),
    })
  );
}

function getDailyModeResult(mode, dateKey, puzzleId) {
  if (!mode || !dateKey || !puzzleId) return null;

  try {
    return JSON.parse(
      localStorage.getItem(`ballKnowledgeDailyModeResult:${mode}:${dateKey}:${puzzleId}`) ||
        "null"
    );
  } catch {
    return null;
  }
}

function isDateKeyBeforeToday(dateKey) {
  return String(dateKey || "") < getDailyDateKey();
}

function isDateKeyAfterToday(dateKey) {
  return String(dateKey || "") > getDailyDateKey();
}

function hasMissedDailyStreakDay(lastPlayedDate, today = getDailyDateKey()) {
  if (!lastPlayedDate) return false;
  return addDaysToDateKey(lastPlayedDate, 1) < today;
}

function getDailyDateKey() {
  return getTodayDateKey();
}

function getYesterdayDateKey() {
  return addDaysToDateKey(getTodayDateKey(), -1);
}

function getTodayChallenge() {
  const validChallenges = (DAILY_LIST_CHALLENGES || []).filter(
    (challenge) => challenge && challenge.disabled !== true && getChallengeAnswers(challenge).length > 0
  );

  if (validChallenges.length === 0) {
    if (import.meta.env?.DEV) {
      console.warn("No valid Daily/Top 10 challenges available");
    }

    return {
      id: "fallback",
      label: "Daily Challenge",
      question: "Challenge unavailable.",
      answers: [],
    };
  }

  return selectDailyChallenge(validChallenges, getDailyDateKey()) || validChallenges[0];
}

function getRawChallengeAnswers(challenge) {
  return Array.isArray(challenge?.answers) ? challenge.answers : [];
}

function getChallengeAnswers(challenge) {
  return getRawChallengeAnswers(challenge).slice(0, TOP_10_REQUIRED_ANSWER_COUNT);
}

function getChallengeTargetCount(challenge) {
  const answerCount = getChallengeAnswers(challenge).length;
  return Math.min(answerCount, TOP_10_REQUIRED_ANSWER_COUNT);
}

function getChallengeRuleHint(challenge) {
  const answerCount = getChallengeAnswers(challenge).length;
  const targetCount = getChallengeTargetCount(challenge);

  if (!answerCount) return "";
  if (targetCount < TOP_10_REQUIRED_ANSWER_COUNT) {
    return `Find ${targetCount}. Any order accepted.`;
  }

  return "Any order accepted.";
}

const REQUIRED_PLAYER_SEARCH_NAMES = [
  "Emmanuel Emenike",
  "Jamal Musiala",
  "N'Golo Kanté",
  "Lionel Messi",
  "Claudio Marchisio",
  "Harry Kewell",
  "Kylian Mbappé",
  "Sergio Agüero",
  "Mesut Özil",
  "Luka Modrić",
  "Gerard Piqué",
  "Zlatan Ibrahimović",
  "Kevin De Bruyne",
  "Virgil van Dijk",
];

function getStreakReward(streak) {
  const dayInRoad = ((Math.max(1, streak) - 1) % 7) + 1;

  return (
    DAILY_STREAK_REWARDS.find((reward) => reward.dayInRoad === dayInRoad)
      ?.reward || 10
  );
}

function getStreakRoadStart(streak) {
  return Math.floor(Math.max(0, streak - 1) / 7) * 7 + 1;
}

function getStreakRoadDays(streak) {
  const start = getStreakRoadStart(streak);

  return DAILY_STREAK_REWARDS.map((reward, index) => ({
    day: start + index,
    dayInRoad: reward.dayInRoad,
    reward: reward.reward,
  }));
}

function getNextStreakRewardInfo(streak, todayCompleted = false) {
  const nextDay = todayCompleted ? streak + 1 : Math.max(1, streak + 1);
  return {
    day: nextDay,
    reward: getStreakReward(nextDay),
  };
}

function getDailyStreakHeroCopy(streak, todayCompleted) {
  if (streak <= 0) {
    return {
      label: "Start your streak",
      body: "Play Daily Challenge to begin today's reward road.",
    };
  }

  if (todayCompleted) {
    return {
      label: "Today complete",
      body: "Today's reward is locked in.",
    };
  }

  return {
    label: "Keep it alive",
    body: "Play Daily Challenge to claim today's reward.",
  };
}

function DailyRewardSlot({ day, reached, currentDay }) {
  const prefersReducedMotion = useReducedMotion();
  const isMilestone = day.dayInRoad === 7;
  const stateLabel = reached ? "Claimed" : currentDay ? "Today" : "Upcoming";
  const StateIcon = reached
    ? CheckCircle2
    : currentDay
    ? Flame
    : isMilestone
    ? Trophy
    : Coins;

  return (
    <motion.div
      className={`bk-daily-streak-day ${reached ? "is-claimed" : ""} ${
        currentDay ? "is-today" : ""
      } ${isMilestone ? "is-milestone" : ""}`}
      aria-label={`Day ${day.day}, ${stateLabel.toLowerCase()}, ${day.reward} coins`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: prefersReducedMotion || !currentDay ? 1 : 1.02 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="bk-daily-streak-day__icon" aria-hidden="true">
        <StateIcon size={currentDay ? 23 : 20} />
      </span>
      <span className="bk-daily-streak-day__copy">
        <strong>Day {day.day}</strong>
        <small>{stateLabel}</small>
      </span>
      <span className="bk-daily-streak-day__reward">
        <Coins size={13} aria-hidden="true" />
        +{day.reward}
      </span>
    </motion.div>
  );
}

function isDailyStreakExpired(lastActivityAt, now = Date.now()) {
  const timestamp = Number(lastActivityAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return now - timestamp > DAILY_STREAK_RESET_MS;
}

function buildGameQuestionsFromBank(mode = "general", questionBank = []) {
  if (mode === "career") {
    return shuffle(questionBank);
  }

  if (mode === "world-cup") {
    const easy = questionBank.filter((q) => q.difficulty === "Easy");
    const medium = questionBank.filter((q) => q.difficulty === "Medium");
    const hard = questionBank.filter((q) => q.difficulty === "Hard");
    const veryHard = questionBank.filter(
      (q) => q.difficulty === "Very Hard"
    );

    return [
      ...shuffle(easy).slice(0, 10),
      ...shuffle(medium).slice(0, 15),
      ...shuffle(hard).slice(0, 25),
      ...shuffle(veryHard),
    ].map(shuffleQuestionOptions);
  }

  return buildGeneralKnowledgeQuestions(questionBank);
}

async function buildGameQuestions(mode = "general", options = {}) {
  if (mode === "career") {
    return buildGameQuestionsFromBank(mode, await loadCareerQuestions());
  }

  if (mode === "world-cup") {
    return buildGameQuestionsFromBank(mode, await loadWorldCupQuestions());
  }

  return buildGeneralKnowledgeQuestions(await loadGeneralQuestions(), {
    recentQuestionKeys: options.recentQuestionKeys || [],
  });
}

const screenTransition = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.985 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

function ScreenTransition({ children, className = "screen-transition" }) {
  return (
    <motion.div className={`${className} app-page-content`} {...screenTransition}>
      {children}
    </motion.div>
  );
}

function CareerPathQuestionView({ question, className = "" }) {
  const clubs = getCareerPathClubs(question);

  return (
    <div className={`career-journey-card ${className}`}>
      <div className="career-journey-kicker">Guess the player</div>
      <div className="career-journey-path">
        {clubs.map((club, index) => (
          <React.Fragment key={`${club}-${index}`}>
            <motion.div
              className={`career-club-pill club-${getClubThemeClass(club)}`}
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.045, duration: 0.2 }}
            >
              {club}
            </motion.div>
            {index < clubs.length - 1 && (
              <div className="career-path-arrow">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function getRandomConnectionsPuzzleFromBank(puzzleBank, difficulty = null) {
  const puzzles = difficulty
    ? puzzleBank.filter((puzzle) => puzzle.difficulty === difficulty)
    : puzzleBank;

  const safePuzzles = puzzles.length > 0 ? puzzles : puzzleBank;

  return safePuzzles[Math.floor(Math.random() * safePuzzles.length)];
}

function isCorrectWhoAmIPlayerAnswer(player, question, typedText = "") {
  return isPlayerAnswerMatch({
    typedText,
    selectedPlayer: player,
    answer: question,
  });
}

function getSavedDailyResult() {
  const saved = localStorage.getItem("ballKnowledgeDailyResult");

  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem("ballKnowledgeDailyResult");
    return null;
  }
}

function getModeLabel(mode) {
  if (mode === "world-cup" || mode === "world_cup") return "World Cup";
  if (mode === "premier_league") return "Premier League";
  if (mode === "career" || mode === "career_path") return "Career Path";
  return "General";
}

function getCareerPathClubs(question = "") {
  return String(question)
    .split(/\s*(?:→|->)\s*/)
    .map((club) => club.trim())
    .filter(Boolean);
}

function getClubThemeClass(club) {
  const key = normalizeAnswer(club).replace(/-/g, " ");
  return CLUB_THEME_MAP[key] || "default";
}

function withShuffledOptions(question) {
  return shuffleQuestionOptions(question);
}

function getLeagueFormatConfig(
  format,
  customQuizCount,
  customTop10Count,
  customWhoAmICount,
) {
  if (format !== "custom") {
    const config = LEAGUE_FORMATS[format] || LEAGUE_FORMATS.custom;
    return {
      ...config,
      findPlayerCount: 0,
      findPlayerScoringMode: "attempts",
      maxDailyPoints:
        config.quizCount +
        config.top10Count * 10 +
        config.whoamiCount * 10,
    };
  }

  const quizCount = Number(customQuizCount);
  const top10Count = Number(customTop10Count);
  const whoamiCount = Number(customWhoAmICount);
  const parts = [
    quizCount > 0 ? `${quizCount} quick questions` : "",
    top10Count > 0 ? `${top10Count} Top 10` : "",
    whoamiCount > 0 ? `${whoamiCount} Who Am I` : "",
  ].filter(Boolean);

  return {
    ...LEAGUE_FORMATS.custom,
    quizCount,
    top10Count,
    whoamiCount,
    findPlayerCount: 0,
    findPlayerScoringMode: "attempts",
    maxDailyPoints:
      quizCount + top10Count * 10 + whoamiCount * 10,
    description: parts.join(" + ") || "Choose your daily structure",
  };
}

function getSupportedLeagueSettings(settings = {}) {
  const quizCount = Number(settings.quizCount) || 0;
  const top10Count = Number(settings.top10Count) || 0;
  const whoamiCount = Number(settings.whoamiCount) || 0;

  return {
    ...settings,
    quizCount,
    top10Count,
    whoamiCount,
    findPlayerCount: 0,
    findPlayerScoringMode: "attempts",
    maxDailyPoints: quizCount + top10Count * 10 + whoamiCount * 10,
  };
}

function createMockOpponentScore(finalScore) {
  const swing = Math.floor(Math.random() * 9) - 4;
  return Math.max(0, finalScore + swing);
}

function getCategoryLabel(categoryId) {
  if (categoryId === "world-cup") return "World Cup";
  if (categoryId === "premier_league") return "Premier League";
  if (categoryId === "career_path") return "Career Path";

  return (
    MULTIPLAYER_CATEGORIES.find((category) => category.id === categoryId)
      ?.label || "General"
  );
}

function getMultiplayerQuestionTimeLimit(categoryId) {
  return categoryId === "career_path"
    ? MULTIPLAYER_CAREER_TIME_LIMIT
    : MULTIPLAYER_TIME_LIMIT;
}

function getLeagueScoreValue(source, snakeKey, camelKey = snakeKey) {
  return Number(source?.[snakeKey] ?? source?.[camelKey]) || 0;
}

function getLeagueDailyTotal(source) {
  return getLeagueScoreValue(source, "total_points", "totalPoints");
}

function getLeagueScoreItems(source, settings, top10MaxPoints, whoamiMaxPoints) {
  if (!source) return [];

  return [
    settings.quizCount > 0
      ? {
          key: "quick",
          label: "Quick",
          value: getLeagueScoreValue(source, "quiz_score", "quizScore"),
          max: settings.quizCount,
          display: `${getLeagueScoreValue(source, "quiz_score", "quizScore")}/${settings.quizCount}`,
        }
      : null,
    settings.top10Count > 0
      ? {
          key: "top10",
          label: "Top 10",
          value: getLeagueScoreValue(source, "top10_score", "top10Score"),
          max: top10MaxPoints,
          display: `${getLeagueScoreValue(source, "top10_score", "top10Score")} pts`,
        }
      : null,
    settings.whoamiCount > 0
      ? {
          key: "whoami",
          label: "Who Am I",
          value: getLeagueScoreValue(source, "whoami_score", "whoamiScore"),
          max: whoamiMaxPoints,
          display: `${getLeagueScoreValue(source, "whoami_score", "whoamiScore")} pts`,
        }
      : null,
  ].filter(Boolean);
}

function getCurrentPlayerSlot(match, playerId, username) {
  if (!match) return null;

  if (match.player1_id && String(match.player1_id) === String(playerId)) return "player1";
  if (match.player2_id && String(match.player2_id) === String(playerId)) return "player2";

  const hasCanonicalPlayerIds = Boolean(match.player1_id || match.player2_id);
  if (!hasCanonicalPlayerIds && username) {
    if (match.player1_username === username) return "player1";
    if (match.player2_username === username) return "player2";
  }

  return null;
}

function getOpponentName(match, playerId, username) {
  const playerSlot = getCurrentPlayerSlot(match, playerId, username);

  if (playerSlot === "player1") {
    return match?.player2_username || "your opponent";
  }

  if (playerSlot === "player2") {
    return match?.player1_username || "your opponent";
  }

  return match?.player2_username || match?.player1_username || "your opponent";
}

function isCurrentPlayersTurn(match, playerId, username) {
  if (!match) return false;

  if (match.current_turn_id) {
    return String(match.current_turn_id) === String(playerId);
  }

  const hasCanonicalPlayerIds = Boolean(match.player1_id || match.player2_id);
  return !hasCanonicalPlayerIds && match.current_turn === username;
}

function hasPlayerFinishedRound(round, playerSlot) {
  if (!round || !playerSlot) return false;

  return playerSlot === "player1"
    ? Boolean(round.player1_finished)
    : Boolean(round.player2_finished);
}

function getMatchActionLabel(match, latestRound, playerSlot, isPlayerTurn) {
  if (!match) return "Open match";

  if (match.is_public && match.phase === "waiting_for_opponent") {
    return match.player2_id
      ? "Waiting for your opponent"
      : "Waiting for random opponent";
  }

  if (match.phase === "waiting_for_opponent" || match.status === "waiting") {
    return "Waiting for opponent to join";
  }

  if (match.phase === "choose_category") {
    return isPlayerTurn
      ? "Your turn: choose category"
      : "Waiting for opponent to choose";
  }

  if (match.phase === "round_active") {
    return hasPlayerFinishedRound(latestRound, playerSlot)
      ? "Waiting for opponent to answer"
      : "Your turn: play round";
  }

  if (match.phase === "round_finished") {
    return "Round finished";
  }

  return match.status || "Open match";
}

function getMatchActionKind(match, latestRound, playerSlot, isPlayerTurn) {
  if (!match) return "neutral";

  if (match.is_public && match.phase === "waiting_for_opponent") {
    return "waiting";
  }

  if (match.phase === "waiting_for_opponent" || match.status === "waiting") {
    return "waiting-join";
  }

  if (match.phase === "choose_category") {
    return isPlayerTurn ? "your-turn" : "waiting";
  }

  if (match.phase === "round_active") {
    return hasPlayerFinishedRound(latestRound, playerSlot) ? "waiting" : "your-turn";
  }

  if (match.phase === "round_finished") {
    return "result";
  }

  return "neutral";
}

function getMatchCtaLabel(actionKind, match) {
  if (match?.is_public && match.phase === "waiting_for_opponent") {
    return match.player2_id ? "Open Match" : "View Saved Score";
  }

  if (actionKind === "your-turn" && match?.phase === "choose_category") {
    return "Choose Category";
  }

  if (actionKind === "your-turn" && match?.phase === "round_active") {
    return "Play Turn";
  }

  if (actionKind === "waiting") return "Waiting";
  if (actionKind === "result") return "View Result";

  return "Open Match";
}

function getCategoryClass(categoryId) {
  if (categoryId === "world-cup" || categoryId === "world_cup") {
    return "category-world-cup";
  }

  if (categoryId === "premier_league") return "category-premier-league";
  if (categoryId === "career_path") return "category-career-path";

  return "category-general";
}

function buildGeneralLeaderboardRow(row, index, playerId, rankOverride) {
  return {
    ...row,
    username: row.display_name || row.username || "Player",
    score: Number(row.best_score) || 0,
    rank: rankOverride ?? index + 1,
    isCurrentUser: row.id === playerId,
  };
}

function buildLevelLeaderboardRow(row, index, playerId, rankOverride) {
  const levelId = Math.max(1, Number(row.level_id) || 1);
  const level = getLevelById(levelId);

  return {
    ...row,
    username: row.display_name || row.username || "Player",
    levelId,
    levelName: level.name,
    xpTotal: Number(row.xp_total) || 0,
    rank: rankOverride ?? index + 1,
    isCurrentUser: row.id === playerId,
  };
}

export default function FootballQuizMVP() {
  const prefersReducedMotion = useReducedMotion();
  const todayChallenge = getTodayChallenge();
  const dailyAnswers = getChallengeAnswers(todayChallenge);
  const dailyTargetCount = getChallengeTargetCount(todayChallenge);
  const dailyRuleHint = getChallengeRuleHint(todayChallenge);
  const dailyChallengeUnavailable = dailyAnswers.length === 0;

  const [gameStarted, setGameStarted] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [multiplayerStep, setMultiplayerStep] = useState("menu");
  const [multiplayerMode, setMultiplayerMode] = useState("general");
  const [activeMatch, setActiveMatch] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [matchRounds, setMatchRounds] = useState([]);
  const [, setNextCategoryPickerOpen] = useState(false);
  const [multiplayerRoundOpen, setMultiplayerRoundOpen] = useState(false);
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const playNowRequestRef = useRef(false);
  const createMatchRequestRef = useRef(false);
  const joinMatchRequestRef = useRef(false);
  const categoryRequestRef = useRef(false);
  const submitRoundRequestRef = useRef(false);
  const deleteMatchRequestRef = useRef(false);
  const guestIdentityRequestRef = useRef(null);
  const [multiplayerRoomCode, setMultiplayerRoomCode] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [multiplayerLoading, setMultiplayerLoading] = useState(false);
  const [multiplayerError, setMultiplayerError] = useState("");
  const [activeGames, setActiveGames] = useState([]);
  const [activeGamesLoading, setActiveGamesLoading] = useState(false);
  const [playNowGames, setPlayNowGames] = useState([]);
  const [playNowGamesLoading, setPlayNowGamesLoading] = useState(false);
  const [playNowCategory] = useState("general");
  const [matchDeleteCandidate, setMatchDeleteCandidate] = useState(null);
  const [deletingMatchId, setDeletingMatchId] = useState(null);
  const [multiplayerNotice, setMultiplayerNotice] = useState("");
  const [roomCodeCopyStatus, setRoomCodeCopyStatus] = useState("");
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [leagueDurationInput, setLeagueDurationInput] = useState(null);
  const [leagueFormatInput, setLeagueFormatInput] = useState("custom");
  const [leagueCustomQuizCount, setLeagueCustomQuizCount] = useState(5);
  const [leagueCustomTop10Count, setLeagueCustomTop10Count] = useState(1);
  const [leagueCustomWhoAmICount, setLeagueCustomWhoAmICount] = useState(0);
  const [leagueCodeInput, setLeagueCodeInput] = useState("");
  const [myLeagues, setMyLeagues] = useState([]);
  const [leagueDashboard, setLeagueDashboard] = useState(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueChallengeOpen, setLeagueChallengeOpen] = useState(false);
  const [leagueChallengePhase, setLeagueChallengePhase] = useState("intro");
  const [leagueLeaveConfirmOpen, setLeagueLeaveConfirmOpen] = useState(false);
  const [leagueExitConfirmOpen, setLeagueExitConfirmOpen] = useState(false);
  const [leagueAttemptSubmitting, setLeagueAttemptSubmitting] = useState(false);
  const [leagueQuizQuestions, setLeagueQuizQuestions] = useState([]);
  const [leagueQuizIndex, setLeagueQuizIndex] = useState(0);
  const [leagueQuizSelected, setLeagueQuizSelected] = useState(null);
  const [leagueQuizScore, setLeagueQuizScore] = useState(0);
  const [leagueTimeLeft, setLeagueTimeLeft] = useState(15);
  const [leagueTop10Challenge, setLeagueTop10Challenge] = useState(null);
  const [leagueTop10Challenges, setLeagueTop10Challenges] = useState([]);
  const [leagueTop10Index, setLeagueTop10Index] = useState(0);
  const [leagueTop10TotalScore, setLeagueTop10TotalScore] = useState(0);
  const [leagueTop10Input, setLeagueTop10Input] = useState("");
  const [leagueTop10SelectedPlayer, setLeagueTop10SelectedPlayer] = useState(null);
  const [leagueTop10Found, setLeagueTop10Found] = useState([]);
  const [leagueTop10Lives, setLeagueTop10Lives] = useState(3);
  const [leagueTop10Reveal, setLeagueTop10Reveal] = useState(null);
  const [leagueTop10Scanning, setLeagueTop10Scanning] = useState(false);
  const [leagueWhoAmIQuestions, setLeagueWhoAmIQuestions] = useState([]);
  const [leagueWhoAmIIndex, setLeagueWhoAmIIndex] = useState(0);
  const [leagueWhoAmIClueIndex, setLeagueWhoAmIClueIndex] = useState(0);
  const [leagueWhoAmIInput, setLeagueWhoAmIInput] = useState("");
  const [leagueWhoAmISelectedPlayer, setLeagueWhoAmISelectedPlayer] = useState(null);
  const [leagueWhoAmIScore, setLeagueWhoAmIScore] = useState(0);
  const [leagueWhoAmIFeedback, setLeagueWhoAmIFeedback] = useState(null);
  const [leagueWhoAmIShake, setLeagueWhoAmIShake] = useState(0);
  const [leagueResult, setLeagueResult] = useState(null);
  const [isMockMultiplayer, setIsMockMultiplayer] = useState(false);
  const [mockOpponentScore, setMockOpponentScore] = useState(null);
  const [coinsMenuOpen, setCoinsMenuOpen] = useState(false);
  const [coinShopNotice, setCoinShopNotice] = useState("");
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [xpToast, setXpToast] = useState(null);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [levelLeaderboardRows, setLevelLeaderboardRows] = useState([]);
  const [currentLeaderboardRow, setCurrentLeaderboardRow] = useState(null);
  const [currentLevelLeaderboardRow, setCurrentLevelLeaderboardRow] = useState(null);
  const [leaderboardTab, setLeaderboardTab] = useState("general");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [gameMode, setGameMode] = useState("general");
  const [authSession, setAuthSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [startupReleased, setStartupReleased] = useState(false);
  const startupStartedAtRef = useRef(Date.now());
  const [authMode, setAuthMode] = useState("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [guestMode, setGuestMode] = useState(
    () => localStorage.getItem("ballKnowledgeGuestMode") === "true"
  );
  const [authPrompt, setAuthPrompt] = useState(null);

  const [username, setUsername] = useState(() => {
    return localStorage.getItem("ballKnowledgeUsername") || "";
  });

  const [guestPlayerId] = useState(getOrCreatePlayerId);
  const effectiveAuthUser = authUser || authSession?.user || null;
  const effectiveAuthUserId = effectiveAuthUser?.id || null;
  const isAnonymousGuest = isAnonymousAuthUser(effectiveAuthUser);
  const playerId = effectiveAuthUser?.id || guestPlayerId;
  const isGuest = !effectiveAuthUser || isAnonymousGuest || guestMode;
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("local");
  const [profileError, setProfileError] = useState("");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [profileLookup, setProfileLookup] = useState({});
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [avatarEmoji, setAvatarEmoji] = useState(() => {
    return localStorage.getItem("ballKnowledgeAvatarEmoji") || "profile";
  });
  const [favoriteCountry, setFavoriteCountry] = useState(() => {
    return localStorage.getItem("ballKnowledgeFavoriteCountry") || "Argentina";
  });
  const [favoriteFlag, setFavoriteFlag] = useState(() => {
    return localStorage.getItem("ballKnowledgeFavoriteFlag") || "🇦🇷";
  });

  const [nameInput, setNameInput] = useState(() => {
    return localStorage.getItem("ballKnowledgeUsername") || "";
  });

  const [questions, setQuestions] = useState([]);
  const [modeLoading, setModeLoading] = useState(false);

  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    if (document.body.classList.contains("capacitor-ios")) return undefined;

    let cancelled = false;
    const runStartupAudits = async () => {
      const contentWarnings = auditDailyListChallenges();
      const [generalQuestions, careerQuestions, whoAmIQuestions] = await Promise.all([
        loadGeneralQuestions(),
        loadCareerQuestions(),
        loadWhoAmIQuestions(),
      ]);
      const generalAudit = auditGeneralKnowledgeQuestionBank(generalQuestions);

      if (
        generalAudit.malformed.length ||
        generalAudit.duplicateIds.length ||
        generalAudit.exactDuplicateQuestions.length
      ) {
        console.info("General Knowledge question audit", {
          total: generalAudit.total,
          counts: generalAudit.counts,
          malformed: generalAudit.malformed.length,
          duplicateIds: generalAudit.duplicateIds.length,
          exactDuplicateQuestions: generalAudit.exactDuplicateQuestions.length,
          normalizedDuplicateQuestions:
            generalAudit.normalizedDuplicateQuestions.length,
          identicalQuestionAnswers: generalAudit.identicalQuestionAnswers.length,
        });
      }

      if (contentWarnings.length) {
        console.warn("Daily/Top 10 content audit warnings", contentWarnings);
      }

      const missing = [];
      const targets = [
        ...careerQuestions.map((question) => ({
          mode: "career",
          id: question.id || question.question,
          answer: question.answer,
        })),
        ...whoAmIQuestions.map((question) => ({
          mode: "who-am-i",
          id: question.id || question.answer,
          answer: question,
        })),
        ...DAILY_LIST_CHALLENGES.filter(isPlayerAnswerType).flatMap((challenge) =>
          getChallengeAnswers(challenge).map((answer, index) => ({
            mode: "daily-list",
            id: `${challenge.id || "daily"}:${index}`,
            answer,
          }))
        ),
        ...REQUIRED_PLAYER_SEARCH_NAMES.map((answer) => ({
          mode: "required-player",
          id: answer,
          answer,
        })),
      ];

      for (const target of targets) {
        const answerLabel = getAnswerLabel(target.answer);
        if (!answerLabel) continue;
        const { players } = await searchPlayersLazy(answerLabel, 8);
        const found = players.some((player) =>
          isPlayerAnswerCorrect({
            selectedPlayer: player,
            correctAnswer: target.answer,
          })
        );

        if (!found) {
          const { players: closeMatches } = await searchPlayersLazy(answerLabel.split(" ").at(-1), 4);
          missing.push({
            mode: target.mode,
            id: target.id,
            answer: answerLabel,
            closest: closeMatches.map((player) => player.name),
          });
        }
      }

      if (!cancelled && missing.length) {
        console.warn("Player-answer content missing from shared search index", missing);
      }
    };

    const auditTimer = window.setTimeout(() => {
      runStartupAudits().catch((error) => {
        console.warn("Startup content audits failed", error);
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(auditTimer);
    };
  }, []);

  const [questionIndex, setQuestionIndex] = useState(0);

  const [selected, setSelected] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [careerSelectedPlayer, setCareerSelectedPlayer] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(HARD_TIME_LIMIT);

  const [highScore, setHighScore] = useState(() => {
    return Number(localStorage.getItem("footballQuizHighScore")) || 0;
  });
  const [runStartHighScore, setRunStartHighScore] = useState(() => {
    return Number(localStorage.getItem("footballQuizHighScore")) || 0;
  });
  const [runId, setRunId] = useState(() => Date.now());
  const [highScoreBonusAwarded, setHighScoreBonusAwarded] = useState(false);
  const [runStartProgression, setRunStartProgression] = useState(null);
  const [generalRunXpSummary, setGeneralRunXpSummary] = useState({
    correct: 0,
    streak: 0,
    highscore: 0,
  });
  const [generalGameSnapshot, setGeneralGameSnapshot] = useState(null);
  const [generalResumeVersion, setGeneralResumeVersion] = useState(0);
  const [worldCupGameSnapshot, setWorldCupGameSnapshot] = useState(null);
  const [worldCupResumeVersion, setWorldCupResumeVersion] = useState(0);
  const [careerGameSnapshot, setCareerGameSnapshot] = useState(null);
  const [careerResumeVersion, setCareerResumeVersion] = useState(0);
  const [objectiveProgressUpdate, setObjectiveProgressUpdate] = useState(null);
  const [postGameStep, setPostGameStep] = useState("summary");

  const [coins, setCoins] = useState(() => {
    return Number(localStorage.getItem("footballQuizCoins")) || 0;
  });
  const [xpTotal, setXpTotal] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).xpTotal
  );
  const [progressionStats, setProgressionStats] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).stats
  );
  const [careerLevelId, setCareerLevelId] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).levelId
  );
  const [claimedLevelIds, setClaimedLevelIds] = useState(() =>
    getInitialProgression({
      highScore: Number(localStorage.getItem("footballQuizHighScore")) || 0,
    }).claimedLevelIds
  );

  const [revivesUsed, setRevivesUsed] = useState(0);
  const [rewardPopup, setRewardPopup] = useState(null);
  const [coinRewardToast, setCoinRewardToast] = useState(null);
  const [wrongPopup, setWrongPopup] = useState(null);

  const [foundAnswers, setFoundAnswers] = useState([]);
  const [dailyCoinsEarned, setDailyCoinsEarned] = useState(0);
  const [top10ResumeVersion, setTop10ResumeVersion] = useState(0);

  const [dailyPlayed, setDailyPlayed] = useState(() => {
    return localStorage.getItem("ballKnowledgeDailyDate") === getDailyDateKey();
  });

  const [lastDailyResult, setLastDailyResult] = useState(() => {
    return getSavedDailyResult();
  });

  const [dailyStreak, setDailyStreak] = useState(() => {
    return Number(localStorage.getItem("footballQuizDailyStreak")) || 0;
  });

  const [lastDailyPlayedDate, setLastDailyPlayedDate] = useState(() => {
    return localStorage.getItem("footballQuizLastDailyPlayedDate") || "";
  });
  const [lastDailyActivityAt, setLastDailyActivityAt] = useState(() => {
    return Number(localStorage.getItem(DAILY_STREAK_ACTIVITY_KEY)) || 0;
  });

  const [streakRewardEarned, setStreakRewardEarned] = useState(0);
  const [showDailyCompletePopup, setShowDailyCompletePopup] = useState(false);
  const [dailyRewardMeterOpen, setDailyRewardMeterOpen] = useState(false);

  const [levelUpPopup, setLevelUpPopup] = useState(null);
  const [connectionsPuzzle, setConnectionsPuzzle] = useState(null);
  const [connectionsDifficultyPickerOpen, setConnectionsDifficultyPickerOpen] = useState(false);
  const [connectionPuzzleCounts, setConnectionPuzzleCounts] = useState({});
  const [connectionsRewardModal, setConnectionsRewardModal] = useState(null);
  const [connectionsResumeVersion, setConnectionsResumeVersion] = useState(0);
  const [whoAmIQuestion, setWhoAmIQuestion] = useState(null);
  const [whoAmIGameSnapshot, setWhoAmIGameSnapshot] = useState(null);
  const [whoAmIResumeVersion, setWhoAmIResumeVersion] = useState(0);
  const [whoAmIDate, setWhoAmIDate] = useState(getDailyDateKey);

  const current = questions[questionIndex];
  const currentRoundQuestionNumber = ((questionIndex % 10) + 1);
  const isDailyPlayerChallenge = isPlayerAnswerType(todayChallenge);
  const progressionView = useMemo(
    () =>
      getProgressionView({
        xpTotal,
        levelId: careerLevelId,
        stats: {
          ...progressionStats,
          best_general_score: Math.max(
            highScore,
            Number(progressionStats.best_general_score) || 0
          ),
        },
      }),
    [xpTotal, careerLevelId, progressionStats, highScore]
  );
  const playerLevel = {
    ...progressionView.currentLevel,
    levelNumber: progressionView.currentLevel.id,
    next: progressionView.nextLevel,
    progress: progressionView.objectiveProgress,
    pointsToNext: Math.max(
      0,
      Number(
        progressionView.objectives.find(
          (objective) => objective.statKey === "xp_total"
        )?.required
      ) - xpTotal
    ),
  };
  const displayName = profile?.display_name || profile?.username || username;
  const profileAvatarEmoji = profile?.avatar_icon || profile?.avatar_emoji || avatarEmoji || "profile";
  const profileAvatar = getAvatarConfig({
    ...(profile || {}),
    avatar_icon: profile?.avatar_icon || profileAvatarEmoji,
    avatar_emoji: profile?.avatar_emoji || profileAvatarEmoji,
    avatar_style: profile?.avatar_style || "classic",
    avatar_color: profile?.avatar_color || "green",
    avatar_bg: profile?.avatar_bg || "dark",
    favorite_country: profile?.favorite_country || favoriteCountry,
    favorite_flag: profile?.favorite_flag || favoriteFlag,
  });
  const avatarBuilderPreview = getAvatarConfig(avatarDraft || profileAvatar);
  const profileStats = {
    multiplayerWins: profile?.multiplayer_wins || 0,
    multiplayerLosses: profile?.multiplayer_losses || 0,
    multiplayerDraws: profile?.multiplayer_draws || 0,
    multiplayerMatches: profile?.multiplayer_matches || 0,
  };
  const xpObjective = progressionView.objectives.find(
    (objective) => objective.statKey === "xp_total"
  );
  const xpProgressPercent = xpObjective?.required
    ? Math.min(100, (Math.max(0, Number(xpTotal) || 0) / xpObjective.required) * 100)
    : progressionView.objectiveProgress;
  const xpProgressLabel = xpObjective?.required
    ? `${Math.min(Number(xpTotal) || 0, xpObjective.required).toLocaleString()} / ${xpObjective.required.toLocaleString()} XP`
    : `${(Number(xpTotal) || 0).toLocaleString()} XP`;
  const completedObjectiveCount = progressionView.objectives.filter(
    (objective) => objective.complete
  ).length;
  const levelObjectiveSummary = `${completedObjectiveCount}/${progressionView.objectives.length} objectives`;
  const generalRunXpTotal =
    generalRunXpSummary.correct +
    generalRunXpSummary.streak +
    generalRunXpSummary.highscore;
  const currentHomeViewKey = connectionsDifficultyPickerOpen
  ? "connections-difficulty"
  : profileOpen
  ? "profile"
  : leaderboardOpen
  ? "leaderboard"
  : multiplayerOpen
  ? `multiplayer-${multiplayerStep}`
  : modeMenuOpen
  ? "mode-menu"
  : "home";

  useEffect(() => {
    const iosLayoutDebug =
      import.meta.env?.DEV ||
      document.body.classList.contains("capacitor-ios-debug");

    if (!iosLayoutDebug) {
      return;
    }

    const pageName = leagueChallengeOpen
      ? `league-challenge:${leagueChallengePhase}`
      : gameStarted
      ? gameMode
      : currentHomeViewKey;

    console.log("[ios-page]", pageName);
    console.log("[ios-layout]", "mounted", pageName);
  }, [currentHomeViewKey, gameMode, gameStarted, leagueChallengeOpen, leagueChallengePhase]);

  useEffect(() => {
    const playerHeavyMode =
      gameStarted &&
      ["who-am-i", "career", "daily-list"].includes(gameMode);

    if (playerHeavyMode || leagueChallengeOpen) {
      preloadPlayerSearchLazy();
    }
  }, [gameMode, gameStarted, leagueChallengeOpen]);

const isHomeScreen =
  !gameStarted &&
  !profileOpen &&
  !leaderboardOpen &&
  !multiplayerOpen &&
  !modeMenuOpen &&
  !connectionsDifficultyPickerOpen;
  const hasBothMultiplayerPlayers =
    Boolean(activeMatch?.player1_username) && Boolean(activeMatch?.player2_username);
  const isMultiplayerTurn = isCurrentPlayersTurn(activeMatch, playerId, username);
  const isH2HCreatorOpeningRound =
    activeMatch &&
    !activeMatch.is_public &&
    !activeMatch.player2_id &&
    activeMatch.phase === "choose_category" &&
    getCurrentPlayerSlot(activeMatch, playerId, username) === "player1";
  const canChooseMultiplayerCategory =
    (hasBothMultiplayerPlayers || isH2HCreatorOpeningRound) &&
    (activeMatch?.phase === "choose_category" ||
      activeMatch?.phase === "round_finished") &&
    isMultiplayerTurn;
  const multiplayerPlayerSlot = getCurrentPlayerSlot(
    activeMatch,
    playerId,
    username
  );
  const hasPlayedActiveRound = hasPlayerFinishedRound(
    activeRound,
    multiplayerPlayerSlot
  );
  const isH2HWaitingAfterCreatorRound =
    activeMatch &&
    !activeMatch.is_public &&
    !activeMatch.player2_id &&
    multiplayerPlayerSlot === "player1" &&
    activeMatch.phase === "round_active" &&
    hasPlayedActiveRound;
  const nextCategoryChooserName =
    activeMatch?.current_turn ||
    (isMultiplayerTurn ? username : getOpponentName(activeMatch, playerId, username));
  const nextCategoryWaitingName =
    nextCategoryChooserName && nextCategoryChooserName !== "Opponent"
      ? nextCategoryChooserName
      : "your opponent";
  const activeOpponentName = getOpponentName(activeMatch, playerId, username);
  const activeOpponentLabel =
    activeOpponentName && activeOpponentName !== "your opponent"
      ? activeOpponentName
      : "your opponent";

  useEffect(() => {
    const shouldLog =
      import.meta.env?.DEV ||
      document.body.classList.contains("capacitor-ios-debug");

    if (!shouldLog || !activeMatch?.id || activeMatch.phase !== "round_finished") {
      return;
    }

    console.log("[mp-next-category]", {
      currentUserId: playerId,
      nextChooserId: activeMatch.current_turn_id,
      isCurrentUserChooser: isMultiplayerTurn,
      matchId: activeMatch.id,
      roundNumber: activeMatch.round_number || activeRound?.round_number,
      phase: activeMatch.phase,
      status: activeMatch.status,
    });
  }, [
    activeMatch?.id,
    activeMatch?.current_turn_id,
    activeMatch?.phase,
    activeMatch?.round_number,
    activeMatch?.status,
    activeRound?.round_number,
    isMultiplayerTurn,
    playerId,
  ]);

  useEffect(() => {
    const shouldLog =
      import.meta.env?.DEV ||
      document.body.classList.contains("capacitor-ios-debug");

    if (!shouldLog || !activeMatch?.id || !activeMatch.is_public) {
      return;
    }

    const playerSlot = getCurrentPlayerSlot(activeMatch, playerId, username);
    const opponentSlot = playerSlot === "player1" ? "player2" : "player1";

    console.log("[play-now-match-flow]", {
      matchId: activeMatch.id,
      mode: activeMatch.mode,
      currentUserId: playerId,
      player1Id: activeMatch.player1_id,
      player2Id: activeMatch.player2_id,
      opponentId:
        opponentSlot === "player1" ? activeMatch.player1_id : activeMatch.player2_id,
      opponentName: getOpponentName(activeMatch, playerId, username),
      roundNumber: activeMatch.round_number || activeRound?.round_number,
      phase: activeMatch.phase,
      status: activeMatch.status,
      nextChooserId: activeMatch.current_turn_id,
      isCurrentUserChooser: isMultiplayerTurn,
    });
  }, [
    activeMatch?.id,
    activeMatch?.mode,
    activeMatch?.player1_id,
    activeMatch?.player2_id,
    activeMatch?.round_number,
    activeMatch?.phase,
    activeMatch?.status,
    activeMatch?.current_turn_id,
    activeMatch?.is_public,
    activeRound?.round_number,
    isMultiplayerTurn,
    playerId,
    username,
  ]);
  const activeLeague = leagueDashboard?.league || null;
  const activeLeagueDay = leagueDashboard?.leagueDay || null;
  const activeLeagueSubmission = leagueDashboard?.currentSubmission || null;
  const currentLeagueQuizQuestion = leagueQuizQuestions[leagueQuizIndex];
  const rawLeagueSettings = activeLeague
    ? getLeagueSettingsSummary(activeLeague)
    : getLeagueFormatConfig(
        leagueFormatInput,
        leagueCustomQuizCount,
        leagueCustomTop10Count,
        leagueCustomWhoAmICount
      );
  const leagueSettings = getSupportedLeagueSettings(rawLeagueSettings);
  const leagueTop10Score = leagueTop10Found.length;
  const leagueTop10TargetCount = getChallengeTargetCount(leagueTop10Challenge);
  const leagueTop10MaxPoints =
    leagueTop10Challenges.reduce(
      (total, challenge) => total + getChallengeTargetCount(challenge),
      0
    ) || leagueSettings.top10Count * 10;
  const leagueTop10TotalWithCurrent = leagueTop10TotalScore + leagueTop10Score;
  const isLeagueTop10PlayerChallenge = isPlayerAnswerType(leagueTop10Challenge);
  const currentLeagueWhoAmI = leagueWhoAmIQuestions[leagueWhoAmIIndex];
  const leagueWhoAmIVisibleClues = currentLeagueWhoAmI
    ? currentLeagueWhoAmI.clues.slice(0, leagueWhoAmIClueIndex + 1)
    : [];
  const leagueWhoAmIPointsAvailable = Math.max(1, 10 - leagueWhoAmIClueIndex);
  const leagueWhoAmIMaxPoints = leagueSettings.whoamiCount * 10;
  const leagueDayExpired =
    Boolean(activeLeague?.duration_days) &&
    Boolean(activeLeagueDay?.day_number) &&
    activeLeagueDay.day_number > Number(activeLeague.duration_days);
  const leagueDailyStructureText =
    [
      leagueSettings.quizCount > 0
        ? `${leagueSettings.quizCount} quick questions`
        : "",
      leagueSettings.top10Count > 0
        ? `${leagueSettings.top10Count} Top 10`
        : "",
      leagueSettings.whoamiCount > 0
        ? `${leagueSettings.whoamiCount} Who Am I`
        : "",
    ]
      .filter(Boolean)
      .join(" + ") || "Daily challenge";
  const leagueDayLabel = activeLeagueDay
    ? activeLeague?.duration_days
      ? `Day ${activeLeagueDay.day_number} / ${activeLeague.duration_days}`
      : `Day ${activeLeagueDay.day_number}`
    : "Day";
  const socialProfileIds = useMemo(() => {
    const ids = new Set();

    activeGames.forEach(({ match }) => {
      if (match?.player1_id) ids.add(match.player1_id);
      if (match?.player2_id) ids.add(match.player2_id);
    });

    playNowGames.forEach(({ match }) => {
      if (match?.player1_id) ids.add(match.player1_id);
      if (match?.player2_id) ids.add(match.player2_id);
    });

    if (activeMatch?.player1_id) ids.add(activeMatch.player1_id);
    if (activeMatch?.player2_id) ids.add(activeMatch.player2_id);

    leagueDashboard?.members?.forEach((member) => {
      if (member?.player_id) ids.add(member.player_id);
    });

    leaderboardRows.forEach((row) => {
      if (row?.id) ids.add(row.id);
    });

    return [...ids].filter(Boolean);
  }, [activeGames, playNowGames, activeMatch, leagueDashboard, leaderboardRows]);

  useEffect(() => {
    if (
      !leagueChallengeOpen ||
      leagueChallengePhase !== "quiz" ||
      !currentLeagueQuizQuestion ||
      leagueQuizSelected
    ) {
      return;
    }

    if (leagueTimeLeft <= 0) {
      chooseLeagueQuizAnswer("__time_up__");
      return;
    }

    const timer = window.setTimeout(() => {
      setLeagueTimeLeft((time) => time - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [
    currentLeagueQuizQuestion,
    leagueChallengeOpen,
    leagueChallengePhase,
    leagueQuizSelected,
    leagueTimeLeft,
  ]);

  useEffect(() => {
    if (!isLeagueAttemptLocked()) return;

    saveLeagueAttempt();
  }, [
    leagueChallengeOpen,
    leagueChallengePhase,
    activeLeague?.id,
    activeLeagueDay?.id,
    leagueQuizScore,
    leagueTop10TotalWithCurrent,
    leagueWhoAmIScore,
  ]);

  useEffect(() => {
    if (!isLeagueAttemptLocked()) return undefined;

    const handleBeforeUnload = (event) => {
      saveLeagueAttempt();
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    leagueChallengeOpen,
    leagueChallengePhase,
    activeLeague?.id,
    activeLeagueDay?.id,
    leagueQuizScore,
    leagueTop10TotalWithCurrent,
    leagueWhoAmIScore,
  ]);

  useEffect(() => {
    if (!multiplayerOpen || multiplayerStep !== "active-games") return;

    const interval = window.setInterval(() => {
      fetchActiveGames({ silent: true });
    }, 7000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, playerId, username]);

  useEffect(() => {
    if (!multiplayerOpen || multiplayerStep !== "league-dashboard" || !activeLeague?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      loadLeagueDashboard(activeLeague.id, { silent: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, activeLeague?.id, playerId]);

  useEffect(() => {
    if (!multiplayerOpen || multiplayerStep !== "play-now-waiting" || !activeMatch?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      refreshMultiplayerMatch({ silent: true });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [multiplayerOpen, multiplayerStep, activeMatch?.id]);

  useEffect(() => {
    if (!multiplayerOpen || !activeMatch?.id || !supabase) return;

    const channel = supabase
      .channel(`ball-knowledge-match-${activeMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${activeMatch.id}`,
        },
        () => refreshMultiplayerMatch({ silent: true })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multiplayer_rounds",
          filter: `match_id=eq.${activeMatch.id}`,
        },
        () => refreshMultiplayerMatch({ silent: true })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_players",
          filter: `match_id=eq.${activeMatch.id}`,
        },
        () => refreshMultiplayerMatch({ silent: true })
      )
      .subscribe();

    const fallbackPoll = window.setInterval(() => {
      refreshMultiplayerMatch({ silent: true });
    }, 6000);

    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [activeMatch?.id, multiplayerOpen]);

  useEffect(() => {
    if (!username || !progressionView.canLevelUp) return;
    if (levelUpPopup) return;
    if (objectiveProgressUpdate) return;
    if (postGameStep === "xp") return;
    if (finished && gameMode === "general" && !isMockMultiplayer) return;

    const oldLevel = progressionView.currentLevel;
    const newLevel = progressionView.nextLevel;
    if (!newLevel) return;

    const rewardAlreadyClaimed = claimedLevelIds.some(
      (id) => String(id) === String(newLevel.id)
    );
    const nextClaimedIds = rewardAlreadyClaimed
      ? claimedLevelIds
      : [...claimedLevelIds, newLevel.id];
    const nextLevelId = newLevel.id;
    const coinReward = rewardAlreadyClaimed ? 0 : 250;
    const newCoins = coins + coinReward;
    const popup = {
      oldLevel,
      newLevel,
      unlockedLevels: [newLevel],
      levelsGained: 1,
      coins: coinReward,
    };

    const popupTimer = window.setTimeout(() => {
      playLevelUpSound();
      if (coinReward > 0) {
        playCoinSound();
      }
      setLevelUpPopup(popup);
      setCareerLevelId(nextLevelId);
      setClaimedLevelIds(nextClaimedIds);
      if (coinReward > 0) {
        saveCoins(newCoins);
      }
      persistProgressionState({
        xpTotal,
        levelId: nextLevelId,
        stats: progressionStats,
        claimedLevelIds: nextClaimedIds,
      });
    }, 0);

    return () => window.clearTimeout(popupTimer);
  }, [
    username,
    progressionView.canLevelUp,
    progressionView.currentLevel,
    progressionView.nextLevel,
    levelUpPopup,
    objectiveProgressUpdate,
    postGameStep,
    finished,
    gameMode,
    isMockMultiplayer,
    claimedLevelIds,
    coins,
    xpTotal,
    progressionStats,
  ]);

  useEffect(() => {
    if (gameMode !== "daily-list" || !gameStarted) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [gameMode, gameStarted]);

  useEffect(() => {
    if (postGameStep !== "xp") return;
    if (gameStarted) return;
    if (["general", "world-cup", "career"].includes(gameMode)) return;

    console.error("Invalid post-game progression state; recovering to home", {
      gameMode,
      postGameStep,
    });
    setPostGameStep("summary");
    setFinished(false);
    setGameStarted(false);
  }, [postGameStep, gameStarted, gameMode]);

  useEffect(() => {
    if (!gameStarted) return;
    if (!["general", "world-cup", "career"].includes(gameMode)) return;
    if (current) return;

    exitToHomeSafely("invalid-state");
  }, [gameStarted, gameMode, current]);

  useEffect(() => {
    if (
      !finished ||
      !gameStarted ||
      gameMode !== "general" ||
      isMockMultiplayer ||
      highScoreBonusAwarded
    ) {
      return;
    }

    const highscoreBonus =
      score > runStartHighScore ? getGeneralHighscoreXpBonus(score) : 0;
    const bonusAwarded =
      highscoreBonus > 0 &&
      awardXp({
        key: `general-highscore-finish:${runId}`,
        amount: highscoreBonus,
        label: "New Highscore",
        placement: "global",
      });

    if (bonusAwarded) {
      setGeneralRunXpSummary((summary) => ({
        ...summary,
        highscore: summary.highscore + highscoreBonus,
      }));
    }

    const afterView = getProgressionView({
      xpTotal: xpTotal + (bonusAwarded ? highscoreBonus : 0),
      levelId: careerLevelId,
      stats: {
        ...progressionStats,
        best_general_score: Math.max(
          score,
          highScore,
          Number(progressionStats.best_general_score) || 0
        ),
      },
    });

    const progressUpdate = buildObjectiveProgressUpdate(
      runStartProgression,
      afterView
    );
    if (progressUpdate) {
      window.setTimeout(() => setObjectiveProgressUpdate(progressUpdate), 550);
    }

    setHighScoreBonusAwarded(true);
  }, [
    finished,
    gameStarted,
    gameMode,
    isMockMultiplayer,
    highScoreBonusAwarded,
    score,
    runStartHighScore,
    runId,
    xpTotal,
    careerLevelId,
    progressionStats,
    highScore,
    runStartProgression,
  ]);

  useEffect(() => {
    if (
      !finished ||
      !gameStarted ||
      gameMode !== "general" ||
      isMockMultiplayer ||
      isGuest
    ) {
      return;
    }

    const onlineBestScore = Number(profile?.best_score) || 0;
    const nextBestScore = Math.max(score, highScore, onlineBestScore);

    if (nextBestScore <= onlineBestScore) return;

    updateOnlineProfile(
      {
        best_score: nextBestScore,
        coins,
        daily_streak: dailyStreak,
        xp_total: xpTotal,
        level_id: careerLevelId,
        progression_stats: {
          ...progressionStats,
          best_general_score: Math.max(
            Number(progressionStats.best_general_score) || 0,
            nextBestScore
          ),
        },
      },
      "ready"
    );
  }, [
    finished,
    gameStarted,
    gameMode,
    isMockMultiplayer,
    isGuest,
    score,
    highScore,
    profile?.best_score,
    coins,
    dailyStreak,
    xpTotal,
    careerLevelId,
    progressionStats,
  ]);

  const revivePrices = [500, 1000, 5000];
  const reviveCost = revivePrices[revivesUsed] || null;

  const isTimedQuestion =
    gameStarted &&
    !finished &&
    gameMode === "world-cup" &&
    isMockMultiplayer &&
    ["Hard", "Very Hard"].includes(current?.difficulty);

  useEffect(() => {
    const handleButtonHaptic = (event) => {
      if (
        event.target.closest("button") &&
        typeof navigator !== "undefined" &&
        "vibrate" in navigator
      ) {
        navigator.vibrate(10);
      }
    };

    document.addEventListener("pointerdown", handleButtonHaptic, {
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", handleButtonHaptic);
    };
  }, []);

  useEffect(() => {
    if (!isTimedQuestion) return;

    setTimeLeft(HARD_TIME_LIMIT);
  }, [questionIndex, isTimedQuestion]);

  useEffect(() => {
    const timerActive =
      isTimedQuestion && !selected && !rewardPopup && !objectiveProgressUpdate;

    if (!timerActive) return;

    if (timeLeft <= 0) {
      handleWrongAnswer(current.answer, "Time's up!");
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((time) => time - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    timeLeft,
    isTimedQuestion,
    selected,
    rewardPopup,
    wrongPopup,
    objectiveProgressUpdate,
    current?.answer,
  ]);

  const playClickSound = () => {
    playButtonTapSound();
  };

  const getGuestDisplayName = () => {
    const storedGuestName = localStorage.getItem("ballKnowledgeUsername");

    return (
      username ||
      storedGuestName ||
      `Guest-${String(guestPlayerId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`
    );
  };

  const activateLocalGuestIdentity = (guestName = getGuestDisplayName()) => {
    localStorage.setItem("ballKnowledgeGuestMode", "true");
    localStorage.setItem("ballKnowledgeUsername", guestName);
    setGuestMode(true);
    setUsername(guestName);
    setNameInput(guestName);
    setAuthPrompt(null);
    setAuthError("");
    setAuthNotice("");
  };

  const ensureGuestBackendIdentity = async ({ silent = false } = {}) => {
    if (effectiveAuthUser?.id) {
      return effectiveAuthUser;
    }

    if (!isSupabaseConfigured || !supabase?.auth) {
      if (!silent) {
        setMultiplayerError("Online play is unavailable on this build.");
      }
      return null;
    }

    if (guestIdentityRequestRef.current) {
      return guestIdentityRequestRef.current;
    }

    const guestName = getGuestDisplayName();
    const request = (async () => {
      const { session, user, error } = await signInAnonymously(supabase, {
        username: guestName,
      });

      if (error || !user) {
        if (!silent) {
          setMultiplayerError(
            getFriendlyAuthErrorMessage(error, "Could not start Guest online play")
          );
        }
        return null;
      }

      setAuthSession(session || null);
      setAuthUser(user);
      activateLocalGuestIdentity(guestName);
      await ensureProfileForAuthUser(user, guestName);
      return user;
    })();

    guestIdentityRequestRef.current = request;

    try {
      return await request;
    } finally {
      guestIdentityRequestRef.current = null;
    }
  };

  const continueAsGuest = async () => {
    playClickSound();
    const guestName = getGuestDisplayName();

    activateLocalGuestIdentity(guestName);

    if (!isSupabaseConfigured || !supabase?.auth) {
      setAuthNotice("Guest mode is ready on this device. Online play is unavailable on this build.");
      return;
    }

    setAuthSubmitting(true);
    setAuthNotice("Starting Guest online play...");

    const user = await ensureGuestBackendIdentity();
    setAuthSubmitting(false);

    if (user) {
      setAuthNotice("Guest online play is ready");
    } else {
      setAuthNotice("Guest mode is ready on this device. Online play needs a connection.");
    }
  };

  const resetAuthFormFeedback = () => {
    setAuthError("");
    setAuthNotice("");
  };

  const prepareAuthenticatedIdentity = (user, fallbackUsername = "") => {
    const metadata = user?.user_metadata || {};
    const loadingName =
      fallbackUsername || metadata.username || metadata.display_name || "Loading profile...";

    setGuestMode(false);
    localStorage.removeItem("ballKnowledgeGuestMode");
    setProfile(null);
    setProfileStatus("syncing");
    setProfileError("");
    setUsername(loadingName);
    setNameInput(loadingName === "Loading profile..." ? "" : loadingName);
    setAuthPrompt(null);
  };

  const applyProfileToLocalState = (onlineProfile) => {
    if (!onlineProfile) return;

    const profileUsername =
      onlineProfile.display_name || onlineProfile.username || username;

    setProfile(onlineProfile);
    setUsername(profileUsername);
    setNameInput(profileUsername);
    localStorage.setItem("ballKnowledgeUsername", profileUsername);
    setAvatarEmoji(
      onlineProfile.avatar_icon || onlineProfile.avatar_emoji || avatarEmoji || "profile"
    );
    localStorage.setItem(
      "ballKnowledgeAvatarEmoji",
      onlineProfile.avatar_icon || onlineProfile.avatar_emoji || avatarEmoji || "profile"
    );
    setFavoriteCountry(onlineProfile.favorite_country || favoriteCountry || "Argentina");
    setFavoriteFlag(onlineProfile.favorite_flag || favoriteFlag || "🇦🇷");
    localStorage.setItem(
      "ballKnowledgeFavoriteCountry",
      onlineProfile.favorite_country || favoriteCountry || "Argentina"
    );
    localStorage.setItem(
      "ballKnowledgeFavoriteFlag",
      onlineProfile.favorite_flag || favoriteFlag || "🇦🇷"
    );
    setHighScore((score) => Math.max(score, Number(onlineProfile.best_score) || 0));
    setCoins((value) => Math.max(value, Number(onlineProfile.coins) || 0));
    const onlineStreak = Number(onlineProfile.daily_streak) || 0;
    const onlineProgressionStats = onlineProfile.progression_stats || {};
    const onlineActivityAt = Number(
      onlineProgressionStats.lastDailyActivityAt || 0
    );
    const onlineLastDailyPlayedDate =
      onlineProgressionStats.lastDailyPlayedDate || "";
    const onlineDailyListCompletion =
      onlineProgressionStats.dailyCompletions?.daily_list?.[getDailyDateKey()];
    const storedActivityAt =
      onlineActivityAt || Number(localStorage.getItem(DAILY_STREAK_ACTIVITY_KEY)) || 0;
    const storedLastDailyPlayedDate =
      onlineLastDailyPlayedDate ||
      localStorage.getItem("footballQuizLastDailyPlayedDate") ||
      "";
    const expired =
      hasMissedDailyStreakDay(storedLastDailyPlayedDate) ||
      isDailyStreakExpired(storedActivityAt);
    const hydratedStreak = expired ? 0 : onlineStreak;

    setDailyStreak((value) => (expired ? 0 : Math.max(value, hydratedStreak)));
    if (storedLastDailyPlayedDate) {
      setLastDailyPlayedDate(storedLastDailyPlayedDate);
      localStorage.setItem("footballQuizLastDailyPlayedDate", storedLastDailyPlayedDate);
    }
    if (onlineDailyListCompletion) {
      setDailyPlayed(true);
      localStorage.setItem("ballKnowledgeDailyDate", getDailyDateKey());
      localStorage.setItem(
        "ballKnowledgeDailyResult",
        JSON.stringify({
          date: getDailyDateKey(),
          title: onlineDailyListCompletion.title || "Daily Challenge",
          found: Number(onlineDailyListCompletion.found) || 0,
          total: Number(onlineDailyListCompletion.total) || 0,
          coins: Number(onlineDailyListCompletion.coins) || 0,
          streak: hydratedStreak,
          restoredFromProfile: true,
        })
      );
    }
    if (storedActivityAt) {
      setLastDailyActivityAt(storedActivityAt);
      localStorage.setItem(DAILY_STREAK_ACTIVITY_KEY, String(storedActivityAt));
    }
    hydrateProgressionFromProfile(onlineProfile);
    setProfileStatus("ready");
    setProfileError("");
  };

  const applyAuthFallbackIdentity = (user, fallbackUsername = "") => {
    const metadata = user?.user_metadata || {};
    const fallback =
      fallbackUsername ||
      metadata.username ||
      metadata.display_name ||
      user?.email?.split("@")[0] ||
      "Player";

    setUsername(fallback);
    setNameInput(fallback);
    localStorage.setItem("ballKnowledgeUsername", fallback);
  };

  const ensureProfileForAuthUser = async (user, fallbackUsername = "") => {
    if (!user || !isSupabaseConfigured || !supabase) return null;

    const metadata = user.user_metadata || {};
    const preferredUsername =
      fallbackUsername ||
      metadata.username ||
      metadata.display_name ||
      user.email?.split("@")[0] ||
      "ball.knowledge";

    const { profile: existingProfile, error: fetchError } = await fetchProfile(
      supabase,
      user.id
    );

    if (fetchError) {
      console.warn("Could not load auth profile", fetchError);
      applyAuthFallbackIdentity(user, preferredUsername);
      setProfileStatus("local");
      setProfileError("");
      return null;
    }

    if (existingProfile) {
      const mergedUpdates = mergeLocalProgressIntoProfile(existingProfile, {
        highScore,
        coins,
        dailyStreak,
        xpTotal,
        levelId: careerLevelId,
      progressionStats,
      avatar: profileAvatar,
      avatarEmoji,
      favoriteCountry,
      favoriteFlag,
    });
      const { profile: mergedProfile, error: mergeError } = await updateProfile(
        supabase,
        user.id,
        mergedUpdates
      );
      const safeProfile = mergeError ? existingProfile : mergedProfile || existingProfile;

      applyProfileToLocalState(safeProfile);
      return safeProfile;
    }

    const defaultProfile = getDefaultProfile({
      playerId: user.id,
      username: preferredUsername,
      avatarEmoji,
      avatarStyle: profileAvatar.style,
      avatarColor: profileAvatar.color,
      avatarBg: profileAvatar.bg,
      favoriteCountry,
      favoriteFlag,
      highScore,
      coins,
      dailyStreak,
    });

    const { profile: createdProfile, error: createError } = await createProfile(
      supabase,
      {
        ...defaultProfile,
        username_normalized: normalizeUsername(preferredUsername),
        xp_total: xpTotal,
        level_id: careerLevelId,
        progression_stats: progressionStats,
        favorite_country: favoriteCountry,
        favorite_flag: favoriteFlag,
      }
    );

    if (createError) {
      console.warn("Could not create auth profile", createError);
      applyAuthFallbackIdentity(user, preferredUsername);
      setProfileStatus(isNonBlockingProfileError(createError) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(createError) ? "" : getProfileErrorMessage(createError)
      );
      return null;
    }

    applyProfileToLocalState(createdProfile);
    return createdProfile;
  };

  const submitAuthForm = async (event) => {
    event?.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setAuthError("Online accounts are unavailable right now");
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");
    setAuthNotice("");

    const result =
      authMode === "signup" && isAnonymousGuest
        ? await upgradeAnonymousUserWithEmail(supabase, {
            email: authEmail,
            password: authPassword,
            username: authUsername,
            userId: effectiveAuthUserId,
          })
        : authMode === "signup"
        ? await signUpWithEmailUsername(supabase, {
            email: authEmail,
            password: authPassword,
            username: authUsername,
          })
        : await signInWithEmail(supabase, {
            email: authEmail,
            password: authPassword,
          });

    if (result.error) {
      setAuthSubmitting(false);
      const message = String(result.error.message || "").toLowerCase();
      setAuthError(
        message.includes("duplicate") ||
          message.includes("conflict") ||
          message.includes("already")
          ? "That username or email is already taken"
          : getFriendlyAuthErrorMessage(result.error)
      );
      return;
    }

    if (result.session?.user || result.user) {
      const nextUser = result.session?.user || result.user;
      const preferredUsername = result.username || authUsername;

      setAuthSession(result.session || null);
      setAuthUser(nextUser);
      prepareAuthenticatedIdentity(nextUser, preferredUsername);
      await ensureProfileForAuthUser(nextUser, preferredUsername);
      setAuthNotice(
        authMode === "signup" && isAnonymousGuest
          ? "Guest profile upgraded"
          : authMode === "signup"
          ? "Account created"
          : "Welcome back"
      );
    } else {
      setAuthNotice("Check your email to confirm your account, then log in.");
    }

    setAuthSubmitting(false);
  };

  const logout = async () => {
    playClickSound();
    await signOut(supabase);
    setAuthSession(null);
    setAuthUser(null);
    setProfile(null);
    setProfileStatus("local");
    setProfileError("");
    setGuestMode(false);
    localStorage.removeItem("ballKnowledgeGuestMode");
    localStorage.removeItem("ballKnowledgeUsername");
    setUsername("");
    setNameInput("");
    setAuthMode("login");
    setAuthEmail("");
    setAuthPassword("");
    setAuthUsername("");
    setAuthError("");
    setAuthNotice("");
    setAuthPrompt(null);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setLeaderboardOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);
  };

  const switchAccount = () => {
    playClickSound();
    setAuthSession(null);
    setAuthUser(null);
    setProfile(null);
    setProfileStatus("local");
    setProfileError("");
    setGuestMode(false);
    localStorage.removeItem("ballKnowledgeGuestMode");
    setUsername("");
    setNameInput("");
    setAuthMode("login");
    setAuthEmail("");
    setAuthPassword("");
    setAuthUsername("");
    setAuthError("");
    setAuthNotice("");
    setAuthPrompt(null);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setLeaderboardOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);
  };const openGuestSignup = () => {
  playClickSound();

  setAuthMode("signup");
  setAuthEmail("");
  setAuthPassword("");
  setAuthUsername(
    username && !username.startsWith("Guest-") ? username : ""
  );
  setAuthError("");
  setAuthNotice("");

  setGuestMode(false);
  localStorage.removeItem("ballKnowledgeGuestMode");

  setProfileOpen(false);
  setLeaderboardOpen(false);
  setMultiplayerOpen(false);
  setModeMenuOpen(false);
  setGameStarted(false);
};

const openGuestLogin = () => {
  playClickSound();

  setAuthMode("login");
  setAuthEmail("");
  setAuthPassword("");
  setAuthUsername("");
  setAuthError("");
  setAuthNotice("");

  setGuestMode(false);
  localStorage.removeItem("ballKnowledgeGuestMode");

  setProfileOpen(false);
  setLeaderboardOpen(false);
  setMultiplayerOpen(false);
  setModeMenuOpen(false);
  setGameStarted(false);
};

  const toggleSound = () => {
    const nextValue = !soundOn;

    setSoundEnabled(nextValue);
    setSoundOn(nextValue);

    if (nextValue) {
      playButtonTapSound();
    }
  };

  const getProfileErrorMessage = (error) => {
    if (!error) return "";

    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      String(error.message || "").toLowerCase().includes("profiles")
    ) {
      return "Online profile table is not ready yet";
    }

    return "Online profile sync is temporarily unavailable";
  };

  const isNonBlockingProfileError = (error) => {
    const status = Number(error?.status || error?.code);
    const message = String(error?.message || "").toLowerCase();

    return (
      status === 400 ||
      status === 409 ||
      error?.code === "23505" ||
      message.includes("duplicate") ||
      message.includes("conflict")
    );
  };

  const getLeagueErrorMessage = (error, fallback = "Could not create league") => {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "");
    const status = Number(error?.status);

    if (
      status === 401 ||
      status === 403 ||
      code === "42501" ||
      message.includes("row-level security") ||
      message.includes("permission denied") ||
      message.includes("violates row-level security")
    ) {
      return effectiveAuthUser
        ? `League save was blocked by Supabase policy: ${error?.message || "permission denied"}`
        : "Create an account to save and manage leagues.";
    }

    if (message.includes("league challenge columns") || message.includes("latest league sql")) {
      return "League database needs the latest SQL migration.";
    }

    if (message.includes("not found")) return "League not found";
    if (message.includes("duplicate")) return "That league already exists";

    return error?.message || fallback;
  };

  const hydrateProgressionFromProfile = (onlineProfile) => {
    const hydrated = getInitialProgression({
      profile: onlineProfile,
      highScore,
    });

    setXpTotal(hydrated.xpTotal);
    setCareerLevelId(hydrated.levelId);
    setClaimedLevelIds(hydrated.claimedLevelIds);
    setProgressionStats(hydrated.stats);
    persistLocalProgression({
      xpTotal: hydrated.xpTotal,
      levelId: hydrated.levelId,
      stats: hydrated.stats,
      claimedLevelIds: hydrated.claimedLevelIds,
    });
  };

  const ensureOnlineProfile = async (nextUsername = username) => {
    if (!nextUsername) return null;

    if (!isSupabaseConfigured || !supabase) {
      setProfileStatus("local");
      setProfileError("");
      return null;
    }

    setProfileStatus((status) => (status === "ready" ? "ready" : "syncing"));
    setProfileError("");

    const { profile: existingProfile, error: fetchError } = await fetchProfile(
      supabase,
      playerId
    );

    if (fetchError) {
      console.warn("Online profile unavailable; using local profile", fetchError);
      setProfileStatus(isNonBlockingProfileError(fetchError) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(fetchError) ? "" : getProfileErrorMessage(fetchError)
      );
      return null;
    }

    if (existingProfile) {
      setProfile(existingProfile);
      hydrateProgressionFromProfile(existingProfile);
      setAvatarEmoji(existingProfile.avatar_icon || existingProfile.avatar_emoji || "profile");
      localStorage.setItem(
        "ballKnowledgeAvatarEmoji",
        existingProfile.avatar_icon || existingProfile.avatar_emoji || "profile"
      );
      setFavoriteCountry(existingProfile.favorite_country || favoriteCountry || "Argentina");
      setFavoriteFlag(existingProfile.favorite_flag || favoriteFlag || "🇦🇷");
      localStorage.setItem(
        "ballKnowledgeFavoriteCountry",
        existingProfile.favorite_country || favoriteCountry || "Argentina"
      );
      localStorage.setItem(
        "ballKnowledgeFavoriteFlag",
        existingProfile.favorite_flag || favoriteFlag || "🇦🇷"
      );
      setProfileStatus("ready");
      return existingProfile;
    }

    const defaultProfile = getDefaultProfile({
      playerId,
      username: nextUsername,
      avatarEmoji,
      avatarStyle: profileAvatar.style,
      avatarColor: profileAvatar.color,
      avatarBg: profileAvatar.bg,
      favoriteCountry,
      favoriteFlag,
      highScore,
      coins,
      dailyStreak,
    });

    const { profile: createdProfile, error: createError } = await createProfile(
      supabase,
      defaultProfile
    );

    if (createError) {
      console.warn("Online profile could not be created; using local profile", createError);
      setProfileStatus(isNonBlockingProfileError(createError) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(createError) ? "" : getProfileErrorMessage(createError)
      );
      return null;
    }

    setProfile(createdProfile);
    hydrateProgressionFromProfile(createdProfile);
    setAvatarEmoji(createdProfile.avatar_icon || createdProfile.avatar_emoji || "profile");
    localStorage.setItem(
      "ballKnowledgeAvatarEmoji",
      createdProfile.avatar_icon || createdProfile.avatar_emoji || "profile"
    );
    setFavoriteCountry(createdProfile.favorite_country || favoriteCountry || "Argentina");
    setFavoriteFlag(createdProfile.favorite_flag || favoriteFlag || "🇦🇷");
    localStorage.setItem(
      "ballKnowledgeFavoriteCountry",
      createdProfile.favorite_country || favoriteCountry || "Argentina"
    );
    localStorage.setItem(
      "ballKnowledgeFavoriteFlag",
      createdProfile.favorite_flag || favoriteFlag || "🇦🇷"
    );
    setProfileStatus("ready");
    return createdProfile;
  };

  const updateOnlineProfile = async (updates, successStatus = "ready") => {
    if (!isSupabaseConfigured || !supabase || !username) {
      return null;
    }

    const baseProfile = profile || (await ensureOnlineProfile(username));

    if (!baseProfile) return null;

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      updates
    );

    if (error) {
      console.warn("Online profile update unavailable", error);
      setProfileStatus(isNonBlockingProfileError(error) ? "local" : "error");
      setProfileError(
        isNonBlockingProfileError(error) ? "" : getProfileErrorMessage(error)
      );
      return null;
    }

    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...(updatedProfile || {}),
      ...updates,
    }));
    setProfileStatus(successStatus);
    setProfileError("");
    return updatedProfile;
  };

  const openAvatarBuilder = () => {
    playClickSound();
    setAvatarDraft(profileAvatar);
    setAvatarNotice("");
    setAvatarPickerOpen(true);
  };

  const updateAvatarDraft = (updates) => {
    playClickSound();
    setAvatarDraft((currentDraft) => ({
      ...profileAvatar,
      ...currentDraft,
      ...updates,
    }));
  };

  const saveAvatarBuilder = async () => {
    playClickSound();
    const nextAvatar = getAvatarConfig(avatarDraft || profileAvatar);
    const previousProfile = profile;
    const previousAvatar = profileAvatar;
    const updates = {
      avatar_emoji: nextAvatar.icon,
      avatar_icon: nextAvatar.icon,
      avatar_style: nextAvatar.style,
      avatar_color: nextAvatar.color,
      avatar_bg: nextAvatar.bg,
      favorite_country: nextAvatar.country,
      favorite_flag: nextAvatar.flag,
    };

    setAvatarEmoji(nextAvatar.icon);
    setFavoriteCountry(nextAvatar.country);
    setFavoriteFlag(nextAvatar.flag);
    localStorage.setItem("ballKnowledgeAvatarEmoji", nextAvatar.icon);
    localStorage.setItem("ballKnowledgeFavoriteCountry", nextAvatar.country);
    localStorage.setItem("ballKnowledgeFavoriteFlag", nextAvatar.flag);
    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...updates,
    }));

    const updatedProfile = await updateOnlineProfile(updates);

    if (!updatedProfile && isSupabaseConfigured && supabase) {
      setProfile(previousProfile);
      setAvatarEmoji(previousAvatar.icon);
      setFavoriteCountry(previousAvatar.country);
      setFavoriteFlag(previousAvatar.flag);
      localStorage.setItem("ballKnowledgeAvatarEmoji", previousAvatar.icon);
      localStorage.setItem("ballKnowledgeFavoriteCountry", previousAvatar.country);
      localStorage.setItem("ballKnowledgeFavoriteFlag", previousAvatar.flag);
      setAvatarNotice("Could not save avatar online. Try again.");
      return;
    }

    setAvatarNotice("Avatar saved");
    setAvatarPickerOpen(false);
  };

  const loadGeneralLeaderboard = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLeaderboardRows([]);
      setLevelLeaderboardRows([]);
      setCurrentLeaderboardRow(null);
      setCurrentLevelLeaderboardRow(null);
      setLeaderboardError("Online leaderboard is unavailable");
      return;
    }

    setLeaderboardLoading(true);
    setLeaderboardError("");

    if (username && username !== "Loading profile...") {
      await ensureOnlineProfile(username);

      if (Number(highScore) > 0) {
        const savedLeaderboardProfile = await updateOnlineProfile(
          {
            best_score: highScore,
            coins,
            daily_streak: dailyStreak,
            xp_total: xpTotal,
            level_id: careerLevelId,
            progression_stats: {
              ...progressionStats,
              best_general_score: Math.max(
                Number(progressionStats.best_general_score) || 0,
                Number(highScore) || 0
              ),
            },
          },
          "ready"
        );

        if (!savedLeaderboardProfile && !isGuest) {
          console.error("Could not save leaderboard score to Supabase profile", {
            playerId,
            highScore,
            hasAuthUser: Boolean(effectiveAuthUser),
          });
        }
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .gt("best_score", 0)
      .order("best_score", { ascending: false })
      .limit(100);
    const { data: levelData, error: levelError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .limit(100);

    setLeaderboardLoading(false);

    if (error) {
      console.error("Could not load leaderboard profiles", error);
      setLeaderboardRows([]);
      setCurrentLeaderboardRow(null);
      setLeaderboardError(getProfileErrorMessage(error));
      return;
    }

    const generalRankedRows = (data || [])
      .filter((row) => (Number(row.best_score) || 0) > 0)
      .sort((a, b) => (Number(b.best_score) || 0) - (Number(a.best_score) || 0))
      .map((row, index) => buildGeneralLeaderboardRow(row, index, playerId));
    const visibleGeneralRows = generalRankedRows.slice(0, 10);
    const currentGeneralRow = generalRankedRows.find((row) => row.isCurrentUser) || null;

    setLeaderboardRows(visibleGeneralRows);
    setCurrentLeaderboardRow(
      currentGeneralRow &&
        !visibleGeneralRows.some((row) => row.id === currentGeneralRow.id)
        ? currentGeneralRow
        : null
    );

    if (levelError) {
      console.error("Could not load highest levels leaderboard", levelError);
      setLevelLeaderboardRows([]);
      setCurrentLevelLeaderboardRow(null);
    } else {
      const levelRankedRows = (levelData || [])
        .sort((a, b) => {
          const levelDiff = (Number(b.level_id) || 1) - (Number(a.level_id) || 1);
          if (levelDiff !== 0) return levelDiff;
          const xpDiff = (Number(b.xp_total) || 0) - (Number(a.xp_total) || 0);
          if (xpDiff !== 0) return xpDiff;
          return (Number(b.best_score) || 0) - (Number(a.best_score) || 0);
        })
        .map((row, index) => buildLevelLeaderboardRow(row, index, playerId));
      const visibleLevelRows = levelRankedRows.slice(0, 10);
      const currentLevelRow = levelRankedRows.find((row) => row.isCurrentUser) || null;

      setLevelLeaderboardRows(visibleLevelRows);
      setCurrentLevelLeaderboardRow(
        currentLevelRow &&
          !visibleLevelRows.some((row) => row.id === currentLevelRow.id)
          ? currentLevelRow
          : null
      );
    }
  };

  const getSocialProfile = (id, fallbackUsername = "Player") => {
    if (id && id === playerId) {
      return {
        ...(profile || {}),
        id,
        username: displayName || fallbackUsername,
        display_name: displayName || fallbackUsername,
        avatar_emoji: profileAvatar.icon,
        avatar_icon: profileAvatar.icon,
        avatar_style: profileAvatar.style,
        avatar_color: profileAvatar.color,
        avatar_bg: profileAvatar.bg,
        favorite_country: profile?.favorite_country || favoriteCountry,
        favorite_flag: profile?.favorite_flag || favoriteFlag,
      };
    }

    return (
      (id && profileLookup[id]) || {
        id,
        username: fallbackUsername,
        display_name: fallbackUsername,
        avatar_emoji: "profile",
        avatar_icon: "profile",
        avatar_style: "classic",
        avatar_color: "green",
        avatar_bg: "dark",
        favorite_country: "Argentina",
        favorite_flag: "🇦🇷",
      }
    );
  };

  const getMatchPlayerProfile = (match, slot) => {
    const id = slot === "player1" ? match?.player1_id : match?.player2_id;
    const fallbackUsername =
      slot === "player1" ? match?.player1_username : match?.player2_username;

    return getSocialProfile(id, fallbackUsername || "Player");
  };

  const recordMultiplayerRoundResult = async (round, match) => {
    if (!round?.id || !round.winner || !match || !isSupabaseConfigured || !supabase) {
      return;
    }

    const countedKey = "ballKnowledgeCountedMultiplayerRounds";
    let countedRounds;

    try {
      countedRounds = JSON.parse(localStorage.getItem(countedKey) || "[]");
    } catch {
      countedRounds = [];
    }

    if (countedRounds.includes(round.id)) return;

    const playerSlot = getCurrentPlayerSlot(match, playerId, username);
    if (!playerSlot) return;

    const playerName =
      playerSlot === "player1" ? match.player1_username : match.player2_username;

    const { profile: latestProfile, error: latestError } = await fetchProfile(
      supabase,
      playerId
    );

    if (latestError || !latestProfile) {
      if (latestError) {
        console.error("Could not load profile for multiplayer stats", latestError);
      }
      return;
    }

    const resultPatch = {
      multiplayer_matches: (latestProfile.multiplayer_matches || 0) + 1,
    };

    // TODO: This counts completed multiplayer rounds. When full match ending
    // exists, move these counters to completed-match results instead.
    if (round.winner === "draw") {
      resultPatch.multiplayer_draws = (latestProfile.multiplayer_draws || 0) + 1;
    } else if (round.winner === playerName) {
      resultPatch.multiplayer_wins = (latestProfile.multiplayer_wins || 0) + 1;
    } else {
      resultPatch.multiplayer_losses = (latestProfile.multiplayer_losses || 0) + 1;
    }

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      resultPatch
    );

    if (error) {
      console.error("Could not update multiplayer profile stats", error);
      return;
    }

    localStorage.setItem(
      countedKey,
      JSON.stringify([...countedRounds, round.id].slice(-200))
    );
    setProfile((currentProfile) => ({
      ...(currentProfile || {}),
      ...(updatedProfile || {}),
    }));
    setProfileStatus("ready");
  };

  const saveCoins = (newCoins) => {
    setCoins(newCoins);
    localStorage.setItem("footballQuizCoins", String(newCoins));
  };

  const syncProgressionToProfile = async (nextProgression = {}) => {
    if (!isSupabaseConfigured || !supabase || !playerId || !username) return;

    const updates = {
      xp_total: nextProgression.xpTotal ?? xpTotal,
      level_id: nextProgression.levelId ?? careerLevelId,
      level_up_claimed_ids: nextProgression.claimedLevelIds ?? claimedLevelIds,
      progression_stats: nextProgression.stats ?? progressionStats,
    };

    const { profile: updatedProfile, error } = await updateProfile(
      supabase,
      playerId,
      updates
    );

    if (error) {
      console.error("Could not sync progression profile", error);
      return;
    }

    if (updatedProfile) {
      setProfile((currentProfile) => ({
        ...(currentProfile || {}),
        ...updatedProfile,
      }));
    }
  };

  const persistProgressionState = (next) => {
    persistLocalProgression(next);
    syncProgressionToProfile(next);
  };

  const showXpToast = ({ amount, label, placement = "global" }) => {
    if (!amount) return;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setXpToast({ key, amount, label, placement });
    window.setTimeout(() => {
      setXpToast((toast) => (toast?.key === key ? null : toast));
    }, 1200);
  };

  const awardXp = ({ key, amount, label, placement = "global" }) => {
    const event = createXpEvent({ key, amount, label });
    if (!event) return false;

    setXpTotal((currentXp) => {
      const nextXp = currentXp + event.amount;
      setProgressionStats((currentStats) => {
        const nextStats = { ...currentStats, xp_total: nextXp };
        persistProgressionState({
          xpTotal: nextXp,
          levelId: careerLevelId,
          stats: nextStats,
          claimedLevelIds,
        });
        return nextStats;
      });
      return nextXp;
    });
    showXpToast({ ...event, placement });
    return true;
  };

  const updateProgressionStats = (updater) => {
    setProgressionStats((currentStats) => {
      const nextStats = {
        ...currentStats,
        ...updater(currentStats),
      };
      const nextProgression = {
        xpTotal,
        levelId: careerLevelId,
        stats: nextStats,
        claimedLevelIds,
      };
      persistProgressionState(nextProgression);
      return nextStats;
    });
  };

  const buildObjectiveProgressUpdate = (beforeView, afterView) => {
    if (!beforeView || !afterView) return null;

    const updates = afterView.objectives
      .map((afterObjective) => {
        const beforeObjective = beforeView.objectives.find(
          (objective) => objective.statKey === afterObjective.statKey
        );

        if (!beforeObjective) return null;

        const progressed = afterObjective.current > beforeObjective.current;
        const newlyCompleted =
          !beforeObjective.complete && afterObjective.complete;

        if (!progressed && !newlyCompleted) return null;

        return {
          label: afterObjective.label,
          statKey: afterObjective.statKey,
          required: afterObjective.required,
          before: beforeObjective.current,
          after: afterObjective.current,
          beforeProgress: beforeObjective.progress,
          afterProgress: afterObjective.progress,
          complete: afterObjective.complete,
          newlyCompleted,
        };
      })
      .filter(Boolean);

    if (updates.length === 0) return null;

    return {
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      levelName: afterView.currentLevel.name,
      updates,
      allComplete: afterView.objectives.every((objective) => objective.complete),
    };
  };

  const awardOneTimeCoins = ({ key, amount, title }) => {
    if (!key || !amount) return false;

    const storageKey = "ballKnowledgeClaimedCoinRewards";
    let claimedRewardList;
    try {
      claimedRewardList = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      claimedRewardList = [];
    }
    const claimedRewards = new Set(
      Array.isArray(claimedRewardList) ? claimedRewardList : []
    );

    if (claimedRewards.has(key)) return false;

    const currentCoins = Number(localStorage.getItem("footballQuizCoins")) || coins;
    saveCoins(currentCoins + amount);
    claimedRewards.add(key);
    localStorage.setItem(storageKey, JSON.stringify([...claimedRewards]));
    setCoinRewardToast({ key, amount, title });
    playCoinSound();

    window.setTimeout(() => {
      setCoinRewardToast((reward) => (reward?.key === key ? null : reward));
    }, 1500);

    return true;
  };

  const saveUsername = () => {
    const cleanedName = nameInput.trim();

    if (!cleanedName) return;

    const finalName = cleanedName.slice(0, 16);

    playClickSound();
    setUsername(finalName);
    localStorage.setItem("ballKnowledgeUsername", finalName);
    setNameInput(finalName);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);

    if (isSupabaseConfigured && supabase) {
      (async () => {
        const onlineProfile =
          profile || (await ensureOnlineProfile(finalName));

        if (!onlineProfile) return;

        const { profile: updatedProfile, error } = await updateProfile(
          supabase,
          playerId,
          {
        username: finalName,
            username_normalized: normalizeUsername(finalName),
            display_name: finalName,
            avatar_emoji: profileAvatar.icon || avatarEmoji,
            avatar_icon: profileAvatar.icon || avatarEmoji,
            avatar_style: profileAvatar.style,
            avatar_color: profileAvatar.color,
            avatar_bg: profileAvatar.bg,
            favorite_country: profile?.favorite_country || favoriteCountry,
            favorite_flag: profile?.favorite_flag || favoriteFlag,
            best_score: highScore,
            coins,
            daily_streak: dailyStreak,
          }
        );

        if (error) {
          console.error("Could not sync username to profile", error);
          setProfileStatus("error");
          setProfileError(getProfileErrorMessage(error));
          return;
        }

        setProfile((currentProfile) => ({
          ...(currentProfile || {}),
          ...(updatedProfile || {}),
          username: finalName,
          display_name: finalName,
          avatar_emoji: profileAvatar.icon || avatarEmoji,
          avatar_icon: profileAvatar.icon || avatarEmoji,
          avatar_style: profileAvatar.style,
          avatar_color: profileAvatar.color,
          avatar_bg: profileAvatar.bg,
          favorite_country: profile?.favorite_country || favoriteCountry,
          favorite_flag: profile?.favorite_flag || favoriteFlag,
        }));
        setProfileStatus("ready");
        setProfileError("");
      })();
    }
  };

  const changeUsername = () => {
    playClickSound();
    setNameInput(username);
    localStorage.removeItem("ballKnowledgeUsername");
    setUsername("");
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setGameStarted(false);
  };

  const awardDailyStreakBonus = () => {
    const today = getDailyDateKey();
    const yesterday = getYesterdayDateKey();
    const now = Date.now();
    const expired =
      hasMissedDailyStreakDay(lastDailyPlayedDate, today) ||
      isDailyStreakExpired(lastDailyActivityAt, now);
    const baseStreak = expired ? 0 : dailyStreak;
    const baseLastDailyPlayedDate = expired ? "" : lastDailyPlayedDate;
    const previousStreak = baseStreak;

    let newStreak = 1;
    let reward;

    if (baseLastDailyPlayedDate === yesterday) {
      newStreak = baseStreak + 1;
    } else if (baseLastDailyPlayedDate === today) {
      newStreak = baseStreak;
      setStreakRewardEarned(0);
      return {
        previousStreak,
        newStreak,
        reward: 0,
      };
    }

    reward = getStreakReward(newStreak);

    setDailyStreak(newStreak);
    setLastDailyPlayedDate(today);
    setLastDailyActivityAt(now);
    setStreakRewardEarned(reward);

    localStorage.setItem("footballQuizDailyStreak", String(newStreak));
    localStorage.setItem("footballQuizLastDailyPlayedDate", today);
    localStorage.setItem(DAILY_STREAK_ACTIVITY_KEY, String(now));

    if (effectiveAuthUser && isSupabaseConfigured && supabase) {
      const nextProgressionStats = {
        ...(profile?.progression_stats || {}),
        ...(progressionStats || {}),
        lastDailyActivityAt: now,
        lastDailyPlayedDate: today,
      };

      updateProfile(supabase, effectiveAuthUser.id, {
        daily_streak: newStreak,
        progression_stats: nextProgressionStats,
      }).then(({ profile: updatedProfile, error }) => {
        if (error) {
          console.warn("Could not save daily streak timestamp", error);
          return;
        }

        if (updatedProfile) {
          setProfile((currentProfile) => ({
            ...(currentProfile || {}),
            daily_streak: updatedProfile.daily_streak,
            progression_stats: updatedProfile.progression_stats,
          }));
        }
      });
    }

    if (reward > 0) {
      const currentCoins =
        Number(localStorage.getItem("footballQuizCoins")) || coins;

      saveCoins(currentCoins + reward);
      playStreakSound();
      playCoinSound();
    }

    return {
      previousStreak,
      newStreak,
      reward,
    };
  };

  const markDailyAsPlayed = (found, earned, streakInfo) => {
    const result = {
      date: getDailyDateKey(),
      found,
      total: dailyTargetCount,
      coins: earned,
      previousStreak: streakInfo?.previousStreak ?? Math.max(0, dailyStreak - 1),
      streak: streakInfo?.newStreak || dailyStreak,
      streakBonus: streakInfo?.reward || 0,
      title: todayChallenge.label,
    };

    localStorage.setItem("ballKnowledgeDailyDate", getDailyDateKey());
    localStorage.setItem("ballKnowledgeDailyResult", JSON.stringify(result));

    setDailyPlayed(true);
    setLastDailyResult(result);

    if (effectiveAuthUser && isSupabaseConfigured && supabase) {
      const today = getDailyDateKey();
      const nextProgressionStats = {
        ...(profile?.progression_stats || {}),
        ...(progressionStats || {}),
        dailyCompletions: {
          ...((profile?.progression_stats || {}).dailyCompletions || {}),
          daily_list: {
            ...(((profile?.progression_stats || {}).dailyCompletions || {}).daily_list || {}),
            [today]: {
              puzzleId: todayChallenge.id,
              title: todayChallenge.label,
              found,
              total: dailyTargetCount,
              coins: earned,
              completedAt: new Date().toISOString(),
            },
          },
        },
        lastDailyPlayedDate: today,
        lastDailyActivityAt: Date.now(),
      };

      updateProfile(supabase, effectiveAuthUser.id, {
        daily_streak: streakInfo?.newStreak || dailyStreak,
        progression_stats: nextProgressionStats,
      }).then(({ profile: updatedProfile, error }) => {
        if (error) {
          console.warn("Could not save daily completion", error);
          return;
        }
        if (updatedProfile) {
          setProfile((currentProfile) => ({
            ...(currentProfile || {}),
            daily_streak: updatedProfile.daily_streak,
            progression_stats: updatedProfile.progression_stats,
          }));
        }
      });
    }
  };

const resetConnectionsGame = async (difficulty = null) => {
  const connectionPuzzles = await loadConnectionsPuzzles();
  const puzzle = getRandomConnectionsPuzzleFromBank(connectionPuzzles, difficulty);

  setConnectionsPuzzle(puzzle);
  setConnectionsRewardModal(null);
  setConnectionsResumeVersion((version) => version + 1);
};

  const openConnectionsDifficultyPicker = () => {
  playClickSound();
  setShowDailyCompletePopup(false);
  setLeaderboardOpen(false);
  setProfileOpen(false);
  setMultiplayerOpen(false);
  setModeMenuOpen(false);
  setIsMockMultiplayer(false);
  setMockOpponentScore(null);
  setGameMode("connections");
  setGameStarted(false);
  setConnectionsDifficultyPickerOpen(true);
};

const startConnectionsGame = async (difficulty = null) => {
  playClickSound();
  setModeLoading(true);
  setShowDailyCompletePopup(false);
  setLeaderboardOpen(false);
  setProfileOpen(false);
  setMultiplayerOpen(false);
  setModeMenuOpen(false);
  setConnectionsDifficultyPickerOpen(false);
  setIsMockMultiplayer(false);
  setMockOpponentScore(null);
  setGameMode("connections");
  setFinished(false);
  setGameStarted(true);
  try {
    await resetConnectionsGame(difficulty);
    window.scrollTo({ top: 0, behavior: "instant" });
  } finally {
    setModeLoading(false);
  }
};

  const loadWhoAmIDailyQuestion = async (dateKey = whoAmIDate) => {
    const whoAmIQuestionBank = await loadWhoAmIQuestions();
    const dailyQuestion = getDailyWhoAmIQuestionFromBank(whoAmIQuestionBank, dateKey);

    if (!dailyQuestion) return null;

    try {
      const searchableQuestions = await filterSearchablePlayerGuessQuestionsLazy(
        [dailyQuestion],
        "daily-whoami"
      );
      if (searchableQuestions.length) return dailyQuestion;

      const fallbackQuestions = await filterSearchablePlayerGuessQuestionsLazy(
        whoAmIQuestionBank.filter(
          (question) =>
            question?.id &&
            question?.answer &&
            Array.isArray(question.clues) &&
            question.clues.length > 0
        ),
        "daily-whoami-fallback"
      );

      return (
        fallbackQuestions[
          getSeededIndex(`daily-whoami-fallback:${dateKey}`, fallbackQuestions.length)
        ] || dailyQuestion
      );
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn("Could not validate Daily Who Am I searchability", error);
      }
      return dailyQuestion;
    }
  };

  const startWhoAmIGame = async (dateKey = whoAmIDate) => {
    if (isDateKeyAfterToday(dateKey)) return;

    preloadPlayerSearchLazy();
    playClickSound();
    setModeLoading(true);
    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setModeMenuOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setGameMode("who-am-i");
    setFinished(false);
    setGameStarted(true);
    setWhoAmIDate(dateKey);
    setWhoAmIQuestion(null);
    setWhoAmIGameSnapshot(null);
    setWhoAmIResumeVersion((version) => version + 1);
    try {
      setWhoAmIQuestion(await loadWhoAmIDailyQuestion(dateKey));
      window.scrollTo({ top: 0, behavior: "instant" });
    } finally {
      setModeLoading(false);
    }
  };

  const persistWhoAmISolved = ({ question, dateKey, cluesUsed, earlyBonus }) => {
    const rewardKeyBase = `whoami_daily:${dateKey}:${question.id}`;
    const rewardEligible = !isDateKeyBeforeToday(dateKey);
    const previousResult = getDailyModeResult(
      "whoami_daily",
      dateKey,
      question.id
    );
    const solvedBefore = Boolean(previousResult?.solved);
    const solvedXpAwarded =
      rewardEligible &&
      !solvedBefore &&
      awardXp({
        key: `${rewardKeyBase}:solved`,
        amount: 50,
        label: "Who Am I solved",
      });

    if (solvedXpAwarded) {
      updateProgressionStats((stats) => addStat(stats, "whoami_solved", 1));
    }
    if (rewardEligible && !solvedBefore && earlyBonus > 0) {
      awardXp({
        key: `${rewardKeyBase}:early-${cluesUsed}`,
        amount: earlyBonus,
        label: "Early clue bonus",
      });
    }
    if (rewardEligible && !solvedBefore) {
      awardOneTimeCoins({
        key: `${rewardKeyBase}:coins`,
        amount: 50,
        title: "Who Am I solved",
      });
    }

    saveDailyModeResult("whoami_daily", dateKey, question.id, {
      solved: true,
      gaveUp: false,
      cluesUsed,
      xpAwarded: solvedXpAwarded,
      replay: solvedBefore,
      rewardEligible,
    });
  };

  const persistWhoAmIMissed = ({ question, dateKey, cluesUsed }) => {
    saveDailyModeResult("whoami_daily", dateKey, question.id, {
      solved: false,
      gaveUp: false,
      cluesUsed,
      xpAwarded: false,
    });
  };

  const exitWhoAmIGame = (snapshot) => {
    setWhoAmIGameSnapshot(snapshot);
    setGameStarted(false);
    setModeMenuOpen(true);
    setGameMode("general");
  };

  const persistConnectionsCompletion = ({ puzzle, solved, mistakes }) => {
    updateProgressionStats((stats) => addStat(stats, "connections_completed", 1));
    let xpEarned = 0;
    const completeXpAwarded = awardXp({
      key: `connections-complete:${puzzle?.id || "session"}`,
      amount: 100,
      label: "Connections complete",
    });
    if (completeXpAwarded) xpEarned += 100;
    if (mistakes === 0) {
      const perfectXpAwarded = awardXp({
        key: `connections-perfect:${puzzle?.id || "session"}`,
        amount: 50,
        label: "Perfect Connections",
      });
      if (perfectXpAwarded) xpEarned += 50;
    }
    awardOneTimeCoins({
      key: `connections:${puzzle?.id || "session"}`,
      amount: 75,
      title: "Connections complete",
    });
    setConnectionsRewardModal({
      title: "Puzzle Complete",
      mode: "Connections",
      groupsSolved: solved.length,
      coins: 75,
      xp: xpEarned,
      perfect: mistakes === 0,
    });
  };

  const startGame = async (mode, options = {}) => {
    if (mode === "career") preloadPlayerSearchLazy();
    setModeLoading(true);

    try {
      const nextQuestions = await buildGameQuestions(mode, {
        recentQuestionKeys:
          mode === "general" && !options.multiplayer
            ? readRecentGeneralQuestionKeys()
            : [],
      });
      const nextRunId = Date.now();
      const startingHighScore = highScore;
      const startingProgression = getProgressionView({
        xpTotal,
        levelId: careerLevelId,
        stats: {
          ...progressionStats,
          best_general_score: Math.max(
            startingHighScore,
            Number(progressionStats.best_general_score) || 0
          ),
        },
      });

      setShowDailyCompletePopup(false);
      setLeaderboardOpen(false);
      setProfileOpen(false);
      setMultiplayerOpen(false);
      setIsMockMultiplayer(Boolean(options.multiplayer));
      setMockOpponentScore(null);
      setGameMode(mode);
      setQuestions(nextQuestions);
      setQuestionIndex(0);
      setSelected(null);
      setTextAnswer("");
      setCareerSelectedPlayer(null);
      setScore(0);
      setLives(3);
      setStreak(0);
      setTimeLeft(HARD_TIME_LIMIT);
      setFinished(false);
      setRunStartHighScore(startingHighScore);
      setRunId(nextRunId);
      setHighScoreBonusAwarded(false);
      setRunStartProgression(mode === "general" && !options.multiplayer ? startingProgression : null);
      setGeneralRunXpSummary({ correct: 0, streak: 0, highscore: 0 });
      setGeneralGameSnapshot(null);
      setGeneralResumeVersion(0);
      setWorldCupGameSnapshot(null);
      setWorldCupResumeVersion(0);
      setCareerGameSnapshot(null);
      setCareerResumeVersion(0);
      setObjectiveProgressUpdate(null);
      setPostGameStep("summary");
      setRevivesUsed(0);
      setRewardPopup(null);
      setWrongPopup(null);
      setGameStarted(true);
    } finally {
      setModeLoading(false);
    }
  };

  const openMultiplayer = () => {
    playClickSound();
    setMultiplayerOpen(true);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerStep("menu");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode("");
    setJoinRoomCode("");
    setMultiplayerError("");
  };

  const openArenaSection = (section) => {
    playClickSound();
    setMultiplayerStep(section);
    setMultiplayerError("");
    setMultiplayerNotice("");
  };

  const copyMultiplayerRoomCode = async () => {
    const code = multiplayerRoomCode || activeMatch?.room_code || "";
    if (!code) return;

    playClickSound();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setRoomCodeCopyStatus("Copied!");
      window.setTimeout(() => setRoomCodeCopyStatus(""), 1400);
    } catch (error) {
      console.warn("Could not copy room code", error);
      setRoomCodeCopyStatus("Copy failed");
      window.setTimeout(() => setRoomCodeCopyStatus(""), 1800);
    }
  };

  const getMultiplayerAuthPlayerId = async (actionLabel, { silent = false } = {}) => {
    const authPlayerId = effectiveAuthUser?.id;

    if (authPlayerId) {
      return authPlayerId;
    }

    if (!silent) {
      setMultiplayerNotice("Starting Guest online play...");
    }

    const guestUser = await ensureGuestBackendIdentity({ silent });

    if (guestUser?.id) {
      if (!silent) {
        setMultiplayerNotice("");
      }
      return guestUser.id;
    }

    if (!silent) {
      setMultiplayerNotice("");
    }

    return null;
  };

  const getMultiplayerPermissionErrorMessage = (error, fallback) => {
    const message = error?.message || "";

    if (
      error?.name === "AuthRetryableFetchError" ||
      error?.name === "TypeError" ||
      /failed to fetch|networkerror|network request failed/i.test(message)
    ) {
      return getFriendlyAuthErrorMessage(error, fallback);
    }

    if (
      error?.code === "42501" ||
      /row-level security|permission|forbidden|not authorized/i.test(message)
    ) {
      return "Match permissions are not ready yet. Run the Supabase matches RLS SQL, then try again.";
    }

    return fallback;
  };

  const loadMatchById = async (matchId) => {
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return { match: null, rounds: [], error: matchError };
    }

    const { data: rounds, error: roundError } = await supabase
      .from("multiplayer_rounds")
      .select("*")
      .eq("match_id", match.id)
      .order("round_number", { ascending: false })
      .limit(5);

    return {
      match,
      rounds: rounds || [],
      error: roundError,
    };
  };

  const fetchActiveGames = async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = await getMultiplayerAuthPlayerId("view active matches", {
      silent,
    });
    if (!matchPlayerId) {
      setActiveGames([]);
      return;
    }

    if (!silent) {
      setActiveGamesLoading(true);
      setMultiplayerError("");
    }

    const playerFilters = [`player_id.eq.${matchPlayerId}`];

    const { data: players, error: playersError } = await supabase
      .from("match_players")
      .select("match_id")
      .or(playerFilters.join(","));

    if (playersError) {
      if (!silent) setActiveGamesLoading(false);
      setMultiplayerError("Could not load active matches");
      return;
    }

    const matchIds = [
      ...new Set((players || []).map((player) => player.match_id).filter(Boolean)),
    ];

    if (matchIds.length === 0) {
      setActiveGames([]);
      if (!silent) setActiveGamesLoading(false);
      return;
    }

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .in("id", matchIds)
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (matchesError) {
      if (!silent) setActiveGamesLoading(false);
      setMultiplayerError("Could not load matches");
      return;
    }

    const games = await Promise.all(
      (matches || [])
      .filter(
        (match) =>
          !match.is_public &&
          match.status !== "completed" &&
          match.phase !== "completed"
      )
      .map(async (match) => {
        const { data: rounds } = await supabase
          .from("multiplayer_rounds")
          .select("*")
          .eq("match_id", match.id)
          .order("round_number", { ascending: false })
          .limit(1);

        return {
          match,
          latestRound: rounds?.[0] || null,
        };
      })
    );

    setActiveGames(games);
    if (!silent) setActiveGamesLoading(false);
  };

  const loadPlayNowGames = async ({ silent = false } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = await getMultiplayerAuthPlayerId("view Play Now games", {
      silent,
    });
    if (!matchPlayerId) {
      setPlayNowGames([]);
      return;
    }

    if (!silent) {
      setPlayNowGamesLoading(true);
      setMultiplayerError("");
    }

    const playerFilters = [`player_id.eq.${matchPlayerId}`];

    const { data: players, error: playersError } = await supabase
      .from("match_players")
      .select("match_id")
      .or(playerFilters.join(","));

    if (playersError) {
      if (!silent) setPlayNowGamesLoading(false);
      setMultiplayerError("Could not load Play Now games");
      return;
    }

    const matchIds = [
      ...new Set((players || []).map((player) => player.match_id).filter(Boolean)),
    ];

    if (matchIds.length === 0) {
      setPlayNowGames([]);
      if (!silent) setPlayNowGamesLoading(false);
      return;
    }

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .in("id", matchIds)
      .eq("is_public", true)
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (matchesError) {
      if (!silent) setPlayNowGamesLoading(false);
      setMultiplayerError("Could not load Play Now games");
      return;
    }

    const games = await Promise.all(
      (matches || []).map(async (match) => {
        const { data: rounds } = await supabase
          .from("multiplayer_rounds")
          .select("*")
          .eq("match_id", match.id)
          .order("round_number", { ascending: false })
          .limit(1);

        return {
          match,
          latestRound: rounds?.[0] || null,
        };
      })
    );

    setPlayNowGames(games);
    if (!silent) setPlayNowGamesLoading(false);
  };

  const openActiveGames = async () => {
    playClickSound();
    setMultiplayerStep("active-games");
    await fetchActiveGames();
  };

  const openHomeActiveGames = async () => {
    playClickSound();
    setMultiplayerOpen(true);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode("");
    setJoinRoomCode("");
    setMultiplayerError("");
    setMultiplayerNotice("");
    setMultiplayerStep("active-games");
    await fetchActiveGames();
  };

  const openPlayNowLobby = async () => {
    playClickSound();
    setMultiplayerStep("play-now");
    setMultiplayerError("");
    setMultiplayerNotice("");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    await loadPlayNowGames();
  };

  const openCurrentRandomMatches = async () => {
    playClickSound();
    setMultiplayerStep("play-now-active-games");
    setMultiplayerError("");
    setMultiplayerNotice("");
    await loadPlayNowGames();
  };

  const goBackMultiplayer = () => {
    playClickSound();

    if (multiplayerStep === "menu") {
      setMultiplayerOpen(false);
      return;
    }

    if (
      ["league-menu", "h2h-menu", "play-now", "play-now-waiting"].includes(
        multiplayerStep
      )
    ) {
      setMultiplayerStep("menu");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setMultiplayerError("");
      setMultiplayerNotice("");
      return;
    }

    if (multiplayerStep === "play-now-active-games") {
      setMultiplayerStep("play-now");
      setMultiplayerError("");
      setMultiplayerNotice("");
      return;
    }

    if (
      [
        "create-league",
        "join-league",
        "my-leagues",
        "league-dashboard",
      ].includes(multiplayerStep)
    ) {
      setMultiplayerStep("league-menu");
      setLeagueDashboard(null);
      setLeagueNameInput("");
      setLeagueCodeInput("");
      setMultiplayerError("");
      return;
    }

    if (activeMatch?.is_public && ["joined", "created"].includes(multiplayerStep)) {
      setMultiplayerStep("play-now-active-games");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setNextCategoryPickerOpen(false);
      setMultiplayerError("");
      loadPlayNowGames({ silent: true });
      return;
    }

    if (["active-games", "created", "join", "joined"].includes(multiplayerStep)) {
      setMultiplayerStep("h2h-menu");
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setNextCategoryPickerOpen(false);
      setMultiplayerError("");
      return;
    }

    setMultiplayerStep("menu");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerError("");
  };

  const openExistingMatch = async (matchId) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    playClickSound();
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const { match, rounds, error } = await loadMatchById(matchId);

    setMultiplayerLoading(false);

    if (error || !match) {
      setMultiplayerError("Could not open match");
      return;
    }

    setActiveMatch(match);
    setActiveRound(rounds[0] || null);
    setMatchRounds(rounds);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || "general");
    if (match.is_public && match.phase === "waiting_for_opponent") {
      setMultiplayerStep(match.player2_id ? "joined" : "play-now-waiting");
    } else {
      setMultiplayerStep(!match.player2_id ? "created" : "joined");
    }
  };

  const openPlayNowGame = async (matchId) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    playClickSound();
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const { match, rounds, error } = await loadMatchById(matchId);

    setMultiplayerLoading(false);

    if (error || !match) {
      setMultiplayerError("Could not open Play Now game");
      return;
    }

    const latestRound = rounds[0] || null;
    const playerSlot = getCurrentPlayerSlot(match, playerId, username);
    const playerAlreadyPlayed = hasPlayerFinishedRound(latestRound, playerSlot);

    setActiveMatch(match);
    setActiveRound(latestRound);
    setMatchRounds(rounds);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || latestRound?.category || "general");

    if (
      latestRound &&
      !playerAlreadyPlayed &&
      match.phase === "round_active" &&
      match.status !== "completed"
    ) {
      await openMultiplayerRoundFor(match, latestRound);
      return;
    }

    setMultiplayerStep(
      match.phase === "waiting_for_opponent" && !match.player2_id
        ? "play-now-waiting"
        : "joined"
    );
  };

  const loadLeagueDashboard = async (leagueId, { silent = false } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    if (!silent) {
      setLeagueLoading(true);
      setMultiplayerError("");
    }

    const { dashboard, error } = await fetchLeagueDashboard(
      supabase,
      leagueId,
      playerId
    );

    if (!silent) setLeagueLoading(false);

    if (error || !dashboard) {
      console.error("Could not load league", error);
      setMultiplayerError(getLeagueErrorMessage(error, "Could not load league"));
      return;
    }

    setLeagueDashboard(dashboard);
  };

  const openLeagueDashboard = async (leagueId) => {
    playClickSound();
    setMultiplayerStep("league-dashboard");
    await loadLeagueDashboard(leagueId);
  };

  const createNewLeague = async () => {
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    const leagueUsername =
      username && username !== "Loading profile..."
        ? username
        : profile?.display_name ||
          profile?.username ||
          effectiveAuthUser?.user_metadata?.username ||
          effectiveAuthUser?.email?.split("@")[0] ||
          "Player";

    if (!leaguePlayerId || !leagueUsername) {
      setMultiplayerError("Still loading your profile. Try again in a moment.");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");

    if (
      leagueSettings.quizCount +
        leagueSettings.top10Count +
        leagueSettings.whoamiCount <=
      0
    ) {
      setLeagueLoading(false);
      setMultiplayerError("Choose at least one daily challenge type");
      return;
    }

    await ensureOnlineProfile(leagueUsername);

    const { league, error } = await createLeague(supabase, {
      name: leagueNameInput,
      playerId: leaguePlayerId,
      username: leagueUsername,
      settings: {
        durationDays: leagueDurationInput,
        quizCount: leagueSettings.quizCount,
        top10Count: leagueSettings.top10Count,
        whoamiCount: leagueSettings.whoamiCount,
        findPlayerCount: 0,
        findPlayerScoringMode: "attempts",
        maxDailyPoints: leagueSettings.maxDailyPoints,
        leagueFormat: leagueFormatInput,
      },
    });

    setLeagueLoading(false);

    if (error || !league) {
      console.error("Could not create league", {
        error,
        playerId: leaguePlayerId,
        isGuest,
        hasAuthUser: Boolean(effectiveAuthUser),
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not create league"));
      return;
    }

    setLeagueNameInput("");
    setMultiplayerNotice("League created");
    setMyLeagues((currentLeagues) => [
      {
        league,
        member: {
          league_id: league.id,
          player_id: leaguePlayerId,
          username: leagueUsername,
          total_points: 0,
          days_played: 0,
        },
        memberCount: 1,
        rank: 1,
        todayPlayed: false,
      },
      ...currentLeagues.filter((row) => row.league?.id !== league.id),
    ]);
    setMultiplayerStep("league-dashboard");
    await loadLeagueDashboard(league.id);
  };

  const joinExistingLeague = async () => {
    if (!leagueCodeInput.trim()) return;

    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    const leagueUsername =
      username && username !== "Loading profile..."
        ? username
        : profile?.display_name ||
          profile?.username ||
          effectiveAuthUser?.user_metadata?.username ||
          effectiveAuthUser?.email?.split("@")[0] ||
          "Player";

    if (!leaguePlayerId || !leagueUsername) {
      setMultiplayerError("Still loading your profile. Try again in a moment.");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");

    await ensureOnlineProfile(leagueUsername);

    const { league, alreadyJoined, error } = await joinLeague(supabase, {
      code: leagueCodeInput,
      playerId: leaguePlayerId,
      username: leagueUsername,
    });

    setLeagueLoading(false);

    if (error || !league) {
      console.error("Could not join league", {
        error,
        playerId: leaguePlayerId,
        isGuest,
        hasAuthUser: Boolean(effectiveAuthUser),
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not join league"));
      return;
    }

    setLeagueCodeInput("");
    setMultiplayerNotice(alreadyJoined ? "League opened" : "Joined league");
    await openLeagueDashboard(league.id);
  };

  const loadMyLeagues = async () => {
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    const leagueUsername =
      username && username !== "Loading profile..."
        ? username
        : profile?.display_name ||
          profile?.username ||
          effectiveAuthUser?.user_metadata?.username ||
          effectiveAuthUser?.email?.split("@")[0] ||
          "Player";

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");
    setMultiplayerStep("my-leagues");

    await ensureOnlineProfile(leagueUsername);

    const { leagues, error } = await fetchMyLeagues(supabase, leaguePlayerId);

    setLeagueLoading(false);

    if (error) {
      console.error("Could not load leagues", {
        error,
        playerId: leaguePlayerId,
        isGuest,
        hasAuthUser: Boolean(effectiveAuthUser),
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not load leagues"));
      return;
    }

    setMyLeagues(leagues);
  };

  const confirmLeaveActiveLeague = async () => {
    playClickSound();

    if (!activeLeague?.id) return;
    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const leaguePlayerId = effectiveAuthUser?.id || playerId;
    if (!leaguePlayerId) {
      setMultiplayerError("Still loading your profile. Try again in a moment.");
      return;
    }

    setLeagueLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("");

    const { left, archived, transferredTo, error } = await leaveLeague(supabase, {
      leagueId: activeLeague.id,
      playerId: leaguePlayerId,
    });

    setLeagueLoading(false);

    if (error || !left) {
      console.error("Could not leave league", {
        error,
        leagueId: activeLeague.id,
        playerId: leaguePlayerId,
        isCreator: activeLeague.created_by_id === leaguePlayerId,
      });
      setMultiplayerError(getLeagueErrorMessage(error, "Could not leave league"));
      return;
    }

    clearLeagueAttempt(activeLeagueDay?.id);
    setLeagueExitConfirmOpen(false);
    setLeagueDashboard(null);
    setLeagueChallengeOpen(false);
    setMyLeagues((currentLeagues) =>
      currentLeagues.filter((row) => row.league?.id !== activeLeague.id)
    );
    setMultiplayerStep("my-leagues");
    setMultiplayerNotice(
      archived
        ? "League archived"
        : transferredTo
        ? `Left league. Ownership moved to ${transferredTo.username || "another member"}.`
        : "Left league"
    );

    const { leagues, error: refreshError } = await fetchMyLeagues(supabase, leaguePlayerId);
    if (!refreshError) setMyLeagues(leagues);
  };

  const customizeLeaguePreset = (format) => {
    const preset = LEAGUE_FORMATS[format];
    if (!preset) return;

    setLeagueCustomQuizCount(preset.quizCount);
    setLeagueCustomTop10Count(preset.top10Count);
    setLeagueCustomWhoAmICount(preset.whoamiCount);
    setLeagueFormatInput("custom");
  };

  const getLeagueAttemptKey = (leagueDayId = activeLeagueDay?.id) => {
    if (!leagueDayId) return "";
    return `ballKnowledgeLeagueAttempt:${playerId}:${leagueDayId}`;
  };

  const readLeagueAttempt = (leagueDayId) => {
    const key = getLeagueAttemptKey(leagueDayId);
    if (!key) return null;

    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const clearLeagueAttempt = (leagueDayId = activeLeagueDay?.id) => {
    const key = getLeagueAttemptKey(leagueDayId);
    if (key) localStorage.removeItem(key);
  };

  const buildCurrentLeagueAttempt = () => {
    if (!activeLeague || !activeLeagueDay) return null;

    return {
      status: "in_progress",
      leagueId: activeLeague.id,
      leagueDayId: activeLeagueDay.id,
      dayKey: activeLeagueDay.day_key,
      playerId,
      username,
      phase: leagueChallengePhase,
      quizScore: Number(leagueQuizScore) || 0,
      top10Score: Number(leagueTop10TotalWithCurrent) || 0,
      whoamiScore: Number(leagueWhoAmIScore) || 0,
      updatedAt: new Date().toISOString(),
    };
  };

  const saveLeagueAttempt = (attempt = buildCurrentLeagueAttempt()) => {
    if (!attempt?.leagueDayId || attempt.status !== "in_progress") return;

    localStorage.setItem(
      getLeagueAttemptKey(attempt.leagueDayId),
      JSON.stringify(attempt)
    );
  };

  const submitStoredLeagueAttempt = async (attempt, league, leagueDay) => {
    if (!attempt || !league || !leagueDay || !supabase) {
      return { submission: null, error: new Error("Missing league attempt") };
    }

    const { submission, error } = await submitLeagueDailyResult(supabase, {
      league,
      leagueDay,
      playerId,
      username,
      quizScore: Number(attempt.quizScore) || 0,
      top10Score: Number(attempt.top10Score) || 0,
      whoamiScore: Number(attempt.whoamiScore) || 0,
    });

    if (!error && submission) clearLeagueAttempt(leagueDay.id);

    return { submission, error };
  };

  const prepareLeagueChallenge = async () => {
    if (!activeLeague || activeLeagueSubmission) return;

    playClickSound();
    setLeagueLoading(true);
    setMultiplayerError("");

    try {
      const settings = getSupportedLeagueSettings(getLeagueSettingsSummary(activeLeague));
      const { leagueDay, error } = await getOrCreateLeagueDay(
        supabase,
        activeLeague
      );

      if (error || !leagueDay) {
        console.error("Could not prepare league day", {
          error,
          leagueId: activeLeague.id,
          quiz_count: settings.quizCount,
          top10_count: settings.top10Count,
          whoami_count: settings.whoamiCount,
        });
        setMultiplayerError(
          error?.message?.includes("columns")
            ? "League setup needs the latest Supabase columns"
            : "Today's league challenge is not ready"
        );
        return;
      }

      const storedAttempt = readLeagueAttempt(leagueDay.id);
      if (storedAttempt?.status === "in_progress") {
        const { submission, error: attemptError } = await submitStoredLeagueAttempt(
          storedAttempt,
          activeLeague,
          leagueDay
        );

        if (attemptError || !submission) {
          console.error("Could not lock previous league attempt", {
            error: attemptError,
            leagueId: activeLeague.id,
            leagueDayId: leagueDay.id,
            storedAttempt,
          });
          setMultiplayerError("Your league attempt is locked. Try refreshing the league.");
          return;
        }

        setMultiplayerNotice("Your previous attempt was submitted and locked.");
        await loadLeagueDashboard(activeLeague.id, { silent: true });
        return;
      }

      const quizQuestions = (await getLeagueQuestionsByIds(
        leagueDay.quiz_question_ids || []
      )).map(withShuffledOptions);
      const top10Challenge = getLeagueTop10ChallengeById(
        leagueDay.top10_challenge_id,
        `${activeLeague.id}:${leagueDay.day_key}`
      );
      const top10Challenges =
        settings.top10Count > 0
          ? Array.from({ length: settings.top10Count }, (_, index) =>
              index === 0
                ? top10Challenge
                : getLeagueTop10Challenge(
                    `${activeLeague.id}:${leagueDay.day_key}:top10:${index}`
                  )
            ).filter(Boolean)
          : [];
      const leagueWhoAmIItems = await getLeagueWhoAmIQuestionsByIds(
        leagueDay.whoami_question_ids || []
      );

      if (
        quizQuestions.length !== settings.quizCount ||
        leagueWhoAmIItems.length !== settings.whoamiCount ||
        (settings.top10Count > 0 &&
          top10Challenges.length !== settings.top10Count)
      ) {
        const quizQuestionIds = Array.isArray(leagueDay.quiz_question_ids)
          ? leagueDay.quiz_question_ids
          : [];
        const whoamiQuestionIds = Array.isArray(leagueDay.whoami_question_ids)
          ? leagueDay.whoami_question_ids
          : [];
        const loadedQuizIds = new Set(
          quizQuestions.map((question) => question.multiplayerId)
        );
        const loadedWhoAmIIds = new Set(
          leagueWhoAmIItems.map((question) => question.id)
        );

        console.error("Invalid league challenge payload", {
          leagueId: activeLeague.id,
          settings,
          dayKey: leagueDay.day_key,
          quiz_question_ids: quizQuestionIds,
          top10_challenge_id: leagueDay.top10_challenge_id,
          whoami_question_ids: whoamiQuestionIds,
          quizQuestions: quizQuestions.length,
          leagueWhoAmIItems: leagueWhoAmIItems.length,
          top10Challenges: top10Challenges.length,
          missingQuizIds: quizQuestionIds.filter((id) => !loadedQuizIds.has(id)),
          missingWhoAmIIds: whoamiQuestionIds.filter(
            (id) => !loadedWhoAmIIds.has(id)
          ),
        });
        setMultiplayerError("Today's league challenge is not ready");
        return;
      }

      setLeagueDashboard((dashboard) => ({
        ...dashboard,
        leagueDay,
      }));
      setLeagueQuizQuestions(quizQuestions);
      setLeagueTop10Challenges(top10Challenges);
      setLeagueTop10Challenge(top10Challenges[0] || null);
      setLeagueTop10Index(0);
      setLeagueTop10TotalScore(0);
      setLeagueWhoAmIQuestions(leagueWhoAmIItems);
      setLeagueQuizIndex(0);
      setLeagueQuizSelected(null);
      setLeagueQuizScore(0);
      setLeagueTimeLeft(15);
      setLeagueTop10Found([]);
      setLeagueTop10Lives(3);
      setLeagueTop10Reveal(null);
      setLeagueTop10Scanning(false);
      setLeagueTop10Input("");
      setLeagueTop10SelectedPlayer(null);
      setLeagueWhoAmIIndex(0);
      setLeagueWhoAmIClueIndex(0);
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      setLeagueWhoAmIScore(0);
      setLeagueWhoAmIFeedback(null);
      setLeagueWhoAmIShake(0);
      setLeagueResult(null);
      setLeagueChallengePhase("intro");
      setLeagueChallengeOpen(true);
      setLeagueLeaveConfirmOpen(false);
      setMultiplayerOpen(false);
    } catch (error) {
      console.error("League challenge loading failed", {
        error,
        leagueId: activeLeague?.id,
      });
      setMultiplayerError("Could not start today's league challenge");
    } finally {
      setLeagueLoading(false);
    }
  };

  const startLeagueQuiz = () => {
    playClickSound();
    const nextPhase =
      leagueQuizQuestions.length > 0
        ? "quiz"
        : leagueSettings.top10Count > 0
        ? "top10"
        : leagueSettings.whoamiCount > 0
        ? "whoami"
        : "whoami";

    setLeagueChallengePhase(nextPhase);
    setLeagueTimeLeft(15);
    const initialAttempt = buildCurrentLeagueAttempt();
    if (initialAttempt) {
      saveLeagueAttempt({
        ...initialAttempt,
        phase: nextPhase,
      });
    }
  };

  const advanceAfterLeagueTop10 = (currentListScore = leagueTop10Score) => {
    const nextTotalTop10Score = leagueTop10TotalScore + currentListScore;

    if (leagueTop10Index < leagueTop10Challenges.length - 1) {
      const nextIndex = leagueTop10Index + 1;
      setLeagueTop10TotalScore(nextTotalTop10Score);
      setLeagueTop10Index(nextIndex);
      setLeagueTop10Challenge(leagueTop10Challenges[nextIndex]);
      setLeagueTop10Found([]);
      setLeagueTop10Lives(3);
      setLeagueTop10Reveal(null);
      setLeagueTop10Scanning(false);
      setLeagueTop10Input("");
      setLeagueTop10SelectedPlayer(null);
      return;
    }

    if (leagueSettings.whoamiCount > 0) {
      setLeagueTop10TotalScore(nextTotalTop10Score);
      setLeagueTop10Found([]);
      setLeagueTop10Reveal(null);
      setLeagueTop10Input("");
      setLeagueTop10SelectedPlayer(null);
      setLeagueChallengePhase("whoami");
      return;
    }

    completeLeagueChallenge({
      top10Score: nextTotalTop10Score,
      whoamiScore: leagueWhoAmIScore,
    });
  };

  const chooseLeagueQuizAnswer = (option) => {
    if (leagueQuizSelected || !currentLeagueQuizQuestion) return;

    setLeagueQuizSelected(option);
    const isCorrect = option === currentLeagueQuizQuestion.answer;
    const nextScore = isCorrect ? leagueQuizScore + 1 : leagueQuizScore;

    if (isCorrect) {
      setLeagueQuizScore(nextScore);
      playCorrectSound();
    } else {
      playWrongSound();
    }

    window.setTimeout(() => {
      if (leagueQuizIndex >= leagueQuizQuestions.length - 1) {
        if (leagueSettings.top10Count > 0) {
          setLeagueChallengePhase("top10");
        } else if (leagueSettings.whoamiCount > 0) {
          setLeagueChallengePhase("whoami");
        } else {
          completeLeagueChallenge({ top10Score: 0, whoamiScore: 0 });
        }
      } else {
        setLeagueQuizIndex((index) => index + 1);
        setLeagueQuizSelected(null);
        setLeagueTimeLeft(15);
      }
    }, 750);
  };

  const submitLeagueTop10Answer = (playerOverride = null) => {
    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : leagueTop10SelectedPlayer;
    const guessText = guessedPlayer?.name || leagueTop10Input.trim();

    if (
      !guessText ||
      !leagueTop10Challenge ||
      leagueTop10Scanning ||
      leagueTop10Lives <= 0
    ) {
      return;
    }

    const leagueTop10Answers = getChallengeAnswers(leagueTop10Challenge);
    if (leagueTop10Answers.length === 0) return;

    const matchedAnswer = findMatchingAnswer({
      typedAnswer: guessText,
      selectedPlayer: guessedPlayer,
      answers: leagueTop10Answers,
    });
    const alreadyFound =
      matchedAnswer && leagueTop10Found.includes(matchedAnswer);
    const matchedRank = matchedAnswer
      ? leagueTop10Answers.indexOf(matchedAnswer) + 1
      : 0;
    let displayRank = leagueTop10Answers.length;

    setLeagueTop10Scanning(true);
    setLeagueTop10Reveal({
      phase: "scan",
      type: "scan",
      displayRank,
      rank: matchedRank,
      answer: matchedAnswer || guessText,
    });

    const interval = window.setInterval(() => {
      if (matchedRank && displayRank === matchedRank) {
        window.clearInterval(interval);
        setLeagueTop10Scanning(false);

        if (alreadyFound) {
          setLeagueTop10Reveal({
            phase: "result",
            type: "already",
            displayRank,
            rank: matchedRank,
            answer: matchedAnswer,
          });
          setLeagueTop10Input("");
          setLeagueTop10SelectedPlayer(null);
          window.setTimeout(() => setLeagueTop10Reveal(null), 900);
          return;
        }

        setLeagueTop10Found((answers) => [...answers, matchedAnswer]);
        setLeagueTop10Reveal({
          phase: "result",
          type: "correct",
          displayRank,
          rank: matchedRank,
          answer: matchedAnswer,
        });
        setLeagueTop10Input("");
        setLeagueTop10SelectedPlayer(null);
        playCorrectSound();

        if (leagueTop10Found.length + 1 >= leagueTop10TargetCount) {
          window.setTimeout(
            () => advanceAfterLeagueTop10(leagueTop10Found.length + 1),
            700
          );
        } else {
          window.setTimeout(() => setLeagueTop10Reveal(null), 900);
        }
        return;
      }

      displayRank -= 1;

      if (displayRank <= 0) {
        window.clearInterval(interval);
        const nextLives = Math.max(0, leagueTop10Lives - 1);
        setLeagueTop10Lives(nextLives);
        setLeagueTop10Scanning(false);
        setLeagueTop10Reveal({
          phase: "result",
          type: "wrong",
          displayRank: 0,
          rank: 0,
          answer: guessText,
        });
        setLeagueTop10Input("");
        setLeagueTop10SelectedPlayer(null);
        playWrongSound();

        if (nextLives <= 0) {
          window.setTimeout(() => {
            setLeagueTop10Reveal(null);
            setLeagueChallengePhase("top10-reveal");
          }, 850);
        } else {
          window.setTimeout(() => setLeagueTop10Reveal(null), 900);
        }
        return;
      }

      setLeagueTop10Reveal({
        phase: "scan",
        type: "scan",
        displayRank,
        rank: matchedRank,
        answer: matchedAnswer || guessText,
      });
    }, DAILY_SCAN_STEP_MS);
  };

  const moveToNextLeagueWhoAmI = (nextScore = leagueWhoAmIScore) => {
    window.setTimeout(() => {
      if (leagueWhoAmIIndex >= leagueWhoAmIQuestions.length - 1) {
        completeLeagueChallenge({
          top10Score: leagueTop10TotalWithCurrent,
          whoamiScore: nextScore,
        });
        return;
      }

      setLeagueWhoAmIIndex((index) => index + 1);
      setLeagueWhoAmIClueIndex(0);
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      setLeagueWhoAmIFeedback(null);
    }, 900);
  };

  const submitLeagueWhoAmIAnswer = (playerOverride = null) => {
    const guessedPlayer = isPlayerLike(playerOverride)
      ? playerOverride
      : leagueWhoAmISelectedPlayer;

    if (
      !currentLeagueWhoAmI ||
      (!leagueWhoAmIInput.trim() && !guessedPlayer) ||
      leagueWhoAmIFeedback?.locked
    ) {
      return;
    }

    const guess = leagueWhoAmIInput.trim();
    const isCorrect = isPlayerAnswerCorrect({
      typedAnswer: guess,
      selectedPlayer: guessedPlayer,
      question: currentLeagueWhoAmI,
      acceptedAnswers: currentLeagueWhoAmI.acceptedAnswers || [],
    });

    if (isCorrect) {
      const earnedPoints = leagueWhoAmIPointsAvailable;
      const nextScore = leagueWhoAmIScore + earnedPoints;
      setLeagueWhoAmIScore(nextScore);
      setLeagueWhoAmIFeedback({
        type: "correct",
        text: `Correct: ${currentLeagueWhoAmI.answer}  +${earnedPoints}`,
        locked: true,
      });
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      playCorrectSound();
      moveToNextLeagueWhoAmI(nextScore);
      return;
    }

    if (leagueWhoAmIClueIndex < currentLeagueWhoAmI.clues.length - 1) {
      setLeagueWhoAmIClueIndex((index) => index + 1);
      setLeagueWhoAmIFeedback({
        type: "wrong",
        text: "New clue unlocked",
      });
      setLeagueWhoAmIInput("");
      setLeagueWhoAmISelectedPlayer(null);
      setLeagueWhoAmIShake((value) => value + 1);
      playWrongSound();
      window.setTimeout(() => setLeagueWhoAmIFeedback(null), 650);
      return;
    }

    setLeagueWhoAmIFeedback({
      type: "wrong",
      text: `Answer: ${currentLeagueWhoAmI.answer}  0 points`,
      locked: true,
    });
    setLeagueWhoAmIInput("");
    setLeagueWhoAmISelectedPlayer(null);
    setLeagueWhoAmIShake((value) => value + 1);
    playWrongSound();
    moveToNextLeagueWhoAmI(leagueWhoAmIScore);
  };

  const completeLeagueChallenge = async ({
    quizScore = leagueQuizScore,
    top10Score = leagueTop10Score,
    whoamiScore = leagueWhoAmIScore,
    abandoned = false,
  } = {}) => {
    if (!activeLeague || !activeLeagueDay || leagueResult) return false;

    playClickSound();
    setLeagueLoading(true);
    setMultiplayerError("");

    const { submission, alreadySubmitted, error } = await submitLeagueDailyResult(
      supabase,
      {
        league: activeLeague,
        leagueDay: activeLeagueDay,
        playerId,
        username,
        quizScore,
        top10Score,
        whoamiScore,
      }
    );

    setLeagueLoading(false);

    if (error || !submission) {
      setMultiplayerError("Could not save league score");
      return false;
    }

    const leagueDayKey =
      activeLeagueDay.day_key || `${activeLeague.id}:${activeLeagueDay.day_number}`;
    if (!alreadySubmitted && !abandoned) {
      updateProgressionStats((stats) =>
        addStat(stats, "league_days_completed", 1)
      );
      awardXp({
        key: `league-day:${activeLeague.id}:${leagueDayKey}`,
        amount: 100,
        label: "League day complete",
      });
    }

    clearLeagueAttempt(activeLeagueDay.id);
    setLeagueResult({
      quizScore: submission.quiz_score,
      top10Score: submission.top10_score,
      whoamiScore: submission.whoami_score || whoamiScore,
      totalPoints: submission.total_points,
      alreadySubmitted,
      abandoned,
    });
    setLeagueChallengePhase("complete");
    await loadLeagueDashboard(activeLeague.id, { silent: true });
    return true;
  };

  const isLeagueAttemptLocked = () =>
    leagueChallengeOpen &&
    activeLeague &&
    activeLeagueDay &&
    !activeLeagueSubmission &&
    leagueChallengePhase !== "intro" &&
    leagueChallengePhase !== "complete";

  const closeLeagueChallenge = async ({ force = false } = {}) => {
    playClickSound();

    if (!force && isLeagueAttemptLocked()) {
      saveLeagueAttempt();
      setLeagueLeaveConfirmOpen(true);
      return;
    }

    setLeagueChallengeOpen(false);
    setLeagueLeaveConfirmOpen(false);
    setMultiplayerOpen(true);
    setMultiplayerStep("league-dashboard");
    if (activeLeague?.id) {
      await loadLeagueDashboard(activeLeague.id, { silent: true });
    }
  };

  const submitAndCloseLeagueAttempt = async () => {
    if (!activeLeague || !activeLeagueDay || leagueAttemptSubmitting) return;

    setLeagueAttemptSubmitting(true);
    saveLeagueAttempt();

    const saved = await completeLeagueChallenge({
      quizScore: leagueQuizScore,
      top10Score: leagueTop10TotalWithCurrent,
      whoamiScore: leagueWhoAmIScore,
      abandoned: true,
    });

    setLeagueAttemptSubmitting(false);

    if (saved) {
      await closeLeagueChallenge({ force: true });
    }
  };

  const startPlayNow = async (categoryId = playNowCategory) => {
    if (playNowRequestRef.current || multiplayerLoading) return;

    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = await getMultiplayerAuthPlayerId("start Play Now matches");
    if (!matchPlayerId) return;
    const matchUsername = username || getGuestDisplayName();

    playNowRequestRef.current = true;
    setMultiplayerLoading(true);
    setMultiplayerError("");
    setMultiplayerNotice("Searching for opponent...");

    let matchmakingResult;
    try {
      matchmakingResult = await findOrCreatePublicMatch(
        supabase,
        {
          playerId: matchPlayerId,
          username: matchUsername,
          categoryId,
        }
      );
    } catch (error) {
      console.error("Could not start matchmaking", error);
      setMultiplayerLoading(false);
      playNowRequestRef.current = false;
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(error, "Could not start matchmaking")
      );
      return;
    }

    const { match, round, created, joined, error } = matchmakingResult;

    setMultiplayerLoading(false);
    playNowRequestRef.current = false;

    if (error || !match) {
      console.error("Could not start matchmaking", error);
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(error, "Could not start matchmaking")
      );
      return;
    }

    setActiveMatch(match);
    setActiveRound(round || null);
    setMatchRounds(round ? [round] : []);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerMode(match.mode || "general");
    setMultiplayerNotice(
      joined ? "Random opponent found" : "Random challenge started"
    );
    loadPlayNowGames({ silent: true });

    if (round) {
      await openMultiplayerRoundFor(match, round, matchPlayerId, matchUsername);
      return;
    }

    setMultiplayerStep(created ? "play-now-waiting" : "joined");
  };

  const requestDeleteMatch = (match) => {
    playClickSound();
    setMatchDeleteCandidate(match);
  };

  const cancelDeleteMatch = () => {
    playClickSound();
    setMatchDeleteCandidate(null);
  };

  const confirmDeleteMatch = async () => {
    if (deleteMatchRequestRef.current || !matchDeleteCandidate?.id || !supabase) return;

    const matchId = matchDeleteCandidate.id;

    playClickSound();
    deleteMatchRequestRef.current = true;
    setDeletingMatchId(matchId);
    setMultiplayerError("");
    setMultiplayerNotice("");

    const removeMatchLocally = (notice) => {
      setActiveGames((games) =>
        games.filter(({ match }) => match.id !== matchId)
      );
      setPlayNowGames((games) =>
        games.filter(({ match }) => match.id !== matchId)
      );

      if (activeMatch?.id === matchId) {
        setActiveMatch(null);
        setActiveRound(null);
        setMatchRounds([]);
        setMultiplayerStep("menu");
      }

      setMultiplayerNotice(notice);
      setMatchDeleteCandidate(null);
      setDeletingMatchId(null);
      deleteMatchRequestRef.current = false;
    };

    const { data: existingMatch, error: lookupError } = await supabase
      .from("matches")
      .select("id")
      .eq("id", matchId)
      .maybeSingle();

    if (lookupError) {
      console.error("Could not check match before delete", lookupError);
      setDeletingMatchId(null);
      deleteMatchRequestRef.current = false;
      setMultiplayerError("Could not delete match");
      return;
    }

    if (!existingMatch) {
      removeMatchLocally("Match already removed");
      return;
    }

    const { error: roundsDeleteError } = await supabase
      .from("multiplayer_rounds")
      .delete()
      .eq("match_id", matchId);

    if (roundsDeleteError) {
      console.error("Could not delete multiplayer rounds", roundsDeleteError);
      setDeletingMatchId(null);
      deleteMatchRequestRef.current = false;
      setMultiplayerError("Could not delete match");
      return;
    }

    const { error: playersDeleteError } = await supabase
      .from("match_players")
      .delete()
      .eq("match_id", matchId);

    if (playersDeleteError) {
      console.error("Could not delete match players", playersDeleteError);
      setDeletingMatchId(null);
      deleteMatchRequestRef.current = false;
      setMultiplayerError("Could not delete match");
      return;
    }

    const { data: deletedMatches, error: matchDeleteError } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId)
      .select("id");

    if (matchDeleteError) {
      console.error("Could not delete match", matchDeleteError);
      setDeletingMatchId(null);
      deleteMatchRequestRef.current = false;
      setMultiplayerError("Could not delete match");
      return;
    }

    removeMatchLocally(
      deletedMatches?.length ? "Match deleted" : "Match already removed"
    );
  };

  const refreshMultiplayerMatch = async ({ silent = false } = {}) => {
    if (!activeMatch?.id || !supabase) return;

    if (!silent) {
      setMultiplayerLoading(true);
      setMultiplayerError("");
    }

    const { match: data, rounds, error } = await loadMatchById(activeMatch.id);

    if (error || !data) {
      if (!silent) setMultiplayerLoading(false);
      setActiveMatch(null);
      setActiveRound(null);
      setMatchRounds([]);
      setMultiplayerError("Could not refresh room");
      return;
    }

    if (!silent) setMultiplayerLoading(false);

    setActiveMatch(data);
    setActiveRound(rounds?.[0] || null);
    setMatchRounds(rounds || []);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(data.room_code);
    if (data.is_public && data.phase === "waiting_for_opponent" && !data.player2_id) {
      setMultiplayerStep("play-now-waiting");
    } else if (data.status === "ready") {
      setMultiplayerStep("joined");
    } else if (data.is_public && data.player2_id) {
      setMultiplayerStep("joined");
    }
  };

  function createMockRoomCode() {
    return `BK-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const createMultiplayerMatch = async () => {
    if (createMatchRequestRef.current || multiplayerLoading) return;

    // TODO Supabase later: create match_rounds/match_questions records when
    // replacing Start Test Round with the real turn-based round flow.
    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = await getMultiplayerAuthPlayerId("create H2H matches");
    if (!matchPlayerId) return;
    const matchUsername = username || getGuestDisplayName();
    createMatchRequestRef.current = true;
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const roomCode = createMockRoomCode();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        room_code: roomCode,
        mode: multiplayerMode,
        created_by: matchUsername,
        current_turn: matchUsername,
        current_turn_id: matchPlayerId,
        player1_username: matchUsername,
        player1_id: matchPlayerId,
        status: "active",
        phase: "choose_category",
        round_number: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (import.meta.env?.DEV) {
      console.log("[mp-create-match-direct]", {
        match,
        error: matchError,
        roomCode,
        playerId: matchPlayerId,
      });
    }

    if (matchError || !match) {
      console.error("Could not create match", matchError);
      setMultiplayerLoading(false);
      createMatchRequestRef.current = false;
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(matchError, "Could not create match")
      );
      return;
    }

    const { error: playerError } = await supabase.from("match_players").insert({
      match_id: match.id,
      username: matchUsername,
      player_id: matchPlayerId,
      player_slot: "player1",
    });

    setMultiplayerLoading(false);

    if (playerError) {
      console.error("Match created, but player join failed", playerError);
      createMatchRequestRef.current = false;
      setMultiplayerError(
        getMultiplayerPermissionErrorMessage(playerError, "Match created, but player join failed")
      );
      return;
    }

    setActiveMatch(match);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(match.room_code);
    setMultiplayerStep("created");
    createMatchRequestRef.current = false;
  };

  const joinMultiplayerMatch = async () => {
    if (joinMatchRequestRef.current || multiplayerLoading) return;

    // TODO Supabase later: replace manual Refresh with realtime updates or
    // polling for match status and opponent readiness.
    if (!joinRoomCode.trim()) return;

    playClickSound();

    if (!isSupabaseConfigured || !supabase) {
      setMultiplayerError("Supabase env vars are missing");
      return;
    }

    const matchPlayerId = await getMultiplayerAuthPlayerId("join H2H matches");
    if (!matchPlayerId) return;
    const matchUsername = username || getGuestDisplayName();

    joinMatchRequestRef.current = true;
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const roomCode = normalizeRoomCode(joinRoomCode);
    const {
      match: updatedMatch,
      error: joinError,
      normalizedRoomCode,
    } = await joinPrivateMatchByRoomCode(supabase, {
      roomCode,
      playerId: matchPlayerId,
      username: matchUsername,
    });

    setJoinRoomCode(normalizedRoomCode);

    if (joinError || !updatedMatch) {
      console.error("Could not join private room", {
        code: joinError?.code,
        message: joinError?.message,
      });
      setMultiplayerLoading(false);
      joinMatchRequestRef.current = false;
      setMultiplayerError(getPrivateJoinErrorMessage(joinError));
      return;
    }

    const { rounds, error: roundLoadError } = await loadMatchById(updatedMatch.id);
    const latestRound = rounds?.[0] || null;

    setActiveMatch(updatedMatch);
    setActiveRound(latestRound);
    setMatchRounds(rounds || []);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode(updatedMatch.room_code);
    setMultiplayerMode(updatedMatch.mode || latestRound?.category || multiplayerMode);
    await fetchActiveGames({ silent: true });

    if (roundLoadError) {
      console.error("Joined room, but round load failed", roundLoadError);
    }

    setMultiplayerLoading(false);

    if (
      latestRound &&
      updatedMatch.phase === "round_active" &&
      !hasPlayerFinishedRound(latestRound, "player2")
    ) {
      await openMultiplayerRoundFor(updatedMatch, latestRound, matchPlayerId, matchUsername);
      joinMatchRequestRef.current = false;
      return;
    }

    setMultiplayerStep("joined");
    joinMatchRequestRef.current = false;
  };

  const selectMultiplayerCategory = async (category) => {
    if (
      categoryRequestRef.current ||
      !category.available ||
      !activeMatch?.id ||
      !supabase ||
      multiplayerLoading
    ) {
      return;
    }

    playClickSound();
    categoryRequestRef.current = true;
    setMultiplayerLoading(true);
    setMultiplayerError("");

    let questionIds = [];
    try {
      questionIds = await pickMultiplayerQuestionIds(category.id, 5);
    } catch (error) {
      console.error("Could not load multiplayer questions", error);
      setMultiplayerLoading(false);
      categoryRequestRef.current = false;
      setMultiplayerError("Could not load questions for this category");
      return;
    }

    if (questionIds.length !== 5) {
      setMultiplayerLoading(false);
      categoryRequestRef.current = false;
      setMultiplayerError("Not enough questions in this category yet");
      return;
    }

    const nextRoundNumber = (activeMatch.round_number || 0) + 1;

    const { data: existingRound, error: existingRoundError } = await supabase
      .from("multiplayer_rounds")
      .select("*")
      .eq("match_id", activeMatch.id)
      .eq("round_number", nextRoundNumber)
      .maybeSingle();

    if (existingRoundError) {
      setMultiplayerLoading(false);
      categoryRequestRef.current = false;
      setMultiplayerError("Could not check existing round");
      return;
    }

    if (existingRound) {
      setActiveRound(existingRound);
      setMatchRounds((rounds) => [
        existingRound,
        ...rounds.filter((round) => round.id !== existingRound.id),
      ]);
      setNextCategoryPickerOpen(false);
      setMultiplayerLoading(false);
      categoryRequestRef.current = false;
      return;
    }

    const { data: round, error: roundError } = await supabase
      .from("multiplayer_rounds")
      .insert({
        match_id: activeMatch.id,
        round_number: nextRoundNumber,
        category: category.id,
        chosen_by: username,
        question_ids: questionIds,
        player1_score: 0,
        player2_score: 0,
        player1_finished: false,
        player2_finished: false,
        status: "active",
      })
      .select()
      .single();

    if (roundError) {
      const { data: duplicateRound } = await supabase
        .from("multiplayer_rounds")
        .select("*")
        .eq("match_id", activeMatch.id)
        .eq("round_number", nextRoundNumber)
        .maybeSingle();

      if (duplicateRound) {
        setActiveRound(duplicateRound);
        setMatchRounds((rounds) => [
          duplicateRound,
          ...rounds.filter((item) => item.id !== duplicateRound.id),
        ]);
        setNextCategoryPickerOpen(false);
        setMultiplayerLoading(false);
        categoryRequestRef.current = false;
        return;
      }

      setMultiplayerLoading(false);
      categoryRequestRef.current = false;
      setMultiplayerError("Could not create round");
      return;
    }

    if (!round) {
      setMultiplayerLoading(false);
      categoryRequestRef.current = false;
      setMultiplayerError("Could not create round");
      return;
    }

    const { data, error } = await supabase
      .from("matches")
      .update({
        selected_category: category.id,
        mode: category.mode,
        phase: "round_active",
        round_number: nextRoundNumber,
        current_turn: username,
        current_turn_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeMatch.id)
      .select()
      .single();

    setMultiplayerLoading(false);

    if (error || !data) {
      categoryRequestRef.current = false;
      setMultiplayerError("Could not update category");
      return;
    }

    setActiveMatch(data);
    setActiveRound(round);
    setMatchRounds((rounds) => [
      round,
      ...rounds.filter((item) => item.id !== round.id),
    ]);
    setNextCategoryPickerOpen(false);
    setMultiplayerMode(data.mode || category.mode);
    await openMultiplayerRoundFor(data, round);
    categoryRequestRef.current = false;
  };

  const startMockMultiplayerMatch = () => {
    // TODO Supabase: replace Start Test Round with real turn-based round flow.
    playClickSound();
    startGame(multiplayerMode, { multiplayer: true });
  };

  const startActiveMultiplayerRound = () => {
    if (!activeRound || !Array.isArray(activeRound.question_ids) || activeRound.question_ids.length !== 5) {
      setMultiplayerError("Round questions are not ready");
      return;
    }

    if (hasPlayedActiveRound) {
      setMultiplayerError("You have already played this round");
      return;
    }

    playClickSound();
    setIsSubmittingRound(false);
    submitRoundRequestRef.current = false;
    setMultiplayerRoundOpen(true);
    setMultiplayerOpen(false);
  };

  const openMultiplayerRoundFor = async (
    match,
    round,
    currentPlayerId = playerId,
    currentUsername = username
  ) => {
    if (!match || !round) {
      setMultiplayerError("Round questions are not ready");
      return;
    }

    if (!Array.isArray(round.question_ids) || round.question_ids.length !== 5) {
      setMultiplayerError("Round questions are not ready");
      return;
    }

    const playerSlot = getCurrentPlayerSlot(match, currentPlayerId, currentUsername);
    if (hasPlayerFinishedRound(round, playerSlot)) {
      setActiveMatch(match);
      setActiveRound(round);
      setMatchRounds((rounds) => [
        round,
        ...rounds.filter((item) => item.id !== round.id),
      ]);
      setMultiplayerStep("joined");
      setMultiplayerNotice("Your score is already saved");
      return;
    }

    playClickSound();
    setActiveMatch(match);
    setActiveRound(round);
    setMatchRounds((rounds) => [
      round,
      ...rounds.filter((item) => item.id !== round.id),
    ]);
    setMultiplayerMode(match.mode || "general");
    setMultiplayerRoomCode(match.room_code);
    setIsSubmittingRound(false);
    submitRoundRequestRef.current = false;
    setMultiplayerRoundOpen(true);
    setMultiplayerOpen(false);
  };

  const submitMultiplayerRoundScore = async (scoreOverride = 0) => {
    if (!supabase || !activeRound?.id || !activeMatch?.id || !multiplayerPlayerSlot) {
      setMultiplayerError("Could not submit round");
      return;
    }

    if (
      submitRoundRequestRef.current ||
      isSubmittingRound ||
      hasPlayerFinishedRound(activeRound, multiplayerPlayerSlot)
    ) {
      setMultiplayerRoundOpen(false);
      setMultiplayerOpen(true);
      setMultiplayerStep("joined");
      return;
    }

    submitRoundRequestRef.current = true;
    setIsSubmittingRound(true);
    setMultiplayerLoading(true);
    setMultiplayerError("");

    const scoreField =
      multiplayerPlayerSlot === "player1" ? "player1_score" : "player2_score";
    const finishedField =
      multiplayerPlayerSlot === "player1"
        ? "player1_finished"
        : "player2_finished";

    const roundPatch = {
      [scoreField]: scoreOverride,
      [finishedField]: true,
    };

    const otherPlayerFinished =
      multiplayerPlayerSlot === "player1"
        ? Boolean(activeRound.player2_finished)
        : Boolean(activeRound.player1_finished);

    let winner = null;

    if (otherPlayerFinished) {
      const player1Score =
        multiplayerPlayerSlot === "player1"
          ? scoreOverride
          : activeRound.player1_score || 0;
      const player2Score =
        multiplayerPlayerSlot === "player2"
          ? scoreOverride
          : activeRound.player2_score || 0;

      if (player1Score > player2Score) winner = activeMatch.player1_username;
      if (player2Score > player1Score) winner = activeMatch.player2_username;
      if (player1Score === player2Score) winner = "draw";

      roundPatch.winner = winner;
      roundPatch.status = "finished";
    }

    const { data: updatedRound, error: roundError } = await supabase
      .from("multiplayer_rounds")
      .update(roundPatch)
      .eq("id", activeRound.id)
      .select()
      .single();

    if (roundError || !updatedRound) {
      setMultiplayerLoading(false);
      setIsSubmittingRound(false);
      submitRoundRequestRef.current = false;
      setMultiplayerError("Could not submit round");
      return;
    }

    let matchPatch = {
      updated_at: new Date().toISOString(),
    };
    const isPublicPlayNowMatch = Boolean(activeMatch.is_public);

    if (otherPlayerFinished) {
      // Next chooser rule: the player who submits second chooses the next
      // category, which keeps async play moving without requiring both players
      // to be online together.
      matchPatch = {
        ...matchPatch,
        status: "active",
        phase: "round_finished",
        matchmaking_status: isPublicPlayNowMatch ? "matched" : activeMatch.matchmaking_status,
        current_turn: username,
        current_turn_id: playerId,
      };

      if (winner === activeMatch.player1_username) {
        matchPatch.player1_wins = (activeMatch.player1_wins || 0) + 1;
      }

      if (winner === activeMatch.player2_username) {
        matchPatch.player2_wins = (activeMatch.player2_wins || 0) + 1;
      }

      updateProgressionStats((stats) => {
        let nextStats = addStat(stats, "h2h_matches_completed", 1);
        if (winner === username) {
          nextStats = addStat(nextStats, "h2h_wins", 1);
        }
        return nextStats;
      });
      awardXp({
        key: `h2h-complete:${activeRound.id}`,
        amount: 50,
        label: "H2H complete",
      });
      if (winner === username) {
        awardXp({
          key: `h2h-win:${activeRound.id}`,
          amount: 100,
          label: "H2H win",
        });
      }
    } else if (isPublicPlayNowMatch && !activeMatch.player2_id) {
      matchPatch = {
        ...matchPatch,
        status: "waiting_for_opponent",
        phase: "waiting_for_opponent",
        matchmaking_status: "waiting_for_opponent",
        current_turn: null,
        current_turn_id: null,
      };
    } else if (isPublicPlayNowMatch) {
      matchPatch = {
        ...matchPatch,
        status: "active",
        phase: "round_active",
        matchmaking_status: "matched",
        current_turn: null,
        current_turn_id: null,
      };
    } else if (multiplayerPlayerSlot === "player1" && !activeMatch.player2_id) {
      matchPatch = {
        ...matchPatch,
        status: "waiting",
        phase: "round_active",
        current_turn: null,
        current_turn_id: null,
      };
    }

    let updatedMatch = activeMatch;

    if (Object.keys(matchPatch).length > 0) {
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .update(matchPatch)
        .eq("id", activeMatch.id)
        .select()
        .single();

      if (matchError || !matchData) {
        setMultiplayerLoading(false);
        setIsSubmittingRound(false);
        submitRoundRequestRef.current = false;
        setMultiplayerError("Round saved, but match update failed");
        return;
      }

      updatedMatch = matchData;
    }

    setMultiplayerLoading(false);
    setIsSubmittingRound(false);
    submitRoundRequestRef.current = false;
    setMultiplayerNotice("Score submitted");
    setActiveRound(updatedRound);
    setMatchRounds((rounds) => [
      updatedRound,
      ...rounds.filter((round) => round.id !== updatedRound.id),
    ]);
    setActiveMatch(updatedMatch);
    setMultiplayerRoundOpen(false);
    setMultiplayerOpen(true);
    if (isPublicPlayNowMatch) {
      loadPlayNowGames({ silent: true });
    }
    setMultiplayerStep(
      isPublicPlayNowMatch && !otherPlayerFinished && !updatedMatch.player2_id
        ? "play-now-waiting"
        : !isPublicPlayNowMatch &&
          multiplayerPlayerSlot === "player1" &&
          !updatedMatch.player2_id
        ? "created"
        : "joined"
    );
  };

  const startDailyChallenge = () => {
    if (dailyPlayed) return;

    if (isDailyPlayerChallenge) preloadPlayerSearchLazy();
    setShowDailyCompletePopup(false);
    setLeaderboardOpen(false);
    setProfileOpen(false);
    setMultiplayerOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setGameMode("daily-list");
    setFoundAnswers([]);
    setDailyCoinsEarned(0);
    setTop10ResumeVersion((version) => version + 1);
    setQuestionIndex(0);
    setSelected(null);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
    setRevivesUsed(0);
    setGeneralGameSnapshot(null);
    setGeneralResumeVersion(0);
    setWorldCupGameSnapshot(null);
    setWorldCupResumeVersion(0);
    setCareerGameSnapshot(null);
    setCareerResumeVersion(0);
    setWhoAmIQuestion(null);
    setWhoAmIGameSnapshot(null);
    setWhoAmIResumeVersion(0);
    setPostGameStep("summary");
    setRewardPopup(null);
    setWrongPopup(null);
    setStreakRewardEarned(0);
    awardXp({
      key: `daily-play:${getDailyDateKey()}`,
      amount: 25,
      label: "Daily played",
    });
    setGameStarted(true);
  };

  const restart = () => {
    setGameStarted(false);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setCoinsMenuOpen(false);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);
    setMultiplayerStep("menu");
    setActiveMatch(null);
    setActiveRound(null);
    setMatchRounds([]);
    setNextCategoryPickerOpen(false);
    setMultiplayerRoomCode("");
    setJoinRoomCode("");
    setMultiplayerError("");
    setMultiplayerLoading(false);
    setGameMode("general");

    setQuestions([]);
    setQuestionIndex(0);

    setSelected(null);
    setTextAnswer("");
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setFinished(false);
    setRevivesUsed(0);
    setPostGameStep("summary");
    setObjectiveProgressUpdate(null);
    setLevelUpPopup(null);

    setRewardPopup(null);
    setWrongPopup(null);

    setFoundAnswers([]);
    setDailyCoinsEarned(0);
    setTop10ResumeVersion((version) => version + 1);
    setWhoAmIQuestion(null);
    setWhoAmIGameSnapshot(null);
    setWhoAmIResumeVersion(0);
  };

  const exitToHomeSafely = (reason = "manual") => {
    setGameStarted(false);
    setModeMenuOpen(false);
    setProfileOpen(false);
    setLeaderboardOpen(false);
    setMultiplayerOpen(false);
    setConnectionsDifficultyPickerOpen(false);
    setCoinsMenuOpen(false);
    setGameMode("general");
    setFinished(false);
    setPostGameStep("summary");
    setObjectiveProgressUpdate(null);
    setRewardPopup(null);
    setWrongPopup(null);
    setLevelUpPopup(null);
    setSelected(null);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
    setQuestionIndex(0);
    setScore(0);
    setLives(3);
    setStreak(0);
    setTimeLeft(HARD_TIME_LIMIT);
    setRevivesUsed(0);
    setGeneralGameSnapshot(null);
    setGeneralResumeVersion(0);
    setWorldCupGameSnapshot(null);
    setWorldCupResumeVersion(0);
    setCareerGameSnapshot(null);
    setCareerResumeVersion(0);
    setIsMockMultiplayer(false);
    setMockOpponentScore(null);

    if (reason === "invalid-state") {
      console.error("Recovered invalid game state by returning home", {
        gameStarted,
        gameMode,
        finished,
        postGameStep,
      });
    }
  };

  const nextQuestion = () => {
    setQuestionIndex((i) => (i + 1) % questions.length);
    setSelected(null);
    setTextAnswer("");
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
    setStreak(0);

    const newLives = Math.max(lives - 1, 0);
    setLives(newLives);

    playWrongSound();

    if (newLives <= 0) {
      setSelected(correctAnswer);
      if (isMockMultiplayer) {
        setMockOpponentScore(createMockOpponentScore(score));
      }

      setTimeout(() => {
        setFinished(true);
      }, 1500);
    } else {
      setTimeout(() => {
        nextQuestion();
      }, 1200);
    }
  };

  const chooseAnswer = (option) => {
    if (selected || rewardPopup || objectiveProgressUpdate) return;

    setSelected(option);

    if (isCorrectAnswer(option, current.answer)) {
      const newScore = score + 1;
      const newStreak = streak + 1;
      const reward = getRewardForScore(newScore);

      setScore(newScore);
      setStreak(newStreak);

      if ((gameMode === "world-cup" || gameMode === "career") && !isMockMultiplayer) {
        if (awardXp({
          key: `${gameMode}-correct:${Date.now()}:${questionIndex}:${newScore}`,
          amount: 5,
          label: "Correct answer",
          placement: "inline",
        })) {
          setGeneralRunXpSummary((summary) => ({
            ...summary,
            correct: summary.correct + 5,
          }));
        }
      }

      if (reward > 0) {
        const newCoins = coins + reward;
        saveCoins(newCoins);

        setRewardPopup({
          streak: newStreak,
          coins: reward,
          onCollect: "next-question",
        });

        playCorrectSound();
      } else {
        playCorrectSound();
        setTimeout(nextQuestion, 950);
      }
    } else {
      handleWrongAnswer(current.answer);
    }
  };

  const handleGeneralHighScore = (newScore) => {
    setHighScore(newScore);
    localStorage.setItem("footballQuizHighScore", String(newScore));
    updateOnlineProfile(
      {
        best_score: newScore,
        coins,
        daily_streak: dailyStreak,
        xp_total: xpTotal,
        level_id: careerLevelId,
        progression_stats: {
          ...progressionStats,
          best_general_score: Math.max(
            Number(progressionStats.best_general_score) || 0,
            newScore
          ),
        },
      },
      "ready"
    );
    updateProgressionStats((stats) =>
      maxStat(stats, "best_general_score", newScore)
    );
  };

  const awardGeneralRunXp = ({ key, amount, label }) =>
    awardXp({
      key,
      amount,
      label,
      placement: "inline",
    });

  const awardClassicQuizRunXp = ({ key, amount, label }) =>
    awardXp({
      key,
      amount,
      label,
      placement: "inline",
    });

  const finishGeneralGame = (snapshot) => {
    rememberGeneralQuestionsServed(questions, snapshot);
    setGeneralGameSnapshot(snapshot);
    setQuestionIndex(snapshot.questionIndex || 0);
    setSelected(snapshot.selected || null);
    setScore(snapshot.score || 0);
    setLives(snapshot.lives ?? 0);
    setStreak(snapshot.streak || 0);
    setRevivesUsed(snapshot.revivesUsed || 0);
    setGeneralRunXpSummary(snapshot.runXpSummary || { correct: 0, streak: 0, highscore: 0 });
    setFinished(true);
  };

  const exitGeneralGame = (snapshot) => {
    rememberGeneralQuestionsServed(questions, snapshot);
    setGeneralGameSnapshot(snapshot);
    exitToHomeSafely("general-home");
  };

  const finishWorldCupGame = (snapshot) => {
    setWorldCupGameSnapshot(snapshot);
    setQuestionIndex(snapshot.questionIndex || 0);
    setSelected(snapshot.selected || null);
    setTextAnswer(snapshot.textAnswer || "");
    setScore(snapshot.score || 0);
    setLives(snapshot.lives ?? 0);
    setStreak(snapshot.streak || 0);
    setRevivesUsed(snapshot.revivesUsed || 0);
    setGeneralRunXpSummary(snapshot.runXpSummary || { correct: 0, streak: 0, highscore: 0 });
    setFinished(true);
  };

  const exitWorldCupGame = (snapshot) => {
    setWorldCupGameSnapshot(snapshot);
    exitToHomeSafely("world-cup-home");
  };

  const finishCareerGame = (snapshot) => {
    setCareerGameSnapshot(snapshot);
    setQuestionIndex(snapshot.questionIndex || 0);
    setSelected(snapshot.selected || null);
    setTextAnswer(snapshot.textAnswer || "");
    setCareerSelectedPlayer(snapshot.selectedPlayer || null);
    setScore(snapshot.score || 0);
    setLives(snapshot.lives ?? 0);
    setStreak(snapshot.streak || 0);
    setRevivesUsed(snapshot.revivesUsed || 0);
    setGeneralRunXpSummary(snapshot.runXpSummary || { correct: 0, streak: 0, highscore: 0 });
    setFinished(true);
  };

  const exitCareerGame = (snapshot) => {
    setCareerGameSnapshot(snapshot);
    exitToHomeSafely("career-home");
  };

  const persistTop10AnswerFound = ({ answerKey, reward }) => {
    const currentCoins = Number(localStorage.getItem("footballQuizCoins")) || coins;
    saveCoins(currentCoins + reward);
    awardXp({
      key: `daily-found:${getDailyDateKey()}:${answerKey}`,
      amount: 10,
      label: "Daily answer",
    });
  };

  const finishDaily = ({ found, earned, foundAnswers: finalFoundAnswers, score: finalScore, lives: finalLives }) => {
    setFoundAnswers(finalFoundAnswers);
    setDailyCoinsEarned(earned);
    setScore(finalScore);
    setLives(finalLives);

    if (dailyPlayed || localStorage.getItem("ballKnowledgeDailyDate") === getDailyDateKey()) {
      setFinished(true);
      return;
    }

    const streakInfo = awardDailyStreakBonus();
    const totalEarned = earned + streakInfo.reward;

    updateProgressionStats((stats) => ({
      ...addStat(stats, "daily_challenges_completed", 1),
      best_daily_score: Math.max(Number(stats.best_daily_score) || 0, found),
    }));
    awardXp({
      key: `daily-complete:${getDailyDateKey()}`,
      amount: 100,
      label: "Daily complete",
    });

    markDailyAsPlayed(found, totalEarned, streakInfo);

    setTimeout(() => {
      setFinished(true);
    }, 700);
  };

  const collectReward = () => {
    const action = rewardPopup?.onCollect;
    setRewardPopup(null);
    playCoinSound();

    if (action === "next-question") {
      nextQuestion();
    }

    if (action === "finish") {
      setFinished(true);
    }
  };

  const revive = () => {
    if (!reviveCost || revivesUsed >= 3 || coins < reviveCost) return;

    const newCoins = coins - reviveCost;
    saveCoins(newCoins);

    if (gameMode === "general" && !isMockMultiplayer && generalGameSnapshot) {
      const nextRevivesUsed = revivesUsed + 1;
      const nextSnapshot = {
        ...generalGameSnapshot,
        lives: 1,
        selected: null,
        revivesUsed: nextRevivesUsed,
      };
      setGeneralGameSnapshot(nextSnapshot);
      setRevivesUsed(nextRevivesUsed);
      setLives(1);
      setFinished(false);
      setPostGameStep("summary");
      setSelected(null);
      setGeneralResumeVersion((version) => version + 1);
      return;
    }

    if (gameMode === "world-cup" && !isMockMultiplayer && worldCupGameSnapshot) {
      const nextRevivesUsed = revivesUsed + 1;
      const nextSnapshot = {
        ...worldCupGameSnapshot,
        lives: 1,
        selected: null,
        textAnswer: "",
        revivesUsed: nextRevivesUsed,
      };
      setWorldCupGameSnapshot(nextSnapshot);
      setRevivesUsed(nextRevivesUsed);
      setLives(1);
      setFinished(false);
      setPostGameStep("summary");
      setSelected(null);
      setTextAnswer("");
      setWorldCupResumeVersion((version) => version + 1);
      return;
    }

    if (gameMode === "career" && !isMockMultiplayer && careerGameSnapshot) {
      const nextRevivesUsed = revivesUsed + 1;
      const nextSnapshot = {
        ...careerGameSnapshot,
        lives: 1,
        selected: null,
        textAnswer: "",
        selectedPlayer: null,
        revivesUsed: nextRevivesUsed,
      };
      setCareerGameSnapshot(nextSnapshot);
      setRevivesUsed(nextRevivesUsed);
      setLives(1);
      setFinished(false);
      setPostGameStep("summary");
      setSelected(null);
      setTextAnswer("");
      setCareerSelectedPlayer(null);
      setCareerResumeVersion((version) => version + 1);
      return;
    }

    setLives(1);
    setRevivesUsed((r) => r + 1);
    setFinished(false);
    setPostGameStep("summary");
    setSelected(null);
  };

  const submitTextAnswer = () => {
    if ((!textAnswer.trim() && !careerSelectedPlayer) || selected) return;

    const careerTypedPlayerMatch =
      gameMode === "career" &&
      !careerSelectedPlayer &&
      isPlayerAnswerCorrect({
        typedAnswer: textAnswer,
        correctAnswer: current?.answer,
      });

    const submittedAnswer =
      gameMode === "career" &&
      ((careerSelectedPlayer &&
        isCorrectPlayerAnswer(careerSelectedPlayer, current?.answer)) ||
        careerTypedPlayerMatch)
        ? current.answer
        : careerSelectedPlayer?.name || textAnswer;

    chooseAnswer(submittedAnswer);
    setTextAnswer("");
    setCareerSelectedPlayer(null);
  };

  const openCoinShop = () => {
    playClickSound();
    setCoinShopNotice("");
    setCoinsMenuOpen(true);
  };

  const openDailyRewardMeter = () => {
    playClickSound();
    setDailyRewardMeterOpen(true);
  };

  const openLevelModal = () => {
    playClickSound();
    setLevelModalOpen(true);
  };

  const coinShopModal = (
    <AnimatePresence>
      {coinsMenuOpen && (
        <Modal
          title="Coin Shop"
          closeLabel="Close coin shop"
          cardClassName="bk-reward-card"
          onClose={() => {
            playClickSound();
            setCoinsMenuOpen(false);
          }}
        >
            <div className="bk-coin-balance">
              <span>Current coins</span>
              <strong><BKIcon name="coins" size={22} /> {coins}</strong>
            </div>

            <div className="bk-coin-shop-list">
              <div className="bk-coin-shop-option">
                <div>
                  <strong>Earn coins</strong>
                  <small>Play quizzes, daily challenges and streaks</small>
                  <em>No purchases needed</em>
                </div>
                <Button variant="secondary" onClick={() => setCoinsMenuOpen(false)}>Play</Button>
              </div>

              <div className="bk-coin-shop-option">
                <div>
                  <strong>Extra lives</strong>
                  <small>Use coins after game over</small>
                  <em>Revives start at 500 coins</em>
                </div>
                <Button variant="secondary" onClick={() => setCoinsMenuOpen(false)}>Got it</Button>
              </div>
            </div>

            <AuthNotice tone="info">
              Keep playing to build your coin balance.
              {coinShopNotice && <span> • {coinShopNotice}</span>}
            </AuthNotice>
        </Modal>
      )}
    </AnimatePresence>
  );

  const coinRewardToastOverlay = (
    <AnimatePresence>
      {coinRewardToast && (
        <motion.div
          className="bk-toast-stack"
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.96 }}
          transition={{ duration: 0.22 }}
        >
          <div className="bk-reward-toast" role="status" aria-live="polite">
            <span className="bk-reward-toast__icon"><BKIcon name="coins" size={24} /></span>
            <div>
              <strong>+{coinRewardToast.amount} coins</strong>
              <small>{coinRewardToast.title}</small>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const xpToastOverlay = (
    <AnimatePresence>
      {xpToast && xpToast.placement !== "inline" && (
        <motion.div
          className="bk-toast-stack"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <div className="bk-reward-toast" role="status" aria-live="polite">
            <span className="bk-reward-toast__icon">XP</span>
            <div>
              <strong>+{xpToast.amount} XP</strong>
              <small>{xpToast.label || "Progress earned"}</small>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const objectiveProgressModal = (
    <AnimatePresence>
      {objectiveProgressUpdate && (
        <Modal
          title="Objective updated"
          variant="reward"
          cardClassName="bk-reward-card"
          closeLabel="Close objective progress"
          onClose={() => {
            playClickSound();
            setObjectiveProgressUpdate(null);
          }}
        >
          <div className="bk-progression-copy">
            <p className="bk-type-label">Level progress</p>
            <h3>{objectiveProgressUpdate.levelName}</h3>
          </div>

          <div className="bk-objective-list">
            {objectiveProgressUpdate.updates.map((objective) => (
              <div
                className={`bk-objective-row ${objective.complete ? "is-complete" : ""}`}
                key={objective.statKey}
              >
                <div className="bk-objective-top">
                  <strong>{objective.label}</strong>
                  <small>
                    {objective.before.toLocaleString()} to{" "}
                    {objective.after.toLocaleString()} /{" "}
                    {objective.required.toLocaleString()}
                  </small>
                </div>
                <ProgressBar
                  label={objective.label}
                  value={objective.afterProgress}
                  valueLabel={`${Math.round(objective.afterProgress)}%`}
                />
                <span className="bk-objective-status">
                  {objective.newlyCompleted
                    ? "Completed now"
                    : objective.complete
                    ? "Completed"
                    : "In progress"}
                </span>
              </div>
            ))}
          </div>

          {objectiveProgressUpdate.allComplete && (
            <AuthNotice tone="success">All objectives complete. Level up incoming.</AuthNotice>
          )}

          <Button
            onClick={() => {
              playClickSound();
              setObjectiveProgressUpdate(null);
            }}
            fullWidth
          >
            Continue
          </Button>
        </Modal>
      )}
    </AnimatePresence>
  );

  const dailyRewardTargetDay = dailyPlayed
    ? Math.max(1, dailyStreak)
    : Math.max(1, dailyStreak + 1);
  const dailyRewardRoadDays = getStreakRoadDays(dailyRewardTargetDay);
  const nextDailyReward = getNextStreakRewardInfo(dailyStreak, dailyPlayed);
  const dailyRewardHeroCopy = getDailyStreakHeroCopy(dailyStreak, dailyPlayed);
  const todaysDailyReward = getStreakReward(dailyRewardTargetDay);
  const nextMilestoneDay = Math.ceil(Math.max(1, nextDailyReward.day) / 7) * 7;
  const daysToNextMilestone = Math.max(0, nextMilestoneDay - dailyStreak);
  const nextMilestoneReward = getStreakReward(nextMilestoneDay);

  const dailyRewardMeterModal = (
    <AnimatePresence>
      {dailyRewardMeterOpen && (
        <Modal
          title="Daily Streak"
          closeLabel="Close daily streak"
          cardClassName="bk-reward-card bk-daily-streak-modal"
          closeOnBackdrop
          onClose={() => setDailyRewardMeterOpen(false)}
        >
          <section
            className={`bk-daily-streak-hero ${
              dailyPlayed ? "is-complete" : ""
            } ${dailyStreak <= 0 ? "is-start" : ""}`}
            aria-label={`Current streak ${dailyStreak} ${
              dailyStreak === 1 ? "day" : "days"
            }`}
          >
            <motion.div
              className="bk-daily-streak-flame"
              aria-hidden="true"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.86, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Flame size={36} />
            </motion.div>

            <div className="bk-daily-streak-hero__copy">
              <span className="bk-type-label">{dailyRewardHeroCopy.label}</span>
              <strong className="bk-daily-streak-number">{dailyStreak}</strong>
              <span className="bk-daily-streak-title">
                {dailyStreak === 1 ? "Day Streak" : "Day Streak"}
              </span>
              <p>{dailyRewardHeroCopy.body}</p>
            </div>
          </section>

          <section className="bk-daily-streak-reward" aria-label="Today's reward">
            <span className="bk-daily-streak-reward__icon" aria-hidden="true">
              <Coins size={24} />
            </span>
            <div>
              <span className="bk-type-label">Today's reward</span>
              <strong>+{todaysDailyReward} coins</strong>
            </div>
            <span
              className={`bk-daily-streak-status ${
                dailyPlayed ? "is-claimed" : ""
              }`}
            >
              {dailyPlayed && <CheckCircle2 size={15} aria-hidden="true" />}
              {dailyPlayed ? "Claimed" : "Play to earn"}
            </span>
          </section>

          <section className="bk-daily-streak-road" aria-label="Seven day streak rewards">
            {dailyRewardRoadDays.map((day) => {
              const reached = dailyStreak >= day.day;
              const currentDay = dailyRewardTargetDay === day.day;

              return (
                <DailyRewardSlot
                  key={day.day}
                  day={day}
                  reached={reached}
                  currentDay={currentDay}
                />
              );
            })}
          </section>

          <div className="bk-daily-streak-next">
            <div>
              <span className="bk-type-label">Next reward</span>
              <strong>
                Day {nextDailyReward.day} • +{nextDailyReward.reward} coins
              </strong>
            </div>
            <div>
              <span className="bk-type-label">Next milestone</span>
              <strong>
                Day {nextMilestoneDay} • {daysToNextMilestone}{" "}
                {daysToNextMilestone === 1 ? "day" : "days"} to go • +
                {nextMilestoneReward}
              </strong>
            </div>
          </div>

            <Button
              onClick={() => {
                playClickSound();
                setDailyRewardMeterOpen(false);
              }}
              fullWidth
              variant="secondary"
            >
              Close
            </Button>
        </Modal>
      )}
    </AnimatePresence>
  );

  const levelProgressModal = (
    <AnimatePresence>
      {levelModalOpen && (
        <Modal
          title="Level Progress"
          closeLabel="Close level progress"
          cardClassName="bk-reward-card"
          onClose={() => {
            playClickSound();
            setLevelModalOpen(false);
          }}
        >
          <div className="bk-progression-hero">
            <div className="bk-progression-icon">
              <LevelIcon levelId={playerLevel.id} size={56} />
            </div>
            <div className="bk-progression-copy">
              <p className="bk-type-label">Level {playerLevel.levelNumber}</p>
              <h3>{playerLevel.name}</h3>
              <p>{xpTotal.toLocaleString()} XP earned</p>
            </div>
          </div>

          <ProgressBar
            label="Objective progress"
            value={progressionView.objectiveProgress}
            valueLabel={playerLevel.next ? levelObjectiveSummary : "Legend status"}
          />

          <AuthNotice tone={playerLevel.next ? "info" : "success"}>
            {playerLevel.next
              ? `Next: ${playerLevel.next.name}`
              : "Legend status reached. You are at the top of Ball Knowledge."}
          </AuthNotice>

          <div className="bk-objective-list">
            {progressionView.objectives.map((objective) => (
              <div
                className={`bk-objective-row ${objective.complete ? "is-complete" : ""}`}
                key={`${objective.type}-${objective.statKey}`}
              >
                <div className="bk-objective-top">
                  <strong>{objective.label}</strong>
                  <small>
                    {Math.min(objective.current, objective.required).toLocaleString()} /{" "}
                    {objective.required.toLocaleString()}
                  </small>
                </div>
                <ProgressBar
                  label={objective.label}
                  value={objective.progress}
                  valueLabel={objective.complete ? "Completed" : "In progress"}
                />
                <span className="bk-objective-status">
                  {objective.complete ? "Completed objective" : "Still needed"}
                </span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => {
              playClickSound();
              setLevelModalOpen(false);
            }}
            fullWidth
          >
            Keep Climbing
          </Button>
        </Modal>
      )}
    </AnimatePresence>
  );

  const postGameProgressModal = (
    <AnimatePresence>
      {postGameStep === "xp" &&
        !gameStarted &&
        ["general", "world-cup", "career"].includes(gameMode) && (
        <Modal
          title="Run Progress"
          variant="reward"
          showClose={false}
          cardClassName="bk-reward-card"
          onClose={() => {}}
        >
          <div className="bk-progression-hero">
            <div className="bk-progression-icon">
              <LevelIcon levelId={playerLevel.id} size={56} />
            </div>
            <div className="bk-progression-copy">
              <p className="bk-type-label">
                {getModeLabel(gameMode)} • Level {playerLevel.levelNumber}
              </p>
              <h3>{playerLevel.name}</h3>
              <p>+{generalRunXpTotal} XP this run</p>
            </div>
          </div>

          <ProgressBar
            label="XP progress"
            value={xpProgressPercent}
            valueLabel={xpProgressLabel}
          />
          <AuthNotice tone={playerLevel.next ? "info" : "success"}>
            {playerLevel.next ? `Next: ${playerLevel.next.name}` : "Legend status reached"}
          </AuthNotice>

            <div className="bk-reward-card">
              {score > runStartHighScore && (
                <div className="bk-reward-row">
                  <strong>New Highscore!</strong>
                  <span>
                    +{generalRunXpSummary.highscore || getGeneralHighscoreXpBonus(score)} XP
                  </span>
                </div>
              )}

              <div className="bk-reward-row">
                <span>Correct answers</span>
                <strong>+{generalRunXpSummary.correct} XP</strong>
              </div>

              {generalRunXpSummary.streak > 0 && (
                <div className="bk-reward-row">
                  <span>Combo bonuses</span>
                  <strong>+{generalRunXpSummary.streak} XP</strong>
                </div>
              )}

              {generalRunXpSummary.highscore > 0 && (
                <div className="bk-reward-row">
                  <span>Highscore bonus</span>
                  <strong>+{generalRunXpSummary.highscore} XP</strong>
                </div>
              )}

              <div className="bk-reward-row">
                <span>Total XP</span>
                <strong>+{generalRunXpTotal} XP</strong>
              </div>
            </div>

            {Array.isArray(objectiveProgressUpdate?.updates) && (
              <div className="bk-objective-list">
                {objectiveProgressUpdate.updates.map((objective) => (
                  <div
                    className={`bk-objective-row ${objective.complete ? "is-complete" : ""}`}
                    key={objective.statKey}
                  >
                    <div className="bk-objective-top">
                      <strong>{objective.label}</strong>
                      <small>
                        {objective.before.toLocaleString()} →{" "}
                        {objective.after.toLocaleString()} /{" "}
                        {objective.required.toLocaleString()}
                      </small>
                    </div>
                    <ProgressBar
                      label={objective.label}
                      value={objective.afterProgress}
                      valueLabel={`${Math.round(objective.afterProgress)}%`}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={() => {
                playClickSound();
                exitToHomeSafely("post-game-collect");
              }}
              fullWidth
            >
              Collect & Continue
            </Button>
        </Modal>
      )}
    </AnimatePresence>
  );

  const connectionsRewardOverlay = (
    <AnimatePresence>
      {connectionsRewardModal && (
        <Modal
          title="Victory"
          variant="reward"
          showClose={false}
          cardClassName="bk-reward-card"
          onClose={() => closeConnectionsReward()}
        >
          <div className="bk-progression-hero">
            <div className="bk-progression-icon">
              <BKIcon name="connections" size={48} />
            </div>
            <div className="bk-progression-copy">
              <p className="bk-type-label">{connectionsRewardModal.mode}</p>
              <h3>{connectionsRewardModal.title}</h3>
              <p>
                {connectionsRewardModal.groupsSolved}/4 groups solved
                {connectionsRewardModal.perfect ? " • Perfect run" : ""}
              </p>
            </div>
          </div>

            <div className="bk-reward-summary">
              <div>
                <span>Coins</span>
                <strong><BKIcon name="coins" size={22} /> +{connectionsRewardModal.coins}</strong>
              </div>
              <div>
                <span>XP</span>
                <strong>+{connectionsRewardModal.xp}</strong>
              </div>
            </div>

            <ProgressBar
              label="XP progress"
              value={xpProgressPercent}
              valueLabel={xpProgressLabel}
            />
            <AuthNotice tone={playerLevel.next ? "info" : "success"}>
              {playerLevel.next ? `Next: ${playerLevel.next.name}` : "Legend status reached"}
            </AuthNotice>

            <div className="bk-reward-actions">
              <Button
                variant="secondary"
                onClick={() => closeConnectionsReward()}
              >
                Collect
              </Button>
              <Button
                onClick={() => closeConnectionsReward({ playAgain: true })}
              >
                Play Again
              </Button>
            </div>
        </Modal>
      )}
    </AnimatePresence>
  );

  const avatarPickerModal = (
    <AnimatePresence>
      {avatarPickerOpen && (
        <Modal
          title="Avatar Builder"
          closeLabel="Close avatar picker"
          cardClassName="bk-avatar-builder"
          onClose={() => {
            playClickSound();
            setAvatarPickerOpen(false);
          }}
        >
            <div className="bk-avatar-builder__scroll">
              <SurfaceCard className="bk-avatar-builder__preview">
                <PlayerAvatar
                  profile={{
                    avatar_icon: avatarBuilderPreview.icon,
                    avatar_style: avatarBuilderPreview.style,
                    avatar_color: avatarBuilderPreview.color,
                    avatar_bg: avatarBuilderPreview.bg,
                    favorite_country: avatarBuilderPreview.country,
                    favorite_flag: avatarBuilderPreview.flag,
                  }}
                  size="large"
                />
              <div>
                  <span className="bk-type-label">Match identity</span>
                  <strong>{displayName || "Player"}</strong>
                  <small>
                    {avatarBuilderPreview.flag} {avatarBuilderPreview.country} •{" "}
                    {avatarBuilderPreview.style} • {avatarBuilderPreview.color}
                  </small>
              </div>
              </SurfaceCard>

              <section className="bk-avatar-builder__section">
                <h3 className="bk-type-section-title">Icon</h3>
                <div className="bk-avatar-choice-grid bk-avatar-choice-grid--icons">
                  {AVATAR_ICON_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`bk-avatar-choice ${
                        emoji === avatarBuilderPreview.icon ? "is-selected" : ""
                      }`}
                      aria-pressed={emoji === avatarBuilderPreview.icon}
                      onClick={() => updateAvatarDraft({ icon: emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bk-avatar-builder__section">
                <h3 className="bk-type-section-title">Favorite Nation</h3>
                <div className="bk-avatar-choice-grid bk-avatar-choice-grid--flags">
                  {FAVORITE_NATION_OPTIONS.map((nation) => (
                    <button
                      key={nation.country}
                      type="button"
                      className={`bk-avatar-choice bk-avatar-choice--flag ${
                        nation.country === avatarBuilderPreview.country ? "is-selected" : ""
                      }`}
                      aria-pressed={nation.country === avatarBuilderPreview.country}
                      onClick={() =>
                        updateAvatarDraft({
                          country: nation.country,
                          flag: nation.flag,
                          favorite_country: nation.country,
                          favorite_flag: nation.flag,
                        })
                      }
                    >
                      <span>{nation.flag}</span>
                      <small>{nation.country}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="bk-avatar-builder__section">
                <h3 className="bk-type-section-title">Color</h3>
                <div className="bk-avatar-choice-grid bk-avatar-choice-grid--tokens">
                  {AVATAR_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`bk-avatar-choice bk-avatar-choice--token bk-avatar-choice--${color.value} ${
                        color.value === avatarBuilderPreview.color ? "is-selected" : ""
                      }`}
                      aria-pressed={color.value === avatarBuilderPreview.color}
                      onClick={() => updateAvatarDraft({ color: color.value })}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bk-avatar-builder__section">
                <h3 className="bk-type-section-title">Background</h3>
                <div className="bk-avatar-choice-grid bk-avatar-choice-grid--tokens">
                  {AVATAR_BG_OPTIONS.map((bg) => (
                    <button
                      key={bg.value}
                      type="button"
                      className={`bk-avatar-choice bk-avatar-choice--token ${
                        bg.value === avatarBuilderPreview.bg ? "is-selected" : ""
                      }`}
                      aria-pressed={bg.value === avatarBuilderPreview.bg}
                      onClick={() => updateAvatarDraft({ bg: bg.value })}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bk-avatar-builder__section">
                <h3 className="bk-type-section-title">Style</h3>
                <div className="bk-avatar-choice-grid bk-avatar-choice-grid--tokens">
                  {AVATAR_STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      className={`bk-avatar-choice bk-avatar-choice--token ${
                        style.value === avatarBuilderPreview.style ? "is-selected" : ""
                      }`}
                      aria-pressed={style.value === avatarBuilderPreview.style}
                      onClick={() => updateAvatarDraft({ style: style.value })}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </section>

              {avatarNotice && (
                <AuthNotice tone="error">{avatarNotice}</AuthNotice>
              )}
            </div>

            <div className="bk-screen-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  playClickSound();
                  setAvatarPickerOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveAvatarBuilder}
              >
                Save Avatar
              </Button>
            </div>
        </Modal>
      )}
    </AnimatePresence>
  );

  useEffect(() => {
    if (!lastDailyActivityAt || !isDailyStreakExpired(lastDailyActivityAt)) return;

    setDailyStreak(0);
    setLastDailyPlayedDate("");
    localStorage.setItem("footballQuizDailyStreak", "0");
    localStorage.removeItem("footballQuizLastDailyPlayedDate");
    if (effectiveAuthUser && isSupabaseConfigured && supabase) {
      updateProfile(supabase, effectiveAuthUser.id, {
        daily_streak: 0,
        progression_stats: {
          ...(profile?.progression_stats || {}),
          ...(progressionStats || {}),
          lastDailyActivityAt,
          streakResetAt: Date.now(),
        },
      }).then(({ error }) => {
        if (error) console.warn("Could not reset expired daily streak online", error);
      });
    }
  }, [lastDailyActivityAt, effectiveAuthUserId]);

  useEffect(() => {
    if (!connectionsDifficultyPickerOpen) return undefined;
    if (Object.keys(connectionPuzzleCounts).length > 0) return undefined;

    let cancelled = false;
    loadConnectionsPuzzles()
      .then((puzzles) => {
        if (cancelled) return;
        setConnectionPuzzleCounts(
          puzzles.reduce((counts, puzzle) => {
            const difficulty = puzzle?.difficulty || "Easy";
            counts[difficulty] = (counts[difficulty] || 0) + 1;
            return counts;
          }, {})
        );
      })
      .catch((error) => {
        if (import.meta.env?.DEV) {
          console.warn("Could not load Connections puzzle counts", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectionsDifficultyPickerOpen, connectionPuzzleCounts]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase?.auth) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    getCurrentSession(supabase)
      .then(async ({ session, user, error }) => {
        if (!mounted) return;

        if (error) {
          console.warn("Could not load current auth session", error);
          setAuthSession(null);
          setAuthUser(null);
          setGuestMode(false);
          return;
        }

        setAuthSession(session);
        setAuthUser(user);

        if (user) {
          if (isAnonymousAuthUser(user)) {
            const metadata = user.user_metadata || {};
            const guestName =
              metadata.username || metadata.display_name || getGuestDisplayName();
            activateLocalGuestIdentity(guestName);
            setProfileStatus("syncing");
            await ensureProfileForAuthUser(user, guestName);
          } else {
            prepareAuthenticatedIdentity(user);
            await ensureProfileForAuthUser(user);
          }
        }
      })
      .catch((error) => {
        console.warn("Supabase startup failed", error);
        if (!mounted) return;
        setAuthSession(null);
        setAuthUser(null);
        setGuestMode(false);
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;

      setAuthSession(session || null);
      setAuthUser(user);

      if (user) {
        const metadata = user.user_metadata || {};
        const guestName =
          metadata.username || metadata.display_name || getGuestDisplayName();

        if (isAnonymousAuthUser(user)) {
          activateLocalGuestIdentity(guestName);
          setProfileStatus("syncing");
        } else {
          prepareAuthenticatedIdentity(user);
        }

        window.setTimeout(() => {
          ensureProfileForAuthUser(user, isAnonymousAuthUser(user) ? guestName : "");
        }, 0);
      }
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    const elapsed = Date.now() - startupStartedAtRef.current;
    const releaseDelay = Math.max(0, STARTUP_MIN_DISPLAY_MS - elapsed);
    const releaseTimer = window.setTimeout(() => {
      setStartupReleased(true);
    }, releaseDelay);

    return () => window.clearTimeout(releaseTimer);
  }, [authLoading]);

  useEffect(() => {
    if (!username || username === "Loading profile..." || !effectiveAuthUser) return;

    ensureOnlineProfile(username);
  }, [username, playerId, effectiveAuthUserId, guestMode]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || socialProfileIds.length === 0) {
      return;
    }

    const missingIds = socialProfileIds.filter(
      (id) => id !== playerId && !profileLookup[id]
    );

    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadSocialProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("id", missingIds);

      if (cancelled) return;

      if (error) {
        console.warn("Could not load player avatars", error);
        return;
      }

      setProfileLookup((currentLookup) => {
        const nextLookup = { ...currentLookup };

        (data || []).forEach((row) => {
          nextLookup[row.id] = row;
        });

        return nextLookup;
      });
    };

    loadSocialProfiles();

    return () => {
      cancelled = true;
    };
  }, [socialProfileIds, profileLookup, playerId]);

  useEffect(() => {
    if (
      !username ||
      username === "Loading profile..." ||
      !effectiveAuthUser ||
      profileStatus !== "ready" ||
      !isSupabaseConfigured ||
      !supabase
    ) {
      return;
    }

    const syncTimer = window.setTimeout(async () => {
      const { profile: updatedProfile, error } = await syncLocalStatsToProfile(
        supabase,
        playerId,
        { highScore, coins, dailyStreak }
      );

      if (error) {
        console.warn("Could not sync local stats to profile", error);
        setProfileStatus(isNonBlockingProfileError(error) ? "local" : "error");
        setProfileError(
          isNonBlockingProfileError(error) ? "" : getProfileErrorMessage(error)
        );
        return;
      }

      setProfile((currentProfile) => ({
        ...(currentProfile || {}),
        ...(updatedProfile || {}),
      }));
      setProfileStatus("ready");
      setProfileError("");
    }, 700);

    return () => window.clearTimeout(syncTimer);
  }, [username, profileStatus, playerId, highScore, coins, dailyStreak, effectiveAuthUserId, guestMode]);

  useEffect(() => {
    if (
      !username ||
      username === "Loading profile..." ||
      !effectiveAuthUser ||
      !isSupabaseConfigured ||
      !supabase
    ) {
      return;
    }

    fetchActiveGames({ silent: true });
  }, [username, playerId, effectiveAuthUserId, guestMode]);

  useEffect(() => {
    if (!leaderboardOpen) return;

    loadGeneralLeaderboard();
  }, [leaderboardOpen, playerId, highScore]);

  useEffect(() => {
    if (
      !activeRound ||
      activeRound.status !== "finished" ||
      !activeRound.winner ||
      !activeMatch ||
      !username
    ) {
      return;
    }

    recordMultiplayerRoundResult(activeRound, activeMatch);
  }, [activeRound?.id, activeRound?.status, activeRound?.winner, activeMatch?.id, username]);

  // TODO Supabase multiplayer foundation:
  // Add profiles/users table, matches table, match_players table,
  // match_rounds or match_questions table, submitted answers/scores,
  // match status values: waiting, active, finished, room code lookup,
  // and realtime updates or polling for opponent state.
  // TODO production multiplayer:
  // Add realtime subscriptions instead of manual Refresh, real user accounts,
  // server-side score validation to prevent cheating, friend list/rematch,
  // and push notifications when it is your turn.
  // TODO production profiles:
  // Add Supabase Auth / real login, secure RLS policies, spoofing protection,
  // friend system, user search, push notifications, and cross-device cloud save.
  // TODO App Store release:
  // Add Capacitor/iOS build, app icon, splash screen, privacy policy,
  // App Store screenshots, real rewarded ads, Apple In-App Purchases,
  // Supabase Auth, secure RLS policies, push notifications, and
  // anti-cheat/server-side validation.
  // TODO Career Path:
  // Future: add optional multiple-choice Career Path mode.

  const handleResultButton = (isDaily) => {
    if (isDaily) {
      restart();
      setShowDailyCompletePopup(true);
    } else if (
      ["general", "world-cup", "career"].includes(gameMode) &&
      !isMockMultiplayer &&
      postGameStep === "summary"
    ) {
      playClickSound();
      setRewardPopup(null);
      setWrongPopup(null);
      setLevelUpPopup(null);
      setPostGameStep("xp");
    } else if (
      ["general", "world-cup", "career"].includes(gameMode) &&
      !isMockMultiplayer &&
      postGameStep === "xp"
    ) {
      exitToHomeSafely("post-game-collect");
    } else {
      exitToHomeSafely("result-button");
    }
  };

  const closeConnectionsReward = ({ playAgain = false } = {}) => {
    playClickSound();
    setConnectionsRewardModal(null);

    if (playAgain) {
      startConnectionsGame(connectionsPuzzle?.difficulty || null);
      return;
    }

    setGameStarted(false);
    setConnectionsDifficultyPickerOpen(true);
    setModeMenuOpen(false);
  };

  const leagueActiveAttempt = activeLeagueDay ? readLeagueAttempt(activeLeagueDay.id) : null;
  const leagueDashboardRows = (leagueDashboard?.members || []).map((member, index) => {
    const submission = (leagueDashboard?.submissions || []).find(
      (item) => item.player_id === member.player_id
    );
    const isCurrentUser = member.player_id === playerId;
    const attempt =
      isCurrentUser &&
      leagueActiveAttempt?.leagueDayId === activeLeagueDay?.id &&
      leagueActiveAttempt?.status === "in_progress"
        ? leagueActiveAttempt
        : null;
    const scoreSource = submission || attempt;
    const status = submission ? "completed" : attempt ? "in-progress" : "not-played";
    const totalToday = getLeagueDailyTotal(scoreSource);
    const scoreItems = getLeagueScoreItems(
      scoreSource,
      leagueSettings,
      leagueTop10MaxPoints,
      leagueWhoAmIMaxPoints
    );

    return {
      member,
      rank: index + 1,
      submission,
      attempt,
      scoreSource,
      status,
      statusLabel:
        status === "completed"
          ? "Completed"
          : status === "in-progress"
          ? "In progress"
          : "Not played yet",
      totalToday,
      scoreItems,
      isCurrentUser,
      isLeader: index === 0 && (Number(member.total_points) || 0) > 0,
      profile: getSocialProfile(member.player_id, member.username),
    };
  });

  const authErrorId = authError ? "auth-form-error" : undefined;
  const authNoticeId = authNotice ? "auth-form-notice" : undefined;
  const authCardTitle =
    authMode === "signup" ? "Create your account" : "Welcome back";
  const authCardSubtitle =
    authMode === "signup"
      ? "Save your progress, protect your username, and keep your Ball Knowledge profile synced."
      : "Log in to continue with your saved profile and progress.";

  const authCard = (
    <SurfaceCard
      as={motion.div}
      className="bk-auth-card"
      initial={{ opacity: 0, scale: 0.9, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      transition={{ type: "spring", stiffness: 160, damping: 16 }}
    >
      <ScreenHeader
        kicker="Ball Knowledge"
        title={authCardTitle}
        subtitle={authCardSubtitle}
        className="bk-auth-header"
      />

      <SegmentedControl
        ariaLabel="Choose authentication mode"
        value={authMode}
        options={[
          { value: "signup", label: "Sign Up" },
          { value: "login", label: "Login" },
        ]}
        onChange={(nextMode) => {
          setAuthMode(nextMode);
          resetAuthFormFeedback();
        }}
      />

      <form
        className="bk-auth-form"
        onSubmit={submitAuthForm}
        aria-describedby={[authErrorId, authNoticeId].filter(Boolean).join(" ") || undefined}
      >
        {authMode === "signup" && (
          <FormField
            id="auth-username"
            label="Username"
            hint="3-18 characters. Letters, numbers, dots, dashes or underscores."
          >
            <input
              id="auth-username"
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
              placeholder="fabian"
              autoComplete="username"
              maxLength={18}
            />
          </FormField>
        )}

        <FormField id="auth-email" label="Email">
          <input
            id="auth-email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
        </FormField>

        <FormField
          id="auth-password"
          label="Password"
          hint={authMode === "signup" ? "Use at least 6 characters." : ""}
        >
          <input
            id="auth-password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            minLength={6}
          />
        </FormField>

        <AuthNotice id={authErrorId} tone="error">
          {authError}
        </AuthNotice>
        <AuthNotice id={authNoticeId} tone="success">
          {authNotice}
        </AuthNotice>

        <Button type="submit" disabled={authSubmitting} fullWidth>
          {authSubmitting
            ? "Working..."
            : authMode === "signup"
            ? "Create Account"
            : "Login"}
        </Button>
      </form>

      <Button
        variant="secondary"
        type="button"
        onClick={continueAsGuest}
        disabled={authSubmitting}
        fullWidth
      >
        Play as Guest
      </Button>
      <p className="bk-auth-guest-note">
        Guest play can join online H2H without email. Create an account when you want protected cross-device sync.
      </p>
    </SurfaceCard>
  );

  const authPromptModal = (
    <AnimatePresence>
      {authPrompt && (
        <Modal
          title="Account"
          cardClassName="bk-auth-prompt-card"
          onClose={() => setAuthPrompt(null)}
        >
          <AuthNotice tone="warning" className="bk-auth-prompt-copy">
            <strong>{authPrompt}</strong>
          </AuthNotice>
          {authCard}
        </Modal>
      )}
    </AnimatePresence>
  );

  if (authLoading || !startupReleased) {
    return <StartupExperience isWorking={authLoading} />;
  }

  if (!effectiveAuthUser && !guestMode) {
    return (
      <AppScreen
        centered
        className="bk-auth-screen"
        backgroundImage={stadiumBg}
      >
        {authCard}
      </AppScreen>
    );
  }

  if (!username) {
    return (
      <AppScreen
        centered
        className="bk-auth-screen"
        backgroundImage={stadiumBg}
      >
        <SurfaceCard
            as={motion.div}
            className="bk-auth-card bk-account-setup-card"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 13 }}
          >
            <ScreenHeader
              kicker="Account Setup"
              title="Choose your player name"
              subtitle="This name appears on your profile and future leaderboards."
              className="bk-auth-header"
            />

            <FormField
              id="player-name"
              label="Player name"
              hint="You can update your profile details later."
            >
            <input
              id="player-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveUsername();
              }}
              placeholder="ball.knowledge"
              autoComplete="nickname"
              maxLength={16}
              autoFocus
            />
            </FormField>

            <Button onClick={saveUsername} fullWidth>
              Start Playing
            </Button>
          </SurfaceCard>
      </AppScreen>
    );
  }

  if (leagueChallengeOpen && activeLeague && activeLeagueDay) {
    return (
      <AppScreen
        backgroundImage={stadiumBg}
        className="league-challenge-root"
        contentClassName="league-challenge-root__content"
        width="wide"
      >
        <GameTopNav
          className="multiplayer-round-back"
          label="League"
          onClick={closeLeagueChallenge}
        />

        <AnimatePresence>
          {leagueLeaveConfirmOpen && (
            <Modal
              title="Leave league challenge?"
              variant="reward"
              showClose={false}
              cardClassName="bk-confirmation-modal bk-stack"
              onClose={() => setLeagueLeaveConfirmOpen(false)}
            >
                <StatusBadge tone="warning">League attempt locked</StatusBadge>
                <p className="bk-type-body">
                  Your current score will be submitted and today's league challenge
                  will be locked. You cannot replay it.
                </p>
                <div className="bk-reward-summary">
                  <div>
                    <span>Current score</span>
                  <strong>
                    {leagueQuizScore +
                      leagueTop10TotalWithCurrent +
                      leagueWhoAmIScore}
                    /{leagueSettings.maxDailyPoints}
                  </strong>
                  </div>
                </div>
                <div className="bk-screen-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLeagueLeaveConfirmOpen(false)}
                    disabled={leagueAttemptSubmitting}
                  >
                    Stay
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={submitAndCloseLeagueAttempt}
                    disabled={leagueAttemptSubmitting}
                  >
                    {leagueAttemptSubmitting
                      ? "Submitting..."
                      : "Submit current result"}
                  </Button>
                </div>
            </Modal>
          )}
        </AnimatePresence>

        <ScreenTransition className="league-play-screen league-modern-screen">
          {leagueChallengePhase === "intro" && (
            <div className="league-play-card league-modern-card league-intro-card">
              <LeagueContextHeader
                leagueName={activeLeague.name}
                dayLabel={leagueDayLabel}
                modeLabel="Daily Challenge"
                metaValue={`${leagueSettings.maxDailyPoints} pts`}
              />
              <div className="league-kicker"><BKIcon name="league" size={36} /> Daily League</div>
              <h1>{leagueDayLabel} Challenge</h1>
              <p>
                Max {leagueSettings.maxDailyPoints} points: {leagueDailyStructureText}.
              </p>
              <Button onClick={startLeagueQuiz}>Start Challenge</Button>
            </div>
          )}

          {leagueChallengePhase === "quiz" && currentLeagueQuizQuestion && (
            <div className="league-play-card league-modern-card league-play-quiz-card gk-game">
              <LeagueContextHeader
                leagueName={activeLeague.name}
                dayLabel={leagueDayLabel}
                modeLabel="General Knowledge"
                metaValue={`${leagueQuizScore}/${leagueSettings.quizCount}`}
              />

              <div className="league-gk-meta">
                <span>Question {leagueQuizIndex + 1}/{leagueSettings.quizCount}</span>
                <QuizTimer
                  difficulty={currentLeagueQuizQuestion.difficulty}
                  timeLeft={leagueTimeLeft}
                />
              </div>

              <QuestionCard
                question={currentLeagueQuizQuestion.question}
                category={currentLeagueQuizQuestion.category || currentLeagueQuizQuestion.mode}
              />

              <AnswerGrid
                options={currentLeagueQuizQuestion.options}
                answer={currentLeagueQuizQuestion.answer}
                selected={leagueQuizSelected}
                onChoose={chooseLeagueQuizAnswer}
                onPlayClick={playClickSound}
              />
            </div>
          )}

          {leagueChallengePhase === "top10" && leagueTop10Challenge && (
            <div className="league-play-card league-modern-card league-play-top10-card dc-shell">
              <LeagueContextHeader
                leagueName={activeLeague.name}
                dayLabel={leagueDayLabel}
                modeLabel="Top 10"
                metaValue={`${leagueQuizScore + leagueTop10TotalWithCurrent + leagueWhoAmIScore}/${leagueSettings.maxDailyPoints}`}
              />

              <header className="dc-header league-modern-top10-header">
                <div className="dc-title-row">
                  <div>
                    <span className="dc-kicker">League Top 10</span>
                    <h1>{leagueTop10Challenge.label}</h1>
                  </div>
                  <div className="dc-date-pill">
                    <span>List</span>
                    <strong>{leagueTop10Index + 1}/{leagueSettings.top10Count}</strong>
                  </div>
                </div>
                <p className="dc-question">{leagueTop10Challenge.question}</p>
              </header>

              <LeagueProgressStrip
                items={[
                  leagueSettings.quizCount > 0 && {
                    label: "Quiz",
                    value: `${leagueQuizScore}/${leagueSettings.quizCount}`,
                  },
                  {
                    label: "Found",
                    value: `${Math.min(leagueTop10Score, leagueTop10TargetCount)}/${leagueTop10TargetCount}`,
                  },
                  {
                    label: "Lives",
                    value: leagueTop10Lives,
                  },
                ]}
              />

              <LeagueTop10Board
                answers={getChallengeAnswers(leagueTop10Challenge)}
                foundAnswers={leagueTop10Found}
                reveal={leagueTop10Reveal}
                isRevealing={leagueTop10Scanning}
                getAnswerKey={getAnswerKey}
                formatAnswerWithValue={formatAnswerWithValue}
              />

              <GuessInput
                answerType={isLeagueTop10PlayerChallenge ? "player" : "text"}
                value={leagueTop10Input}
                onTextChange={setLeagueTop10Input}
                selectedPlayer={leagueTop10SelectedPlayer}
                onSelectPlayer={setLeagueTop10SelectedPlayer}
                onSubmit={submitLeagueTop10Answer}
                autoSubmitOnSelect
                placeholder={
                  isLeagueTop10PlayerChallenge
                    ? "Search and select player..."
                    : "Type answer..."
                }
                disabled={leagueTop10Scanning || leagueTop10Lives <= 0}
                buttonLabel={leagueTop10Scanning ? "Scanning..." : "Guess"}
                rowClassName="dc-input-row league-play-input-row"
                inputClassName="dc-text-input"
                buttonClassName="dc-submit"
                maxSuggestions={4}
                autoFocus
              />

            </div>
          )}

          {leagueChallengePhase === "top10-reveal" && leagueTop10Challenge && (
            <div className="league-play-card league-modern-card league-play-top10-card league-top10-reveal-card dc-shell">
              <LeagueContextHeader
                leagueName={activeLeague.name}
                dayLabel={leagueDayLabel}
                modeLabel="Top 10 Reveal"
                metaValue={`${Math.min(leagueTop10Score, leagueTop10TargetCount)}/${leagueTop10TargetCount}`}
              />
              <header className="dc-header league-modern-top10-header">
                <div className="dc-title-row">
                  <div>
                    <span className="dc-kicker">Top 10 Reveal</span>
                    <h1>{leagueTop10Challenge.label}</h1>
                  </div>
                  <div className="dc-date-pill">
                    <span>Found</span>
                    <strong>{Math.min(leagueTop10Score, leagueTop10TargetCount)}/{leagueTop10TargetCount}</strong>
                  </div>
                </div>
                <p className="dc-question">Review the list, then keep climbing.</p>
              </header>

              <LeagueTop10Board
                answers={getChallengeAnswers(leagueTop10Challenge)}
                foundAnswers={leagueTop10Found}
                reveal={leagueTop10Reveal}
                isRevealing={false}
                getAnswerKey={getAnswerKey}
                formatAnswerWithValue={formatAnswerWithValue}
                revealAll
              />

              <Button
                className="league-reveal-continue-button"
                onClick={() => advanceAfterLeagueTop10(leagueTop10Found.length)}
              >
                {leagueTop10Index < leagueTop10Challenges.length - 1
                  ? "Next Top 10"
                  : leagueSettings.whoamiCount > 0
                  ? "Next Section"
                  : "See Results"}
              </Button>
            </div>
          )}

          {leagueChallengePhase === "whoami" && currentLeagueWhoAmI && (
            <div className="league-play-card league-modern-card league-play-whoami-card gp-whoami-shell">
              <LeagueContextHeader
                leagueName={activeLeague.name}
                dayLabel={leagueDayLabel}
                modeLabel="Who Am I"
                metaValue={`${leagueWhoAmIScore}/${leagueWhoAmIMaxPoints}`}
              />

              <LeagueProgressStrip
                items={[
                  leagueSettings.quizCount > 0 && {
                    label: "Quiz",
                    value: `${leagueQuizScore}/${leagueSettings.quizCount}`,
                  },
                  leagueSettings.top10Count > 0 && {
                    label: "Top 10",
                    value: `${leagueTop10TotalWithCurrent}/${leagueTop10MaxPoints}`,
                  },
                  {
                    label: "Player",
                    value: `${leagueWhoAmIIndex + 1}/${leagueSettings.whoamiCount}`,
                  },
                ]}
              />

              <motion.div
                className={`gp-mystery-card gp-whoami-card league-play-whoami-panel ${leagueWhoAmIShake ? "shake" : ""}`}
                animate={leagueWhoAmIShake ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.28 }}
              >
                <div className="gp-whoami-top">
                  <div>
                    <div className="gp-kicker">League mystery player</div>
                    <h1>Who Am I?</h1>
                  </div>
                  <div className={`gp-whoami-difficulty ${currentLeagueWhoAmI.difficulty?.toLowerCase?.() || ""}`}>
                    {currentLeagueWhoAmI.difficulty || "League"}
                  </div>
                </div>

                <div className="gp-whoami-mystery">
                  <div className="gp-whoami-silhouette">
                    <BKIcon name="whoAmI" size={64} />
                  </div>
                  <div>
                    <span>Clue {leagueWhoAmIClueIndex + 1} / 10</span>
                    <strong>{leagueWhoAmIPointsAvailable} points available</strong>
                  </div>
                </div>

                <div className="gp-whoami-clues">
                  {leagueWhoAmIVisibleClues.map((clue, index) => (
                    <motion.div
                      key={`${currentLeagueWhoAmI.id}-${index}`}
                      className={`gp-whoami-clue ${
                        index === leagueWhoAmIClueIndex ? "latest" : ""
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <span>{index + 1}</span>
                      <p>{clue}</p>
                    </motion.div>
                  ))}
                </div>

                {leagueWhoAmIFeedback && (
                  <div className={`gp-feedback ${leagueWhoAmIFeedback.type}`}>
                    {leagueWhoAmIFeedback.text}
                  </div>
                )}
              </motion.div>

              <GuessInput
                answerType="player"
                value={leagueWhoAmIInput}
                onTextChange={setLeagueWhoAmIInput}
                selectedPlayer={leagueWhoAmISelectedPlayer}
                onSelectPlayer={setLeagueWhoAmISelectedPlayer}
                onSubmit={submitLeagueWhoAmIAnswer}
                placeholder="Search player or type full name..."
                disabled={Boolean(leagueWhoAmIFeedback?.locked)}
                buttonLabel="Guess"
                rowClassName="gp-input-row gp-whoami-answer-row league-play-input-row"
                inputClassName="gp-text-input"
                buttonClassName="gp-submit-button"
                maxSuggestions={4}
                autoFocus
              />
            </div>
          )}

          {leagueChallengePhase === "complete" && leagueResult && (
            <div className="league-play-card league-modern-card league-complete-card">
              <LeagueContextHeader
                leagueName={activeLeague.name}
                dayLabel={leagueDayLabel}
                modeLabel="Day Complete"
                metaValue={`${leagueResult.totalPoints}/${leagueSettings.maxDailyPoints}`}
              />
              <div className="league-kicker"><BKIcon name="dailyStreak" size={22} /> Day Complete</div>
              <h1>
                {leagueResult.totalPoints}/{leagueSettings.maxDailyPoints} points
              </h1>
              <div className="league-play-result-grid">
                {leagueSettings.quizCount > 0 && (
                  <div>
                    <span>Quiz</span>
                    <strong>
                      {leagueResult.quizScore}/{leagueSettings.quizCount}
                    </strong>
                  </div>
                )}
                {leagueSettings.top10Count > 0 && (
                  <div>
                    <span>Top 10</span>
                    <strong>
                      {leagueResult.top10Score}/{leagueTop10MaxPoints}
                    </strong>
                  </div>
                )}
                {leagueSettings.whoamiCount > 0 && (
                  <div>
                    <span>Who Am I</span>
                    <strong>
                      {leagueResult.whoamiScore}/{leagueWhoAmIMaxPoints}
                    </strong>
                  </div>
                )}
              </div>
              <Button onClick={closeLeagueChallenge}>Back to League</Button>
            </div>
          )}
        </ScreenTransition>
      </AppScreen>
    );
  }

  if (multiplayerRoundOpen && activeRound) {
    return (
      <React.Suspense fallback={<div className="fullscreen-bg" />}>
        <ActiveMatchRound
          key={activeRound.id}
          round={activeRound}
          quizBackground={quizBg}
          categoryClass={getCategoryClass(activeRound?.category)}
          categoryLabel={getCategoryLabel(activeRound?.category)}
          match={activeMatch}
          playerSlot={multiplayerPlayerSlot}
          playerProfile={getMatchPlayerProfile(
            activeMatch,
            multiplayerPlayerSlot || "player1"
          )}
          opponentProfile={getMatchPlayerProfile(
            activeMatch,
            multiplayerPlayerSlot === "player2" ? "player1" : "player2"
          )}
          playerName={username}
          opponentName={getOpponentName(activeMatch, playerId, username)}
          timeLimit={getMultiplayerQuestionTimeLimit(activeRound?.category)}
          isSubmitting={isSubmittingRound}
          persistenceLoading={multiplayerLoading}
          onSubmitScore={submitMultiplayerRoundScore}
          onRuntimeError={setMultiplayerError}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
        />
      </React.Suspense>
    );
  }

  if (connectionsDifficultyPickerOpen) {
    const connectionDifficulties = [
      {
        label: "Easy",
        subtitle: "Warm-up groups",
        icon: "connections",
        className: "easy",
      },
      {
        label: "Medium",
        subtitle: "Real football knowledge",
        icon: "connections",
        className: "medium",
      },
      {
        label: "Hard",
        subtitle: "For ball knowledge people",
        icon: "connections",
        className: "hard",
      },
      {
        label: "Very Hard",
        subtitle: "Only for football nerds",
        icon: "dailyStreak",
        className: "very-hard",
      },
    ];

    return (
      <AppScreen backgroundImage={stadiumBg} width="wide">
        {coinShopModal}
        {dailyRewardMeterModal}
        {coinRewardToastOverlay}
        {xpToastOverlay}

        <ScreenTransition className="bk-connections-difficulty-screen">
          <ScreenHeader
            kicker="Single Player"
            title="Choose Connections Level"
            subtitle="Pick the difficulty and solve four hidden football groups."
            leadingAction={
              <BackButton
                label="Back"
                onClick={() => {
                  playClickSound();
                  setConnectionsDifficultyPickerOpen(false);
                  setModeMenuOpen(true);
                  setGameMode("general");
                  setGameStarted(false);
                }}
              />
            }
          />

          <div className="bk-difficulty-grid">
            {connectionDifficulties.map((difficulty) => (
              <SurfaceCard
                as="button"
                key={difficulty.label}
                className={`bk-difficulty-card bk-difficulty-card--${difficulty.className}`}
                interactive
                onClick={() => startConnectionsGame(difficulty.label)}
              >
                <div className="bk-difficulty-card__top">
                  <span className="bk-mode-card__icon">
                    <BKIcon name={difficulty.icon} size={26} />
                  </span>
                  <span className="bk-difficulty-card__meta">
                    {connectionPuzzleCounts[difficulty.label] ?? "Loading"} puzzles
                  </span>
                </div>

                <strong className="bk-type-section-title">{difficulty.label}</strong>
                <p className="bk-type-body">{difficulty.subtitle}</p>
                <span className="bk-type-label">Play now</span>
              </SurfaceCard>
            ))}
          </div>
        </ScreenTransition>
      </AppScreen>
    );
  }

  if (
    !gameStarted &&
    modeMenuOpen &&
    !profileOpen &&
    !leaderboardOpen &&
    !multiplayerOpen
  ) {
    return (
      <AppScreen backgroundImage={stadiumBg} className="bk-v2-screen bk-v2-mode-screen">
        {coinShopModal}
        {dailyRewardMeterModal}
        {levelProgressModal}
        {postGameProgressModal}
        {avatarPickerModal}
        {authPromptModal}
        {postGameStep !== "xp" && xpToastOverlay}
        {postGameStep !== "xp" && objectiveProgressModal}

        <ScreenTransition className="bk-sp-hub">

  {/* HEADER */}
  <header className="bk-sp-header">
    <BackButton
      label="Back"
      onClick={() => {
        playClickSound();
        setModeMenuOpen(false);
      }}
    />

    <div className="bk-sp-header-copy">
      <span>SINGLE PLAYER</span>

      <h1>
        Choose your
        <br />
        challenge.
      </h1>

      <p>
        Different tests. Same game.
        <br />
        How good is your football knowledge?
      </p>
    </div>

    <div className="bk-sp-header-art" aria-hidden="true">
      <svg viewBox="0 0 220 180">
        <circle cx="112" cy="87" r="51" className="bk-sp-svg-soft" />
        <circle cx="112" cy="87" r="42" className="bk-sp-svg-line" />
        <polygon
          points="112,61 130,73 124,95 100,95 94,73"
          className="bk-sp-svg-fill"
        />
        <path
          d="M112 61 L112 44 M130 73 L148 64 M124 95 L138 112 M100 95 L85 112 M94 73 L76 64"
          className="bk-sp-svg-line"
        />
      </svg>
    </div>
  </header>

  {/* FEATURED */}
  <section className="bk-sp-section">
    <div className="bk-sp-section-heading">
      <span>FEATURED</span>
      <small>Classic mode</small>
    </div>

    <button
      type="button"
      className="bk-sp-featured"
      disabled={modeLoading}
      onClick={() => {
        playClickSound();
        startGame("general");
      }}
    >
      <div className="bk-sp-featured-art" aria-hidden="true">
  <svg viewBox="0 0 220 180">
    <circle cx="110" cy="90" r="58" className="bk-sp-svg-soft" />

    <circle
      cx="110"
      cy="90"
      r="42"
      className="bk-sp-svg-line"
    />

    <polygon
      points="110,60 126,71 120,90 100,90 94,71"
      className="bk-sp-svg-fill"
    />

    <path
      d="M110 60
         L96 71
         L83 63
         M126 71
         L142 63
         M100 90
         L90 109
         M120 90
         L130 109
         M90 109
         L110 124
         L130 109"
      className="bk-sp-svg-line"
    />
  </svg>
</div>

      <div className="bk-sp-featured-content">
        <span>FEATURED</span>

        <h2>
          General
          <br />
          Knowledge
        </h2>

        <p>Fast questions across clubs, players and eras.</p>

        <div className="bk-sp-featured-bottom">
          <div className="bk-sp-featured-status">
            <small>CLASSIC QUIZ</small>
            <strong>Beat your best</strong>
          </div>

          <span className="bk-sp-featured-play">
            PLAY NOW
            <b>›</b>
          </span>
        </div>
      </div>
    </button>
  </section>

  {/* ALL MODES */}
  <section className="bk-sp-section">
    <div className="bk-sp-section-heading">
      <span>DISCOVER ALL MODES</span>
      <small>6 modes</small>
    </div>

    <div className="bk-sp-games-grid">

      {/* CAREER PATH */}
      <button
        type="button"
        className="bk-sp-game-card bk-sp-game-card--blue"
        disabled={modeLoading}
        onClick={() => {
          playClickSound();
          startGame("career");
        }}
      >
        <span className="bk-sp-card-arrow">›</span>

        <div className="bk-sp-card-art bk-sp-card-art--career" aria-hidden="true">
          <svg viewBox="0 0 220 150">
            <path
              d="M24 126 C55 111 47 76 85 72 C123 67 104 36 158 39 C184 40 187 22 199 18"
              className="bk-sp-svg-line bk-sp-svg-route"
            />
            <circle cx="25" cy="126" r="6" className="bk-sp-svg-fill" />
            <circle cx="84" cy="72" r="6" className="bk-sp-svg-fill" />
            <circle cx="158" cy="39" r="6" className="bk-sp-svg-fill" />
            <path d="M198 18 V47" className="bk-sp-svg-line" />
            <path d="M198 19 L216 25 L198 32 Z" className="bk-sp-svg-fill" />
          </svg>
        </div>

        <div className="bk-sp-card-content">
          <span>PLAYER IQ</span>
          <strong>Career Path</strong>
          <p>Trace the clubs and spot the career.</p>

          <div className="bk-sp-card-status">
            <small>ENDLESS MODE</small>
            <b>Beat your best</b>
          </div>
        </div>
      </button>

      {/* WORLD CUP */}
      <button
        type="button"
        className="bk-sp-game-card bk-sp-game-card--gold"
        disabled={modeLoading}
        onClick={() => {
          playClickSound();
          startGame("world-cup");
        }}
      >
        <span className="bk-sp-card-arrow">›</span>

        <div className="bk-sp-card-art" aria-hidden="true">
          <svg viewBox="0 0 200 170">
            <ellipse cx="118" cy="143" rx="54" ry="10" className="bk-sp-svg-soft" />
            <path
              d="M96 32
                 C95 52 98 63 107 75
                 C112 82 113 96 109 108
                 L92 130
                 L142 130
                 L126 108
                 C122 96 123 82 129 74
                 C139 60 141 46 139 32
                 C128 39 108 39 96 32 Z"
              className="bk-sp-svg-fill"
            />
            <circle cx="117" cy="53" r="22" className="bk-sp-svg-line" />
          </svg>
        </div>

        <div className="bk-sp-card-content">
          <span>GLOBAL</span>
          <strong>World Cup</strong>
          <p>History&apos;s greatest tournament.</p>

          <div className="bk-sp-card-status">
            <small>ENDLESS MODE</small>
            <b>Beat your best</b>
          </div>
        </div>
      </button>

      {/* WHO AM I */}
      <button
        type="button"
        className="bk-sp-game-card bk-sp-game-card--violet"
        onClick={() => startWhoAmIGame(getDailyDateKey())}
      >
        <span className="bk-sp-card-arrow">›</span>

        <div className="bk-sp-card-art" aria-hidden="true">
          <svg viewBox="0 0 200 170">
            <circle cx="118" cy="59" r="30" className="bk-sp-svg-soft" />
            <circle cx="118" cy="59" r="24" className="bk-sp-svg-dark" />
            <path
              d="M69 145 C74 105 93 91 118 91 C143 91 163 105 168 145"
              className="bk-sp-svg-dark"
            />
            <text x="108" y="73" className="bk-sp-svg-question">?</text>
          </svg>
        </div>

        <div className="bk-sp-card-content">
          <span>CLUES</span>
          <strong>Who Am I?</strong>
          <p>Guess the player before the reveal.</p>

          <div className="bk-sp-card-status">
            <small>DAILY</small>
            <b>Today&apos;s player</b>
          </div>
        </div>
      </button>

      {/* CONNECTIONS */}
      <button
        type="button"
        className="bk-sp-game-card bk-sp-game-card--cyan"
        disabled={modeLoading}
        onClick={openConnectionsDifficultyPicker}
      >
        <span className="bk-sp-card-arrow">›</span>

        <div className="bk-sp-card-art" aria-hidden="true">
          <svg viewBox="0 0 210 160">
            <g transform="translate(73 39) rotate(-7)">
              <rect x="0" y="0" width="50" height="50" rx="9" className="bk-sp-svg-fill" />
            </g>
            <g transform="translate(121 51) rotate(7)">
              <rect x="0" y="0" width="50" height="50" rx="9" className="bk-sp-svg-fill-soft" />
            </g>
            <g transform="translate(77 88) rotate(5)">
              <rect x="0" y="0" width="50" height="50" rx="9" className="bk-sp-svg-fill-soft" />
            </g>
          </svg>
        </div>

        <div className="bk-sp-card-content">
          <span>PATTERN PLAY</span>
          <strong>Connections</strong>
          <p>Find four hidden football groups.</p>

          <div className="bk-sp-card-status">
            <small>4 LEVELS</small>
            <b>Choose difficulty</b>
          </div>
        </div>
      </button>

    </div>
  </section>

</ScreenTransition>
      </AppScreen>
    );
  }

  if (!gameStarted) {
    return (
      <div
        className={`fullscreen-bg ${isHomeScreen ? "bk-home-root" : ""}`}
        style={
          isHomeScreen
            ? undefined
            : {
                backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(0,0,0,0.34)), url(${stadiumBg})`,
              }
        }
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {levelProgressModal}
        {postGameProgressModal}
        {avatarPickerModal}
        {authPromptModal}
        {postGameStep !== "xp" && xpToastOverlay}
        {postGameStep !== "xp" && objectiveProgressModal}
        <AnimatePresence>
          {showDailyCompletePopup && lastDailyResult && (
            <Modal
              title="Daily Reward"
              variant="reward"
              showClose={false}
              cardClassName="bk-reward-card"
              onClose={() => setShowDailyCompletePopup(false)}
            >
              <div className="bk-progression-hero">
                <div className="bk-progression-icon">
                  <BKIcon name="dailyStreak" size={52} />
                </div>

                <div className="bk-progression-copy">
                  <p className="bk-type-label">
                    Day {lastDailyResult.streak} complete
                  </p>
                  <h3>Reward locked in</h3>
                  <p>Your daily challenge rewards have been added.</p>
                </div>
              </div>

              <div className="bk-reward-summary">
                <div>
                  <span>Coins</span>
                  <strong>
                    <BKIcon name="coins" size={22} /> +{lastDailyResult.coins}
                  </strong>
                </div>
                <div>
                  <span>Streak</span>
                  <strong>{lastDailyResult.streak} days</strong>
                </div>
              </div>

              {lastDailyResult.streakBonus > 0 && (
                <AuthNotice tone="success">
                  <BKIcon name="dailyStreak" size={20} /> Streak bonus +
                  {lastDailyResult.streakBonus}
                </AuthNotice>
              )}

              <div className="bk-streak-road">
                {getStreakRoadDays(lastDailyResult.streak).map((day) => {
                  const reached = lastDailyResult.streak >= day.day;
                  const currentDay = lastDailyResult.streak === day.day;
                  const previousReached =
                    (lastDailyResult.previousStreak || 0) >= day.day;

                  return (
                    <motion.div
                      key={day.day}
                      className={`bk-streak-day ${
                        reached ? "is-reached" : ""
                      } ${currentDay ? "is-current" : ""}`}
                      initial={{
                        opacity: previousReached ? 1 : 0.58,
                        y: currentDay ? 12 : 0,
                        scale: previousReached ? 1 : 0.95,
                      }}
                      animate={{
                        opacity: reached ? 1 : 0.78,
                        y: currentDay ? -6 : 0,
                        scale: currentDay ? [1, 1.08, 1.03] : 1,
                      }}
                      transition={{
                        delay: day.dayInRoad * 0.04,
                        duration: currentDay ? 0.42 : 0.2,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <div className="bk-streak-icon" aria-hidden="true">
                        <BKIcon
                          name={
                            currentDay
                              ? "dailyStreak"
                              : reached
                              ? "dailyChallenge"
                              : "singlePlayer"
                          }
                          size={22}
                        />
                      </div>
                      <strong>Day {day.day}</strong>
                      <small>{reached ? "Claimed" : "Upcoming"}</small>
                      <small>+{day.reward}</small>
                    </motion.div>
                  );
                })}
              </div>

              <AuthNotice tone="info">
                Next reward: Day{" "}
                {getNextStreakRewardInfo(lastDailyResult.streak, true).day} • +
                {getNextStreakRewardInfo(lastDailyResult.streak, true).reward} coins
              </AuthNotice>

              <Button
                onClick={() => setShowDailyCompletePopup(false)}
                fullWidth
              >
                Claim
              </Button>
            </Modal>
          )}
        </AnimatePresence>
        <AnimatePresence>
  {levelUpPopup && isHomeScreen && (
    <Modal
      title="Level Up"
      variant="reward"
      showClose={false}
      cardClassName="bk-reward-card"
      onClose={() => {
        playClickSound();
        setLevelUpPopup(null);
      }}
    >
        <motion.div
          className="bk-level-up-title"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.22 }}
        >
          Level {levelUpPopup.newLevel.id}
        </motion.div>

        <div className="bk-level-evolution">
          <motion.div
            className="bk-level-evolution__icon"
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <LevelIcon levelId={levelUpPopup.oldLevel.id} size={76} />
          </motion.div>

          {levelUpPopup.unlockedLevels.map((level, index) => (
            <React.Fragment key={`${level.name}-${level.id}`}>
              <motion.div
                className="bk-type-section-title"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.25 + index * 0.18,
                  type: "spring",
                  stiffness: 220,
                }}
              >
                →
              </motion.div>

              <motion.div
                className={`bk-level-evolution__icon ${
                  index === levelUpPopup.unlockedLevels.length - 1
                    ? "is-new"
                    : ""
                }`}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{
                  scale: [0.85, 1.08, 1],
                  opacity: 1,
                }}
                transition={{
                  delay: 0.35 + index * 0.18,
                  duration: 0.5,
                  ease: "easeOut",
                }}
              >
                <LevelIcon levelId={level.id} size={76} />
              </motion.div>
            </React.Fragment>
          ))}
        </div>

        <div className="bk-progression-copy">
          <p className="bk-type-label">
            {levelUpPopup.levelsGained > 1
              ? `${levelUpPopup.levelsGained} new ranks unlocked`
              : "New rank unlocked"}
          </p>
          <h3>{levelUpPopup.newLevel.name}</h3>
          {levelUpPopup.coins ? (
            <AuthNotice tone="success">
              <BKIcon name="coins" size={20} /> +{levelUpPopup.coins} coins
            </AuthNotice>
          ) : null}
        </div>

        <ProgressBar
          label="Level progress"
          value={100}
          valueLabel="Level unlocked"
        />

        <Button
          onClick={() => {
            playClickSound();
            setLevelUpPopup(null);
          }}
          fullWidth
        >
          Awesome
        </Button>
    </Modal>
  )}
</AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <ScreenTransition key={currentHomeViewKey}>
        {profileOpen ? (
          <AppScreen backgroundImage={stadiumBg} className="bk-nav-screen" width="wide">
            <div className="bk-profile-shell">
              <ScreenHeader
                kicker="Profile"
                title={displayName}
                subtitle="Your identity, progress and competitive record."
                leadingAction={
                  <BackButton
                    label="Back"
                    onClick={() => {
                      playClickSound();
                      setProfileOpen(false);
                    }}
                  />
                }
              />

              <SurfaceCard className="bk-profile-identity">
                <PlayerAvatar
                  profile={{
                    ...profile,
                    avatar_emoji: profileAvatarEmoji,
                    avatar_icon: profileAvatar.icon,
                    avatar_style: profileAvatar.style,
                    avatar_color: profileAvatar.color,
                    avatar_bg: profileAvatar.bg,
                  }}
                  size="large"
                  button
                  onClick={openAvatarBuilder}
                  label="Edit avatar"
                />

                <div className="bk-profile-copy">
                  <strong><span>{profileAvatar.flag}</span> {displayName}</strong>
                  <StatusBadge tone={profileStatus === "ready" ? "success" : "info"}>
                    {isGuest
                      ? "Guest profile"
                      : profileStatus === "ready"
                      ? "Online profile saved"
                      : profileStatus === "syncing"
                      ? "Syncing profile..."
                      : profileError || "Local profile"}
                  </StatusBadge>
                  {!isGuest && effectiveAuthUser?.email && (
                    <span className="bk-profile-email">{effectiveAuthUser.email}</span>
                  )}
                  <Button variant="secondary" onClick={openAvatarBuilder}>
                    Edit Avatar
                  </Button>
                </div>
              </SurfaceCard>

              <SurfaceCard
                as="button"
                interactive
                className="bk-profile-level"
                onClick={openLevelModal}
              >
                <div className="bk-profile-level__top">
                  <div className="bk-row-copy">
                    <small>Level {playerLevel.levelNumber}</small>
                    <strong>{playerLevel.name}</strong>
                  </div>
                  <LevelIcon levelId={playerLevel.id} size={42} />
                </div>
                <ProgressBar
                  value={playerLevel.progress}
                  max={100}
                  label="Progress"
                  valueLabel={playerLevel.next ? levelObjectiveSummary : "Legend status"}
                />
              </SurfaceCard>

              <div className="bk-stat-grid">
                <SurfaceCard
                  as="button"
                  interactive
                  onClick={openCoinShop}
                  className="bk-stat-grid__item"
                >
                  <span><BKIcon name="coins" size={24} /></span>
                  <strong>{coins}</strong>
                  <small>Coins</small>
                </SurfaceCard>

                <SurfaceCard
                  as="button"
                  interactive
                  onClick={openDailyRewardMeter}
                  className="bk-stat-grid__item"
                >
                  <span><BKIcon name="dailyChallenge" size={65} /></span>
                  <strong>{dailyStreak}</strong>
                  <small>Daily streak</small>
                </SurfaceCard>
              </div>

              <SurfaceCard>
                <p className="bk-section-title">Competitive record</p>
                <StatGrid
                  items={[
                    { label: "Best score", value: highScore, icon: <BKIcon name="dailyStreak" size={22} /> },
                    { label: "Wins", value: profileStats.multiplayerWins, icon: <BKIcon name="h2h" size={22} /> },
                    { label: "Losses", value: profileStats.multiplayerLosses, icon: <BKIcon name="questionMark" size={22} /> },
                    { label: "Draws", value: profileStats.multiplayerDraws, icon: <BKIcon name="multiplayer" size={22} /> },
                    { label: "Active", value: activeGames.length, icon: <BKIcon name="activeMatches" size={22} /> },
                    { label: "Level", value: playerLevel.levelNumber, icon: <LevelIcon levelId={playerLevel.id} size={22} /> },
                  ]}
                />
                <span className="bk-profile-record">
                  Multiplayer rounds counted: {profileStats.multiplayerMatches}
                </span>
              </SurfaceCard>

              {/* ACCOUNT */}
<SurfaceCard className="bk-account-panel">
  <div className="bk-account-panel__heading">
    <div>
      <span className="bk-type-label">ACCOUNT</span>

      <strong>
        {isGuest ? "Guest account" : "Your Ball Knowledge account"}
      </strong>

      <p>
        {isGuest
          ? "Your progress is currently stored on this device."
          : "Your profile and progression are connected to your account."}
      </p>
    </div>

    <StatusBadge tone={isGuest ? "warning" : "success"}>
      {isGuest ? "Guest" : "Synced"}
    </StatusBadge>
  </div>

  {isGuest ? (
    <>
      <div className="bk-account-upgrade">
        <div className="bk-account-upgrade__icon">
          <BKIcon name="profile" size={24} />
        </div>

        <div>
          <strong>Keep your progress safe</strong>
          <p>
            Create a free account to save your progress and use your profile
            across devices.
          </p>
        </div>
      </div>

      <div className="bk-account-primary-actions">
        <Button
          variant="primary"
          onClick={openGuestSignup}
          fullWidth
        >
          Create Account
        </Button>

        <Button
          variant="secondary"
          onClick={openGuestLogin}
          fullWidth
        >
          Log In
        </Button>
      </div>

      <button
        type="button"
        className="bk-account-text-action"
        onClick={changeUsername}
      >
        Change guest name
      </button>
    </>
  ) : (
    <>
      {effectiveAuthUser?.email && (
        <div className="bk-account-email-row">
          <span>Email</span>
          <strong>{effectiveAuthUser.email}</strong>
        </div>
      )}

      <div className="bk-account-primary-actions">
        <Button
          variant="secondary"
          onClick={logout}
          fullWidth
        >
          Switch Account
        </Button>
      </div>

      <button
        type="button"
        className="bk-account-text-action bk-account-text-action--danger"
        onClick={logout}
      >
        Log out
      </button>
    </>
  )}
</SurfaceCard>

{/* SETTINGS */}
<SurfaceCard className="bk-settings-panel">
  <div className="bk-settings-row">
    <div className="bk-settings-row__copy">
      <strong>Sound</strong>
      <span>Game sounds and feedback</span>
    </div>

    <button
      type="button"
      className={`bk-settings-toggle ${soundOn ? "is-active" : ""}`}
      onClick={toggleSound}
      aria-pressed={soundOn}
      aria-label={`Turn sound ${soundOn ? "off" : "on"}`}
    >
      <span />
    </button>
  </div>
</SurfaceCard>
            </div>
          </AppScreen>
        ) : leaderboardOpen ? (
          <AppScreen backgroundImage={stadiumBg} className="bk-nav-screen" width="wide">
            <div className="bk-leaderboard-shell bk-leaderboard-shell--premium">
              <div className="bk-leaderboard-hero">
                <ScreenHeader
                  kicker="Community"
                  title="Leaderboard"
                  subtitle="See how you stack up against the Ball Knowledge community."
                  leadingAction={
                    <BackButton
                      label="Back"
                      onClick={() => {
                        playClickSound();
                        setLeaderboardOpen(false);
                      }}
                    />
                  }
                />
                <div className="bk-leaderboard-hero-icon" aria-hidden="true">
                  <BKIcon name="rankings" size={54} />
                </div>
              </div>

              <SegmentedControl
                ariaLabel="Leaderboard view"
                value={leaderboardTab}
                onChange={setLeaderboardTab}
                options={[
                  { value: "general", label: "General Knowledge" },
                  { value: "levels", label: "Levels" },
                ]}
              />

              {leaderboardLoading ? (
                <LeaderboardLoadingState type={leaderboardTab} />
              ) : (() => {
                const rows =
                  leaderboardTab === "levels" ? levelLeaderboardRows : leaderboardRows;
                const currentRow =
                  leaderboardTab === "levels"
                    ? currentLevelLeaderboardRow
                    : currentLeaderboardRow;
                const podiumRows = rows.length >= 3 ? rows.slice(0, 3) : [];
                const listRows = rows.length >= 3 ? rows.slice(3) : rows;

                if (rows.length === 0) {
                  return (
                    <LeaderboardEmptyState
                      type={leaderboardTab}
                      message={leaderboardError}
                    />
                  );
                }

                return (
                  <div className="bk-leaderboard-board">
                    <div className="bk-leaderboard-board-top">
                      <StatusBadge tone={leaderboardTab === "levels" ? "info" : "success"}>
                        {leaderboardTab === "levels" ? "Level ranking" : "Best score ranking"}
                      </StatusBadge>
                      <span>{rows.length} real players</span>
                    </div>

                    {podiumRows.length === 3 && (
                      <LeaderboardPodium rows={podiumRows} type={leaderboardTab} />
                    )}

                    <div className="bk-leaderboard-list-v2">
                      {listRows.map((row) => (
                        <LeaderboardRow
                          key={row.id || row.username}
                          row={row}
                          type={leaderboardTab}
                        />
                      ))}
                    </div>

                    {currentRow && (
                      <div className="bk-leaderboard-current-card">
                        <span>Your standing</span>
                        <LeaderboardRow row={currentRow} type={leaderboardTab} featured />
                        <small>
                          Ranking shown from the current live leaderboard window.
                        </small>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </AppScreen>
        ) : multiplayerOpen ? (
          <AppScreen backgroundImage={stadiumBg} className="bk-nav-screen" width="wide">
            <div className="bk-arena-shell">
              <ScreenHeader
                kicker="Arena"
                title="Multiplayer"
                subtitle="Play random matches, challenge friends, or run a daily league."
                leadingAction={<BackButton label="Back" onClick={goBackMultiplayer} />}
              />

              {multiplayerError && (
                <div className="bk-notice bk-notice--error">{multiplayerError}</div>
              )}

              {multiplayerNotice && (
                <div className="bk-notice">{multiplayerNotice}</div>
              )}

              {multiplayerStep === "menu" && (
  <div className="bk-mp-hub">

    {/* ARENA INTRO */}
    <section className="bk-mp-hero">
      <span className="bk-mp-hero-glow" aria-hidden="true" />
      <span className="bk-mp-hero-ball" aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="52" className="bk-mp-svg-line" />
          <polygon
            points="80,48 101,63 93,88 67,88 59,63"
            className="bk-mp-svg-fill"
          />
          <path
            d="M80 48 L80 29
               M101 63 L121 52
               M93 88 L108 108
               M67 88 L52 108
               M59 63 L39 52"
            className="bk-mp-svg-line"
          />
        </svg>
      </span>

      <span className="bk-mp-eyebrow">MULTIPLAYER ARENA</span>

      <h2>
        Take on
        <br />
        the competition.
      </h2>

      <p>
        Play instantly, challenge rivals or build your own league.
      </p>

      <div className="bk-mp-live-strip">
        <span className="bk-mp-live-dot" />
        <span>Competitive football knowledge</span>
      </div>
    </section>


    {/* PLAY NOW — PRIMARY MULTIPLAYER DESTINATION */}
    <button
      type="button"
      className="bk-mp-card bk-mp-card--play"
      onClick={openPlayNowLobby}
      disabled={multiplayerLoading}
    >
      <span className="bk-mp-card-art bk-mp-card-art--play" aria-hidden="true">
        <svg viewBox="0 0 220 160">
          <circle cx="150" cy="82" r="52" className="bk-mp-svg-soft" />
          <circle cx="150" cy="82" r="34" className="bk-mp-svg-line" />

          <polygon
            points="150,58 165,69 159,87 141,87 135,69"
            className="bk-mp-svg-fill"
          />

          <path
            d="M150 58 L150 45
               M165 69 L181 61
               M159 87 L169 101
               M141 87 L131 101
               M135 69 L119 61"
            className="bk-mp-svg-line"
          />

          <path
            d="M57 52 C74 39 93 39 108 49"
            className="bk-mp-svg-motion"
          />
          <path
            d="M53 71 C74 58 94 58 112 68"
            className="bk-mp-svg-motion"
          />
        </svg>
      </span>

      <span className="bk-mp-card-icon">
        <BKIcon name="playNow" size={36} />
      </span>

      <span className="bk-mp-card-copy">
        <small>QUICK MATCH</small>

        <strong>Play Now</strong>

        <span>
          Jump into a random async match.
        </span>
      </span>

      <span className="bk-mp-card-meta">
        <span>
          <small>MATCH TYPE</small>
          <strong>Random opponent</strong>
        </span>

        <b aria-hidden="true">›</b>
      </span>
    </button>


    {/* SECONDARY ARENA MODES */}
    <div className="bk-mp-secondary-grid">

      {/* H2H */}
      <button
        type="button"
        className="bk-mp-card bk-mp-card--h2h"
        onClick={() => openArenaSection("h2h-menu")}
      >
        <span className="bk-mp-card-art bk-mp-card-art--h2h" aria-hidden="true">
          <svg viewBox="0 0 180 160">
            <path
              d="M50 45 L126 121"
              className="bk-mp-svg-sword"
            />
            <path
              d="M126 45 L50 121"
              className="bk-mp-svg-sword"
            />
            <circle cx="88" cy="82" r="46" className="bk-mp-svg-soft" />
          </svg>
        </span>

        <span className="bk-mp-card-top">
          <span className="bk-mp-card-icon">
            <BKIcon name="h2h" size={32} />
          </span>

          <span className="bk-mp-card-arrow" aria-hidden="true">
            ›
          </span>
        </span>

        <span className="bk-mp-card-copy">
          <small>1 VS 1</small>
          <strong>H2H</strong>
          <span>Challenge a friend or rival.</span>
        </span>

        <span className="bk-mp-card-footer">
          HEAD TO HEAD
        </span>
      </button>


      {/* LEAGUE */}
      <button
        type="button"
        className="bk-mp-card bk-mp-card--league"
        onClick={() => openArenaSection("league-menu")}
      >
        <span className="bk-mp-card-art bk-mp-card-art--league" aria-hidden="true">
          <svg viewBox="0 0 180 160">
            <path
              d="M49 117
                 C69 91 70 63 63 38
                 C87 53 106 53 128 38
                 C121 65 124 92 142 117"
              className="bk-mp-svg-laurel"
            />

            <path
              d="M72 78
                 L90 55
                 L108 78
                 L122 62
                 L117 103
                 H63
                 L58 62
                 Z"
              className="bk-mp-svg-fill"
            />
          </svg>
        </span>

        <span className="bk-mp-card-top">
          <span className="bk-mp-card-icon">
            <BKIcon name="league" size={32} />
          </span>

          <span className="bk-mp-card-arrow" aria-hidden="true">
            ›
          </span>
        </span>

        <span className="bk-mp-card-copy">
          <small>COMPETE TOGETHER</small>
          <strong>League</strong>
          <span>Daily points and private tables.</span>
        </span>

        <span className="bk-mp-card-footer">
          DAILY COMPETITION
        </span>
      </button>

    </div>

  </div>
)}

              {multiplayerStep === "play-now" && (
  <section className="bk-mp-submenu bk-mp-submenu--play">
    <header className="bk-mp-subhead">
      <span className="bk-mp-subhead__icon">
        <BKIcon name="playNow" size={34} />
      </span>

      <div>
        <span className="bk-mp-subhead__eyebrow">QUICK MATCH</span>
        <h2>Play Now</h2>
        <p>Jump into the arena or continue a match already in progress.</p>
      </div>
    </header>

    <div className="bk-mp-option-stack">
      <ArenaOptionCard
        tone="primary"
        icon="startNewRandomMatch"
        eyebrow="NEW MATCH"
        title={multiplayerLoading ? "Finding opponent..." : "Find an Opponent"}
        description="Start a fresh random async battle."
        onClick={() => startPlayNow(playNowCategory)}
        disabled={multiplayerLoading}
      />

      <ArenaOptionCard
        tone="blue"
        icon="activeRandomMatches"
        eyebrow="YOUR GAMES"
        title={playNowGamesLoading ? "Loading..." : "Active Matches"}
        description="Continue random matches you already started."
        onClick={openCurrentRandomMatches}
        disabled={playNowGamesLoading}
      />
    </div>
  </section>
)}

              {multiplayerStep === "play-now-active-games" && (
                <div className="bk-stack">
                  <SurfaceCard className="bk-profile-level__top">
                    <div>
                      <p className="bk-type-label">Arena</p>
                      <h2 className="bk-type-section-title">Active Random Matches</h2>
                      <p className="bk-type-body">Continue random matches you already started.</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => loadPlayNowGames()}
                      disabled={playNowGamesLoading}
                    >
                      {playNowGamesLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                  </SurfaceCard>

                  <SurfaceCard>
                    {playNowGamesLoading ? (
                      <EmptyState title="Loading current matches..." icon={<BKIcon name="activeRandomMatches" size={24} />}>
                        Checking your saved random matches.
                      </EmptyState>
                    ) : playNowGames.length === 0 ? (
                      <EmptyState title="No current random matches" icon={<BKIcon name="playNow" size={24} />}>
                        Start a new random match when you are ready.
                      </EmptyState>
                    ) : (
                      <div className="bk-match-list">
                        {playNowGames.map(({ match, latestRound }) => {
                          const playerSlot = getCurrentPlayerSlot(
                            match,
                            playerId,
                            username
                          );
                          const opponentSlot =
                            playerSlot === "player1" ? "player2" : "player1";
                          const opponentProfile = getMatchPlayerProfile(
                            match,
                            opponentSlot
                          );
                          const userFinished = hasPlayerFinishedRound(
                            latestRound,
                            playerSlot
                          );
                          const opponentFinished =
                            playerSlot === "player1"
                              ? Boolean(latestRound?.player2_finished)
                              : Boolean(latestRound?.player1_finished);
                          const userScore =
                            playerSlot === "player2"
                              ? latestRound?.player2_score ?? 0
                              : latestRound?.player1_score ?? 0;
                          const opponentScore =
                            playerSlot === "player2"
                              ? latestRound?.player1_score ?? 0
                              : latestRound?.player2_score ?? 0;
                          const opponentName = getOpponentName(match, playerId, username);
                          const opponentLabel =
                            opponentName && opponentName !== "your opponent"
                              ? opponentName
                              : match.player2_id
                              ? "your opponent"
                              : "random opponent";
                          const isCompleted = match.status === "completed";
                          const isChoosingNext = match.phase === "round_finished";
                          const isCurrentChooser = isCurrentPlayersTurn(
                            match,
                            playerId,
                            username
                          );
                          const category = latestRound?.category || match.selected_category;
                          let statusText = "Ready to play";
                          let detailText = `${opponentLabel} is waiting`;
                          let ctaText = "Play now";

                          if (isCompleted) {
                            const winner = latestRound?.winner;
                            statusText =
                              winner === "draw"
                                ? "Draw"
                                : winner === username
                                ? "You won"
                                : "You lost";
                            detailText = `${userScore} - ${opponentScore}`;
                            ctaText = "View Result";
                          } else if (isChoosingNext && isCurrentChooser) {
                            statusText = "Choose next category";
                            detailText = `Continue vs ${opponentLabel}`;
                            ctaText = "Choose Category";
                          } else if (isChoosingNext) {
                            statusText = `Waiting for ${opponentLabel}`;
                            detailText = `Waiting for ${opponentLabel} to choose the next category`;
                            ctaText = "Waiting";
                          } else if (userFinished && !opponentFinished) {
                            statusText = `Waiting for ${opponentLabel}`;
                            detailText = "Your score is saved";
                            ctaText = "Waiting";
                          } else if (!userFinished) {
                            statusText =
                              playerSlot === "player2"
                                ? `${opponentLabel} is waiting`
                                : "Ready to play";
                            detailText = getCategoryLabel(category);
                            ctaText = "Continue";
                          }

                          return (
                            <div
                              className="bk-match-row"
                              key={match.id}
                            >
                              <PlayerAvatar profile={opponentProfile} size="small" />
                              <div className="bk-row-copy">
                                <strong>
                                  {opponentLabel === "random opponent"
                                    ? "Searching random opponent"
                                    : opponentLabel}
                                </strong>
                                <small>{category ? getCategoryLabel(category) : match.room_code}</small>
                                <small>{detailText}</small>
                              </div>
                              <div className="bk-row-score">
                                <strong>{userFinished ? userScore : "-"}</strong>
                                <small>{opponentFinished || isCompleted ? opponentScore : "-"}</small>
                              </div>
                              <div className="bk-match-actions">
                                <StatusBadge tone={isCompleted ? "success" : userFinished ? "warning" : "info"}>
                                  {statusText}
                                </StatusBadge>
                                <Button onClick={() => openPlayNowGame(match.id)} disabled={multiplayerLoading}>
                                  {ctaText}
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => requestDeleteMatch(match)}
                                  disabled={Boolean(deletingMatchId)}
                                  aria-label="Leave random match"
                                  leadingIcon={<Trash2 size={16} />}
                                >
                                  Leave
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SurfaceCard>
                </div>
              )}

              {multiplayerStep === "league-menu" && (
  <section className="bk-mp-submenu bk-mp-submenu--league">
    <header className="bk-mp-subhead">
      <span className="bk-mp-subhead__icon bk-mp-subhead__icon--gold">
        <BKIcon name="league" size={34} />
      </span>

      <div>
        <span className="bk-mp-subhead__eyebrow">LEAGUE CLUB</span>
        <h2>Compete Together</h2>
        <p>Create daily competitions and climb the table with friends.</p>
      </div>
    </header>

    <div className="bk-mp-option-stack">
      <ArenaOptionCard
        tone="gold"
        icon="myLeagues"
        eyebrow="YOUR COMPETITIONS"
        title={leagueLoading ? "Loading..." : "My Leagues"}
        description="Standings, scores and today's challenge."
        onClick={loadMyLeagues}
        disabled={leagueLoading}
      />

      <ArenaOptionCard
        tone="purple"
        icon="createLeague"
        eyebrow="BUILD YOUR OWN"
        title="Create League"
        description="Choose the games, duration and daily format."
        onClick={() => {
          playClickSound();
          setLeagueNameInput(`${username}'s League`);
          setMultiplayerStep("create-league");
        }}
      />

      <ArenaOptionCard
        tone="primary"
        icon="joinLeague"
        eyebrow="INVITE CODE"
        title="Join League"
        description="Enter a friend's league code."
        onClick={() => {
          playClickSound();
          setMultiplayerStep("join-league");
        }}
      />
    </div>
  </section>
)}

              {multiplayerStep === "h2h-menu" && (
  <section className="bk-mp-submenu bk-mp-submenu--h2h">
    <header className="bk-mp-subhead">
      <span className="bk-mp-subhead__icon bk-mp-subhead__icon--purple">
        <BKIcon name="h2h" size={34} />
      </span>

      <div>
        <span className="bk-mp-subhead__eyebrow">HEAD TO HEAD</span>
        <h2>Challenge a Rival</h2>
        <p>Create a private battle, join a friend or continue the rivalry.</p>
      </div>
    </header>

    <div className="bk-mp-option-stack">
      <ArenaOptionCard
        tone="purple"
        icon="activeMatches"
        eyebrow="ONGOING"
        title={activeGamesLoading ? "Loading..." : "Active Matches"}
        description="Continue ongoing H2H battles."
        onClick={openActiveGames}
        disabled={activeGamesLoading}
      />

      <ArenaOptionCard
        tone="blue"
        icon="createMatch"
        eyebrow="HOST"
        title={multiplayerLoading ? "Creating..." : "Create Match"}
        description="Generate a private room code."
        onClick={createMultiplayerMatch}
        disabled={multiplayerLoading}
      />

      <ArenaOptionCard
        tone="gold"
        icon="joinMatch"
        eyebrow="INVITE"
        title="Join Match"
        description="Enter a room code from another player."
        onClick={() => {
          playClickSound();
          setMultiplayerStep("join");
        }}
      />
    </div>
  </section>
)}

              {multiplayerStep === "active-games" && (
                <div className="bk-stack">
                  <SurfaceCard className="bk-profile-level__top">
                    <div>
                      <p className="bk-type-label">Arena</p>
                      <h2 className="bk-type-section-title">H2H Active Matches</h2>
                      <p className="bk-type-body">Continue friend and invite matches.</p>
                    </div>

                    <Button variant="secondary" onClick={fetchActiveGames} disabled={activeGamesLoading}>
                      {activeGamesLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                  </SurfaceCard>

                  <SurfaceCard>
                    {activeGames.length === 0 && !activeGamesLoading ? (
                      <EmptyState title="No active matches yet" icon={<BKIcon name="activeMatches" size={24} />}>
                        Create a match or join with a room code.
                      </EmptyState>
                    ) : (
                      <div className="bk-match-list">
                        {activeGames.map(({ match, latestRound }) => {
                        const playerSlot = getCurrentPlayerSlot(
                          match,
                          playerId,
                          username
                        );
                        const actionLabel = getMatchActionLabel(
                          match,
                          latestRound,
                          playerSlot,
                          isCurrentPlayersTurn(match, playerId, username)
                        );
                        const actionKind = getMatchActionKind(
                          match,
                          latestRound,
                          playerSlot,
                          isCurrentPlayersTurn(match, playerId, username)
                        );
                        const timestamp = match.updated_at || match.created_at;
                        const category = latestRound?.category || match.selected_category;
                        const opponentSlot = playerSlot === "player1" ? "player2" : "player1";
                        const opponentProfile = getMatchPlayerProfile(match, opponentSlot);

                        return (
                          <div
                            className="bk-match-row"
                            key={match.id}
                          >
                            <PlayerAvatar profile={opponentProfile} size="small" />
                            <div className="bk-row-copy">
                              <strong>{getOpponentName(match, playerId, username)}</strong>
                              <small>
                                {category
                                  ? `Round ${latestRound?.round_number || match.round_number || 1} · ${getCategoryLabel(category)}`
                                  : match.room_code}
                              </small>
                              <small>
                                {timestamp
                                  ? new Date(timestamp).toLocaleDateString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Recently active"}
                              </small>
                            </div>
                            <div className="bk-row-score">
                              <strong>{match.player1_wins || 0} - {match.player2_wins || 0}</strong>
                              <small>Match</small>
                            </div>
                            <div className="bk-match-actions">
                              <StatusBadge tone={actionKind === "your-turn" ? "info" : actionKind === "result" ? "success" : "warning"}>
                                {actionLabel}
                              </StatusBadge>
                              <Button
                                onClick={() => openExistingMatch(match.id)}
                                disabled={multiplayerLoading}
                              >
                                {getMatchCtaLabel(actionKind, match)}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => requestDeleteMatch(match)}
                                disabled={Boolean(deletingMatchId)}
                                aria-label="Delete match"
                                leadingIcon={<Trash2 size={16} />}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </SurfaceCard>
                </div>
              )}

              {multiplayerStep === "create-league" && (
                <SurfaceCard className="bk-form-grid bk-league-create-flow">
                  <p className="bk-type-label">
                    <BKIcon name="createLeague" size={22} /> Create League
                  </p>
                  <h2 className="bk-type-section-title">Start a Daily League</h2>
                  <input
                    value={leagueNameInput}
                    onChange={(event) => setLeagueNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") createNewLeague();
                    }}
                    placeholder={`${username}'s League`}
                    autoFocus
                  />

                  <div className="bk-form-section">
                    <strong className="bk-section-title">Format</strong>
                    <div className="bk-category-grid bk-category-grid--league">
                      {Object.entries(LEAGUE_FORMATS).map(([format, config]) => (
                        <SurfaceCard
                          as="button"
                          interactive
                          key={format}
                          type="button"
                          variant={leagueFormatInput === format ? "selected" : "default"}
                          className="bk-category-card"
                          onClick={() => setLeagueFormatInput(format)}
                        >
                          <b><BKIcon name={config.icon} size={34} /></b>
                          <span>{config.label}</span>
                          <small>{config.description}</small>
                        </SurfaceCard>
                      ))}
                    </div>
                  </div>

                  {leagueFormatInput !== "custom" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => customizeLeaguePreset(leagueFormatInput)}
                    >
                      Customize this
                    </Button>
                  )}

                  {leagueFormatInput === "custom" && (
                    <>
                      <div className="bk-form-section">
                        <strong className="bk-section-title">Length</strong>
                        <div className="bk-category-grid bk-category-grid--compact">
                          {LEAGUE_DURATIONS.map((duration) => (
                            <SurfaceCard
                              as="button"
                              interactive
                              key={duration.label}
                              type="button"
                              variant={leagueDurationInput === duration.value ? "selected" : "default"}
                              className="bk-category-card bk-category-card--compact"
                              onClick={() => setLeagueDurationInput(duration.value)}
                            >
                              {duration.label}
                            </SurfaceCard>
                          ))}
                        </div>
                      </div>

                      <SurfaceCard className="bk-setting-panel">
                        <div className="bk-setting-row">
                          <span>Quick questions</span>
                          <div>
                            {CUSTOM_QUIZ_COUNTS.map((count) => (
                              <button
                                key={count}
                                type="button"
                                className={
                                  leagueCustomQuizCount === count ? "selected" : ""
                                }
                                onClick={() => setLeagueCustomQuizCount(count)}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bk-setting-row">
                          <span>Top 10 lists</span>
                          <div>
                            {CUSTOM_TOP10_COUNTS.map((count) => (
                              <button
                                key={count}
                                type="button"
                                className={
                                  leagueCustomTop10Count === count ? "selected" : ""
                                }
                                onClick={() => setLeagueCustomTop10Count(count)}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bk-setting-row">
                          <span>Who Am I</span>
                          <div>
                            {CUSTOM_WHOAMI_COUNTS.map((count) => (
                              <button
                                key={count}
                                type="button"
                                className={
                                  leagueCustomWhoAmICount === count ? "selected" : ""
                                }
                                onClick={() => setLeagueCustomWhoAmICount(count)}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>

                      </SurfaceCard>
                    </>
                  )}

                  <SurfaceCard variant="selected" className="bk-stack">
                    <span>Your league</span>
                    <strong>
                      {leagueSettings.quizCount} quiz · {leagueSettings.top10Count} Top 10 ·{" "}
                      {leagueSettings.whoamiCount} Who Am I
                    </strong>
                    <strong>Max daily score: {leagueSettings.maxDailyPoints}</strong>
                    <small>
                      Duration:{" "}
                      {leagueDurationInput ? `${leagueDurationInput} days` : "Infinite"}
                    </small>
                  </SurfaceCard>

                  <Button
                    onClick={createNewLeague}
                    disabled={
                      leagueLoading ||
                      leagueSettings.quizCount +
                        leagueSettings.top10Count +
                        leagueSettings.whoamiCount <=
                        0
                    }
                  >
                    {leagueLoading ? "Creating..." : "Create League"}
                  </Button>
                </SurfaceCard>
              )}

              {multiplayerStep === "join-league" && (
                <SurfaceCard className="bk-form-grid bk-league-create-flow bk-league-join-flow">
                  <p className="bk-type-label">
                    <BKIcon name="joinLeague" size={22} /> Join League
                  </p>
                  <h2 className="bk-type-section-title">Enter League Code</h2>
                  <input
                    value={leagueCodeInput}
                    onChange={(event) => setLeagueCodeInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") joinExistingLeague();
                    }}
                    placeholder="LG-4821"
                    autoFocus
                  />
                  <Button onClick={joinExistingLeague} disabled={leagueLoading}>
                    {leagueLoading ? "Joining..." : "Join League"}
                  </Button>
                </SurfaceCard>
              )}

              {multiplayerStep === "my-leagues" && (
                <div className="bk-stack bk-league-menu-flow">
                  <SurfaceCard className="bk-match-row">
                    <div>
                      <p className="bk-type-label">Arena</p>
                      <h2 className="bk-type-section-title">My Leagues</h2>
                      <p className="bk-type-body">Open leagues you created or joined.</p>
                    </div>
                    <Button onClick={loadMyLeagues} disabled={leagueLoading}>
                      {leagueLoading ? "Loading..." : "Refresh"}
                    </Button>
                  </SurfaceCard>

                  <SurfaceCard>
                    {!leagueLoading && myLeagues.length === 0 ? (
                      <EmptyState
                        icon={<BKIcon name="league" size={28} />}
                        title="No leagues yet"
                      >
                        Create a league or join with a code
                      </EmptyState>
                    ) : (
                      <div className="bk-league-list">
                        {myLeagues.map(({ league, member, memberCount, rank, todayPlayed }) => (
                        <div className="bk-league-row" key={league.id}>
                          <div className="bk-row-copy">
                            <strong>{league.name}</strong>
                            <small>{league.league_code}</small>
                          </div>
                          <div className="bk-league-stats">
                            <StatusBadge tone="info">Rank #{rank || "-"}</StatusBadge>
                            <StatusBadge tone="neutral">{member?.total_points || 0} pts</StatusBadge>
                            <StatusBadge tone="neutral">{memberCount} players</StatusBadge>
                          </div>
                          <StatusBadge tone={todayPlayed ? "success" : "warning"}>
                            {todayPlayed ? "Played today" : "Not played today"}
                          </StatusBadge>
                          <Button onClick={() => openLeagueDashboard(league.id)}>
                            Open League
                          </Button>
                        </div>
                        ))}
                      </div>
                    )}
                  </SurfaceCard>
                </div>
              )}

              {multiplayerStep === "league-dashboard" && leagueDashboard && (
                <div className="bk-stack bk-league-dashboard bk-league-menu-flow">
                  <LeagueDashboardHero
                    league={leagueDashboard.league}
                    dayLabel={leagueDayLabel}
                    memberCount={leagueDashboard.members.length}
                    statusLabel={
                      leagueDayExpired
                        ? "League finished"
                        : activeLeagueSubmission
                        ? "Played today"
                        : "Ready today"
                    }
                    statusTone={
                      leagueDayExpired ? "danger" : activeLeagueSubmission ? "success" : "warning"
                    }
                    onLeave={() => setLeagueExitConfirmOpen(true)}
                    loading={leagueLoading}
                  />

                  <LeagueTodayChallengeCard
                    expired={leagueDayExpired}
                    submission={activeLeagueSubmission}
                    settings={leagueSettings}
                    scoreItems={getLeagueScoreItems(
                      activeLeagueSubmission,
                      leagueSettings,
                      leagueTop10MaxPoints,
                      leagueWhoAmIMaxPoints
                    )}
                    structureText={leagueDailyStructureText}
                    loading={leagueLoading}
                    onPlay={prepareLeagueChallenge}
                  />

                  <LeagueStandings rows={leagueDashboardRows} />

                  {leagueExitConfirmOpen && (
                    <Modal
                      title="Leave this league?"
                      showClose={false}
                      cardClassName="bk-confirmation-modal bk-stack"
                      onClose={() => setLeagueExitConfirmOpen(false)}
                    >
                        <p className="bk-type-body">Are you sure you want to leave this league?</p>
                        {activeLeague?.created_by_id === (effectiveAuthUser?.id || playerId) && (
                          <p className="bk-type-caption">
                            If other members are still here, ownership will move to another member.
                            If not, the league will be archived.
                          </p>
                        )}
                        <div className="bk-screen-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setLeagueExitConfirmOpen(false)}
                            disabled={leagueLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmLeaveActiveLeague}
                            disabled={leagueLoading}
                          >
                            {leagueLoading ? "Leaving..." : "Leave league"}
                          </Button>
                        </div>
                    </Modal>
                  )}
                </div>
              )}

              {multiplayerStep === "play-now-waiting" && (
                <SurfaceCard className="bk-stack">
                  <p className="bk-type-label">Play Now Online</p>
                  <MultiplayerMatchScoreboard
                    activeMatch={activeMatch}
                    activeRound={activeRound}
                    playerOneProfile={getMatchPlayerProfile(activeMatch, "player1")}
                    playerTwoProfile={getMatchPlayerProfile(activeMatch, "player2")}
                    currentPlayerSlot={multiplayerPlayerSlot || "player1"}
                    currentUsername={username}
                    hasBothPlayers={hasBothMultiplayerPlayers}
                  />
                  <MultiplayerRoundStatus
                    activeMatch={activeMatch}
                    activeRound={activeRound}
                    hasBothPlayers={hasBothMultiplayerPlayers}
                    hasPlayedActiveRound={hasPlayedActiveRound}
                    isMultiplayerTurn={isMultiplayerTurn}
                    nextCategoryWaitingName={nextCategoryWaitingName}
                    activeOpponentLabel={activeOpponentLabel}
                  />
                  {activeRound && (
                    <SurfaceCard variant="selected">
                      <strong>Your saved score</strong>
                      <span>{getCategoryLabel(activeRound.category)}</span>
                      <div className="bk-score-grid">
                        <div>
                          <small>{username}</small>
                          <b>
                            {multiplayerPlayerSlot === "player2"
                              ? activeRound.player2_score ?? 0
                              : activeRound.player1_score ?? 0}
                          </b>
                        </div>
                        <div>
                          <small>Opponent</small>
                          <b>Waiting</b>
                        </div>
                      </div>
                    </SurfaceCard>
                  )}
                  <StatusBadge tone="info">Public match: {multiplayerRoomCode}</StatusBadge>
                  <Button onClick={refreshMultiplayerMatch} disabled={multiplayerLoading}>
                    {multiplayerLoading ? "Checking..." : "Check Now"}
                  </Button>
                  <Button variant="secondary" onClick={goBackMultiplayer}>
                    Home
                  </Button>
                </SurfaceCard>
              )}

              {multiplayerStep === "created" && (
                <PrivateBattleLobby
                  roomCode={multiplayerRoomCode}
                  activeMatch={activeMatch}
                  activeRound={activeRound}
                  matchRounds={matchRounds}
                  canChooseCategory={canChooseMultiplayerCategory}
                  categories={MULTIPLAYER_CATEGORIES}
                  multiplayerLoading={multiplayerLoading}
                  copyStatus={roomCodeCopyStatus}
                  isWaitingAfterCreatorRound={isH2HWaitingAfterCreatorRound}
                  hasBothPlayers={hasBothMultiplayerPlayers}
                  hasPlayedActiveRound={hasPlayedActiveRound}
                  isMultiplayerTurn={isMultiplayerTurn}
                  nextCategoryWaitingName={nextCategoryWaitingName}
                  playerOneProfile={getMatchPlayerProfile(activeMatch, "player1")}
                  playerTwoProfile={getMatchPlayerProfile(activeMatch, "player2")}
                  currentPlayerSlot={multiplayerPlayerSlot}
                  currentUsername={username}
                  onCopyCode={copyMultiplayerRoomCode}
                  onSelectCategory={selectMultiplayerCategory}
                  onStartRound={startActiveMultiplayerRound}
                  onRefresh={refreshMultiplayerMatch}
                />
              )}

              {multiplayerStep === "join" && (
                <SurfaceCard className="bk-form-grid">
                  <p className="bk-type-label">Join H2H</p>
                  <h2 className="bk-type-section-title">Enter room code</h2>
                  <label htmlFor="room-code-input">Room code</label>
                  <input
                    id="room-code-input"
                    value={joinRoomCode}
                    onChange={(event) => setJoinRoomCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") joinMultiplayerMatch();
                    }}
                    placeholder="BK-4831"
                    autoFocus
                  />
                  <Button
                    onClick={joinMultiplayerMatch}
                    disabled={multiplayerLoading}
                  >
                    {multiplayerLoading ? "Joining match..." : "Join Match"}
                  </Button>
                </SurfaceCard>
              )}

              {multiplayerStep === "joined" && (
                <SurfaceCard className="bk-stack">
                  <p className="bk-type-label">
                    {activeMatch?.is_public ? "Play Now Online" : "Private Battle"}
                  </p>
                  {activeMatch && (
                    <MultiplayerMatchScoreboard
                      activeMatch={activeMatch}
                      activeRound={activeRound}
                      playerOneProfile={getMatchPlayerProfile(activeMatch, "player1")}
                      playerTwoProfile={getMatchPlayerProfile(activeMatch, "player2")}
                      currentPlayerSlot={multiplayerPlayerSlot}
                      currentUsername={username}
                      hasBothPlayers={hasBothMultiplayerPlayers}
                    />
                  )}
                  {!activeMatch?.is_public && (
                    <StatusBadge tone="info">Room {multiplayerRoomCode}</StatusBadge>
                  )}
                  <MultiplayerRoundStatus
                    activeMatch={activeMatch}
                    activeRound={activeRound}
                    hasBothPlayers={hasBothMultiplayerPlayers}
                    hasPlayedActiveRound={hasPlayedActiveRound}
                    isMultiplayerTurn={isMultiplayerTurn}
                    nextCategoryWaitingName={nextCategoryWaitingName}
                    activeOpponentLabel={activeOpponentLabel}
                  />
                  {activeMatch?.phase === "choose_category" && (
                    <StatusBadge tone={canChooseMultiplayerCategory ? "info" : "warning"}>
                      {canChooseMultiplayerCategory
                        ? "Your turn to choose a category"
                        : `${nextCategoryWaitingName} chooses first`}
                    </StatusBadge>
                  )}
                  {canChooseMultiplayerCategory && (
                    <MultiplayerCategoryGrid
                      categories={MULTIPLAYER_CATEGORIES}
                      onSelect={selectMultiplayerCategory}
                      disabled={multiplayerLoading}
                    />
                  )}
                  {activeMatch?.phase === "category_selected" && (
                    <SurfaceCard variant="selected">
                      <strong>
                        Category selected:{" "}
                        {getCategoryLabel(activeMatch.selected_category)}
                      </strong>
                      <span>
                        Round {activeMatch.round_number || 1} is ready
                      </span>
                    </SurfaceCard>
                  )}
                  {activeMatch?.phase === "round_active" && activeRound && (
                    <SurfaceCard variant="selected">
                      <strong>
                        Round {activeRound.round_number} •{" "}
                        {getCategoryLabel(activeRound.category)}
                      </strong>
                      {hasPlayedActiveRound ? (
                        <span>Waiting for {activeOpponentLabel} to play this round</span>
                      ) : (
                        <>
                          <span>Your 5-question round is ready</span>
                          <Button onClick={startActiveMultiplayerRound}>
                            Play Round
                          </Button>
                        </>
                      )}
                    </SurfaceCard>
                  )}
                  <MultiplayerRoundResult
                    activeMatch={activeMatch}
                    activeRound={activeRound}
                    currentPlayerSlot={multiplayerPlayerSlot}
                    playerOneProfile={getMatchPlayerProfile(activeMatch, "player1")}
                    playerTwoProfile={getMatchPlayerProfile(activeMatch, "player2")}
                    currentUsername={username}
                    isMultiplayerTurn={isMultiplayerTurn}
                    nextCategoryWaitingName={nextCategoryWaitingName}
                  />
                  <MultiplayerRoundHistory
                    activeMatch={activeMatch}
                    activeRound={activeRound}
                    matchRounds={matchRounds}
                    currentPlayerSlot={multiplayerPlayerSlot}
                    playerOneProfile={getMatchPlayerProfile(activeMatch, "player1")}
                    playerTwoProfile={getMatchPlayerProfile(activeMatch, "player2")}
                    currentUsername={username}
                  />
                  <Button onClick={refreshMultiplayerMatch} variant="secondary">
                    {multiplayerLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                </SurfaceCard>
              )}

              {matchDeleteCandidate && (
                <Modal
                  title={
                    matchDeleteCandidate.is_public
                      ? "Leave this random match?"
                      : "Delete this match?"
                  }
                  showClose={false}
                  cardClassName="bk-confirmation-modal"
                  onClose={cancelDeleteMatch}
                >
                    <p className="bk-type-body">
                      {matchDeleteCandidate.is_public
                        ? "This removes the Play Now match from Active Games."
                        : "This removes it from your Active Matches."}
                    </p>
                    <div className="bk-screen-actions">
                      <Button variant="secondary" onClick={cancelDeleteMatch}>Cancel</Button>
                      <Button
                        variant="destructive"
                        onClick={confirmDeleteMatch}
                        disabled={deletingMatchId === matchDeleteCandidate.id}
                      >
                        {deletingMatchId === matchDeleteCandidate.id
                          ? matchDeleteCandidate.is_public
                            ? "Leaving..."
                            : "Deleting..."
                          : matchDeleteCandidate.is_public
                          ? "Leave"
                          : "Delete"}
                      </Button>
                    </div>
                </Modal>
              )}
            </div>
          </AppScreen>
        ) : (
          <AppScreen className="bk-home-screen bk-matchday-home-v3">
  <div className="bk-matchday-home-shell">

    {/* TOP BAR */}
    <header className="bk-matchday-topbar">
      <button
        type="button"
        className="bk-matchday-user"
        onClick={() => {
          playClickSound();
          setProfileOpen(true);
        }}
      >
        <PlayerAvatar
          profile={{
            ...profile,
            avatar_emoji: profileAvatarEmoji,
            avatar_icon: profileAvatar.icon,
            avatar_style: profileAvatar.style,
            avatar_color: profileAvatar.color,
            avatar_bg: profileAvatar.bg,
          }}
          size="small"
          hideFlag
        />

        <span className="bk-matchday-user-copy">
          <small>WELCOME BACK</small>
          <strong>{displayName}</strong>
        </span>
      </button>

      <div className="bk-matchday-top-stats">
        <button
          type="button"
          className="bk-matchday-top-stat bk-matchday-top-stat--coins"
          onClick={openCoinShop}
          aria-label={`${coins} coins`}
        >
          <Coins className="bk-matchday-status-icon" size={18} aria-hidden="true" />
          <strong>{coins.toLocaleString()}</strong>
        </button>

        <button
          type="button"
          className="bk-matchday-top-stat bk-matchday-top-stat--streak"
          onClick={openDailyRewardMeter}
          aria-label={`${dailyStreak} day streak`}
        >
          <Flame className="bk-matchday-status-icon" size={18} aria-hidden="true" />
          <strong>{dailyStreak}</strong>
        </button>
      </div>
    </header>

    {/* MAIN PLAY HERO */}
    <section className="bk-matchday-main-hero">
      <span className="bk-matchday-pitch-line" aria-hidden="true" />
      <span className="bk-matchday-hero-light" aria-hidden="true" />

      <div className="bk-matchday-hero-copy">
        <span className="bk-matchday-eyebrow">
          <i aria-hidden="true" />
          BALL KNOWLEDGE
        </span>

        <h1>
          How good is your
          <em> football IQ?</em>
        </h1>

        <p>
          Put your knowledge to the test.
          <br />
          Play. Compete. Climb.
        </p>
      </div>

      <div className="bk-matchday-play-grid">
        <button
  type="button"
  className="bk-matchday-mode-card bk-matchday-mode-card--single"
  disabled={modeLoading}
  onClick={() => {
    playClickSound();
    setModeMenuOpen(true);
  }}
>
  <span className="bk-matchday-mode-top">
    <span className="bk-matchday-mode-icon">
      <BKIcon name="singlePlayer" size={50} />
    </span>

    <span className="bk-matchday-mode-arrow" aria-hidden="true">
      ›
    </span>
  </span>

  <span className="bk-matchday-mode-copy">
    <strong>Single Player</strong>
    <span>Test your football IQ</span>
  </span>
</button>

<button
  type="button"
  className="bk-matchday-mode-card bk-matchday-mode-card--multi"
  onClick={openMultiplayer}
>
  <span className="bk-matchday-mode-icon">
    <BKIcon name="multiplayer" size={50} />
  </span>

  <span className="bk-matchday-mode-copy">
    <strong>Multiplayer</strong>
    <span>Challenge rivals</span>
  </span>
</button>
      </div>
    </section>

    {/* DAILY CHALLENGE */}
    <button
      type="button"
      className={`bk-matchday-daily ${dailyPlayed ? "is-complete" : ""}`}
      disabled={dailyPlayed}
      onClick={() => {
        playClickSound();
        startDailyChallenge();
      }}
    >
      <span className="bk-matchday-daily-badge">
        {dailyPlayed ? "DONE" : "TODAY"}
      </span>

      <span className="bk-matchday-daily-icon">
        <BKIcon
          name={dailyPlayed ? "dailyStreak" : "dailyChallenge"}
          size={27}
        />
      </span>

      <span className="bk-matchday-daily-copy">
        <small>DAILY CHALLENGE</small>

        <strong>
          {dailyPlayed ? "Challenge complete" : "Today's test is live"}
        </strong>

        <span>
          {dailyPlayed
            ? lastDailyResult
              ? `Last result ${lastDailyResult.found}/${lastDailyResult.total}`
              : "Come back tomorrow"
            : `Keep your ${dailyStreak} day streak alive`}
        </span>
      </span>

      <b aria-hidden="true">›</b>
    </button>

    {/* PROGRESSION */}
    <button
      type="button"
      className="bk-matchday-progress"
      onClick={openLevelModal}
    >
      <span className="bk-matchday-progress-head">
        <span>
          <small>YOUR SEASON</small>
          <strong>{playerLevel.name}</strong>
        </span>

        <span className="bk-matchday-level-mark">
          <small>LVL</small>
          <b>{playerLevel.levelNumber}</b>
        </span>
      </span>

      <ProgressBar
        value={playerLevel.progress}
        max={100}
        label="Progress"
        valueLabel={xpProgressLabel}
      />

      <span className="bk-matchday-progress-footer">
        <span>{xpProgressLabel}</span>
        <span>
          {playerLevel.next
            ? `Next: ${playerLevel.next.name}`
            : "Legend status"}
        </span>
      </span>

      <span className="bk-matchday-progress-best">
        Best score <strong>{highScore}</strong>
      </span>
    </button>

    {/* SECONDARY NAV */}
    <section className="bk-matchday-clubhouse">
      <header>
        <span>CLUBHOUSE</span>
        <small>More</small>
      </header>

      <div className="bk-matchday-clubhouse-grid">
        <button
          type="button"
          className="bk-matchday-club-card bk-matchday-club-card--active"
          onClick={openHomeActiveGames}
        >
          <span className="bk-matchday-club-icon">
            <BKIcon name="activeMatches" size={47} />
          </span>
          {activeGames.length > 0 && (
            <span className="bk-matchday-club-count">{activeGames.length}</span>
          )}
          <strong>Active Games</strong>
          <small>
            {activeGames.length > 0 ? "Continue battles" : "No active matches"}
          </small>
        </button>

        <button
          type="button"
          className="bk-matchday-club-card bk-matchday-club-card--league"
          onClick={() => {
            openMultiplayer();
            setMultiplayerStep("league-menu");
          }}
        >
          <span className="bk-matchday-club-icon">
            <BKIcon name="league" size={47} />
          </span>
          <strong>Leagues</strong>
          <small>Climb together</small>
        </button>

        <button
          type="button"
          className="bk-matchday-club-card bk-matchday-club-card--rankings"
          onClick={() => {
            playClickSound();
            setLeaderboardOpen(true);
          }}
        >
          <span className="bk-matchday-club-icon">
            <BKIcon name="rankings" size={47} />
          </span>
          <strong>Rankings</strong>
          <small>See the best</small>
        </button>

        <button
          type="button"
          className="bk-matchday-club-card bk-matchday-club-card--profile"
          onClick={() => {
            playClickSound();
            setProfileOpen(true);
          }}
        >
          <span className="bk-matchday-club-avatar">
            <PlayerAvatar
              profile={{
                ...profile,
                avatar_emoji: profileAvatarEmoji,
                avatar_icon: profileAvatar.icon,
                avatar_style: profileAvatar.style,
                avatar_color: profileAvatar.color,
                avatar_bg: profileAvatar.bg,
              }}
              size="small"
              hideFlag
            />
          </span>
          <strong>Profile</strong>
          <small>Your career</small>
        </button>
      </div>
    </section>

  </div>
</AppScreen>
        )}
          </ScreenTransition>
        </AnimatePresence>
      </div>
    );
  }

  if (gameMode === "who-am-i") {
    if (!whoAmIQuestion) {
      return <SinglePlayerFeatureFallback />;
    }

    const todayKey = getDailyDateKey();
    const whoAmIDateLabel = formatDisplayDate(whoAmIDate);

    return (
      <React.Suspense fallback={<SinglePlayerFeatureFallback />}>
        <WhoAmIGame
          key={`${whoAmIQuestion.id}:${whoAmIDate}:${whoAmIResumeVersion}`}
          question={whoAmIQuestion}
          dateLabel={whoAmIDateLabel}
          todayKey={todayKey}
          dateKey={whoAmIDate}
          initialSnapshot={whoAmIGameSnapshot}
          coinShopModal={coinShopModal}
          dailyRewardMeterModal={dailyRewardMeterModal}
          coinRewardToastOverlay={coinRewardToastOverlay}
          xpToastOverlay={xpToastOverlay}
          stadiumBackgroundImage={`linear-gradient(rgba(10,8,35,0.18), rgba(0,0,0,0.58)), url(${stadiumBg})`}
          isCorrectAnswer={isCorrectWhoAmIPlayerAnswer}
          onSolved={persistWhoAmISolved}
          onMissed={persistWhoAmIMissed}
          onBack={exitWhoAmIGame}
          onStartDate={(dayOffset) => {
            const nextDate = dayOffset === null
              ? whoAmIDate
              : dayOffset === 0
              ? todayKey
              : addDaysToDateKey(whoAmIDate, dayOffset);
            startWhoAmIGame(nextDate);
          }}
          playClickSound={playClickSound}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
        />
      </React.Suspense>
    );
  }

  if (gameMode === "connections") {
    if (!connectionsPuzzle) {
      return <SinglePlayerFeatureFallback />;
    }

    return (
      <React.Suspense fallback={<SinglePlayerFeatureFallback />}>
        <ConnectionsGame
          key={`${connectionsPuzzle.id}:${connectionsResumeVersion}`}
          puzzle={connectionsPuzzle}
          rewardModal={connectionsRewardModal}
          rewardOverlay={connectionsRewardOverlay}
          coinShopModal={coinShopModal}
          dailyRewardMeterModal={dailyRewardMeterModal}
          coinRewardToastOverlay={coinRewardToastOverlay}
          xpToastOverlay={xpToastOverlay}
          stadiumBackgroundImage={`linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.48)), url(${stadiumBg})`}
          onBack={() => {
            playClickSound();
            setGameStarted(false);
            setModeMenuOpen(true);
            setGameMode("general");
          }}
          onComplete={persistConnectionsCompletion}
          onTryNewPuzzle={() => startConnectionsGame()}
          playClickSound={playClickSound}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
        />
      </React.Suspense>
    );
  }

  if (gameMode === "daily-list" && !finished) {
    return (
      <React.Suspense fallback={<SinglePlayerFeatureFallback />}>
        <Top10Game
          key={`${todayChallenge.id || getDailyDateKey()}:${top10ResumeVersion}`}
          unavailable={dailyChallengeUnavailable}
          challenge={todayChallenge}
          answers={dailyAnswers}
          ruleHint={dailyRuleHint}
          targetCount={dailyTargetCount}
          isPlayerChallenge={isDailyPlayerChallenge}
          dateLabel={formatDisplayDate(getDailyDateKey())}
          blocked={Boolean(rewardPopup || wrongPopup)}
          coinShopModal={coinShopModal}
          dailyRewardMeterModal={dailyRewardMeterModal}
          xpToastOverlay={xpToastOverlay}
          quizBackgroundImage={`linear-gradient(rgba(255,255,255,0.03), rgba(0,0,0,0.58)), url(${quizBg})`}
          onHome={restart}
          onAnswerFound={persistTop10AnswerFound}
          onFinished={finishDaily}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
          getAnswerKey={getAnswerKey}
          formatAnswerWithValue={formatAnswerWithValue}
        />
      </React.Suspense>
    );
  }

  if (
    gameStarted &&
    gameMode === "world-cup" &&
    !isMockMultiplayer &&
    !finished
  ) {
    return (
      <React.Suspense fallback={<SinglePlayerFeatureFallback />}>
        <WorldCupGame
          key={`${runId}:${worldCupResumeVersion}`}
          questions={questions}
          coins={coins}
          highScore={highScore}
          playerLevel={playerLevel}
          xpProgressPercent={xpProgressPercent}
          xpProgressLabel={xpProgressLabel}
          xpToast={xpToast}
          xpToastOverlay={xpToastOverlay}
          objectiveProgressModal={objectiveProgressModal}
          initialSnapshot={worldCupGameSnapshot}
          isAnswerCorrect={isCorrectAnswer}
          onCorrectAnswer={awardClassicQuizRunXp}
          onCoinsChange={saveCoins}
          onFinish={finishWorldCupGame}
          onExit={exitWorldCupGame}
          onOpenCoinShop={openCoinShop}
          playClickSound={playClickSound}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
          playCoinSound={playCoinSound}
          coinShopModal={coinShopModal}
          dailyRewardMeterModal={dailyRewardMeterModal}
          quizBackgroundImage={`linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.58)), url(${quizBg})`}
        />
      </React.Suspense>
    );
  }

  if (
    gameStarted &&
    gameMode === "career" &&
    !isMockMultiplayer &&
    !finished
  ) {
    return (
      <React.Suspense fallback={<SinglePlayerFeatureFallback />}>
        <CareerPathGame
          key={`${runId}:${careerResumeVersion}`}
          questions={questions}
          coins={coins}
          highScore={highScore}
          playerLevel={playerLevel}
          xpProgressPercent={xpProgressPercent}
          xpProgressLabel={xpProgressLabel}
          xpToast={xpToast}
          xpToastOverlay={xpToastOverlay}
          objectiveProgressModal={objectiveProgressModal}
          initialSnapshot={careerGameSnapshot}
          isAnswerCorrect={isCorrectAnswer}
          isCorrectPlayerAnswer={isCorrectPlayerAnswer}
          isTypedPlayerAnswerCorrect={isPlayerAnswerCorrect}
          onCorrectAnswer={awardClassicQuizRunXp}
          onCoinsChange={saveCoins}
          onFinish={finishCareerGame}
          onExit={exitCareerGame}
          onOpenCoinShop={openCoinShop}
          playClickSound={playClickSound}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
          playCoinSound={playCoinSound}
          coinShopModal={coinShopModal}
          dailyRewardMeterModal={dailyRewardMeterModal}
          quizBackgroundImage={`linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.58)), url(${quizBg})`}
        />
      </React.Suspense>
    );
  }

  if (gameStarted && gameMode === "general" && !isMockMultiplayer && !finished) {
    return (
      <React.Suspense fallback={<SinglePlayerFeatureFallback />}>
        <GeneralKnowledgeGame
          key={`${runId}:${generalResumeVersion}`}
          questions={questions}
          highScore={highScore}
          coins={coins}
          playerLevel={playerLevel}
          xpProgressPercent={xpProgressPercent}
          xpProgressLabel={xpProgressLabel}
          xpToast={xpToast}
          xpToastOverlay={xpToastOverlay}
          objectiveProgressModal={objectiveProgressModal}
          initialSnapshot={generalGameSnapshot}
          runId={runId}
          isAnswerCorrect={isCorrectAnswer}
          onCorrectAnswer={awardGeneralRunXp}
          onHighScore={handleGeneralHighScore}
          onCoinsChange={saveCoins}
          onFinish={finishGeneralGame}
          onExit={exitGeneralGame}
          playClickSound={playClickSound}
          playCorrectSound={playCorrectSound}
          playWrongSound={playWrongSound}
          playCoinSound={playCoinSound}
          coinShopModal={coinShopModal}
          dailyRewardMeterModal={dailyRewardMeterModal}
        />
      </React.Suspense>
    );
  }

  if (finished) {
    const isDaily = gameMode === "daily-list";
    const dailyCompleted =
      isDaily && foundAnswers.length >= dailyTargetCount;
    const opponentScore =
      mockOpponentScore ?? createMockOpponentScore(score);
    const multiplayerWon = score >= opponentScore;
    const isGeneralPostGame = gameMode === "general" && !isMockMultiplayer;
    const showingGeneralXp = isGeneralPostGame && postGameStep === "xp";

    return (
      <div
        className="fullscreen-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05), rgba(0,0,0,0.62)), url(${quizBg})`,
        }}
      >
        {coinShopModal}
        {dailyRewardMeterModal}
        {!isGeneralPostGame && xpToastOverlay}
        {!isGeneralPostGame && objectiveProgressModal}
        <div className={`result-card ${isDaily ? "daily-result-card" : ""}`}>
          <Trophy size={70} />

          <h2>
            {showingGeneralXp
              ? "XP & Level Progress"
              : dailyCompleted
              ? "Daily Complete"
              : isDaily
              ? "Daily Failed"
              : "Game Over"}
          </h2>

          {isDaily ? (
            <div className="daily-result-content">
              <div className="daily-result-badge">DAILY RESULT</div>

              <div className="daily-result-score">
                {Math.min(foundAnswers.length, dailyTargetCount)}/{dailyTargetCount}
              </div>

              <div className="daily-result-subtitle">players found</div>

              <div className="daily-result-coins">
                <BKIcon name="coins" size={24} /> +{lastDailyResult?.coins || dailyCoinsEarned} coins
              </div>

              <div className="daily-result-streak">
                <BKIcon name="dailyStreak" size={36} /> Streak: {lastDailyResult?.streak || dailyStreak} days
              </div>

              {(lastDailyResult?.streakBonus || streakRewardEarned) > 0 && (
                <div className="daily-result-streak-bonus">
                  +{lastDailyResult?.streakBonus || streakRewardEarned} streak
                  bonus
                </div>
              )}

              {!dailyCompleted && (
                <div className="daily-missing-answers">
                  <div className="daily-missing-title">Missing answers</div>

                  <div className="daily-missing-list">
                    {dailyAnswers.map((answer, index) => {
                      const found = foundAnswers.includes(answer);

                      return (
                        <div
                          key={getAnswerKey(answer, index)}
                          className={`daily-missing-row ${
                            found ? "found" : "missed"
                          }`}
                        >
                          <span>#{index + 1}</span>
                          <strong>{formatAnswerWithValue(answer)}</strong>
                          <em>{found ? "Found" : "Missed"}</em>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : isMockMultiplayer ? (
            <div className="multiplayer-result-content">
              <div className="daily-result-badge">MULTIPLAYER RESULT</div>
              <h3>{multiplayerWon ? "You Win" : "You Lose"}</h3>

              <div className="versus-card">
                <div>
                  <span><BKIcon name="profile" size={22} /> You</span>
                  <strong>{score}</strong>
                </div>

                <div className="versus-divider">VS</div>

                <div>
                  <span><BKIcon name="multiplayer" size={22} /> Opponent</span>
                  <strong>{opponentScore}</strong>
                </div>
              </div>

              <p className="multiplayer-result-note">Match complete.</p>
            </div>
          ) : (
            <>
              {!showingGeneralXp ? (
                <>
                  <p><BKIcon name="dailyStreak" size={22} /> Final Score: {score}</p>
                  <p><BKIcon name="rankings" size={22} /> Best Score: {highScore}</p>
                  {score > runStartHighScore && (
                    <div className="general-run-highscore compact">
                      <strong>New Highscore!</strong>
                      <span>{score} is your new best</span>
                    </div>
                  )}
                  {gameMode === "general" && (
                    <div className="general-run-xp-total compact">
                      <span>XP earned this run</span>
                      <strong>+{generalRunXpTotal} XP</strong>
                    </div>
                  )}
                </>
              ) : (
                <motion.div
                  className="general-run-xp-summary"
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.12, duration: 0.24 }}
                >
                  <div className="level-progress-hero inline">
                    <div className="level-progress-icon">
                      <LevelIcon levelId={playerLevel.id} size={64} />
                    </div>
                    <div>
                      <div className="level-progress-label">
                        Level {playerLevel.levelNumber}
                      </div>
                      <h3>{playerLevel.name}</h3>
                      <p>{xpTotal.toLocaleString()} XP total</p>
                    </div>
                  </div>

                  <div className="level-progress-track">
                    <div
                      className="level-progress-fill"
                      style={{ width: `${progressionView.objectiveProgress}%` }}
                    />
                  </div>

                  {score > runStartHighScore && (
                    <div className="general-run-highscore">
                      <strong>New Highscore!</strong>
                      <span>
                        +{generalRunXpSummary.highscore || getGeneralHighscoreXpBonus(score)} XP
                      </span>
                    </div>
                  )}

                  <div className="general-run-xp-line">
                    <span>Correct answers</span>
                    <strong>+{generalRunXpSummary.correct} XP</strong>
                  </div>

                  {generalRunXpSummary.streak > 0 && (
                    <div className="general-run-xp-line">
                      <span>Streak bonuses</span>
                      <strong>+{generalRunXpSummary.streak} XP</strong>
                    </div>
                  )}

                  {generalRunXpSummary.highscore > 0 && (
                    <div className="general-run-xp-line">
                      <span>Highscore bonus</span>
                      <strong>+{generalRunXpSummary.highscore} XP</strong>
                    </div>
                  )}

                  <div className="general-run-xp-total">
                    <span>Total XP this run</span>
                    <strong>+{generalRunXpTotal} XP</strong>
                  </div>

                  {Array.isArray(objectiveProgressUpdate?.updates) && (
                    <div className="objective-progress-list inline">
                      {objectiveProgressUpdate.updates.map((objective) => (
                        <div
                          className={`objective-progress-row ${
                            objective.complete ? "complete" : ""
                          }`}
                          key={objective.statKey}
                        >
                          <div className="objective-progress-row-top">
                            <strong>{objective.label}</strong>
                            <span>
                              {objective.after.toLocaleString()} /{" "}
                              {objective.required.toLocaleString()}
                            </span>
                          </div>
                          <div className="objective-progress-bar">
                            <div
                              className="objective-progress-fill"
                              style={{ width: `${objective.afterProgress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          {!showingGeneralXp && !isDaily && !isMockMultiplayer && reviveCost && coins >= reviveCost && (
            <button className="play-again-button" onClick={revive}>
              <BKIcon name="lives" size={22} /> Buy extra life — {reviveCost} coins
            </button>
          )}

          {!showingGeneralXp && !isDaily && !isMockMultiplayer && revivesUsed >= 3 && (
            <div className="revive-note">Max revives used</div>
          )}

          {!showingGeneralXp &&
            !isDaily &&
            !isMockMultiplayer &&
            reviveCost &&
            coins < reviveCost &&
            revivesUsed < 3 && (
              <div className="revive-note">Need {reviveCost} coins for an extra life</div>
            )}

          {isMockMultiplayer ? (
            <>
              <button
                className="play-again-button"
                onClick={() => startMockMultiplayerMatch()}
              >
                <RotateCcw size={24} /> Play Again
              </button>

              <button
                className="play-again-button"
                onClick={() => exitToHomeSafely("mock-result-home")}
              >
                Back to Home
              </button>
            </>
          ) : (
            <button
              className="play-again-button"
              onClick={() => handleResultButton(isDaily)}
            >
              {isDaily ? (
                "COLLECT & HOME"
              ) : showingGeneralXp ? (
                "COLLECT & HOME"
              ) : isGeneralPostGame ? (
                "CONTINUE"
              ) : (
                <>
                  Back to Home
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gameStarted && !current) {
    return <SinglePlayerFeatureFallback />;
  }

  return (
    <div
      className="fullscreen-bg"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.58)), url(${quizBg})`,
      }}
    >
      {coinShopModal}
      {dailyRewardMeterModal}
      {xpToastOverlay}
      {objectiveProgressModal}
      <GameTopNav
        className="home-button"
        label="Home"
        variant="home"
        onClick={() => {
          playClickSound();
          restart();
        }}
      />

      <AnimatePresence>
        {rewardPopup && (
          <Modal
            title={`${rewardPopup.streak} streak`}
            variant="reward"
            showClose={false}
            cardClassName="bk-reward-card"
            onClose={() => {}}
          >
            <div className="bk-reward-summary">
              <div>
                <span>Streak</span>
                <strong>
                  <BKIcon name="dailyStreak" size={22} /> {rewardPopup.streak}
                </strong>
              </div>
              <div>
                <span>Coins</span>
                <strong>
                  <BKIcon name="coins" size={22} /> +{rewardPopup.coins}
                </strong>
              </div>
            </div>

            <Button
              onClick={() => {
                playClickSound();
                collectReward();
              }}
              fullWidth
            >
              Collect
            </Button>
          </Modal>
        )}
      </AnimatePresence>

      <div className="hud-row neon-stats-grid">
        <div className="hud-card statCard">
          <span className="hud-label">SCORE</span>
          <span className="hud-value"><BKIcon name="dailyStreak" size={22} /> {score}</span>
        </div>

        <div className="hud-card statCard">
          <span className="hud-label">BEST</span>
          <span className="hud-value"><BKIcon name="rankings" size={22} /> {highScore}</span>
        </div>

        <button className="hud-card hud-button statCard" type="button" onClick={openCoinShop}>
          <span className="hud-label">COINS</span>
          <span className="hud-value"><BKIcon name="coins" size={22} /> {coins}</span>
        </button>

        <div className="hud-card statCard">
          <span className="hud-label">
            {gameMode === "general" && !isMockMultiplayer ? "COMBO" : "LIVES"}
          </span>
          <span className="hud-value">
            {gameMode === "general" && !isMockMultiplayer
              ? (
                  <>
                    <BKIcon name="dailyStreak" size={20} /> x{streak}
                  </>
                )
              : Array.from({ length: lives }).map((_, i) => (
                  <BKIcon key={i} name="lives" size={20} />
                ))}
          </span>
        </div>
      </div>

      {!isMockMultiplayer && ["world-cup", "career"].includes(gameMode) && (
        <div className="quiz-progress-card progressCard">
          <div className="quiz-progress-top">
            <strong>LEVEL {playerLevel.levelNumber} XP</strong>
            <span>
              {getModeLabel(gameMode)} • Question {currentRoundQuestionNumber}
            </span>
          </div>
          <div className="quiz-progress-track">
            <div
              className="quiz-progress-fill"
              style={{ width: `${xpProgressPercent}%` }}
            />
          </div>
          <div className="quiz-progress-xp-label">
            <span>{xpProgressLabel}</span>
            <span>
              {playerLevel.next
                ? `Next: ${playerLevel.next.name}`
                : "Max level"}
            </span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -25 }}
          transition={{ duration: 0.25 }}
        >
          {isTimedQuestion && (
            <div
              className={`hard-timer ${
                current.difficulty === "Very Hard" ? "very-hard" : ""
              } ${timeLeft <= 3 ? "danger" : ""}`}
            >
              {timeLeft}s
            </div>
          )}

          {gameMode === "career" ? (
            <CareerPathQuestionView question={current.question} />
          ) : (
            <h1
              className={`question-title quiz-question-card ${
                gameMode === "world-cup" ? "world-cup-question-card" : ""
              } neonGlassCard`}
            >
              {current.question}
            </h1>
          )}

          {gameMode === "career" || gameMode === "world-cup" ? (
            <>
              <GuessInput
                answerType={gameMode === "career" ? "player" : "text"}
                value={textAnswer}
                onTextChange={setTextAnswer}
                selectedPlayer={careerSelectedPlayer}
                onSelectPlayer={setCareerSelectedPlayer}
                onSubmit={submitTextAnswer}
                placeholder={
                  gameMode === "world-cup"
                    ? "Type your answer..."
                    : "Search player or type full name..."
                }
                disabled={Boolean(selected)}
                buttonLabel="Guess"
                rowClassName={`career-answer-box ${
                  gameMode === "career" ? "career-premium-answer" : ""
                }`}
                inputClassName="career-input"
                buttonClassName="career-submit-button"
                maxSuggestions={4}
              />

              {selected && (
                <div
                  className={`career-feedback ${
                    isCorrectAnswer(selected, current.answer)
                      ? "correct"
                      : "wrong"
                  }`}
                >
                  {isCorrectAnswer(selected, current.answer) ? (
                    <>CORRECT! {current.answer}</>
                  ) : (
                    <>Correct answer: {current.answer}</>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`answers-grid ${
                  gameMode === "world-cup" ? "world-cup-answer-grid" : ""
                } neonAnswerGrid`}
              >
                {current.options.map((option) => {
                  const isCorrect = option === current.answer;
                  const isChosen = selected === option;
                  const showCorrect = selected && isCorrect;
                  const showWrong = selected && isChosen && !isCorrect;

                  return (
                    <button
                      key={option}
                      onClick={() => {
                        playClickSound();
                        chooseAnswer(option);
                      }}
                      className={`answer-button ${
                        showCorrect ? "correct" : showWrong ? "wrong" : ""
                      } neonAnswerButton`}
                    >
                      <span>{option}</span>
                      {showCorrect && <CheckCircle2 size={28} />}
                      {showWrong && <XCircle size={28} />}
                    </button>
                  );
                })}
              </div>
              <div className="quiz-xp-inline-slot">
                <AnimatePresence>
                  {xpToast && xpToast.placement === "inline" && (
                    <motion.div
                      key={xpToast.key}
                      className={`quiz-xp-inline-toast ${
                        xpToast.amount > 5 ? "bonus" : ""
                      }`}
                      initial={{ opacity: 0, y: 10, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <span>XP</span>
                      <strong>+{xpToast.amount}</strong>
                      <em>{xpToast.label || "Progress"}</em>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
