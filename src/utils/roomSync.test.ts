import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRoomCode,
  isValidRoomCode,
  generateRoomCode,
  computeSyncedPositionSeconds,
  shouldSeekOnSync,
} from './roomSync.ts';

test('normalizeRoomCode strips dashes/spaces and uppercases safely', () => {
  assert.equal(normalizeRoomCode(' hvn-482 '), 'HVN482');
  assert.equal(normalizeRoomCode('ab!@#cd12345'), 'ABCD1234');
});

test('isValidRoomCode validates 4-8 uppercase alphanumeric characters', () => {
  assert.equal(isValidRoomCode('HVN482'), true);
  assert.equal(isValidRoomCode('AB12'), true);
  assert.equal(isValidRoomCode('AB1'), false);
  assert.equal(isValidRoomCode('abc123'), false);
  assert.equal(isValidRoomCode('HVN-48'), false);
});

test('generateRoomCode creates 6-char readable codes matching isValidRoomCode', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    assert.equal(isValidRoomCode(code), true);
  }
});

test('computeSyncedPositionSeconds advances position only while playing and wraps cleanly', () => {
  const pausedPos = computeSyncedPositionSeconds(
    { isPlaying: false, positionSeconds: 42.5, updatedAtMs: 1000, trackDuration: 180 },
    11000
  );
  assert.equal(pausedPos, 42.5);

  const playingPos = computeSyncedPositionSeconds(
    { isPlaying: true, positionSeconds: 42.5, updatedAtMs: 1000, trackDuration: 180 },
    11000
  );
  assert.equal(playingPos, 52.5);

  const wrappedPos = computeSyncedPositionSeconds(
    { isPlaying: true, positionSeconds: 175, updatedAtMs: 1000, trackDuration: 180 },
    11000
  );
  assert.equal(wrappedPos, 5);
});

test('shouldSeekOnSync prevents jitter inside tolerance window', () => {
  assert.equal(shouldSeekOnSync(40.0, 40.9, 1.6), false);
  assert.equal(shouldSeekOnSync(40.0, 42.2, 1.6), true);
});
