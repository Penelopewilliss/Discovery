/**
 * Notification helpers.
 * expo-notifications requires a development build on Android — these are safe no-ops in Expo Go.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** True when running inside the Expo Go client (not a standalone / dev-client build) */
const isExpoGo = Constants.appOwnership === 'expo';

/** Dynamically import expo-notifications, skipping entirely in Expo Go on Android */
async function loadNotifications() {
  if (isExpoGo && Platform.OS === 'android') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // getExpoPushTokenAsync requires a development build (not Expo Go)
    // It will throw in Expo Go — caught below
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token to Firestore so server can send push notifications
    const { db } = await import('../firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', userId), { pushToken: token });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    return token;
  } catch (_) {
    return null;
  }
}

export async function scheduleLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, unknown>
): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
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
    const Notifications = await loadNotifications();
    if (!Notifications) return;
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
