import type { AudioTrack, UploadDraft } from '../types/index.ts';
import {
  buildCreatorHandle,
  deriveTitleFromFilename,
  validateAudioFile,
  type CategorizationResult,
} from './trackCategorizer.ts';

export const MAX_BATCH_FILES = 20;

export const DEFAULT_HAVEN_COVER_ART =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80';

export interface ParsedBatchFileEntry {
  id: string;
  file?: File;
  draft: UploadDraft;
  audioUrl?: string;
}

export interface RejectedBatchFile {
  fileName: string;
  reason: string;
}

export function createInitialDraftFromFile(params: {
  fileName: string;
  fileSize: number;
  formatLabel: string;
  audioUrl?: string;
  creatorName?: string | null;
  creatorUid?: string | null;
  aiToolOrigin?: string;
  durationSeconds?: number;
  sampleRateLabel?: string;
  pitchSemitones?: number;
  pitchRate?: number;
}): UploadDraft {
  const title = deriveTitleFromFilename(params.fileName);
  return {
    fileName: params.fileName,
    fileSize: params.fileSize,
    audioUrl: params.audioUrl,
    pitchSemitones: params.pitchSemitones,
    pitchRate: params.pitchRate,
    fileFormat: params.formatLabel,
    durationSeconds: params.durationSeconds ?? 196,
    sampleRateLabel: params.sampleRateLabel ?? '48 kHz / 24-bit',
    title,
    creator: (params.creatorName || '').trim() || 'Haven Creator',
    creatorHandle: buildCreatorHandle(params.creatorName, params.creatorUid),
    coverArt: DEFAULT_HAVEN_COVER_ART,
    coverGenerated: false,
    aiToolOrigin: params.aiToolOrigin || 'Suno v3.5',
    description: `Original completed AI track "${title}" uploaded to AI Music Haven.`,
    story: '',
    lyrics: '',
    genre: 'Electronic',
    subgenre: 'Ambient',
    mood: 'Atmospheric',
    bpm: 120,
    key: 'C Minor',
    instruments: ['Synthesizer', 'Ambient Pads'],
    vocalType: 'Instrumental',
    language: 'English',
    energyLevel: 'Medium',
    musicalStyle: 'Contemporary AI Audio',
    license: 'Commercial Permitted',
    analyzing: false,
    analysisComplete: false,
    analysisProgress: 0,
    categoryConfirmed: false,
  };
}

