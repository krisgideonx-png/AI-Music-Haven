import React, { useState, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Shuffle, 
  Activity, 
  Heart, 
  ListMusic, 
  X,
  Moon,
  Radio,
} from 'lucide-react';
import type { AudioTrack, SleepTimerMode, SleepTimerState } from '../types/index.ts';
import { formatTime } from '../utils/audioMath.ts';
import {
  SLEEP_TIMER_PRESETS_MINUTES,
  formatSleepCountdown,
  clampSleepMinutes,
} from '../utils/sleepTimer.ts';
import { WaveformBeatDancer } from './WaveformBeatDancer.tsx';

interface MasterPlayerProps {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  playbackProgress: number; // 0 to 1
  onSeek: (ratio: number) => void;
  masterVolume: number;
  onChangeVolume: (val: number) => void;
  onOpenSpectralModal: () => void;
  onLikeTrack: (trackId: string) => void;
  queue: AudioTrack[];
  onSelectTrack: (track: AudioTrack) => void;
  onOpenTrackDetails?: (track: AudioTrack) => void;
  sleepTimer: SleepTimerState;
  onSetSleepTimer: (mode: SleepTimerMode, minutes?: number) => void;
  activeRoomCode?: string | null;
  onOpenRooms?: () => void;
}

export const MasterPlayer: React.FC<MasterPlayerProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  playbackProgress,
  onSeek,
  masterVolume,
  onChangeVolume,
  onOpenSpectralModal,
  onLikeTrack,
  queue,
  onSelectTrack,
  onOpenTrackDetails,
  sleepTimer,
  onSetSleepTimer,
  activeRoomCode = null,
  onOpenRooms,
}) => {
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showQueue, setShowQueue] = useState<boolean>(false);
  const [showSleepMenu, setShowSleepMenu] = useState<boolean>(false);
  const [customSleepMinutes, setCustomSleepMinutes] = useState<string>('20');
  const scrubberRef = useRef<HTMLDivElement>(null);

  const prevVolumeRef = useRef<number>(masterVolume);

  const handleMuteToggle = () => {
    if (isMuted) {
      onChangeVolume(prevVolumeRef.current || 0.8);
      setIsMuted(false);
    } else {
      prevVolumeRef.current = masterVolume;
      onChangeVolume(0);
      setIsMuted(true);
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio);
  };

  if (!currentTrack) {
    return (
      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#0F0F16]/95 backdrop-blur-2xl border-t border-white/5 z-40 flex items-center justify-center px-4">
        <span className="text-xs font-mono-tech text-[#958ea0]">
          Select any track from AI Music Haven to begin listening.
        </span>
      </footer>
    );
  }

  const currentSeconds = currentTrack.duration * playbackProgress;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 z-40 bg-[#08080C]/95 backdrop-blur-2xl select-none border-t border-white/5">
      {/* Hairline gradient accent line + mobile track progress fill */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981] transition-[width] duration-150"
          style={{ width: `${Math.max(2, playbackProgress * 100)}%` }}
        />
      </div>

      <div className="h-full max-w-[1920px] mx-auto px-2.5 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Artwork, Title, Creator, Like Button */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none sm:w-1/4 sm:min-w-[170px] sm:max-w-[340px]">
          <div
            onClick={() => onOpenTrackDetails && onOpenTrackDetails(currentTrack)}
            className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-[0_0_12px_rgba(139,92,246,0.25)] group cursor-pointer"
          >
            <img
              src={currentTrack.coverArt}
              alt={currentTrack.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-[#08080C]/40 flex items-center justify-center">
                <span className="flex gap-0.5 items-end h-3">
                  <span className="w-1 bg-[#06B6D4] h-full animate-pulse" />
                  <span className="w-1 bg-[#8B5CF6] h-2/3 animate-pulse delay-75" />
                  <span className="w-1 bg-[#06B6D4] h-4/5 animate-pulse delay-150" />
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span
              onClick={() => onOpenTrackDetails && onOpenTrackDetails(currentTrack)}
              className="font-display font-medium text-xs sm:text-sm text-white truncate hover:text-[#06B6D4] cursor-pointer transition-colors"
            >
              {currentTrack.title}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono-tech text-[#958ea0] truncate">
              <span className="truncate">{currentTrack.creator}</span>
              <span className="text-white/20">·</span>
              <span className="text-[#06B6D4] truncate font-sans">{currentTrack.genre}</span>
              <span className="hidden xl:inline text-white/20">·</span>
              <span
                className="hidden xl:inline text-[9px] text-[#10B981] shrink-0"
                title={`Playback loudness normalized from ${currentTrack.lufs} LUFS to -14.0 LUFS`}
              >
                -14 LUFS Norm
              </span>
            </div>
          </div>

          <button
            onClick={() => onLikeTrack(currentTrack.id)}
            className={`p-1.5 rounded-lg transition-colors hidden sm:block ${
              currentTrack.isLiked ? 'text-[#8B5CF6]' : 'text-[#958ea0] hover:text-white'
            }`}
            title="Like this song"
          >
            <Heart className={`w-4 h-4 ${currentTrack.isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center: Playback Controls & Scrubber */}
        <div className="flex flex-col items-center shrink-0 sm:flex-1 sm:max-w-2xl px-1 sm:px-2">
          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-5 sm:mb-1">
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-1.5 rounded-lg transition-colors hidden sm:block ${
                isShuffle ? 'text-[#06B6D4]' : 'text-[#958ea0] hover:text-white'
              }`}
              title="Shuffle Queue"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onPrevTrack}
              className="p-1.5 rounded-lg text-[#958ea0] hover:text-white transition-colors"
              aria-label="Previous Song"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)] hover:shadow-[0_0_24px_rgba(6,182,212,0.6)] transition-all transform active:scale-95"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>

            <button
              onClick={onNextTrack}
              className="p-1.5 rounded-lg text-[#958ea0] hover:text-white transition-colors"
              aria-label="Next Song"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded-lg transition-colors hidden sm:block ${
                isLooping ? 'text-[#06B6D4]' : 'text-[#958ea0] hover:text-white'
              }`}
              title="Repeat"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timeline Scrubber (hidden on ultra-narrow mobile where top hairline progress bar is active) */}
          <div className="w-full hidden sm:flex items-center gap-2.5">
            <span className="text-[10px] font-mono-tech text-[#958ea0] w-10 text-right tabular-nums">
              {formatTime(currentSeconds)}
            </span>

            <div
              ref={scrubberRef}
              onClick={handleScrubberClick}
              role="slider"
              aria-label="Track Progress"
              aria-valuenow={Math.round(playbackProgress * 100)}
              tabIndex={0}
              className="flex-1 h-5 flex items-center cursor-pointer group relative py-1"
            >
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981] rounded-full"
                  style={{ width: `${playbackProgress * 100}%` }}
                />
              </div>

              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-[#06B6D4] shadow-[0_0_8px_#06B6D4] top-1/2 -translate-y-1/2 -translate-x-1/2 group-hover:scale-125 transition-transform"
                style={{ left: `${playbackProgress * 100}%` }}
              />

              {/* Waveform preview overlay */}
              <div className="absolute inset-0 flex items-center justify-between gap-[2px] opacity-20 pointer-events-none">
                {currentTrack.waveform.slice(0, 48).map((bar, idx) => {
                  const isPast = idx / 48 <= playbackProgress;
                  return (
                    <span
                      key={idx}
                      className={`flex-1 rounded-full ${isPast ? 'bg-[#06B6D4]' : 'bg-white/30'}`}
                      style={{ height: `${Math.max(15, bar * 80)}%` }}
                    />
                  );
                })}
              </div>
            </div>

            <span className="text-[10px] font-mono-tech text-[#958ea0] w-10 tabular-nums">
              {formatTime(currentTrack.duration)}
            </span>
          </div>
        </div>

        {/* Live Waveform Music Visualizer + Tiny Beat Dancer (Compact Dock) */}
        <WaveformBeatDancer
          track={currentTrack}
          isPlaying={isPlaying}
          playbackProgress={playbackProgress}
          variant="compact"
          onSeek={onSeek}
        />

        {/* Right: Room Pill, Sleep Timer, Volume, Visualizer Modal, Queue Drawer Toggle */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 sm:max-w-[380px]">
          {/* Active Room Sync Pill */}
          {activeRoomCode && onOpenRooms && (
            <button
              type="button"
              onClick={onOpenRooms}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 border border-[#06B6D4]/40 text-[10px] font-mono-tech text-[#06B6D4] transition-colors shrink-0"
              title="Open Active Listening Room"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Room · {activeRoomCode}</span>
            </button>
          )}

          {/* Sleep Timer Toggle & Flyout */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSleepMenu(!showSleepMenu);
                setShowQueue(false);
              }}
              className={`flex items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                sleepTimer.mode !== 'off'
                  ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/60 text-[#acedff]'
                  : 'bg-[#161622] border-white/10 text-[#958ea0] hover:text-white'
              }`}
              title="Sleep Timer"
              aria-label={
                sleepTimer.mode === 'countdown'
                  ? `Sleep Timer (${formatSleepCountdown(sleepTimer.remainingSeconds)})`
                  : sleepTimer.mode === 'end_of_track'
                  ? 'Sleep Timer (End of Track)'
                  : 'Sleep Timer'
              }
            >
              <Moon className="w-4 h-4" />
              {sleepTimer.mode === 'countdown' && (
                <span className="text-[10px] font-mono-tech tabular-nums hidden sm:inline">
                  {formatSleepCountdown(sleepTimer.remainingSeconds)}
                </span>
              )}
              {sleepTimer.mode === 'end_of_track' && (
                <span className="text-[10px] font-mono-tech hidden sm:inline">End Track</span>
              )}
            </button>

            {showSleepMenu && (
              <div className="absolute right-0 bottom-full mb-3 w-64 rounded-2xl bg-[#161622] border border-white/10 p-3.5 shadow-2xl z-50 backdrop-blur-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="font-display font-semibold text-xs text-white flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    <span>Sleep Timer</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSleepMenu(false)}
                    className="text-[#958ea0] hover:text-white"
                    aria-label="Close Sleep Timer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {sleepTimer.mode !== 'off' && (
                  <div className="p-2.5 rounded-xl bg-[#08080C] border border-[#8B5CF6]/30 flex items-center justify-between text-xs">
                    <span className="font-mono-tech text-[#acedff]">
                      {sleepTimer.mode === 'countdown'
                        ? `Pausing in ${formatSleepCountdown(sleepTimer.remainingSeconds)}`
                        : 'Pausing after current song'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSetSleepTimer('off');
                        setShowSleepMenu(false);
                      }}
                      className="text-[10px] font-mono-tech text-[#EF4444] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5">
                  {SLEEP_TIMER_PRESETS_MINUTES.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        onSetSleepTimer('countdown', mins);
                        setShowSleepMenu(false);
                      }}
                      className="py-2 rounded-xl bg-white/5 hover:bg-[#8B5CF6]/25 border border-white/10 hover:border-[#8B5CF6]/50 text-xs font-mono-tech text-white transition-colors"
                    >
                      {mins}m
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      onSetSleepTimer('end_of_track');
                      setShowSleepMenu(false);
                    }}
                    className={`py-2 px-1 rounded-xl border text-[10px] font-mono-tech transition-colors ${
                      sleepTimer.mode === 'end_of_track'
                        ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                        : 'bg-white/5 hover:bg-[#06B6D4]/20 border-white/10 text-white'
                    }`}
                  >
                    End Song
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = clampSleepMinutes(Number(customSleepMinutes));
                    onSetSleepTimer('countdown', parsed);
                    setShowSleepMenu(false);
                  }}
                  className="flex items-center gap-1.5 pt-1 border-t border-white/5"
                >
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={customSleepMinutes}
                    onChange={(e) => setCustomSleepMinutes(e.target.value)}
                    aria-label="Custom sleep timer minutes"
                    className="w-16 bg-[#08080C] text-xs text-white px-2.5 py-1.5 rounded-lg border border-white/10 focus:border-[#06B6D4] focus:outline-none font-mono-tech"
                  />
                  <span className="text-[11px] text-[#958ea0] flex-1">min</span>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-[11px] font-semibold"
                  >
                    Set
                  </button>
                </form>

                <p className="text-[10px] text-[#958ea0] leading-snug">
                  Gently fades playback volume over the final 5 seconds before pausing.
                </p>
              </div>
            )}
          </div>

          {/* Visualizer Mode Button */}
          <button
            onClick={onOpenSpectralModal}
            className="p-2 rounded-xl text-[#958ea0] hover:text-[#06B6D4] hover:bg-white/5 transition-colors hidden md:block"
            title="Open Spectral Luminescence Visualizer"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="items-center gap-1.5 hidden sm:flex">
            <button
              onClick={handleMuteToggle}
              className="text-[#958ea0] hover:text-white transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#EF4444]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : masterVolume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-[#161622] rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
              aria-label="Volume"
            />
          </div>

          {/* Queue Drawer Toggle */}
          <div className="relative">
            <button
              onClick={() => {
                setShowQueue(!showQueue);
                setShowSleepMenu(false);
              }}
              className={`p-2 rounded-xl border transition-colors ${
                showQueue
                  ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                  : 'bg-[#161622] border-white/10 text-[#958ea0] hover:text-white'
              }`}
              title="Up Next Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Queue Flyout */}
            {showQueue && (
              <div className="absolute right-0 bottom-full mb-3 w-72 rounded-2xl bg-[#161622] border border-white/10 p-3 shadow-2xl z-50 backdrop-blur-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                  <span className="font-display font-semibold text-xs text-white">Up Next ({queue.length})</span>
                  <button onClick={() => setShowQueue(false)} className="text-[#958ea0] hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {queue.map((qTrack, i) => (
                    <div
                      key={qTrack.id}
                      onClick={() => onSelectTrack(qTrack)}
                      className={`p-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        qTrack.id === currentTrack.id
                          ? 'bg-[#8B5CF6]/20 text-[#06B6D4] font-medium'
                          : 'hover:bg-white/5 text-[#cbc3d7]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={qTrack.coverArt} alt={qTrack.title} className="w-7 h-7 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <span className="truncate block">{qTrack.title}</span>
                          <span className="text-[10px] text-[#958ea0] truncate block">{qTrack.creator}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono-tech text-[#958ea0]">
                        {formatTime(qTrack.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
