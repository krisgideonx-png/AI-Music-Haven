import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  UploadCloud,
  Trash2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Plus,
} from 'lucide-react';
import type { AudioTrack, BatchUploadItem, HavenLicense } from '../types/index.ts';
import { CANONICAL_GENRES, CANONICAL_MOODS } from '../utils/trackCategorizer.ts';
import { MicTranscribeButton, type AiQuotaRequestContext } from './MicTranscribeButton.tsx';
import { CaptionLyricsButton } from './CaptionLyricsButton.tsx';
import { UserAiCapBadge } from './UserAiCapBadge.tsx';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface BatchUploadQueueProps {
  items: BatchUploadItem[];
  rejectedFiles: Array<{ fileName: string; reason: string }>;
  batchAiError?: string | null;
  aiQuota: UserAiQuotaState;
  aiQuotaRequestContext: AiQuotaRequestContext;
  onAiQuotaUpdate: (quota: UserAiQuotaState) => void;
  autoGenerateCoverOnBatch: boolean;
  onToggleAutoGenerateCover: (enabled: boolean) => void;
  onAddMoreFiles: () => void;
  onUpdateItemDraft: (id: string, updater: (prev: BatchUploadItem['draft']) => BatchUploadItem['draft']) => void;
  onGenerateCover: (id: string) => Promise<void>;
  onGenerateAllCovers: () => Promise<void>;
  onGenerateStory: (id: string) => Promise<void>;
  onRetryCategorize: (id: string) => Promise<void>;
  onConfirmCategory: (id: string) => void;
  onConfirmAllReady: () => void;
  onPublishItem: (id: string) => Promise<void>;
  onPublishAllConfirmed: () => Promise<void>;
  onRemoveItem: (id: string) => void;
  onClearBatch: () => void;
  onGoToTrackId: (trackId: string) => void;
  isBatchPublishing: boolean;
  isBatchGeneratingCovers: boolean;
}

