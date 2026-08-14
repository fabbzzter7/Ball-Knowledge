import { useState } from "react";
import {
  CircleHelp,
  Heart,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import { BK_ICONS } from "../assets/icons";

const FALLBACK_ICON_BY_NAME = {
  coins: UserRound,
  dailyChallenge: Trophy,
  dailyStreak: Trophy,
  generalKnowledge: Trophy,
  careerPath: Trophy,
  worldCup: Trophy,
  connections: CircleHelp,
  whoAmI: UserRound,
  lives: Heart,
  multiplayer: UsersRound,
  profile: UserRound,
  rankings: Trophy,
  singlePlayer: UserRound,
  playNow: UsersRound,
  h2h: UsersRound,
  league: Trophy,
  activeMatches: UsersRound,
  activeRandomMatches: UsersRound,
  createMatch: UsersRound,
  joinMatch: UsersRound,
  myLeagues: Trophy,
  joinLeague: Trophy,
};

const BADGE_ICON_NAMES = new Set([
  "activeMatches",
  "activeRandomMatches",
  "careerPath",
  "classic",
  "coins",
  "connections",
  "createLeague",
  "createMatch",
  "custom",
  "dailyChallenge",
  "dailyMix",
  "dailyStreak",
  "generalKnowledge",
  "h2h",
  "joinLeague",
  "joinMatch",
  "league",
  "lives",
  "multiplayer",
  "myLeagues",
  "partyMode",
  "playNow",
  "profile",
  "questionMark",
  "rankings",
  "singlePlayer",
  "startNewRandomMatch",
  "whoAmI",
  "worldCup",
  "level01ZeroBallKnowledge",
  "level02CasualViewer",
  "level03MatchdayFan",
  "level04FootballFollower",
  "level05BallKnowledgeRookie",
  "level06SharpObserver",
  "level07TacticsReader",
  "level08FootballPundit",
  "level09BallKnowledgeExpert",
  "level10EliteAnalyst",
  "level11FootballScholar",
  "level12LegendaryPundit",
  "level13EliteBallKnowledge",
]);

const BADGE_SCALE_BY_NAME = {
  activeMatches: 1.16,
  activeRandomMatches: 1.08,
  createLeague: 1.1,
  createMatch: 1.14,
  dailyChallenge: 1.17,
  joinLeague: 1.1,
  joinMatch: 1.14,
  multiplayer: 1.1,
  singlePlayer: 1.08,
  startNewRandomMatch: 1.14,
  level01ZeroBallKnowledge: 1.22,
  level02CasualViewer: 1.12,
  level05BallKnowledgeRookie: 1.12,
  level07TacticsReader: 1.18,
  level10EliteAnalyst: 1.08,
};

export default function BKIcon({
  name,
  size = 32,
  className = "",
  style,
  alt,
}) {
  const src = BK_ICONS[name] || BK_ICONS.questionMark;
  const [failedSrc, setFailedSrc] = useState("");
  const FallbackIcon = FALLBACK_ICON_BY_NAME[name] || CircleHelp;
  const imageFailed = failedSrc === src;
  const isBadgeIcon = BADGE_ICON_NAMES.has(name);
  const iconSize = isBadgeIcon
    ? `var(--bk-icon-badge-size, var(--bk-icon-art-size, ${size}px))`
    : `var(--bk-icon-art-size, ${size}px)`;
  const badgeScale = BADGE_SCALE_BY_NAME[name] || 1;

  if (!src || imageFailed) {
    return (
      <FallbackIcon
        className={["bk-icon", "bk-icon--glyph", "bk-icon-fallback", className].filter(Boolean).join(" ")}
        width={size}
        height={size}
        aria-label={alt || name || "icon"}
        style={{
          width: iconSize,
          height: iconSize,
          display: "block",
          ...style,
        }}
        strokeWidth={2.4}
      />
    );
  }

  return (
    <img
      className={["bk-icon", isBadgeIcon ? "bk-icon--badge" : "bk-icon--glyph", className]
        .filter(Boolean)
        .join(" ")}
      src={src}
      alt={alt || name || "icon"}
      width={size}
      height={size}
      style={{
        width: iconSize,
        height: iconSize,
        objectFit: "contain",
        display: "block",
        "--bk-icon-badge-scale": badgeScale,
        ...style,
      }}
      draggable="false"
      onError={() => setFailedSrc(src)}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth === 0) setFailedSrc(src);
      }}
    />
  );
}
