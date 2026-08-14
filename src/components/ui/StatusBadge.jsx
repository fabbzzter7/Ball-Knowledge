export default function StatusBadge({
  children,
  tone = "neutral",
  className = "",
}) {
  return (
    <span className={["bk-status-badge", `bk-status-badge--${tone}`, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
