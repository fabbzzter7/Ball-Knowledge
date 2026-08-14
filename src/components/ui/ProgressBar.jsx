export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueLabel,
  variant = "primary",
  className = "",
}) {
  const safeMax = Number(max) > 0 ? Number(max) : 100;
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  const percent = safeValue / safeMax;

  return (
    <div
      className={["bk-progress", `bk-progress--${variant}`, className].filter(Boolean).join(" ")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-label={label}
    >
      {(label || valueLabel) && (
        <div className="bk-progress__label">
          {label && <span className="bk-type-caption">{label}</span>}
          {valueLabel && <span className="bk-type-caption">{valueLabel}</span>}
        </div>
      )}
      <div className="bk-progress__track">
        <div className="bk-progress__fill" style={{ transform: `scaleX(${percent})` }} />
      </div>
    </div>
  );
}
