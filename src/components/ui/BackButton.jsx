import GameTopNav from "../GameTopNav";

export default function BackButton({ className = "", ...props }) {
  return (
    <GameTopNav
      className={["bk-back-button", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
