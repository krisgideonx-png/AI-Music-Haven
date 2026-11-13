import type { AudioTrack, HavenLicense, UploadDraft } from '../types/index.ts';

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'] as const;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export const CANONICAL_GENRES = [
  'Cyberpunk Ambient',
  'Synthwave',
  'Ambient',
  'Lo-Fi Chill',
  'Cyber-Funk',
  'Orchestral Epic',
  'Afrobeat Future',
  'Electronic',
  'Experimental',
  'Jazztronica',
  'Drum & Bass',
  'Indie Pop',
  'Hip-Hop',
] as const;

export const CANONICAL_MOODS = [
  'Atmospheric',
  'Euphoric',
  'Dark & Moody',
  'Chill & Focused',
  'Uplifting',
  'Cybernetic',
  'Dramatic',
  'Melancholic',
] as const;

export interface AudioFileValidation {
  valid: boolean;
  reason?: string;
  formatLabel: string;
}

export interface CategorySuggestionItem {
  genre: string;
  subgenre: string;
  confidence: number;
}

export interface CategorizationResult {
  suggestedGenre: string;
  suggestedSubgenre: string;
  alternativeCategories: CategorySuggestionItem[];
  mood: string;
  bpm: number;
  key: string;
  vocalType: string;
  energyLevel: 'Chill' | 'Medium' | 'High' | 'Explosive';
  musicalStyle: string;
  instruments: string[];
  confidence: number;
  reasoning: string;
}

export function validateAudioFile(file: {
  name: string;
  size: number;
  type?: string;
}): AudioFileValidation {
  const lowerName = (file.name || '').trim().toLowerCase();
  const matchedExt = SUPPORTED_AUDIO_EXTENSIONS.find((ext) => lowerName.endsWith(ext));
  const isAudioMime = Boolean(file.type && file.type.startsWith('audio/'));

  if (!matchedExt && !isAudioMime) {
    return {
      valid: false,
      reason: `Unsupported file format. Please select a completed audio file (${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}).`,
      formatLabel: 'Unknown',
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      reason: 'The selected audio file appears empty (0 bytes).',
      formatLabel: 'Empty',
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      reason: 'File exceeds the 100 MB upload limit per song.',
      formatLabel: matchedExt ? matchedExt.slice(1).toUpperCase() : 'AUDIO',
    };
  }

  const extLabel = matchedExt ? matchedExt.slice(1).toUpperCase() : 'AUDIO';
  const formatMap: Record<string, string> = {
    WAV: 'WAV 24-bit Lossless',
    FLAC: 'FLAC Lossless',
    MP3: 'MP3 320kbps',
    OGG: 'OGG Vorbis',
    M4A: 'M4A / AAC',
    AAC: 'AAC High Efficiency',
  };

  return {
    valid: true,
    formatLabel: formatMap[extLabel] || extLabel,
  };
}

export function deriveTitleFromFilename(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  const cleaned = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Untitled AI Track';

  return cleaned
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
    .slice(0, 120);
}

export function buildCreatorHandle(displayName?: string | null, uid?: string | null): string {
  const base = (displayName || 'creator')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  const suffix = uid ? `_${uid.slice(0, 4).toLowerCase()}` : '';
  return `@${base || 'haven_creator'}${suffix}`.slice(0, 32);
}

export function applyCategoryConfirmation(
  draft: UploadDraft,
  acceptedSuggested: boolean,
  overrides?: { genre?: string; subgenre?: string; mood?: string }
): UploadDraft {
  if (acceptedSuggested && draft.suggestedGenre) {
    return {
      ...draft,
      genre: draft.suggestedGenre,
      subgenre: draft.suggestedSubgenre || draft.subgenre,
      categoryConfirmed: true,
    };
  }

  return {
    ...draft,
    genre: (overrides?.genre ?? draft.genre).trim() || draft.genre,
    subgenre: (overrides?.subgenre ?? draft.subgenre).trim() || draft.subgenre,
    mood: (overrides?.mood ?? draft.mood).trim() || draft.mood,
    categoryConfirmed: true,
  };
}

