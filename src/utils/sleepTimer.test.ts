import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLEEP_TIMER_PRESETS_MINUTES,
  formatSleepCountdown,
  computeSleepFadeMultiplier,
  clampSleepMinutes,
} from './sleepTimer.ts';

test('SLEEP_TIMER_PRESETS_MINUTES provides standard intervals', () => {
  assert.deepEqual([...SLEEP_TIMER_PRESETS_MINUTES], [5, 15, 30, 45, 60]);
});

test('formatSleepCountdown formats seconds, minutes, and hours clearly', () => {
  assert.equal(formatSleepCountdown(0), '0:00');
  assert.equal(formatSleepCountdown(-5), '0:00');
  assert.equal(formatSleepCountdown(45), '0:45');
  assert.equal(formatSleepCountdown(60), '1:00');
  assert.equal(formatSleepCountdown(905), '15:05');
  assert.equal(formatSleepCountdown(3665), '1:01:05');
});

test('computeSleepFadeMultiplier tapers volume only inside fade window', () => {
  assert.equal(computeSleepFadeMultiplier(30, 5), 1);
  assert.equal(computeSleepFadeMultiplier(5, 5), 1);
  assert.equal(computeSleepFadeMultiplier(0, 5), 0);
  const midFade = computeSleepFadeMultiplier(2.5, 5);
  assert.ok(midFade > 0.65 && midFade < 0.75, `Expected smooth cosine ~0.707, got ${midFade}`);
});

test('clampSleepMinutes clamps between 1 and 240 minutes', () => {
  assert.equal(clampSleepMinutes(0), 1);
  assert.equal(clampSleepMinutes(-10), 1);
  assert.equal(clampSleepMinutes(500), 240);
  assert.equal(clampSleepMinutes(22.4), 22);
  assert.equal(clampSleepMinutes(Number.NaN), 15);
});
