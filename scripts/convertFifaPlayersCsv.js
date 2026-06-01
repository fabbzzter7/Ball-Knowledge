import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const preferredInputPath = path.join(projectRoot, "data", "fifa_players.csv");
const fallbackInputPath = path.join(projectRoot, "src", "data", "fifa_players.csv");
const inputPath = fs.existsSync(preferredInputPath)
  ? preferredInputPath
  : fallbackInputPath;
const outputDir = path.join(projectRoot, "data");
const jsonOutputPath = path.join(outputDir, "players_import.json");
const csvOutputPath = path.join(outputDir, "players_import.csv");
const EXPORT_LIMIT = 3000;
const CURRENT_YEAR = new Date().getFullYear();

const POSITION_GROUPS = {
  GK: "Goalkeeper",
  CB: "Defence",
  RB: "Defence",
  LB: "Defence",
  RWB: "Defence",
  LWB: "Defence",
  DF: "Defence",
  CDM: "Midfield",
  CM: "Midfield",
  CAM: "Midfield",
  LM: "Midfield",
  RM: "Midfield",
  MF: "Midfield",
  LW: "Attack",
  RW: "Attack",
  CF: "Attack",
  ST: "Attack",
  FW: "Attack",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] || "").trim();
    });
    return record;
  });

  return { headers, records };
}

function normalizeSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return normalizeSearch(text).replace(/\s+/g, "_").replace(/_+/g, "_");
}

