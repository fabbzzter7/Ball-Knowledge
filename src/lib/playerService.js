import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { STARTER_PLAYERS } from "../data/starterPlayers";

const PLAYER_SELECT =
  "id,name,search_name,aliases,nationality,position,position_group,birth_year,active_from,active_to,is_retired,clubs,main_clubs,national_team,image_url,difficulty,popularity_score";

export function normalizePlayerSearch(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlayer(player = {}) {
  return {
    ...player,
    aliases: Array.isArray(player.aliases) ? player.aliases : [],
    clubs: Array.isArray(player.clubs) ? player.clubs : [],
    main_clubs: Array.isArray(player.main_clubs) ? player.main_clubs : [],
    popularity_score: Number(player.popularity_score) || 0,
  };
}

function getPlayerSearchFields(player = {}) {
  const aliases = Array.isArray(player.aliases) ? player.aliases : [];
  const name = normalizePlayerSearch(player.name);

  return {
    name,
    nameTokens: name.split(" ").filter(Boolean),
    searchName: normalizePlayerSearch(player.search_name || player.name),
    aliases: aliases.map(normalizePlayerSearch),
  };
}

function getPopularityBucket(player) {
  const popularity = Number(player.popularity_score) || 0;

  if (popularity > 900) return 0;
  if (popularity > 650) return 1;
  if (popularity > 350) return 2;
  return 3;
}

function scorePlayerMatch(player, query) {
  const fields = getPlayerSearchFields(player);
  if (!query) return { rank: 100, popularity: Number(player.popularity_score) || 0 };
  const popularity = Number(player.popularity_score) || 0;

  const aliasExact = fields.aliases.some((alias) => alias === query);
  const aliasStarts = fields.aliases.some((alias) => alias.startsWith(query));
  const aliasIncludes = fields.aliases.some((alias) => alias.includes(query));
  const lastNameStarts = fields.nameTokens.some((token, index) => {
    if (index === 0 || token.length < 2) return false;
    return token.startsWith(query);
  });

  let rank = 99;

  if (fields.name === query || fields.searchName === query) rank = 0;
  else if (aliasExact) rank = 1;
  else if (lastNameStarts && popularity > 900) rank = 2;
  else if (fields.name.startsWith(query) || fields.searchName.startsWith(query)) rank = 3;
  else if (lastNameStarts) rank = 4;
  else if (fields.name.includes(query) || fields.searchName.includes(query)) rank = 5;
  else if (aliasStarts) rank = 6;
  else if (aliasIncludes) rank = 7;

  return {
    rank,
    popularity,
    popularityBucket: getPopularityBucket(player),
  };
}

function sortAndLimitPlayers(players, query, limit) {
  const normalizedQuery = normalizePlayerSearch(query);
  const uniquePlayers = new Map();

  players.filter(Boolean).forEach((player) => {
    if (player.id && !uniquePlayers.has(player.id)) {
      uniquePlayers.set(player.id, normalizePlayer(player));
    }
  });

  return [...uniquePlayers.values()]
    .map((player) => ({
      player,
      score: scorePlayerMatch(player, normalizedQuery),
    }))
    .filter(({ score }) => !normalizedQuery || score.rank < 99)
    .sort(
      (a, b) =>
        a.score.rank - b.score.rank ||
        a.score.popularityBucket - b.score.popularityBucket ||
        b.score.popularity - a.score.popularity ||
        a.player.name.localeCompare(b.player.name)
    )
    .slice(0, limit)
    .map(({ player }) => player);
}

export async function fetchPlayers(limit = 30) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Could not fetch players", error);
    return [];
  }

  return (data || []).map(normalizePlayer);
}

export async function searchPlayers(query, limit = 8) {
  const normalizedQuery = normalizePlayerSearch(query);
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return { players: [], error: null };
  }
  if (!isSupabaseConfigured || !supabase) {
    return { players: [], error: null };
  }

  try {
    const wildcard = `%${normalizedQuery.replace(/[%_]/g, "")}%`;
    const candidateLimit = Math.max(50, limit * 6);
    const { data: directMatches, error: directError } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .or(`name.ilike.${wildcard},search_name.ilike.${wildcard}`)
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(candidateLimit);

    if (directError) {
      console.error("Could not search players", directError);
      return { players: [], error: directError };
    }

    return {
      players: sortAndLimitPlayers(directMatches || [], normalizedQuery, limit),
      error: null,
    };
  } catch (error) {
    console.error("Player search failed", error);
    return { players: [], error };
  }
}

export async function fetchPlayerById(id) {
  if (!id || !isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Could not fetch player by id", error);
    return null;
  }

  return data ? normalizePlayer(data) : null;
}

export async function upsertStarterPlayersIfEmpty() {
  if (!isSupabaseConfigured || !supabase) {
    return { inserted: 0, skipped: true, error: new Error("Supabase is not configured") };
  }

  const { data: existingPlayers, error: countError } = await supabase
    .from("players")
    .select("id")
    .limit(1);

  if (countError) {
    console.error("Could not inspect players table", countError);
    return { inserted: 0, skipped: false, error: countError };
  }

  if ((existingPlayers || []).length > 0) {
    return { inserted: 0, skipped: true, error: null };
  }

  const { error } = await supabase.from("players").upsert(STARTER_PLAYERS, {
    onConflict: "id",
  });

  if (error) {
    console.error("Could not seed starter players", error);
    return { inserted: 0, skipped: false, error };
  }

  return { inserted: STARTER_PLAYERS.length, skipped: false, error: null };
}
