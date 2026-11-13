import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileAudio,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
  AlertCircle,
  Lock,
  LogIn,
  Tag,
  RefreshCw,
  Edit3,
  BookOpen,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AudioTrack, BatchUploadItem, HavenLicense, UploadDraft } from '../types/index.ts';
import { generateDeterministicWaveform, semitonesToPlaybackRate } from '../utils/audioMath.ts';
import { SURVIVAL_AUDIO_URL } from '../data/initialTracks.ts';
import {
  CANONICAL_GENRES,
  CANONICAL_MOODS,
  validateAudioFile,
  deriveTitleFromFilename,
  buildCreatorHandle,
  applyCategoryConfirmation,
  buildSafeTrackId,
  type CategorizationResult,
} from '../utils/trackCategorizer.ts';
import {
  parseBatchFileDescriptors,
  createInitialDraftFromFile,
  buildFallbackCategorization,
  type ParsedBatchFileEntry,
  type RejectedBatchFile,
} from '../utils/batchUpload.ts';
import { HavenLogo } from './HavenLogo.tsx';
import { BatchUploadQueue } from './BatchUploadQueue.tsx';
import { MicTranscribeButton, type AiQuotaRequestContext } from './MicTranscribeButton.tsx';
import { CaptionLyricsButton } from './CaptionLyricsButton.tsx';
import { UserAiCapBadge } from './UserAiCapBadge.tsx';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface UploadViewProps {
  authUser: User | null;
  authLoading?: boolean;
  aiQuota: UserAiQuotaState;
  aiQuotaRequestContext: AiQuotaRequestContext;
  onAiQuotaUpdate: (quota: UserAiQuotaState) => void;
  onSignInGoogle: () => Promise<void> | void;
  onPublishTrack: (newTrack: AudioTrack) => Promise<void> | void;
  onGoToTrack: (track: AudioTrack) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  authUser,
  authLoading = false,
  aiQuota,
  aiQuotaRequestContext,
  onAiQuotaUpdate,
  onSignInGoogle,
  onPublishTrack,
  onGoToTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAudioFileRef = useRef<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [draft, setDraft] = useState<UploadDraft>({
    fileName: 'cyber_solitude_final_master.wav',
    fileSize: 44200000,
    fileFormat: 'WAV 24-bit Lossless',
    durationSeconds: 196,
    sampleRateLabel: '48 kHz / 24-bit',
    title: 'Cyber Solitude',
    creator: authUser?.displayName || 'Haven Creator',
    creatorHandle: buildCreatorHandle(authUser?.displayName, authUser?.uid),
    coverArt:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    aiToolOrigin: 'Suno v3.5',
    description:
      'Deep nocturnal cyberpunk ambient piece with subtle vocoder whispers, tape flutter, and vast spatial reverb.',
    story: '',
    lyrics: '',
    genre: 'Cyberpunk Ambient',
    subgenre: 'Darkwave Ambient',
    mood: 'Atmospheric',
    bpm: 122,
    key: 'C Minor',
    instruments: ['Sub-Bass Drone', 'Tape Flutters', 'Vocoder Whispers', 'Spatial Reverb'],
    vocalType: 'Ethereal Vocoder Whispers',
    language: 'English',
    energyLevel: 'Medium',
    musicalStyle: 'Nocturnal Cyber-Minimalism',
    license: 'Commercial Permitted',
    analyzing: false,
    analysisComplete: false,
    analysisProgress: 0,
    suggestedGenre: undefined,
    suggestedSubgenre: undefined,
    categoryConfirmed: false,
  });

  const batchAddInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('single');
  const [uploadedTrack, setUploadedTrack] = useState<AudioTrack | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [batchAiError, setBatchAiError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);

  // Batch Queue State
  const [batchItems, setBatchItems] = useState<BatchUploadItem[]>([]);
  const [batchRejected, setBatchRejected] = useState<RejectedBatchFile[]>([]);
  const [autoGenerateCoverOnBatch, setAutoGenerateCoverOnBatch] = useState<boolean>(true);
  const [isBatchPublishing, setIsBatchPublishing] = useState<boolean>(false);
  const [isBatchGeneratingCovers, setIsBatchGeneratingCovers] = useState<boolean>(false);
  const [publishedBatchTracks, setPublishedBatchTracks] = useState<Record<string, AudioTrack>>({});

  // Sync creator identity when Google account signs in
  useEffect(() => {
    if (authUser) {
      setDraft((prev) => ({
        ...prev,
        creator: authUser.displayName || prev.creator || 'Haven Creator',
        creatorHandle: buildCreatorHandle(authUser.displayName, authUser.uid),
      }));
    }
  }, [authUser]);

  const handleGoogleLoginClick = async () => {
    setAuthError(null);
    try {
      await onSignInGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in could not be completed.';
      setAuthError(msg);
    }
  };

  const inspectAudioFileMeta = async (
    file: File
  ): Promise<{ durationSeconds: number; sampleRateLabel: string }> => {
    let durationSeconds = 196;
    let sampleRateLabel = '48 kHz / 24-bit';
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const arrayBuf = await file.slice(0, 15 * 1024 * 1024).arrayBuffer();
        try {
          const decoded = await ctx.decodeAudioData(arrayBuf);
          if (decoded.duration > 1) {
            durationSeconds = Math.round(decoded.duration);
          }
          if (decoded.sampleRate) {
            sampleRateLabel = `${(decoded.sampleRate / 1000).toFixed(1).replace('.0', '')} kHz`;
          }
        } catch {
          // Graceful fallback if only a header slice or unsupported browser codec
        } finally {
          void ctx.close();
        }
      }
    } catch {
      // Non-fatal metadata inspection fallback
    }
    return { durationSeconds, sampleRateLabel };
  };

  const requestCoverArtwork = async (params: {
    title: string;
    genre: string;
    subgenre?: string;
    mood: string;
    energyLevel?: UploadDraft['energyLevel'];
  }): Promise<string> => {
    const response = await fetch('/api/generate-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        ...aiQuotaRequestContext,
      }),
    });
    const data = await response.json();
    if (data?.quota) {
      onAiQuotaUpdate(data.quota as UserAiQuotaState);
    }
    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Could not generate cover art.');
    }
    if (typeof data?.coverUrl === 'string' && data.coverUrl.trim()) {
      return data.coverUrl.trim();
    }
    throw new Error('Cover generator returned empty URL.');
  };

  const requestCategorization = async (targetDraft: UploadDraft): Promise<CategorizationResult> => {
    try {
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: targetDraft.fileName,
          fileSize: targetDraft.fileSize,
          fileFormat: targetDraft.fileFormat,
          durationSeconds: targetDraft.durationSeconds,
          sampleRateLabel: targetDraft.sampleRateLabel,
          title: targetDraft.title,
          description: targetDraft.description,
          aiToolOrigin: targetDraft.aiToolOrigin,
          ...aiQuotaRequestContext,
        }),
      });
      const data = await response.json();
      if (data?.quota) {
        onAiQuotaUpdate(data.quota as UserAiQuotaState);
      }
      if (!response.ok) {
        if (response.status === 429 && typeof data?.error === 'string') {
          setBatchAiError(data.error);
        }
        return buildFallbackCategorization({
          fileName: targetDraft.fileName,
          title: targetDraft.title,
          description: targetDraft.description,
        });
      }
      return data as CategorizationResult;
    } catch {
      return buildFallbackCategorization({
        fileName: targetDraft.fileName,
        title: targetDraft.title,
        description: targetDraft.description,
      });
    }
  };

  // Inspect real audio file header & duration non-destructively via Web Audio API (single track)
  const processSelectedFile = async (file: File) => {
    setFileError(null);
    const validation = validateAudioFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      setFileError(validation.reason || 'Invalid audio file.');
      return;
    }

    selectedAudioFileRef.current = file;
    const { durationSeconds, sampleRateLabel } = await inspectAudioFileMeta(file);
    const localAudioUrl = URL.createObjectURL(file);

    setUploadMode('single');
    setDraft((prev) => ({
      ...prev,
      fileName: file.name,
      fileSize: file.size,
      audioUrl: localAudioUrl,
      fileFormat: validation.formatLabel,
      durationSeconds,
      sampleRateLabel,
      title: deriveTitleFromFilename(file.name),
      coverGenerated: false,
      categoryConfirmed: false,
      suggestedGenre: undefined,
      suggestedSubgenre: undefined,
    }));
    setStep(2);
  };

  // Process multi-file batch drop/selection with AI metadata + optional auto-cover generation
  const enqueueBatchEntries = async (
    entries: ParsedBatchFileEntry[],
    rejected: RejectedBatchFile[],
    shouldAutoCover: boolean
  ) => {
    setFileError(null);
    setBatchRejected(rejected);
    if (entries.length === 0) {
      if (rejected.length > 0) {
        setFileError(rejected[0].reason || 'No supported audio files found in selection.');
      }
      return;
    }

    setUploadMode('batch');

    const initialBatchItems: BatchUploadItem[] = entries.map((entry) => ({
      id: entry.id,
      draft: entry.draft,
      status: 'queued',
      coverGenerated: false,
      isGeneratingCover: shouldAutoCover,
    }));

    setBatchItems((prev) => [...prev, ...initialBatchItems]);

    // Process queued items sequentially/paired so state updates cleanly
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      let meta = { durationSeconds: entry.draft.durationSeconds, sampleRateLabel: entry.draft.sampleRateLabel };
      if (entry.file) {
        meta = await inspectAudioFileMeta(entry.file);
      }

      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                status: 'categorizing',
                draft: {
                  ...item.draft,
                  durationSeconds: meta.durationSeconds,
                  sampleRateLabel: meta.sampleRateLabel,
                  analyzing: true,
                  analysisProgress: 45,
                },
              }
            : item
        )
      );

      const enrichedDraft: UploadDraft = {
        ...entry.draft,
        durationSeconds: meta.durationSeconds,
        sampleRateLabel: meta.sampleRateLabel,
      };
      const cat = await requestCategorization(enrichedDraft);

      let generatedCoverUrl: string | null = null;
      if (shouldAutoCover) {
        try {
          generatedCoverUrl = await requestCoverArtwork({
            title: enrichedDraft.title,
            genre: cat.suggestedGenre,
            subgenre: cat.suggestedSubgenre,
            mood: cat.mood,
            energyLevel: cat.energyLevel,
          });
        } catch {
          generatedCoverUrl = null;
        }
      }

      setBatchItems((prev) =>
        prev.map((item) => {
          if (item.id !== entry.id) return item;
          const nextCover = generatedCoverUrl || item.draft.coverArt;
          const coverDone = Boolean(generatedCoverUrl) || Boolean(item.coverGenerated);
          return {
            ...item,
            status: 'ready',
            coverGenerated: coverDone,
            isGeneratingCover: false,
            draft: {
              ...item.draft,
              durationSeconds: meta.durationSeconds,
              sampleRateLabel: meta.sampleRateLabel,
              analyzing: false,
              analysisComplete: true,
              analysisProgress: 100,
              suggestedGenre: cat.suggestedGenre,
              suggestedSubgenre: cat.suggestedSubgenre,
              genre: cat.suggestedGenre,
              subgenre: cat.suggestedSubgenre,
              mood: cat.mood,
              bpm: cat.bpm,
              key: cat.key,
              vocalType: cat.vocalType,
              energyLevel: cat.energyLevel,
              musicalStyle: cat.musicalStyle,
              instruments: cat.instruments,
              aiConfidence: cat.confidence,
              aiReasoning: cat.reasoning,
              alternativeCategories: cat.alternativeCategories,
              coverArt: nextCover,
              coverGenerated: coverDone,
            },
          };
        })
      );
    }
  };

  const handleMultiFileSelection = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (files.length === 1 && uploadMode === 'single') {
      await processSelectedFile(files[0]);
      return;
    }

    const descriptors = files.map((file) => {
      const check = validateAudioFile({ name: file.name, size: file.size, type: file.type });
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        fileRef: file,
        audioUrl: check.valid ? URL.createObjectURL(file) : undefined,
      };
    });

    const { accepted, rejected } = parseBatchFileDescriptors(
      descriptors,
      authUser?.displayName,
      authUser?.uid
    );
    await enqueueBatchEntries(accepted, rejected, autoGenerateCoverOnBatch);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleMultiFileSelection(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleMultiFileSelection(e.target.files);
      e.target.value = '';
    }
  };

  const handleLoadSampleFile = () => {
    setFileError(null);
    selectedAudioFileRef.current = null;
    setUploadMode('single');
    setDraft((prev) => ({
      ...prev,
      fileName: 'survival_sample_variant_minus1st.mp3',
      fileSize: 4500000,
      audioUrl: SURVIVAL_AUDIO_URL,
      pitchSemitones: -1,
      pitchRate: semitonesToPlaybackRate(-1),
      fileFormat: 'MP3 320kbps',
      durationSeconds: 199,
      sampleRateLabel: '44.1 kHz / 16-bit',
      title: 'Neon Horizon',
      coverGenerated: false,
      categoryConfirmed: false,
      suggestedGenre: undefined,
      suggestedSubgenre: undefined,
    }));
    setStep(2);
  };

  const handleLoadSampleBatch = async () => {
    const sampleSpecs = [
      {
        fileName: 'neon_solstice_synthwave_master.mp3',
        fileSize: 6400000,
        pitch: -1,
      },
      {
        fileName: 'midnight_lofi_rain_session.wav',
        fileSize: 18400000,
        pitch: 1,
      },
      {
        fileName: 'quantum_dawn_orchestral_anthem.flac',
        fileSize: 28200000,
        pitch: 2,
      },
    ];
    const entries: ParsedBatchFileEntry[] = sampleSpecs.map((s, idx) => {
      const check = validateAudioFile({ name: s.fileName, size: s.fileSize });
      return {
        id: `sample_batch_${Date.now()}_${idx}`,
        audioUrl: SURVIVAL_AUDIO_URL,
        draft: createInitialDraftFromFile({
          fileName: s.fileName,
          fileSize: s.fileSize,
          formatLabel: check.formatLabel,
          audioUrl: SURVIVAL_AUDIO_URL,
          creatorName: authUser?.displayName,
          creatorUid: authUser?.uid,
          durationSeconds: 199,
          sampleRateLabel: '44.1 kHz / 24-bit',
          pitchSemitones: s.pitch,
          pitchRate: semitonesToPlaybackRate(s.pitch),
        }),
      };
    });
    await enqueueBatchEntries(entries, [], autoGenerateCoverOnBatch);
  };

  const handleAutoGenerateSingleCover = async () => {
    setCoverError(null);
    setIsGeneratingCover(true);
    try {
      const url = await requestCoverArtwork({
        title: draft.title,
        genre: draft.genre,
        subgenre: draft.subgenre,
        mood: draft.mood,
        energyLevel: draft.energyLevel,
      });
      setDraft((prev) => ({ ...prev, coverArt: url, coverGenerated: true }));
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'Could not generate cover art.');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleBatchGenerateCover = async (id: string) => {
    const target = batchItems.find((i) => i.id === id);
    if (!target) return;
    setBatchAiError(null);
    setBatchItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isGeneratingCover: true } : i))
    );
    try {
      const url = await requestCoverArtwork({
        title: target.draft.title,
        genre: target.draft.genre,
        subgenre: target.draft.subgenre,
        mood: target.draft.mood,
        energyLevel: target.draft.energyLevel,
      });
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                isGeneratingCover: false,
                coverGenerated: true,
                draft: { ...i.draft, coverArt: url, coverGenerated: true },
              }
            : i
        )
      );
    } catch (err) {
      setBatchAiError(err instanceof Error ? err.message : 'Cover generation limit reached.');
      setBatchItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isGeneratingCover: false } : i))
      );
    }
  };

  const handleBatchGenerateAllCovers = async () => {
    setIsBatchGeneratingCovers(true);
    try {
      const targets = batchItems.filter((i) => i.status !== 'published' && !i.coverGenerated);
      for (const t of targets) {
        await handleBatchGenerateCover(t.id);
      }
    } finally {
      setIsBatchGeneratingCovers(false);
    }
  };

  const handleBatchGenerateStory = async (id: string) => {
    const target = batchItems.find((i) => i.id === id);
    if (!target) return;
    setBatchAiError(null);
    setBatchItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isGeneratingStory: true } : i))
    );
    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: target.draft.title,
          creator: target.draft.creator,
          genre: target.draft.genre,
          subgenre: target.draft.subgenre,
          mood: target.draft.mood,
          aiToolOrigin: target.draft.aiToolOrigin,
          description: target.draft.description,
          lyrics: target.draft.lyrics || '',
          ...aiQuotaRequestContext,
        }),
      });
      const data = await response.json();
      if (data?.quota) {
        onAiQuotaUpdate(data.quota as UserAiQuotaState);
      }
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Song Story Generator could not run right now.'
        );
      }
      const storyText =
        typeof data?.story === 'string' && data.story.trim()
          ? data.story.trim()
          : `Archived in AI Music Haven by ${target.draft.creator}, "${target.draft.title}" blends ${target.draft.genre} texture with a ${target.draft.mood.toLowerCase()} pulse.`;
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, isGeneratingStory: false, draft: { ...i.draft, story: storyText } }
            : i
        )
      );
    } catch (err) {
      setBatchAiError(err instanceof Error ? err.message : 'Unable to generate story.');
      setBatchItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isGeneratingStory: false } : i))
      );
    }
  };

  const handleBatchRetryCategorize = async (id: string) => {
    const target = batchItems.find((i) => i.id === id);
    if (!target) return;
    setBatchItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'categorizing' } : i))
    );
    const cat = await requestCategorization(target.draft);
    setBatchItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: i.draft.categoryConfirmed ? 'confirmed' : 'ready',
              draft: {
                ...i.draft,
                analyzing: false,
                analysisComplete: true,
                analysisProgress: 100,
                suggestedGenre: cat.suggestedGenre,
                suggestedSubgenre: cat.suggestedSubgenre,
                genre: cat.suggestedGenre,
                subgenre: cat.suggestedSubgenre,
                mood: cat.mood,
                bpm: cat.bpm,
                key: cat.key,
                vocalType: cat.vocalType,
                energyLevel: cat.energyLevel,
                musicalStyle: cat.musicalStyle,
                instruments: cat.instruments,
                aiConfidence: cat.confidence,
                aiReasoning: cat.reasoning,
                alternativeCategories: cat.alternativeCategories,
              },
            }
          : i
      )
    );
  };

  const buildTrackFromDraft = (sourceDraft: UploadDraft): AudioTrack => {
    const newTrackId = buildSafeTrackId(sourceDraft.title);
    return {
      id: newTrackId,
      uploaderUid: authUser?.uid,
      title: sourceDraft.title.trim() || 'Untitled AI Track',
      creator: sourceDraft.creator.trim() || authUser?.displayName || 'Haven Creator',
      creatorHandle: sourceDraft.creatorHandle || buildCreatorHandle(authUser?.displayName, authUser?.uid),
      creatorAvatar:
        authUser?.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      description: sourceDraft.description.trim() || 'Uploaded to AI Music Haven.',
      story: sourceDraft.story?.trim() ? sourceDraft.story.trim() : undefined,
      lyrics: sourceDraft.lyrics?.trim() ? sourceDraft.lyrics.trim() : undefined,
      aiToolOrigin: sourceDraft.aiToolOrigin,
      bpm: sourceDraft.bpm,
      key: sourceDraft.key,
      duration: sourceDraft.durationSeconds || 196,
      genre: sourceDraft.genre,
      subgenre: sourceDraft.subgenre,
      mood: sourceDraft.mood,
      vocalType: sourceDraft.vocalType,
      instruments: sourceDraft.instruments,
      language: sourceDraft.language,
      energyLevel: sourceDraft.energyLevel,
      musicalStyle: sourceDraft.musicalStyle,
      license: sourceDraft.license,
      coverArt: sourceDraft.coverArt,
      audioUrl: sourceDraft.audioUrl,
      pitchSemitones: sourceDraft.pitchSemitones,
      pitchRate: sourceDraft.pitchRate,
      waveform: generateDeterministicWaveform(newTrackId, 64),
      createdAt: 'Just now',
      plays: 1,
      likes: 1,
      downloads: 0,
      reposts: 0,
      rating: 5.0,
      ratingCount: 1,
      isLiked: true,
      fileFormat: sourceDraft.fileFormat || 'WAV 24-bit Lossless',
      fileSize: `${(sourceDraft.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      sampleRate: sourceDraft.sampleRateLabel || '48 kHz / 24-bit',
      lufs: -14.0,
      suggestedGenre: sourceDraft.suggestedGenre || sourceDraft.genre,
      suggestedSubgenre: sourceDraft.suggestedSubgenre || sourceDraft.subgenre,
      categoryConfirmed: true,
      comments: [],
    };
  };

  const handlePublishBatchItem = async (id: string) => {
    const target = batchItems.find((i) => i.id === id);
    if (!target || target.status === 'published') return;
    if (!target.draft.categoryConfirmed) {
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: 'error', errorMessage: 'Confirm the category before publishing.' }
            : i
        )
      );
      return;
    }

    setBatchItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'publishing', errorMessage: undefined } : i))
    );

    const newTrack = buildTrackFromDraft(target.draft);
    try {
      await onPublishTrack(newTrack);
      setPublishedBatchTracks((prev) => ({ ...prev, [newTrack.id]: newTrack }));
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'published', publishedTrackId: newTrack.id } : i
        )
      );
    } catch (err) {
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'error',
                errorMessage: err instanceof Error ? err.message : 'Publish failed.',
              }
            : i
        )
      );
    }
  };

  const handlePublishAllConfirmed = async () => {
    setIsBatchPublishing(true);
    try {
      const confirmed = batchItems.filter((i) => i.status === 'confirmed');
      for (const item of confirmed) {
        await handlePublishBatchItem(item.id);
      }
    } finally {
      setIsBatchPublishing(false);
    }
  };

  const handleAutoGenerateStory = async () => {
    setStoryError(null);
    setIsGeneratingStory(true);
    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          creator: draft.creator,
          genre: draft.genre,
          subgenre: draft.subgenre,
          mood: draft.mood,
          aiToolOrigin: draft.aiToolOrigin,
          description: draft.description,
          lyrics: draft.lyrics || '',
          ...aiQuotaRequestContext,
        }),
      });
      const data = await response.json();
      if (data?.quota) {
        onAiQuotaUpdate(data.quota as UserAiQuotaState);
      }
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Song Story Generator could not generate a story right now.'
        );
      }
      if (typeof data?.story === 'string' && data.story.trim()) {
        setDraft((prev) => ({ ...prev, story: data.story.trim() }));
      }
    } catch (err) {
      setStoryError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Song Story Generator. You can still write your story manually below.'
      );
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Run Automatic Non-Destructive AI Categorization via Server Endpoint
  const handleStartCategorization = async () => {
    setCategorizeError(null);
    setEditingCategory(false);
    setStep(3);
    setDraft((prev) => ({
      ...prev,
      analyzing: true,
      analysisComplete: false,
      analysisProgress: 25,
      categoryConfirmed: false,
    }));

    const progressTimer = setInterval(() => {
      setDraft((prev) => ({
        ...prev,
        analysisProgress: prev.analysisProgress < 88 ? prev.analysisProgress + 12 : prev.analysisProgress,
      }));
    }, 320);

    try {
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: draft.fileName,
          fileSize: draft.fileSize,
          fileFormat: draft.fileFormat,
          durationSeconds: draft.durationSeconds,
          sampleRateLabel: draft.sampleRateLabel,
          title: draft.title,
          description: draft.description,
          aiToolOrigin: draft.aiToolOrigin,
          ...aiQuotaRequestContext,
        }),
      });

      const payload = await response.json();
      clearInterval(progressTimer);
      if (payload?.quota) {
        onAiQuotaUpdate(payload.quota as UserAiQuotaState);
      }

      if (!response.ok) {
        const errMessage =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Automatic categorization service returned an error.';
        setCategorizeError(errMessage);
        setDraft((prev) => ({
          ...prev,
          analyzing: false,
          analysisComplete: true,
          analysisProgress: 100,
          suggestedGenre: prev.genre,
          suggestedSubgenre: prev.subgenre,
          categoryConfirmed: false,
        }));
        setStep(4);
        return;
      }

      const result = payload as CategorizationResult;
      setDraft((prev) => ({
        ...prev,
        analyzing: false,
        analysisComplete: true,
        analysisProgress: 100,
        suggestedGenre: result.suggestedGenre,
        suggestedSubgenre: result.suggestedSubgenre,
        genre: result.suggestedGenre,
        subgenre: result.suggestedSubgenre,
        mood: result.mood,
        bpm: result.bpm,
        key: result.key,
        vocalType: result.vocalType,
        energyLevel: result.energyLevel,
        musicalStyle: result.musicalStyle,
        instruments: result.instruments,
        aiConfidence: result.confidence,
        aiReasoning: result.reasoning,
        alternativeCategories: result.alternativeCategories,
        categoryConfirmed: false,
      }));
      setStep(4);
    } catch (err) {
      clearInterval(progressTimer);
      setCategorizeError(
        err instanceof Error
          ? err.message
          : 'Could not reach the automatic categorization service. Please confirm a category manually.'
      );
      setDraft((prev) => ({
        ...prev,
        analyzing: false,
        analysisComplete: true,
        analysisProgress: 100,
        suggestedGenre: prev.genre,
        suggestedSubgenre: prev.subgenre,
        categoryConfirmed: false,
      }));
      setStep(4);
    }
  };

  // Confirm AI Suggested Category or Custom Override
  const handleConfirmSuggested = () => {
    setEditingCategory(false);
    setDraft((prev) => applyCategoryConfirmation(prev, true));
  };

  const handleConfirmCustomCategory = () => {
    setEditingCategory(false);
    setDraft((prev) =>
      applyCategoryConfirmation(prev, false, {
        genre: prev.genre,
        subgenre: prev.subgenre,
        mood: prev.mood,
      })
    );
  };

  // Publish to AI Music Haven Library & Firestore
  const handlePublish = async () => {
    if (!draft.categoryConfirmed) {
      setPublishError('Please confirm the suggested category or choose your preferred category first.');
      return;
    }

    setPublishError(null);
    setIsPublishing(true);

    const newTrackId = buildSafeTrackId(draft.title);
    const newTrack: AudioTrack = {
      id: newTrackId,
      uploaderUid: authUser?.uid,
      title: draft.title.trim() || 'Untitled AI Track',
      creator: draft.creator.trim() || authUser?.displayName || 'Haven Creator',
      creatorHandle: draft.creatorHandle || buildCreatorHandle(authUser?.displayName, authUser?.uid),
      creatorAvatar:
        authUser?.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      description: draft.description.trim() || 'Uploaded to AI Music Haven.',
      story: draft.story?.trim() ? draft.story.trim() : undefined,
      lyrics: draft.lyrics?.trim() ? draft.lyrics.trim() : undefined,
      aiToolOrigin: draft.aiToolOrigin,
      bpm: draft.bpm,
      key: draft.key,
      duration: draft.durationSeconds || 196,
      genre: draft.genre,
      subgenre: draft.subgenre,
      mood: draft.mood,
      vocalType: draft.vocalType,
      instruments: draft.instruments,
      language: draft.language,
      energyLevel: draft.energyLevel,
      musicalStyle: draft.musicalStyle,
      license: draft.license,
      coverArt: draft.coverArt,
      audioUrl: draft.audioUrl,
      pitchSemitones: draft.pitchSemitones,
      pitchRate: draft.pitchRate,
      waveform: generateDeterministicWaveform(newTrackId, 64),
      createdAt: 'Just now',
      plays: 1,
      likes: 1,
      downloads: 0,
      reposts: 0,
      rating: 5.0,
      ratingCount: 1,
      isLiked: true,
      fileFormat: draft.fileFormat || 'WAV 24-bit Lossless',
      fileSize: `${(draft.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      sampleRate: draft.sampleRateLabel || '48 kHz / 24-bit',
      lufs: -14.0,
      suggestedGenre: draft.suggestedGenre || draft.genre,
      suggestedSubgenre: draft.suggestedSubgenre || draft.subgenre,
      categoryConfirmed: true,
      comments: [],
    };

    try {
      await onPublishTrack(newTrack);
      setUploadedTrack(newTrack);
      setStep(5);
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : 'Unable to save track to library. Please try again.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // GATE: Must Login with Google Account to Upload
  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto py-8 pb-24">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#161622]/75 border border-white/10 backdrop-blur-xl text-center space-y-6 shadow-[0_0_50px_rgba(139,92,246,0.12)]">
          <div className="w-16 h-16 rounded-2xl bg-[#08080C] border border-[#8B5CF6]/40 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(6,182,212,0.25)]">
            <HavenLogo size={36} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[11px] font-mono-tech text-[#06B6D4]">
              <Lock className="w-3 h-3" />
              <span>Verified Google Account Required to Upload</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Sign in with Google to Share Your Music
            </h1>
            <p className="text-xs sm:text-sm text-[#958ea0] max-w-md mx-auto leading-relaxed">
              Everyone can explore and listen to AI Music Haven freely. To upload completed AI-generated songs, receive automatic category suggestions, and manage your catalog, sign in with your Google account.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleGoogleLoginClick}
              disabled={authLoading}
              className="inline-flex items-center gap-2.5 px-7 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-sm font-semibold shadow-lg hover:shadow-[0_0_26px_rgba(139,92,246,0.45)] transition-all transform active:scale-95 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Opening Google Sign-In...' : 'Continue with Google'}</span>
            </button>
            <span className="text-[11px] font-mono-tech text-[#958ea0]">
              Completed audio files only · Zero audio alteration
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5 text-left">
            <div className="p-3 rounded-2xl bg-[#08080C]/80 border border-white/5 space-y-1">
              <span className="text-xs font-display font-semibold text-white block">1. Single or Batch Upload</span>
              <span className="text-[11px] text-[#958ea0] block">Drop one song or up to 20 completed MP3, WAV, FLAC, OGG, or M4A tracks at once.</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#08080C]/80 border border-white/5 space-y-1">
              <span className="text-xs font-display font-semibold text-white block">2. Auto Metadata &amp; Cover Art</span>
              <span className="text-[11px] text-[#958ea0] block">AI auto-categorizes every upload and generates bespoke cover art per track.</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#08080C]/80 border border-white/5 space-y-1">
              <span className="text-xs font-display font-semibold text-white block">3. Verified Attribution</span>
              <span className="text-[11px] text-[#958ea0] block">Published directly to the persistent AI Music Haven catalog.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Hidden input for adding additional batch files */}
      <input
        ref={batchAddInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Add additional audio files to batch"
      />

      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-xs font-mono-tech text-[#06B6D4]">
          <FileAudio className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Single or Batch Upload · Auto Metadata &amp; Cover Art · Zero Audio Alteration</span>
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white">
          Upload Your AI Music
        </h1>
        <p className="text-xs sm:text-sm text-[#958ea0] max-w-xl mx-auto">
          Drop a single track or a full batch of completed AI-generated songs. AI Music Haven automatically suggests metadata, categories, and bespoke cover art without modifying your audio.
        </p>
        <div className="pt-1 flex justify-center">
          <UserAiCapBadge quota={aiQuota} />
        </div>
      </div>

      {/* BATCH PROCESSING VIEW */}
      {uploadMode === 'batch' ? (
        <BatchUploadQueue
          items={batchItems}
          rejectedFiles={batchRejected}
          batchAiError={batchAiError}
          aiQuota={aiQuota}
          aiQuotaRequestContext={aiQuotaRequestContext}
          onAiQuotaUpdate={onAiQuotaUpdate}
          autoGenerateCoverOnBatch={autoGenerateCoverOnBatch}
          onToggleAutoGenerateCover={setAutoGenerateCoverOnBatch}
          onAddMoreFiles={() => batchAddInputRef.current?.click()}
          onUpdateItemDraft={(id, updater) =>
            setBatchItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, draft: updater(item.draft) } : item))
            )
          }
          onGenerateCover={handleBatchGenerateCover}
          onGenerateAllCovers={handleBatchGenerateAllCovers}
          onGenerateStory={handleBatchGenerateStory}
          onRetryCategorize={handleBatchRetryCategorize}
          onConfirmCategory={(id) =>
            setBatchItems((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: 'confirmed',
                      draft: applyCategoryConfirmation(item.draft, false, {
                        genre: item.draft.genre,
                        subgenre: item.draft.subgenre,
                        mood: item.draft.mood,
                      }),
                    }
                  : item
              )
            )
          }
          onConfirmAllReady={() =>
            setBatchItems((prev) =>
              prev.map((item) =>
                item.status === 'ready'
                  ? {
                      ...item,
                      status: 'confirmed',
                      draft: applyCategoryConfirmation(item.draft, true),
                    }
                  : item
              )
            )
          }
          onPublishItem={handlePublishBatchItem}
          onPublishAllConfirmed={handlePublishAllConfirmed}
          onRemoveItem={(id) =>
            setBatchItems((prev) => {
              const next = prev.filter((i) => i.id !== id);
              if (next.length === 0) {
                setUploadMode('single');
                setStep(1);
              }
              return next;
            })
          }
          onClearBatch={() => {
            setBatchItems([]);
            setBatchRejected([]);
            setBatchAiError(null);
            setUploadMode('single');
            setStep(1);
          }}
          onGoToTrackId={(trackId) => {
            const found = publishedBatchTracks[trackId];
            if (found) onGoToTrack(found);
          }}
          isBatchPublishing={isBatchPublishing}
          isBatchGeneratingCovers={isBatchGeneratingCovers}
        />
      ) : (
        <>
          {/* Step Indicators */}
          <div className="flex items-center justify-between px-4 sm:px-8">
            {[
              { num: 1, label: 'Select File(s)' },
              { num: 2, label: 'Song Info' },
              { num: 3, label: 'Auto-Categorize' },
              { num: 4, label: 'Confirm & License' },
              { num: 5, label: 'Published' },
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-mono-tech text-xs font-bold transition-all ${
                      step === s.num
                        ? 'bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white shadow-[0_0_14px_rgba(139,92,246,0.5)]'
                        : step > s.num
                        ? 'bg-[#10B981] text-white'
                        : 'bg-[#161622] text-[#958ea0] border border-white/10'
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span className="text-[10px] font-mono-tech text-[#958ea0] hidden sm:block">
                    {s.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div
                    className={`flex-1 h-[2px] mx-2 rounded-full transition-colors ${
                      step > idx + 1 ? 'bg-[#10B981]' : 'bg-white/10'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* STEP 1: Real File Picker & Drag & Drop (Single or Multiple Batch) */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
                onChange={handleFileInputChange}
                className="hidden"
                aria-label="Select audio files"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDropFile}
                onClick={() => fileInputRef.current?.click()}
                className={`p-10 sm:p-14 rounded-3xl border-2 border-dashed text-center transition-all flex flex-col items-center justify-center gap-4 cursor-pointer ${
                  isDragOver
                    ? 'border-[#06B6D4] bg-[#06B6D4]/10 shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                    : 'border-white/15 bg-[#161622]/40 hover:bg-[#161622]/70 hover:border-[#8B5CF6]/50'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#8B5CF6]/20 to-[#06B6D4]/20 border border-white/10 flex items-center justify-center text-[#06B6D4]">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-lg text-white">
                    Drag and drop one or multiple completed audio files here
                  </h3>
                  <p className="text-xs text-[#958ea0]">
                    Select 1 song for guided single upload or 2–20 tracks for AI Batch Processing · MP3, WAV, FLAC, OGG, M4A, AAC
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all"
                  >
                    Browse Audio Files on Device
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSampleFile();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono-tech text-[#e4e1e8] border border-white/10 transition-colors"
                  >
                    Use Sample Existing Track
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleLoadSampleBatch();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 text-xs font-mono-tech text-[#acedff] border border-[#8B5CF6]/40 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Load Sample Batch (3 Tracks)</span>
                  </button>
                </div>
              </div>

              {fileError && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-[#08080C] border border-white/5 flex items-center gap-3 text-xs text-[#958ea0]">
                <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>
                  <strong>Audio Integrity Guarantee:</strong> Your uploaded files remain in their exact original condition. AI Music Haven never alters, remixes, masters, or edits your audio.
                </span>
              </div>
            </div>
          )}

      {/* STEP 2: Song Metadata & Creator Info */}
      {step === 2 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#161622]/70 border border-white/10 backdrop-blur-xl space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-[#10B981]" />
              <div>
                <span className="font-display font-semibold text-sm text-white block">
                  File Selected: {draft.fileName}
                </span>
                <span className="text-[10px] font-mono-tech text-[#958ea0]">
                  {(draft.fileSize / (1024 * 1024)).toFixed(1)} MB · {draft.fileFormat} · {draft.sampleRateLabel}
                </span>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-mono-tech text-[#958ea0] hover:text-white"
            >
              Change File
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Song Title *
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Obsidian Resonance"
                  className="w-full bg-[#08080C] text-sm text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Creator Name (Google Verified) *
                </label>
                <input
                  type="text"
                  value={draft.creator}
                  onChange={(e) => setDraft({ ...draft, creator: e.target.value })}
                  placeholder="Your Name / Artist Alias"
                  className="w-full bg-[#08080C] text-sm text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  AI Tool Used to Create This Song
                </label>
                <select
                  value={draft.aiToolOrigin}
                  onChange={(e) => setDraft({ ...draft, aiToolOrigin: e.target.value })}
                  className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                >
                  <option value="Suno v3.5">Suno v3.5</option>
                  <option value="Udio v1.5">Udio v1.5</option>
                  <option value="Stable Audio 2.0">Stable Audio 2.0</option>
                  <option value="MusicLM">Google MusicLM</option>
                  <option value="ElevenLabs Music">ElevenLabs Music</option>
                  <option value="Custom / Fine-Tuned">Custom / Fine-Tuned Model</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                    Cover Artwork
                  </label>
                  <button
                    type="button"
                    disabled={isGeneratingCover}
                    onClick={() => void handleAutoGenerateSingleCover()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/40 text-[11px] font-mono-tech text-[#acedff] transition-colors disabled:opacity-60"
                  >
                    <ImageIcon className="w-3 h-3 text-[#06B6D4]" />
                    <span>{isGeneratingCover ? 'Generating Cover...' : 'Auto-Generate Cover'}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2.5">
                  <img
                    src={draft.coverArt}
                    alt={draft.title}
                    className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0 bg-[#08080C]"
                  />
                  <input
                    type="text"
                    value={draft.coverArt}
                    onChange={(e) => setDraft({ ...draft, coverArt: e.target.value, coverGenerated: false })}
                    placeholder="Paste artwork URL or auto-generate"
                    className="flex-1 bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none min-w-0"
                  />
                </div>
                {coverError && (
                  <p className="text-[11px] text-red-300 mt-1">{coverError}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Song Description &amp; Context
                </label>
                <MicTranscribeButton
                  targetField="description"
                  quotaContext={aiQuotaRequestContext}
                  onQuotaUpdate={onAiQuotaUpdate}
                  compact
                  label="Mic to Description"
                  onTranscribed={(text) =>
                    setDraft((prev) => ({
                      ...prev,
                      description: prev.description.trim()
                        ? `${prev.description.trim()} ${text}`
                        : text,
                    }))
                  }
                />
              </div>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                placeholder="Describe the atmosphere, instrumentation, or mood so AI can categorize your track and craft its story..."
                className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            {/* Song Lyrics (Optional) + Audio Captioning */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Song Lyric Captions (Optional — used by Story Generator)
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CaptionLyricsButton
                    audioFile={selectedAudioFileRef.current}
                    audioUrl={draft.audioUrl}
                    title={draft.title}
                    creator={draft.creator}
                    description={draft.description}
                    quotaContext={aiQuotaRequestContext}
                    onQuotaUpdate={onAiQuotaUpdate}
                    compact
                    label="Auto-Caption Lyrics"
                    onCaptioned={(captions) =>
                      setDraft((prev) => ({ ...prev, lyrics: captions }))
                    }
                  />
                  <MicTranscribeButton
                    targetField="lyrics"
                    quotaContext={aiQuotaRequestContext}
                    onQuotaUpdate={onAiQuotaUpdate}
                    compact
                    label="Mic Dictate"
                    onTranscribed={(text) =>
                      setDraft((prev) => ({
                        ...prev,
                        lyrics: prev.lyrics?.trim() ? `${prev.lyrics.trim()}\n${text}` : text,
                      }))
                    }
                  />
                </div>
              </div>
              <textarea
                value={draft.lyrics || ''}
                onChange={(e) => setDraft({ ...draft, lyrics: e.target.value })}
                rows={4}
                maxLength={4000}
                placeholder="Click 'Auto-Caption Lyrics' to generate timestamped captions directly from your song audio, or paste lyrics manually. Song Story Generator uses both your description and lyrics."
                className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            {/* Story Behind the Song + AI Music Haven Song Story Generator */}
            <div className="p-4 rounded-2xl bg-[#08080C]/80 border border-[#8B5CF6]/25 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <label className="text-xs font-mono-tech text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Story Behind the Song (Optional)</span>
                  </label>
                  <span className="text-[10px] font-mono-tech text-[#958ea0] block">
                    Generated from your description &amp; lyrics · Charged to your personal AI cap ({aiQuota.remaining}/{aiQuota.limit} left)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAutoGenerateStory()}
                  disabled={isGeneratingStory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6]/25 to-[#06B6D4]/25 hover:from-[#8B5CF6]/40 hover:to-[#06B6D4]/40 border border-[#8B5CF6]/40 text-[11px] font-mono-tech text-[#acedff] transition-all disabled:opacity-60 self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>
                    {isGeneratingStory
                      ? 'Generating Story...'
                      : 'Auto-Generate Story (Song Story Generator)'}
                  </span>
                </button>
              </div>
              {storyError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{storyError}</span>
                </div>
              )}
              <textarea
                value={draft.story || ''}
                onChange={(e) => setDraft({ ...draft, story: e.target.value })}
                rows={3}
                maxLength={1500}
                placeholder="Share the inspiration, meaning, or personal story behind this song — or use AI Music Haven's Song Story Generator above..."
                className="w-full bg-[#161622]/70 text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-mono-tech text-[#958ea0] hover:text-white"
            >
              Back
            </button>
            <button
              onClick={() => void handleStartCategorization()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze &amp; Suggest Category</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Automatic Non-Destructive Categorization Progress */}
      {step === 3 && (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#161622]/80 border border-white/10 backdrop-blur-xl text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#06B6D4] text-white flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(139,92,246,0.5)] animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-bold text-xl text-white">
              Automatically Categorizing &ldquo;{draft.title}&rdquo;
            </h3>
            <p className="text-xs text-[#958ea0] max-w-md mx-auto">
              Detecting primary genre, subgenre, mood, tempo, instrumentation, and vocal profile so listeners can find your song. Your audio file stays untouched.
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="h-2 w-full bg-[#08080C] rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981] rounded-full transition-all duration-300"
                style={{ width: `${draft.analysisProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono-tech text-[#958ea0]">
              <span>Classifying Track for Library Discovery</span>
              <span className="text-[#06B6D4] font-bold">{draft.analysisProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Confirm Suggested Category & Select Licensing */}
      {step === 4 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#161622]/70 border border-white/10 backdrop-blur-xl space-y-6 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 text-[#06B6D4] text-xs font-mono-tech mb-1">
              <Tag className="w-4 h-4" />
              <span>Automatic Categorization Ready · Confirmation Required</span>
            </div>
            <h2 className="font-display font-bold text-xl text-white">
              Confirm Suggested Category &amp; Licensing
            </h2>
          </div>

          {categorizeError && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Automatic AI Categorizer Unavailable</span>
                  <span className="text-amber-200/80">{categorizeError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleStartCategorization()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono-tech text-white shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry AI</span>
              </button>
            </div>
          )}

          {/* Suggested Category Banner + Confirmation Control */}
          <div
            className={`p-5 rounded-2xl border transition-all space-y-4 ${
              draft.categoryConfirmed
                ? 'bg-[#10B981]/10 border-[#10B981]/40'
                : 'bg-[#08080C]/90 border-[#8B5CF6]/40 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono-tech uppercase tracking-wider text-[#06B6D4]">
                    {draft.categoryConfirmed ? 'Confirmed Category' : 'Suggested Category'}
                  </span>
                  {draft.aiConfidence && (
                    <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#acedff] border border-[#8B5CF6]/30">
                      {draft.aiConfidence}% match
                    </span>
                  )}
                  {draft.categoryConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                      <CheckCircle2 className="w-3 h-3" />
                      Confirmed by Creator
                    </span>
                  )}
                </div>

                <div className="font-display font-bold text-xl text-white">
                  {draft.genre}{' '}
                  <span className="text-sm font-normal text-[#958ea0]">/ {draft.subgenre}</span>
                </div>
                {draft.aiReasoning && (
                  <p className="text-xs text-[#958ea0]">{draft.aiReasoning}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!draft.categoryConfirmed && (
                  <button
                    type="button"
                    onClick={handleConfirmSuggested}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold shadow-md transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Suggested Category</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingCategory(!editingCategory)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono-tech text-white border border-white/10 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{editingCategory ? 'Hide Editor' : 'Change Category'}</span>
                </button>
              </div>
            </div>

            {/* Alternative Category Chips */}
            {draft.alternativeCategories && draft.alternativeCategories.length > 0 && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono-tech text-[#958ea0]">Alternatives:</span>
                {draft.alternativeCategories.map((alt) => (
                  <button
                    key={`${alt.genre}-${alt.subgenre}`}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        genre: alt.genre,
                        subgenre: alt.subgenre,
                        categoryConfirmed: true,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#8B5CF6]/20 border border-white/10 hover:border-[#8B5CF6]/40 text-[11px] text-[#e4e1e8] transition-colors"
                  >
                    {alt.genre} · {alt.subgenre} ({alt.confidence}%)
                  </button>
                ))}
              </div>
            )}

            {/* Category Override / Fine-Tune Panel */}
            {(editingCategory || !draft.categoryConfirmed) && (
              <div className="pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono-tech text-[#958ea0]">Primary Genre</label>
                  <select
                    value={CANONICAL_GENRES.includes(draft.genre as (typeof CANONICAL_GENRES)[number]) ? draft.genre : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'Custom') {
                        setDraft({ ...draft, genre: val, categoryConfirmed: false });
                      }
                    }}
                    className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                  >
                    {CANONICAL_GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    {!CANONICAL_GENRES.includes(draft.genre as (typeof CANONICAL_GENRES)[number]) && (
                      <option value="Custom">{draft.genre}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono-tech text-[#958ea0]">Subgenre</label>
                  <input
                    type="text"
                    value={draft.subgenre}
                    onChange={(e) => setDraft({ ...draft, subgenre: e.target.value, categoryConfirmed: false })}
                    className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono-tech text-[#958ea0]">Mood</label>
                  <select
                    value={CANONICAL_MOODS.includes(draft.mood as (typeof CANONICAL_MOODS)[number]) ? draft.mood : 'Custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'Custom') {
                        setDraft({ ...draft, mood: val });
                      }
                    }}
                    className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                  >
                    {CANONICAL_MOODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {!CANONICAL_MOODS.includes(draft.mood as (typeof CANONICAL_MOODS)[number]) && (
                      <option value="Custom">{draft.mood}</option>
                    )}
                  </select>
                </div>

                {editingCategory && (
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmCustomCategory}
                      className="px-4 py-1.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891b2] text-white text-xs font-semibold transition-colors"
                    >
                      Save &amp; Confirm Category Choice
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extracted Non-Destructive Acoustic Attributes */}
          <div className="p-4 rounded-2xl bg-[#08080C]/80 border border-white/5 space-y-3">
            <span className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
              Detected Catalog Metadata (Non-Destructive)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono-tech text-[#958ea0]">BPM</label>
                <input
                  type="number"
                  value={draft.bpm}
                  onChange={(e) => setDraft({ ...draft, bpm: parseInt(e.target.value, 10) || 120 })}
                  className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono-tech text-[#958ea0]">Musical Key</label>
                <input
                  type="text"
                  value={draft.key}
                  onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                  className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono-tech text-[#958ea0]">Vocal Type</label>
                <input
                  type="text"
                  value={draft.vocalType}
                  onChange={(e) => setDraft({ ...draft, vocalType: e.target.value })}
                  className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                />
              </div>
            </div>
          </div>

          {/* Licensing Selection */}
          <div className="space-y-3">
            <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
              Select Distribution License Terms *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'Commercial Permitted' as HavenLicense,
                  title: 'Commercial Permitted',
                  desc: 'Users may stream, download, and use in commercial projects (games, video, podcasts).',
                },
                {
                  id: 'Attribution Required' as HavenLicense,
                  title: 'Attribution Required (CC-BY)',
                  desc: 'Free to stream and share, but creators must credit your artist name.',
                },
                {
                  id: 'Free Personal' as HavenLicense,
                  title: 'Free Personal Use Only',
                  desc: 'Community can stream and download for personal listening only.',
                },
                {
                  id: 'All Rights Reserved' as HavenLicense,
                  title: 'All Rights Reserved',
                  desc: 'Streamable only on AI Music Haven. Downloads require direct creator permission.',
                },
              ].map((lic) => {
                const isSelected = draft.license === lic.id;
                return (
                  <div
                    key={lic.id}
                    onClick={() => setDraft({ ...draft, license: lic.id })}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-1 ${
                      isSelected
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                        : 'bg-[#08080C] hover:bg-[#161622] border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold text-xs text-white">{lic.title}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#06B6D4]" />}
                    </div>
                    <p className="text-[11px] text-[#958ea0]">{lic.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {publishError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{publishError}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-mono-tech text-[#958ea0] hover:text-white"
            >
              Back
            </button>
            <button
              onClick={() => void handlePublish()}
              disabled={!draft.categoryConfirmed || isPublishing}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                draft.categoryConfirmed
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white shadow-lg hover:shadow-[0_0_24px_rgba(139,92,246,0.45)] transform active:scale-95'
                  : 'bg-white/5 text-[#958ea0] border border-white/10 cursor-not-allowed'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>
                {isPublishing
                  ? 'Publishing to Haven...'
                  : draft.categoryConfirmed
                  ? 'Publish to AI Music Haven'
                  : 'Confirm Category to Publish'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Upload Success & Share */}
      {step === 5 && uploadedTrack && (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#161622]/80 border border-[#10B981]/40 backdrop-blur-xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/20 border border-[#10B981] text-[#10B981] flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(16,185,129,0.4)]">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display font-bold text-2xl text-white">
              &ldquo;{uploadedTrack.title}&rdquo; is Live!
            </h2>
            <p className="text-xs text-[#958ea0] max-w-md mx-auto">
              Your completed AI track has been saved to the AI Music Haven database and cataloged under the confirmed <strong>{uploadedTrack.genre}</strong> category.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#08080C] border border-white/10 max-w-md mx-auto flex items-center gap-3.5 text-left">
            <img src={uploadedTrack.coverArt} alt={uploadedTrack.title} className="w-14 h-14 rounded-xl object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-display font-semibold text-sm text-white truncate block">
                {uploadedTrack.title}
              </span>
              <span className="text-xs text-[#958ea0] block">
                by {uploadedTrack.creator} · {uploadedTrack.bpm} BPM · {uploadedTrack.genre}
              </span>
              <span className="text-[10px] font-mono-tech text-[#10B981] mt-0.5 inline-block">
                {uploadedTrack.license}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onGoToTrack(uploadedTrack)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg transition-all"
            >
              Open Track Page
            </button>

            <button
              onClick={() => {
                setCategorizeError(null);
                setPublishError(null);
                setStep(1);
              }}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono-tech border border-white/10 transition-colors"
            >
              Upload Another Track
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
