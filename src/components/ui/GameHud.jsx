export function GameHudItem({ label, value, icon, className = "" }) {
  return (
    <div className={["bk-game-hud__item", className].filter(Boolean).join(" ")}>
      <span className="bk-type-label">{label}</span>
      <strong className="bk-type-stat bk-game-hud__value">
        {icon}
        {value}
      </strong>
    </div>
  );
}

export default function GameHud({ children, className = "" }) {
  return (
    <div className={["bk-game-hud", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
