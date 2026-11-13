import React, { useState } from 'react';
import { 
  Library, 
  Heart, 
  Clock, 
  Download, 
  Play, 
  Pause, 
  Plus, 
  Users, 
  Layers, 
  Lock, 
  Globe, 
  Trash2,
  CheckCircle2
} from 'lucide-react';
import type { AudioTrack, Playlist, CreatorProfile } from '../types/index.ts';
import { formatTime } from '../utils/audioMath.ts';

interface LibraryViewProps {
  tracks: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onSelectTrack: (track: AudioTrack) => void;
  onTogglePlay: () => void;
  onOpenTrackDetails: (track: AudioTrack) => void;
  onLikeTrack: (trackId: string) => void;
  playlists: Playlist[];
  onCreatePlaylist: (title: string, desc: string, isPublic: boolean) => void;
  creators: CreatorProfile[];
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onOpenTrackDetails,
  onLikeTrack,
  playlists,
  onCreatePlaylist,
  creators,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'liked' | 'playlists' | 'downloads' | 'following'>('liked');
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlTitle, setNewPlTitle] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');
  const [newPlPublic, setNewPlPublic] = useState(true);

  const likedTracks = tracks.filter((t) => t.isLiked);
  const downloadedTracks = tracks.filter((t) => t.downloads > 4000);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlTitle.trim()) return;
    onCreatePlaylist(newPlTitle, newPlDesc, newPlPublic);
    setNewPlTitle('');
    setNewPlDesc('');
    setShowNewPlaylistModal(false);
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono-tech text-[#10B981] uppercase tracking-wider block">
            Personal Collection
          </span>
          <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
            My Music Library
          </h1>
          <p className="text-xs sm:text-sm text-[#958ea0] mt-0.5">
            Your saved songs, curated playlists, offline downloads, and followed creators.
          </p>
        </div>

        <button
          onClick={() => setShowNewPlaylistModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Playlist</span>
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'liked', label: `Liked Songs (${likedTracks.length})`, icon: Heart },
          { id: 'playlists', label: `Playlists (${playlists.length})`, icon: Layers },
          { id: 'downloads', label: `Downloaded (${downloadedTracks.length})`, icon: Download },
          { id: 'following', label: `Followed Creators (${creators.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#161622] text-white border border-[#8B5CF6]/40 shadow-sm'
                  : 'text-[#958ea0] hover:text-white'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#06B6D4]' : 'text-[#958ea0]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* LIKED SONGS */}
      {activeSubTab === 'liked' && (
        <div className="space-y-3">
          {likedTracks.map((track) => {
            const isThisPlaying = isPlaying && currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  currentTrack?.id === track.id
                    ? 'bg-[#161622] border-[#06B6D4]/50'
                    : 'bg-[#161622]/50 hover:bg-[#161622] border-white/5'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        if (currentTrack?.id === track.id) {
                          onTogglePlay();
                        } else {
                          onSelectTrack(track);
                        }
                      }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center"
                    >
                      {isThisPlaying ? (
                        <Pause className="w-4 h-4 text-white fill-white" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span
                      onClick={() => onOpenTrackDetails(track)}
                      className="font-display font-semibold text-xs sm:text-sm text-white truncate cursor-pointer hover:text-[#06B6D4]"
                    >
                      {track.title}
                    </span>
                    <span className="text-[11px] text-[#958ea0] truncate">
                      {track.creator} · <span className="text-[#06B6D4] font-mono-tech">{track.genre}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono-tech text-[#958ea0] hidden sm:block">
                    {formatTime(track.duration)}
                  </span>
                  <button
                    onClick={() => onLikeTrack(track.id)}
                    className="p-1.5 text-[#8B5CF6] hover:opacity-75"
                    title="Remove from Liked"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    onClick={() => onOpenTrackDetails(track)}
                    className="p-1.5 text-[#958ea0] hover:text-white"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PLAYLISTS */}
      {activeSubTab === 'playlists' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="p-4 rounded-2xl bg-[#161622]/60 hover:bg-[#161622] border border-white/5 space-y-3"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden">
                <img src={pl.coverArt} alt={pl.title} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex items-center gap-1 text-[9px] font-mono-tech px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white">
                  {pl.isPublic ? <Globe className="w-2.5 h-2.5 text-[#10B981]" /> : <Lock className="w-2.5 h-2.5 text-[#F59E0B]" />}
                  <span>{pl.isPublic ? 'Public' : 'Private'}</span>
                </div>
              </div>

              <div>
                <h3 className="font-display font-semibold text-sm text-white truncate">{pl.title}</h3>
                <p className="text-xs text-[#958ea0] line-clamp-2 mt-0.5">{pl.description}</p>
              </div>

              <div className="flex items-center justify-between text-xs font-mono-tech text-[#958ea0] pt-2 border-t border-white/5">
                <span>{pl.trackIds.length} tracks</span>
                <span>Updated {pl.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DOWNLOADED MUSIC */}
      {activeSubTab === 'downloads' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#08080C] border border-white/5 text-xs text-[#958ea0] flex items-center justify-between">
            <span>Offline Cache: 3 tracks stored locally (146 MB)</span>
            <span className="text-[#10B981] font-mono-tech">Audiophile WAV / 24-bit</span>
          </div>
          {downloadedTracks.map((track) => (
            <div
              key={track.id}
              className="p-3.5 rounded-2xl bg-[#161622]/50 border border-white/5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img src={track.coverArt} alt={track.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                <div className="min-w-0">
                  <span className="font-display font-semibold text-sm text-white truncate block">{track.title}</span>
                  <span className="text-xs text-[#958ea0]">{track.creator} · {track.fileFormat}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-white/5 text-[#10B981]">
                  Downloaded
                </span>
                <button
                  onClick={() => onSelectTrack(track)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono-tech"
                >
                  Play
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FOLLOWED CREATORS */}
      {activeSubTab === 'following' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {creators.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-2xl bg-[#161622]/60 border border-white/5 text-center space-y-2.5"
            >
              <img src={c.avatar} alt={c.name} className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-[#8B5CF6]/40" />
              <div>
                <h3 className="font-display font-semibold text-sm text-white flex items-center justify-center gap-1">
                  {c.name}
                  {c.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#06B6D4]" />}
                </h3>
                <span className="text-xs font-mono-tech text-[#958ea0]">{c.handle}</span>
              </div>
              <span className="text-[10px] font-mono-tech text-[#10B981] block">
                Following
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CREATE PLAYLIST MODAL */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-md p-6 rounded-3xl bg-[#161622] border border-white/10 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <h3 className="font-display font-bold text-lg text-white">Create New Playlist</h3>

            <div className="space-y-1">
              <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                Playlist Title *
              </label>
              <input
                type="text"
                value={newPlTitle}
                onChange={(e) => setNewPlTitle(e.target.value)}
                placeholder="e.g. Midnight Cyber Ambient"
                className="w-full bg-[#08080C] text-sm text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                Description
              </label>
              <textarea
                value={newPlDesc}
                onChange={(e) => setNewPlDesc(e.target.value)}
                placeholder="What is the mood or sonic theme of this collection?"
                rows={2}
                className="w-full bg-[#08080C] text-xs text-white p-2.5 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#08080C] border border-white/5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#06B6D4]" />
                <span className="text-xs text-white">Make Playlist Public</span>
              </div>
              <input
                type="checkbox"
                checked={newPlPublic}
                onChange={(e) => setNewPlPublic(e.target.checked)}
                className="w-4 h-4 accent-[#06B6D4]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono-tech text-[#958ea0] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg"
              >
                Create Playlist
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
