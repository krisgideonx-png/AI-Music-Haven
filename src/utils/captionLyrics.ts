import type { UserAiQuotaState } from './aiQuota.ts';

export interface LyricCaptionCue {
  id: string;
  timeSeconds: number | null;
  timestampLabel: string | null;
  text: string;
}

export interface CaptionQuotaContext {
  userId?: string | null;
  visitorId: string;
  tier: 'Free' | 'Haven Pro';
  quotaUsed: number;
  quotaCycle: string;
}

export interface CaptionLyricsResult {
  captions: string;
  quota?: UserAiQuotaState;
  model?: string;
}

export const MAX_CLIENT_AUDIO_BYTES = 9 * 1024 * 1024; // Fits cleanly inside 15mb JSON envelope after base64 expansion

const TIMESTAMP_REGEX = /^\[(\d{1,2}):(\d{2})(?:\.\d+)?\]\s*(.*)$/;

export function normalizeAudioMimeType(rawMime?: string, fallbackNameOrUrl?: string): string {
  const clean = (rawMime || '').split(';')[0].trim().toLowerCase();
  if (clean === 'audio/mpeg' || clean === 'audio/mp3') return 'audio/mp3';
  if (clean === 'audio/wave' || clean === 'audio/x-wav' || clean === 'audio/wav') return 'audio/wav';
  if (clean === 'audio/x-m4a' || clean === 'audio/mp4') return 'audio/mp4';
  if (clean === 'audio/ogg' || clean === 'audio/opus') return 'audio/ogg';
  if (clean === 'audio/webm') return 'audio/webm';
  if (clean === 'audio/aac') return 'audio/aac';
  if (clean === 'audio/flac' || clean === 'audio/x-flac') return 'audio/flac';

  const ext = (fallbackNameOrUrl || '').split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return 'audio/mp3';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'webm') return 'audio/webm';
  return 'audio/mp3';
}

export function isServerLocalAssetUrl(audioUrl?: string): boolean {
  return Boolean(audioUrl && audioUrl.trim().startsWith('/assets/'));
}

export function parseLyricCaptions(rawLyrics?: string): LyricCaptionCue[] {
  if (!rawLyrics || !rawLyrics.trim()) return [];
  const lines = rawLyrics.split(/\r?\n/);
  const cues: LyricCaptionCue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const match = trimmed.match(TIMESTAMP_REGEX);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const text = (match[3] || '').trim();
      if (!text) continue;
      const totalSecs = mins * 60 + secs;
      const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      cues.push({
        id: `cue-${i}-${totalSecs}`,
        timeSeconds: totalSecs,
        timestampLabel: label,
        text,
      });
    } else {
      cues.push({
        id: `cue-${i}`,
        timeSeconds: null,
        timestampLabel: null,
        text: trimmed,
      });
    }
  }

  return cues;
}

export function getActiveCaptionAtTime(
  cues: LyricCaptionCue[],
  currentTimeSec: number,
  totalDurationSec: number = 180
): LyricCaptionCue | null {
  if (cues.length === 0) return null;

  const timedCues = cues.filter((c) => c.timeSeconds !== null);
  if (timedCues.length > 0) {
    let active = timedCues[0];
    for (const cue of timedCues) {
      if ((cue.timeSeconds ?? 0) <= currentTimeSec + 0.25) {
        active = cue;
      } else {
        break;
      }
    }
    return active;
  }

  const safeDur = Math.max(1, totalDurationSec);
  const ratio = Math.max(0, Math.min(0.9999, currentTimeSec / safeDur));
  const idx = Math.min(cues.length - 1, Math.floor(ratio * cues.length));
  return cues[idx] || cues[0];
}

export async function readBlobAsBase64(blob: Blob): Promise<string> {
  const sliced = blob.size > MAX_CLIENT_AUDIO_BYTES ? blob.slice(0, MAX_CLIENT_AUDIO_BYTES) : blob;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read audio data for captioning.'));
    reader.readAsDataURL(sliced);
  });
}

export async function requestLyricsCaption(params: {
  audioFile?: File | null;
  audioUrl?: string;
  title?: string;
  creator?: string;
  description?: string;
  quotaContext: CaptionQuotaContext;
}): Promise<CaptionLyricsResult> {
  let audioBase64: string | undefined;
  let mimeType: string | undefined;

  if (params.audioFile) {
    audioBase64 = await readBlobAsBase64(params.audioFile);
    mimeType = normalizeAudioMimeType(params.audioFile.type, params.audioFile.name);
  } else if (params.audioUrl && !isServerLocalAssetUrl(params.audioUrl)) {
    const cleanUrl = params.audioUrl.trim();
    if (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('data:')) {
      const blobResp = await fetch(cleanUrl);
      if (!blobResp.ok) {
        throw new Error('Could not access the uploaded audio buffer in this session. Re-select the file to caption lyrics.');
      }
      const blob = await blobResp.blob();
      audioBase64 = await readBlobAsBase64(blob);
      mimeType = normalizeAudioMimeType(blob.type, cleanUrl);
    }
  }

  if (!audioBase64 && !params.audioUrl) {
    throw new Error('Attach or select an audio song first so AI Music Haven can caption its lyrics.');
  }

  const response = await fetch('/api/caption-lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType,
      audioUrl: isServerLocalAssetUrl(params.audioUrl) ? params.audioUrl : undefined,
      title: params.title,
      creator: params.creator,
      description: params.description,
      ...params.quotaContext,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'Lyrics captioning failed. Please try again shortly.'
    ) as Error & { quota?: UserAiQuotaState };
    if (data?.quota) {
      err.quota = data.quota as UserAiQuotaState;
    }
    throw err;
  }

  const captions = typeof data?.captions === 'string' ? data.captions.trim() : '';
  if (!captions) {
    throw new Error('No vocal captions were returned for this song.');
  }

  return {
    captions,
    quota: data?.quota as UserAiQuotaState | undefined,
    model: typeof data?.model === 'string' ? data.model : undefined,
  };
}
