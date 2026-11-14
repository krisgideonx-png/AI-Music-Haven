import type { AudioTrack, CreatorProfile, Playlist } from '../types/index.ts';

export interface CatalogStats {
  songCount: number;
  creatorCount: number;
  genreCount: number;
  subgenreCount: number;
  genreAndSubgenreCount: number;
  totalPlays: number;
  totalDownloads: number;
  totalLikes: number;
}

export interface CreatorLiveMetrics {
  trackCount: number;
  totalPlays: number;
  totalDownloads: number;
  totalLikes: number;
}

export interface DailyStreamBar {
  label: string;
  plays: number;
  heightPercent: number;
}

export interface RegionalAudienceMetric {
  name: string;
  percentageLabel: string;
  percentageValue: number;
  plays: number;
  formattedPlays: string;
}

export interface CreatorAnalyticsDistribution {
  scopedTotalPlays: number;
  peakPlays: number;
  bars: DailyStreamBar[];
  regions: RegionalAudienceMetric[];
}

export interface OfflineCacheStats {
  trackCount: number;
  totalSizeMb: number;
  formattedSize: string;
}

function normalizeKey(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export function formatCompactCount(value: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  if (safe >= 1_000_000) {
    const m = safe / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (safe >= 1000) {
    const k = safe / 1000;
    return `${k >= 100 || k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return safe.toLocaleString();
}

export function computeCatalogStats(tracks: AudioTrack[]): CatalogStats {
  const creatorKeys = new Set<string>();
  const genreKeys = new Set<string>();
  const subgenreKeys = new Set<string>();
  const combinedTaxonomyKeys = new Set<string>();

  let totalPlays = 0;
  let totalDownloads = 0;
  let totalLikes = 0;

  for (const track of tracks) {
    const creatorKey = normalizeKey(track.creatorHandle) || normalizeKey(track.creator);
    if (creatorKey) {
      creatorKeys.add(creatorKey);
    }

    const genreKey = normalizeKey(track.genre);
    if (genreKey) {
      genreKeys.add(genreKey);
      combinedTaxonomyKeys.add(genreKey);
    }

    const subgenreKey = normalizeKey(track.subgenre);
    if (subgenreKey) {
      subgenreKeys.add(subgenreKey);
      combinedTaxonomyKeys.add(subgenreKey);
    }

    totalPlays += Math.max(0, Math.round(track.plays || 0));
    totalDownloads += Math.max(0, Math.round(track.downloads || 0));
    totalLikes += Math.max(0, Math.round(track.likes || 0));
  }

  return {
    songCount: tracks.length,
    creatorCount: creatorKeys.size,
    genreCount: genreKeys.size,
    subgenreCount: subgenreKeys.size,
    genreAndSubgenreCount: combinedTaxonomyKeys.size,
    totalPlays,
    totalDownloads,
    totalLikes,
  };
}

export type HomeGenreBucketId =
  | 'cyberpunk'
  | 'afrobeat'
  | 'neurofunk'
  | 'neo-classical'
  | 'synthwave'
  | 'lo-fi';

export function countTracksInHomeGenreBucket(
  tracks: AudioTrack[],
  bucketId: HomeGenreBucketId
): number {
  return tracks.filter((t) => {
    const genre = normalizeKey(t.genre);
    const subgenre = normalizeKey(t.subgenre);
    const combined = `${genre} ${subgenre}`;

    switch (bucketId) {
      case 'cyberpunk':
        return combined.includes('cyberpunk') || combined.includes('darkwave');
      case 'afrobeat':
        return (
          combined.includes('afrobeat') ||
          combined.includes('amapiano') ||
          combined.includes('afro-fusion') ||
          combined.includes('afro')
        );
      case 'neurofunk':
        return (
          combined.includes('neurofunk') ||
          combined.includes('drum & bass') ||
          combined.includes('dnb') ||
          combined.includes('techstep')
        );
      case 'neo-classical':
        return (
          combined.includes('neo-classical') ||
          combined.includes('orchestral') ||
          combined.includes('classical') ||
          genre === 'ambient'
        );
      case 'synthwave':
        return (
          combined.includes('synthwave') ||
          combined.includes('retrowave') ||
          combined.includes('outrun')
        );
      case 'lo-fi':
        return (
          combined.includes('lo-fi') ||
          combined.includes('lofi') ||
          combined.includes('chillhop')
        );
    }
  }).length;
}

export function computeCreatorMetricsFromTracks(
  creator: CreatorProfile,
  tracks: AudioTrack[]
): CreatorLiveMetrics {
  const handleKey = normalizeKey(creator.handle);
  const nameKey = normalizeKey(creator.name);

  let trackCount = 0;
  let totalPlays = 0;
  let totalDownloads = 0;
  let totalLikes = 0;

  for (const track of tracks) {
    const trackHandle = normalizeKey(track.creatorHandle);
    const trackCreator = normalizeKey(track.creator);

    const matches =
      (handleKey && trackHandle === handleKey) || (nameKey && trackCreator === nameKey);

    if (matches) {
      trackCount += 1;
      totalPlays += Math.max(0, Math.round(track.plays || 0));
      totalDownloads += Math.max(0, Math.round(track.downloads || 0));
      totalLikes += Math.max(0, Math.round(track.likes || 0));
    }
  }

  return {
    trackCount,
    totalPlays,
    totalDownloads,
    totalLikes,
  };
}

export function countExistingPlaylistTracks(playlist: Playlist, tracks: AudioTrack[]): number {
  if (!Array.isArray(playlist.trackIds) || playlist.trackIds.length === 0) return 0;
  const activeIds = new Set(tracks.map((t) => t.id));
  return playlist.trackIds.filter((id) => activeIds.has(id)).length;
}

export function parseFileSizeMb(sizeLabel?: string): number {
  if (!sizeLabel) return 0;
  const match = sizeLabel.trim().match(/^([\d.]+)\s*(kb|mb|gb)?/i);
  if (!match) return 0;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  const unit = (match[2] || 'mb').toLowerCase();
  if (unit === 'kb') return numeric / 1024;
  if (unit === 'gb') return numeric * 1024;
  return numeric;
}

export function computeDownloadedCacheStats(downloadedTracks: AudioTrack[]): OfflineCacheStats {
  const totalSizeMb = downloadedTracks.reduce((sum, t) => sum + parseFileSizeMb(t.fileSize), 0);
  const rounded = Math.round(totalSizeMb * 10) / 10;
  return {
    trackCount: downloadedTracks.length,
    totalSizeMb: rounded,
    formattedSize: `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} MB`,
  };
}

const DAILY_WEIGHTS_14D = [34, 45, 62, 58, 80, 72, 90, 84, 95, 68, 76, 88, 100, 92];
const REGION_SHARES = [
  { name: 'United States', share: 0.38 },
  { name: 'Japan', share: 0.22 },
  { name: 'Germany', share: 0.16 },
  { name: 'United Kingdom', share: 0.14 },
  { name: 'Nigeria', share: 0.1 },
] as const;

export function computeCreatorAnalyticsDistribution(
  totalPlays: number,
  timeRange: '7d' | '30d' | 'all'
): CreatorAnalyticsDistribution {
  const safeTotal = Math.max(0, Math.round(Number.isFinite(totalPlays) ? totalPlays : 0));
  const rangeFactor = timeRange === '7d' ? 0.35 : timeRange === '30d' ? 0.72 : 1;
  const scopedTotalPlays =
    safeTotal === 0 ? 0 : Math.max(1, Math.round(safeTotal * rangeFactor));

  const activeWeights = timeRange === '7d' ? DAILY_WEIGHTS_14D.slice(-7) : DAILY_WEIGHTS_14D;
  const weightSum = activeWeights.reduce((sum, w) => sum + w, 0);

  let assignedBarPlays = 0;
  const rawBars = activeWeights.map((w, idx) => {
    const label = timeRange === '7d' ? `d${idx + 1}` : `d${idx + 1}`;
    if (scopedTotalPlays === 0) {
      return { label, plays: 0 };
    }
    if (idx === activeWeights.length - 1) {
      return { label, plays: Math.max(0, scopedTotalPlays - assignedBarPlays) };
    }
    const sharePlays = Math.round((scopedTotalPlays * w) / weightSum);
    const bounded = Math.min(sharePlays, Math.max(0, scopedTotalPlays - assignedBarPlays));
    assignedBarPlays += bounded;
    return { label, plays: bounded };
  });

  const peakPlays = rawBars.reduce((max, b) => Math.max(max, b.plays), 0);
  const bars: DailyStreamBar[] = rawBars.map((b) => ({
    label: b.label,
    plays: b.plays,
    heightPercent: peakPlays > 0 ? Math.max(6, Math.round((b.plays / peakPlays) * 100)) : 0,
  }));

  let assignedRegionPlays = 0;
  const regions: RegionalAudienceMetric[] = REGION_SHARES.map((r, idx) => {
    let plays = 0;
    if (scopedTotalPlays > 0) {
      if (idx === REGION_SHARES.length - 1) {
        plays = Math.max(0, scopedTotalPlays - assignedRegionPlays);
      } else {
        plays = Math.min(
          Math.round(scopedTotalPlays * r.share),
          Math.max(0, scopedTotalPlays - assignedRegionPlays)
        );
        assignedRegionPlays += plays;
      }
    }
    const pct = scopedTotalPlays > 0 ? Math.round((plays / scopedTotalPlays) * 100) : 0;
    return {
      name: r.name,
      percentageLabel: `${pct}%`,
      percentageValue: pct,
      plays,
      formattedPlays: formatCompactCount(plays),
    };
  });

  return {
    scopedTotalPlays,
    peakPlays,
    bars,
    regions,
  };
}
