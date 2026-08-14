export function EditorialHeader({ eyebrow, title, copy, align = "start" }) {
  return (
    <header className={`dl-editorial-header dl-editorial-header--${align}`}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      {copy && <p>{copy}</p>}
    </header>
  );
}

export function StatPill({ label, value, tone = "default" }) {
  return (
    <div className={`dl-stat-pill dl-stat-pill--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function HeroSurface({ children, className = "" }) {
  return <section className={`dl-hero-surface ${className}`}>{children}</section>;
}

export function ModeCard({ mode, featured = false }) {
  return (
    <button
      type="button"
      className={`dl-mode-card dl-mode-card--${mode.accent} ${
        featured ? "dl-mode-card--featured" : ""
      }`}
    >
      <span className="dl-mode-card__icon">{mode.label.slice(0, 2)}</span>
      <span className="dl-mode-card__body">
        <small>{mode.eyebrow}</small>
        <strong>{mode.label}</strong>
        <em>{mode.description}</em>
      </span>
      <span className="dl-mode-card__stat">{mode.stat}</span>
    </button>
  );
}

export function ProgressRail({ value, label }) {
  const percent = Math.max(0, Math.min(100, value));

  return (
    <div className="dl-progress-rail" aria-label={label}>
      <span style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  );
}
