/**
 * Audio DSP & telemetry calculation helpers for Neural Acoustic Luminescence
 */

export function dbToGain(db: number): number {
  if (db <= -60) return 0;
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  if (gain <= 0.0001) return -60;
  return Math.max(-60, 20 * Math.log10(gain));
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export function bpmToMs(bpm: number, beats: number = 1): number {
  if (bpm <= 0) return 500;
  return (60000 / bpm) * beats;
}

export function calculateSimulatedLUFS(amplitudes: number[]): number {
  if (!amplitudes || amplitudes.length === 0) return -70;
  const meanSquare = amplitudes.reduce((acc, val) => acc + val * val, 0) / amplitudes.length;
  if (meanSquare <= 0.000001) return -70;
  // Standard K-weighting simulation approximation in dB relative to full scale
  const lufs = -0.691 + 10 * Math.log10(meanSquare);
  return Math.max(-70, Math.min(0, parseFloat(lufs.toFixed(1))));
}

export interface StemTrackInput {
  id: string;
  gain: number;
  mute: boolean;
  solo: boolean;
}

export function calculateEffectiveStemGains(stems: StemTrackInput[]): number[] {
  const anySolo = stems.some(s => s.solo);
  return stems.map(stem => {
    if (stem.mute) return 0;
    if (anySolo) {
      return stem.solo ? stem.gain : 0;
    }
    return stem.gain;
  });
}

export function generateDeterministicWaveform(seed: string, count: number = 64): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = i / count;
    // Layered sines with pseudo-random seed variation
    const v1 = Math.sin(x * Math.PI * 4 + hash * 0.01);
    const v2 = Math.sin(x * Math.PI * 9 + hash * 0.02) * 0.5;
    const v3 = Math.cos(x * Math.PI * 17) * 0.25;
    const raw = Math.abs((v1 + v2 + v3) / 1.75);
    // Envelope shaping (fade in and out softly at ends)
    const envelope = Math.sin(x * Math.PI);
    const val = Math.max(0.08, Math.min(1, raw * (0.3 + 0.7 * envelope)));
    result.push(parseFloat(val.toFixed(3)));
  }
  return result;
}

export const TARGET_PLAYBACK_LUFS = -14.0;

/**
 * Computes the linear playback gain factor needed to bring a track's integrated LUFS
 * to the catalog's consistent reference loudness (default -14.0 LUFS), safely clamped
 * to avoid clipping on quiet tracks or over-attenuation on hot masters.
 */
export function calculateLoudnessNormalizationGain(
  integratedLufs?: number,
  targetLufs: number = TARGET_PLAYBACK_LUFS,
  minGain: number = 0.25,
  maxGain: number = 2.0
): number {
  if (
    typeof integratedLufs !== 'number' ||
    !Number.isFinite(integratedLufs) ||
    integratedLufs <= -70 ||
    integratedLufs > 0
  ) {
    return 1.0;
  }

  const gainDb = targetLufs - integratedLufs;
  const linearGain = Math.pow(10, gainDb / 20);
  const clamped = Math.max(minGain, Math.min(maxGain, linearGain));
  return Number(clamped.toFixed(4));
}

export function calculateLoudnessNormalizationDb(
  integratedLufs?: number,
  targetLufs: number = TARGET_PLAYBACK_LUFS
): number {
  const gain = calculateLoudnessNormalizationGain(integratedLufs, targetLufs);
  if (gain === 1.0) return 0;
  return Number((20 * Math.log10(gain)).toFixed(2));
}

export function semitonesToPlaybackRate(semitones: number = 0): number {
  if (!Number.isFinite(semitones) || semitones === 0) return 1.0;
  const rate = Math.pow(2, semitones / 12);
  return Number(Math.max(0.5, Math.min(2.0, rate)).toFixed(4));
}

export function resolvePublicAssetUrl(url?: string, baseUri?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  const resolvedBase =
    baseUri ||
    (typeof document !== 'undefined' && document.baseURI) ||
    (typeof window !== 'undefined' ? window.location.href : undefined);

  if (trimmed.startsWith('/assets/') && resolvedBase) {
    try {
      return new URL(trimmed.slice(1), resolvedBase).href;
    } catch {
      return trimmed;
    }
  }

  if (resolvedBase) {
    try {
      return new URL(trimmed, resolvedBase).href;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}
