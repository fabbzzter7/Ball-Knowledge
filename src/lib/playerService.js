import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { STARTER_PLAYERS } from "../data/starterPlayers";

const PLAYER_SELECT =
  "id,name,search_name,aliases,nationality,position,position_group,birth_year,active_from,active_to,is_retired,clubs,main_clubs,national_team,image_url,difficulty,popularity_score,source,source_id";

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

function uniqueByNormalized(values = []) {
  const seen = new Set();

  return values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizePlayerSearch(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getPlayerDedupeKey(player = {}) {
  const name = normalizePlayerSearch(player.name || player.search_name);
  if (!name) return player.id || "";

  const birthYear = Number(player.birth_year) || "";
  return birthYear ? `${name}|${birthYear}` : name;
}

function getManualSourceScore(player = {}) {
  return /^manual_(legend|modern|cult|retired|seed)/i.test(player.source || "") ? 1 : 0;
}

function getDataRichness(player = {}) {
  return (
    (Array.isArray(player.main_clubs) ? player.main_clubs.length : 0) * 3 +
    (Array.isArray(player.clubs) ? player.clubs.length : 0) * 2 +
    (Array.isArray(player.aliases) ? player.aliases.length : 0) +
    (player.national_team ? 1 : 0) +
    (player.position ? 1 : 0)
  );
}

function pickBetterPlayer(current, incoming) {
  if (!current) return incoming;

  const manualDelta = getManualSourceScore(incoming) - getManualSourceScore(current);
  if (manualDelta !== 0 && getDataRichness(incoming) >= getDataRichness(current)) {
    return manualDelta > 0 ? incoming : current;
  }

  const richnessDelta = getDataRichness(incoming) - getDataRichness(current);
  if (Math.abs(richnessDelta) >= 3) return richnessDelta > 0 ? incoming : current;

  const popularityDelta =
    (Number(incoming.popularity_score) || 0) -
    (Number(current.popularity_score) || 0);
  if (popularityDelta !== 0) return popularityDelta > 0 ? incoming : current;

  return current;
}

function mergeDuplicatePlayers(players = []) {
  const byActualPlayer = new Map();

  players.filter(Boolean).forEach((rawPlayer) => {
    const player = normalizePlayer(rawPlayer);
    const key = getPlayerDedupeKey(player) || player.id;
    if (!key) return;

    const existing = byActualPlayer.get(key);
    const winner = pickBetterPlayer(existing, player);
    const loser = winner === player ? existing : player;

    byActualPlayer.set(key, {
      ...winner,
      aliases: uniqueByNormalized([
        winner?.name,
        ...(winner?.aliases || []),
        loser?.name,
        ...(loser?.aliases || []),
      ]),
      clubs: uniqueByNormalized([...(winner?.clubs || []), ...(loser?.clubs || [])]),
      main_clubs: uniqueByNormalized([
        ...(winner?.main_clubs || []),
        ...(loser?.main_clubs || []),
      ]),
      popularity_score: Math.max(
        Number(winner?.popularity_score) || 0,
        Number(loser?.popularity_score) || 0
      ),
    });
  });

  return [...byActualPlayer.values()];
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

  return mergeDuplicatePlayers(players)
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

export async function fetchFindPlayerPool() {
  if (!isSupabaseConfigured || !supabase) return { players: [], error: null };

  const batchSize = 1000;
  const allPlayers = [];

  for (let from = 0; ; from += batchSize) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .not("birth_year", "is", null)
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error("Could not fetch Find the Player pool", error);
      return { players: [], error };
    }

    allPlayers.push(...(data || []));

    if (!data || data.length < batchSize) break;
  }

  const players = allPlayers
    .map(normalizePlayer)
    .filter(
      (player) =>
        player.id &&
        player.name &&
        (player.nationality || player.national_team) &&
        (player.position_group || player.position)
    );

  return { players, error: null };
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
