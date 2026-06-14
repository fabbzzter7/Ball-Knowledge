import buttonTapSound from "../assets/button-tap.mp3";
import coinSound from "../assets/coin.mp3";
import correctSound from "../assets/correct.mp3";
import levelUpSound from "../assets/level-up.mp3";
import { safeLocalStorage as localStorage } from "./safeStorage";

const SOUND_STORAGE_KEY = "ballKnowledgeSoundEnabled";

const SOUND_CONFIG = {
  buttonTap: { src: buttonTapSound, volume: 0.2, minGapMs: 45 },
  correct: { src: correctSound, volume: 0.45, minGapMs: 90 },
  coin: { src: coinSound, volume: 0.45, minGapMs: 160 },
  levelUp: { src: levelUpSound, volume: 0.55, minGapMs: 400 },
  // TODO sound assets: swap this fallback when src/assets/sounds/streak.mp3 is present.
  streak: { src: levelUpSound, volume: 0.55, minGapMs: 500 },
};

const audioCache = new Map();
const lastPlayedAt = new Map();

export function isSoundEnabled() {
  if (typeof window === "undefined") return true;

  return localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
}

export function setSoundEnabled(enabled) {
  if (typeof window === "undefined") return;

  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "true" : "false");
}

function getBaseAudio(name) {
  const config = SOUND_CONFIG[name];

  if (!config?.src || typeof Audio === "undefined") return null;

  if (!audioCache.has(name)) {
    try {
      const audio = new Audio(config.src);
      audio.preload = "auto";
      audio.volume = config.volume;
      audioCache.set(name, audio);
    } catch {
      return null;
    }
  }

  return audioCache.get(name);
}

export function playSound(name) {
  if (!isSoundEnabled()) return;

  const config = SOUND_CONFIG[name];
  const baseAudio = getBaseAudio(name);

  if (!config || !baseAudio) return;

  const now = Date.now();
  const lastPlayed = lastPlayedAt.get(name) || 0;

  if (now - lastPlayed < config.minGapMs) return;
  lastPlayedAt.set(name, now);

  try {
    const audio = baseAudio.cloneNode(true);
    audio.volume = config.volume;
    audio.currentTime = 0;

    const playPromise = audio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  } catch {
    // Browser audio can be blocked until user interaction. Never let that hurt gameplay.
  }
}

export const playCorrectSound = () => playSound("correct");
export const playWrongSound = () => {
  // Wrong-answer sound intentionally disabled; visual feedback still handles misses.
};
export const playCoinSound = () => playSound("coin");
export const playLevelUpSound = () => playSound("levelUp");
export const playButtonTapSound = () => {
  // Button tap sound disabled because it made the app feel delayed.
};
export const playStreakSound = () => playSound("streak");
