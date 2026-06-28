import { useEffect, useState } from "react";
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
  findThePlayer: UserRound,
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

export default function BKIcon({
  name,
  size = 32,
  className = "",
  style,
  alt,
}) {
  const src = BK_ICONS[name] || BK_ICONS.questionMark;
  const [imageFailed, setImageFailed] = useState(false);
  const FallbackIcon = FALLBACK_ICON_BY_NAME[name] || CircleHelp;

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (!src || imageFailed) {
    return (
      <FallbackIcon
        className={["bk-icon", "bk-icon-fallback", className].filter(Boolean).join(" ")}
        width={size}
        height={size}
        aria-label={alt || name || "icon"}
        style={{
          width: size,
          height: size,
          display: "block",
          ...style,
        }}
        strokeWidth={2.4}
      />
    );
  }

  return (
    <img
      className={["bk-icon", className].filter(Boolean).join(" ")}
      src={src}
      alt={alt || name || "icon"}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        ...style,
      }}
      draggable="false"
      onError={() => setImageFailed(true)}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth === 0) setImageFailed(true);
      }}
    />
  );
}
