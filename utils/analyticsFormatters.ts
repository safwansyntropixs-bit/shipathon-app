export type TrendType =
  | "time"
  | "workouts"
  | "accuracy"
  | "pushups"
  | "squats"
  | "planks";

export interface TrendOption {
  id: TrendType;
  label: string;
  value: string | number;
  unit: string;
}

export const formatPlankTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const formatTime = (totalSeconds: number): string => {
  if (totalSeconds === 0) return "0s";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

export const getFilterLabel = (filter: string): string => {
  switch (filter) {
    case "all":
      return "All";
    case "squat":
      return "Squats";
    case "push-up":
      return "Push-ups";
    case "plank":
      return "Planks";
    default:
      return filter;
  }
};

export const EXERCISE_FILTERS = ["all", "squat", "push-up", "plank"];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