export function parseBatchFileDescriptors(
  files: Array<{ name: string; size: number; type?: string; fileRef?: File; audioUrl?: string }>,
  creatorName?: string | null,
  creatorUid?: string | null
): {
  accepted: ParsedBatchFileEntry[];
  rejected: RejectedBatchFile[];
} {
  const accepted: ParsedBatchFileEntry[] = [];
  const rejected: RejectedBatchFile[] = [];

  const capped = files.slice(0, MAX_BATCH_FILES);
  if (files.length > MAX_BATCH_FILES) {
    rejected.push({
      fileName: `${files.length - MAX_BATCH_FILES} additional files`,
      reason: `Batch limit is ${MAX_BATCH_FILES} audio files at once.`,
    });
  }

  capped.forEach((entry, index) => {
    const check = validateAudioFile({
      name: entry.name,
      size: entry.size,
      type: entry.type,
    });
    if (!check.valid) {
      rejected.push({
        fileName: entry.name || `File #${index + 1}`,
        reason: check.reason || 'Unsupported audio file.',
      });
      return;
    }

    const id = `batch_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
    accepted.push({
      id,
      file: entry.fileRef,
      audioUrl: entry.audioUrl,
      draft: createInitialDraftFromFile({
        fileName: entry.name,
        fileSize: entry.size,
        formatLabel: check.formatLabel,
        audioUrl: entry.audioUrl,
        creatorName,
        creatorUid,
      }),
    });
  });

  return { accepted, rejected };
}

/**
 * Deterministic metadata classification fallback used if remote AI categorization
 * is temporarily unreachable during a batch run.
 */
export function buildFallbackCategorization(input: {
  fileName: string;
  title: string;
  description?: string;
}): CategorizationResult {
  const text = `${input.fileName} ${input.title} ${input.description || ''}`.toLowerCase();

  if (/(lofi|lo-fi|chill|rain|study|coffee|tape|cozy)/.test(text)) {
    return {
      suggestedGenre: 'Lo-Fi Chill',
      suggestedSubgenre: 'Tape Chillhop',
      alternativeCategories: [
        { genre: 'Ambient', subgenre: 'Downtempo', confidence: 76 },
        { genre: 'Jazztronica', subgenre: 'Mellow Keys', confidence: 68 },
      ],
      mood: 'Chill & Focused',
      bpm: 84,
      key: 'Eb Major',
      vocalType: 'Instrumental / Vinyl Texture',
      energyLevel: 'Chill',
      musicalStyle: 'Warm Lo-Fi Groove',
      instruments: ['Rhodes Piano', 'Vinyl Crackle', 'Brush Drums', 'Sub Bass'],
      confidence: 86,
      reasoning: 'Classified from warm chillhop and downtempo cues in title and filename.',
    };
  }

  if (/(cyber|neon|blade|obsidian|synthwave|retro|night|laser|monolith)/.test(text)) {
    return {
      suggestedGenre: 'Cyberpunk Ambient',
      suggestedSubgenre: 'Darkwave Synth',
      alternativeCategories: [
        { genre: 'Synthwave', subgenre: 'Outrun', confidence: 81 },
        { genre: 'Electronic', subgenre: 'Cinematic Bass', confidence: 72 },
      ],
      mood: 'Atmospheric',
      bpm: 118,
      key: 'C Minor',
      vocalType: 'Instrumental',
      energyLevel: 'High',
      musicalStyle: 'Nocturnal Cyber-Acoustic',
      instruments: ['Analog Polysynth', 'Sub Bass', 'Arpeggiator', 'Gate Reverb Drums'],
      confidence: 89,
      reasoning: 'Detected futuristic synth and nocturnal cinematic cues in track naming.',
    };
  }

  if (/(afro|lagos|amapiano|drum|tribal|groove|pulse)/.test(text)) {
    return {
      suggestedGenre: 'Afrobeat Future',
      suggestedSubgenre: 'Neo-Amapiano',
      alternativeCategories: [
        { genre: 'Electronic', subgenre: 'Afro-Tech', confidence: 78 },
        { genre: 'Cyber-Funk', subgenre: 'Future Groove', confidence: 70 },
      ],
      mood: 'Euphoric',
      bpm: 114,
      key: 'F Minor',
      vocalType: 'Harmonic Chants',
      energyLevel: 'High',
      musicalStyle: 'Polyrhythmic Future Groove',
      instruments: ['Log Drum', 'Talking Drum', 'Shakers', 'Marimba Synth'],
      confidence: 87,
      reasoning: 'Detected Afro-percussive and rhythmic groove indicators.',
    };
  }

  if (/(epic|orchestra|symphon|cello|violin|dawn|quantum|chorus|hero)/.test(text)) {
    return {
      suggestedGenre: 'Orchestral Epic',
      suggestedSubgenre: 'Hybrid Cinematic',
      alternativeCategories: [
        { genre: 'Ambient', subgenre: 'Chamber Ambient', confidence: 77 },
        { genre: 'Indie Pop', subgenre: 'Anthemic', confidence: 69 },
      ],
      mood: 'Dramatic',
      bpm: 102,
      key: 'D Minor',
      vocalType: 'Ethereal Choir',
      energyLevel: 'Explosive',
      musicalStyle: 'Widescreen Symphonic Hybrid',
      instruments: ['Solo Cello', 'Brass Section', 'Taiko Percussion', 'Analog Strings'],
      confidence: 85,
      reasoning: 'Classified from orchestral and widescreen cinematic naming indicators.',
    };
  }

  if (/(indie|pop|heart|human|dream|vocal|love|horizon|unity)/.test(text)) {
    return {
      suggestedGenre: 'Indie Pop',
      suggestedSubgenre: 'Dream Electronic Pop',
      alternativeCategories: [
        { genre: 'Synthwave', subgenre: 'Vocoder Pop', confidence: 79 },
        { genre: 'Electronic', subgenre: 'Melodic Anthem', confidence: 74 },
      ],
      mood: 'Uplifting',
      bpm: 108,
      key: 'G Major',
      vocalType: 'Expressive Lead Vocals',
      energyLevel: 'High',
      musicalStyle: 'Anthemic Electro-Indie',
      instruments: ['Warm Synths', 'Guitar Plucks', 'Punchy Kit', 'Sub Bass'],
      confidence: 88,
      reasoning: 'Classified from melodic song title and uplifting vocal pop characteristics.',
    };
  }

  return {
    suggestedGenre: 'Electronic',
    suggestedSubgenre: 'Atmospheric Electronica',
    alternativeCategories: [
      { genre: 'Ambient', subgenre: 'Spatial Drift', confidence: 74 },
      { genre: 'Experimental', subgenre: 'Neural Acoustic', confidence: 68 },
    ],
    mood: 'Atmospheric',
    bpm: 120,
    key: 'A Minor',
    vocalType: 'Instrumental',
    energyLevel: 'Medium',
    musicalStyle: 'Contemporary AI Audio',
    instruments: ['Modular Synth', 'Warm Pad', 'Crisp Percussion', 'Sub Bass'],
    confidence: 82,
    reasoning: 'Classified from file acoustics and general electronic structure.',
  };
}

export interface CoverDesignSpec {
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  motif: 'orbital' | 'waveforms' | 'prism' | 'constellation';
  energyRingCount: number;
}

export function buildDeterministicCoverSpec(input: {
  title: string;
  genre: string;
  mood: string;
  energyLevel?: AudioTrack['energyLevel'];
}): CoverDesignSpec {
  const seedStr = `${input.title}:${input.genre}:${input.mood}`;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const palettes: Array<[string, string, string]> = [
    ['#8B5CF6', '#06B6D4', '#F59E0B'], // Neural violet + cyan + amber
    ['#6366F1', '#22D3EE', '#10B981'], // Indigo + teal + emerald
    ['#EC4899', '#8B5CF6', '#38BDF8'], // Neon rose + violet + sky
    ['#F59E0B', '#EF4444', '#8B5CF6'], // Sonic amber + crimson + violet
    ['#10B981', '#06B6D4', '#A78BFA'], // Bio-emerald + cyan + lavender
  ];
  const motifs: CoverDesignSpec['motif'][] = ['orbital', 'waveforms', 'prism', 'constellation'];

  const palette = palettes[Math.abs(hash) % palettes.length];
  const motif = motifs[Math.abs(hash >> 4) % motifs.length];
  const energyRingCount =
    input.energyLevel === 'Explosive' ? 7 : input.energyLevel === 'High' ? 6 : input.energyLevel === 'Chill' ? 3 : 5;

  return {
    primaryHex: palette[0],
    secondaryHex: palette[1],
    accentHex: palette[2],
    motif,
    energyRingCount,
  };
}
