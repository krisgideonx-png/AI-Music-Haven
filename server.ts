import 'dotenv/config';
import express, { type Response as ExpressResponse } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { buildDeterministicCoverSpec, buildFallbackCategorization, type CoverDesignSpec } from './src/utils/batchUpload.ts';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, computeSyncedPositionSeconds } from './src/utils/roomSync.ts';
import {
  getBillingCycleKey,
  resolveUserCapScope,
  normalizeUserQuotaState,
  canConsumeUserAiCap,
  consumeUserAiCap,
  type UserAiQuotaState,
} from './src/utils/aiQuota.ts';
import { buildStoryGenerationPrompt, buildFallbackStory } from './src/utils/storyBuilder.ts';
import type { ListeningRoom, ListeningRoomParticipant } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COVERS_DIR = path.resolve(process.cwd(), '.haven-covers');
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const CANONICAL_GENRES = [
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
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiErrorMessage(err: unknown): { status: number; message: string } {
  const errObj = err as { status?: number; code?: number; message?: string } | null;
  const raw = err instanceof Error ? err.message : String(err || 'Gemini API request failed.');
  const explicitStatus = Number(errObj?.status || errObj?.code || 0);

  const extractJsonPayload = (input: string) => {
    try {
      return JSON.parse(input);
    } catch {
      const start = input.indexOf('{');
      const end = input.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(input.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const parsed = extractJsonPayload(raw);
  const parsedCode = Number(parsed?.error?.code || parsed?.code || explicitStatus || 0);
  const msg = String(parsed?.error?.message || parsed?.message || raw);

  if (parsedCode === 404 || raw.includes('404') || raw.includes('NOT_FOUND') || raw.includes('is not found')) {
    return { status: 404, message: msg };
  }
  if (parsedCode === 503 || raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: 'AI model is temporarily busy due to high demand. Please retry in a moment.',
    };
  }
  if (parsedCode === 429 || raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI model rate limit reached temporarily. Please retry in a moment.',
    };
  }
  if (parsedCode >= 400 && parsedCode < 600) {
    return { status: parsedCode, message: msg };
  }
  if (raw.toLowerCase().includes('timed out') || raw.toLowerCase().includes('timeout')) {
    return { status: 504, message: raw };
  }
  return { status: 500, message: msg };
}

async function generateCategorizationWithRetry(ai: GoogleGenAI, prompt: string) {
  const delays = [0, 500];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
    try {
      const apiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedGenre: { type: Type.STRING },
              suggestedSubgenre: { type: Type.STRING },
              alternativeCategories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    genre: { type: Type.STRING },
                    subgenre: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                  },
                },
              },
              mood: { type: Type.STRING },
              bpm: { type: Type.INTEGER },
              key: { type: Type.STRING },
              vocalType: { type: Type.STRING },
              energyLevel: { type: Type.STRING },
              musicalStyle: { type: Type.STRING },
              instruments: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
            },
          },
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI categorization timed out due to model load (503).')), 9000)
      );
      return await Promise.race([apiPromise, timeoutPromise]);
    } catch (err) {
      lastError = err;
      const { status } = parseGeminiErrorMessage(err);
      if (status !== 503 && status !== 429) {
        throw err;
      }
    }
  }
  throw lastError;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ai-music-haven' });
  });

  // =========================================================================
  // PER-USER AI CAP LEDGER (Worldwide isolation — charged to each user's cap)
  // =========================================================================
  const userQuotaLedger = new Map<string, { cycle: string; used: number }>();

  const readRequestQuotaState = (
    input: Record<string, unknown>,
    fallbackIp?: string
  ): UserAiQuotaState => {
    const scope = resolveUserCapScope({
      uid: typeof input.userId === 'string' ? input.userId : undefined,
      visitorId:
        typeof input.visitorId === 'string' && input.visitorId.trim()
          ? input.visitorId
          : fallbackIp || 'anonymous',
      requestedTier: typeof input.tier === 'string' ? input.tier : undefined,
    });
    const currentCycle = getBillingCycleKey();
    const ledger = userQuotaLedger.get(scope.scopeId);
    const ledgerUsed = ledger && ledger.cycle === currentCycle ? ledger.used : 0;
    const syncedCycle = typeof input.quotaCycle === 'string' ? input.quotaCycle : '';
    const syncedUsed =
      syncedCycle === currentCycle && Number.isFinite(Number(input.quotaUsed))
        ? Math.max(0, Math.floor(Number(input.quotaUsed)))
        : 0;

    return normalizeUserQuotaState({
      scopeId: scope.scopeId,
      tier: scope.tier,
      used: Math.max(ledgerUsed, syncedUsed),
      cycle: currentCycle,
    });
  };

  const commitQuotaCharge = (state: UserAiQuotaState, cost: number = 1): UserAiQuotaState => {
    const next = consumeUserAiCap(state, cost);
    userQuotaLedger.set(next.scopeId, { cycle: next.cycle, used: next.used });
    return next;
  };

  app.get('/api/quota', (req, res) => {
    const state = readRequestQuotaState(req.query as Record<string, unknown>, req.ip);
    res.json({ quota: state });
  });

  /**
   * Non-destructive AI music categorization endpoint.
   * Analyzes track filename, user description, AI tool origin, and audio file metrics
   * to suggest a primary category, subgenre, mood, BPM, key, and alternatives.
   * Never generates, edits, or alters audio.
   */
  app.post('/api/categorize', async (req, res) => {
    try {
      const body = req.body || {};
      const fileName = String(body.fileName || '').slice(0, 160);
      const title = String(body.title || '').slice(0, 120);
      const description = String(body.description || '').slice(0, 1000);
      const aiToolOrigin = String(body.aiToolOrigin || '').slice(0, 60);
      const fileFormat = String(body.fileFormat || '').slice(0, 60);
      const durationSeconds = Number(body.durationSeconds || 0);
      const sampleRateLabel = String(body.sampleRateLabel || '').slice(0, 40);

      if (!fileName && !title) {
        res.status(400).json({ error: 'A track filename or title is required for categorization.' });
        return;
      }

      const currentQuota = readRequestQuotaState(body as Record<string, unknown>, req.ip);
      const capCheck = canConsumeUserAiCap(currentQuota);
      if (!capCheck.allowed) {
        res.status(429).json({
          error: capCheck.reason,
          code: 'USER_CAP_REACHED',
          quota: currentQuota,
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        const nextQuota = commitQuotaCharge(currentQuota);
        const fallback = buildFallbackCategorization({ fileName, title, description });
        res.json({ ...fallback, source: 'acoustic-heuristic', quota: nextQuota });
        return;
      }

      const prompt = [
        'You are the non-destructive music librarian for AI Music Haven ("Where AI Music Finds Its Home").',
        'Analyze the following completed AI-generated song upload metadata and classify it strictly for catalog organization and discovery.',
        'Do NOT suggest audio edits, remixes, or generation prompts.',
        '',
        `Preferred Primary Genres: ${CANONICAL_GENRES.join(', ')}`,
        `Uploaded File Name: ${fileName || 'unknown'}`,
        `Song Title: ${title || 'Untitled'}`,
        `File Format: ${fileFormat || 'Audio'}`,
        `Measured Duration (sec): ${durationSeconds > 0 ? Math.round(durationSeconds) : 'Unknown'}`,
        `Sample Rate: ${sampleRateLabel || 'Unknown'}`,
        `Origin AI Tool: ${aiToolOrigin || 'Unknown'}`,
        `Creator Description: ${description || 'No description provided'}`,
        '',
        'Return the best suggestedGenre (prefer one of the Preferred Primary Genres when appropriate), suggestedSubgenre, 2 alternativeCategories, mood, estimated bpm (40-240), musical key, vocalType, energyLevel (Chill | Medium | High | Explosive), musicalStyle, up to 5 instruments, confidence (0-100), and a brief 1-2 sentence reasoning.',
      ].join('\n');

      const response = await generateCategorizationWithRetry(ai, prompt);

      const rawText = (response.text || '').trim();
      if (!rawText) {
        const nextQuota = commitQuotaCharge(currentQuota);
        const fallback = buildFallbackCategorization({ fileName, title, description });
        res.json({ ...fallback, source: 'acoustic-heuristic', quota: nextQuota });
        return;
      }

      const parsed = JSON.parse(rawText);
      const validEnergy = ['Chill', 'Medium', 'High', 'Explosive'].includes(parsed.energyLevel)
        ? parsed.energyLevel
        : 'Medium';
      const nextQuota = commitQuotaCharge(currentQuota);

      res.json({
        suggestedGenre: String(parsed.suggestedGenre || 'Electronic').slice(0, 60),
        suggestedSubgenre: String(parsed.suggestedSubgenre || 'Ambient').slice(0, 60),
        alternativeCategories: Array.isArray(parsed.alternativeCategories)
          ? parsed.alternativeCategories.slice(0, 3).map((alt: { genre?: string; subgenre?: string; confidence?: number }) => ({
              genre: String(alt?.genre || 'Electronic').slice(0, 60),
              subgenre: String(alt?.subgenre || 'Experimental').slice(0, 60),
              confidence: Math.min(99, Math.max(10, Math.round(Number(alt?.confidence || 65)))),
            }))
          : [],
        mood: String(parsed.mood || 'Atmospheric').slice(0, 60),
        bpm: Math.min(240, Math.max(40, Math.round(Number(parsed.bpm || 120)))),
        key: String(parsed.key || 'C Minor').slice(0, 30),
        vocalType: String(parsed.vocalType || 'Instrumental').slice(0, 80),
        energyLevel: validEnergy,
        musicalStyle: String(parsed.musicalStyle || 'Contemporary AI Audio').slice(0, 100),
        instruments: Array.isArray(parsed.instruments)
          ? parsed.instruments.slice(0, 6).map((i: unknown) => String(i).slice(0, 48))
          : ['Synthesizer'],
        confidence: Math.min(99, Math.max(40, Math.round(Number(parsed.confidence || 88)))),
        reasoning: String(
          parsed.reasoning || 'Classified from song title, description, and acoustic container metadata.'
        ).slice(0, 300),
        source: 'gemini-3.8-flash',
        quota: nextQuota,
      });
    } catch (error) {
      const { message } = parseGeminiErrorMessage(error);
      console.warn('Categorize API using deterministic fallback:', message);
      const body = req.body || {};
      const fallback = buildFallbackCategorization({
        fileName: String(body.fileName || ''),
        title: String(body.title || ''),
        description: String(body.description || ''),
      });
      res.json({
        ...fallback,
        source: 'acoustic-heuristic',
        quota: readRequestQuotaState((req.body || {}) as Record<string, unknown>, req.ip),
      });
    }
  });

  /**
   * Non-paid AI Cover Art Generator endpoint.
   * Uses Gemini 3.8 Flash (when configured) to design acoustic luminescence visual art direction
   * (palettes + sacred geometry / waveform motif) and renders a high-resolution SVG album cover
   * served at /api/covers/<id>.svg (compact URL under Firestore's 500-char coverArt limit).
   */
  const renderAcousticCoverSvg = (
    spec: CoverDesignSpec,
    title: string,
    genre: string,
    mood: string,
    seedHex: string
  ): string => {
    const cleanHex = (val: string, fallback: string) =>
      /^#[0-9A-Fa-f]{6}$/.test((val || '').trim()) ? val.trim() : fallback;
    const c1 = cleanHex(spec.primaryHex, '#8B5CF6');
    const c2 = cleanHex(spec.secondaryHex, '#06B6D4');
    const c3 = cleanHex(spec.accentHex, '#F59E0B');
    const rings = Math.max(3, Math.min(8, Math.round(spec.energyRingCount || 5)));

    let seedNum = parseInt(seedHex.slice(0, 8), 16) || 1337;
    const nextRand = () => {
      seedNum = (Math.imul(1664525, seedNum) + 1013904223) >>> 0;
      return seedNum / 4294967296;
    };

    const ringElements = Array.from({ length: rings }, (_, idx) => {
      const r = 90 + idx * 48;
      const stroke = idx % 3 === 0 ? c1 : idx % 3 === 1 ? c2 : c3;
      const opacity = (0.58 - idx * 0.06).toFixed(2);
      const dash = idx % 2 === 0 ? `stroke-dasharray="${14 + idx * 6} ${8 + idx * 4}"` : '';
      return `<circle cx="400" cy="400" r="${r}" fill="none" stroke="${stroke}" stroke-width="${2.5 - idx * 0.15}" opacity="${opacity}" ${dash} />`;
    }).join('\n    ');

    const waveBars = Array.from({ length: 42 }, (_, idx) => {
      const x = 115 + idx * 14;
      const amp = 32 + Math.round((0.35 + nextRand() * 0.65) * 145 * Math.sin((idx / 41) * Math.PI));
      const y = 400 - amp / 2;
      const fill = idx % 2 === 0 ? c2 : c1;
      return `<rect x="${x}" y="${y}" width="6" height="${amp}" rx="3" fill="${fill}" opacity="${(0.55 + nextRand() * 0.4).toFixed(2)}" />`;
    }).join('\n    ');

    const stars = Array.from({ length: 28 }, () => {
      const cx = Math.round(60 + nextRand() * 680);
      const cy = Math.round(60 + nextRand() * 680);
      const r = (1.2 + nextRand() * 3.2).toFixed(1);
      const fill = nextRand() > 0.5 ? c2 : c3;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${(0.35 + nextRand() * 0.6).toFixed(2)}" />`;
    }).join('\n    ');

    const prismLayer =
      spec.motif === 'prism'
        ? `<polygon points="400,130 640,560 160,560" fill="none" stroke="url(#accentGrad)" stroke-width="4" opacity="0.85" />
           <polygon points="400,195 585,520 215,520" fill="url(#coreGlow)" opacity="0.32" />`
        : spec.motif === 'constellation'
        ? `<polyline points="160,260 280,190 400,320 530,210 640,390 490,540 270,510 160,260" fill="none" stroke="${c2}" stroke-width="2.5" opacity="0.6" />`
        : '';

    const escapeXml = (s: string) =>
      s.replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch] || ch));

    const safeTitle = escapeXml(title.slice(0, 28) || 'Untitled AI Track');
    const safeSub = escapeXml(`${genre} · ${mood}`.slice(0, 42));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <radialGradient id="bgGlow1" cx="28%" cy="24%" r="65%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.55" />
      <stop offset="60%" stop-color="#0E0E18" stop-opacity="0.92" />
      <stop offset="100%" stop-color="#08080C" stop-opacity="1" />
    </radialGradient>
    <radialGradient id="bgGlow2" cx="76%" cy="74%" r="55%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#08080C" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c3}" stop-opacity="0.85" />
      <stop offset="48%" stop-color="${c1}" stop-opacity="0.55" />
      <stop offset="100%" stop-color="${c2}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="50%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
    <pattern id="techGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="800" height="800" fill="#08080C" />
  <rect width="800" height="800" fill="url(#bgGlow1)" />
  <rect width="800" height="800" fill="url(#bgGlow2)" />
  <rect width="800" height="800" fill="url(#techGrid)" />
  ${stars}
  <circle cx="400" cy="400" r="190" fill="url(#coreGlow)" opacity="0.6" />
  ${ringElements}
  ${spec.motif === 'waveforms' ? waveBars : ''}
  ${prismLayer}
  <circle cx="400" cy="400" r="64" fill="#08080C" stroke="url(#accentGrad)" stroke-width="4" />
  <path d="M388 424 V380 L424 371 V412" fill="none" stroke="url(#accentGrad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="380" cy="424" r="9" fill="${c2}" />
  <circle cx="416" cy="412" r="9" fill="${c1}" />
  <rect x="44" y="650" width="712" height="106" rx="22" fill="rgba(8,8,12,0.78)" stroke="rgba(255,255,255,0.12)" />
  <text x="74" y="698" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700" letter-spacing="-0.5">${safeTitle}</text>
  <text x="74" y="732" fill="${c2}" font-family="ui-monospace, monospace" font-size="16" font-weight="600" letter-spacing="1.2">${safeSub.toUpperCase()}</text>
  <text x="726" y="732" text-anchor="end" fill="#958ea0" font-family="ui-monospace, monospace" font-size="14">AI MUSIC HAVEN</text>
