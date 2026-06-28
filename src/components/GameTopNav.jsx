import { ArrowLeft, Home } from "lucide-react";

export default function GameTopNav({
  onClick,
  label = "Back",
  variant = "back",
  className = "",
  ...buttonProps
}) {
  const Icon = variant === "home" ? Home : ArrowLeft;

  return (
    <button
      type="button"
      className={["game-top-nav", className].filter(Boolean).join(" ")}
      onClick={onClick}
      {...buttonProps}
      aria-label={buttonProps["aria-label"] || label}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
