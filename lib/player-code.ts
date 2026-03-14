export function getDisplayCode(playerName: string, playerId: string): string {
  const hex = playerId.replace(/[^0-9a-f]/gi, "").slice(-4).padStart(4, "0");
  const num = parseInt(hex, 16) % 10000;
  const suffix = num.toString().padStart(4, "0");
  return `${playerName}#${suffix}`;
}
