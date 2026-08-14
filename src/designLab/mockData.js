export const mockPlayer = {
  name: "Fandersson",
  avatar: "FA",
  level: 8,
  levelName: "Football Pundit",
  nextLevel: "Tactics Reader",
  xp: 7420,
  xpTarget: 9000,
  coins: 1280,
  streak: 11,
  rank: "Top 7%",
};

export const mockModes = [
  {
    id: "general",
    label: "General Knowledge",
    eyebrow: "Featured",
    description: "Fast questions across clubs, players and eras.",
    stat: "20 Q",
    accent: "lime",
  },
  {
    id: "career",
    label: "Career Path",
    eyebrow: "Player IQ",
    description: "Trace the clubs and spot the career.",
    stat: "15 Q",
    accent: "teal",
  },
  {
    id: "world-cup",
    label: "World Cup",
    eyebrow: "Global",
    description: "Tournament memories under pressure.",
    stat: "20 Q",
    accent: "gold",
  },
  {
    id: "connections",
    label: "Connections",
    eyebrow: "Pattern Play",
    description: "Find the hidden football groups.",
    stat: "4x4",
    accent: "coral",
  },
  {
    id: "who",
    label: "Who Am I?",
    eyebrow: "Clues",
    description: "Reveal the player before the crowd does.",
    stat: "5 clues",
    accent: "violet",
  },
  {
    id: "find",
    label: "Find the Player",
    eyebrow: "Scout",
    description: "Use distance clues to close in.",
    stat: "6 tries",
    accent: "blue",
  },
];

export const mockQuestion = {
  number: 7,
  total: 20,
  score: 580,
  streak: 5,
  lives: 2,
  timer: 12,
  prompt: "Which player scored the winning goal in the 2014 World Cup final?",
  options: ["Thomas Müller", "Mario Götze", "Toni Kroos", "Miroslav Klose"],
  selected: "Mario Götze",
  feedback: "Correct. First touch, finish, history.",
};

export const mockObjectives = [
  { label: "Win 3 General Knowledge runs", value: 2, target: 3 },
  { label: "Keep a 10-question streak", value: 10, target: 10 },
  { label: "Earn 2,000 XP this week", value: 1460, target: 2000 },
];
