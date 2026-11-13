import React, { useState } from 'react';
import {
  Radio,
  Users,
  Copy,
  Check,
  Play,
  Pause,
  LogOut,
  PlusCircle,
  Hash,
  Share2,
  ShieldCheck,
  RefreshCw,
  Disc3,
  Power,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import type { AudioTrack, ListeningRoom } from '../types/index.ts';
import { formatTime } from '../utils/audioMath.ts';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomSync.ts';

interface RoomsViewProps {
  tracks: AudioTrack[];
  currentTrack: AudioTrack;
  isPlaying: boolean;
  playbackProgress: number;
  activeRoom: ListeningRoom | null;
  roomClientId: string;
  defaultDisplayName: string;
  roomError: string | null;
  roomLoading: boolean;
  isSignedIn: boolean;
  onCreateRoom: (params: {
    name: string;
    track: AudioTrack;
    displayName: string;
    allowGuestControl: boolean;
  }) => Promise<void>;
  onJoinRoom: (code: string, displayName: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onCloseRoom: () => Promise<void>;
  onRoomPlayPause: () => Promise<void>;
  onRoomSeek: (ratio: number) => Promise<void>;
  onRoomSelectTrack: (track: AudioTrack) => Promise<void>;
  onRoomToggleGuestControl: (allow: boolean) => Promise<void>;
  onResyncClock: () => Promise<void>;
  onClearError: () => void;
}

export const RoomsView: React.FC<RoomsViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  playbackProgress,
  activeRoom,
  roomClientId,
  defaultDisplayName,
  roomError,
  roomLoading,
  isSignedIn,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onCloseRoom,
  onRoomPlayPause,
  onRoomSeek,
  onRoomSelectTrack,
  onRoomToggleGuestControl,
  onResyncClock,
  onClearError,
}) => {
  const [roomNameInput, setRoomNameInput] = useState('Haven Shared Session');
  const [selectedStartTrackId, setSelectedStartTrackId] = useState(currentTrack.id);
  const [allowGuestControl, setAllowGuestControl] = useState(true);
  const [hostNameInput, setHostNameInput] = useState(defaultDisplayName);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [guestNameInput, setGuestNameInput] = useState(defaultDisplayName);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const selectedStartTrack = tracks.find((t) => t.id === selectedStartTrackId) || currentTrack;
  const isHost = Boolean(activeRoom && activeRoom.hostId === roomClientId);
  const canControl = Boolean(activeRoom && (isHost || activeRoom.allowGuestControl));

  const copyRoomCode = async () => {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const copyShareUrl = async () => {
    if (!activeRoom) return;
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoom.code}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    await onCreateRoom({
      name: roomNameInput.trim() || `${hostNameInput.trim() || 'Haven'}'s Listening Room`,
      track: selectedStartTrack,
      displayName: hostNameInput.trim() || defaultDisplayName || 'Haven Host',
      allowGuestControl,
    });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    const cleaned = normalizeRoomCode(joinCodeInput);
    if (!isValidRoomCode(cleaned)) return;
    await onJoinRoom(cleaned, guestNameInput.trim() || defaultDisplayName || 'Haven Listener');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-xs font-mono-tech text-[#06B6D4]">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Multi-Device Playback Synchronization · Live Room Codes</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">
            Shared Listening Rooms
          </h1>
          <p className="text-xs sm:text-sm text-[#958ea0] max-w-2xl">
            Listen to the exact same AI-generated song in lockstep across phones, laptops, and friends&apos; browsers using a 6-character Room Code.
          </p>
        </div>

        {activeRoom && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-xs font-mono-tech text-[#10B981]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              Connected · {activeRoom.code}
            </span>
          </div>
        )}
      </div>

      {roomError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{roomError}</span>
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ACTIVE LISTENING ROOM CONSOLE */}
      {activeRoom ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Synced Stage (2 cols) */}
          <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-[#161622]/80 border border-[#06B6D4]/30 backdrop-blur-xl space-y-6 shadow-[0_0_40px_rgba(6,182,212,0.12)]">
            {/* Room Code Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-xl text-white">
                    {activeRoom.name}
                  </h2>
                  <span
                    className={`text-[10px] font-mono-tech px-2 py-0.5 rounded-full border ${
                      isHost
                        ? 'bg-[#8B5CF6]/20 text-[#acedff] border-[#8B5CF6]/40'
                        : 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/40'
                    }`}
                  >
                    {isHost ? 'Room Host' : 'Synced Listener'}
                  </span>
                </div>
                <p className="text-xs text-[#958ea0] mt-0.5">
                  Hosted by <strong className="text-white">{activeRoom.hostName}</strong> ·{' '}
                  {activeRoom.allowGuestControl
                    ? 'All participants can play, pause & switch tracks'
                    : 'Host controls playback for the room'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#08080C] border border-white/15 rounded-2xl p-2 pl-3.5 shrink-0">
                <div className="text-left">
                  <span className="text-[9px] font-mono-tech uppercase tracking-wider text-[#958ea0] block">
                    Room Code
                  </span>
                  <span
                    data-testid="active-room-code"
                    className="font-mono-tech font-bold text-lg tracking-widest text-[#06B6D4]"
                  >
                    {activeRoom.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void copyRoomCode()}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                  title="Copy Room Code"
                  aria-label="Copy Room Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void copyShareUrl()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/40 text-xs font-mono-tech text-white transition-colors"
                  title="Copy Direct Invite Link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Invite Link'}</span>
                </button>
              </div>
            </div>

            {/* Currently Synced Song Card */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-[#08080C]/85 border border-white/10">
              <div className="relative w-28 h-28 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
                <img
                  src={currentTrack.coverArt}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-[#08080C]/80 border border-[#06B6D4]/40 text-[9px] font-mono-tech text-[#06B6D4] flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full space-y-3 text-center sm:text-left">
                <div>
                  <span className="text-[10px] font-mono-tech uppercase tracking-wider text-[#10B981]">
                    Now Synced Across {activeRoom.participants.length}{' '}
                    {activeRoom.participants.length === 1 ? 'Device' : 'Devices'}
                  </span>
                  <h3 className="font-display font-bold text-xl text-white truncate">
                    {currentTrack.title}
                  </h3>
                  <p className="text-xs text-[#958ea0]">
                    {currentTrack.creator} · {currentTrack.genre} · {currentTrack.bpm} BPM
                  </p>
                </div>

                {/* Room Scrubber */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={Math.round(playbackProgress * 1000)}
                    disabled={!canControl}
                    onChange={(e) => void onRoomSeek(Number(e.target.value) / 1000)}
                    aria-label="Room Playback Position"
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#06B6D4] disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] font-mono-tech text-[#958ea0]">
                    <span>{formatTime(currentTrack.duration * playbackProgress)}</span>
                    <span>{formatTime(currentTrack.duration)}</span>
                  </div>
                </div>

                {/* Room Controls */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    disabled={!canControl}
                    onClick={() => void onRoomPlayPause()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>{isPlaying ? 'Pause for All Devices' : 'Play for All Devices'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void onResyncClock()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Re-Sync Clock</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Switch Track for Everyone in Room */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono-tech uppercase tracking-wider text-[#958ea0] flex items-center gap-1.5">
                  <Disc3 className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>Change Synced Song</span>
                </label>
                {!canControl && (
                  <span className="text-[10px] font-mono-tech text-amber-300">
                    Host-only control mode
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {tracks.slice(0, 14).map((t) => {
                  const isCurrent = t.id === currentTrack.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!canControl}
                      onClick={() => void onRoomSelectTrack(t)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                        isCurrent
                          ? 'bg-[#8B5CF6]/20 border-[#06B6D4]/60 text-white'
                          : 'bg-[#08080C]/70 border-white/5 hover:border-white/15 text-[#cbc3d7]'
                      }`}
                    >
                      <img src={t.coverArt} alt={t.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold truncate block text-white">{t.title}</span>
                        <span className="text-[10px] font-mono-tech text-[#958ea0] truncate block">
                          {t.creator} · {t.genre}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] font-mono-tech px-1.5 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] shrink-0">
                          Synced
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Participants & Room Controls */}
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-[#161622]/70 border border-white/10 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="font-display font-semibold text-sm text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#06B6D4]" />
                  <span>Connected Devices ({activeRoom.participants.length})</span>
                </span>
                {isSignedIn && (
                  <span className="text-[10px] font-mono-tech text-[#10B981] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Cloud Sync
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeRoom.participants.map((p) => (
                  <div
                    key={p.clientId}
                    className="p-2.5 rounded-xl bg-[#08080C]/80 border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
                      <span className="text-xs text-white truncate">
                        {p.displayName}
                        {p.clientId === roomClientId ? ' (You)' : ''}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono-tech px-2 py-0.5 rounded-full shrink-0 ${
                        p.isHost
                          ? 'bg-[#8B5CF6]/20 text-[#acedff] border border-[#8B5CF6]/30'
                          : 'bg-white/5 text-[#958ea0]'
                      }`}
                    >
                      {p.isHost ? 'Host' : 'Device'}
                    </span>
                  </div>
                ))}
              </div>

              {isHost && (
                <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#08080C] border border-white/10 cursor-pointer text-xs">
                  <span className="text-[#e4e1e8]">Allow Guests to Control Playback</span>
                  <input
                    type="checkbox"
                    checked={activeRoom.allowGuestControl}
                    onChange={(e) => void onRoomToggleGuestControl(e.target.checked)}
                    className="accent-[#06B6D4] w-4 h-4"
                  />
                </label>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => void onLeaveRoom()}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-tech text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Room on This Device</span>
                </button>

                {isHost && (
                  <button
                    type="button"
                    onClick={() => void onCloseRoom()}
                    className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-mono-tech text-red-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>End Room for All Devices</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CREATE OR JOIN ROOM CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Create Listening Room */}
          <form
            onSubmit={(e) => void handleCreateSubmit(e)}
            className="p-6 sm:p-8 rounded-3xl bg-[#161622]/75 border border-white/10 backdrop-blur-xl space-y-5 shadow-[0_0_30px_rgba(139,92,246,0.1)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#8B5CF6]/30 to-[#06B6D4]/30 border border-[#8B5CF6]/40 flex items-center justify-center text-[#06B6D4]">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-white">Create Listening Room</h2>
                <p className="text-xs text-[#958ea0]">Generate a room code to sync playback across devices</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Late Night Synthwave Session"
                  className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Your Host Display Name
                </label>
                <input
                  type="text"
                  value={hostNameInput}
                  onChange={(e) => setHostNameInput(e.target.value)}
                  maxLength={60}
                  placeholder="Your name"
                  className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                  Initial Song to Sync
                </label>
                <select
                  value={selectedStartTrack.id}
                  onChange={(e) => setSelectedStartTrackId(e.target.value)}
                  className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                >
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} — {t.creator} ({t.genre})
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#08080C]/80 border border-white/10 cursor-pointer text-xs">
                <span className="text-[#cbc3d7]">Allow joined devices to play, pause &amp; switch songs</span>
                <input
                  type="checkbox"
                  checked={allowGuestControl}
                  onChange={(e) => setAllowGuestControl(e.target.checked)}
                  className="accent-[#06B6D4] w-4 h-4"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={roomLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs font-semibold shadow-lg hover:shadow-[0_0_24px_rgba(139,92,246,0.45)] transition-all disabled:opacity-60"
            >
              {roomLoading ? 'Creating Room...' : 'Create Room & Generate Code'}
            </button>
          </form>

          {/* Card 2: Join Room by Code */}
          <form
            onSubmit={(e) => void handleJoinSubmit(e)}
            className="p-6 sm:p-8 rounded-3xl bg-[#161622]/75 border border-white/10 backdrop-blur-xl space-y-5 flex flex-col justify-between"
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#06B6D4]/20 border border-[#06B6D4]/40 flex items-center justify-center text-[#06B6D4]">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-white">Join Room with Code</h2>
                  <p className="text-xs text-[#958ea0]">Enter a 6-character code shared from another device or user</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                    Room Code *
                  </label>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                    maxLength={8}
                    placeholder="e.g. HVN482"
                    className="w-full bg-[#08080C] font-mono-tech font-bold text-lg tracking-widest uppercase text-[#06B6D4] p-3.5 rounded-xl border border-white/15 focus:border-[#06B6D4] focus:outline-none text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono-tech text-[#958ea0] uppercase tracking-wider block">
                    Your Device / Listener Name
                  </label>
                  <input
                    type="text"
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. Living Room iPad"
                    className="w-full bg-[#08080C] text-xs text-white p-3 rounded-xl border border-white/10 focus:border-[#06B6D4] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={roomLoading || !isValidRoomCode(normalizeRoomCode(joinCodeInput))}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-[#06B6D4]/25 border border-white/15 hover:border-[#06B6D4]/50 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {roomLoading ? 'Joining Room...' : 'Join Synced Listening Room'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