</svg>`;
  };

  app.post('/api/generate-cover', async (req, res) => {
    const body = req.body || {};
    const currentQuota = readRequestQuotaState(body as Record<string, unknown>, req.ip);
    const capCheck = canConsumeUserAiCap(currentQuota);
    if (!capCheck.allowed) {
      res.status(429).json({
        error: capCheck.reason,
        code: 'USER_CAP_REACHED',
        quota: currentQuota,
      });
      return;
    }

    const title = String(body.title || 'Untitled Track').slice(0, 120);
    const genre = String(body.genre || 'Electronic').slice(0, 60);
    const mood = String(body.mood || 'Atmospheric').slice(0, 60);
    const energyLevel = (['Chill', 'Medium', 'High', 'Explosive'].includes(String(body.energyLevel))
      ? body.energyLevel
      : 'Medium') as 'Chill' | 'Medium' | 'High' | 'Explosive';

    let spec: CoverDesignSpec = buildDeterministicCoverSpec({ title, genre, mood, energyLevel });
    let generator = 'haven-acoustic-artwork';

    try {
      const ai = getGeminiClient();
      if (ai) {
        const prompt = [
          'Pick a cohesive 3-hex color palette (primaryHex, secondaryHex, accentHex) and geometric visual motif (orbital, waveforms, prism, constellation) for a dark-obsidian glowing album cover.',
          `Song Title: ${title}`,
          `Genre: ${genre}`,
          `Mood: ${mood}`,
          `Energy: ${energyLevel}`,
        ].join('\n');

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Cover art direction timeout')), 6500)
        );
        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  primaryHex: { type: Type.STRING },
                  secondaryHex: { type: Type.STRING },
                  accentHex: { type: Type.STRING },
                  motif: { type: Type.STRING },
                  energyRingCount: { type: Type.INTEGER },
                },
              },
            },
          }),
          timeoutPromise,
        ]);

        const raw = (response.text || '').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          const validMotifs = ['orbital', 'waveforms', 'prism', 'constellation'];
          spec = {
            primaryHex: /^#[0-9A-Fa-f]{6}$/.test(String(parsed.primaryHex || ''))
              ? String(parsed.primaryHex)
              : spec.primaryHex,
            secondaryHex: /^#[0-9A-Fa-f]{6}$/.test(String(parsed.secondaryHex || ''))
              ? String(parsed.secondaryHex)
              : spec.secondaryHex,
            accentHex: /^#[0-9A-Fa-f]{6}$/.test(String(parsed.accentHex || ''))
              ? String(parsed.accentHex)
              : spec.accentHex,
            motif: validMotifs.includes(parsed.motif) ? parsed.motif : spec.motif,
            energyRingCount: Math.max(3, Math.min(8, Math.round(Number(parsed.energyRingCount || spec.energyRingCount)))),
          };
          generator = 'gemini-3.8-art-direction';
        }
      }
    } catch {
      // Fall back cleanly to deterministic palette spec
    }

    const seedHex = crypto
      .createHash('sha256')
      .update(`${title}:${genre}:${mood}:${Date.now()}:${Math.random()}`)
      .digest('hex')
      .slice(0, 12);
    const fileName = `cov_${seedHex}.svg`;
    const svgContent = renderAcousticCoverSvg(spec, title, genre, mood, seedHex);

    fs.writeFileSync(path.join(COVERS_DIR, fileName), svgContent, 'utf8');
    const nextQuota = commitQuotaCharge(currentQuota);
    res.json({
      coverUrl: `/api/covers/${fileName}`,
      artDirection: spec,
      generator,
      quota: nextQuota,
    });
  });

  app.get('/api/covers/:fileName', (req, res) => {
    const fileName = String(req.params.fileName || '');
    if (!/^cov_[a-zA-Z0-9_-]+\.svg$/.test(fileName)) {
      res.status(400).json({ error: 'Invalid cover asset name.' });
      return;
    }
    const targetPath = path.join(COVERS_DIR, fileName);
    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'Generated cover artwork not found.' });
      return;
    }
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(targetPath);
  });

  /**
   * AI Music Haven Song Story Generator endpoint.
   * Generates a story behind the song directly from BOTH the song description and lyrics,
   * charging usage strictly to the requesting user's own cap (never the site owner's global limit).
   */
  app.post('/api/generate-story', async (req, res) => {
    const body = req.body || {};
    const currentQuota = readRequestQuotaState(body as Record<string, unknown>, req.ip);
    const capCheck = canConsumeUserAiCap(currentQuota);
    if (!capCheck.allowed) {
      res.status(429).json({
        error: capCheck.reason,
        code: 'USER_CAP_REACHED',
        quota: currentQuota,
      });
      return;
    }

    const storyInput = {
      title: String(body.title || 'Untitled Track').slice(0, 120),
      creator: String(body.creator || 'Haven Creator').slice(0, 80),
      genre: String(body.genre || 'Electronic').slice(0, 60),
      subgenre: String(body.subgenre || '').slice(0, 60),
      mood: String(body.mood || 'Atmospheric').slice(0, 60),
      aiToolOrigin: String(body.aiToolOrigin || 'AI Music Studio').slice(0, 60),
      description: String(body.description || '').slice(0, 1000),
      lyrics: String(body.lyrics || '').slice(0, 4000),
    };

    try {
      const ai = getGeminiClient();
      if (!ai) {
        const nextQuota = commitQuotaCharge(currentQuota);
        res.json({
          story: buildFallbackStory(storyInput),
          usedDescription: Boolean(storyInput.description.trim()),
          usedLyrics: Boolean(storyInput.lyrics.trim()),
          generator: 'haven-story-template',
          quota: nextQuota,
        });
        return;
      }

      const prompt = buildStoryGenerationPrompt(storyInput);
      const storyModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'] as const;
      let responseText = '';
      for (const modelName of storyModels) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Story generator timeout')), 6500)
          );
          const response = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
              ...(modelName === 'gemini-3.8-flash'
                ? { config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } }
                : {}),
            }),
            timeoutPromise,
          ]);
          responseText = (response.text || '').trim().slice(0, 1400);
          if (responseText) break;
        } catch (modelErr) {
          const { status, message } = parseGeminiErrorMessage(modelErr);
          console.warn(`[story] ${modelName} -> status=${status}: ${message}`);
          if (status !== 404 && status !== 503 && status !== 429 && status !== 504) {
            throw modelErr;
          }
        }
      }

      const story = responseText;
      const nextQuota = commitQuotaCharge(currentQuota);
      if (!story) {
        res.json({
          story: buildFallbackStory(storyInput),
          usedDescription: Boolean(storyInput.description.trim()),
          usedLyrics: Boolean(storyInput.lyrics.trim()),
          generator: 'haven-story-template',
          quota: nextQuota,
        });
        return;
      }

      res.json({
        story,
        usedDescription: Boolean(storyInput.description.trim()),
        usedLyrics: Boolean(storyInput.lyrics.trim()),
        generator: 'ai-music-haven-story-generator',
        quota: nextQuota,
      });
    } catch (err) {
      console.warn('Story generator fallback used:', err instanceof Error ? err.message : err);
      const nextQuota = commitQuotaCharge(currentQuota);
      res.json({
        story: buildFallbackStory(storyInput),
        usedDescription: Boolean(storyInput.description.trim()),
        usedLyrics: Boolean(storyInput.lyrics.trim()),
        generator: 'haven-story-template',
        quota: nextQuota,
      });
    }
  });

  /**
   * Shared helper to call @google/genai audio captioning/transcription across supported
   * multimodal audio models (`gemini-3.5-transcribe`, `gemini-flash-latest`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`).
   */
  const runGeminiAudioCaptionOrTranscribe = async (
    ai: GoogleGenAI,
    mimeType: string,
    base64Data: string,
    instruction: string,
    perModelTimeoutMs: number = 14000
  ): Promise<{ text: string; model: string }> => {
    const normalizedMime = mimeType === 'audio/mpeg' ? 'audio/mp3' : mimeType;
    const candidateModels = [
      'gemini-3.5-transcribe',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];
    let lastError: unknown;
    const attemptDiagnostics: string[] = [];

    for (const modelName of candidateModels) {
      const delays = [0, 1200];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
        try {
          const audioPart = {
            inlineData: {
              mimeType: normalizedMime,
              data: base64Data,
            },
          };
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${modelName} timed out after ${perModelTimeoutMs}ms`)), perModelTimeoutMs)
          );
          const config =
            modelName === 'gemini-3.8-flash'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : undefined;

          const resp = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [audioPart, { text: instruction }],
              },
              ...(config ? { config } : {}),
            }),
            timeoutPromise,
          ]);
          return { text: (resp.text || '').trim(), model: modelName };
        } catch (err) {
          lastError = err;
          const { status, message } = parseGeminiErrorMessage(err);
          attemptDiagnostics.push(`${modelName}[${status}]: ${message.slice(0, 120)}`);
          console.warn(`[caption/transcribe] ${modelName} attempt ${attempt + 1} -> status=${status}: ${message}`);
          if (status === 404 || status === 400 || status === 504) {
            break; // Try next supported model in the cascade immediately
          }
          if (status !== 503 && status !== 429) {
            throw err;
          }
        }
      }
    }

    const summaryMsg =
      attemptDiagnostics.length > 0
        ? `Unable to caption lyrics (${attemptDiagnostics[attemptDiagnostics.length - 1]}).`
        : lastError instanceof Error
        ? lastError.message
        : 'Audio captioning failed across available models.';
    throw new Error(summaryMsg);
  };

  /**
   * Audio File Caption-for-Lyrics endpoint.
   * Captions sung/spoken lyrics from uploaded audio bytes OR bundled catalog tracks (/assets/...),
   * charging usage strictly to the requesting user's own cap.
   */
  app.post('/api/caption-lyrics', async (req, res) => {
    const body = req.body || {};
    const currentQuota = readRequestQuotaState(body as Record<string, unknown>, req.ip);
    const capCheck = canConsumeUserAiCap(currentQuota);
    if (!capCheck.allowed) {
      res.status(429).json({
        error: capCheck.reason,
        code: 'USER_CAP_REACHED',
        quota: currentQuota,
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Lyrics captioning model key is not configured on this server yet.',
        quota: currentQuota,
      });
      return;
    }

    let cleanedBase64 = String(body.audioBase64 || '')
      .trim()
      .replace(/^data:[^;]+;base64,/i, '');
    const rawMime = String(body.mimeType || '').split(';')[0].trim().toLowerCase();
    const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl.trim() : '';

    let mimeType =
      rawMime === 'audio/mpeg'
        ? 'audio/mp3'
        : ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/flac'].includes(rawMime)
        ? rawMime
        : 'audio/mp3';

    if (!cleanedBase64 && audioUrl.startsWith('/assets/')) {
      const assetsRoot = path.resolve(process.cwd(), 'public', 'assets');
      const relativeAfterAssets = audioUrl.replace(/^\/assets\/+/, '').split('?')[0];
      const resolvedFile = path.resolve(assetsRoot, relativeAfterAssets);

      if (!resolvedFile.startsWith(assetsRoot + path.sep) || !fs.existsSync(resolvedFile)) {
        res.status(404).json({
          error: 'Could not locate the song audio asset on the server to caption.',
          quota: currentQuota,
        });
        return;
      }

      const fileStat = fs.statSync(resolvedFile);
      const maxBytes = 9.5 * 1024 * 1024;
      if (fileStat.size > maxBytes) {
        const fd = fs.openSync(resolvedFile, 'r');
        const sliceBuf = Buffer.alloc(maxBytes);
        fs.readSync(fd, sliceBuf, 0, maxBytes, 0);
        fs.closeSync(fd);
        cleanedBase64 = sliceBuf.toString('base64');
      } else {
        cleanedBase64 = fs.readFileSync(resolvedFile).toString('base64');
      }

      const ext = path.extname(resolvedFile).toLowerCase();
      if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.ogg') mimeType = 'audio/ogg';
      else if (ext === '.flac') mimeType = 'audio/flac';
      else if (ext === '.m4a') mimeType = 'audio/mp4';
      else if (ext === '.webm') mimeType = 'audio/webm';
      else mimeType = 'audio/mp3';
    }

    if (!cleanedBase64) {
      res.status(400).json({
        error: 'Audio bytes or a valid bundled song URL are required to generate lyric captions.',
        quota: currentQuota,
      });
      return;
    }

    const songTitle = String(body.title || '').trim().slice(0, 120);
    const captionInstruction = [
      'Generate closed-caption formatted song lyrics for this audio track.',
      songTitle ? `Track Title: "${songTitle}".` : '',
      'Include timestamp cues like [00:12] at the start of each sung phrase or line whenever clear vocals are present.',
      'Separate every phrase onto its own clean line. If sections are purely instrumental, note briefly like "[00:00] (Instrumental)".',
      'Return only the captioned lyrics text with no preamble.',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const result = await runGeminiAudioCaptionOrTranscribe(
        ai,
        mimeType,
        cleanedBase64,
        captionInstruction,
        10000
      );

      const captions = result.text;
      if (!captions) {
        res.status(422).json({
          error: 'No spoken or sung vocals could be captioned from this audio file.',
          quota: currentQuota,
        });
        return;
      }

      const nextQuota = commitQuotaCharge(currentQuota);
      res.json({
        captions: captions.slice(0, 4000),
        model: result.model,
        quota: nextQuota,
      });
    } catch (err) {
      const { status, message } = parseGeminiErrorMessage(err);
      res.status(status).json({
        error: message || 'Audio lyrics captioning failed.',
        quota: currentQuota,
      });
    }
  });

  /**
   * Microphone Audio Transcription endpoint.
   * Accepts base64-encoded microphone recordings and returns transcribed text,
   * charging successful transcriptions strictly to the requesting user's own cap.
   */
  app.post('/api/transcribe', async (req, res) => {
    const body = req.body || {};
    const currentQuota = readRequestQuotaState(body as Record<string, unknown>, req.ip);
    const capCheck = canConsumeUserAiCap(currentQuota);
    if (!capCheck.allowed) {
      res.status(429).json({
        error: capCheck.reason,
        code: 'USER_CAP_REACHED',
        quota: currentQuota,
      });
      return;
    }

    const rawBase64 = String(body.audioBase64 || '').trim();
    const cleanedBase64 = rawBase64.replace(/^data:[^;]+;base64,/i, '');
    if (!cleanedBase64) {
      res.status(400).json({ error: 'Recorded microphone audio data is required for transcription.' });
      return;
    }

    const rawMime = String(body.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    const allowedMimes = new Set([
      'audio/webm',
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      'audio/flac',
    ]);
    const mimeType = rawMime === 'audio/mpeg' ? 'audio/mp3' : allowedMimes.has(rawMime) ? rawMime : 'audio/webm';
    const targetField = String(body.targetField || 'lyrics').slice(0, 32);

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Audio transcription service is not configured with an active model key on this server.',
        quota: currentQuota,
      });
      return;
    }

    const instruction =
      targetField === 'lyrics'
        ? 'Caption these sung or spoken song lyrics with clean line breaks and optional [00:00] timing cues.'
        : targetField === 'search'
        ? 'Transcribe this spoken music discovery request cleanly as a single concise search query.'
        : 'Transcribe this spoken song description accurately into clean, readable prose.';

    try {
      const result = await runGeminiAudioCaptionOrTranscribe(ai, mimeType, cleanedBase64, instruction, 10000);

      const text = result.text;
      if (!text) {
        res.status(422).json({
          error: 'No clear speech or vocals could be transcribed from the microphone recording.',
          quota: currentQuota,
        });
        return;
      }

      const nextQuota = commitQuotaCharge(currentQuota);
      res.json({
        text: text.slice(0, 4000),
        model: result.model,
        targetField,
        quota: nextQuota,
      });
    } catch (err) {
      const { status, message } = parseGeminiErrorMessage(err);
      res.status(status).json({
        error: message || 'Audio transcription failed.',
        quota: currentQuota,
      });
    }
  });

  /**
   * Admin Takedown Reason Generator endpoint.
   * When an administrator removes a track without specifying a custom reason,
   * generates a clear, professional notice explaining the removal to the creator.
   */
  app.post('/api/generate-takedown-reason', async (req, res) => {
    const body = req.body || {};
    const title = String(body.title || 'Uploaded Song').slice(0, 120);
    const creator = String(body.creator || 'Creator').slice(0, 80);
    const genre = String(body.genre || 'Music').slice(0, 60);
    const license = String(body.license || 'Standard').slice(0, 60);

    const buildFallbackReason = () =>
      `Your upload "${title}" (${genre}, ${license}) was removed during an AI Music Haven catalog moderation review due to metadata verification, audio rights compliance, or community archive quality standards. If you believe this takedown was issued in error, you may review your licensing details and submit an appeal to the platform administrator.`;

    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.json({ reason: buildFallbackReason(), autoGenerated: true });
        return;
      }

      const prompt = [
        'You are the Trust & Safety moderator for AI Music Haven.',
        'Write a concise, polite, professional 2-sentence takedown notice addressed directly to the creator explaining why their uploaded track was removed from the public catalog following an administrative review (e.g., rights/attribution verification, metadata mismatch, or catalog policy compliance).',
        'Plain text only, max 450 characters.',
        '',
        `Track Title: ${title}`,
        `Creator: ${creator}`,
        `Genre: ${genre}`,
        `Declared License: ${license}`,
      ].join('\n');

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Takedown reason timeout')), 8000)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        timeoutPromise,
      ]);

      const reason = (response.text || '').trim().slice(0, 900);
      res.json({
        reason: reason || buildFallbackReason(),
        autoGenerated: true,
      });
    } catch (err) {
      console.warn('Takedown reason generator fallback used:', err instanceof Error ? err.message : err);
      res.json({ reason: buildFallbackReason(), autoGenerated: true });
    }
  });

  // =========================================================================
  // REAL-TIME MULTI-DEVICE LISTENING ROOMS (Server-Authoritative + SSE)
  // =========================================================================
  const roomsStore = new Map<string, ListeningRoom>();
  const roomSubscribers = new Map<string, Set<ExpressResponse>>();

  const broadcastRoomEvent = (code: string, event: string, payload: unknown) => {
    const subs = roomSubscribers.get(code);
    if (!subs || subs.size === 0) return;
    const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of subs) {
      try {
        res.write(serialized);
      } catch {
        subs.delete(res);
      }
    }
  };

  const toPublicRoomSnapshot = (room: ListeningRoom): ListeningRoom => ({
    ...room,
    positionSeconds: computeSyncedPositionSeconds(room, Date.now()),
  });

  app.post('/api/rooms', (req, res) => {
    const body = req.body || {};
    const hostId = String(body.hostId || `host_${Date.now()}`).slice(0, 80);
    const hostUid = body.hostUid ? String(body.hostUid).slice(0, 128) : undefined;
    const hostName = String(body.hostName || 'Haven Host').slice(0, 80);
    const requestedCode = normalizeRoomCode(String(body.code || ''));
    let code = isValidRoomCode(requestedCode) && !roomsStore.has(requestedCode)
      ? requestedCode
      : generateRoomCode(6);
    while (roomsStore.has(code)) {
      code = generateRoomCode(6);
    }

    const track = body.track || {};
    const trackId = String(track.id || body.trackId || 'trk-top-superhuman').slice(0, 128);
    const trackTitle = String(track.title || body.trackTitle || 'Superhuman').slice(0, 120);
    const trackCreator = String(track.creator || body.trackCreator || 'Alex Rivera').slice(0, 80);
    const trackCoverArt = String(
      track.coverArt ||
        body.trackCoverArt ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
    ).slice(0, 500);
    const trackDuration = Math.max(1, Math.min(3600, Number(track.duration || body.trackDuration || 180)));

    const nowMs = Date.now();
    const hostParticipant: ListeningRoomParticipant = {
      clientId: hostId,
      displayName: hostName,
      isHost: true,
      joinedAtMs: nowMs,
    };

    const room: ListeningRoom = {
      code,
      name: String(body.name || `${hostName}'s Listening Room`).slice(0, 80),
      hostId,
      hostUid,
      hostName,
      trackId,
      trackTitle,
      trackCreator,
      trackCoverArt,
      trackDuration,
      trackSnapshot: track?.id ? track : undefined,
      isPlaying: Boolean(body.isPlaying),
      positionSeconds: Math.max(0, Math.min(trackDuration, Number(body.positionSeconds || 0))),
      allowGuestControl: body.allowGuestControl !== false,
      updatedAtMs: nowMs,
      participants: [hostParticipant],
    };

    roomsStore.set(code, room);
    res.status(201).json({ room: toPublicRoomSnapshot(room) });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = normalizeRoomCode(req.params.code || '');
    if (!isValidRoomCode(code)) {
      res.status(400).json({ error: 'Invalid room code format. Use 4-8 letters or numbers.' });
      return;
    }
    const room = roomsStore.get(code);
    if (!room) {
      res.status(404).json({ error: `Listening room "${code}" was not found or has ended.` });
      return;
    }
    res.json({ room: toPublicRoomSnapshot(room) });
  });

  app.post('/api/rooms/:code/join', (req, res) => {
    const code = normalizeRoomCode(req.params.code || '');
    const room = roomsStore.get(code);
    if (!room) {
      res.status(404).json({ error: `Listening room "${code}" was not found or has ended.` });
      return;
    }

    const body = req.body || {};
    const clientId = String(body.clientId || `guest_${Date.now()}`).slice(0, 80);
    const displayName = String(body.displayName || 'Haven Listener').slice(0, 80);
    const existingIdx = room.participants.findIndex((p) => p.clientId === clientId);

    if (existingIdx === -1) {
      room.participants.push({
        clientId,
        displayName,
        isHost: clientId === room.hostId,
        joinedAtMs: Date.now(),
      });
    } else {
      room.participants[existingIdx] = {
        ...room.participants[existingIdx],
        displayName,
      };
    }

    const snapshot = toPublicRoomSnapshot(room);
    broadcastRoomEvent(code, 'room:state', { room: snapshot });
    res.json({ room: snapshot });
  });

  app.post('/api/rooms/:code/leave', (req, res) => {
    const code = normalizeRoomCode(req.params.code || '');
    const room = roomsStore.get(code);
    if (!room) {
      res.json({ ok: true });
      return;
    }
    const clientId = String(req.body?.clientId || '');
    room.participants = room.participants.filter((p) => p.clientId !== clientId);
    if (room.participants.length === 0) {
      roomsStore.delete(code);
      broadcastRoomEvent(code, 'room:closed', { code });
    } else {
      broadcastRoomEvent(code, 'room:state', { room: toPublicRoomSnapshot(room) });
    }
    res.json({ ok: true });
  });

  app.post('/api/rooms/:code/sync', (req, res) => {
    const code = normalizeRoomCode(req.params.code || '');
    const room = roomsStore.get(code);
    if (!room) {
      res.status(404).json({ error: `Listening room "${code}" does not exist.` });
      return;
    }

    const body = req.body || {};
    const clientId = String(body.clientId || '');
    const isHost = clientId === room.hostId;
    if (!isHost && !room.allowGuestControl) {
      res.status(403).json({ error: 'Only the room host can control playback right now.' });
      return;
    }

    const nowMs = Date.now();
    const action = String(body.action || 'sync');
    const currentPos = computeSyncedPositionSeconds(room, nowMs);

    if (action === 'play') {
      room.isPlaying = true;
      room.positionSeconds =
        typeof body.positionSeconds === 'number'
          ? Math.max(0, Math.min(room.trackDuration, body.positionSeconds))
          : currentPos;
    } else if (action === 'pause') {
      room.isPlaying = false;
      room.positionSeconds =
        typeof body.positionSeconds === 'number'
          ? Math.max(0, Math.min(room.trackDuration, body.positionSeconds))
          : currentPos;
    } else if (action === 'seek') {
      room.positionSeconds = Math.max(0, Math.min(room.trackDuration, Number(body.positionSeconds ?? currentPos)));
    } else if (action === 'track' && body.track) {
      const nextTrack = body.track;
      room.trackId = String(nextTrack.id || room.trackId).slice(0, 128);
      room.trackTitle = String(nextTrack.title || room.trackTitle).slice(0, 120);
      room.trackCreator = String(nextTrack.creator || room.trackCreator).slice(0, 80);
      room.trackCoverArt = String(nextTrack.coverArt || room.trackCoverArt).slice(0, 500);
      room.trackDuration = Math.max(1, Math.min(3600, Number(nextTrack.duration || 180)));
      room.trackSnapshot = nextTrack;
      room.positionSeconds = 0;
      if (typeof body.isPlaying === 'boolean') {
        room.isPlaying = body.isPlaying;
      }
    } else if (action === 'settings' && isHost) {
      if (typeof body.allowGuestControl === 'boolean') {
        room.allowGuestControl = body.allowGuestControl;
      }
      if (typeof body.name === 'string' && body.name.trim()) {
        room.name = body.name.trim().slice(0, 80);
      }
    }

    room.updatedAtMs = nowMs;
    const snapshot = toPublicRoomSnapshot(room);
    broadcastRoomEvent(code, 'room:state', { room: snapshot });
    res.json({ room: snapshot });
  });

  app.get('/api/rooms/:code/events', (req, res) => {
    const code = normalizeRoomCode(req.params.code || '');
    const room = roomsStore.get(code);
    if (!room) {
      res.status(404).json({ error: `Listening room "${code}" was not found.` });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let subs = roomSubscribers.get(code);
    if (!subs) {
      subs = new Set();
      roomSubscribers.set(code, subs);
    }
    subs.add(res);

    res.write(`event: room:state\ndata: ${JSON.stringify({ room: toPublicRoomSnapshot(room) })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(keepAlive);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      subs?.delete(res);
    });
  });

  app.delete('/api/rooms/:code', (req, res) => {
    const code = normalizeRoomCode(req.params.code || '');
    const room = roomsStore.get(code);
    if (!room) {
      res.json({ ok: true });
      return;
    }
    const clientId = String(req.body?.clientId || req.query.clientId || '');
    if (clientId && clientId !== room.hostId) {
      res.status(403).json({ error: 'Only the room host can close this room.' });
      return;
    }
    roomsStore.delete(code);
    broadcastRoomEvent(code, 'room:closed', { code });
    res.json({ ok: true });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Music Haven server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start AI Music Haven server:', err);
  process.exit(1);
});
