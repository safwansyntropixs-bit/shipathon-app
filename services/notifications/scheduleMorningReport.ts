import * as Notifications from "expo-notifications";

export async function scheduleMorningReport(
  dailyReps: number,
  dailyHoldSeconds: number,
  targetReps: number
) {
  try {
    // 1. Cancel previously scheduled morning reports
    // We use a specific identifier to avoid cancelling the streak reminder!
    await Notifications.cancelScheduledNotificationAsync("morning-report-notification");

    // 2. The Midnight Fix Logic
    const targetDate = new Date();
    const currentHour = targetDate.getHours();

    // If it's between midnight (0) and 7:59 AM, schedule for TODAY at 8:00 AM
    // If it's 8:00 AM or later, schedule for TOMORROW at 8:00 AM
    if (currentHour >= 8) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(8, 0, 0, 0);

    // 3. The Highlight Reel Logic (Dynamic Copy)
    let dynamicBody = "";

    if (dailyHoldSeconds > 60 && dailyReps >= targetReps) {
      dynamicBody = `Elite effort yesterday: ${dailyReps} reps and ${dailyHoldSeconds}s of core stabilization.`;
    } else if (dailyHoldSeconds > 60 && dailyReps < targetReps) {
      dynamicBody = `Incredible core endurance yesterday. Locking in ${dailyHoldSeconds}s of static holds is top-tier.`;
    } else if (dailyHoldSeconds <= 60 && dailyReps >= targetReps) {
      dynamicBody = `Solid volume yesterday. You hit your target with ${dailyReps} reps.`;
    } else {
      dynamicBody = `Light session yesterday. Let's push the intensity higher today.`;
    }

    // 4. Schedule the new notification with a fixed identifier
    await Notifications.scheduleNotificationAsync({
      identifier: "morning-report-notification",
      content: {
        title: "Coach's Morning Report 📋",
        body: dynamicBody,
        data: { route: "analytics" },
        sound: true,
      },
      trigger: {
        type: "date" as const,
        date: targetDate,
      } as Notifications.NotificationTriggerInput,
    });

    console.log("Morning report scheduled for:", targetDate.toLocaleString());
  } catch (error) {
    console.error("Failed to schedule morning report:", error);
  }
}
