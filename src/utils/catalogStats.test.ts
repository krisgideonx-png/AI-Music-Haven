import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_TRACKS,
  INITIAL_CREATORS,
  INITIAL_PLAYLISTS,
} from '../data/initialTracks.ts';
import {
  computeCatalogStats,
  countTracksInHomeGenreBucket,
  computeCreatorMetricsFromTracks,
  countExistingPlaylistTracks,
  parseFileSizeMb,
  computeDownloadedCacheStats,
  computeCreatorAnalyticsDistribution,
  formatCompactCount,
} from './catalogStats.ts';

test('computeCatalogStats counts INITIAL_TRACKS songs, unique creators, genres, and subgenres accurately', () => {
  const stats = computeCatalogStats(INITIAL_TRACKS);
  assert.equal(stats.songCount, 14);
  // 14 tracks include 2 tracks by Solstice Horizon (@solstice_hz), so 13 unique creators
  assert.equal(stats.creatorCount, 13);
  assert.equal(stats.genreCount, 10);
  assert.equal(stats.subgenreCount, 14);
  assert.equal(stats.genreAndSubgenreCount, 24);
  assert.ok(stats.totalPlays > 0);
});

test('computeCatalogStats returns zeros for empty catalog and updates when track is removed', () => {
  const emptyStats = computeCatalogStats([]);
  assert.equal(emptyStats.songCount, 0);
  assert.equal(emptyStats.creatorCount, 0);
  assert.equal(emptyStats.genreCount, 0);
  assert.equal(emptyStats.genreAndSubgenreCount, 0);

  const withoutObsidian = INITIAL_TRACKS.filter((t) => t.id !== 'trk-01-obsidian');
  const nextStats = computeCatalogStats(withoutObsidian);
  assert.equal(nextStats.songCount, 13);
  assert.equal(nextStats.creatorCount, 12);
  assert.equal(nextStats.genreCount, 9);
});

test('countTracksInHomeGenreBucket accurately counts matching songs without double counting Cyberpunk Ambient', () => {
  assert.equal(countTracksInHomeGenreBucket(INITIAL_TRACKS, 'cyberpunk'), 1);
  assert.equal(countTracksInHomeGenreBucket(INITIAL_TRACKS, 'afrobeat'), 1);
  assert.equal(countTracksInHomeGenreBucket(INITIAL_TRACKS, 'neurofunk'), 1);
  assert.equal(countTracksInHomeGenreBucket(INITIAL_TRACKS, 'neo-classical'), 1);
  assert.equal(countTracksInHomeGenreBucket(INITIAL_TRACKS, 'synthwave'), 1);
  assert.equal(countTracksInHomeGenreBucket(INITIAL_TRACKS, 'lo-fi'), 2);
});

test('computeCreatorMetricsFromTracks aggregates live plays and downloads per creator', () => {
  const valery = INITIAL_CREATORS.find((c) => c.handle === '@valery_v');
  assert.ok(valery);
  const metrics = computeCreatorMetricsFromTracks(valery, INITIAL_TRACKS);
  assert.equal(metrics.trackCount, 1);
  assert.equal(metrics.totalPlays, 14820);
  assert.equal(metrics.totalDownloads, 3840);

  const afterRemoval = computeCreatorMetricsFromTracks(
    valery,
    INITIAL_TRACKS.filter((t) => t.id !== 'trk-01-obsidian')
  );
  assert.equal(afterRemoval.trackCount, 0);
  assert.equal(afterRemoval.totalPlays, 0);
  assert.equal(afterRemoval.totalDownloads, 0);
});

test('countExistingPlaylistTracks ignores deleted or taken-down track IDs', () => {
  const cyberDrift = INITIAL_PLAYLISTS[0];
  assert.equal(countExistingPlaylistTracks(cyberDrift, INITIAL_TRACKS), 3);

  const withoutObsidian = INITIAL_TRACKS.filter((t) => t.id !== 'trk-01-obsidian');
  assert.equal(countExistingPlaylistTracks(cyberDrift, withoutObsidian), 2);
});

test('parseFileSizeMb & computeDownloadedCacheStats compute exact cache count and MB size', () => {
  assert.equal(parseFileSizeMb('4.5 MB'), 4.5);
  assert.equal(parseFileSizeMb('512 KB'), 0.5);
  assert.equal(parseFileSizeMb('1 GB'), 1024);
  assert.equal(parseFileSizeMb(''), 0);

  const cacheStats = computeDownloadedCacheStats(INITIAL_TRACKS.slice(0, 3));
  assert.equal(cacheStats.trackCount, 3);
  assert.equal(cacheStats.totalSizeMb, 10.1);
  assert.equal(cacheStats.formattedSize, '10.1 MB');
});

test('computeCreatorAnalyticsDistribution returns zeros for 0 plays and sums cleanly for active plays', () => {
  const zeroDist = computeCreatorAnalyticsDistribution(0, '30d');
  assert.equal(zeroDist.scopedTotalPlays, 0);
  assert.equal(zeroDist.peakPlays, 0);
  assert.ok(zeroDist.bars.every((b) => b.plays === 0 && b.heightPercent === 0));
  assert.ok(zeroDist.regions.every((r) => r.plays === 0 && r.percentageValue === 0));

  const distAll = computeCreatorAnalyticsDistribution(1000, 'all');
  assert.equal(distAll.scopedTotalPlays, 1000);
  assert.equal(
    distAll.bars.reduce((s, b) => s + b.plays, 0),
    1000
  );
  assert.equal(
    distAll.regions.reduce((s, r) => s + r.plays, 0),
    1000
  );
  assert.equal(distAll.bars.length, 14);

  const dist7d = computeCreatorAnalyticsDistribution(1000, '7d');
  assert.equal(dist7d.bars.length, 7);
  assert.equal(
    dist7d.bars.reduce((s, b) => s + b.plays, 0),
    dist7d.scopedTotalPlays
  );
});

test('formatCompactCount formats small and large integers cleanly', () => {
  assert.equal(formatCompactCount(0), '0');
  assert.equal(formatCompactCount(420), '420');
  assert.equal(formatCompactCount(14820), '14.8k');
  assert.equal(formatCompactCount(148200), '148k');
  assert.equal(formatCompactCount(1250000), '1.3M');
});
