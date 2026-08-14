export default function StatGrid({ items, className = "" }) {
  return (
    <div className={["bk-stat-grid", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <div className="bk-stat-grid__item" key={item.label}>
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          <strong>{item.value}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}