export function sanitizeString(value: string, maxLength: number, fallback = ''): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function buildSafeTrackId(rawSeed?: string): string {
  const sanitized = (rawSeed || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `trk_${sanitized || 'upload'}_${Date.now()}_${suffix}`.slice(0, 80);
}

export function sanitizeTrackForFirestore(
  track: AudioTrack,
  uploaderUid: string
): Record<string, unknown> {
  const safeGenresList = Array.isArray(track.instruments)
    ? track.instruments
        .map((item) => sanitizeString(String(item), 48))
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const safeWaveform = Array.isArray(track.waveform)
    ? track.waveform
        .slice(0, 128)
        .map((v) => clampNumber(Number(v), 0, 1, 0.25))
    : [0.2, 0.5, 0.3];

  const validLicenses: HavenLicense[] = [
    'Free Personal',
    'Attribution Required',
    'Commercial Permitted',
    'All Rights Reserved',
  ];

  const validEnergies = ['Chill', 'Medium', 'High', 'Explosive'] as const;

  return {
    id: sanitizeString(track.id, 128).replace(/[^a-zA-Z0-9_-]/g, '_'),
    uploaderUid: sanitizeString(uploaderUid, 128),
    title: sanitizeString(track.title, 120, 'Untitled AI Track'),
    creator: sanitizeString(track.creator, 80, 'Haven Creator'),
    creatorHandle: sanitizeString(track.creatorHandle, 40, '@creator'),
    creatorAvatar: sanitizeString(
      track.creatorAvatar,
      500,
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
    ),
    description: sanitizeString(track.description, 1000, 'Uploaded to AI Music Haven.'),
    ...(typeof track.story === 'string' && track.story.trim()
      ? { story: sanitizeString(track.story, 1500) }
      : {}),
    ...(typeof track.lyrics === 'string' && track.lyrics.trim()
      ? { lyrics: sanitizeString(track.lyrics, 4000) }
      : {}),
    aiToolOrigin: sanitizeString(track.aiToolOrigin, 60, 'Custom / Fine-Tuned'),
    bpm: Math.round(clampNumber(track.bpm, 40, 240, 120)),
    key: sanitizeString(track.key, 30, 'C Minor'),
    duration: Math.round(clampNumber(track.duration, 1, 3600, 180)),
    genre: sanitizeString(track.genre, 60, 'Electronic'),
    subgenre: sanitizeString(track.subgenre, 60, 'Ambient'),
    mood: sanitizeString(track.mood, 60, 'Atmospheric'),
    vocalType: sanitizeString(track.vocalType, 80, 'Instrumental'),
    instruments: safeGenresList.length > 0 ? safeGenresList : ['Synthesizer'],
    language: sanitizeString(track.language, 40, 'Instrumental'),
    energyLevel: validEnergies.includes(track.energyLevel) ? track.energyLevel : 'Medium',
    musicalStyle: sanitizeString(track.musicalStyle, 100, 'Modern AI Composition'),
    license: validLicenses.includes(track.license) ? track.license : 'Attribution Required',
    coverArt: sanitizeString(
      track.coverArt,
      500,
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
    ),
    waveform: safeWaveform.length > 0 ? safeWaveform : [0.3, 0.6, 0.4],
    fileFormat: sanitizeString(track.fileFormat, 60, 'WAV 24-bit'),
    fileSize: sanitizeString(track.fileSize, 32, '10.0 MB'),
    sampleRate: sanitizeString(track.sampleRate, 40, '48 kHz / 24-bit'),
    lufs: clampNumber(track.lufs, -70, 0, -14.0),
    suggestedGenre: sanitizeString(track.suggestedGenre || track.genre, 60, 'Electronic'),
    suggestedSubgenre: sanitizeString(track.suggestedSubgenre || track.subgenre, 60, 'Ambient'),
    categoryConfirmed: Boolean(track.categoryConfirmed),
    plays: Math.max(0, Math.round(track.plays || 0)),
    likes: Math.max(0, Math.round(track.likes || 0)),
    downloads: Math.max(0, Math.round(track.downloads || 0)),
    reposts: Math.max(0, Math.round(track.reposts || 0)),
    rating: clampNumber(track.rating, 1, 5, 5),
    ratingCount: Math.max(1, Math.round(track.ratingCount || 1)),
    visibility: 'public',
  };
}

export function sanitizeTrackUpdates(updates: Partial<AudioTrack>): Partial<AudioTrack> {
  const validLicenses: HavenLicense[] = [
    'Free Personal',
    'Attribution Required',
    'Commercial Permitted',
    'All Rights Reserved',
  ];

  const cleaned: Partial<AudioTrack> = {};

  if (typeof updates.title === 'string') {
    cleaned.title = sanitizeString(updates.title, 120, 'Untitled AI Track');
  }
  if (typeof updates.creator === 'string') {
    cleaned.creator = sanitizeString(updates.creator, 80, 'Haven Creator');
  }
  if (typeof updates.description === 'string') {
    cleaned.description = sanitizeString(updates.description, 1000, 'Uploaded to AI Music Haven.');
  }
  if (typeof updates.story === 'string') {
    cleaned.story = sanitizeString(updates.story, 1500, '');
  }
  if (typeof updates.lyrics === 'string') {
    cleaned.lyrics = sanitizeString(updates.lyrics, 4000, '');
  }
  if (typeof updates.genre === 'string') {
    cleaned.genre = sanitizeString(updates.genre, 60, 'Electronic');
  }
  if (typeof updates.subgenre === 'string') {
    cleaned.subgenre = sanitizeString(updates.subgenre, 60, 'Ambient');
  }
  if (typeof updates.mood === 'string') {
    cleaned.mood = sanitizeString(updates.mood, 60, 'Atmospheric');
  }
  if (typeof updates.bpm === 'number') {
    cleaned.bpm = Math.round(clampNumber(updates.bpm, 40, 240, 120));
  }
  if (typeof updates.key === 'string') {
    cleaned.key = sanitizeString(updates.key, 30, 'C Minor');
  }
  if (typeof updates.vocalType === 'string') {
    cleaned.vocalType = sanitizeString(updates.vocalType, 80, 'Instrumental');
  }
  if (typeof updates.aiToolOrigin === 'string') {
    cleaned.aiToolOrigin = sanitizeString(updates.aiToolOrigin, 60, 'Custom / Fine-Tuned');
  }
  if (updates.license && validLicenses.includes(updates.license)) {
    cleaned.license = updates.license;
  }
  if (typeof updates.coverArt === 'string') {
    cleaned.coverArt = sanitizeString(
      updates.coverArt,
      500,
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
    );
  }
  if (typeof updates.categoryConfirmed === 'boolean') {
    cleaned.categoryConfirmed = updates.categoryConfirmed;
  }

  return cleaned;
}
