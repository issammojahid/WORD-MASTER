import { Audio } from "expo-av";
import { Platform } from "react-native";

const SOUND_FILES = {
  correct: require("../assets/sounds/correct.mp3"),
  wrong:   require("../assets/sounds/wrong.mp3"),
  win:     require("../assets/sounds/win.mp3"),
  lose:    require("../assets/sounds/lose.mp3"),
  laugh:   require("../assets/sounds/laugh.mp3"),
  clap:    require("../assets/sounds/clap.mp3"),
  fire:    require("../assets/sounds/fire.mp3"),
} as const;

export type SoundName = keyof typeof SOUND_FILES;

const cache = new Map<SoundName, Audio.Sound>();
let audioModeInitialized = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeInitialized) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioModeInitialized = true;
  } catch {}
}

async function loadSound(name: SoundName): Promise<Audio.Sound | null> {
  const existing = cache.get(name);
  if (existing) return existing;
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      SOUND_FILES[name],
      { shouldPlay: false, volume: 1.0 },
    );
    cache.set(name, sound);
    return sound;
  } catch {
    return null;
  }
}

export async function playSound(name: SoundName): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const sound = await loadSound(name);
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {}
}

export async function preloadAllSounds(): Promise<void> {
  if (Platform.OS === "web") return;
  await ensureAudioMode();
  const names = Object.keys(SOUND_FILES) as SoundName[];
  await Promise.allSettled(names.map((n) => loadSound(n)));
}

export async function unloadAllSounds(): Promise<void> {
  for (const sound of cache.values()) {
    try { await sound.unloadAsync(); } catch {}
  }
  cache.clear();
  audioModeInitialized = false;
}
