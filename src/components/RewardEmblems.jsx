import { Coins, Flame } from "lucide-react";

export function CoinEmblem({ size = 22, className = "", ...props }) {
  return (
    <Coins
      className={className}
      size={size}
      aria-hidden="true"
      {...props}
    />
  );
}

export function StreakEmblem({ size = 22, className = "", ...props }) {
  return (
    <Flame
      className={className}
      size={size}
      aria-hidden="true"
      {...props}
    />
  );
}
