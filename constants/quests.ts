export type QuestType = "daily" | "medium" | "hard" | "weekly" | "lifetime";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  type: QuestType;
  target: number;
  icon: string;
}

export const QUESTS: Achievement[] = [
  // Daily Quests (Retention)
  { id: "morning_routine", title: "Morning Routine", description: "Do 30 Squats today", xpReward: 50, type: "daily", target: 30, icon: "Target" },
  { id: "quick_pump", title: "Quick Pump", description: "Do 30 Pushups today", xpReward: 50, type: "daily", target: 30, icon: "Flame" },
  { id: "core_activation", title: "Core Activation", description: "Hold plank for 90s", xpReward: 50, type: "daily", target: 90, icon: "Timer" },

  // Medium Quests (Standard Progress)
  { id: "leg_day_burn", title: "Leg Day Burn", description: "Do 150 Squats this week", xpReward: 150, type: "medium", target: 150, icon: "Activity" },
  { id: "chest_builder", title: "Chest Builder", description: "Do 150 Pushups this week", xpReward: 150, type: "medium", target: 150, icon: "Zap" },
  { id: "iron_core", title: "Iron Core", description: "Hold plank for 5 mins this week", xpReward: 150, type: "medium", target: 300, icon: "Shield" },

  // Hard Quests (Aspirational)
  { id: "squat_mastery", title: "Squat Mastery", description: "Do 450 Squats this month", xpReward: 300, type: "hard", target: 450, icon: "Award" },
  { id: "pushup_spartan", title: "Pushup Spartan", description: "Do 450 Pushups this month", xpReward: 300, type: "hard", target: 450, icon: "Swords" },
  { id: "titan_hold", title: "Titan Hold", description: "Hold plank for 20 mins this month", xpReward: 300, type: "hard", target: 1200, icon: "Crown" },
];
