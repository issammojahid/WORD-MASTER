export function cleanPlayerName(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_name");
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if ([...name].length < 2 || [...name].length > 20 || !/^[\p{L}\p{N} _-]+$/u.test(name)) throw new Error("invalid_name");
  return name;
}
export function suggestPlayerName(): string {
  const words = ["Atlas", "Najm", "Sahara", "Qamar", "Zellige", "Batal"];
  return words[Math.floor(Math.random() * words.length)] + "_" + Math.floor(10000 + Math.random() * 90000);
}
