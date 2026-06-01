import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { LEGEND_PLAYERS } from "../src/data/legendsPlayers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");
const BATCH_SIZE = 100;
const VALID_POSITION_GROUPS = new Set([
  "Goalkeeper",
  "Defence",
  "Midfield",
  "Attack",
  "Unknown",
]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
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

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function normalizeSearch(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [value];
}

function derivePositionGroup(position = "") {
  const text = String(position).toLowerCase();

  if (text.includes("goalkeeper") || text === "gk") return "Goalkeeper";
  if (
    text.includes("back") ||
    text.includes("defender") ||
    text.includes("defence") ||
    text.includes("defense") ||
    text.includes("sweeper") ||
    ["cb", "rb", "lb", "rwb", "lwb", "df"].some((token) => text.includes(token))
  ) {
    return "Defence";
  }
  if (
    text.includes("midfielder") ||
    text.includes("midfield") ||
    ["cdm", "cm", "cam", "lm", "rm", "mf"].some((token) => text.includes(token))
  ) {
    return "Midfield";
  }
  if (
    text.includes("striker") ||
    text.includes("forward") ||
    text.includes("winger") ||
    ["st", "cf", "lw", "rw", "fw"].some((token) => text.includes(token))
  ) {
    return "Attack";
  }

  return "Unknown";
}

function cleanPlayer(player, index) {
  const warnings = [];

  if (!player?.id) warnings.push(`row ${index + 1}: missing id`);
  if (!player?.name) warnings.push(`row ${index + 1}: missing name`);

  if (warnings.length > 0) {
    return { player: null, warnings };
  }

  const positionGroup = VALID_POSITION_GROUPS.has(player.position_group)
    ? player.position_group
    : derivePositionGroup(player.position);

  return {
    player: {
      id: String(player.id),
      name: String(player.name),
      search_name: player.search_name || normalizeSearch(player.name),
      aliases: toArray(player.aliases),
      nationality: player.nationality ?? null,
      position: player.position ?? null,
      position_group: VALID_POSITION_GROUPS.has(positionGroup)
        ? positionGroup
        : "Unknown",
      birth_year: player.birth_year ?? null,
      active_from: player.active_from ?? null,
      active_to: player.active_to ?? null,
      is_retired: player.is_retired ?? true,
      clubs: toArray(player.clubs),
      main_clubs: toArray(player.main_clubs),
      national_team: player.national_team ?? player.nationality ?? null,
      image_url: player.image_url ?? null,
      difficulty: player.difficulty || "Medium",
      popularity_score: player.popularity_score ?? 700,
      source: player.source || "manual_legend_seed",
      source_id: player.source_id || String(player.id),
    },
    warnings,
  };
}

function dedupeById(players) {
  const byId = new Map();
  const duplicateIds = new Set();

  players.forEach((player) => {
    if (byId.has(player.id)) duplicateIds.add(player.id);
    byId.set(player.id, player);
  });

  return {
    players: [...byId.values()],
    duplicateIds: [...duplicateIds],
  };
}

async function upsertInBatches(supabase, players) {
  let upserted = 0;
  const errors = [];

  for (let index = 0; index < players.length; index += BATCH_SIZE) {
    const batch = players.slice(index, index + BATCH_SIZE);
    const from = index + 1;
    const to = index + batch.length;

    console.log(`Upserting legends ${from}-${to} of ${players.length}...`);

    const { error } = await supabase
      .from("players")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`Batch ${from}-${to} failed`, error);
      errors.push({ from, to, error });
      continue;
    }

    upserted += batch.length;
  }

  return { upserted, errors };
}

loadEnvFile(envPath);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

if (!Array.isArray(LEGEND_PLAYERS)) {
  console.error("src/data/legendsPlayers.js must export LEGEND_PLAYERS as an array");
  process.exit(1);
}

const cleanedRows = LEGEND_PLAYERS.map(cleanPlayer);
const validationWarnings = cleanedRows.flatMap((result) => result.warnings);
const validBeforeDedupe = cleanedRows
  .map((result) => result.player)
  .filter(Boolean);
const skipped = LEGEND_PLAYERS.length - validBeforeDedupe.length;
const { players: cleanPlayers, duplicateIds } = dedupeById(validBeforeDedupe);

validationWarnings.forEach((warning) => console.warn(`Warning: ${warning}`));

if (duplicateIds.length > 0) {
  console.warn("Duplicate legend ids found and fixed by keeping the last row:");
  duplicateIds.forEach((id) => console.warn(`- ${id}`));
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const { upserted, errors } = await upsertInBatches(supabase, cleanPlayers);

console.log("");
console.log("Legend player upsert summary");
console.log(`Total legend players found: ${LEGEND_PLAYERS.length}`);
console.log(`Valid players: ${cleanPlayers.length}`);
console.log(`Skipped players: ${skipped}`);
console.log(`Duplicate ids fixed: ${duplicateIds.length}`);
console.log(`Upserted players: ${upserted}`);
console.log(`Errors: ${errors.length}`);

if (errors.length > 0) {
  process.exitCode = 1;
}
