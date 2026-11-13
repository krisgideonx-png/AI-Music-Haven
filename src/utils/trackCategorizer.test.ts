import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAudioFile,
  deriveTitleFromFilename,
  buildCreatorHandle,
  applyCategoryConfirmation,
  sanitizeTrackForFirestore,
  sanitizeTrackUpdates,
  MAX_UPLOAD_BYTES,
} from './trackCategorizer.ts';
import type { UploadDraft, AudioTrack } from '../types/index.ts';

test('validateAudioFile accepts valid audio extensions within size limit', () => {
  const wav = validateAudioFile({ name: 'cyber_solitude.wav', size: 1024 * 1024 * 12, type: 'audio/wav' });
  assert.equal(wav.valid, true);
  assert.equal(wav.formatLabel, 'WAV 24-bit Lossless');

  const mp3 = validateAudioFile({ name: 'neon_pulse.mp3', size: 8_000_000, type: 'audio/mpeg' });
  assert.equal(mp3.valid, true);
  assert.equal(mp3.formatLabel, 'MP3 320kbps');
});

test('validateAudioFile rejects non-audio files, empty files, and oversized files', () => {
  const exe = validateAudioFile({ name: 'malware.exe', size: 5000, type: 'application/octet-stream' });
  assert.equal(exe.valid, false);

  const empty = validateAudioFile({ name: 'blank.wav', size: 0, type: 'audio/wav' });
  assert.equal(empty.valid, false);

  const huge = validateAudioFile({ name: 'huge.flac', size: MAX_UPLOAD_BYTES + 1, type: 'audio/flac' });
  assert.equal(huge.valid, false);
});

test('deriveTitleFromFilename formats filenames cleanly', () => {
  assert.equal(deriveTitleFromFilename('cyber_solitude-final.wav'), 'Cyber Solitude Final');
  assert.equal(deriveTitleFromFilename('   .mp3'), 'Untitled AI Track');
});

test('buildCreatorHandle never leaks raw email and stays within bounds', () => {
  const handle = buildCreatorHandle('Ada Lovelace', 'Uid123456789');
  assert.equal(handle, '@ada_lovelace_uid1');
  assert.equal(handle.includes('@gmail'), false);
});

test('applyCategoryConfirmation adopts suggested category or custom override and marks confirmed', () => {
  const baseDraft: UploadDraft = {
    fileName: 'track.wav',
    fileSize: 1024,
    title: 'Track',
    creator: 'Ada',
    creatorHandle: '@ada',
    coverArt: 'https://example.com/art.jpg',
    aiToolOrigin: 'Suno v3.5',
    description: 'Desc',
    genre: 'Electronic',
    subgenre: 'Electro',
    mood: 'Calm',
    bpm: 120,
    key: 'C Minor',
    instruments: ['Synth'],
    vocalType: 'Instrumental',
    language: 'English',
    energyLevel: 'Medium',
    musicalStyle: 'Ambient',
    license: 'Commercial Permitted',
    analyzing: false,
    analysisComplete: true,
    analysisProgress: 100,
    suggestedGenre: 'Synthwave',
    suggestedSubgenre: 'Dark Synthwave',
    categoryConfirmed: false,
  };

  const accepted = applyCategoryConfirmation(baseDraft, true);
  assert.equal(accepted.genre, 'Synthwave');
  assert.equal(accepted.subgenre, 'Dark Synthwave');
  assert.equal(accepted.categoryConfirmed, true);

  const overridden = applyCategoryConfirmation(baseDraft, false, {
    genre: 'Lo-Fi Chill',
    subgenre: 'Study Beats',
    mood: 'Chill & Focused',
  });
  assert.equal(overridden.genre, 'Lo-Fi Chill');
  assert.equal(overridden.subgenre, 'Study Beats');
  assert.equal(overridden.mood, 'Chill & Focused');
  assert.equal(overridden.categoryConfirmed, true);
});

test('sanitizeTrackForFirestore enforces bounds and omits PII', () => {
  const longTitle = 'A'.repeat(250);
  const track: AudioTrack = {
    id: 'trk/bad id!',
    title: longTitle,
    creator: 'Creator Name',
    creatorHandle: '@creator',
    creatorAvatar: 'https://example.com/a.jpg',
    description: 'D'.repeat(2000),
    aiToolOrigin: 'Suno v3.5',
    bpm: 999,
    key: 'C Minor',
    duration: 210,
    genre: 'Synthwave',
    subgenre: 'Outrun',
    mood: 'Euphoric',
    vocalType: 'Instrumental',
    instruments: Array.from({ length: 20 }, (_, i) => `Inst-${i}`),
    language: 'English',
    energyLevel: 'High',
    musicalStyle: 'Retro',
    license: 'Commercial Permitted',
    coverArt: 'https://example.com/c.jpg',
    waveform: Array.from({ length: 200 }, () => 1.5),
    createdAt: 'Just now',
    plays: -5,
    likes: 1,
    downloads: 0,
    reposts: 0,
    rating: 9,
    ratingCount: 0,
    fileFormat: 'WAV',
    fileSize: '12 MB',
    sampleRate: '48 kHz',
    lufs: 10,
    comments: [],
    suggestedGenre: 'Synthwave',
    suggestedSubgenre: 'Outrun',
    categoryConfirmed: true,
  };

  const sanitized = sanitizeTrackForFirestore(track, 'user-abc');
  assert.equal(String(sanitized.title).length, 120);
  assert.equal(String(sanitized.description).length, 1000);
  assert.equal(sanitized.bpm, 240);
  assert.equal(sanitized.lufs, 0);
  assert.equal((sanitized.instruments as string[]).length, 10);
  assert.equal((sanitized.waveform as number[]).length, 128);
  assert.equal(sanitized.uploaderUid, 'user-abc');
  assert.equal('email' in sanitized, false);
});

test('sanitizeTrackUpdates cleans editable metadata and ignores protected fields', () => {
  const updates = sanitizeTrackUpdates({
    id: 'hacked-id',
    uploaderUid: 'someone-else',
    plays: 999999,
    title: `  ${'T'.repeat(200)}  `,
    creator: '  New Artist Name  ',
    bpm: 310,
    license: 'Commercial Permitted',
    description: '  Updated song story  ',
    story: `  ${'S'.repeat(1700)}  `,
  });

  assert.equal('id' in updates, false);
  assert.equal('uploaderUid' in updates, false);
  assert.equal('plays' in updates, false);
  assert.equal(updates.title?.length, 120);
  assert.equal(updates.creator, 'New Artist Name');
  assert.equal(updates.bpm, 240);
  assert.equal(updates.license, 'Commercial Permitted');
  assert.equal(updates.description, 'Updated song story');
  assert.equal(updates.story?.length, 1500);
});
