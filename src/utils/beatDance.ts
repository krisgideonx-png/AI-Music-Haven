/**
 * Pure deterministic beat-synchronization, tiny dancer pose math, and
 * reactive waveform visualization calculations for AI Music Haven.
 */

export interface BeatPhaseState {
  beatIndex: number;
  phase: number; // 0..1 within current beat
  pulse: number; // 0..1 sharp kick envelope on beat downbeat
  barPhase: number; // 0..1 across a 4-beat measure
}

export interface DancerPose {
  bounceY: number; // vertical px displacement (negative = jump/lift, positive = crouch)
  hipOffsetX: number; // horizontal groove sway in px
  headTiltDeg: number;
  torsoLeanDeg: number;
  leftArmDeg: number;
  rightArmDeg: number;
  leftLegDeg: number;
  rightLegDeg: number;
  pulseIntensity: number; // 0..1
  stepSide: 'left' | 'right' | 'idle';
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 120;
  return Math.max(40, Math.min(220, bpm));
}

export function computeBeatPhase(timeSec: number, bpm: number): BeatPhaseState {
  const safeBpm = clampBpm(bpm);
  const safeTime = Number.isFinite(timeSec) && timeSec >= 0 ? timeSec : 0;
  const beatsPerSecond = safeBpm / 60;
  const totalBeats = safeTime * beatsPerSecond;
  const beatIndex = Math.floor(totalBeats);
  const phase = totalBeats - beatIndex;
  const downbeatEnv = Math.exp(-phase * 4.5);
  const bounceCurve = Math.sin(phase * Math.PI);
  const pulse = Math.max(0, Math.min(1, downbeatEnv * 0.72 + bounceCurve * 0.28));
  const barPhase = ((totalBeats % 4) + 4) % 4 / 4;

  return {
    beatIndex,
    phase,
    pulse,
    barPhase,
  };
}

export function computeDancerPose(
  timeSec: number,
  bpm: number,
  isPlaying: boolean,
  audioEnergy: number = 0
): DancerPose {
  if (!isPlaying) {
    return {
      bounceY: 0,
      hipOffsetX: 0,
      headTiltDeg: 0,
      torsoLeanDeg: 0,
      leftArmDeg: -14,
      rightArmDeg: 14,
      leftLegDeg: -4,
      rightLegDeg: 4,
      pulseIntensity: 0,
      stepSide: 'idle',
    };
  }

  const { beatIndex, phase, pulse } = computeBeatPhase(timeSec, bpm);
  const safeEnergy = Number.isFinite(audioEnergy)
    ? Math.max(0, Math.min(1, audioEnergy))
    : 0;
  const grooveAmplitude = 0.78 + safeEnergy * 0.45;
  const isEvenBeat = beatIndex % 2 === 0;
  const swingDir = isEvenBeat ? 1 : -1;
  const sinBeat = Math.sin(phase * Math.PI);

  return {
    bounceY: Number((-sinBeat * 5.5 * grooveAmplitude).toFixed(2)),
    hipOffsetX: Number((swingDir * Math.sin(phase * Math.PI) * 3.2 * grooveAmplitude).toFixed(2)),
    headTiltDeg: Number((swingDir * (6 + pulse * 8) * grooveAmplitude).toFixed(2)),
    torsoLeanDeg: Number((swingDir * (4 + sinBeat * 6) * grooveAmplitude).toFixed(2)),
    leftArmDeg: Number(((isEvenBeat ? -52 : 22) * grooveAmplitude).toFixed(2)),
    rightArmDeg: Number(((isEvenBeat ? -22 : 52) * grooveAmplitude).toFixed(2)),
    leftLegDeg: Number(((isEvenBeat ? -20 : 12) * grooveAmplitude).toFixed(2)),
    rightLegDeg: Number(((isEvenBeat ? -12 : 20) * grooveAmplitude).toFixed(2)),
    pulseIntensity: Number(Math.min(1, pulse * (0.75 + safeEnergy * 0.35)).toFixed(3)),
    stepSide: isEvenBeat ? 'left' : 'right',
  };
}

export function computeVisualizerBars(
  waveform: number[],
  progress: number,
  timeSec: number,
  bpm: number,
  isPlaying: boolean,
  liveBins?: ArrayLike<number> | null,
  barCount: number = 40
): number[] {
  const safeCount = Math.max(8, Math.min(96, Math.round(barCount)));
  const source = Array.isArray(waveform) && waveform.length > 0
    ? waveform
    : Array.from({ length: safeCount }, (_, i) => 0.35 + Math.abs(Math.sin(i * 0.37)) * 0.5);

  const { pulse, barPhase } = computeBeatPhase(timeSec, bpm);
  const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  let liveEnergySum = 0;
  const hasLiveBins = Boolean(liveBins && liveBins.length > 0);
  if (hasLiveBins && liveBins) {
    const checkLen = Math.min(32, liveBins.length);
    for (let i = 0; i < checkLen; i++) {
      liveEnergySum += Number(liveBins[i] || 0);
    }
  }
  const useFftOverlay = isPlaying && hasLiveBins && liveEnergySum > 8;

  const bars: number[] = [];
  for (let i = 0; i < safeCount; i++) {
    const waveIdx = Math.min(source.length - 1, Math.floor((i / safeCount) * source.length));
    const baseAmp = Math.max(0.12, Math.min(1, Number(source[waveIdx]) || 0.35));

    if (!isPlaying) {
      bars.push(Number(Math.max(0.1, Math.min(1, baseAmp * 0.72)).toFixed(3)));
      continue;
    }

    const normX = i / safeCount;
    const distanceFromCursor = Math.abs(normX - clampedProgress);
    const playheadBoost = Math.exp(-distanceFromCursor * 14) * 0.24;
    const spatialWave = Math.sin(normX * Math.PI * 3 + barPhase * Math.PI * 2) * 0.14;
    const beatBoost = pulse * (0.22 + (i % 3 === 0 ? 0.1 : 0.04));

    let combined = baseAmp * 0.78 + beatBoost + spatialWave + playheadBoost;
    if (useFftOverlay && liveBins) {
      const binIdx = Math.min(
        liveBins.length - 1,
        Math.floor((i / safeCount) * Math.min(liveBins.length, 64))
      );
      const fftVal = Math.max(0, Math.min(1, (Number(liveBins[binIdx]) || 0) / 255));
      combined = combined * 0.45 + fftVal * 0.68;
    }

    bars.push(Number(Math.max(0.1, Math.min(1, combined)).toFixed(3)));
  }

  return bars;
}
