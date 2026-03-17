import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const PUSH_TOKEN_KEY_PREFIX = "expo_push_token_v1:";

let Notifications: typeof import("expo-notifications") | null = null;

try {
  Notifications = require("expo-notifications");
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  // expo-notifications push functionality not available in Expo Go SDK 53+
}

export async function registerForPushNotifications(
  playerId: string
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Notifications) return null;

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[push] Permission not granted");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "حروف المغرب",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00F5FF",
        sound: "default",
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "f1e0f4f2-8408-4fe9-b300-c8d8fb573b4d",
    });
    const token = tokenData.data;

    const cacheKey = `${PUSH_TOKEN_KEY_PREFIX}${playerId}`;
    const storedToken = await AsyncStorage.getItem(cacheKey);
    if (storedToken !== token) {
      const url = new URL(`/api/player/${playerId}/push-token`, getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        await AsyncStorage.setItem(cacheKey, token);
        console.log("[push] Token registered:", token.slice(0, 30) + "...");
      }
    }

    return token;
  } catch (e) {
    console.log("[push] Not available in this environment:", e);
    return null;
  }
}

export async function getPermissionsStatus(): Promise<string | null> {
  if (!Notifications || Platform.OS === "web") return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return null;
  }
}

export async function updateNotificationSetting(
  playerId: string,
  enabled: boolean
): Promise<boolean> {
  try {
    const url = new URL(`/api/player/${playerId}/notifications`, getApiUrl());
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getNotificationSettings(
  playerId: string
): Promise<{ enabled: boolean; tokenRegistered: boolean } | null> {
  try {
    const url = new URL(`/api/player/${playerId}/notifications`, getApiUrl());
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
