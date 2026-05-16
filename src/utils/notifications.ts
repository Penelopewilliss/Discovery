/**
 * Notification helpers.
 * expo-notifications requires a development build — these are safe no-ops in Expo Go.
 */

export async function scheduleLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, unknown>
): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title: _title, body: _body, data: _data ?? {} },
      trigger: null,
    });
  } catch (_) {}
}

export async function scheduleDelayedPostNotification(
  destination: string,
  delaySeconds: number
): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✈️ Your post is now live!',
        body: `Your travel memory from ${destination} has been shared with your followers.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        repeats: false,
      },
    });
  } catch (_) {}
}
