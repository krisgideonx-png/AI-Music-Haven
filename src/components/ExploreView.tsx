import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Search, 
  Filter, 
  SlidersHorizontal, 
  Heart, 
  Download, 
  Sparkles, 
  Star, 
  Check, 
  Clock, 
  ChevronDown, 
  ArrowUpDown,
  FileAudio
} from 'lucide-react';
import type { AudioTrack, HavenLicense } from '../types/index.ts';
import { formatTime } from '../utils/audioMath.ts';

interface ExploreViewProps {
  tracks: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onSelectTrack: (track: AudioTrack) => void;
  onTogglePlay: () => void;
  onOpenTrackDetails: (track: AudioTrack) => void;
  onLikeTrack: (trackId: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onOpenTrackDetails,
  onLikeTrack,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedMood, setSelectedMood] = useState('All');
  const [selectedLicense, setSelectedLicense] = useState<string>('All');
  const [selectedVocal, setSelectedVocal] = useState('All');
  const [selectedEnergy, setSelectedEnergy] = useState('All');
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'downloads' | 'rating'>('trending');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const query = externalSearchQuery !== undefined ? externalSearchQuery : internalSearch;
  const setQuery = externalOnSearchChange || setInternalSearch;

  const genres = ['All', 'Cyberpunk Ambient', 'Afrobeat', 'Neurofunk', 'Neo-Classical', 'Modular Techno', 'Lo-Fi Chill', 'Hyperpop', 'Synthwave'];
  const moods = ['All', 'Atmospheric', 'Soulful & Euphoric', 'Relentless High-Energy', 'Peaceful & Introspective', 'Hypnotic & Driving', 'Cozy & Melancholic'];
  const licenses = ['All', 'Free Personal', 'Attribution Required', 'Commercial Permitted', 'All Rights Reserved'];

