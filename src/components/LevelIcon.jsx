import BKIcon from "./BKIcon";

export const LEVEL_ICON_BY_ID = {
  1: "level01ZeroBallKnowledge",
  2: "level02CasualViewer",
  3: "level03MatchdayFan",
  4: "level04FootballFollower",
  5: "level05BallKnowledgeRookie",
  6: "level06SharpObserver",
  7: "level07TacticsReader",
  8: "level08FootballPundit",
  9: "level09BallKnowledgeExpert",
  10: "level10EliteAnalyst",
  11: "level11FootballScholar",
  12: "level12LegendaryPundit",
  13: "level13EliteBallKnowledge",
};

export default function LevelIcon({
  levelId,
  size = 42,
  className = "",
  style,
}) {
  const iconName = LEVEL_ICON_BY_ID[Number(levelId)] || "questionMark";

  return (
    <BKIcon
      name={iconName}
      size={size}
      className={className}
      style={style}
      alt={`Level ${levelId || ""} icon`.trim()}
    />
  );
}
