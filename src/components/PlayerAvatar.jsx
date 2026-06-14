import BKIcon from "./BKIcon";

const DEFAULT_AVATAR = {
  avatar_icon: "profile",
  avatar_emoji: "profile",
  avatar_style: "classic",
  avatar_color: "green",
  avatar_bg: "dark",
  favorite_country: "Argentina",
  favorite_flag: "🇦🇷",
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
    country:
      profile.favorite_country ||
      profile.country ||
      profile.nation ||
      DEFAULT_AVATAR.favorite_country,
    flag:
      profile.favorite_flag ||
      profile.flag ||
      profile.nation_flag ||
      DEFAULT_AVATAR.favorite_flag,
  };
}

export default function PlayerAvatar({
  profile,
  size = "medium",
  className = "",
  button = false,
  onClick,
  label = "Player avatar",
  hideFlag = false,
}) {
  const avatar = getAvatarConfig(profile);
  const Component = button ? "button" : "div";
  const useProfileIcon = !avatar.icon || ["profile", "⚽", "⏳"].includes(avatar.icon);

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
      <span className="player-avatar-icon">
        {useProfileIcon ? <BKIcon name="profile" size={size === "large" ? 42 : size === "small" ? 22 : 30} /> : avatar.icon}
      </span>
      {!hideFlag && avatar.flag && (
        <span className="player-avatar-flag" aria-label={avatar.country}>
          {avatar.flag}
        </span>
      )}
    </Component>
  );
}
