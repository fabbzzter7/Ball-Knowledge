export default function EmptyState({
  icon,
  title,
  children,
  action,
  className = "",
}) {
  return (
    <div className={["bk-empty-state", className].filter(Boolean).join(" ")}>
      {icon && <div className="bk-empty-state__icon" aria-hidden="true">{icon}</div>}
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action && <div className="bk-empty-state__action">{action}</div>}
    </div>
  );
}
