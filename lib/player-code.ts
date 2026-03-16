export function getDisplayCode(
  playerName: string,
  playerId: string,
  playerTag?: number | null,
): string {
  if (playerTag != null && playerTag > 0) {
    const suffix = playerTag.toString().padStart(4, "0");
    return `${playerName}#${suffix}`;
  }
  const hex = playerId.replace(/[^0-9a-f]/gi, "").slice(-4).padStart(4, "0");
  const num = parseInt(hex, 16) % 10000;
  const suffix = num.toString().padStart(4, "0");
  return `${playerName}#${suffix}`;
}

export function getPlayerDisplayId(playerTag: number | null | undefined): string {
  if (playerTag != null && playerTag > 0) {
    return `WM-${playerTag.toString().padStart(5, "0")}`;
  }
  return "";
}
