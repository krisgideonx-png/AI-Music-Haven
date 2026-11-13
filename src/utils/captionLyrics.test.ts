import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAudioMimeType,
  isServerLocalAssetUrl,
  parseLyricCaptions,
  getActiveCaptionAtTime,
} from './captionLyrics.ts';

test('normalizeAudioMimeType converts common container types cleanly', () => {
  assert.equal(normalizeAudioMimeType('audio/mpeg', 'song.mp3'), 'audio/mp3');
  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioMimeType('', '/assets/aistudio/survival.mp3'), 'audio/mp3');
  assert.equal(normalizeAudioMimeType('', 'master.flac'), 'audio/flac');
});

test('isServerLocalAssetUrl identifies bundled /assets paths cleanly', () => {
  assert.equal(isServerLocalAssetUrl('/assets/aistudio/song.mp3'), true);
  assert.equal(isServerLocalAssetUrl('blob:http://localhost:3000/1234'), false);
  assert.equal(isServerLocalAssetUrl(undefined), false);
});

test('parseLyricCaptions extracts timestamped and untimed cues accurately', () => {
  const sample = `
[00:05] Walking through the neon rain
[00:14] With your name in mind, I'm superhuman
[01:02] Together we survive
  `;
  const cues = parseLyricCaptions(sample);
  assert.equal(cues.length, 3);
  assert.equal(cues[0].timeSeconds, 5);
  assert.equal(cues[0].timestampLabel, '00:05');
  assert.equal(cues[1].timeSeconds, 14);
  assert.equal(cues[2].timeSeconds, 62);
  assert.equal(cues[2].timestampLabel, '01:02');
});

test('getActiveCaptionAtTime resolves current line for both timed captions and plain lyrics', () => {
  const timed = parseLyricCaptions('[00:00] Intro line\n[00:20] Chorus lift\n[00:50] Final bridge');
  assert.equal(getActiveCaptionAtTime(timed, 2, 120)?.text, 'Intro line');
  assert.equal(getActiveCaptionAtTime(timed, 24, 120)?.text, 'Chorus lift');
  assert.equal(getActiveCaptionAtTime(timed, 75, 120)?.text, 'Final bridge');

  const untimed = parseLyricCaptions('Line one\nLine two\nLine three\nLine four');
  assert.equal(getActiveCaptionAtTime(untimed, 10, 100)?.text, 'Line one');
  assert.equal(getActiveCaptionAtTime(untimed, 60, 100)?.text, 'Line three');
});
