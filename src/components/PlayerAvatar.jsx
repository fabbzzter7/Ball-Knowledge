const DEFAULT_AVATAR = {
  avatar_icon: "⚽",
  avatar_emoji: "⚽",
  avatar_style: "classic",
  avatar_color: "green",
  avatar_bg: "dark",
};

export function getAvatarConfig(profile = {}) {
  return {
    icon:
      profile.avatar_icon ||
      profile.avatar_emoji ||
      profile.icon ||
      DEFAULT_AVATAR.avatar_icon,
    style: profile.avatar_style || profile.style || DEFAULT_AVATAR.avatar_style,
    color: profile.avatar_color || profile.color || DEFAULT_AVATAR.avatar_color,
    bg: profile.avatar_bg || profile.bg || DEFAULT_AVATAR.avatar_bg,
  };
}

export default function PlayerAvatar({
  profile,
  size = "medium",
  className = "",
  button = false,
  onClick,
  label = "Player avatar",
}) {
  const avatar = getAvatarConfig(profile);
  const Component = button ? "button" : "div";

  return (
    <Component
      type={button ? "button" : undefined}
      className={[
        "player-avatar",
        `player-avatar-${size}`,
        `avatar-color-${avatar.color}`,
        `avatar-bg-${avatar.bg}`,
        `avatar-style-${avatar.style}`,
        button ? "player-avatar-button" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      aria-label={button ? label : undefined}
    >
      <span className="player-avatar-shine" />
      <span className="player-avatar-accent" />
      <span className="player-avatar-icon">{avatar.icon}</span>
    </Component>
  );
}
