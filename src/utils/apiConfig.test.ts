import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CLOUD_RUN_API_URL,
  isStaticHostingOrigin,
  resolveApiBaseUrl,
  buildApiUrl,
} from './apiConfig.ts';

test('isStaticHostingOrigin detects GitHub Pages domains and leaves full-stack hosts false', () => {
  assert.equal(isStaticHostingOrigin('krisgideonx-png.github.io'), true);
  assert.equal(isStaticHostingOrigin('example.GITHUB.IO'), true);
  assert.equal(isStaticHostingOrigin('ai-music-haven-287128902590.europe-west3.run.app'), false);
  assert.equal(isStaticHostingOrigin('localhost'), false);
  assert.equal(isStaticHostingOrigin(''), false);
});

test('resolveApiBaseUrl routes GitHub Pages traffic to Cloud Run and keeps full-stack origins relative', () => {
  assert.equal(
    resolveApiBaseUrl({ hostname: 'krisgideonx-png.github.io', envApiBaseUrl: '' }),
    DEFAULT_CLOUD_RUN_API_URL
  );
  assert.equal(
    resolveApiBaseUrl({
      hostname: 'krisgideonx-png.github.io',
      envApiBaseUrl: 'https://custom-backend.example.com/',
    }),
    'https://custom-backend.example.com'
  );
  assert.equal(
    resolveApiBaseUrl({
      hostname: 'ai-music-haven-287128902590.europe-west3.run.app',
      envApiBaseUrl: 'https://ai-music-haven-287128902590.europe-west3.run.app',
    }),
    ''
  );
  assert.equal(
    resolveApiBaseUrl({ hostname: 'localhost', envApiBaseUrl: DEFAULT_CLOUD_RUN_API_URL }),
    ''
  );
});

test('buildApiUrl builds full Cloud Run API URLs on GitHub Pages and preserves absolute URLs', () => {
  assert.equal(
    buildApiUrl('/api/generate-story', { hostname: 'krisgideonx-png.github.io', envApiBaseUrl: '' }),
    `${DEFAULT_CLOUD_RUN_API_URL}/api/generate-story`
  );
  assert.equal(
    buildApiUrl('api/rooms/HAVEN1/events', { hostname: 'krisgideonx-png.github.io', envApiBaseUrl: '' }),
    `${DEFAULT_CLOUD_RUN_API_URL}/api/rooms/HAVEN1/events`
  );
  assert.equal(
    buildApiUrl('/api/covers/cov_123.svg', { hostname: 'krisgideonx-png.github.io', envApiBaseUrl: '' }),
    `${DEFAULT_CLOUD_RUN_API_URL}/api/covers/cov_123.svg`
  );
  assert.equal(
    buildApiUrl('/api/categorize', { hostname: 'localhost', envApiBaseUrl: '' }),
    '/api/categorize'
  );
  assert.equal(
    buildApiUrl('https://cdn.example.com/custom.svg', { hostname: 'krisgideonx-png.github.io' }),
    'https://cdn.example.com/custom.svg'
  );
});
