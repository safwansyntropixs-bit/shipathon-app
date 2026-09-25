import * as Notifications from "expo-notifications";

// Called ONLY when a workout is completed.
// Pushes the reminder forward to TOMORROW at 18:00.
export async function scheduleStreakReminder() {
  try {
    // 1. Cancellation Rule: Destroy any existing scheduled streak reminders
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 2. Scheduling Logic & Timezone Strictness
    const targetDate = new Date();
    // Move to tomorrow
    targetDate.setDate(targetDate.getDate() + 1);
    // Set strictly to 18:00 (6:00 PM) local device time
    targetDate.setHours(18, 0, 0, 0);

    // 3. Schedule the new notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Keep your momentum alive 🔥",
        body: "Consistency is everything. Log a quick session before midnight to secure today's win",
        data: { route: "home" },
        sound: true,
      },
      trigger: {
        type: 'date' as const,
        date: targetDate,
      } as Notifications.NotificationTriggerInput,
    });
    
    console.log("Streak reminder successfully scheduled for tomorrow:", targetDate.toLocaleString());
  } catch (error) {
    console.error("Failed to schedule streak reminder:", error);
  }
}

// Called on App Startup.
// If the OS has NO scheduled reminders, it schedules one based on the current time.
export async function initializeStreakReminder() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    if (scheduled.length === 0) {
      console.log("No streak reminders found in OS. Bootstrapping initial reminder...");
      const targetDate = new Date();
      
      // If it's already past 18:00 (6:00 PM) today, schedule it for tomorrow instead
      if (targetDate.getHours() >= 18) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      targetDate.setHours(18, 0, 0, 0);

      // 3. Schedule the new notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Keep your momentum alive 🔥",
          body: "Consistency is everything. Log a quick session before midnight to secure today's win",
          data: { route: "home" },
          sound: true,
        },
        trigger: {
          type: 'date' as const,
          date: targetDate,
        } as Notifications.NotificationTriggerInput,
      });

      console.log("Streak reminder bootstrapped for:", targetDate.toLocaleString());
    }
  } catch (error) {
    console.error("Failed to bootstrap streak reminder:", error);
  }
}
