import { Audio } from "expo-av";

const SOUND_FILES = {
  correct: require("@/assets/sounds/correct.mp3"),
  wrong: require("@/assets/sounds/wrong.mp3"),
  win: require("@/assets/sounds/win.mp3"),
  lose: require("@/assets/sounds/lose.mp3"),
  laugh: require("@/assets/sounds/laugh.mp3"),
  clap: require("@/assets/sounds/clap.mp3"),
  fire: require("@/assets/sounds/fire.mp3"),
} as const;

export type SoundName = keyof typeof SOUND_FILES;

const cache = new Map<SoundName, Audio.Sound>();

async function loadSound(name: SoundName): Promise<Audio.Sound> {
  const existing = cache.get(name);
  if (existing) return existing;
  const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name], { shouldPlay: false });
  cache.set(name, sound);
  return sound;
}

export async function playSound(name: SoundName): Promise<void> {
  try {
    const sound = await loadSound(name);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {}
}

export async function unloadAllSounds(): Promise<void> {
  for (const sound of cache.values()) {
    try { await sound.unloadAsync(); } catch {}
  }
  cache.clear();
}
