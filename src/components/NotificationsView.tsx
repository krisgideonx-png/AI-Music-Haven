import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Compass,
  Download,
  Edit3,
  Eye,
  Heart,
  MailOpen,
  Music2,
  Pause,
  Play,
  Radio,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AudioTrack,
  HavenNotification,
  HavenTab,
  NotificationType,
} from '../types/index.ts';
import { canEditTrack, isAdminUser } from '../utils/accessControl.ts';
import {
  filterNotifications,
  getNotificationTypeMeta,
  type NotificationFilter,
} from '../utils/notifications.ts';

interface NotificationsViewProps {
  notifications: HavenNotification[];
  selectedNotificationId: string | null;
  onSelectNotification: (notification: HavenNotification) => void;
  onMarkRead: (notificationId: string, read: boolean) => void;
  onMarkAllRead: () => void;
  onDismissNotification: (notificationId: string) => void;
  tracks: AudioTrack[];
  currentTrack: AudioTrack;
  isPlaying: boolean;
  authUser: User | null;
  onSelectTrack: (track: AudioTrack) => void;
  onTogglePlay: () => void;
  onOpenTrackDetails: (track: AudioTrack, editMode?: boolean) => void;
  onLikeTrack: (trackId: string) => void;
  onSelectTab: (tab: HavenTab) => void;
  onResolveReport: (reportId: string, action: 'Dismissed' | 'Resolved') => void;
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'takedown':
      return AlertTriangle;
    case 'moderation_report':
      return ShieldAlert;
    case 'track_milestone':
      return Download;
    case 'track_liked':
      return Heart;
    case 'category_verified':
      return CheckCircle2;
    case 'track_published':
      return UploadCloud;
  }
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  selectedNotificationId,
  onSelectNotification,
  onMarkRead,
  onMarkAllRead,
  onDismissNotification,
  tracks,
  currentTrack,
  isPlaying,
  authUser,
  onSelectTrack,
  onTogglePlay,
  onOpenTrackDetails,
  onLikeTrack,
  onSelectTab,
  onResolveReport,
}) => {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [mobileShowDetail, setMobileShowDetail] = useState<boolean>(Boolean(selectedNotificationId));
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [brokenCoverIds, setBrokenCoverIds] = useState<Record<string, boolean>>({});

  const isAdmin = isAdminUser(authUser);

  const filteredNotifications = useMemo(
    () => filterNotifications(notifications, filter),
    [notifications, filter]
  );

  const selectedNotification = useMemo(() => {
    if (selectedNotificationId) {
      const exact = notifications.find((n) => n.id === selectedNotificationId);
      if (exact) return exact;
    }
    return filteredNotifications[0] || notifications[0] || null;
  }, [notifications, filteredNotifications, selectedNotificationId]);

  const linkedTrack = useMemo(() => {
    if (!selectedNotification?.trackId) return null;
    return tracks.find((t) => t.id === selectedNotification.trackId) || null;
  }, [tracks, selectedNotification]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  const handleRowClick = (notif: HavenNotification) => {
    onSelectNotification(notif);
    setMobileShowDetail(true);
  };

  const handlePlayOrPauseTrack = (track: AudioTrack) => {
    if (currentTrack.id === track.id) {
      onTogglePlay();
    } else {
      onSelectTrack(track);
    }
  };

  const selectedMeta = selectedNotification
    ? getNotificationTypeMeta(selectedNotification.type)
    : null;
  const SelectedIcon = selectedNotification ? getTypeIcon(selectedNotification.type) : Bell;
  const isLinkedTrackPlaying = Boolean(
    linkedTrack && isPlaying && currentTrack.id === linkedTrack.id
  );
  const canEditLinked = canEditTrack(linkedTrack, authUser);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono-tech text-[#958ea0]">
            <button
              type="button"
              onClick={() => onSelectTab('home')}
              className="hover:text-white transition-colors"
            >
              Home
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-[#06B6D4]">Notifications</span>
            {selectedMeta && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-white truncate max-w-[200px]">{selectedMeta.label}</span>
              </>
            )}
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
            Notification Center
          </h1>
          <p className="text-xs sm:text-sm text-[#958ea0]">
            Open any notification to view full context and take direct actions based on message type.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-xs font-mono-tech text-[#958ea0] tabular-nums">
            {unreadCount} unread · {notifications.length} total
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onMarkAllRead();
                triggerToast('All notifications marked as read.');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Confirmation Feedback */}
      {actionToast && (
        <div className="p-3.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs text-[#10B981] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Segmented Filter Controls */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#161622] border border-white/10 w-fit">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'moderation', label: 'Moderation' },
            { id: 'tracks', label: 'Tracks & Activity' },
          ] as { id: NotificationFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filter === tab.id
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#958ea0] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Split Workspace: Inbox List + Actionable Message Detail Page */}
      {notifications.length === 0 ? (
        <div className="p-10 rounded-2xl border border-white/10 bg-[#161622]/70 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#08080C] border border-white/10 flex items-center justify-center mx-auto">
            <Bell className="w-5 h-5 text-[#06B6D4]" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-semibold text-lg text-white">
              All Caught Up
            </h2>
            <p className="text-xs text-[#958ea0] max-w-md mx-auto">
              You have no active notifications right now. New uploads, track milestones, community interactions, and moderation updates will appear here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('explore')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold"
          >
            <Compass className="w-4 h-4" />
            <span>Explore AI Music Catalog</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Inbox List */}
          <section
            className={`lg:col-span-5 rounded-2xl border border-white/10 bg-[#161622]/70 overflow-hidden ${
              mobileShowDetail && selectedNotification ? 'hidden lg:block' : 'block'
            }`}
            aria-label="Notification list"
          >
            <div className="px-4 py-3 border-b border-white/10 bg-[#08080C]/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Messages</span>
              <span className="text-xs font-mono-tech text-[#958ea0] tabular-nums">
                {filteredNotifications.length} shown
              </span>
            </div>

            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-[#958ea0]">
                  No notifications match the selected filter.
                </p>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white transition-colors"
                >
                  Show all notifications
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredNotifications.map((notif) => {
                  const Icon = getTypeIcon(notif.type);
                  const meta = getNotificationTypeMeta(notif.type);
                  const isSelected = selectedNotification?.id === notif.id;
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleRowClick(notif)}
                      className={`w-full text-left p-4 transition-colors flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#8B5CF6]/15'
                          : notif.read
                          ? 'hover:bg-white/[0.03]'
                          : 'bg-white/[0.04] hover:bg-white/[0.07]'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl border ${meta.accentBg} ${meta.accentBorder} shrink-0 mt-0.5`}
                      >
                        <Icon className={`w-4 h-4 ${meta.accentText}`} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tech text-[#958ea0]">
                          <span className={`${meta.accentText} truncate`}>
                            {meta.label}
                          </span>
                          <span className="shrink-0 tabular-nums">{notif.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!notif.read && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#06B6D4] shrink-0"
                              aria-label="Unread notification"
                            />
                          )}
                          <span className="text-sm font-semibold text-white truncate">
                            {notif.title}
                          </span>
                        </div>
                        <p className="text-xs text-[#958ea0] line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Selected Notification Detail & Type-Specific Actions */}
          <section
            className={`lg:col-span-7 rounded-2xl border border-white/10 bg-[#161622]/75 p-5 sm:p-7 space-y-6 ${
              mobileShowDetail || !selectedNotification ? 'block' : 'hidden lg:block'
            }`}
            aria-label="Notification details and actions"
          >
            {selectedNotification && selectedMeta ? (
              <>
                {/* Mobile Back to List */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileShowDetail(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#06B6D4] hover:text-white"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Notifications</span>
                  </button>
                </div>

                {/* Message Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-white/10">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`p-3 rounded-2xl border ${selectedMeta.accentBg} ${selectedMeta.accentBorder} shrink-0`}
                    >
                      <SelectedIcon className={`w-5 h-5 ${selectedMeta.accentText}`} />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#958ea0]">
                        <span className={`font-medium ${selectedMeta.accentText}`}>
                          {selectedMeta.label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tech tabular-nums">
                          {selectedNotification.time}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedNotification.read ? 'Read' : 'Unread'}</span>
                      </div>
                      <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
                        {selectedNotification.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onMarkRead(selectedNotification.id, !selectedNotification.read);
                        triggerToast(
                          selectedNotification.read
                            ? 'Marked as unread.'
                            : 'Marked as read.'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <MailOpen className="w-3.5 h-3.5 text-[#06B6D4]" />
                      <span>{selectedNotification.read ? 'Mark unread' : 'Mark read'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDismissNotification(selectedNotification.id);
                        setMobileShowDetail(false);
                        triggerToast('Notification dismissed.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#EF4444]/15 border border-white/10 hover:border-[#EF4444]/35 text-xs text-[#cbc3d7] hover:text-[#fca5a5] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>

                {/* Full Message Content */}
                <div className="space-y-3">
                  <p className="text-sm sm:text-base text-[#e4e1e8] leading-relaxed">
                    {selectedNotification.message}
                  </p>
                  <p className="text-xs text-[#958ea0]">
                    Recommended workflow: {selectedMeta.actionSummary}.
                  </p>
                </div>

                {/* Type-Specific Context Section */}
                {selectedNotification.type === 'takedown' && (
                  <div className="p-4 sm:p-5 rounded-xl bg-[#08080C]/80 border border-[#EF4444]/30 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#fca5a5]">
                      <span className="font-semibold">Administrative Takedown Details</span>
                      <span className="font-mono-tech text-[#958ea0]">
                        {selectedNotification.metadata?.autoGenerated
                          ? 'Auto-Generated Moderation Notice'
                          : 'Moderator Review Notice'}
                      </span>
                    </div>
                    <p className="text-xs text-[#cbc3d7] leading-relaxed">
                      Reviewed by: {selectedNotification.metadata?.adminEmail || 'Platform Moderator'}
                      {selectedNotification.trackTitle
                        ? ` · Affected Song: "${selectedNotification.trackTitle}"`
                        : ''}
                    </p>
                  </div>
                )}

                {selectedNotification.type === 'moderation_report' && (
                  <div className="p-4 sm:p-5 rounded-xl bg-[#08080C]/80 border border-[#F59E0B]/30 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#F59E0B]">
                        Report Status: {selectedNotification.metadata?.reportStatus || 'Pending Review'}
                      </span>
                      {typeof selectedNotification.metadata?.riskScore === 'number' && (
                        <span className="font-mono-tech text-[#958ea0] tabular-nums">
                          Review Priority Index: {selectedNotification.metadata.riskScore}/100
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#cbc3d7] leading-relaxed">
                      Claimant: {selectedNotification.metadata?.claimant || selectedNotification.actorName || 'Community Reviewer'}
                      {selectedNotification.trackTitle
                        ? ` · Track: "${selectedNotification.trackTitle}"`
                        : ''}
                    </p>
                  </div>
                )}

                {/* Linked Track Preview Card (when track still exists in catalog) */}
                {selectedNotification.trackId && (
                  linkedTrack ? (
                    <div className="p-4 rounded-xl bg-[#08080C]/75 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-[#8B5CF6]/30 to-[#06B6D4]/30 border border-white/10 shrink-0 flex items-center justify-center">
                          {brokenCoverIds[linkedTrack.id] ? (
                            <Music2 className="w-6 h-6 text-[#06B6D4]" />
                          ) : (
                            <img
                              src={linkedTrack.coverArt}
                              alt={linkedTrack.title}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenCoverIds((prev) => ({
                                  ...prev,
                                  [linkedTrack.id]: true,
                                }))
                              }
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="font-display font-semibold text-sm sm:text-base text-white truncate">
                            {linkedTrack.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#958ea0]">
                            <span className="text-[#cbc3d7]">{linkedTrack.creator}</span>
                            <span aria-hidden="true">·</span>
                            <span>{linkedTrack.genre}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tech tabular-nums">
                              {linkedTrack.bpm} BPM
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tech tabular-nums">
                              {linkedTrack.plays.toLocaleString()} plays
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tech tabular-nums">
                              {linkedTrack.downloads.toLocaleString()} downloads
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayOrPauseTrack(linkedTrack)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                      >
                        {isLinkedTrackPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Play Song</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#08080C]/60 border border-white/10 text-xs text-[#958ea0]">
                      Referenced track ({selectedNotification.trackTitle || selectedNotification.trackId}) is no longer active in the public catalog.
                    </div>
                  )
                )}

                {/* Necessary Actions Section (Tailored strictly to Message Type) */}
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <span className="text-xs font-semibold text-white block">
                    Necessary Actions
                  </span>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* TAKEDOWN ACTIONS */}
                    {selectedNotification.type === 'takedown' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelectTab('upload')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold transition-all whitespace-nowrap shrink-0"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Upload Revised Track</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectTab('creator-dashboard')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <ShieldCheck className="w-4 h-4 text-[#06B6D4]" />
                          <span>View Creator Analytics</span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onSelectTab('admin')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 border border-[#EF4444]/35 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
                            <span>Open Admin Dashboard</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* MODERATION REPORT ACTIONS */}
                    {selectedNotification.type === 'moderation_report' && (
                      <>
                        {isAdmin &&
                          selectedNotification.reportId &&
                          (selectedNotification.metadata?.reportStatus === 'Pending Review' ||
                            selectedNotification.metadata?.reportStatus === 'Investigating') && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onResolveReport(selectedNotification.reportId!, 'Resolved');
                                  triggerToast('Report marked as Resolved.');
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Mark Resolved</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onResolveReport(selectedNotification.reportId!, 'Dismissed');
                                  triggerToast('Report dismissed.');
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="w-4 h-4 text-[#958ea0]" />
                                <span>Dismiss Report</span>
                              </button>
                            </>
                          )}
                        {linkedTrack && (
                          <button
                            type="button"
                            onClick={() => onOpenTrackDetails(linkedTrack, false)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            <Eye className="w-4 h-4 text-[#06B6D4]" />
                            <span>Inspect Song Details</span>
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onSelectTab('admin')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                          >
                            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
                            <span>Open Moderation Queue</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* TRACK MILESTONE ACTIONS */}
                    {selectedNotification.type === 'track_milestone' && (
                      <>
                        {linkedTrack && (
                          <button
                            type="button"
                            onClick={() => onOpenTrackDetails(linkedTrack, false)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            <Share2 className="w-4 h-4 text-[#06B6D4]" />
                            <span>Open Track &amp; Share Link</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectTab('creator-dashboard')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <Download className="w-4 h-4 text-[#10B981]" />
                          <span>View Creator Analytics</span>
                        </button>
                      </>
                    )}

                    {/* TRACK LIKED / COMMUNITY ACTIVITY ACTIONS */}
                    {selectedNotification.type === 'track_liked' && (
                      <>
                        {linkedTrack && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onLikeTrack(linkedTrack.id);
                                triggerToast(
                                  linkedTrack.isLiked
                                    ? `Removed like from "${linkedTrack.title}".`
                                    : `Liked "${linkedTrack.title}".`
                                );
                              }}
                              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                linkedTrack.isLiked
                                  ? 'bg-[#EF4444]/15 border-[#EF4444]/40 text-[#fca5a5]'
                                  : 'bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border-[#8B5CF6]/40 text-white'
                              }`}
                            >
                              <Heart className="w-4 h-4" />
                              <span>{linkedTrack.isLiked ? 'Liked Track' : 'Like Track'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenTrackDetails(linkedTrack, false)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                            >
                              <Eye className="w-4 h-4 text-[#06B6D4]" />
                              <span>Open Dossier &amp; Reply</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectTab('community')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <Users className="w-4 h-4 text-[#8B5CF6]" />
                          <span>Open Community Feed</span>
                        </button>
                      </>
                    )}

                    {/* CATEGORY VERIFIED ACTIONS */}
                    {selectedNotification.type === 'category_verified' && (
                      <>
                        {linkedTrack && (
                          <button
                            type="button"
                            onClick={() => onOpenTrackDetails(linkedTrack, canEditLinked)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            {canEditLinked ? (
                              <Edit3 className="w-4 h-4 text-[#06B6D4]" />
                            ) : (
                              <Eye className="w-4 h-4 text-[#06B6D4]" />
                            )}
                            <span>
                              {canEditLinked ? 'Edit Verified Metadata' : 'Inspect 8-Attribute Spec'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectTab('genres')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <Radio className="w-4 h-4 text-[#10B981]" />
                          <span>Browse Genres &amp; Moods</span>
                        </button>
                      </>
                    )}

                    {/* TRACK PUBLISHED ACTIONS */}
                    {selectedNotification.type === 'track_published' && (
                      <>
                        {linkedTrack && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenTrackDetails(linkedTrack, false)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                            >
                              <Share2 className="w-4 h-4 text-[#06B6D4]" />
                              <span>Open &amp; Share Track</span>
                            </button>
                            {canEditLinked && (
                              <button
                                type="button"
                                onClick={() => onOpenTrackDetails(linkedTrack, true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                              >
                                <Edit3 className="w-4 h-4 text-[#06B6D4]" />
                                <span>Edit Song Details</span>
                              </button>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectTab('creator-dashboard')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                          <span>Manage in Creator Studio</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-[#958ea0]">
                Select any notification from the list to view details and available actions.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
