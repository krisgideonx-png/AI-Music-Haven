import React, { useEffect, useRef, useState } from 'react';
import type { AudioTrack } from '../types/index.ts';
import { audioEngine } from '../utils/audioEngine.ts';
import {
  clampBpm,
  computeDancerPose,
  computeVisualizerBars,
  type DancerPose,
} from '../utils/beatDance.ts';

interface WaveformBeatDancerProps {
  track: AudioTrack;
  isPlaying: boolean;
  playbackProgress: number;
  variant?: 'compact' | 'full';
  onSeek?: (ratio: number) => void;
}

const COMPACT_BAR_COUNT = 24;
const FULL_BAR_COUNT = 44;

export const WaveformBeatDancer: React.FC<WaveformBeatDancerProps> = ({
  track,
  isPlaying,
  playbackProgress,
  variant = 'full',
  onSeek,
}) => {
  const barCount = variant === 'compact' ? COMPACT_BAR_COUNT : FULL_BAR_COUNT;
  const safeBpm = clampBpm(track.bpm);

  const [frameState, setFrameState] = useState<{
    bars: number[];
    pose: DancerPose;
  }>(() => {
    const initialTime = (track.duration || 180) * playbackProgress;
    return {
      bars: computeVisualizerBars(track.waveform, playbackProgress, initialTime, safeBpm, isPlaying, null, barCount),
      pose: computeDancerPose(initialTime, safeBpm, isPlaying, 0),
    };
  });

  const binsRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animStartRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const progressRef = useRef<number>(playbackProgress);
  progressRef.current = playbackProgress;

  useEffect(() => {
    if (!binsRef.current && typeof Uint8Array !== 'undefined') {
      binsRef.current = new Uint8Array(128);
    }

    if (!isPlaying) {
      const staticTime = (track.duration || 180) * progressRef.current;
      setFrameState({
        bars: computeVisualizerBars(track.waveform, progressRef.current, staticTime, safeBpm, false, null, barCount),
        pose: computeDancerPose(staticTime, safeBpm, false, 0),
      });
      return;
    }

    animStartRef.current = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const engineClock = audioEngine.getPlaybackClockSeconds();
      const elapsedFallback = (now - animStartRef.current) / 1000;
      const clockSec = engineClock > 0.01 ? engineClock : (track.duration || 180) * progressRef.current + elapsedFallback;

      const bins = binsRef.current;
      const energy = bins ? audioEngine.sampleFrequencyBins(bins) : 0;

      setFrameState({
        bars: computeVisualizerBars(track.waveform, progressRef.current, clockSec, safeBpm, true, bins, barCount),
        pose: computeDancerPose(clockSec, safeBpm, true, energy),
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, track.id, track.waveform, track.duration, safeBpm, barCount]);

  const { bars, pose } = frameState;

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio);
  };

  const renderTinyPerson = (sizeClass: string) => (
    <div
      data-testid={variant === 'compact' ? 'tiny-beat-dancer-compact' : 'tiny-beat-dancer'}
      className={`relative flex items-center justify-center shrink-0 ${sizeClass}`}
      title={isPlaying ? `Dancing to ${Math.round(safeBpm)} BPM beat` : `Ready to groove (${Math.round(safeBpm)} BPM)`}
    >
      {/* Beat Glow Ring beneath feet */}
      <div
        className="absolute bottom-1 w-9 h-2 rounded-full blur-[2px] transition-opacity duration-75"
        style={{
          background: isPlaying
            ? 'radial-gradient(circle, rgba(6,182,212,0.85) 0%, rgba(139,92,246,0) 75%)'
            : 'radial-gradient(circle, rgba(149,142,160,0.35) 0%, rgba(149,142,160,0) 75%)',
          transform: `scale(${1 + pose.pulseIntensity * 0.45})`,
          opacity: isPlaying ? 0.55 + pose.pulseIntensity * 0.45 : 0.3,
        }}
      />

      <svg
        viewBox="0 0 64 72"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <g transform={`translate(${32 + pose.hipOffsetX}, ${38 + pose.bounceY}) rotate(${pose.torsoLeanDeg})`}>
          {/* Left Arm */}
          <g transform={`translate(-7, -8) rotate(${pose.leftArmDeg})`}>
            <line
              x1="0"
              y1="0"
              x2="-8"
              y2="13"
              stroke="#06B6D4"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <circle cx="-8" cy="14" r="2.6" fill="#FDE68A" />
          </g>

          {/* Right Arm */}
          <g transform={`translate(7, -8) rotate(${pose.rightArmDeg})`}>
            <line
              x1="0"
              y1="0"
              x2="8"
              y2="13"
              stroke="#8B5CF6"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <circle cx="8" cy="14" r="2.6" fill="#FDE68A" />
          </g>

          {/* Left Leg & Sneaker */}
          <g transform={`translate(-4, 7) rotate(${pose.leftLegDeg})`}>
            <line
              x1="0"
              y1="0"
              x2="-3"
              y2="15"
              stroke="#e4e1e8"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
            <ellipse cx="-4.5" cy="17" rx="4" ry="2.3" fill="#06B6D4" />
          </g>

          {/* Right Leg & Sneaker */}
          <g transform={`translate(4, 7) rotate(${pose.rightLegDeg})`}>
            <line
              x1="0"
              y1="0"
              x2="3"
              y2="15"
              stroke="#e4e1e8"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
            <ellipse cx="4.5" cy="17" rx="4" ry="2.3" fill="#8B5CF6" />
          </g>

          {/* Torso Hoodie */}
          <rect
            x="-8"
            y="-10"
            width="16"
            height="19"
            rx="6"
            fill="#8B5CF6"
            stroke="#acedff"
            strokeWidth="1.2"
          />
          <line x1="0" y1="-5" x2="0" y2="6" stroke="#06B6D4" strokeWidth="1.4" strokeLinecap="round" />

          {/* Head + Glowing Headphones */}
          <g transform={`translate(0, -19) rotate(${pose.headTiltDeg})`}>
            {/* Headphone Band */}
            <path
              d="M -9 0 A 9 9 0 0 1 9 0"
              fill="none"
              stroke="#06B6D4"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* Head */}
            <circle cx="0" cy="1" r="7.5" fill="#FDE68A" />
            {/* Earcups */}
            <rect x="-10" y="-2" width="3.5" height="6" rx="1.6" fill="#06B6D4" />
            <rect x="6.5" y="-2" width="3.5" height="6" rx="1.6" fill="#06B6D4" />
            {/* Expressive Eyes */}
            <circle cx="-2.4" cy="0.5" r="1" fill="#08080C" />
            <circle cx="2.4" cy="0.5" r="1" fill="#08080C" />
            {/* Beat Smile */}
            <path
              d={isPlaying ? 'M -2.5 3.2 Q 0 5.5 2.5 3.2' : 'M -2 3.5 Q 0 4.3 2 3.5'}
              fill="none"
              stroke="#08080C"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );

  if (variant === 'compact') {
    return (
      <div
        data-testid="waveform-beat-dancer-compact"
        className="hidden lg:flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-[#161622]/90 border border-white/10 shrink-0"
      >
        {renderTinyPerson('w-9 h-10')}
        <div
          className="flex items-end gap-[2px] h-8 w-24 cursor-pointer"
          onClick={handleWaveformClick}
          title={`${Math.round(safeBpm)} BPM Live Waveform Visualizer`}
        >
          {bars.map((amp, idx) => {
            const isPast = idx / bars.length <= playbackProgress;
            return (
              <span
                key={idx}
                className="flex-1 rounded-full transition-[height] duration-75"
                style={{
                  height: `${Math.round(amp * 100)}%`,
                  background: isPast
                    ? 'linear-gradient(to top, #8B5CF6, #06B6D4)'
                    : isPlaying
                    ? 'rgba(255,255,255,0.28)'
                    : 'rgba(255,255,255,0.16)',
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="waveform-beat-dancer-full"
      className="p-4 rounded-2xl bg-[#161622]/85 border border-white/10 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tech">
        <span className="text-[#06B6D4] flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isPlaying ? 'bg-[#10B981] animate-ping' : 'bg-[#958ea0]'
            }`}
          />
          <span className="truncate">
            {isPlaying ? 'Live Waveform' : 'Waveform Visualizer'}
            <span className="hidden sm:inline">
              {isPlaying ? ' Visualizer · Beat Sync Active' : ' (Paused)'}
            </span>
          </span>
        </span>
        <span className="text-[#958ea0] whitespace-nowrap shrink-0">
          {Math.round(safeBpm)} BPM · {track.lufs} LUFS
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Tiny Beat Dancer Stage */}
        <div className="px-2 py-1 rounded-xl bg-[#08080C] border border-white/10 flex flex-col items-center justify-center shrink-0">
          {renderTinyPerson('w-12 h-14')}
          <span className="text-[9px] font-mono-tech text-[#958ea0] -mt-0.5">
            {isPlaying ? 'GROOVING' : 'IDLE'}
          </span>
        </div>

        {/* Interactive Waveform Bars */}
        <div
          onClick={handleWaveformClick}
          role={onSeek ? 'slider' : undefined}
          aria-label={onSeek ? 'Seek track waveform' : undefined}
          aria-valuenow={onSeek ? Math.round(playbackProgress * 100) : undefined}
          className={`flex-1 h-16 px-3 py-2 rounded-xl bg-[#08080C] border border-white/10 flex items-center gap-[3px] overflow-hidden ${
            onSeek ? 'cursor-pointer' : ''
          }`}
        >
          {bars.map((amp, idx) => {
            const isPast = idx / bars.length <= playbackProgress;
            return (
              <span
                key={idx}
                className="flex-1 rounded-full transition-[height] duration-75"
                style={{
                  height: `${Math.max(14, Math.round(amp * 100))}%`,
                  background: isPast
                    ? 'linear-gradient(to top, #8B5CF6, #06B6D4, #10B981)'
                    : isPlaying
                    ? 'rgba(139, 92, 246, 0.35)'
                    : 'rgba(255, 255, 255, 0.16)',
                  boxShadow:
                    isPast && isPlaying ? '0 0 8px rgba(6, 182, 212, 0.45)' : 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
