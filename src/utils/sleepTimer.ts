export const SLEEP_TIMER_PRESETS_MINUTES = [5, 15, 30, 45, 60] as const;
export const DEFAULT_SLEEP_FADE_WINDOW_SECONDS = 5;

export function formatSleepCountdown(remainingSeconds: number): string {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    return '0:00';
  }
  const total = Math.ceil(remainingSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Smoothly tapers master volume down during the final `fadeWindowSeconds`
 * before the sleep timer pauses audio playback.
 */
export function computeSleepFadeMultiplier(
  remainingSeconds: number,
  fadeWindowSeconds: number = DEFAULT_SLEEP_FADE_WINDOW_SECONDS
): number {
  if (!Number.isFinite(remainingSeconds) || fadeWindowSeconds <= 0) {
    return 1;
  }
  if (remainingSeconds <= 0) {
    return 0;
  }
  if (remainingSeconds >= fadeWindowSeconds) {
    return 1;
  }
  const ratio = remainingSeconds / fadeWindowSeconds;
  // Cosine ease-out curve for gentle audible fade
  return Math.max(0, Math.min(1, Math.sin((ratio * Math.PI) / 2)));
}

export function clampSleepMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || Number.isNaN(minutes)) return 15;
  return Math.max(1, Math.min(240, Math.round(minutes)));
}
