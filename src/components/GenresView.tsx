import React, { useState } from 'react';
import { 
  Radio, 
  Sparkles, 
  Play, 
  Pause, 
  ArrowRight, 
  Headphones, 
  Heart, 
  Download,
  Flame,
  Layers
} from 'lucide-react';
import type { AudioTrack } from '../types/index.ts';

interface GenresViewProps {
  tracks: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onSelectTrack: (track: AudioTrack) => void;
  onTogglePlay: () => void;
  onOpenTrackDetails: (track: AudioTrack) => void;
  onLikeTrack: (trackId: string) => void;
}

export const GenresView: React.FC<GenresViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onOpenTrackDetails,
  onLikeTrack,
}) => {
  const [activeGenre, setActiveGenre] = useState<string>('All');

  const genreList = [
    {
      id: 'Cyberpunk Ambient',
      title: 'Cyberpunk Ambient',
      desc: 'Obsidian sub-frequencies, crystalline synth plucks, dark futuristic sound design and wide binaural depth.',
      subgenres: ['Darkwave Ambient', 'Cyber-Minimalism', 'Industrial Dronescape'],
      accent: '#8B5CF6',
    },
    {
      id: 'Afrobeat',
      title: 'Afrobeat & Afro-Fusion',
      desc: 'Polyrhythmic West African percussion, syncopated talking drums, lush brass stabs, and soulful male and female vocals.',
      subgenres: ['Afro-Fusion', 'Amapiano Synthetics', 'Highlife AI'],
      accent: '#F59E0B',
    },
    {
      id: 'Neurofunk',
      title: 'Neurofunk & Drum & Bass',
      desc: 'High-octane 170+ BPM drum breaks, aggressive Reese basslines, granular micro-glitches and precision sub-bass.',
      subgenres: ['Techstep', 'Liquid DnB', 'Dark Neuro'],
      accent: '#06B6D4',
    },
    {
      id: 'Neo-Classical',
      title: 'Neo-Classical & Orchestral',
      desc: 'Warm analog Moog synthesis blended with real orchestral cello quartets, grand piano, and ethereal wordless soprano choir.',
      subgenres: ['Cinematic Ambient', 'Modern Chamber', 'Symphonic Tape Loop'],
      accent: '#10B981',
    },
    {
      id: 'Lo-Fi Chill',
      title: 'Lo-Fi Chill & Chillhop',
      desc: 'Tape-saturated Rhodes voicings, gentle vinyl dust, SP-404 drum filters, and nostalgic late-night saxophone riffs.',
      subgenres: ['Midnight Chillhop', 'Coffee Shop Jazz Lo-Fi', 'Rainy Bedroom Beats'],
      accent: '#3B82F6',
    },
    {
      id: 'Modular Techno',
      title: 'Modular & Industrial Techno',
      desc: 'Distortion-treated TB-303 acid lines, warehouse 909 kicks, metallic percussion transients, and raw Berlin acoustics.',
      subgenres: ['Berlin Acid', 'Peak-Time Warehouse', 'Minimal Hypnotic'],
      accent: '#EC4899',
    },
  ];

  const displayedTracks = activeGenre === 'All' 
    ? tracks 
    : tracks.filter(t => t.genre.toLowerCase().includes(activeGenre.toLowerCase()));

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div>
        <span className="text-xs font-mono-tech text-[#8B5CF6] uppercase tracking-wider block">
          Acoustic Taxonomy
        </span>
        <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
          Genre & Mood Collections
        </h1>
        <p className="text-xs sm:text-base text-[#958ea0] mt-1 max-w-2xl">
          Explore curated collections of completed AI music organized by global acoustic classifications, subgenres, and harmonic moods.
        </p>
      </div>

      {/* Genre Grid Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {genreList.map((g) => {
          const isSelected = activeGenre === g.id;
          const count = tracks.filter(t => t.genre.toLowerCase().includes(g.id.toLowerCase())).length;
          return (
            <div
              key={g.id}
              onClick={() => setActiveGenre(isSelected ? 'All' : g.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                isSelected
                  ? 'bg-[#161622] border-[#8B5CF6] shadow-[0_0_20px_rgba(139,92,246,0.3)] scale-[1.01]'
                  : 'bg-[#161622]/50 hover:bg-[#161622] border-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: g.accent }}
                />
                <span className="text-[10px] font-mono-tech text-[#958ea0]">
                  {count} songs in library
                </span>
              </div>

              <div>
                <h3 className="font-display font-bold text-base text-white">
                  {g.title}
                </h3>
                <p className="text-xs text-[#958ea0] line-clamp-2 mt-1">
                  {g.desc}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {g.subgenres.map((sub) => (
                  <span
                    key={sub}
                    className="text-[9px] font-mono-tech px-2 py-0.5 rounded-full bg-white/[0.04] text-[#cbc3d7] border border-white/10"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Songs in selected Genre */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#06B6D4]" />
            <h2 className="font-display font-semibold text-lg text-white">
              {activeGenre === 'All' ? 'All Archive Compositions' : `${activeGenre} Selections`} ({displayedTracks.length})
            </h2>
          </div>
          {activeGenre !== 'All' && (
            <button
              onClick={() => setActiveGenre('All')}
              className="text-xs font-mono-tech text-[#958ea0] hover:text-white"
            >
              View All Genres
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedTracks.map((track) => {
            const isThisPlaying = isPlaying && currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  currentTrack?.id === track.id
                    ? 'bg-[#161622] border-[#06B6D4]/50 shadow-[0_0_16px_rgba(6,182,212,0.15)]'
                    : 'bg-[#161622]/60 hover:bg-[#161622] border-white/5'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 group">
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
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white flex items-center justify-center">
                        {isThisPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-white" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      onClick={() => onOpenTrackDetails(track)}
                      className="font-display font-semibold text-xs sm:text-sm text-white truncate cursor-pointer hover:text-[#06B6D4] transition-colors"
                    >
                      {track.title}
                    </span>
                    <span className="text-[11px] text-[#958ea0] truncate">
                      {track.creator} · <span className="text-[#06B6D4]">{track.bpm} BPM</span>
                    </span>
                    <div className="flex items-center gap-2 text-[10px] font-mono-tech text-[#958ea0] mt-0.5">
                      <span>{track.vocalType}</span>
                      <span>·</span>
                      <span className="text-[#10B981]">{track.license}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onLikeTrack(track.id)}
                    className={`p-1.5 rounded-lg border text-xs ${
                      track.isLiked ? 'text-[#8B5CF6] border-[#8B5CF6]/50 bg-[#8B5CF6]/15' : 'text-[#958ea0] border-white/5'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${track.isLiked ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => onOpenTrackDetails(track)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono-tech transition-colors"
                  >
                    Details
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
