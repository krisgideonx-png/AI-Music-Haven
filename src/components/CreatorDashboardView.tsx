import React, { useState } from 'react';
import {
  TrendingUp,
  Download,
  Users,
  Headphones,
  ShieldCheck,
  Edit3,
  UploadCloud,
  LogIn,
  ShieldAlert,
  Lock,
  AlertTriangle,
  Trash2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AudioTrack, TrackTakedownNotice } from '../types/index.ts';
import {
  isAdminUser,
  canEditTrack,
  canDeleteTrack,
  getCreatorUploadedTracks,
} from '../utils/accessControl.ts';
import { UserAiCapBadge } from './UserAiCapBadge.tsx';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';
import { computeCreatorAnalyticsDistribution } from '../utils/catalogStats.ts';

interface CreatorDashboardViewProps {
  tracks: AudioTrack[];
  takedowns?: TrackTakedownNotice[];
  authUser: User | null;
  aiQuota?: UserAiQuotaState;
  onSignInGoogle: () => void;
  onNavigateToUpload: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenTrackDetails: (track: AudioTrack) => void;
  onEditTrackDetails: (track: AudioTrack) => void;
  onDeleteTrack?: (track: AudioTrack) => Promise<void> | void;
}

export const CreatorDashboardView: React.FC<CreatorDashboardViewProps> = ({
  tracks,
  takedowns = [],
  authUser,
  aiQuota,
  onSignInGoogle,
  onNavigateToUpload,
  onOpenAdminDashboard,
  onOpenTrackDetails,
  onEditTrackDetails,
  onDeleteTrack,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [deleteTarget, setDeleteTarget] = useState<AudioTrack | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!onDeleteTrack || !deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteTrack(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete song right now.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isAdmin = isAdminUser(authUser);
  const myTracks = getCreatorUploadedTracks(tracks, authUser);
  const myTakedowns = authUser
    ? takedowns.filter((td) => td.targetUploaderUid === authUser.uid)
    : [];

  const totalPlays = myTracks.reduce((acc, t) => acc + (t.plays || 0), 0);
  const totalDownloads = myTracks.reduce((acc, t) => acc + (t.downloads || 0), 0);
  const totalLikes = myTracks.reduce((acc, t) => acc + (t.likes || 0), 0);
  const followerCount =
    myTracks.length > 0
      ? Math.max(...myTracks.map((t) => Math.max(0, t.creatorFollowers || 0)))
      : 0;
  const analytics = computeCreatorAnalyticsDistribution(totalPlays, timeRange);

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono-tech text-[#06B6D4] uppercase tracking-wider block">
            Audience Insights &amp; Creator Catalog
          </span>
          <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
            Creator Studio Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#958ea0] mt-0.5">
            Monitor streams and edit titles or metadata for songs you personally uploaded to AI Music Haven.
          </p>
          {aiQuota && (
            <div className="pt-2">
              <UserAiCapBadge quota={aiQuota} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {isAdmin && onOpenAdminDashboard && (
            <button
              type="button"
              onClick={onOpenAdminDashboard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 border border-[#EF4444]/35 text-xs font-mono-tech text-white transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Open Admin Dashboard</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#161622] border border-white/5 text-xs font-mono-tech">
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === '7d' ? 'bg-[#8B5CF6] text-white' : 'text-[#958ea0] hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === '30d' ? 'bg-[#8B5CF6] text-white' : 'text-[#958ea0] hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === 'all' ? 'bg-[#8B5CF6] text-white' : 'text-[#958ea0] hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#958ea0] font-mono-tech">
            <span>Your Track Streams</span>
            <Headphones className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <span className="font-display font-bold text-2xl sm:text-3xl text-white block">
            {totalPlays.toLocaleString()}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono-tech text-[#10B981]">
            <TrendingUp className="w-3 h-3" />
            <span>{myTracks.length} uploaded track{myTracks.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#958ea0] font-mono-tech">
            <span>Your Downloads</span>
            <Download className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <span className="font-display font-bold text-2xl sm:text-3xl text-white block">
            {totalDownloads.toLocaleString()}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono-tech text-[#10B981]">
            <TrendingUp className="w-3 h-3" />
            <span>Original audio preserved</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#958ea0] font-mono-tech">
            <span>Haven Followers</span>
            <Users className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <span className="font-display font-bold text-2xl sm:text-3xl text-white block tabular-nums">
            {authUser ? followerCount.toLocaleString() : '—'}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono-tech text-[#06B6D4] tabular-nums">
            <span>
              {authUser
                ? `${totalLikes.toLocaleString()} track like${totalLikes === 1 ? '' : 's'}`
                : 'Sign in to sync profile'}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#958ea0] font-mono-tech">
            <span>Edit Permissions</span>
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          </div>
          <span className="font-display font-bold text-2xl sm:text-3xl text-[#10B981] block">
            {isAdmin ? 'Admin' : authUser ? 'Own Uploads' : 'Read-Only'}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono-tech text-[#958ea0]">
            <span>{isAdmin ? 'Full catalog access' : 'Creators edit own songs only'}</span>
          </div>
        </div>
      </div>

      {/* Analytics Chart Simulation & Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Playback Streams Activity Bar Graph */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-sm sm:text-base text-white">
                Listening Trends Over Time
              </h3>
              <span className="text-[11px] text-[#958ea0] tabular-nums">
                {analytics.scopedTotalPlays.toLocaleString()} stream{analytics.scopedTotalPlays === 1 ? '' : 's'} in selected window
              </span>
            </div>
            <span className="text-xs font-mono-tech text-[#06B6D4] tabular-nums">
              Peak: {analytics.peakPlays.toLocaleString()} play{analytics.peakPlays === 1 ? '' : 's'}
            </span>
          </div>

          {/* Bar Visualization */}
          <div className="h-44 flex items-end justify-between gap-1.5 pt-6 px-1">
            {analytics.bars.map((bar) => (
              <div
                key={bar.label}
                className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group"
                title={`${bar.label}: ${bar.plays.toLocaleString()} plays`}
              >
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    bar.heightPercent > 0
                      ? 'bg-gradient-to-t from-[#8B5CF6]/40 via-[#8B5CF6] to-[#06B6D4] group-hover:brightness-125 group-hover:shadow-[0_0_12px_#06B6D4]'
                      : 'bg-white/10 min-h-[3px]'
                  }`}
                  style={{ height: bar.heightPercent > 0 ? `${bar.heightPercent}%` : '3px' }}
                />
                <span className="text-[9px] font-mono-tech text-[#958ea0] opacity-60 shrink-0">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Listener Demographics */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#161622]/80 border border-white/10 space-y-4">
          <h3 className="font-display font-semibold text-sm sm:text-base text-white">
            Audience Distribution
          </h3>
          <div className="space-y-3">
            {analytics.regions.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white">{c.name}</span>
                  <span className="font-mono-tech text-[#06B6D4] tabular-nums">
                    {c.formattedPlays} ({c.percentageLabel})
                  </span>
                </div>
                <div className="h-1.5 bg-[#08080C] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] rounded-full transition-all"
                    style={{ width: c.percentageLabel }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Takedown Notices Delivered to Creator */}
      {myTakedowns.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/35 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono-tech text-[#fca5a5] uppercase">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <span>Administrative Takedown Notices ({myTakedowns.length})</span>
          </div>
          <div className="space-y-2.5">
            {myTakedowns.map((td) => (
              <div
                key={td.id}
                className="p-3.5 rounded-xl bg-[#08080C]/85 border border-white/10 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display font-semibold text-xs sm:text-sm text-white">
                    Removed Track: &ldquo;{td.trackTitle}&rdquo;
                  </span>
                  <span className="text-[10px] font-mono-tech text-[#958ea0]">
                    {td.createdAt} {td.autoGenerated ? '· Auto-Generated Notice' : '· Moderator Notice'}
                  </span>
                </div>
                <p className="text-xs text-[#e4e1e8] leading-relaxed">{td.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Catalog Management Table (Creator's Own Uploads Only) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-base sm:text-lg text-white">
            Your Uploaded Songs ({myTracks.length})
          </h3>
          <span className="text-xs font-mono-tech text-[#958ea0]">
            Creators can edit or delete only their own uploads
          </span>
        </div>

        {!authUser ? (
          <div className="p-8 rounded-2xl border border-white/10 bg-[#161622]/60 backdrop-blur-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#08080C] border border-[#8B5CF6]/40 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display font-semibold text-base text-white">
                Sign in with Google to Manage Your Uploads
              </h4>
              <p className="text-xs text-[#958ea0] max-w-md mx-auto">
                Only authenticated creators can edit the title and details of songs they uploaded. Sign in to see your uploaded catalog here.
              </p>
            </div>
            <button
              type="button"
              onClick={onSignInGoogle}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in with Google</span>
            </button>
          </div>
        ) : myTracks.length === 0 ? (
          <div className="p-8 rounded-2xl border border-white/10 bg-[#161622]/60 backdrop-blur-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#08080C] border border-white/10 flex items-center justify-center mx-auto">
              <UploadCloud className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display font-semibold text-base text-white">
                No Uploaded Songs Under This Account Yet
              </h4>
              <p className="text-xs text-[#958ea0] max-w-md mx-auto">
                Upload a completed AI-generated song to manage its title, category, and licensing here.
                {isAdmin ? ' As Admin, you can also edit every song in the Admin Dashboard.' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onNavigateToUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload a Song</span>
              </button>
              {isAdmin && onOpenAdminDashboard && (
                <button
                  type="button"
                  onClick={onOpenAdminDashboard}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-white"
                >
                  <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
                  <span>Edit All Songs in Admin Dashboard</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#161622]/60 backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#08080C] text-[#958ea0] border-b border-white/5 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Track Title</th>
                    <th className="py-3 px-4">AI Origin</th>
                    <th className="py-3 px-4">Genre</th>
                    <th className="py-3 px-4">License</th>
                    <th className="py-3 px-4">Streams</th>
                    <th className="py-3 px-4">Downloads</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[#cbc3d7]">
                  {myTracks.map((t) => {
                    const editable = canEditTrack(t, authUser);
                    const deletable = canDeleteTrack(t, authUser);
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 flex items-center gap-2.5">
                          <img src={t.coverArt} alt={t.title} className="w-8 h-8 rounded-lg object-cover" />
                          <span className="font-sans font-medium text-white truncate max-w-[180px]">{t.title}</span>
                        </td>
                        <td className="py-3 px-4 text-[#8B5CF6]">{t.aiToolOrigin}</td>
                        <td className="py-3 px-4">{t.genre}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                            {t.license}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{t.plays.toLocaleString()}</td>
                        <td className="py-3 px-4 text-[#06B6D4]">{t.downloads.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => onEditTrackDetails(t)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-white text-[11px] transition-colors"
                              >
                                <Edit3 className="w-3 h-3 text-[#06B6D4]" />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenTrackDetails(t)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[11px]"
                            >
                              Details
                            </button>
                            {deletable && onDeleteTrack && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget(t);
                                }}
                                aria-label={`Delete ${t.title}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EF4444]/10 hover:bg-[#EF4444]/25 border border-[#EF4444]/30 text-[#fca5a5] text-[11px] transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-[#EF4444]" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Creator Delete Song Confirmation Modal */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#0F0F16] border border-[#EF4444]/40 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-tech text-[#EF4444] uppercase">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Uploaded Song</span>
                </div>
                <h3 className="font-display font-bold text-lg text-white">
                  Delete &ldquo;{deleteTarget.title}&rdquo;?
                </h3>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-xl text-[#958ea0] hover:text-white hover:bg-white/5"
                aria-label="Close delete confirmation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#cbc3d7] leading-relaxed">
              This will permanently remove <strong className="text-white">{deleteTarget.title}</strong> from AI Music Haven and stop active playback if it is currently playing.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono-tech text-[#958ea0] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#EF4444] hover:bg-[#dc2626] text-white text-xs font-semibold shadow-lg transition-all disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Song'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
