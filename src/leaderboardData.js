const MOCK_LEADERBOARD_ROWS = {
  daily: {
    general: [
      { username: "ball.knowledge", score: 42 },
      { username: "sunday.scout", score: 31 },
      { username: "goal.guru", score: 24 },
      { username: "press.machine", score: 21 },
      { username: "touchline.tactico", score: 18 },
      { username: "kit.room", score: 16 },
      { username: "away.days", score: 15 },
      { username: "false.nine", score: 13 },
      { username: "clean.sheet", score: 11 },
      { username: "matchday.mind", score: 9 },
    ],
    "world-cup": [
      { username: "worldcup.wiz", score: 38 },
      { username: "finals.fan", score: 29 },
      { username: "goal.guru", score: 22 },
      { username: "golden.boot", score: 20 },
      { username: "group.stage", score: 18 },
      { username: "extra.time", score: 16 },
      { username: "penalty.king", score: 14 },
      { username: "knockout.nerd", score: 12 },
      { username: "host.nation", score: 10 },
      { username: "cup.collector", score: 8 },
    ],
  },
  allTime: {
    general: [
      { username: "ball.knowledge", score: 142 },
      { username: "sunday.scout", score: 117 },
      { username: "goal.guru", score: 96 },
      { username: "press.machine", score: 88 },
      { username: "touchline.tactico", score: 81 },
      { username: "false.nine", score: 73 },
      { username: "away.days", score: 66 },
      { username: "clean.sheet", score: 58 },
      { username: "kit.room", score: 51 },
      { username: "matchday.mind", score: 44 },
    ],
    "world-cup": [
      { username: "worldcup.wiz", score: 121 },
      { username: "finals.fan", score: 104 },
      { username: "ball.knowledge", score: 88 },
      { username: "golden.boot", score: 79 },
      { username: "group.stage", score: 71 },
      { username: "extra.time", score: 63 },
      { username: "penalty.king", score: 55 },
      { username: "knockout.nerd", score: 47 },
      { username: "host.nation", score: 40 },
      { username: "cup.collector", score: 34 },
    ],
  },
};

const LEADERBOARD_MEDALS = ["🥇", "🥈", "🥉"];

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function decorateRows(rows) {
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    medal: LEADERBOARD_MEDALS[index] || null,
  }));
}

export function getMockLeaderboard({ tab, mode, username, highScore }) {
  // TODO Supabase fetch:
  // Fetch leaderboard scores by leaderboard_type and mode.
  // Expected fields: username, mode, score, leaderboard_type, created_at.
  const leaderboardType = tab === "allTime" ? "all_time" : "daily";
  const mockRows = MOCK_LEADERBOARD_ROWS[tab]?.[mode] || [];
  const rows = decorateRows(mockRows.slice(0, 10));

  // TODO Supabase submit:
  // Submit local score after eligible games with username, mode, score,
  // leaderboard_type, and created_at. Do not submit mock scores here.
  const cleanUsername = username?.trim() || "you";
  const existingCurrentUser = rows.find(
    (row) => normalizeName(row.username) === normalizeName(cleanUsername)
  );

  const currentUserRow = existingCurrentUser || {
    username: cleanUsername,
    mode,
    score: highScore,
    leaderboard_type: leaderboardType,
    created_at: new Date().toISOString(),
    isCurrentUser: true,
  };

  return {
    rows,
    currentUserRow: {
      ...currentUserRow,
      isCurrentUser: true,
    },
  };
}
