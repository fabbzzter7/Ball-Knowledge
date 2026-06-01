import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, "..");

export const PLAYER_SELECT =
  "id,name,search_name,aliases,nationality,position,position_group,birth_year,active_from,active_to,is_retired,clubs,main_clubs,national_team,image_url,difficulty,popularity_score,source,source_id";

export function loadEnvFile(filePath = path.join(projectRoot, ".env.local")) {
  if (!fs.existsSync(filePath)) return;

  fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) return;

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    });
}

export function getSupabaseClient() {
  loadEnvFile();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function normalizeKey(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [value];
}

export function uniqueStrings(values) {
  const seen = new Set();

  return values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getPlayerNamesForMatching(player) {
  return uniqueStrings([player?.name, player?.search_name, ...toArray(player?.aliases)]);
}

export function getNameBirthKey(player) {
  const name = normalizeKey(player?.name);
  const birthYear = player?.birth_year || "";
  return name && birthYear ? `${name}|${birthYear}` : "";
}

export function getAliasBirthKeys(player) {
  const birthYear = player?.birth_year || "";
  if (!birthYear) return [];

  return getPlayerNamesForMatching(player)
    .map(normalizeKey)
    .filter(Boolean)
    .map((name) => `${name}|${birthYear}`);
}

export function formatPlayerLine(player) {
  const clubs = toArray(player?.main_clubs).length
    ? toArray(player.main_clubs)
    : toArray(player?.clubs);

  return [
    `${player.id} :: ${player.name}`,
    `birth=${player.birth_year ?? "?"}`,
    `pop=${player.popularity_score ?? 0}`,
    `source=${player.source || "?"}`,
    clubs.length ? `clubs=${clubs.slice(0, 4).join(" / ")}` : "clubs=-",
  ].join(" | ");
}

export async function fetchAllPlayers(supabase) {
  const pageSize = 1000;
  let from = 0;
  const players = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .range(from, to);

    if (error) throw error;

    players.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return players;
}
