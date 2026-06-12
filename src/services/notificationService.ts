/**
 * services/notificationService.ts
 * --------------------------------
 * Handles registration for Expo Push Notifications and sending dispatches.
 *
 * Saves the token to /users/{uid}/pushToken in Firestore.
 * Dispatches notifications via Expo's Push API HTTPS endpoint.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers the device for push notifications, retrieves the token,
 * and persists it to the user's Firestore document.
 */
export async function registerForPushNotificationsAsync(uid: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    if (__DEV__) {
      console.log('[NotificationService] Must use a physical device for Push Notifications');
    }
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[NotificationService] Permission not granted for push notifications.');
      return null;
    }

    // Retrieve EAS projectId from Expo Config
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[NotificationService] EAS projectId not found in configuration. Push notifications will be disabled.');
      return null;
    }

    // Android requires google-services.json to initialize the Firebase App natively for FCM
    if (Platform.OS === 'android' && !Constants.expoConfig?.android?.googleServicesFile) {
      console.warn(
        '[NotificationService] Android push notifications require a valid google-services.json. ' +
        'Please download it from your Firebase Console, place it in your root directory, and configure "googleServicesFile": "./google-services.json" inside the "android" section of your app.json.'
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Persist push token to Firestore user profile
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, { pushToken: token });

    // Set up Android default channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7ADC7D',
      });
    }

    if (__DEV__) {
      console.log('[NotificationService] Push token registered:', token);
    }
    return token;
  } catch (error) {
    console.error('[NotificationService] Error during registration:', error);
    return null;
  }
}

/**
 * Sends a push notification to a user using their saved Expo push token.
 */
export async function sendPushNotification({
  to,
  title,
  body,
  data = {},
}: {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  if (Platform.OS === 'web') {
    if (__DEV__) {
      console.log('[NotificationService] Client-side push notifications are blocked by browser CORS. Use server-side triggers.');
    }
    return;
  }

  const message = {
    to,
    sound: 'default',
    title,
    body,
    data,
  };

  // Validate Expo push token format before sending — prevents silent API failures
  const isValidToken =
    to.startsWith('ExponentPushToken[') ||
    to.startsWith('ExpoPushToken[');

  if (!isValidToken) {
    if (__DEV__) {
      console.warn('[NotificationService] Skipping push — invalid token format:', to);
    }
    return;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    if (__DEV__) {
      console.log('[NotificationService] Push API response:', result);
    }
  } catch (error) {
    console.error('[NotificationService] Failed to send push notification:', error);
  }
}
