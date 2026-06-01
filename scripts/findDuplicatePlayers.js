import { LEGEND_PLAYERS } from "../src/data/legendsPlayers.js";
import {
  fetchAllPlayers,
  formatPlayerLine,
  getAliasBirthKeys,
  getNameBirthKey,
  getSupabaseClient,
  normalizeKey,
} from "./playerDataUtils.js";

function addToGroup(map, key, player) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(player);
}

function printGroup(title, key, players) {
  console.log("");
  console.log(`${title}: ${key}`);
  players.forEach((player) => console.log(`  - ${formatPlayerLine(player)}`));
}

function getDuplicateGroups(players) {
  const byName = new Map();
  const byNameBirth = new Map();
  const byAliasBirth = new Map();

  players.forEach((player) => {
    addToGroup(byName, normalizeKey(player.name), player);
    addToGroup(byNameBirth, getNameBirthKey(player), player);
    getAliasBirthKeys(player).forEach((key) => addToGroup(byAliasBirth, key, player));
  });

  const nameGroups = [...byName.entries()].filter(([, group]) => group.length > 1);
  const nameBirthGroups = [...byNameBirth.entries()].filter(([, group]) => group.length > 1);
  const aliasBirthGroups = [...byAliasBirth.entries()].filter(([, group]) => {
    const ids = new Set(group.map((player) => player.id));
    return ids.size > 1;
  });

  return { nameGroups, nameBirthGroups, aliasBirthGroups };
}

function inspectLocalLegendDuplicates() {
  const byId = new Map();
  const duplicateIds = new Set();

  LEGEND_PLAYERS.forEach((player) => {
    if (byId.has(player.id)) duplicateIds.add(player.id);
    byId.set(player.id, player);
  });

  console.log(`Local LEGEND_PLAYERS rows: ${LEGEND_PLAYERS.length}`);
  console.log(`Local duplicate ids: ${duplicateIds.size}`);
  [...duplicateIds].forEach((id) => console.log(`  - ${id}`));
}

const supabase = getSupabaseClient();
const players = await fetchAllPlayers(supabase);
const { nameGroups, nameBirthGroups, aliasBirthGroups } = getDuplicateGroups(players);

console.log(`Fetched players: ${players.length}`);
inspectLocalLegendDuplicates();
console.log("");
console.log(`Same normalized name groups: ${nameGroups.length}`);
console.log(`Same normalized name + birth_year groups: ${nameBirthGroups.length}`);
console.log(`Alias/name overlap + birth_year groups: ${aliasBirthGroups.length}`);

nameBirthGroups.forEach(([key, group]) =>
  printGroup("DEFINITE duplicate group, same name + birth year", key, group)
);
nameGroups.forEach(([key, group]) =>
  printGroup("LIKELY duplicate group, same normalized name", key, group)
);
aliasBirthGroups.forEach(([key, group]) =>
  printGroup("LIKELY duplicate group, alias/name overlap + birth year", key, group)
);
