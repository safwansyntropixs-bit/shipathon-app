export const LEVELS = [
  { rank: 1, name: "Rookie", minXp: 0 },
  { rank: 2, name: "Beginner", minXp: 500 },
  { rank: 3, name: "Amateur", minXp: 1500 },
  { rank: 4, name: "Athlete", minXp: 3000 },
  { rank: 5, name: "Warrior", minXp: 5000 },
  { rank: 6, name: "Gladiator", minXp: 7500 },
  { rank: 7, name: "Spartan", minXp: 10500 },
  { rank: 8, name: "Titan", minXp: 14000 },
  { rank: 9, name: "Demigod", minXp: 18000 },
  { rank: 10, name: "Olympian", minXp: 25000 },
];

export const BADGES: Record<string, any> = {
  "Rookie": require("../assets/quest_badges/Rookie_badge.png"),
  "Beginner": require("../assets/quest_badges/Beginner_badge.png"),
  "Amateur": require("../assets/quest_badges/Amateur_badge.png"),
  "Athlete": require("../assets/quest_badges/Athlete_badge.png"),
  "Warrior": require("../assets/quest_badges/Warrior_badge.png"),
  "Gladiator": require("../assets/quest_badges/Gladiator_badge.png"),
  "Spartan": require("../assets/quest_badges/Spartan_badge.png"),
  "Titan": require("../assets/quest_badges/Titan_badge.png"),
  "Demigod": require("../assets/quest_badges/Demigod_badge.png"),
  "Olympian": require("../assets/quest_badges/Olympian_badge.png"),
};

export const getRankTheme = (rank: number) => {
  if (rank <= 2) return { name: 'BRONZE', color: '#CD7F32' };
  if (rank <= 4) return { name: 'SILVER', color: '#C0C0C0' };
  if (rank <= 6) return { name: 'GOLD', color: '#FFD700' };
  if (rank <= 8) return { name: 'PLATINUM', color: '#E5E4E2' };
  return { name: 'MYTHIC', color: '#B533FF' };
};

// Dynamically calculates level, allowing infinite progression past Level 10
export const calculateLevelFromXp = (xp: number): number => {
  if (xp < 25000) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= LEVELS[i].minXp) return LEVELS[i].rank;
    }
    return 1;
  } else {
    // Infinite Paragon: +1 Level for every 5,000 XP past 25,000
    const excessXp = xp - 25000;
    const paragonLevels = Math.floor(excessXp / 5000);
    return 10 + paragonLevels;
  }
};
