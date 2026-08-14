import GameTopNav from "../../components/GameTopNav";
import "./GameplayShell.css";

export function GameplayShell({
  children,
  theme = "classic",
  className = "",
  backgroundImage,
  coinShopModal,
  dailyRewardMeterModal,
  coinRewardToastOverlay,
  xpToastOverlay,
  objectiveProgressModal,
}) {
  const shellClassName = [
    "fullscreen-bg",
    "gp-shell",
    "scrollable-game-screen",
    `gp-shell--${theme}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClassName}
      style={backgroundImage ? { backgroundImage } : undefined}
    >
      {coinShopModal}
      {dailyRewardMeterModal}
      {coinRewardToastOverlay}
      {xpToastOverlay}
      {objectiveProgressModal}
      {children}
    </div>
  );
}

export function GameplayTopBar({
  label = "Exit",
  onClick,
  disabled = false,
  eyebrow,
  title,
  metaLabel,
  metaValue,
  className = "",
}) {
  return (
    <div className={["gp-topbar", className].filter(Boolean).join(" ")}>
      <GameTopNav
        className="gp-exit-button"
        label={label}
        variant="back"
        onClick={onClick}
        disabled={disabled}
      />

      <div className="gp-mode-meta">
        {eyebrow && <span>{eyebrow}</span>}
        <strong>{title}</strong>
      </div>

      {(metaLabel || metaValue) && (
        <div className="gp-round-meta">
          {metaLabel && <span>{metaLabel}</span>}
          {metaValue && <strong>{metaValue}</strong>}
        </div>
      )}
    </div>
  );
}

export function GameplayHud({ items, className = "" }) {
  return (
    <div className={["gp-hud", className].filter(Boolean).join(" ")}>
      {items.map((item) => {
        const Component = item.onClick ? "button" : "div";

        return (
          <Component
            className={["gp-hud-card", item.featured ? "is-featured" : ""]
            .filter(Boolean)
            .join(" ")}
            key={item.label}
            onClick={item.onClick}
            type={item.onClick ? "button" : undefined}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Component>
        );
      })}
    </div>
  );
}

export function GameplayXpMeter({
  levelLabel,
  progressLabel,
  nextLabel,
  progressPercent = 0,
  className = "",
}) {
  const progress = Math.max(0, Math.min(100, Number(progressPercent) || 0));

  return (
    <section
      className={["gp-xp-meter", className].filter(Boolean).join(" ")}
      aria-label="Level progress"
    >
      <div className="gp-xp-meter__top">
        <strong>{levelLabel}</strong>
        <span>{progressLabel}</span>
      </div>
      <div className="gp-xp-meter__rail" aria-hidden="true">
        <div
          className="gp-xp-meter__fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <small>{nextLabel}</small>
    </section>
  );
}
