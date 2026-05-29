const DEFAULT_AVATAR_EMOJI = "⚽";

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
    best_score: highScore,
    coins,
    daily_streak: dailyStreak,
    multiplayer_wins: 0,
    multiplayer_losses: 0,
    multiplayer_draws: 0,
    multiplayer_matches: 0,
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

  return { profile: data || null, error };
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

  return { profile: data || null, error };
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
