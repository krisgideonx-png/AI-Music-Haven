import React, { useState } from 'react';
import { 
  Sparkles, 
  Search, 
  Play, 
  Pause, 
  ArrowRight, 
  ShieldCheck, 
  Sliders, 
  Heart, 
  Download, 
  MessageSquare, 
  Info,
  CheckCircle2
} from 'lucide-react';
import type { AudioTrack } from '../types/index.ts';
import { MicTranscribeButton, type AiQuotaRequestContext } from './MicTranscribeButton.tsx';
import { UserAiCapBadge } from './UserAiCapBadge.tsx';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface AIDiscoveryViewProps {
  tracks: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onSelectTrack: (track: AudioTrack) => void;
  onTogglePlay: () => void;
  onOpenTrackDetails: (track: AudioTrack) => void;
  onLikeTrack: (trackId: string) => void;
  aiQuota?: UserAiQuotaState;
  aiQuotaRequestContext?: AiQuotaRequestContext;
  onAiQuotaUpdate?: (quota: UserAiQuotaState) => void;
}

export const AIDiscoveryView: React.FC<AIDiscoveryViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onOpenTrackDetails,
  onLikeTrack,
  aiQuota,
  aiQuotaRequestContext,
  onAiQuotaUpdate,
}) => {
  const [naturalQuery, setNaturalQuery] = useState('');
  const [matchedTracks, setMatchedTracks] = useState<AudioTrack[]>(tracks.slice(0, 4));
  const [isSearching, setIsSearching] = useState(false);
  const [searchExplanation, setSearchExplanation] = useState<string | null>(
    'Showing recommended high-fidelity AI compositions based on global library trends.'
  );

  const samplePrompts = [
    'Find emotional Afrobeat songs with deep male vocals',
    'Atmospheric cyberpunk ambient with vocoder harmonics and slow tempo',
    'Peaceful neo-classical strings with grand piano and wordless soprano choir',
    'High-energy 170+ BPM neurofunk with heavy reese bass and punchy breaks',
    'Rainy lo-fi beats with mellow Rhodes piano and saxophone',
    'Raw Berlin modular techno with industrial kicks and 303 acid sequences',
  ];

  const handleSearch = (queryText: string) => {
    const q = queryText.toLowerCase().trim();
    if (!q) {
      setMatchedTracks(tracks);
      setSearchExplanation('Showing all available tracks in library.');
      return;
    }

    setIsSearching(true);
    setSearchExplanation('Analyzing library metadata and matching acoustic attributes...');

    setTimeout(() => {
      // Non-destructive search matching through acoustic attributes
      const scored = tracks.map((track) => {
        let score = 0;
        const haystack = `${track.title} ${track.genre} ${track.subgenre} ${track.mood} ${track.description} ${track.lyrics || ''} ${track.vocalType} ${track.instruments.join(' ')} ${track.musicalStyle} ${track.aiToolOrigin} ${track.language}`.toLowerCase();

        const words = q.split(/\s+/).filter((w) => w.length > 2);
        words.forEach((word) => {
          if (haystack.includes(word)) score += 2;
        });

        // Specific keyword boosts
        if (q.includes('afrobeat') && track.genre.toLowerCase().includes('afrobeat')) score += 10;
        if (q.includes('cyberpunk') && track.genre.toLowerCase().includes('cyberpunk')) score += 10;
        if (q.includes('ambient') && (track.genre.toLowerCase().includes('ambient') || track.mood.toLowerCase().includes('atmospheric'))) score += 6;
        if (q.includes('classical') && track.genre.toLowerCase().includes('classical')) score += 10;
        if (q.includes('lo-fi') && track.genre.toLowerCase().includes('lo-fi')) score += 10;
        if (q.includes('techno') && track.genre.toLowerCase().includes('techno')) score += 10;
        if (q.includes('male') && track.vocalType.toLowerCase().includes('male')) score += 8;
        if (q.includes('soprano') && track.vocalType.toLowerCase().includes('soprano')) score += 8;
        if (q.includes('high-energy') && (track.energyLevel === 'High' || track.energyLevel === 'Explosive')) score += 6;

        return { track, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const bestMatches = scored.filter((s) => s.score > 0).map((s) => s.track);

      setMatchedTracks(bestMatches.length > 0 ? bestMatches : tracks.slice(0, 3));
      setIsSearching(false);
      setSearchExplanation(
        bestMatches.length > 0
          ? `Found ${bestMatches.length} matching songs in the archive for "${queryText}". Ranked by acoustic resonance and metadata alignment.`
          : `No exact acoustic matches found for "${queryText}". Showing closest atmospheric selections from the library.`
      );
    }, 450);
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-xs font-mono-tech text-[#06B6D4]">
          <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Intelligent Natural Language Catalog Search</span>
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
          AI Music Discovery
        </h1>
        <p className="text-xs sm:text-base text-[#958ea0] max-w-2xl">
          Describe the musical qualities, acoustic instruments, mood, or vocal characteristics you want to hear. Our non-destructive assistant navigates the global archive to find existing songs that match.
        </p>
      </div>

      {/* Strict Guardrail Compliance Banner + User AI Cap */}
      <div className="p-3.5 rounded-2xl bg-[#161622]/80 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#cbc3d7]">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>
            <strong className="text-white">Strict Discovery Mode:</strong> AI Music Haven does not generate or synthesize audio. Requests are interpreted solely as catalog queries across already existing, completed songs.
          </span>
        </div>
        {aiQuota && <UserAiCapBadge quota={aiQuota} compact />}
      </div>

      {/* Natural Language Query Input */}
      <div className="relative">
        <div className="p-2 sm:p-3 rounded-2xl bg-[#161622] border border-white/10 shadow-2xl focus-within:border-[#06B6D4]/60 transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 px-2">
            <Sparkles className="w-5 h-5 text-[#06B6D4] shrink-0" />
            <input
              type="text"
              value={naturalQuery}
              onChange={(e) => setNaturalQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(naturalQuery)}
              placeholder="e.g. Find emotional Afrobeat songs with deep male vocals..."
              className="w-full bg-transparent text-sm text-white placeholder-[#958ea0] focus:outline-none py-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            {aiQuotaRequestContext && (
              <MicTranscribeButton
                targetField="search"
                quotaContext={aiQuotaRequestContext}
                onQuotaUpdate={onAiQuotaUpdate}
                label="Voice Query"
                onTranscribed={(text) => {
                  setNaturalQuery(text);
                  handleSearch(text);
                }}
              />
            )}

            <button
              onClick={() => handleSearch(naturalQuery)}
              disabled={isSearching}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Searching Archive...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Haven</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset Prompt Suggestions */}
        <div className="pt-3 space-y-1.5">
          <span className="text-[10px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
            Try asking the AI Assistant:
          </span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setNaturalQuery(prompt);
                  handleSearch(prompt);
                }}
                className="text-[11px] font-sans px-3 py-1.5 rounded-xl bg-[#161622]/80 hover:bg-[#161622] border border-white/5 hover:border-white/20 text-[#cbc3d7] hover:text-white transition-all text-left"
              >
                &quot;{prompt}&quot;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Analysis Output Feedback */}
      {searchExplanation && (
        <div className="p-4 rounded-xl bg-[#08080C] border border-[#06B6D4]/30 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#06B6D4] shrink-0 mt-0.5" />
          <p className="text-xs font-mono-tech text-[#06B6D4] leading-relaxed">
            {searchExplanation}
          </p>
        </div>
      )}

      {/* Discovered Track Results */}
      <div className="space-y-4">
        <h2 className="font-display font-semibold text-lg text-white flex items-center justify-between">
          <span>Identified Matching Compositions ({matchedTracks.length})</span>
          <span className="text-xs font-mono-tech text-[#958ea0]">Sorted by Acoustic Relevance</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matchedTracks.map((track) => {
            const isThisPlaying = isPlaying && currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  currentTrack?.id === track.id
                    ? 'bg-[#161622] border-[#06B6D4]/50 shadow-[0_0_16px_rgba(6,182,212,0.15)]'
                    : 'bg-[#161622]/60 hover:bg-[#161622] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 group">
                    <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        if (currentTrack?.id === track.id) {
                          onTogglePlay();
                        } else {
                          onSelectTrack(track);
                        }
                      }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white flex items-center justify-center">
                        {isThisPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-white" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 
                      onClick={() => onOpenTrackDetails(track)}
                      className="font-display font-semibold text-sm text-white truncate cursor-pointer hover:text-[#06B6D4] transition-colors"
                    >
                      {track.title}
                    </h3>
                    <span className="text-xs text-[#958ea0] block truncate">
                      by {track.creator} · <span className="font-mono-tech text-[#06B6D4]">{track.aiToolOrigin}</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-white/5 text-white">
                        {track.genre}
                      </span>
                      <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-white/5 text-[#8B5CF6]">
                        {track.vocalType}
                      </span>
                      <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">
                        {track.license}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acoustic Description Match Highlight */}
                <p className="text-xs text-[#cbc3d7] bg-[#08080C]/80 p-2.5 rounded-xl border border-white/5 line-clamp-2">
                  &quot;{track.description}&quot;
                </p>

                {/* Instruments Identified by Non-Destructive AI */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                    AI-Identified Instrumentation:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {track.instruments.map((inst) => (
                      <span key={inst} className="text-[9px] font-mono-tech px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/10 text-[#cbc3d7]">
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLikeTrack(track.id)}
                      className={`p-1.5 rounded-lg border text-xs transition-colors ${
                        track.isLiked
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#8B5CF6]'
                          : 'bg-[#08080C] border-white/10 text-[#958ea0] hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${track.isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => onOpenTrackDetails(track)}
                      className="p-1.5 rounded-lg bg-[#08080C] border border-white/10 text-[#958ea0] hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => onOpenTrackDetails(track)}
                    className="text-xs font-mono-tech text-[#06B6D4] hover:underline flex items-center gap-1"
                  >
                    <span>View Acoustic Profile</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
