import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBatchFileDescriptors,
  buildFallbackCategorization,
  buildDeterministicCoverSpec,
} from './batchUpload.ts';

test('parseBatchFileDescriptors accepts multiple valid audio files and separates invalid ones', () => {
  const { accepted, rejected } = parseBatchFileDescriptors(
    [
      { name: '01_neon_dawn.mp3', size: 4_200_000, type: 'audio/mpeg' },
      { name: '02_amapiano_sunset.wav', size: 18_500_000, type: 'audio/wav' },
      { name: 'cover_notes.txt', size: 1024, type: 'text/plain' },
      { name: 'empty.mp3', size: 0, type: 'audio/mpeg' },
    ],
    'Alex Rivera',
    'uid12345'
  );

  assert.equal(accepted.length, 2);
  assert.equal(rejected.length, 2);
  assert.equal(accepted[0].draft.title, '01 Neon Dawn');
  assert.equal(accepted[1].draft.title, '02 Amapiano Sunset');
  assert.equal(accepted[0].draft.creator, 'Alex Rivera');
  assert.equal(accepted[0].draft.categoryConfirmed, false);
});

test('buildFallbackCategorization adapts genre, bpm, and mood to file/title cues', () => {
  const lofi = buildFallbackCategorization({
    fileName: 'tokyo_rain_lofi.mp3',
    title: 'Tokyo Rain Lofi',
  });
  assert.equal(lofi.suggestedGenre, 'Lo-Fi Chill');
  assert.equal(lofi.bpm, 84);

  const cyber = buildFallbackCategorization({
    fileName: 'obsidian_cyber_night.wav',
    title: 'Obsidian Cyber Night',
  });
  assert.equal(cyber.suggestedGenre, 'Cyberpunk Ambient');
});

test('buildDeterministicCoverSpec creates valid hex palette and motif deterministically', () => {
  const specA = buildDeterministicCoverSpec({
    title: 'Solaris',
    genre: 'Synthwave',
    mood: 'Euphoric',
    energyLevel: 'High',
  });
  const specB = buildDeterministicCoverSpec({
    title: 'Solaris',
    genre: 'Synthwave',
    mood: 'Euphoric',
    energyLevel: 'High',
  });
  assert.deepEqual(specA, specB);
  assert.match(specA.primaryHex, /^#[0-9A-F]{6}$/i);
  assert.equal(specA.energyRingCount, 6);
});
