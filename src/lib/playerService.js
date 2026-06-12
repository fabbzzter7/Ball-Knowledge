import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { STARTER_PLAYERS } from "../data/starterPlayers";
import { LEGEND_PLAYERS } from "../data/legendsPlayers";

const PLAYER_SELECT =
  "id,name,full_name,search_name,aliases,nationality,position,position_group,birth_year,active_from,active_to,is_retired,clubs,main_clubs,national_team,image_url,difficulty,popularity_score,source,source_id";

export function normalizePlayerSearch(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘`´']/g, "")
    .replace(/\./g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const normalizePlayerName = normalizePlayerSearch;

function normalizePlayer(player = {}) {
  return {
    ...player,
    aliases: Array.isArray(player.aliases) ? player.aliases : [],
    clubs: Array.isArray(player.clubs) ? player.clubs : [],
    main_clubs: Array.isArray(player.main_clubs) ? player.main_clubs : [],
    popularity_score: Number(player.popularity_score) || 0,
  };
}

function parseCsvRow(row = "") {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function slugifyPlayerId(value = "") {
  return normalizePlayerSearch(value).replace(/\s+/g, "_");
}

function parseFifaCsvPlayers(csvText = "") {
  const rows = String(csvText).split(/\r?\n/).filter(Boolean);
  const [headerRow, ...dataRows] = rows;
  if (!headerRow || dataRows.length === 0) return [];

  const headers = parseCsvRow(headerRow);
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const getCell = (row, header) => row[indexByHeader.get(header)] || "";

  return dataRows
    .map(parseCsvRow)
    .map((row) => {
      const shortName = getCell(row, "name");
      const fullName = getCell(row, "full_name");
      const displayName = fullName || shortName;
      if (!displayName) return null;

      const birthYear = Number(String(getCell(row, "birth_date")).split("/").at(-1)) || null;
      const positions = getCell(row, "positions")
        .split(",")
        .map((position) => position.trim())
        .filter(Boolean);
      const overall = Number(getCell(row, "overall_rating")) || 0;

      return {
        id: `fifa_${slugifyPlayerId(displayName || shortName)}`,
        name: displayName,
        full_name: fullName || displayName,
        search_name: normalizePlayerSearch(displayName),
        aliases: uniqueByNormalized([shortName, fullName, displayName]),
        nationality: getCell(row, "nationality"),
        position: positions[0] || "",
        position_group: positions[0] || "",
        birth_year: birthYear,
        clubs: [],
        main_clubs: [],
        national_team: getCell(row, "national_team") || getCell(row, "nationality"),
        popularity_score: overall ? overall * 10 : 0,
        source: "fifa_csv",
      };
    })
    .filter(Boolean);
}

const IMPORTANT_FALLBACK_PLAYERS = [
  {
    id: "ngolo_kante",
    name: "N'Golo Kante",
    full_name: "N'Golo Kanté",
    search_name: "ngolo kante",
    aliases: ["N. Kante", "N. Kanté", "N Kante", "N Golo Kante", "Kante", "Kanté"],
    nationality: "France",
    position: "Defensive midfielder",
    position_group: "Midfield",
    birth_year: 1991,
    active_from: 2012,
    active_to: null,
    clubs: ["Boulogne", "Caen", "Leicester City", "Chelsea", "Al Ittihad"],
    main_clubs: ["Leicester City", "Chelsea", "Al Ittihad"],
    national_team: "France",
    popularity_score: 980,
    source: "manual_seed",
  },
  {
    id: "sergio_aguero",
    name: "Sergio Aguero",
    full_name: "Sergio Agüero",
    search_name: "sergio aguero",
    aliases: ["Aguero", "Agüero", "Kun Aguero", "Kun Agüero"],
    nationality: "Argentina",
    position: "Striker",
    position_group: "Attack",
    birth_year: 1988,
    active_from: 2003,
    active_to: 2021,
    clubs: ["Independiente", "Atletico Madrid", "Manchester City", "Barcelona"],
    main_clubs: ["Atletico Madrid", "Manchester City"],
    national_team: "Argentina",
    popularity_score: 970,
    source: "manual_seed",
  },
  {
    id: "mesut_ozil",
    name: "Mesut Ozil",
    full_name: "Mesut Özil",
    search_name: "mesut ozil",
    aliases: ["Ozil", "Özil"],
    nationality: "Germany",
    position: "Attacking midfielder",
    position_group: "Midfield",
    birth_year: 1988,
    active_from: 2006,
    active_to: 2023,
    clubs: ["Schalke", "Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce", "Istanbul Basaksehir"],
    main_clubs: ["Real Madrid", "Arsenal"],
    national_team: "Germany",
    popularity_score: 960,
    source: "manual_seed",
  },
  {
    id: "virgil_van_dijk",
    name: "Virgil van Dijk",
    full_name: "Virgil van Dijk",
    search_name: "virgil van dijk",
    aliases: ["Van Dijk", "VVD"],
    nationality: "Netherlands",
    position: "Centre-back",
    position_group: "Defence",
    birth_year: 1991,
    active_from: 2011,
    active_to: null,
    clubs: ["Groningen", "Celtic", "Southampton", "Liverpool"],
    main_clubs: ["Celtic", "Southampton", "Liverpool"],
    national_team: "Netherlands",
    popularity_score: 965,
    source: "manual_seed",
  },
  {
    id: "gerard_pique",
    name: "Gerard Pique",
    full_name: "Gerard Piqué",
    search_name: "gerard pique",
    aliases: ["Pique", "Piqué"],
    nationality: "Spain",
    position: "Centre-back",
    position_group: "Defence",
    birth_year: 1987,
    active_from: 2004,
    active_to: 2022,
    clubs: ["Manchester United", "Real Zaragoza", "Barcelona"],
    main_clubs: ["Manchester United", "Barcelona"],
    national_team: "Spain",
    popularity_score: 940,
    source: "manual_seed",
  },
  {
    id: "andrea_pirlo",
    name: "Andrea Pirlo",
    full_name: "Andrea Pirlo",
    search_name: "andrea pirlo",
    aliases: ["Pirlo"],
    nationality: "Italy",
    position: "Midfielder",
    position_group: "Midfield",
    birth_year: 1979,
    active_from: 1995,
    active_to: 2017,
    clubs: ["Brescia", "Inter", "AC Milan", "Juventus", "New York City FC"],
    main_clubs: ["AC Milan", "Juventus"],
    national_team: "Italy",
    popularity_score: 935,
    source: "manual_seed",
  },
  {
    id: "toni_kroos",
    name: "Toni Kroos",
    full_name: "Toni Kroos",
    search_name: "toni kroos",
    aliases: ["Kroos"],
    nationality: "Germany",
    position: "Midfielder",
    position_group: "Midfield",
    birth_year: 1990,
    active_from: 2007,
    active_to: 2024,
    clubs: ["Bayern Munich", "Bayer Leverkusen", "Real Madrid"],
    main_clubs: ["Bayern Munich", "Real Madrid"],
    national_team: "Germany",
    popularity_score: 945,
    source: "manual_seed",
  },
  {
    id: "erling_haaland",
    name: "Erling Haaland",
    full_name: "Erling Haaland",
    search_name: "erling haaland",
    aliases: ["Haaland"],
    nationality: "Norway",
    position: "Striker",
    position_group: "Attack",
    birth_year: 2000,
    active_from: 2016,
    active_to: null,
    clubs: ["Bryne", "Molde", "Red Bull Salzburg", "Borussia Dortmund", "Manchester City"],
    main_clubs: ["Borussia Dortmund", "Manchester City"],
    national_team: "Norway",
    popularity_score: 990,
    source: "manual_seed",
  },
  {
    id: "paul_pogba",
    name: "Paul Pogba",
    full_name: "Paul Pogba",
    search_name: "paul pogba",
    aliases: ["Pogba"],
    nationality: "France",
    position: "Midfielder",
    position_group: "Midfield",
    birth_year: 1993,
    active_from: 2011,
    active_to: null,
    clubs: ["Manchester United", "Juventus"],
    main_clubs: ["Juventus", "Manchester United"],
    national_team: "France",
    popularity_score: 930,
    source: "manual_seed",
  },
  {
    id: "casemiro",
    name: "Casemiro",
    full_name: "Carlos Henrique Casemiro",
    search_name: "casemiro",
    aliases: ["Carlos Casemiro"],
    nationality: "Brazil",
    position: "Defensive midfielder",
    position_group: "Midfield",
    birth_year: 1992,
    active_from: 2010,
    active_to: null,
    clubs: ["Sao Paulo", "Real Madrid", "Porto", "Manchester United"],
    main_clubs: ["Real Madrid", "Manchester United"],
    national_team: "Brazil",
    popularity_score: 925,
    source: "manual_seed",
  },
  {
    id: "antoine_griezmann",
    name: "Antoine Griezmann",
    full_name: "Antoine Griezmann",
    search_name: "antoine griezmann",
    aliases: ["Griezmann"],
    nationality: "France",
    position: "Forward",
    position_group: "Attack",
    birth_year: 1991,
    active_from: 2009,
    active_to: null,
    clubs: ["Real Sociedad", "Atletico Madrid", "Barcelona", "Atletico Madrid"],
    main_clubs: ["Atletico Madrid", "Barcelona"],
    national_team: "France",
    popularity_score: 935,
    source: "manual_seed",
  },
  {
    id: "harry_kewell",
    name: "Harry Kewell",
    full_name: "Harry Kewell",
    search_name: "harry kewell",
    aliases: ["Kewell"],
    nationality: "Australia",
    position: "Winger",
    position_group: "Attack",
    birth_year: 1978,
    active_from: 1996,
    active_to: 2014,
    clubs: ["Leeds United", "Liverpool", "Galatasaray", "Melbourne Victory", "Al Gharafa", "Melbourne Heart"],
    main_clubs: ["Leeds United", "Liverpool", "Galatasaray"],
    national_team: "Australia",
    popularity_score: 760,
    source: "manual_seed",
  },
  {
    id: "claudio_marchisio",
    name: "Claudio Marchisio",
    full_name: "Claudio Marchisio",
    search_name: "claudio marchisio",
    aliases: ["Marchisio"],
    nationality: "Italy",
    position: "Midfielder",
    position_group: "Midfield",
    birth_year: 1986,
    active_from: 2005,
    active_to: 2019,
    is_retired: true,
    clubs: ["Juventus", "Empoli", "Zenit Saint Petersburg"],
    main_clubs: ["Juventus"],
    national_team: "Italy",
    popularity_score: 850,
    source: "manual_seed",
  },
  {
    id: "emmanuel_emenike",
    name: "Emmanuel Emenike",
    full_name: "Emmanuel Emenike",
    search_name: "emmanuel emenike",
    aliases: ["Emenike"],
    nationality: "Nigeria",
    position: "Striker",
    position_group: "Attack",
    birth_year: 1987,
    active_from: 2007,
    active_to: 2021,
    is_retired: true,
    clubs: ["Spartak Moscow", "Fenerbahce", "West Ham United", "Olympiacos"],
    main_clubs: ["Spartak Moscow", "Fenerbahce", "West Ham United", "Olympiacos"],
    national_team: "Nigeria",
    difficulty: "Hard",
    popularity_score: 720,
    source: "manual_cult_seed_2026",
    source_id: "emmanuel_emenike",
  },
];

const BASE_LOCAL_PLAYER_INDEX = mergeDuplicatePlayers([
  ...STARTER_PLAYERS,
  ...LEGEND_PLAYERS,
  ...IMPORTANT_FALLBACK_PLAYERS,
]).map(normalizePlayer);
let cachedSearchIndexPromise = null;
let cachedLocalPlayerIndexPromise = null;

async function loadLocalPlayerIndex() {
  if (cachedLocalPlayerIndexPromise) return cachedLocalPlayerIndexPromise;

  cachedLocalPlayerIndexPromise = (async () => {
    try {
      const csvModule = await import("../data/fifa_players.csv?raw");
      const csvPlayers = parseFifaCsvPlayers(csvModule.default || "");

      return mergeDuplicatePlayers([
        ...BASE_LOCAL_PLAYER_INDEX,
        ...csvPlayers,
      ]).map(normalizePlayer);
    } catch (error) {
      console.warn("Could not load imported CSV player index", error);
      return BASE_LOCAL_PLAYER_INDEX;
    }
  })();

  return cachedLocalPlayerIndexPromise;
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
  const name = normalizePlayerSearch(player.full_name || player.name || player.search_name);
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
        winner?.full_name,
        winner?.search_name,
        ...(winner?.aliases || []),
        loser?.name,
        loser?.full_name,
        loser?.search_name,
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
  const rawValues = uniqueByNormalized([
    player.name,
    player.full_name,
    player.search_name,
    ...aliases,
  ]);
  const searchable = uniqueByNormalized(rawValues.flatMap(getSearchVariants));
  const name = normalizePlayerSearch(player.name);

  return {
    name,
    nameTokens: name.split(" ").filter(Boolean),
    searchName: normalizePlayerSearch(player.search_name || player.full_name || player.name),
    searchable,
    aliases: aliases.flatMap(getSearchVariants).map(normalizePlayerSearch),
  };
}

function getSearchVariants(value = "") {
  const normalized = normalizePlayerSearch(value);
  if (!normalized) return [];
  const parts = normalized.split(" ").filter(Boolean);
  const variants = new Set([normalized]);
  const joinedInitialName = normalized.replace(/\b([a-z])\s+([a-z]{2,})/g, "$1$2");
  variants.add(joinedInitialName);
  variants.add(normalized.replace(/\s+/g, ""));

  if (parts.length > 1) {
    variants.add(parts.at(-1));
    variants.add(parts.slice(-2).join(" "));
    variants.add(`${parts[0]?.[0] || ""} ${parts.at(-1)}`.trim());
    variants.add(`${parts[0]?.[0] || ""} ${parts.slice(1).join(" ")}`.trim());
  }

  return [...variants].filter(Boolean);
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
  const queryCompact = query.replace(/\s+/g, "");
  const searchableExact = fields.searchable.some((value) => value === query);
  const searchableStarts = fields.searchable.some(
    (value) => value.startsWith(query) || value.replace(/\s+/g, "").startsWith(queryCompact)
  );
  const searchableIncludes = fields.searchable.some(
    (value) => value.includes(query) || value.replace(/\s+/g, "").includes(queryCompact)
  );

  const aliasExact = fields.aliases.some((alias) => alias === query);
  const aliasStarts = fields.aliases.some((alias) => alias.startsWith(query));
  const aliasIncludes = fields.aliases.some((alias) => alias.includes(query));
  const lastNameStarts = fields.nameTokens.some((token, index) => {
    if (index === 0 || token.length < 2) return false;
    return token.startsWith(query);
  });

  let rank = 99;

  if (fields.name === query || fields.searchName === query || searchableExact) rank = 0;
  else if (aliasExact) rank = 1;
  else if (lastNameStarts && popularity > 900) rank = 2;
  else if (fields.name.startsWith(query) || fields.searchName.startsWith(query) || searchableStarts) rank = 3;
  else if (lastNameStarts) rank = 4;
  else if (fields.name.includes(query) || fields.searchName.includes(query) || searchableIncludes) rank = 5;
  else if (aliasStarts) rank = 6;
  else if (aliasIncludes) rank = 7;

  return {
    rank,
    popularity,
    popularityBucket: getPopularityBucket(player),
  };
}

function getEligibleFindPlayerFallbackPool(players = BASE_LOCAL_PLAYER_INDEX) {
  return players.filter(
    (player) =>
      player.id &&
      player.name &&
      player.birth_year &&
      (player.nationality || player.national_team) &&
      (player.position_group || player.position)
  );
}

async function loadSearchPlayerIndex() {
  if (cachedSearchIndexPromise) return cachedSearchIndexPromise;

  cachedSearchIndexPromise = (async () => {
    const localPlayerIndex = await loadLocalPlayerIndex();

    if (!isSupabaseConfigured || !supabase) return localPlayerIndex;

    const batchSize = 1000;
    const allPlayers = [];

    for (let from = 0; ; from += batchSize) {
      const to = from + batchSize - 1;
      const { data, error } = await supabase
        .from("players")
        .select(PLAYER_SELECT)
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) {
        console.error("Could not build player search index", error);
        return localPlayerIndex;
      }

      allPlayers.push(...(data || []));
      if (!data || data.length < batchSize) break;
    }

    return mergeDuplicatePlayers([...allPlayers, ...localPlayerIndex]).map(normalizePlayer);
  })();

  return cachedSearchIndexPromise;
}

export async function buildPlayerSearchIndex() {
  return loadSearchPlayerIndex();
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
  const localPlayerIndex = await loadLocalPlayerIndex();
  const fallbackPool = getEligibleFindPlayerFallbackPool(localPlayerIndex);
  if (!isSupabaseConfigured || !supabase) {
    return { players: fallbackPool, error: null };
  }

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
      return { players: fallbackPool, error: null };
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

  return { players: players.length ? players : fallbackPool, error: null };
}

export async function searchPlayers(query, limit = 8) {
  const normalizedQuery = normalizePlayerSearch(query);
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return { players: [], error: null };
  }
  const searchIndex = await loadSearchPlayerIndex();
  const localMatches = sortAndLimitPlayers(searchIndex, normalizedQuery, limit);

  if (!isSupabaseConfigured || !supabase) {
    return { players: localMatches, error: null };
  }

  try {
    const wildcard = `%${normalizedQuery.replace(/[%_]/g, "")}%`;
    const candidateLimit = Math.max(50, limit * 6);
    const { data: directMatches, error: directError } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .or(`name.ilike.${wildcard},full_name.ilike.${wildcard},search_name.ilike.${wildcard}`)
      .order("popularity_score", { ascending: false, nullsFirst: false })
      .limit(candidateLimit);

    if (directError) {
      console.error("Could not search players", directError);
      return { players: localMatches, error: null };
    }

    const mergedMatches = mergeDuplicatePlayers([
      ...(directMatches || []),
      ...searchIndex,
    ]);

    return {
      players: sortAndLimitPlayers(mergedMatches, normalizedQuery, limit),
      error: null,
    };
  } catch (error) {
    console.error("Player search failed", error);
    return { players: localMatches, error: localMatches.length ? null : error };
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
