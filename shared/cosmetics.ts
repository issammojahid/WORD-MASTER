export const AVATAR_CATALOG = [
  { id: "student", price: 0, colors: ["#17AFC1", "#83E5DE", "#075D70"] },
  { id: "djellaba", price: 250, colors: ["#E79B47", "#FFE0A6", "#9B4F1F"] },
  { id: "sport", price: 300, colors: ["#F05A8D", "#FFC0D8", "#9A2452"] },
  { id: "amazigh", price: 450, colors: ["#E2B51C", "#FFF0A1", "#735300"] },
  { id: "astronaut", price: 550, colors: ["#6D72E8", "#C9CCFF", "#343A9A"] },
  { id: "ninja", price: 650, colors: ["#7650AA", "#D6C1F4", "#43256B"] },
  { id: "king", price: 900, colors: ["#DE9E16", "#FFE69A", "#805400"] },
] as const;

export type AvatarSkinId = (typeof AVATAR_CATALOG)[number]["id"];

export const COSMETIC_KINDS = ["frame", "background", "nameplate", "victory", "seasonal"] as const;
export type CosmeticKind = (typeof COSMETIC_KINDS)[number];
export type CosmeticInventory = Record<CosmeticKind, string[]>;
export type EquippedCosmetics = Record<CosmeticKind, string>;

export const DEFAULT_COSMETIC_INVENTORY: CosmeticInventory = {
  frame: ["basic_frame"],
  background: ["basic_background"],
  nameplate: ["basic_nameplate"],
  victory: ["no_victory_effect"],
  seasonal: ["no_seasonal"],
};

export const DEFAULT_EQUIPPED_COSMETICS: EquippedCosmetics = {
  frame: "basic_frame",
  background: "basic_background",
  nameplate: "basic_nameplate",
  victory: "no_victory_effect",
  seasonal: "no_seasonal",
};

export const COSMETIC_CATALOG: ReadonlyArray<{
  id: string;
  kind: CosmeticKind;
  price: number;
  colors: readonly [string, string, string];
  icon: "shield-outline" | "image-outline" | "text-outline" | "sparkles-outline" | "sunny-outline";
}> = [
  { id: "basic_frame", kind: "frame", price: 0, colors: ["#17AFC1", "#83E5DE", "#075D70"], icon: "shield-outline" },
  { id: "mosaic_frame", kind: "frame", price: 220, colors: ["#33C5A1", "#B6F3E2", "#12634F"], icon: "shield-outline" },
  { id: "atlas_frame", kind: "frame", price: 360, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "shield-outline" },
  { id: "aurora_frame", kind: "frame", price: 480, colors: ["#8B6BEE", "#D7C9FF", "#4C32A0"], icon: "shield-outline" },
  { id: "basic_background", kind: "background", price: 0, colors: ["#253B60", "#8298BD", "#17253E"], icon: "image-outline" },
  { id: "marrakech_bg", kind: "background", price: 280, colors: ["#E88D5B", "#FFD2A8", "#8B3E26"], icon: "image-outline" },
  { id: "atlas_night_bg", kind: "background", price: 420, colors: ["#427AA8", "#A9D9F0", "#1D3858"], icon: "image-outline" },
  { id: "zellige_bg", kind: "background", price: 500, colors: ["#36A99A", "#B3EEE4", "#1D5A54"], icon: "image-outline" },
  { id: "basic_nameplate", kind: "nameplate", price: 0, colors: ["#586A8A", "#C0CAE0", "#293852"], icon: "text-outline" },
  { id: "calligraphy_plate", kind: "nameplate", price: 180, colors: ["#8B6BEE", "#D7C9FF", "#4C32A0"], icon: "text-outline" },
  { id: "gold_plate", kind: "nameplate", price: 320, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "text-outline" },
  { id: "emerald_plate", kind: "nameplate", price: 390, colors: ["#33C5A1", "#B6F3E2", "#12634F"], icon: "text-outline" },
  { id: "no_victory_effect", kind: "victory", price: 0, colors: ["#64748B", "#CBD5E1", "#334155"], icon: "sparkles-outline" },
  { id: "starlight", kind: "victory", price: 260, colors: ["#8B6BEE", "#D7C9FF", "#4C32A0"], icon: "sparkles-outline" },
  { id: "confetti", kind: "victory", price: 380, colors: ["#E88D5B", "#FFD2A8", "#8B3E26"], icon: "sparkles-outline" },
  { id: "golden_burst", kind: "victory", price: 520, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "sparkles-outline" },
  { id: "no_seasonal", kind: "seasonal", price: 0, colors: ["#64748B", "#CBD5E1", "#334155"], icon: "sunny-outline" },
  { id: "ramadan_lantern", kind: "seasonal", price: 300, colors: ["#D8A332", "#FFE6A5", "#805B14"], icon: "sunny-outline" },
  { id: "eid_mosaic", kind: "seasonal", price: 350, colors: ["#33C5A1", "#B6F3E2", "#12634F"], icon: "sunny-outline" },
  { id: "atlas_winter", kind: "seasonal", price: 440, colors: ["#427AA8", "#A9D9F0", "#1D3858"], icon: "sunny-outline" },
];

export function getAvatarCosmetic(skinId: string) {
  return AVATAR_CATALOG.find((item) => item.id === skinId) ?? AVATAR_CATALOG[0];
}

export function getCosmetic(kind: CosmeticKind, id: string) {
  return COSMETIC_CATALOG.find((item) => item.kind === kind && item.id === id);
}
