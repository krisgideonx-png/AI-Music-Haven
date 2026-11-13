import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Heart,
  Download,
  Share2,
  Star,
  Sparkles,
  Radio,
  Check,
  ArrowRight,
  Edit3,
  Save,
  AlertCircle,
  Lock,
  ShieldAlert,
  BookOpen,
  Captions,
  MessageSquare,
} from 'lucide-react';
import type { AudioTrack, HavenLicense } from '../types/index.ts';
import {
  formatTime,
  calculateLoudnessNormalizationDb,
  TARGET_PLAYBACK_LUFS,
} from '../utils/audioMath.ts';
import { CANONICAL_GENRES, CANONICAL_MOODS } from '../utils/trackCategorizer.ts';
import {
  buildTrackShareUrl,
  buildTwitterShareUrl,
  buildRedditShareUrl,
  buildDiscordShareMessage,
  copyTextToClipboard,
} from '../utils/trackShare.ts';
import { parseLyricCaptions, getActiveCaptionAtTime } from '../utils/captionLyrics.ts';
import { MicTranscribeButton, type AiQuotaRequestContext } from './MicTranscribeButton.tsx';
import { CaptionLyricsButton } from './CaptionLyricsButton.tsx';
import { WaveformBeatDancer } from './WaveformBeatDancer.tsx';
import { UserAiCapBadge } from './UserAiCapBadge.tsx';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface TrackDetailsModalProps {
  track: AudioTrack | null;
  isOpen: boolean;
  initialEditMode?: boolean;
  canEdit?: boolean;
  permissionRole?: 'admin' | 'owner' | 'readonly';
  aiQuota?: UserAiQuotaState;
  aiQuotaRequestContext?: AiQuotaRequestContext;
  onAiQuotaUpdate?: (quota: UserAiQuotaState) => void;
  onClose: () => void;
  isPlaying: boolean;
  playbackProgress?: number;
  onSeek?: (ratio: number) => void;
  onTogglePlay: () => void;
  onLikeTrack: (trackId: string) => void;
  onAddComment: (trackId: string, commentText: string, rating: number) => void;
  onUpdateTrack: (trackId: string, updates: Partial<AudioTrack>) => Promise<void> | void;
  relatedTracks: AudioTrack[];
  onSelectTrack: (track: AudioTrack) => void;
}