export const BatchUploadQueue: React.FC<BatchUploadQueueProps> = ({
  items,
  rejectedFiles,
  batchAiError,
  aiQuota,
  aiQuotaRequestContext,
  onAiQuotaUpdate,
  autoGenerateCoverOnBatch,
  onToggleAutoGenerateCover,
  onAddMoreFiles,
  onUpdateItemDraft,
  onGenerateCover,
  onGenerateAllCovers,
  onGenerateStory,
  onRetryCategorize,
  onConfirmCategory,
  onConfirmAllReady,
  onPublishItem,
  onPublishAllConfirmed,
  onRemoveItem,
  onClearBatch,
  onGoToTrackId,
  isBatchPublishing,
  isBatchGeneratingCovers,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id || null);

  const totalCount = items.length;
  const categorizedCount = items.filter((i) => i.draft.analysisComplete).length;
  const readyCount = items.filter((i) => i.status === 'ready').length;
  const confirmedCount = items.filter((i) => i.status === 'confirmed').length;
  const publishedCount = items.filter((i) => i.status === 'published').length;
  const ungeneratedCoverCount = items.filter((i) => i.status !== 'published' && !i.coverGenerated).length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Batch Control Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#161622]/80 border border-[#8B5CF6]/30 backdrop-blur-xl space-y-4 shadow-[0_0_32px_rgba(139,92,246,0.12)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono-tech text-[#06B6D4]">
              <Layers className="w-4 h-4" />
              <span>Batch Processing Queue · AI Metadata &amp; Cover Automation</span>
            </div>
            <h2 className="font-display font-bold text-xl text-white">
              {totalCount} {totalCount === 1 ? 'Song' : 'Songs'} in Batch Queue
            </h2>
            <p className="text-xs text-[#958ea0]">
              {categorizedCount}/{totalCount} AI-categorized · {confirmedCount} confirmed · {publishedCount} published
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAddMoreFiles}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Add Files</span>
            </button>
            <button
              type="button"
              onClick={onClearBatch}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-xs font-mono-tech text-[#958ea0] hover:text-red-200 transition-colors"
            >
              <span>Exit Batch</span>
            </button>
          </div>
        </div>

        {/* Per-User AI Cap & Batch AI Notice */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <UserAiCapBadge quota={aiQuota} compact />
        </div>

        {batchAiError && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{batchAiError}</span>
          </div>
        )}

        {/* Rejected Files Alert */}
        {rejectedFiles.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Skipped {rejectedFiles.length} unsupported item(s):</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] text-amber-200/80">
              {rejectedFiles.map((r, idx) => (
                <li key={`${r.fileName}-${idx}`}>
                  {r.fileName}: {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Batch Global Action Bar */}
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-[#cbc3d7] cursor-pointer">
            <input
              type="checkbox"
              checked={autoGenerateCoverOnBatch}
              onChange={(e) => onToggleAutoGenerateCover(e.target.checked)}
              className="accent-[#06B6D4] w-4 h-4"
            />
            <span>Auto-generate cover artwork for new batch drops</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {ungeneratedCoverCount > 0 && (
              <button
                type="button"
                disabled={isBatchGeneratingCovers}
                onClick={() => void onGenerateAllCovers()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/40 text-xs font-mono-tech text-[#acedff] transition-colors disabled:opacity-60"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>
                  {isBatchGeneratingCovers
                    ? 'Generating Covers...'
                    : `Auto-Generate Covers (${ungeneratedCoverCount})`}
                </span>
              </button>
            )}

            {readyCount > 0 && (
              <button
                type="button"
                onClick={onConfirmAllReady}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/40 text-xs font-semibold text-[#10B981] transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm All Categories ({readyCount})</span>
              </button>
            )}

            <button
              type="button"
              disabled={confirmedCount === 0 || isBatchPublishing}
              onClick={() => void onPublishAllConfirmed()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.45)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>
                {isBatchPublishing
                  ? 'Publishing Batch...'
                  : `Publish All Confirmed (${confirmedCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Individual Batch Track Cards */}
      <div className="space-y-3">
        {items.map((item, idx) => {
          const isExpanded = expandedId === item.id;
          const d = item.draft;
          return (
            <div
              key={item.id}
              data-testid={`batch-item-${idx}`}
              className={`rounded-2xl border backdrop-blur-xl transition-all overflow-hidden ${
                item.status === 'published'
                  ? 'bg-[#10B981]/5 border-[#10B981]/35'
                  : item.status === 'confirmed'
                  ? 'bg-[#161622]/85 border-[#06B6D4]/40'
                  : 'bg-[#161622]/70 border-white/10'
              }`}
            >
              {/* Summary Row */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-[#08080C]">
                    <img
                      src={d.coverArt}
                      alt={d.title}
                      className="w-full h-full object-cover"
                    />
                    {item.isGeneratingCover && (
                      <div className="absolute inset-0 bg-[#08080C]/75 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-[#06B6D4] animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-sm text-white truncate">
                        {d.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono-tech px-2 py-0.5 rounded-full border ${
                          item.status === 'published'
                            ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                            : item.status === 'confirmed'
                            ? 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/40'
                            : item.status === 'categorizing' || item.status === 'queued'
                            ? 'bg-[#8B5CF6]/20 text-[#acedff] border-[#8B5CF6]/40'
                            : item.status === 'error'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-amber-500/15 text-amber-200 border-amber-500/35'
                        }`}
                      >
                        {item.status === 'queued' && 'Queued'}
                        {item.status === 'categorizing' && 'AI Metadata Generating...'}
                        {item.status === 'ready' && 'AI Ready · Needs Confirm'}
                        {item.status === 'confirmed' && 'Confirmed · Ready to Publish'}
                        {item.status === 'publishing' && 'Publishing...'}
                        {item.status === 'published' && 'Published to Haven'}
                        {item.status === 'error' && 'Needs Attention'}
                      </span>
                      {item.coverGenerated && (
                        <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#acedff] border border-[#8B5CF6]/30">
                          Auto Cover
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono-tech text-[#958ea0] mt-0.5 truncate">
                      {d.fileName} · {(d.fileSize / (1024 * 1024)).toFixed(1)} MB ·{' '}
                      <span className="text-[#06B6D4]">
                        {d.genre} / {d.subgenre}
                      </span>{' '}
                      · {d.mood} · {d.bpm} BPM
                    </div>

                    {item.errorMessage && (
                      <p className="text-[11px] text-red-300 mt-1">{item.errorMessage}</p>
                    )}
                  </div>
                </div>

                {/* Per-item Quick Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.status !== 'published' && (
                    <button
                      type="button"
                      disabled={item.isGeneratingCover}
                      onClick={() => void onGenerateCover(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-[#8B5CF6]/20 border border-white/10 text-[11px] font-mono-tech text-[#e4e1e8] transition-colors disabled:opacity-60"
                      title="Auto-Generate Cover Artwork"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>{item.coverGenerated ? 'Regen Cover' : 'Auto Cover'}</span>
                    </button>
                  )}

                  {item.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => onConfirmCategory(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-semibold transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm</span>
                    </button>
                  )}

                  {item.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => void onPublishItem(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-[11px] font-semibold transition-all"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Publish</span>
                    </button>
                  )}

                  {item.status === 'published' && item.publishedTrackId && (
                    <button
                      type="button"
                      onClick={() => onGoToTrackId(item.publishedTrackId!)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/40 text-[#10B981] text-[11px] font-mono-tech transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Song</span>
                    </button>
                  )}

                  {item.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono-tech text-[#958ea0] hover:text-white transition-colors"
                      aria-label={isExpanded ? `Collapse ${d.title}` : `Edit metadata for ${d.title}`}
                    >
                      <span>{isExpanded ? 'Hide' : 'Edit'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 rounded-lg text-[#958ea0] hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    aria-label={`Remove ${d.title} from batch`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded Per-Song Metadata & Story Editor */}
              {isExpanded && item.status !== 'published' && (
                <div className="px-4 pb-5 pt-3 border-t border-white/5 bg-[#08080C]/55 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Song Title *</label>
                      <input
                        type="text"
                        value={d.title}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, title: e.target.value }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Creator Name</label>
                      <input
                        type="text"
                        value={d.creator}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, creator: e.target.value }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">AI Tool Origin</label>
                      <select
                        value={d.aiToolOrigin}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, aiToolOrigin: e.target.value }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      >
                        <option value="Suno v3.5">Suno v3.5</option>
                        <option value="Udio v1.5">Udio v1.5</option>
                        <option value="Stable Audio 2.0">Stable Audio 2.0</option>
                        <option value="MusicLM">Google MusicLM</option>
                        <option value="ElevenLabs Music">ElevenLabs Music</option>
                        <option value="Custom / Fine-Tuned">Custom / Fine-Tuned</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Genre</label>
                      <select
                        value={CANONICAL_GENRES.includes(d.genre as (typeof CANONICAL_GENRES)[number]) ? d.genre : 'Custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'Custom') {
                            onUpdateItemDraft(item.id, (prev) => ({ ...prev, genre: e.target.value }));
                          }
                        }}
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      >
                        {CANONICAL_GENRES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                        {!CANONICAL_GENRES.includes(d.genre as (typeof CANONICAL_GENRES)[number]) && (
                          <option value="Custom">{d.genre}</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Subgenre</label>
                      <input
                        type="text"
                        value={d.subgenre}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, subgenre: e.target.value }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Mood</label>
                      <select
                        value={CANONICAL_MOODS.includes(d.mood as (typeof CANONICAL_MOODS)[number]) ? d.mood : 'Custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'Custom') {
                            onUpdateItemDraft(item.id, (prev) => ({ ...prev, mood: e.target.value }));
                          }
                        }}
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      >
                        {CANONICAL_MOODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        {!CANONICAL_MOODS.includes(d.mood as (typeof CANONICAL_MOODS)[number]) && (
                          <option value="Custom">{d.mood}</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">License</label>
                      <select
                        value={d.license}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({
                            ...prev,
                            license: e.target.value as HavenLicense,
                          }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      >
                        <option value="Commercial Permitted">Commercial Permitted</option>
                        <option value="Attribution Required">Attribution Required</option>
                        <option value="Free Personal">Free Personal</option>
                        <option value="All Rights Reserved">All Rights Reserved</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">BPM</label>
                      <input
                        type="number"
                        value={d.bpm}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({
                            ...prev,
                            bpm: parseInt(e.target.value, 10) || 120,
                          }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Musical Key</label>
                      <input
                        type="text"
                        value={d.key}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, key: e.target.value }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono-tech text-[#958ea0]">Cover Artwork URL</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={d.coverArt}
                          onChange={(e) =>
                            onUpdateItemDraft(item.id, (prev) => ({ ...prev, coverArt: e.target.value }))
                          }
                          className="flex-1 bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10 min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => void onGenerateCover(item.id)}
                          className="px-2.5 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/40 text-[10px] font-mono-tech text-[#acedff] shrink-0"
                        >
                          Auto
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[10px] font-mono-tech text-[#958ea0]">Description</label>
                        <MicTranscribeButton
                          targetField="description"
                          quotaContext={aiQuotaRequestContext}
                          onQuotaUpdate={onAiQuotaUpdate}
                          compact
                          label="Mic"
                          onTranscribed={(text) =>
                            onUpdateItemDraft(item.id, (prev) => ({
                              ...prev,
                              description: prev.description.trim()
                                ? `${prev.description.trim()} ${text}`
                                : text,
                            }))
                          }
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={d.description}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <label className="text-[10px] font-mono-tech text-[#958ea0]">Lyric Captions</label>
                        <CaptionLyricsButton
                          audioUrl={d.audioUrl}
                          title={d.title}
                          creator={d.creator}
                          description={d.description}
                          quotaContext={aiQuotaRequestContext}
                          onQuotaUpdate={onAiQuotaUpdate}
                          compact
                          label="Caption"
                          onCaptioned={(captions) =>
                            onUpdateItemDraft(item.id, (prev) => ({
                              ...prev,
                              lyrics: captions,
                            }))
                          }
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={d.lyrics || ''}
                        maxLength={4000}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, lyrics: e.target.value }))
                        }
                        placeholder="Auto-caption or paste lyrics (used by Story Generator)..."
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono-tech text-[#958ea0] flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-[#06B6D4]" />
                          <span>Story Behind the Song</span>
                        </label>
                        <button
                          type="button"
                          disabled={item.isGeneratingStory}
                          onClick={() => void onGenerateStory(item.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-mono-tech text-[#06B6D4] hover:underline disabled:opacity-60"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{item.isGeneratingStory ? 'Writing...' : 'Auto Story'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={d.story || ''}
                        maxLength={1500}
                        onChange={(e) =>
                          onUpdateItemDraft(item.id, (prev) => ({ ...prev, story: e.target.value }))
                        }
                        placeholder="Generated from description & lyrics..."
                        className="w-full bg-[#161622] text-xs text-white p-2.5 rounded-xl border border-white/10"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => void onRetryCategorize(item.id)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono-tech text-[#958ea0] hover:text-white"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-run AI Metadata</span>
                    </button>
                    {d.aiReasoning && (
                      <span className="text-[11px] text-[#958ea0] truncate max-w-md">
                        AI note: {d.aiReasoning}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
