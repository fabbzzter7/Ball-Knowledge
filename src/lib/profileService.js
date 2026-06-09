const DEFAULT_AVATAR_EMOJI = "⚽";
const DEFAULT_AVATAR_STYLE = "classic";
const DEFAULT_AVATAR_COLOR = "green";
const DEFAULT_AVATAR_BG = "dark";
const DEFAULT_FAVORITE_COUNTRY = "Argentina";
const DEFAULT_FAVORITE_FLAG = "🇦🇷";

function createLocalPlayerId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreatePlayerId() {
  const savedPlayerId = localStorage.getItem("ballKnowledgePlayerId");

  if (savedPlayerId) return savedPlayerId;

  const playerId = createLocalPlayerId();
  localStorage.setItem("ballKnowledgePlayerId", playerId);

  return playerId;
}

export function getDefaultProfile({
  playerId,
  username,
  avatarEmoji = DEFAULT_AVATAR_EMOJI,
  favoriteCountry = DEFAULT_FAVORITE_COUNTRY,
  favoriteFlag = DEFAULT_FAVORITE_FLAG,
  highScore = 0,
  coins = 0,
  dailyStreak = 0,
}) {
  const safeUsername = username || "ball.knowledge";

  return {
    id: playerId,
    username: safeUsername,
    username_normalized: safeUsername.trim().toLowerCase(),
    display_name: safeUsername,
    avatar_emoji: avatarEmoji || DEFAULT_AVATAR_EMOJI,
    avatar_icon: avatarEmoji || DEFAULT_AVATAR_EMOJI,
    avatar_style: DEFAULT_AVATAR_STYLE,
    avatar_color: DEFAULT_AVATAR_COLOR,
    avatar_bg: DEFAULT_AVATAR_BG,
    favorite_country: favoriteCountry || DEFAULT_FAVORITE_COUNTRY,
    favorite_flag: favoriteFlag || DEFAULT_FAVORITE_FLAG,
    best_score: highScore,
    coins,
    daily_streak: dailyStreak,
    multiplayer_wins: 0,
    multiplayer_losses: 0,
    multiplayer_draws: 0,
    multiplayer_matches: 0,
    xp_total: 0,
    level_id: 1,
    level_up_claimed_ids: [],
    progression_stats: {
      best_general_score: highScore,
      daily_challenges_completed: 0,
      best_daily_score: 0,
      whoami_solved: 0,
      connections_completed: 0,
      find_player_solved: 0,
      h2h_matches_completed: 0,
      h2h_wins: 0,
      league_days_completed: 0,
    },
  };
}

export function mergeLocalProgressIntoProfile(profile = {}, local = {}) {
  const nextStats = {
    ...(profile.progression_stats || {}),
    ...(local.progressionStats || {}),
  };

  return {
    best_score: Math.max(Number(profile.best_score) || 0, Number(local.highScore) || 0),
    coins: Math.max(Number(profile.coins) || 0, Number(local.coins) || 0),
    daily_streak: Math.max(
      Number(profile.daily_streak) || 0,
      Number(local.dailyStreak) || 0
    ),
    xp_total: Math.max(Number(profile.xp_total) || 0, Number(local.xpTotal) || 0),
    level_id: Math.max(Number(profile.level_id) || 1, Number(local.levelId) || 1),
    progression_stats: nextStats,
    avatar_emoji: local.avatarEmoji || profile.avatar_emoji || "⚽",
    avatar_icon: local.avatarEmoji || profile.avatar_icon || "⚽",
    avatar_style: profile.avatar_style || "classic",
    avatar_color: profile.avatar_color || "green",
    avatar_bg: profile.avatar_bg || "dark",
    favorite_country:
      local.favoriteCountry || profile.favorite_country || DEFAULT_FAVORITE_COUNTRY,
    favorite_flag: local.favoriteFlag || profile.favorite_flag || DEFAULT_FAVORITE_FLAG,
  };
}

export async function fetchProfile(supabase, playerId) {
  if (!supabase || !playerId) return { profile: null, error: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  return { profile: data || null, error };
}

export async function createProfile(supabase, profile) {
  const { data, error } = await supabase
    .from("profiles")
    .insert(profile)
    .select()
    .single();

  if (!error || !isMissingAvatarColumnError(error)) {
    return { profile: data || null, error };
  }

  const {
    avatar_icon,
    avatar_style,
    avatar_color,
    avatar_bg,
    favorite_country,
    favorite_flag,
    xp_total,
    level_id,
    level_up_claimed_ids,
    progression_stats,
    username_normalized,
    ...legacyProfile
  } = profile;

  const retry = await supabase
    .from("profiles")
    .insert(legacyProfile)
    .select()
    .single();

  return { profile: retry.data || null, error: retry.error };
}

export async function updateProfile(supabase, playerId, updates) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId)
    .select()
    .single();

  if (!error || !isMissingAvatarColumnError(error)) {
    return { profile: data || null, error };
  }

  const {
    avatar_icon,
    avatar_style,
    avatar_color,
    avatar_bg,
    favorite_country,
    favorite_flag,
    xp_total,
    level_id,
    level_up_claimed_ids,
    progression_stats,
    username_normalized,
    ...legacyUpdates
  } = updates;

  if (Object.keys(legacyUpdates).length === 0) {
    return { profile: null, error };
  }

  const retry = await supabase
    .from("profiles")
    .update({
      ...legacyUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId)
    .select()
    .single();

  return { profile: retry.data || null, error: retry.error };
}

export async function syncLocalStatsToProfile(
  supabase,
  playerId,
  { highScore, coins, dailyStreak }
) {
  return updateProfile(supabase, playerId, {
    best_score: highScore,
    coins,
    daily_streak: dailyStreak,
  });
}

function isMissingAvatarColumnError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("avatar_icon") ||
    message.includes("avatar_style") ||
    message.includes("avatar_color") ||
    message.includes("avatar_bg") ||
    message.includes("favorite_country") ||
    message.includes("favorite_flag") ||
    message.includes("xp_total") ||
    message.includes("level_id") ||
    message.includes("level_up_claimed_ids") ||
    message.includes("progression_stats") ||
    message.includes("username_normalized") ||
    message.includes("schema cache")
  );
}
