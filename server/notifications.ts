import { db } from "./db";
import { playerProfiles } from "@shared/schema";
import { eq, and, lt, isNotNull, sql } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushMessage = {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
};

export async function sendPushNotification(
  playerId: string,
  body: string,
  title?: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const [profile] = await db
      .select({
        expoPushToken: playerProfiles.expoPushToken,
        notificationsEnabled: playerProfiles.notificationsEnabled,
      })
      .from(playerProfiles)
      .where(eq(playerProfiles.id, playerId))
      .limit(1);

    if (!profile?.expoPushToken || !profile.notificationsEnabled) return false;

    const message: PushMessage = {
      to: profile.expoPushToken,
      body,
      sound: "default",
      channelId: "default",
    };
    if (title) message.title = title;
    if (data) message.data = data;

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.error("[push] Expo API error:", res.status);
      return false;
    }

    const result = await res.json();
    if (result?.data?.status === "error") {
      console.error("[push] Ticket error:", result.data.message);
      if (result.data.details?.error === "DeviceNotRegistered") {
        await db
          .update(playerProfiles)
          .set({ expoPushToken: null })
          .where(eq(playerProfiles.id, playerId));
        console.log("[push] Cleared stale token for player:", playerId);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("[push] Failed to send notification:", e);
    return false;
  }
}

export async function sendBulkPushNotifications(
  messages: PushMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });
    } catch (e) {
      console.error("[push] Bulk send error:", e);
    }
  }
}

export async function sendDailyTaskReminders(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const players = await db
      .select({
        expoPushToken: playerProfiles.expoPushToken,
        lastLoginDate: playerProfiles.lastLoginDate,
        notificationsEnabled: playerProfiles.notificationsEnabled,
      })
      .from(playerProfiles)
      .where(
        and(
          isNotNull(playerProfiles.expoPushToken),
          eq(playerProfiles.notificationsEnabled, true)
        )
      );

    const messages: PushMessage[] = [];
    for (const p of players) {
      if (!p.expoPushToken || p.lastLoginDate === today) continue;
      messages.push({
        to: p.expoPushToken,
        title: "حروف المغرب",
        body: "مهامك اليومية جاهزة! 🎯",
        sound: "default",
        data: { type: "daily_tasks" },
      });
    }

    if (messages.length > 0) {
      await sendBulkPushNotifications(messages);
      console.log(`[cron] Sent ${messages.length} daily task reminders`);
    }
  } catch (e) {
    console.error("[cron] Daily task reminder error:", e);
  }
}

export async function sendStreakResetWarnings(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const players = await db
      .select({
        expoPushToken: playerProfiles.expoPushToken,
        lastLoginDate: playerProfiles.lastLoginDate,
        loginStreak: playerProfiles.loginStreak,
        notificationsEnabled: playerProfiles.notificationsEnabled,
      })
      .from(playerProfiles)
      .where(
        and(
          isNotNull(playerProfiles.expoPushToken),
          eq(playerProfiles.notificationsEnabled, true),
          sql`${playerProfiles.loginStreak} > 2`
        )
      );

    const messages: PushMessage[] = [];
    for (const p of players) {
      if (!p.expoPushToken || p.lastLoginDate === today) continue;
      messages.push({
        to: p.expoPushToken,
        title: "حروف المغرب",
        body: "سلسلتك ستنتهي اليوم! 🔥",
        sound: "default",
        data: { type: "streak_warning" },
      });
    }

    if (messages.length > 0) {
      await sendBulkPushNotifications(messages);
      console.log(`[cron] Sent ${messages.length} streak reset warnings`);
    }
  } catch (e) {
    console.error("[cron] Streak reset warning error:", e);
  }
}

export async function sendSeasonEndingNotifications(): Promise<void> {
  try {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate();

    if (daysLeft !== 3 && daysLeft !== 1) return;

    const label = daysLeft === 3 ? "الموسم ينتهي خلال 3 أيام ⏳" : "الموسم ينتهي غداً! ⏳";

    const players = await db
      .select({
        expoPushToken: playerProfiles.expoPushToken,
        notificationsEnabled: playerProfiles.notificationsEnabled,
      })
      .from(playerProfiles)
      .where(
        and(
          isNotNull(playerProfiles.expoPushToken),
          eq(playerProfiles.notificationsEnabled, true)
        )
      );

    const messages: PushMessage[] = [];
    for (const p of players) {
      if (!p.expoPushToken) continue;
      messages.push({
        to: p.expoPushToken,
        title: "حروف المغرب",
        body: label,
        sound: "default",
        data: { type: "season_ending" },
      });
    }

    if (messages.length > 0) {
      await sendBulkPushNotifications(messages);
      console.log(`[cron] Sent ${messages.length} season ending notifications`);
    }
  } catch (e) {
    console.error("[cron] Season ending notification error:", e);
  }
}