  const filteredTracks = tracks.filter((t) => {
    const matchesSearch =
      query === '' ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.creator.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase()) ||
      t.genre.toLowerCase().includes(query.toLowerCase()) ||
      t.aiToolOrigin.toLowerCase().includes(query.toLowerCase()) ||
      t.instruments.some((inst) => inst.toLowerCase().includes(query.toLowerCase()));

    const matchesGenre = selectedGenre === 'All' || t.genre === selectedGenre;
    const matchesMood = selectedMood === 'All' || t.mood === selectedMood;
    const matchesLicense = selectedLicense === 'All' || t.license === selectedLicense;
    const matchesVocal = selectedVocal === 'All' || t.vocalType.toLowerCase().includes(selectedVocal.toLowerCase());
    const matchesEnergy = selectedEnergy === 'All' || t.energyLevel === selectedEnergy;

    return matchesSearch && matchesGenre && matchesMood && matchesLicense && matchesVocal && matchesEnergy;
  });

  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (sortBy === 'trending') return b.plays - a.plays;
    if (sortBy === 'downloads') return b.downloads - a.downloads;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0; // default initial order
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono-tech text-[#06B6D4] uppercase tracking-wider block">
            The Complete AI Music Haven Archive
          </span>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Explore AI Music Library
          </h1>
          <p className="text-xs sm:text-sm text-[#958ea0] mt-0.5">
            Discover completed AI compositions cataloged with non-destructive acoustic metadata.
          </p>
        </div>

        {/* Sort & Filter controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#161622] border border-white/5 text-xs font-mono-tech">
            <span className="text-[#958ea0] px-2 hidden sm:inline">Sort:</span>
            <button
              onClick={() => setSortBy('trending')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === 'trending' ? 'bg-[#8B5CF6] text-white font-semibold' : 'text-[#958ea0] hover:text-white'
              }`}
            >
              Trending
            </button>
            <button
              onClick={() => setSortBy('downloads')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === 'downloads' ? 'bg-[#8B5CF6] text-white font-semibold' : 'text-[#958ea0] hover:text-white'
              }`}
            >
              Downloads
            </button>
            <button
              onClick={() => setSortBy('rating')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === 'rating' ? 'bg-[#8B5CF6] text-white font-semibold' : 'text-[#958ea0] hover:text-white'
              }`}
            >
              Top Rated
            </button>
          </div>

          <button
            onClick={() => setShowFiltersModal(!showFiltersModal)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono-tech border transition-all ${
              showFiltersModal ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]' : 'bg-[#161622] border-white/10 text-white hover:bg-white/5'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGenre(g)}
            className={`px-3 py-1.5 rounded-full text-xs font-sans whitespace-nowrap transition-all ${
              selectedGenre === g
                ? 'bg-[#8B5CF6] text-white font-medium shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                : 'bg-[#161622] text-[#958ea0] hover:text-white border border-white/5'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Expanded Filter Panel (Collapsible) */}
      {showFiltersModal && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161622]/90 border border-white/10 backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Mood Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                Atmospheric Mood
              </label>
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="w-full bg-[#08080C] text-xs text-white p-2 rounded-xl border border-white/10 focus:outline-none focus:border-[#06B6D4]"
              >
                {moods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* License Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                Licensing Rights
              </label>
              <select
                value={selectedLicense}
                onChange={(e) => setSelectedLicense(e.target.value)}
                className="w-full bg-[#08080C] text-xs text-white p-2 rounded-xl border border-white/10 focus:outline-none focus:border-[#06B6D4]"
              >
                {licenses.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedGenre('All');
                  setSelectedMood('All');
                  setSelectedLicense('All');
                  setQuery('');
                }}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono-tech text-[#958ea0] hover:text-white transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs font-mono-tech text-[#958ea0] pt-1">
        <span>Showing {sortedTracks.length} completed songs</span>
        {query && <span>Filter: &quot;{query}&quot;</span>}
      </div>

      {/* Track Grid List */}
      <div className="grid grid-cols-1 gap-3">
        {sortedTracks.map((track) => {
          const isThisPlaying = isPlaying && currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-center justify-between gap-4 group ${
                currentTrack?.id === track.id
                  ? 'bg-[#161622] border-[#06B6D4]/40 shadow-[0_0_16px_rgba(6,182,212,0.15)]'
                  : 'bg-[#161622]/50 hover:bg-[#161622] border-white/5'
              }`}
            >
              {/* Left Column: Artwork + Title + Description */}
              <div className="flex items-center gap-3.5 min-w-0 w-full md:w-5/12">
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 group/img">
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
                    aria-label={`Play ${track.title}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white flex items-center justify-center shadow-lg">
                      {isThisPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-white" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      )}
                    </div>
                  </button>
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      onClick={() => onOpenTrackDetails(track)}
                      className="font-display font-semibold text-sm text-white truncate cursor-pointer hover:text-[#06B6D4] transition-colors"
                    >
                      {track.title}
                    </span>
                    <span className="text-[10px] font-mono-tech text-[#F59E0B] flex items-center gap-0.5 shrink-0">
                      <Star className="w-3 h-3 fill-current" />
                      {track.rating}
                    </span>
                  </div>

                  <span className="text-xs text-[#958ea0] truncate">
                    by <strong className="text-[#cbc3d7]">{track.creator}</strong> · {track.creatorHandle}
                  </span>

                  <p className="text-[11px] text-[#958ea0] line-clamp-1 mt-0.5">
                    {track.description}
                  </p>
                </div>
              </div>

              {/* Center Column: Acoustic Classifications & Badges */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-4/12 justify-start md:justify-center">
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-white/[0.04] text-[#06B6D4] border border-white/[0.08]">
                  {track.genre}
                </span>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-white/[0.04] text-white/80 border border-white/[0.08]">
                  {track.bpm} BPM · {track.key}
                </span>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-white/[0.04] text-[#8B5CF6] border border-white/[0.08]">
                  {track.aiToolOrigin}
                </span>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  {track.license}
                </span>
              </div>

              {/* Right Column: Stats & Action Buttons */}
              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-3/12 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                <div className="flex flex-col text-left md:text-right text-[10px] font-mono-tech text-[#958ea0]">
                  <span>{track.plays.toLocaleString()} plays</span>
                  <span>{track.downloads.toLocaleString()} dl</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onLikeTrack(track.id)}
                    className={`p-2 rounded-xl border text-xs transition-colors ${
                      track.isLiked
                        ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#8B5CF6]'
                        : 'bg-[#08080C] border-white/10 text-[#958ea0] hover:text-white'
                    }`}
                    title="Like this track"
                  >
                    <Heart className={`w-3.5 h-3.5 ${track.isLiked ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => onOpenTrackDetails(track)}
                    className="p-2 rounded-xl bg-[#08080C] border border-white/10 text-[#958ea0] hover:text-white transition-colors"
                    title="Download track"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onOpenTrackDetails(track)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6]/20 to-[#06B6D4]/20 hover:from-[#8B5CF6]/30 hover:to-[#06B6D4]/30 text-white border border-[#06B6D4]/30 text-xs font-mono-tech transition-all"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {sortedTracks.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-[#161622]/40 border border-white/5 space-y-3">
            <Sparkles className="w-8 h-8 text-[#958ea0] mx-auto opacity-40" />
            <h3 className="font-display font-semibold text-base text-white">No tracks match your current filters</h3>
            <p className="text-xs text-[#958ea0] max-w-sm mx-auto">
              Try adjusting your genre, mood, or search keywords to explore more songs in the AI Music Haven library.
            </p>
            <button
              onClick={() => {
                setSelectedGenre('All');
                setSelectedMood('All');
                setSelectedLicense('All');
                setQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-[#161622] hover:bg-[#202030] border border-white/10 text-xs text-white"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
