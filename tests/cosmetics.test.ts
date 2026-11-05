import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_CATALOG,
  COSMETIC_CATALOG,
  COSMETIC_KINDS,
  DEFAULT_COSMETIC_INVENTORY,
  DEFAULT_EQUIPPED_COSMETICS,
} from "../shared/cosmetics";

test("fantasy artwork changes do not alter cosmetic IDs or prices", () => {
  assert.deepEqual(
    AVATAR_CATALOG.map(({ id, price }) => [id, price]),
    [
      ["student", 0],
      ["djellaba", 250],
      ["sport", 300],
      ["amazigh", 450],
      ["astronaut", 550],
      ["ninja", 650],
      ["king", 900],
    ],
  );
  assert.deepEqual(
    COSMETIC_CATALOG.map(({ id, price }) => [id, price]),
    [
      ["basic_frame", 0],
      ["mosaic_frame", 220],
      ["atlas_frame", 360],
      ["aurora_frame", 480],
      ["basic_background", 0],
      ["marrakech_bg", 280],
      ["atlas_night_bg", 420],
      ["zellige_bg", 500],
      ["basic_nameplate", 0],
      ["calligraphy_plate", 180],
      ["gold_plate", 320],
      ["emerald_plate", 390],
      ["no_victory_effect", 0],
      ["starlight", 260],
      ["confetti", 380],
      ["golden_burst", 520],
      ["no_seasonal", 0],
      ["ramadan_lantern", 300],
      ["eid_mosaic", 350],
      ["atlas_winter", 440],
    ],
  );
});

test("cosmetic catalog uses unique item IDs and non-negative coin prices", () => {
  const ids = COSMETIC_CATALOG.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(COSMETIC_CATALOG.every((item) => Number.isSafeInteger(item.price) && item.price >= 0));
});

test("every cosmetic category has a free owned default and purchasable items", () => {
  for (const kind of COSMETIC_KINDS) {
    const defaultId = DEFAULT_EQUIPPED_COSMETICS[kind];
    assert.ok(DEFAULT_COSMETIC_INVENTORY[kind].includes(defaultId));
    assert.ok(COSMETIC_CATALOG.some((item) => item.kind === kind && item.id === defaultId && item.price === 0));
    assert.ok(COSMETIC_CATALOG.some((item) => item.kind === kind && item.price > 0));
  }
});
