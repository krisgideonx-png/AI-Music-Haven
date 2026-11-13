import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLyricalHighlights,
  buildStoryGenerationPrompt,
  buildFallbackStory,
} from './storyBuilder';

test('extractLyricalHighlights skips section tags and picks core lyric lines', () => {
  const lyrics = `
[Verse 1]
Walking through the neon rain alone
Searching for a frequency called home
[Chorus]
We carry survival in every breath
`;
  const lines = extractLyricalHighlights(lyrics);
  assert.deepEqual(lines, [
    'Walking through the neon rain alone',
    'Searching for a frequency called home',
    'We carry survival in every breath',
  ]);
});

test('buildStoryGenerationPrompt includes both description and lyrics', () => {
  const prompt = buildStoryGenerationPrompt({
    title: 'Survival',
    creator: 'Elitically',
    description: 'An anthem about resilience after dark nights.',
    lyrics: '[Chorus]\nStand tall against the tide, the dawn is waiting',
  });
  assert.match(prompt, /Song Description: An anthem about resilience after dark nights\./);
  assert.match(prompt, /Stand tall against the tide, the dawn is waiting/);
});

test('buildFallbackStory weaves both description and lyrics when provided', () => {
  const story = buildFallbackStory({
    title: 'Midnight Beacon',
    creator: 'Nova',
    genre: 'Synthwave',
    mood: 'Euphoric',
    description: 'A hopeful journey through static toward sunrise.',
    lyrics: '[Verse]\nFollow the skyline glow\nLeave the shadows down below',
  });
  assert.match(story, /Midnight Beacon/);
  assert.match(story, /hopeful journey through static toward sunrise/i);
  assert.match(story, /Follow the skyline glow/);
});
