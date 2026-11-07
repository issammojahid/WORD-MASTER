import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { io, type Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/query-client";

const SESSION_TOKEN_KEY = "online_guest_token_v1";
let socket: Socket | null = null;
let tokenRefreshInFlight = false;
let sessionToken: string | null = null;
let guestTokenInFlight: Promise<string> | null = null;

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isWalletClaim(value: unknown): value is { matchId: string; amount: number } {
  return typeof value === "object"
    && value !== null
    && "matchId" in value
    && typeof value.matchId === "string"
    && "amount" in value
    && typeof value.amount === "number"
    && Number.isSafeInteger(value.amount)
    && value.amount > 0;
}

async function readToken(): Promise<string | null> {
  if (sessionToken) return sessionToken;
  if (Platform.OS === "web") return AsyncStorage.getItem(SESSION_TOKEN_KEY);
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
    // Android can restore encrypted preferences without the matching keystore key.
    // Renew the unreadable online credential; keep all player progress intact.
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ERR_DECRYPT") {
      throw error;
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    return null;
  }
}

async function writeToken(token: string): Promise<void> {
  sessionToken = token;
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

async function deleteToken(): Promise<void> {
  sessionToken = null;
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

async function createGuestSession(): Promise<string> {
  const response = await fetch(new URL("/api/online/guest-session", getApiUrl()), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(response.status === 429 ? "rate_limited" : "online_unavailable");
  }
  const result = await response.json() as { token?: unknown };
  if (typeof result.token !== "string" || result.token.length < 40) {
    throw new Error("invalid_guest_session");
  }
  await writeToken(result.token);
  return result.token;
}

async function getGuestToken(): Promise<string> {
  if (sessionToken) return sessionToken;
  if (guestTokenInFlight) return guestTokenInFlight;
  guestTokenInFlight = (async () => {
    const existing = await readToken();
    const token = existing ?? await createGuestSession();
    sessionToken = token;
    return token;
  })();
  try {
    return await guestTokenInFlight;
  } finally {
    guestTokenInFlight = null;
  }
}

export async function getOnlineGuestToken(): Promise<string> {
  return getGuestToken();
}

export async function fetchOnlineWallet(): Promise<{ coins: number; entryFees:boolean; local:boolean; claims: { matchId: string; amount: number }[] }> {
  const token = await readToken();
  if (!token) throw new Error("guest_session_missing");
  const response = await fetch(new URL("/api/online/wallet", getApiUrl()), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(response.status === 401 ? "unauthorized" : "online_unavailable");
  const result = await response.json() as { coins?: unknown;entryFees?:unknown;local?:unknown; claims?: unknown };
  if (
    !isNonnegativeInteger(result.coins)
    || !Array.isArray(result.claims)
    || !result.claims.every(isWalletClaim)
  ) {
    throw new Error("invalid_wallet_response");
  }
  return { coins: result.coins,entryFees:result.entryFees===true,local:result.local===true, claims: result.claims };
}

export async function connectOnlineSocket(displayName: string): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await getGuestToken();
  if (socket) {
    socket.auth = { token, displayName };
    return socket;
  }

  socket = io(getApiUrl(), {
    autoConnect: false,
    auth: { token, displayName },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 8,
    timeout: 10_000,
  });
  socket.on("connect_error", (error) => {
    if (error.message !== "unauthorized" || tokenRefreshInFlight || !socket) return;
    tokenRefreshInFlight = true;
    void (async () => {
      try {
        await deleteToken();
        const freshToken = await createGuestSession();
        if (!socket) return;
        socket.auth = { token: freshToken, displayName };
        socket.connect();
      } catch (refreshError) {
        console.error("[online] Could not renew guest session:", refreshError);
        socket?.emit("online:error", { code: "online_unavailable" });
      } finally {
        tokenRefreshInFlight = false;
      }
    })();
  });
  return socket;
}

export function getOnlineSocket(): Socket | null {
  return socket;
}

export function disconnectOnlineSocket(): void {
  socket?.disconnect();
  socket = null;
  tokenRefreshInFlight = false;
}
