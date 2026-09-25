import { Friend } from "./../types/friends.types";
import { LeaderboardUser } from "./../types/leaderboard.types";
import { WorkoutSession } from "./../types/workout.types";

export const MOCK_HISTORY: WorkoutSession[] = [
  {
    id: "1",
    exercise: "Split Squat",
    date: "Today, 08:30",
    reps: 24,
    duration: "04:15",
    volume: "1,200 kg",
    accuracy: 94,
  },
  {
    id: "2",
    exercise: "Push-up",
    date: "Yesterday, 17:40",
    reps: 45,
    duration: "03:10",
    volume: "BW",
    accuracy: 88,
  },
  {
    id: "3",
    exercise: "Plank",
    date: "July 14, 11:20",
    reps: 1, // 1 set
    duration: "02:00",
    volume: "BW",
    accuracy: 98,
  },
  {
    id: "4",
    exercise: "Split Squat",
    date: "July 12, 09:15",
    reps: 30,
    duration: "05:30",
    volume: "1,500 kg",
    accuracy: 91,
  },
  {
    id: "5",
    exercise: "Push-up",
    date: "July 10, 18:05",
    reps: 35,
    duration: "02:50",
    volume: "BW",
    accuracy: 85,
  },
];

export const MOCK_FRIENDS: Friend[] = [
  {
    id: "1",
    name: "Noah Sterling",
    avatar: "NS",
    active: true,
    streak: 15,
    lastActive: "In Flow State",
    points: 12500,
  },
  {
    id: "2",
    name: "Emma Lind",
    avatar: "EL",
    active: true,
    streak: 8,
    lastActive: "Just Finished Squats",
    points: 9800,
  },
  {
    id: "3",
    name: "Lucas Vester",
    avatar: "LV",
    active: false,
    streak: 4,
    lastActive: "2h ago",
    points: 7400,
  },
  {
    id: "4",
    name: "Freja Holm",
    avatar: "FH",
    active: false,
    streak: 12,
    lastActive: "1d ago",
    points: 11200,
  },
];

export const MOCK_LEADERBOARD: LeaderboardUser[] = [
  { rank: 1, name: "Noah Sterling", avatar: "NS", score: 12500 },
  { rank: 2, name: "Freja Holm", avatar: "FH", score: 11200 },
  { rank: 3, name: "Emma Lind", avatar: "EL", score: 9800 },
  {
    rank: 4,
    name: "Jack Vester (You)",
    avatar: "JK",
    score: 8750,
    isCurrentUser: true,
  },
  { rank: 5, name: "Lucas Vester", avatar: "LV", score: 7400 },
  { rank: 6, name: "Sofia Green", avatar: "SG", score: 6200 },
];

export const EXERCISE_INFO = {
  pushup: {
    name: "Push-up",
    description: "Perfect alignment of neck, spine, and lower back.",
    target: 20,
    tip: "Keep your elbows tucked at a 45-degree angle.",
  },
  squat: {
    name: "Split Squat",
    description: "Even distribution, knee tracking, upright spine.",
    target: 15,
    tip: "Ensure your front knee does not pass your toes.",
  },
  plank: {
    name: "Plank",
    description: "Active core retention, neutral neck, strong shoulders.",
    target: 60, // 60 seconds
    tip: "Push the floor away through your forearms.",
  },
};
