export default function AuthNotice({
  children,
  tone = "info",
  id,
  className = "",
}) {
  if (!children) return null;

  return (
    <div
      id={id}
      className={["bk-auth-notice", `bk-auth-notice--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
