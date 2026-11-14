import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRequestOrigin,
  isRasterShareImageUrl,
  normalizeTrackOgImageUrl,
  resolveShareMetadata,
  injectOpenGraphMeta,
} from './ogMeta.ts';
import { INITIAL_TRACKS } from '../data/initialTracks.ts';

test('resolveRequestOrigin handles reverse proxy headers and localhost cleanly', () => {
  assert.equal(
    resolveRequestOrigin({
      headers: {
        'x-forwarded-host': 'ais-pre-example.europe-west2.run.app',
        'x-forwarded-proto': 'https',
      },
    }),
    'https://ais-pre-example.europe-west2.run.app'
  );

  assert.equal(
    resolveRequestOrigin({
      headers: { host: 'localhost:3000' },
      protocol: 'http',
    }),
    'http://localhost:3000'
  );
});

test('isRasterShareImageUrl rejects SVG URLs and relative paths while accepting raster HTTPS URLs', () => {
  assert.equal(isRasterShareImageUrl('/api/covers/cov_123.svg'), false);
  assert.equal(isRasterShareImageUrl('https://example.com/cover.svg?v=1'), false);
  assert.equal(isRasterShareImageUrl('/og-image.jpg'), false);
  assert.equal(
    isRasterShareImageUrl('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'),
    true
  );
});

test('normalizeTrackOgImageUrl upgrades Unsplash crop to 1200x630 JPEG (no auto=format) and falls back to null on SVG', () => {
  const upgraded = normalizeTrackOgImageUrl(
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'
  );
  assert.ok(upgraded);
  assert.ok(upgraded.includes('w=1200'));
  assert.ok(upgraded.includes('h=630'));
  assert.ok(upgraded.includes('fm=jpg'));
  assert.equal(upgraded.includes('auto=format'), false);
  assert.equal(normalizeTrackOgImageUrl('/api/covers/cov_abc.svg'), null);
});

test('resolveShareMetadata returns site banner OG image by default and track cover when track is supplied', () => {
  const origin = 'https://ais-pre-example.europe-west2.run.app';
  const siteMeta = resolveShareMetadata({ origin, pathname: '/' });
  assert.equal(siteMeta.imageUrl, `${origin}/og-image.jpg`);
  assert.equal(siteMeta.ogType, 'website');
  assert.equal(siteMeta.imageWidth, '1376');
  assert.equal(siteMeta.imageHeight, '768');

  const superhuman = INITIAL_TRACKS[0];
  const trackMeta = resolveShareMetadata({ origin, pathname: '/', track: superhuman });
  assert.equal(trackMeta.ogType, 'music.song');
  assert.ok(trackMeta.title.includes(superhuman.title));
  assert.ok(trackMeta.title.includes(superhuman.creator));
  assert.ok(trackMeta.imageUrl.startsWith('https://images.unsplash.com/'));
  assert.ok(trackMeta.imageUrl.includes('fm=jpg'));
  assert.equal(trackMeta.url, `${origin}/?track=${encodeURIComponent(superhuman.id)}`);

  const svgTrackMeta = resolveShareMetadata({
    origin,
    pathname: '/',
    track: {
      id: 'trk_custom_1',
      title: 'Neon Horizon',
      creator: 'Alex',
      coverArt: '/api/covers/cov_1234.svg',
    },
  });
  assert.equal(svgTrackMeta.imageUrl, `${origin}/og-image.jpg`);
});

test('injectOpenGraphMeta sets og:image, og:url, twitter:image, twitter:url on minified and dollar-sign titles cleanly', () => {
  const minifiedHtml =
    '<!doctype html><html><head><title>Placeholder</title><meta name="description" content="Old"><meta property="og:title" content="Old"><meta property="og:image" content="https://old.example/x.jpg"><meta name="twitter:card" content="summary"></head><body></body></html>';

  const meta = resolveShareMetadata({
    origin: 'https://ais-pre-example.europe-west2.run.app',
    pathname: '/',
    track: {
      id: 'trk-quoted',
      title: 'Midnight "Echo" & $$ Glow',
      creator: 'Kofi',
      genre: 'Afrobeat',
      bpm: 106,
      aiToolOrigin: 'Udio v1.5',
      coverArt: '/api/covers/cov_custom.svg',
    },
  });

  const injected = injectOpenGraphMeta(minifiedHtml, meta);
  assert.ok(injected.includes('content="https://ais-pre-example.europe-west2.run.app/og-image.jpg"'));
  assert.ok(injected.includes('property="og:image"'));
  assert.ok(injected.includes('name="twitter:image"'));
  assert.ok(injected.includes('name="twitter:url"'));
  assert.ok(injected.includes('content="summary_large_image"'));
  assert.ok(injected.includes('Midnight &quot;Echo&quot; &amp; $$ Glow'));
  assert.ok(injected.includes('<link rel="canonical" href="https://ais-pre-example.europe-west2.run.app/?track=trk-quoted"'));
});
