import {
  fetchAllPlayers,
  formatPlayerLine,
  getNameBirthKey,
  getSupabaseClient,
  toArray,
  uniqueStrings,
} from "./playerDataUtils.js";

const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
const MANUAL_SOURCE_PRIORITY = ["manual_legend", "manual_modern", "manual_cult", "manual_retired", "manual_"];

function sourceScore(player) {
  const source = String(player.source || "");
  return MANUAL_SOURCE_PRIORITY.some((prefix) => source.startsWith(prefix)) ? 1000 : 0;
}

function completenessScore(player) {
  return (
    toArray(player.aliases).length * 6 +
    toArray(player.clubs).length * 4 +
    toArray(player.main_clubs).length * 8 +
    (player.nationality ? 3 : 0) +
    (player.position ? 3 : 0) +
    (player.birth_year ? 3 : 0)
  );
}

function choosePrimary(group) {
  return [...group].sort(
    (a, b) =>
      sourceScore(b) - sourceScore(a) ||
      completenessScore(b) - completenessScore(a) ||
      (Number(b.popularity_score) || 0) - (Number(a.popularity_score) || 0) ||
      toArray(b.aliases).length - toArray(a.aliases).length ||
      toArray(b.clubs).length + toArray(b.main_clubs).length -
        (toArray(a.clubs).length + toArray(a.main_clubs).length)
  )[0];
}

function mergeIntoPrimary(primary, group) {
  const aliases = uniqueStrings([
    ...toArray(primary.aliases),
    ...group.map((player) => player.name),
    ...group.flatMap((player) => toArray(player.aliases)),
  ]);
  const clubs = uniqueStrings(group.flatMap((player) => toArray(player.clubs)));
  const mainClubs = uniqueStrings(group.flatMap((player) => toArray(player.main_clubs)));
  const popularityScore = Math.max(
    ...group.map((player) => Number(player.popularity_score) || 0)
  );

  return {
    ...primary,
    aliases,
    clubs,
    main_clubs: mainClubs,
    popularity_score: popularityScore,
    nationality: primary.nationality || group.find((player) => player.nationality)?.nationality || null,
    position: primary.position || group.find((player) => player.position)?.position || null,
    position_group:
      primary.position_group ||
      group.find((player) => player.position_group)?.position_group ||
      "Unknown",
    birth_year: primary.birth_year || group.find((player) => player.birth_year)?.birth_year || null,
    national_team:
      primary.national_team ||
      group.find((player) => player.national_team)?.national_team ||
      primary.nationality ||
      null,
    source: primary.source,
    source_id: primary.source_id || primary.id,
  };
}

function groupDefiniteDuplicates(players) {
  const groups = new Map();

  players.forEach((player) => {
    const key = getNameBirthKey(player);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(player);
  });

  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

async function applyMerge(supabase, primary, duplicates) {
  const { error: updateError } = await supabase
    .from("players")
    .upsert([primary], { onConflict: "id" });

  if (updateError) throw updateError;

  const duplicateIds = duplicates.map((player) => player.id);
  const { error: deleteError } = await supabase
    .from("players")
    .delete()
    .in("id", duplicateIds);

  if (deleteError) throw deleteError;
}

const supabase = getSupabaseClient();
const players = await fetchAllPlayers(supabase);
const groups = groupDefiniteDuplicates(players);

console.log(`Mode: ${mode === "apply" ? "APPLY" : "DRY RUN"}`);
console.log(`Fetched players: ${players.length}`);
console.log(`Definite duplicate groups: ${groups.length}`);

let plannedDeletes = 0;
let appliedGroups = 0;
const errors = [];

for (const [key, group] of groups) {
  const primary = choosePrimary(group);
  const mergedPrimary = mergeIntoPrimary(primary, group);
  const duplicates = group.filter((player) => player.id !== primary.id);

  if (duplicates.length === 0) {
    console.log(`Manual review needed for ${key}: duplicate rows share the same id only.`);
    continue;
  }

  plannedDeletes += duplicates.length;
  console.log("");
  console.log(`Duplicate group: ${key}`);
  console.log(`Primary: ${formatPlayerLine(primary)}`);
  duplicates.forEach((player) => console.log(`Delete after primary update: ${formatPlayerLine(player)}`));
  console.log(
    `Merged aliases=${mergedPrimary.aliases.length}, clubs=${mergedPrimary.clubs.length}, main_clubs=${mergedPrimary.main_clubs.length}, popularity=${mergedPrimary.popularity_score}`
  );

  if (mode === "apply") {
    try {
      await applyMerge(supabase, mergedPrimary, duplicates);
      appliedGroups += 1;
    } catch (error) {
      console.error(`Failed to merge ${key}`, error);
      errors.push({ key, error });
    }
  }
}

console.log("");
console.log("Merge summary");
console.log(`Mode: ${mode}`);
console.log(`Groups reviewed: ${groups.length}`);
console.log(`Duplicate rows planned for delete: ${plannedDeletes}`);
console.log(`Groups applied: ${appliedGroups}`);
console.log(`Errors: ${errors.length}`);

if (mode !== "apply") {
  console.log("No database changes were made. Run with --apply to update/delete clear duplicates.");
}

if (errors.length > 0) process.exitCode = 1;
