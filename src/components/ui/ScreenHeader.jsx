export default function ScreenHeader({
  kicker,
  title,
  subtitle,
  leadingAction,
  trailingAction,
  className = "",
}) {
  return (
    <header className={["bk-screen-header", className].filter(Boolean).join(" ")}>
      {(leadingAction || trailingAction) && (
        <div className="bk-screen-header__bar">
          <div>{leadingAction}</div>
          <div>{trailingAction}</div>
        </div>
      )}

      <div className="bk-screen-header__copy">
        {kicker && <p className="bk-type-label">{kicker}</p>}
        <h1 className="bk-type-screen-title bk-screen-header__title">{title}</h1>
        {subtitle && <p className="bk-type-body">{subtitle}</p>}
      </div>
    </header>
  );
}
