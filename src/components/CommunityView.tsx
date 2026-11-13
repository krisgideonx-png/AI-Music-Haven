import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  Heart, 
  Repeat, 
  Share2, 
  Play, 
  Pause, 
  Trophy, 
  Flame, 
  CheckCircle2, 
  Sparkles, 
  Plus, 
  ArrowRight,
  Send,
  Download
} from 'lucide-react';
import type { CommunityPost, CreatorProfile, Playlist, AudioTrack } from '../types/index.ts';

interface CommunityViewProps {
  posts: CommunityPost[];
  creators: CreatorProfile[];
  playlists: Playlist[];
  tracks: AudioTrack[];
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onSelectTrack: (track: AudioTrack) => void;
  onTogglePlay: () => void;
  onOpenTrackDetails: (track: AudioTrack) => void;
  onLikeTrack: (trackId: string) => void;
  onAddPost: (postText: string, trackId?: string) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  posts,
  creators,
  playlists,
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onTogglePlay,
  onOpenTrackDetails,
  onLikeTrack,
  onAddPost,
}) => {
  const [newPostText, setNewPostText] = useState('');
  const [selectedShareTrackId, setSelectedShareTrackId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'feed' | 'creators' | 'playlists'>('feed');

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    onAddPost(newPostText, selectedShareTrackId || undefined);
    setNewPostText('');
    setSelectedShareTrackId('');
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div>
        <span className="text-xs font-mono-tech text-[#06B6D4] uppercase tracking-wider block">
          Global Community Network
        </span>
        <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
          AI Music Haven Community
        </h1>
        <p className="text-xs sm:text-base text-[#958ea0] mt-1 max-w-2xl">
          Connect with creators, share playlists, review existing songs, and follow the pioneers of AI sound design.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'feed'
              ? 'bg-[#161622] text-white border border-[#8B5CF6]/40 shadow-md'
              : 'text-[#958ea0] hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span>Activity Feed & Discussions</span>
        </button>

        <button
          onClick={() => setActiveTab('creators')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'creators'
              ? 'bg-[#161622] text-white border border-[#06B6D4]/40 shadow-md'
              : 'text-[#958ea0] hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Creator Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'playlists'
              ? 'bg-[#161622] text-white border border-[#10B981]/40 shadow-md'
              : 'text-[#958ea0] hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#10B981]" />
          <span>Collaborative Playlists</span>
        </button>
      </div>

      {/* Tab: Feed */}
      {activeTab === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Post Composer */}
            <form
              onSubmit={handlePostSubmit}
              className="p-4 sm:p-5 rounded-2xl bg-[#161622]/80 border border-white/10 backdrop-blur-xl space-y-3"
            >
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="You"
                  className="w-9 h-9 rounded-full object-cover border border-white/10"
                />
                <input
                  type="text"
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="Share a thought, review a track, or discuss an AI sound technique..."
                  className="w-full bg-[#08080C] text-xs text-white placeholder-[#958ea0] px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono-tech text-[#958ea0] hidden sm:inline">
                    Attach Song:
                  </span>
                  <select
                    value={selectedShareTrackId}
                    onChange={(e) => setSelectedShareTrackId(e.target.value)}
                    className="bg-[#08080C] text-[11px] text-[#cbc3d7] px-2 py-1 rounded-lg border border-white/10 focus:outline-none max-w-[200px] truncate"
                  >
                    <option value="">(None - Discussion Only)</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.creator})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!newPostText.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold disabled:opacity-40 transition-all"
                >
                  <Send className="w-3 h-3" />
                  <span>Post to Feed</span>
                </button>
              </div>
            </form>

            {/* Posts List */}
            <div className="space-y-4">
              {posts.map((post) => {
                const attachedTrack = tracks.find((t) => t.id === post.trackId);
                const isThisPlaying = isPlaying && currentTrack?.id === attachedTrack?.id;
                return (
                  <div
                    key={post.id}
                    className="p-5 rounded-2xl bg-[#161622]/60 border border-white/5 space-y-3.5"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={post.creatorAvatar}
                          alt={post.creator}
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                        <div>
                          <span className="font-display font-semibold text-xs text-white block">
                            {post.creator}
                          </span>
                          <span className="text-[10px] font-mono-tech text-[#958ea0]">
                            {post.creatorHandle} · {post.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-xs text-[#cbc3d7] leading-relaxed">
                      {post.content}
                    </p>

                    {/* Attached Track Card (if any) */}
                    {attachedTrack && (
                      <div className="p-3 rounded-xl bg-[#08080C] border border-white/10 flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                            <img src={attachedTrack.coverArt} alt={attachedTrack.title} className="w-full h-full object-cover" />
                            <button
                              onClick={() => {
                                if (currentTrack?.id === attachedTrack.id) {
                                  onTogglePlay();
                                } else {
                                  onSelectTrack(attachedTrack);
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
                          <div className="min-w-0 flex-1">
                            <span 
                              onClick={() => onOpenTrackDetails(attachedTrack)}
                              className="font-display font-semibold text-xs text-white truncate block hover:text-[#06B6D4] cursor-pointer"
                            >
                              {attachedTrack.title}
                            </span>
                            <span className="text-[10px] font-mono-tech text-[#958ea0]">
                              {attachedTrack.genre} · {attachedTrack.bpm} BPM · {attachedTrack.aiToolOrigin}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => onOpenTrackDetails(attachedTrack)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[10px] font-mono-tech shrink-0"
                        >
                          View Track
                        </button>
                      </div>
                    )}

                    {/* Footer Interactions */}
                    <div className="flex items-center gap-6 pt-2 border-t border-white/5 text-xs text-[#958ea0] font-mono-tech">
                      <button className="flex items-center gap-1.5 hover:text-[#8B5CF6] transition-colors">
                        <Heart className="w-3.5 h-3.5" />
                        <span>{post.likes}</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-[#06B6D4] transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.commentsCount}</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-[#10B981] transition-colors">
                        <Repeat className="w-3.5 h-3.5" />
                        <span>{post.reposts}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Column: Creator Leaderboard & Stats */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="font-display font-semibold text-sm text-white">
                  Top Creators This Week
                </h3>
              </div>

              <div className="space-y-3">
                {creators.slice(0, 4).map((c, idx) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-tech font-bold text-[#958ea0] w-3">
                        {idx + 1}
                      </span>
                      <img src={c.avatar} alt={c.name} className="w-7 h-7 rounded-full object-cover" />
                      <div className="min-w-0">
                        <span className="font-medium text-white truncate block">{c.name}</span>
                        <span className="text-[10px] text-[#958ea0] block font-mono-tech">{c.handle}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono-tech text-[#06B6D4]">
                      {(c.totalPlays / 1000).toFixed(0)}k plays
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Standards Card */}
            <div className="p-4 rounded-2xl bg-[#08080C] border border-white/5 space-y-2 text-xs text-[#958ea0]">
              <span className="font-display font-semibold text-white block">
                AI Music Haven Community Code
              </span>
              <p className="text-[11px] leading-relaxed">
                We celebrate original AI-assisted music. Upload only completed tracks you have lawful permission to share, respect licensing attribution, and encourage fellow sound designers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Creator Leaderboard */}
      {activeTab === 'creators' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {creators.map((c, idx) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl bg-[#161622]/70 border border-white/10 space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="relative">
                  <img src={c.avatar} alt={c.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#8B5CF6]/40" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center font-mono-tech">
                    #{idx + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display font-bold text-sm text-white truncate">{c.name}</h3>
                    {c.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#06B6D4]" />}
                  </div>
                  <span className="text-xs font-mono-tech text-[#958ea0] block">{c.handle}</span>
                  <p className="text-xs text-[#cbc3d7] mt-1 line-clamp-2">{c.bio}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#08080C] border border-white/5 text-center text-xs font-mono-tech">
                <div>
                  <span className="text-white block font-bold">{c.followers.toLocaleString()}</span>
                  <span className="text-[10px] text-[#958ea0]">Followers</span>
                </div>
                <div>
                  <span className="text-[#06B6D4] block font-bold">{c.totalPlays.toLocaleString()}</span>
                  <span className="text-[10px] text-[#958ea0]">Total Plays</span>
                </div>
                <div>
                  <span className="text-[#10B981] block font-bold">{c.totalDownloads.toLocaleString()}</span>
                  <span className="text-[10px] text-[#958ea0]">Downloads</span>
                </div>
              </div>

              <button className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-mono-tech transition-colors">
                Follow Creator
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Collaborative Playlists */}
      {activeTab === 'playlists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="p-5 rounded-2xl bg-[#161622]/70 border border-white/10 space-y-4"
            >
              <div className="flex items-start gap-4">
                <img src={pl.coverArt} alt={pl.title} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-base text-white truncate">{pl.title}</h3>
                    {pl.isCollaborative && (
                      <span className="text-[9px] font-mono-tech px-2 py-0.5 rounded-full bg-[#8B5CF6]/30 text-[#acedff] border border-[#8B5CF6]/40 shrink-0">
                        Collaborative
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#958ea0] block">Curated by {pl.creator}</span>
                  <p className="text-xs text-[#cbc3d7] mt-1 line-clamp-2">{pl.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono-tech text-[#958ea0] pt-2 border-t border-white/5">
                <span>{pl.trackIds.length} tracks cataloged</span>
                <span className="text-[#8B5CF6] flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  {pl.likes}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
