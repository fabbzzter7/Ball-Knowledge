const DEFAULT_AVATAR_EMOJI = "⚽";
const DEFAULT_AVATAR_STYLE = "classic";
const DEFAULT_AVATAR_COLOR = "green";
const DEFAULT_AVATAR_BG = "dark";

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
  highScore = 0,
  coins = 0,
  dailyStreak = 0,
}) {
  const safeUsername = username || "ball.knowledge";

  return {
    id: playerId,
    username: safeUsername,
    display_name: safeUsername,
    avatar_emoji: avatarEmoji || DEFAULT_AVATAR_EMOJI,
    avatar_icon: avatarEmoji || DEFAULT_AVATAR_EMOJI,
    avatar_style: DEFAULT_AVATAR_STYLE,
    avatar_color: DEFAULT_AVATAR_COLOR,
    avatar_bg: DEFAULT_AVATAR_BG,
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
    xp_total,
    level_id,
    level_up_claimed_ids,
    progression_stats,
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
    xp_total,
    level_id,
    level_up_claimed_ids,
    progression_stats,
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
    message.includes("xp_total") ||
    message.includes("level_id") ||
    message.includes("level_up_claimed_ids") ||
    message.includes("progression_stats") ||
    message.includes("schema cache")
  );
}
