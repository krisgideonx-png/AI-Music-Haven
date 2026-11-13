import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dbToGain,
  gainToDb,
  formatTime,
  bpmToMs,
  calculateSimulatedLUFS,
  calculateEffectiveStemGains,
  generateDeterministicWaveform,
  TARGET_PLAYBACK_LUFS,
  calculateLoudnessNormalizationGain,
  calculateLoudnessNormalizationDb,
  semitonesToPlaybackRate,
} from './audioMath.ts';

test('dbToGain converts 0dB to unity gain (1.0)', () => {
  assert.equal(Math.round(dbToGain(0) * 100) / 100, 1.0);
});

test('dbToGain converts -60dB or lower to 0', () => {
  assert.equal(dbToGain(-60), 0);
  assert.equal(dbToGain(-80), 0);
});

test('gainToDb converts 1.0 to 0dB and handles silence', () => {
  assert.equal(Math.round(gainToDb(1.0)), 0);
  assert.equal(gainToDb(0), -60);
});

test('formatTime produces mm:ss.s', () => {
  assert.equal(formatTime(0), '00:00.0');
  assert.equal(formatTime(65.4), '01:05.4');
  assert.equal(formatTime(-1), '00:00');
});

test('bpmToMs calculates correct note durations', () => {
  assert.equal(bpmToMs(120, 1), 500); // 1 beat at 120 bpm is 500ms
  assert.equal(bpmToMs(60, 1), 1000); // 1 beat at 60 bpm is 1000ms
});

test('calculateSimulatedLUFS calculates reasonable loudness for silence and signals', () => {
  assert.equal(calculateSimulatedLUFS([]), -70);
  assert.equal(calculateSimulatedLUFS([0, 0, 0]), -70);
  const lufs = calculateSimulatedLUFS([0.5, 0.5, 0.5, 0.5]);
  assert.ok(lufs > -20 && lufs < 0, `Expected reasonable LUFS, got ${lufs}`);
});

test('calculateEffectiveStemGains handles solo priority and mute states', () => {
  const stems = [
    { id: 'vocals', gain: 0.8, mute: false, solo: false },
    { id: 'drums', gain: 0.9, mute: false, solo: true },
    { id: 'bass', gain: 0.7, mute: true, solo: false },
    { id: 'synth', gain: 0.6, mute: false, solo: false },
  ];

  const effective = calculateEffectiveStemGains(stems);
  // drums is soloed, so only drums should have gain
  assert.equal(effective[0], 0); // vocals muted by solo
  assert.equal(effective[1], 0.9); // drums active
  assert.equal(effective[2], 0); // bass muted
  assert.equal(effective[3], 0); // synth muted by solo

  // If no stem is soloed
  const noSoloStems = stems.map(s => ({ ...s, solo: false }));
  const effectiveNoSolo = calculateEffectiveStemGains(noSoloStems);
  assert.equal(effectiveNoSolo[0], 0.8);
  assert.equal(effectiveNoSolo[1], 0.9);
  assert.equal(effectiveNoSolo[2], 0); // muted
  assert.equal(effectiveNoSolo[3], 0.6);
});

test('generateDeterministicWaveform returns requested number of points bounded in [0.08, 1]', () => {
  const wave = generateDeterministicWaveform('hyperion-seed-42', 32);
  assert.equal(wave.length, 32);
  wave.forEach(val => {
    assert.ok(val >= 0.08 && val <= 1, `Value ${val} out of bounds`);
  });
});

test('calculateLoudnessNormalizationGain brings hot and quiet LUFS tracks toward -14 LUFS safely', () => {
  assert.equal(calculateLoudnessNormalizationGain(TARGET_PLAYBACK_LUFS), 1.0);
  assert.equal(calculateLoudnessNormalizationDb(TARGET_PLAYBACK_LUFS), 0);

  // Louder track (-8 LUFS) should attenuate by ~ -6 dB (~0.5012)
  const hotGain = calculateLoudnessNormalizationGain(-8.0);
  assert.ok(hotGain > 0.49 && hotGain < 0.51, `Expected ~0.5012, got ${hotGain}`);
  assert.ok(calculateLoudnessNormalizationDb(-8.0) < -5.8);

  // Quieter track (-20 LUFS) should boost by ~ +6 dB (~1.995)
  const quietGain = calculateLoudnessNormalizationGain(-20.0);
  assert.ok(quietGain > 1.95 && quietGain <= 2.0, `Expected ~1.995, got ${quietGain}`);

  // Extreme clamps & invalid inputs
  assert.equal(calculateLoudnessNormalizationGain(-50.0), 2.0);
  assert.equal(calculateLoudnessNormalizationGain(-1.0), 0.25);
  assert.equal(calculateLoudnessNormalizationGain(undefined), 1.0);
  assert.equal(calculateLoudnessNormalizationGain(-70), 1.0);
});

test('semitonesToPlaybackRate computes equal-temperament pitch ratios within bounds', () => {
  assert.equal(semitonesToPlaybackRate(0), 1.0);
  assert.equal(semitonesToPlaybackRate(12), 2.0);
  assert.equal(semitonesToPlaybackRate(-12), 0.5);
  const downThree = semitonesToPlaybackRate(-3);
  assert.ok(downThree > 0.83 && downThree < 0.85, `Expected ~0.8409, got ${downThree}`);
  const upFour = semitonesToPlaybackRate(4);
  assert.ok(upFour > 1.25 && upFour < 1.27, `Expected ~1.2599, got ${upFour}`);
});