export const TrackDetailsModal: React.FC<TrackDetailsModalProps> = ({
  track,
  isOpen,
  initialEditMode = false,
  canEdit = false,
  permissionRole = 'readonly',
  aiQuota,
  aiQuotaRequestContext,
  onAiQuotaUpdate,
  onClose,
  isPlaying,
  playbackProgress = 0,
  onSeek,
  onTogglePlay,
  onLikeTrack,
  onAddComment,
  onUpdateTrack,
  relatedTracks,
  onSelectTrack,
}) => {
  const [commentInput, setCommentInput] = useState('');
  const [userRating, setUserRating] = useState(5);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [sessionCaptionsByTrack, setSessionCaptionsByTrack] = useState<Record<string, string>>({});

  // Song metadata editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCreator, setEditCreator] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLyrics, setEditLyrics] = useState('');
  const [editStory, setEditStory] = useState('');
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [editGenre, setEditGenre] = useState('');
  const [editSubgenre, setEditSubgenre] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editBpm, setEditBpm] = useState(120);
  const [editKey, setEditKey] = useState('');
  const [editVocalType, setEditVocalType] = useState('');
  const [editAiToolOrigin, setEditAiToolOrigin] = useState('');
  const [editLicense, setEditLicense] = useState<HavenLicense>('Commercial Permitted');
  const [editCoverArt, setEditCoverArt] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setEditError(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (track && isOpen) {
      setEditTitle(track.title);
      setEditCreator(track.creator);
      setEditDescription(track.description);
      setEditLyrics(track.lyrics || '');
      setEditStory(track.story || '');
      setEditGenre(track.genre);
      setEditSubgenre(track.subgenre);
      setEditMood(track.mood);
      setEditBpm(track.bpm);
      setEditKey(track.key);
      setEditVocalType(track.vocalType);
      setEditAiToolOrigin(track.aiToolOrigin);
      setEditLicense(track.license);
      setEditCoverArt(track.coverArt);
      setEditError(null);
      setIsEditing(Boolean(initialEditMode && canEdit));
    }
  }, [track?.id, isOpen, initialEditMode, canEdit]);

  if (!isOpen || !track) return null;

  const fallbackQuotaContext: AiQuotaRequestContext = aiQuotaRequestContext || {
    userId: null,
    visitorId: 'modal-visitor',
    tier: 'Free',
    quotaUsed: 0,
    quotaCycle: '2026-11',
  };

  const handleOpenEdit = () => {
    if (!canEdit) return;
    setEditTitle(track.title);
    setEditCreator(track.creator);
    setEditDescription(track.description);
    setEditLyrics(track.lyrics || '');
    setEditStory(track.story || '');
    setEditGenre(track.genre);
    setEditSubgenre(track.subgenre);
    setEditMood(track.mood);
    setEditBpm(track.bpm);
    setEditKey(track.key);
    setEditVocalType(track.vocalType);
    setEditAiToolOrigin(track.aiToolOrigin);
    setEditLicense(track.license);
    setEditCoverArt(track.coverArt);
    setEditError(null);
    setIsEditing(true);
  };

  const handleAutoGenerateStory = async () => {
    setEditError(null);
    setIsGeneratingStory(true);
    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle || track.title,
          creator: editCreator || track.creator,
          genre: editGenre || track.genre,
          subgenre: editSubgenre || track.subgenre,
          mood: editMood || track.mood,
          aiToolOrigin: editAiToolOrigin || track.aiToolOrigin,
          description: editDescription || track.description,
          lyrics: editLyrics,
          ...fallbackQuotaContext,
        }),
      });
      const data = await response.json();
      if (data?.quota && onAiQuotaUpdate) {
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
        setEditStory(data.story.trim());
      }
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Song Story Generator. You can write or edit the story manually.'
      );
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setEditError('Only the song uploader or Admin can edit this song.');
      return;
    }
    if (!editTitle.trim()) {
      setEditError('Song title cannot be empty.');
      return;
    }
    if (!editCreator.trim()) {
      setEditError('Creator name cannot be empty.');
      return;
    }

    setEditError(null);
    setIsSavingEdit(true);
    try {
      await onUpdateTrack(track.id, {
        title: editTitle.trim(),
        creator: editCreator.trim(),
        description: editDescription.trim() || track.description,
        lyrics: editLyrics.trim(),
        story: editStory.trim(),
        genre: editGenre.trim() || track.genre,
        subgenre: editSubgenre.trim() || track.subgenre,
        mood: editMood.trim() || track.mood,
        bpm: Number.isFinite(editBpm) ? editBpm : track.bpm,
        key: editKey.trim() || track.key,
        vocalType: editVocalType.trim() || track.vocalType,
        aiToolOrigin: editAiToolOrigin.trim() || track.aiToolOrigin,
        license: editLicense,
        coverArt: editCoverArt.trim() || track.coverArt,
      });
      setIsEditing(false);
      setDownloadSuccessToast(`Saved updated details for "${editTitle.trim()}"`);
      setTimeout(() => setDownloadSuccessToast(null), 3500);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save song details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(track.id, commentInput, userRating);
    setCommentInput('');
  };

  const handleDownloadFile = (format: string) => {
    if (track.audioUrl) {
      const a = document.createElement('a');
      a.href = track.audioUrl;
      const safeName = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ai-music-haven-track';
      a.download = `${safeName}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setDownloadSuccessToast(`Downloading "${track.title}" in ${format}...`);
    setTimeout(() => setDownloadSuccessToast(null), 3500);
  };

  const shareUrl = buildTrackShareUrl(
    typeof window !== 'undefined' ? window.location.origin : '',
    typeof window !== 'undefined' ? window.location.pathname : '/',
    track.id
  );
  const twitterShareUrl = buildTwitterShareUrl({
    shareUrl,
    title: track.title,
    creator: track.creator,
  });
  const redditShareUrl = buildRedditShareUrl({
    shareUrl,
    title: track.title,
    creator: track.creator,
  });

  const handleCopyShare = async () => {
    const copied = await copyTextToClipboard(shareUrl);
    setCopiedLink(true);
    setDownloadSuccessToast(
      copied
        ? `Share link copied for "${track.title}"`
        : `Share link ready: ${shareUrl}`
    );
    setTimeout(() => setCopiedLink(false), 2500);
    setTimeout(() => setDownloadSuccessToast(null), 3500);
  };

  const handleCopyDiscordShare = async () => {
    const discordPayload = buildDiscordShareMessage({
      shareUrl,
      title: track.title,
      creator: track.creator,
    });
    const copied = await copyTextToClipboard(discordPayload);
    setCopiedDiscord(true);
    setDownloadSuccessToast(
      copied
        ? `Discord share message & link copied for "${track.title}"`
        : `Discord link ready: ${shareUrl}`
    );
    setTimeout(() => setCopiedDiscord(false), 2500);
    setTimeout(() => setDownloadSuccessToast(null), 3500);
  };

  const handleQuickCaptionSave = async (captionedLyrics: string) => {
    setSessionCaptionsByTrack((prev) => ({ ...prev, [track.id]: captionedLyrics }));
    setEditLyrics(captionedLyrics);
    if (canEdit) {
      try {
        await onUpdateTrack(track.id, { lyrics: captionedLyrics });
        setDownloadSuccessToast(`Captioned lyrics saved for "${track.title}"`);
        setTimeout(() => setDownloadSuccessToast(null), 3500);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Unable to save captioned lyrics.');
      }
    } else {
      setDownloadSuccessToast(`Live lyric captions generated for "${track.title}"`);
      setTimeout(() => setDownloadSuccessToast(null), 3500);
    }
  };

  const effectiveLyrics = sessionCaptionsByTrack[track.id] ?? track.lyrics ?? '';
  const captionCues = parseLyricCaptions(effectiveLyrics);
  const currentTimeSec = (track.duration || 180) * playbackProgress;
  const activeCaption = isPlaying
    ? getActiveCaptionAtTime(captionCues, currentTimeSec, track.duration)
    : captionCues[0] || null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      {/* Toast Notification */}
      {downloadSuccessToast && (
        <div className="fixed top-6 right-6 bg-[#161622] border border-[#06B6D4]/50 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-[#10B981]" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}

      <div className="relative w-full max-w-4xl bg-[#0F0F16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/5 bg-[#08080C]/80">
          <div className="flex items-center gap-2 text-xs font-mono-tech text-[#06B6D4] min-w-0">
            <Radio className="w-4 h-4 shrink-0" />
            <span className="truncate">{isEditing ? 'Edit Song Title & Metadata' : 'Track Dossier & Audio Spec'}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit ? (
              !isEditing && (
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#8B5CF6]/20 border border-white/10 hover:border-[#8B5CF6]/40 text-xs font-mono-tech text-white transition-colors whitespace-nowrap"
                >
                  {permissionRole === 'admin' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />
                  ) : (
                    <Edit3 className="w-3.5 h-3.5 text-[#06B6D4]" />
                  )}
                  <span>{permissionRole === 'admin' ? 'Admin Edit' : 'Edit Details'}</span>
                </button>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] font-mono-tech text-[#958ea0] whitespace-nowrap">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Read-Only</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#958ea0] hover:text-white hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close Track Details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
          {/* Edit Song Title & Details Form */}
          {canEdit && isEditing && (
            <form
              onSubmit={(e) => void handleSaveEdit(e)}
              className="p-5 sm:p-6 rounded-2xl bg-[#161622] border border-[#8B5CF6]/40 space-y-5 shadow-[0_0_24px_rgba(139,92,246,0.12)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-white">
                    Edit Song Title &amp; Details
                  </h3>
                  <p className="text-[11px] text-[#958ea0]">
                    Update catalog metadata cleanly. Original audio remains completely untouched.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {aiQuota && <UserAiCapBadge quota={aiQuota} compact />}
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs font-mono-tech text-[#958ea0] hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="edit-song-title" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Song Title *
                  </label>
                  <input
                    id="edit-song-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={120}
                    className="w-full bg-[#08080C] text-sm text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-creator" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Creator / Artist Name *
                  </label>
                  <input
                    id="edit-song-creator"
                    type="text"
                    value={editCreator}
                    onChange={(e) => setEditCreator(e.target.value)}
                    maxLength={80}
                    className="w-full bg-[#08080C] text-sm text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="edit-song-description" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Song Description
                  </label>
                  <MicTranscribeButton
                    targetField="description"
                    quotaContext={fallbackQuotaContext}
                    onQuotaUpdate={onAiQuotaUpdate}
                    compact
                    label="Mic to Description"
                    onTranscribed={(text) =>
                      setEditDescription((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
                    }
                  />
                </div>
                <textarea
                  id="edit-song-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="edit-song-lyrics" className="text-[11px] font-mono-tech text-[#958ea0] uppercase flex items-center gap-1.5">
                    <Captions className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Song Lyric Captions (Used with Description by Story Generator)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CaptionLyricsButton
                      audioUrl={track.audioUrl}
                      title={editTitle || track.title}
                      creator={editCreator || track.creator}
                      description={editDescription || track.description}
                      quotaContext={fallbackQuotaContext}
                      onQuotaUpdate={onAiQuotaUpdate}
                      compact
                      label="Auto-Caption Lyrics"
                      onCaptioned={(captions) => setEditLyrics(captions)}
                    />
                    <MicTranscribeButton
                      targetField="lyrics"
                      quotaContext={fallbackQuotaContext}
                      onQuotaUpdate={onAiQuotaUpdate}
                      compact
                      label="Mic Dictate"
                      onTranscribed={(text) =>
                        setEditLyrics((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text))
                      }
                    />
                  </div>
                </div>
                <textarea
                  id="edit-song-lyrics"
                  value={editLyrics}
                  onChange={(e) => setEditLyrics(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Click 'Auto-Caption Lyrics' to generate timestamped captions directly from the song audio, or edit lyrics manually..."
                  className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="edit-song-story" className="text-[11px] font-mono-tech text-[#958ea0] uppercase flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Story Behind the Song</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleAutoGenerateStory()}
                    disabled={isGeneratingStory}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/40 text-[11px] font-mono-tech text-[#acedff] transition-colors disabled:opacity-60"
                  >
                    <Sparkles className="w-3 h-3 text-[#06B6D4]" />
                    <span>{isGeneratingStory ? 'Generating...' : 'Auto-Generate from Description & Lyrics'}</span>
                  </button>
                </div>
                <textarea
                  id="edit-song-story"
                  value={editStory}
                  onChange={(e) => setEditStory(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder="Write the story behind this song or auto-generate it using AI Music Haven's Song Story Generator..."
                  className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-song-genre" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Primary Genre
                  </label>
                  <select
                    id="edit-song-genre"
                    value={CANONICAL_GENRES.includes(editGenre as (typeof CANONICAL_GENRES)[number]) ? editGenre : 'Custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'Custom') setEditGenre(e.target.value);
                    }}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  >
                    {CANONICAL_GENRES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    {!CANONICAL_GENRES.includes(editGenre as (typeof CANONICAL_GENRES)[number]) && (
                      <option value="Custom">{editGenre}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-subgenre" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Subgenre
                  </label>
                  <input
                    id="edit-song-subgenre"
                    type="text"
                    value={editSubgenre}
                    onChange={(e) => setEditSubgenre(e.target.value)}
                    maxLength={60}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-mood" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Mood
                  </label>
                  <select
                    id="edit-song-mood"
                    value={CANONICAL_MOODS.includes(editMood as (typeof CANONICAL_MOODS)[number]) ? editMood : 'Custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'Custom') setEditMood(e.target.value);
                    }}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  >
                    {CANONICAL_MOODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {!CANONICAL_MOODS.includes(editMood as (typeof CANONICAL_MOODS)[number]) && (
                      <option value="Custom">{editMood}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-song-bpm" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    BPM
                  </label>
                  <input
                    id="edit-song-bpm"
                    type="number"
                    min={40}
                    max={240}
                    value={editBpm}
                    onChange={(e) => setEditBpm(parseInt(e.target.value, 10) || 120)}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-key" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Musical Key
                  </label>
                  <input
                    id="edit-song-key"
                    type="text"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    maxLength={30}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-vocals" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Vocal Style
                  </label>
                  <input
                    id="edit-song-vocals"
                    type="text"
                    value={editVocalType}
                    onChange={(e) => setEditVocalType(e.target.value)}
                    maxLength={80}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-ai-tool" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    AI Tool Origin
                  </label>
                  <input
                    id="edit-song-ai-tool"
                    type="text"
                    value={editAiToolOrigin}
                    onChange={(e) => setEditAiToolOrigin(e.target.value)}
                    maxLength={60}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-song-license" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    License Terms
                  </label>
                  <select
                    id="edit-song-license"
                    value={editLicense}
                    onChange={(e) => setEditLicense(e.target.value as HavenLicense)}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  >
                    <option value="Commercial Permitted">Commercial Permitted</option>
                    <option value="Attribution Required">Attribution Required</option>
                    <option value="Free Personal">Free Personal</option>
                    <option value="All Rights Reserved">All Rights Reserved</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-song-cover" className="text-[11px] font-mono-tech text-[#958ea0] uppercase">
                    Cover Artwork URL
                  </label>
                  <input
                    id="edit-song-cover"
                    type="text"
                    value={editCoverArt}
                    onChange={(e) => setEditCoverArt(e.target.value)}
                    maxLength={500}
                    className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono-tech text-[#958ea0] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.45)] transition-all disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Top Hero Section: Artwork + Core Meta + Play Button */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-2xl group">
              <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
              <button
                onClick={onTogglePlay}
                className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity"
                aria-label={isPlaying ? 'Pause Song' : 'Play Song'}
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-white" />
                  ) : (
                    <Play className="w-6 h-6 fill-white ml-1" />
                  )}
                </div>
              </button>
            </div>

            <div className="flex-1 space-y-3 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#06B6D4] border border-[#8B5CF6]/30">
                  {track.genre}
                </span>
                <span className="text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded-full bg-white/5 text-[#958ea0]">
                  {track.aiToolOrigin}
                </span>
                <span className="text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  {track.license}
                </span>
              </div>

              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
                {track.title}
              </h2>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-[#958ea0]">
                <span className="text-white font-medium">{track.creator}</span>
                <span>·</span>
                <span className="font-mono-tech text-[#06B6D4]">{track.creatorHandle}</span>
                <span>·</span>
                <span className="font-mono-tech">{formatTime(track.duration)}</span>
              </div>

              <p className="text-xs sm:text-sm text-[#cbc3d7] leading-relaxed">
                {track.description}
              </p>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                <button
                  onClick={onTogglePlay}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-all"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-white" />
                      <span>Pause Track</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                      <span>Play Track</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onLikeTrack(track.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-mono-tech transition-colors ${
                    track.isLiked
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#8B5CF6]'
                      : 'bg-[#161622] border-white/10 text-white hover:bg-white/5'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${track.isLiked ? 'fill-current' : ''}`} />
                  <span>{track.likes}</span>
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#161622] border border-white/10 text-xs font-mono-tech text-[#e4e1e8] hover:text-white hover:border-[#8B5CF6]/40 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 text-[#8B5CF6]" />
                    <span>{permissionRole === 'admin' ? 'Admin Edit Song' : 'Edit Song'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleCopyShare()}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-mono-tech transition-colors ${
                    copiedLink
                      ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                      : 'bg-[#161622] border-white/10 text-[#e4e1e8] hover:text-white hover:border-[#06B6D4]/40'
                  }`}
                >
                  {copiedLink ? <Check className="w-4 h-4 text-[#10B981]" /> : <Share2 className="w-4 h-4 text-[#06B6D4]" />}
                  <span>{copiedLink ? 'Link Copied' : 'Share'}</span>
                </button>
              </div>

              {/* Social Sharing Row (Twitter, Reddit, Discord using exact same unique share link) */}
              <div
                data-testid="social-sharing-row"
                className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2 border-t border-white/5"
              >
                <span className="text-[10px] font-mono-tech uppercase tracking-wider text-[#958ea0] mr-1">
                  Share On:
                </span>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-twitter-btn"
                  aria-label="Share on Twitter"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161622] hover:bg-[#1DA1F2]/15 border border-white/10 hover:border-[#1DA1F2]/40 text-xs font-mono-tech text-[#e4e1e8] hover:text-white transition-colors"
                >
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#1DA1F2]/20 text-[#38BDF8] flex items-center justify-center text-[10px] font-bold">
                    X
                  </span>
                  <span>Twitter</span>
                </a>
                <a
                  href={redditShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-reddit-btn"
                  aria-label="Share on Reddit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161622] hover:bg-[#FF4500]/15 border border-white/10 hover:border-[#FF4500]/40 text-xs font-mono-tech text-[#e4e1e8] hover:text-white transition-colors"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-[#FF4500]/20 text-[#FB923C] flex items-center justify-center text-[10px] font-bold">
                    r/
                  </span>
                  <span>Reddit</span>
                </a>
                <button
                  type="button"
                  onClick={() => void handleCopyDiscordShare()}
                  data-testid="share-discord-btn"
                  aria-label="Copy Discord share link"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono-tech transition-colors ${
                    copiedDiscord
                      ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#10B981]'
                      : 'bg-[#161622] hover:bg-[#5865F2]/20 border-white/10 hover:border-[#5865F2]/50 text-[#e4e1e8] hover:text-white'
                  }`}
                >
                  {copiedDiscord ? (
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-[#818CF8]" />
                  )}
                  <span>{copiedDiscord ? 'Copied for Discord' : 'Discord'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Waveform Music Visualizer & Tiny Beat Dancer */}
          <WaveformBeatDancer
            track={track}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            variant="full"
            onSeek={onSeek}
          />

          {/* Story Behind the Song Dossier Card */}
          {(track.story || canEdit) && (
            <div className="p-5 rounded-2xl bg-[#161622]/70 border border-[#8B5CF6]/25 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-semibold text-xs sm:text-sm text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#06B6D4]" />
                  <span>Story Behind the Song</span>
                </span>
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="text-[11px] font-mono-tech text-[#acedff] hover:text-white flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-[#06B6D4]" />
                    <span>{track.story ? 'Edit / Regenerate Story' : 'Add or Auto-Generate Story'}</span>
                  </button>
                )}
              </div>
              {track.story ? (
                <p className="text-xs sm:text-sm text-[#dcd6e8] leading-relaxed italic">
                  &ldquo;{track.story}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-[#958ea0]">
                  No story added yet. You can write one or generate it automatically from description &amp; lyrics with AI Music Haven&apos;s Song Story Generator.
                </p>
              )}
            </div>
          )}

          {/* Captioned Lyrics & Closed-Caption Cue Viewer */}
          <div className="p-5 rounded-2xl bg-[#161622]/70 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display font-semibold text-xs sm:text-sm text-white flex items-center gap-2">
                <Captions className="w-4 h-4 text-[#06B6D4]" />
                <span>Lyrics &amp; Captions</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {!isEditing && (
                  <CaptionLyricsButton
                    audioUrl={track.audioUrl}
                    title={track.title}
                    creator={track.creator}
                    description={track.description}
                    quotaContext={fallbackQuotaContext}
                    onQuotaUpdate={onAiQuotaUpdate}
                    compact
                    label={effectiveLyrics ? 'Re-Caption from Audio' : 'Auto-Caption Lyrics'}
                    onCaptioned={(captions) => void handleQuickCaptionSave(captions)}
                  />
                )}
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="text-[11px] font-mono-tech text-[#958ea0] hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    {effectiveLyrics ? 'Edit Manually' : 'Add Manually'}
                  </button>
                )}
              </div>
            </div>

              {activeCaption && (
                <div
                  data-testid="active-lyric-caption"
                  className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6]/15 to-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center gap-2.5 text-xs"
                >
                  <span className="px-2 py-0.5 rounded bg-[#08080C] font-mono-tech text-[10px] text-[#06B6D4] shrink-0">
                    {activeCaption.timestampLabel || (isPlaying ? 'CC LIVE' : 'CC')}
                  </span>
                  <span className="text-white font-medium">{activeCaption.text}</span>
                </div>
              )}

              {captionCues.length > 0 ? (
                <div className="max-h-56 overflow-y-auto bg-[#08080C]/70 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                  {captionCues.map((cue) => {
                    const isActive = activeCaption?.id === cue.id && isPlaying;
                    return (
                      <div
                        key={cue.id}
                        className={`flex items-start gap-2.5 text-xs leading-relaxed px-2 py-1 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-[#06B6D4]/15 text-white font-medium'
                            : 'text-[#cbc3d7]'
                        }`}
                      >
                        {cue.timestampLabel && (
                          <span className="font-mono-tech text-[10px] text-[#06B6D4] pt-0.5 shrink-0">
                            [{cue.timestampLabel}]
                          </span>
                        )}
                        <span>{cue.text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#958ea0]">
                  No lyric captions yet. Click <strong>Auto-Caption Lyrics</strong> to extract timed closed-caption lyrics directly from this song&apos;s audio track.
                </p>
              )}
          </div>

          {/* Non-Destructive AI Acoustic Fingerprint Grid */}
          <div className="p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
              <span className="font-display font-semibold text-xs sm:text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#06B6D4]" />
                <span>AI Acoustic Analysis Profile</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-tech">
                {typeof track.pitchSemitones === 'number' && track.pitchSemitones !== 0 && (
                  <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 text-[#acedff] border border-[#8B5CF6]/30">
                    Survival Pitch Variant ({track.pitchSemitones > 0 ? `+${track.pitchSemitones}` : track.pitchSemitones} st)
                  </span>
                )}
                <span className="text-[#10B981]">
                  Loudness Norm: {track.lufs} LUFS → {TARGET_PLAYBACK_LUFS} LUFS (
                  {(() => {
                    const db = calculateLoudnessNormalizationDb(track.lufs);
                    return `${db > 0 ? `+${db}` : db} dB`;
                  })()})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-tech">
              <div className="p-3 rounded-xl bg-[#08080C] border border-white/5 space-y-0.5">
                <span className="text-[10px] text-[#958ea0] uppercase">Tempo / BPM</span>
                <span className="text-white font-bold block">{track.bpm} BPM</span>
              </div>
              <div className="p-3 rounded-xl bg-[#08080C] border border-white/5 space-y-0.5">
                <span className="text-[10px] text-[#958ea0] uppercase">Harmonic Key</span>
                <span className="text-[#8B5CF6] font-bold block">{track.key}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#08080C] border border-white/5 space-y-0.5">
                <span className="text-[10px] text-[#958ea0] uppercase">Vocal Formant</span>
                <span className="text-[#06B6D4] font-bold block truncate">{track.vocalType}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#08080C] border border-white/5 space-y-0.5">
                <span className="text-[10px] text-[#958ea0] uppercase">Energy Level</span>
                <span className="text-[#10B981] font-bold block">{track.energyLevel}</span>
              </div>
            </div>

            {/* Identified Instruments */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                Cataloged Instrumentation:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {track.instruments.map((inst) => (
                  <span
                    key={inst}
                    className="text-[11px] font-mono-tech px-2.5 py-1 rounded-full bg-[#08080C] text-[#cbc3d7] border border-white/5"
                  >
                    {inst}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Download & Licensing Center */}
          <div className="p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-xs sm:text-sm text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-[#F59E0B]" />
                <span>Audio Downloads & Terms</span>
              </span>
              <span className="text-[10px] font-mono-tech text-[#10B981]">
                License: {track.license}
              </span>
            </div>

            <p className="text-xs text-[#958ea0]">
              This track is distributed under <strong>{track.license}</strong> terms. You can stream and download original preserved audio files.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => handleDownloadFile(track.fileFormat || 'MP3 (320kbps)')}
                className="p-3 rounded-xl bg-[#08080C] hover:bg-[#161622] border border-white/10 text-left transition-colors group"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-white group-hover:text-[#06B6D4]">MP3 (320kbps)</span>
                  <span className="text-[10px] font-mono-tech text-[#958ea0]">{track.fileSize}</span>
                </div>
                <span className="text-[10px] text-[#958ea0] block mt-0.5">Universal Playback</span>
              </button>

              <button
                onClick={() => handleDownloadFile('WAV (24-bit / 96kHz)')}
                className="p-3 rounded-xl bg-[#08080C] hover:bg-[#161622] border border-white/10 text-left transition-colors group"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-white group-hover:text-[#8B5CF6]">WAV Master</span>
                  <span className="text-[10px] font-mono-tech text-[#8B5CF6]">HQ</span>
                </div>
                <span className="text-[10px] text-[#958ea0] block mt-0.5">{track.sampleRate}</span>
              </button>

              <button
                onClick={() => handleDownloadFile('FLAC (24-bit Lossless)')}
                className="p-3 rounded-xl bg-[#08080C] hover:bg-[#161622] border border-white/10 text-left transition-colors group"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-white group-hover:text-[#10B981]">FLAC Lossless</span>
                  <span className="text-[10px] font-mono-tech text-[#10B981]">HQ</span>
                </div>
                <span className="text-[10px] text-[#958ea0] block mt-0.5">Archival Compression</span>
              </button>
            </div>
          </div>

          {/* Comments & Listener Reviews */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-base text-white flex items-center justify-between">
              <span>Listener Reviews ({track.comments.length})</span>
              <span className="text-xs font-mono-tech text-[#F59E0B] flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{track.rating} / 5.0</span>
              </span>
            </h3>

            {/* Post Review Form */}
            <form onSubmit={handleCommentSubmit} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#958ea0]">Rate this song:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserRating(star)}
                      className="text-sm p-0.5"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= userRating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Leave a review or feedback for the creator..."
                  className="w-full bg-[#161622] text-xs text-white p-3 rounded-xl border border-white/10 focus:outline-none focus:border-[#06B6D4]"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold disabled:opacity-40 shrink-0"
                >
                  Submit
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3 pt-2">
              {track.comments.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl bg-[#161622]/60 border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={c.userAvatar} alt={c.userName} className="w-6 h-6 rounded-full object-cover" />
                      <span className="text-xs font-medium text-white">{c.userName}</span>
                      <span className="text-[10px] font-mono-tech text-[#958ea0]">{c.timestamp}</span>
                    </div>
                    {c.rating && (
                      <div className="flex items-center gap-0.5 text-[#F59E0B] text-xs">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{c.rating}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#cbc3d7]">{c.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Related Tracks */}
          {relatedTracks.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/5">
              <h3 className="font-display font-semibold text-sm text-white">
                Related {track.genre} Tracks
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedTracks.slice(0, 2).map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectTrack(rel)}
                    className="p-3 rounded-xl bg-[#161622]/50 hover:bg-[#161622] border border-white/5 cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={rel.coverArt} alt={rel.title} className="w-10 h-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-white truncate block group-hover:text-[#06B6D4]">
                          {rel.title}
                        </span>
                        <span className="text-[10px] text-[#958ea0]">{rel.creator}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#958ea0] group-hover:text-white" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
