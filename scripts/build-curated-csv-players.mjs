import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const inputPath = path.join(projectRoot, "src/data/fifa_players.csv");
const outputPath = path.join(projectRoot, "src/data/curatedCsvPlayers.js");

const CURATED_LIMIT = 3600;

function normalizeText(text = "") {
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

function uniqueByNormalized(values = []) {
  const seen = new Set();
  return values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
  return normalizeText(value).replace(/\s+/g, "_");
}

function getPositionGroup(position = "") {
  const key = String(position).toUpperCase();
  if (key === "GK") return "Goalkeeper";
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(key)) return "Defense";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(key)) return "Midfield";
  if (["LW", "RW", "CF", "ST"].includes(key)) return "Attack";
  return position || "";
}

function getRelevanceScore(row, getCell) {
  const overall = Number(getCell(row, "overall_rating")) || 0;
  const potential = Number(getCell(row, "potential")) || 0;
  const internationalReputation =
    Number(getCell(row, "international_reputation(1-5)")) || 0;
  const nationalRating = Number(getCell(row, "national_rating")) || 0;
  const valueEuro = Number(getCell(row, "value_euro")) || 0;
  const wageEuro = Number(getCell(row, "wage_euro")) || 0;
  const nationalTeam = getCell(row, "national_team");
  const nationalTeamPosition = getCell(row, "national_team_position");
  const nationalJerseyNumber = Number(getCell(row, "national_jersey_number")) || 0;

  return (
    overall * 100 +
    potential * 10 +
    internationalReputation * 850 +
    (nationalTeam ? 420 : 0) +
    (nationalTeamPosition ? 260 : 0) +
    (nationalJerseyNumber > 0 ? 120 : 0) +
    Math.min(650, nationalRating * 6) +
    Math.min(900, Math.log10(Math.max(1, valueEuro)) * 75) +
    Math.min(420, Math.log10(Math.max(1, wageEuro)) * 45)
  );
}

function buildCuratedPlayers(csvText = "") {
  const rows = String(csvText).split(/\r?\n/).filter(Boolean);
  const [headerRow, ...dataRows] = rows;
  const headers = parseCsvRow(headerRow || "");
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const getCell = (row, header) => row[indexByHeader.get(header)] || "";

  return dataRows
    .map(parseCsvRow)
    .map((row, rowIndex) => {
      const shortName = getCell(row, "name");
      const fullName = getCell(row, "full_name");
      const displayName = fullName || shortName;
      if (!displayName) return null;
      const normalizedDisplayName = normalizeText(displayName);
      const normalizedShortName = normalizeText(shortName);
      const searchName = normalizedDisplayName || normalizedShortName;
      const slugSource = searchName || `player_${rowIndex + 1}`;

      const positions = getCell(row, "positions")
        .split(",")
        .map((position) => position.trim())
        .filter(Boolean);
      const overall = Number(getCell(row, "overall_rating")) || 0;
      const internationalReputation =
        Number(getCell(row, "international_reputation(1-5)")) || 0;
      const nationalTeam = getCell(row, "national_team");
      const birthYear =
        Number(String(getCell(row, "birth_date")).split("/").at(-1)) || null;
      const relevanceScore = getRelevanceScore(row, getCell);

      return {
        id: `fifa_${slugifyPlayerId(slugSource)}`,
        name: displayName,
        full_name: fullName || displayName,
        search_name: searchName,
        aliases: uniqueByNormalized([shortName, fullName, displayName]),
        nationality: getCell(row, "nationality"),
        position: positions[0] || "",
        position_group: getPositionGroup(positions[0] || ""),
        birth_year: birthYear,
        clubs: [],
        main_clubs: [],
        national_team: nationalTeam || getCell(row, "nationality"),
        difficulty: overall >= 84 ? "Easy" : overall >= 78 ? "Medium" : "Hard",
        popularity_score: Math.round(overall * 10 + internationalReputation * 70),
        relevance_score: Math.round(relevanceScore),
        source: "fifa_csv_curated",
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.relevance_score - a.relevance_score ||
        b.popularity_score - a.popularity_score ||
        a.name.localeCompare(b.name)
    )
    .filter((player, index, players) => {
      const duplicateIndex = players.findIndex(
        (candidate) =>
          candidate.id === player.id ||
          (candidate.search_name &&
            player.search_name &&
            candidate.search_name === player.search_name &&
            candidate.birth_year === player.birth_year)
      );
      return duplicateIndex === index;
    })
    .slice(0, CURATED_LIMIT);
}

const csvText = fs.readFileSync(inputPath, "utf8");
const players = buildCuratedPlayers(csvText);
const output = `// Auto-generated from src/data/fifa_players.csv by scripts/build-curated-csv-players.mjs.\n// Keep LEGEND_PLAYERS as the curated source of truth; this is only the top CSV supplement.\nexport const CURATED_CSV_PLAYERS = ${JSON.stringify(players, null, 2)};\n\nexport const CURATED_CSV_PLAYER_COUNT = ${players.length};\n`;

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${players.length} curated CSV players to ${path.relative(projectRoot, outputPath)}`);