function uniqueStrings(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeSearch(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getValue(record, candidates) {
  for (const key of candidates) {
    if (record[key]) return record[key];
  }
  return "";
}

function toNumber(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getBirthYear(record) {
  const birthDate = getValue(record, ["birth_date", "dob", "date_of_birth"]);
  if (birthDate) {
    const match = birthDate.match(/(\d{4})/);
    if (match) return Number(match[1]);

    const parsed = new Date(birthDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  }

  const age = toNumber(getValue(record, ["age"]));
  return age > 0 ? CURRENT_YEAR - age : null;
}

function getPositionGroup(positionText) {
  const positions = String(positionText || "")
    .split(/[,\s/|]+/)
    .map((position) => position.trim().toUpperCase())
    .filter(Boolean);

  for (const position of positions) {
    if (POSITION_GROUPS[position]) return POSITION_GROUPS[position];
  }

  return "Unknown";
}

function getAliases(record, name, fullName) {
  const aliases = [name, fullName];
  const normalizedFull = normalizeSearch(fullName);
  const normalizedShort = normalizeSearch(name);

  if (fullName && normalizedFull !== normalizedShort) {
    const words = fullName.split(/\s+/).filter(Boolean);
    const lastName = words.at(-1);
    if (lastName && lastName.length > 2) aliases.push(lastName);
  }

  return uniqueStrings(aliases);
}

function getPopularityScore(record) {
  const overall = toNumber(getValue(record, ["overall_rating", "overall"]));
  const potential = toNumber(getValue(record, ["potential"]));
  const reputation = toNumber(
    getValue(record, ["international_reputation(1-5)", "international_reputation"])
  );
  const valueEuro = toNumber(getValue(record, ["value_euro", "value"]));
  const nationalTeam = getValue(record, ["national_team"]);
  const scaledValue = valueEuro > 0 ? Math.min(420, Math.log10(valueEuro + 1) * 58) : 0;

  return Math.round(
    overall * 10 +
      potential +
      reputation * 80 +
      scaledValue +
      (nationalTeam ? 100 : 0)
  );
}

function getDifficulty(popularityScore) {
  if (popularityScore >= 1700) return "Easy";
  if (popularityScore >= 1300) return "Medium";
  return "Hard";
}

function getClub(record) {
  return getValue(record, [
    "club",
    "team",
    "club_name",
    "current_club",
    "club_team",
    "club_team_name",
  ]);
}

function toPlayer(record, idCounts) {
  const fullName = getValue(record, ["full_name"]);
  const shortName = getValue(record, ["name"]);
  const name = fullName || shortName;
  if (!name) return null;

  const birthYear = getBirthYear(record);
  const aliases = getAliases(record, shortName, fullName || shortName);
  const searchName = uniqueStrings([name, ...aliases]).map(normalizeSearch).join(" ");
  if (!searchName) return null;

  const baseId = slugify([name, birthYear].filter(Boolean).join(" ")) || "player";
  const nextCount = (idCounts.get(baseId) || 0) + 1;
  idCounts.set(baseId, nextCount);
  const id = nextCount === 1 ? baseId : `${baseId}_${nextCount}`;

  const club = getClub(record);
  const clubs = club ? [club] : [];
  const nationalTeam = getValue(record, ["national_team"]) || getValue(record, ["nationality"]) || null;
  const popularityScore = getPopularityScore(record);
  const sourceId =
    getValue(record, ["id", "player_id", "sofifa_id", "fifa_id"]) || id;

  return {
    id,
    name,
    search_name: searchName,
    aliases,
    nationality: getValue(record, ["nationality"]) || null,
    position: getValue(record, ["positions"]) || null,
    position_group: getPositionGroup(getValue(record, ["positions"])),
    birth_year: birthYear,
    active_from: null,
    active_to: null,
    is_retired: false,
    clubs,
    main_clubs: clubs,
    national_team: nationalTeam,
    image_url: null,
    difficulty: getDifficulty(popularityScore),
    popularity_score: popularityScore,
    source: "fifa_players_csv",
    source_id: String(sourceId),
  };
}

function escapeCsvCell(value) {
  const normalized = Array.isArray(value) ? JSON.stringify(value) : value;
  if (normalized === null || normalized === undefined) return "";
  const text = String(normalized);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(players) {
  const fields = [
    "id",
    "name",
    "search_name",
    "aliases",
    "nationality",
    "position",
    "position_group",
    "birth_year",
    "active_from",
    "active_to",
    "is_retired",
    "clubs",
    "main_clubs",
    "national_team",
    "image_url",
    "difficulty",
    "popularity_score",
    "source",
    "source_id",
  ];

  const lines = [
    fields.join(","),
    ...players.map((player) =>
      fields.map((field) => escapeCsvCell(player[field])).join(",")
    ),
  ];

  fs.writeFileSync(csvOutputPath, `${lines.join("\n")}\n`);
}

if (!fs.existsSync(inputPath)) {
  throw new Error(
    `Could not find fifa_players.csv at ${preferredInputPath} or ${fallbackInputPath}`
  );
}

fs.mkdirSync(outputDir, { recursive: true });

const csvText = fs.readFileSync(inputPath, "utf8");
const parsedRows = parseCsv(csvText);
const { headers, records } = rowsToObjects(parsedRows);
const idCounts = new Map();
const players = records
  .map((record) => toPlayer(record, idCounts))
  .filter(Boolean)
  .filter((player) => player.aliases.length > 0)
  .filter((player) =>
    ["Goalkeeper", "Defence", "Midfield", "Attack", "Unknown"].includes(
      player.position_group
    )
  );

const duplicateIdsFixed = [...idCounts.values()].reduce(
  (total, count) => total + Math.max(0, count - 1),
  0
);
const exportedPlayers = [...players]
  .sort((a, b) => b.popularity_score - a.popularity_score || a.name.localeCompare(b.name))
  .slice(0, EXPORT_LIMIT);

fs.writeFileSync(jsonOutputPath, `${JSON.stringify(exportedPlayers, null, 2)}\n`);
writeCsv(exportedPlayers);

console.log("CSV columns found:");
console.log(headers.join(", "));
console.log("");
console.log(`Input file: ${path.relative(projectRoot, inputPath)}`);
console.log(`Total rows read: ${records.length}`);
console.log(`Valid players: ${players.length}`);
console.log(`Exported players: ${exportedPlayers.length}`);
console.log(`Duplicate IDs fixed: ${duplicateIdsFixed}`);
console.log("");
console.log("Sample top 10 players:");
exportedPlayers.slice(0, 10).forEach((player, index) => {
  console.log(
    `${index + 1}. ${player.name} (${player.nationality || "Unknown"}) - ${player.popularity_score}`
  );
});
console.log("");
console.log(`Wrote ${path.relative(projectRoot, jsonOutputPath)}`);
console.log(`Wrote ${path.relative(projectRoot, csvOutputPath)}`);
