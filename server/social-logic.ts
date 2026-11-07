export function normalizePlayerPair(first: string, second: string): [string, string] {
  return first < second ? [first, second] : [second, first];
}

export function normalizeMessageContent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const content = value.trim();
  return content.length > 0 && content.length <= 1000 ? content : null;
}

export function invitationExpired(expiresAt: Date, now = Date.now()): boolean {
  return expiresAt.getTime() <= now;
}

export function canMessage(input: {
  samePlayer: boolean;
  friends: boolean;
  blocked: boolean;
}): boolean {
  return !input.samePlayer && input.friends && !input.blocked;
}

export function canSendFriendRequest(input: {
  samePlayer: boolean;
  alreadyFriends: boolean;
  blocked: boolean;
  requestsAllowed: boolean;
}): boolean {
  return !input.samePlayer && !input.alreadyFriends && !input.blocked && input.requestsAllowed;
}
