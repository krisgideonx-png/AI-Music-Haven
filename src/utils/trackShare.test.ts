import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrackShareUrl,
  buildTwitterShareUrl,
  buildRedditShareUrl,
  buildDiscordShareMessage,
  parseTrackIdFromSearch,
} from './trackShare.ts';

test('buildTrackShareUrl constructs unique deep link for a track', () => {
  const url = buildTrackShareUrl('https://aimusichaven.app/', '/', 'trk-top-superhuman');
  assert.equal(url, 'https://aimusichaven.app/?track=trk-top-superhuman');
});

test('buildTrackShareUrl encodes special characters cleanly', () => {
  const url = buildTrackShareUrl('http://localhost:3000', '/listen', 'trk custom 1&2');
  assert.equal(url, 'http://localhost:3000/listen?track=trk%20custom%201%262');
});

test('social share builders use the exact same unique share link', () => {
  const shareUrl = buildTrackShareUrl('https://aimusichaven.app', '/', 'trk-top-survival');
  const twitter = new URL(
    buildTwitterShareUrl({ shareUrl, title: 'Survival', creator: 'Elena Kestrel' })
  );
  assert.equal(twitter.origin + twitter.pathname, 'https://twitter.com/intent/tweet');
  assert.equal(twitter.searchParams.get('url'), shareUrl);
  assert.match(twitter.searchParams.get('text') || '', /Survival/);

  const reddit = new URL(
    buildRedditShareUrl({ shareUrl, title: 'Survival', creator: 'Elena Kestrel' })
  );
  assert.equal(reddit.origin + reddit.pathname, 'https://www.reddit.com/submit');
  assert.equal(reddit.searchParams.get('url'), shareUrl);
  assert.match(reddit.searchParams.get('title') || '', /Survival.*Elena Kestrel/);

  const discordMsg = buildDiscordShareMessage({
    shareUrl,
    title: 'Survival',
    creator: 'Elena Kestrel',
  });
  assert.ok(discordMsg.includes(shareUrl));
  assert.ok(discordMsg.includes('Survival'));
});

test('parseTrackIdFromSearch extracts track ID when present and returns null otherwise', () => {
  assert.equal(parseTrackIdFromSearch('?track=trk-top-right-here'), 'trk-top-right-here');
  assert.equal(parseTrackIdFromSearch('track=trk_123&foo=bar'), 'trk_123');
  assert.equal(parseTrackIdFromSearch('?room=HVN482'), null);
  assert.equal(parseTrackIdFromSearch(''), null);
});
