import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBpm,
  computeBeatPhase,
  computeDancerPose,
  computeVisualizerBars,
} from './beatDance.ts';

test('clampBpm enforces valid tempo bounds with 120 BPM fallback', () => {
  assert.equal(clampBpm(128), 128);
  assert.equal(clampBpm(10), 40);
  assert.equal(clampBpm(300), 220);
  assert.equal(clampBpm(Number.NaN), 120);
});

test('computeBeatPhase cycles cleanly per BPM', () => {
  // At 120 BPM, 1 beat = 0.5 seconds
  const downbeat = computeBeatPhase(0, 120);
  assert.equal(downbeat.beatIndex, 0);
  assert.equal(downbeat.phase, 0);
  assert.ok(downbeat.pulse > 0.65);

  const nextBeat = computeBeatPhase(0.5, 120);
  assert.equal(nextBeat.beatIndex, 1);
  assert.ok(nextBeat.phase < 0.01);

  const midBeat = computeBeatPhase(0.25, 120);
  assert.equal(midBeat.beatIndex, 0);
  assert.ok(Math.abs(midBeat.phase - 0.5) < 0.001);
});

test('computeDancerPose stays idle when paused and alternates steps on every beat when playing', () => {
  const paused = computeDancerPose(1.2, 128, false, 0.9);
  assert.equal(paused.stepSide, 'idle');
  assert.equal(paused.bounceY, 0);

  // Beat 0 (left) vs Beat 1 (right) at 120 BPM
  const beat0 = computeDancerPose(0.15, 120, true, 0.5);
  const beat1 = computeDancerPose(0.65, 120, true, 0.5);

  assert.equal(beat0.stepSide, 'left');
  assert.equal(beat1.stepSide, 'right');
  assert.ok(beat0.bounceY < 0);
  assert.ok(beat1.bounceY < 0);
  assert.ok(beat0.hipOffsetX > 0 && beat1.hipOffsetX < 0);
  assert.notEqual(beat0.leftArmDeg, beat1.leftArmDeg);
});

test('computeVisualizerBars returns normalized waveform bars and reacts to live FFT bins', () => {
  const wave = [0.2, 0.8, 0.5, 0.9, 0.3, 0.7, 0.4, 0.6];
  const idleBars = computeVisualizerBars(wave, 0.25, 0, 128, false, null, 16);
  assert.equal(idleBars.length, 16);
  assert.ok(idleBars.every((v) => v >= 0.1 && v <= 1));

  const loudBins = new Uint8Array(64).fill(230);
  const liveBars = computeVisualizerBars(wave, 0.5, 0.1, 128, true, loudBins, 16);
  assert.equal(liveBars.length, 16);
  const avgIdle = idleBars.reduce((a, b) => a + b, 0) / idleBars.length;
  const avgLive = liveBars.reduce((a, b) => a + b, 0) / liveBars.length;
  assert.ok(avgLive > avgIdle);
});
