import React, { useRef, useEffect, useState } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Activity, 
  Play, 
  Pause, 
  Sliders, 
  Zap, 
  Waves,
  Disc
} from 'lucide-react';
import { audioEngine } from '../utils/audioEngine.ts';
import type { AudioTrack } from '../types/index.ts';

interface SpectralVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

type VisualizerMode = 'fft-glow' | 'waterfall' | 'oscilloscope';

export const SpectralVisualizerModal: React.FC<SpectralVisualizerModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  onTogglePlay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VisualizerMode>('fft-glow');
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [bandValues, setBandValues] = useState<{
    sub: number;
    bass: number;
    lowMid: number;
    highMid: number;
    presence: number;
    brilliance: number;
  }>({
    sub: 0,
    bass: 0,
    lowMid: 0,
    highMid: 0,
    presence: 0,
    brilliance: 0,
  });

  // Waterfall buffer
  const waterfallHistoryRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    let frameCount = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Buffer for analyser
    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);
    const timeArray = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);
      frameCount += 1;
      const analyser = audioEngine.getAnalyser();

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(timeArray);
      } else {
        // Fallback gentle idle waveform when paused
        const t = Date.now() * 0.003;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.max(0, Math.sin(i * 0.1 + t) * 40 + Math.cos(i * 0.05 - t) * 30 + 35);
          timeArray[i] = 128 + Math.sin(i * 0.2 + t) * 20;
        }
      }

      // Compute telemetry bands (~10Hz to avoid excessive React state churn)
      if (frameCount % 6 === 0) {
        const sub = Math.round((dataArray[1] + dataArray[2]) / 2);
        const bass = Math.round((dataArray[4] + dataArray[6]) / 2);
        const lowMid = Math.round((dataArray[10] + dataArray[14]) / 2);
        const highMid = Math.round((dataArray[25] + dataArray[35]) / 2);
        const presence = Math.round((dataArray[50] + dataArray[65]) / 2);
        const brilliance = Math.round((dataArray[85] + dataArray[110]) / 2);
        setBandValues({ sub, bass, lowMid, highMid, presence, brilliance });
      }

      // Resize canvas to display size
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background obsidian gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width / 1.5);
      bgGrad.addColorStop(0, '#131317');
      bgGrad.addColorStop(1, '#08080C');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let x = 0; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (mode === 'fft-glow') {
        // Multi-band Luminescent FFT Bars
        const barCount = 48;
        const barWidth = (width / barCount) - 3;
        const step = Math.floor(bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
          const val = (dataArray[i * step] / 255) * sensitivity;
          const barHeight = Math.max(4, val * (height * 0.75));
          const x = i * (barWidth + 3) + 1.5;
          const y = height - barHeight - 20;

          // Gradient from Electric Violet to Cyan
          const grad = ctx.createLinearGradient(x, y, x, height);
          grad.addColorStop(0, '#06B6D4'); // Cyan top
          grad.addColorStop(0.4, '#8B5CF6'); // Electric violet
          grad.addColorStop(1, 'rgba(139, 92, 246, 0.1)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          // Luminescent peak dot
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, y - 4, Math.max(1, barWidth / 4), 0, Math.PI * 2);
          ctx.fill();

          // Soft ground reflection
          ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
          ctx.fillRect(x, height - 16, barWidth, barHeight * 0.15);
        }
      } else if (mode === 'oscilloscope') {
        // High Precision Laser Oscilloscope
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#06B6D4';
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeArray[i] / 128.0;
          const y = (v * (height / 2));

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Secondary harmonic trace in Electric Violet
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#8B5CF6';
        ctx.shadowColor = '#8B5CF6';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = (timeArray[i] / 128.0) * 0.8 + 0.1;
          const y = (v * (height / 2)) + Math.sin(i * 0.1) * 10;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'waterfall') {
        // Waterfall Spectrograph History
        const snapshot = new Uint8Array(dataArray);
        waterfallHistoryRef.current.unshift(snapshot);
        if (waterfallHistoryRef.current.length > 50) {
          waterfallHistoryRef.current.pop();
        }

        const history = waterfallHistoryRef.current;
        const rowHeight = height / 50;

        for (let r = 0; r < history.length; r++) {
          const rowData = history[r];
          const y = r * rowHeight;
          const colWidth = width / 40;

          for (let c = 0; c < 40; c++) {
            const rawVal = rowData[c * 2] || 0;
            const norm = (rawVal / 255);
            if (norm > 0.05) {
              const x = c * colWidth;
              // Color mapping: low is violet, mid is cyan, high is amber/white
              let fill = `rgba(139, 92, 246, ${norm * 0.6})`;
              if (norm > 0.6) fill = `rgba(6, 182, 212, ${norm * 0.8})`;
              if (norm > 0.85) fill = `rgba(245, 158, 11, ${norm})`;

              ctx.fillStyle = fill;
              ctx.fillRect(x, y, colWidth, rowHeight);
            }
          }
        }
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, mode, sensitivity, isPlaying]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-[#08080C]/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        className={`w-full bg-[#161622] border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(139,92,246,0.2)] flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'h-full max-w-full' : 'max-w-5xl h-[700px]'
        }`}
      >
        {/* Top Modal Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#0F0F16]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">
                Spectral Acoustic Luminescence
              </h2>
              <span className="font-mono-tech text-[10px] text-[#06B6D4]">
                Real-Time 256-Point FFT / Phase Spectrogram
              </span>
            </div>
          </div>

          {/* Mode Switchers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#08080C] p-1 rounded-xl border border-white/5">
              {[
                { id: 'fft-glow' as VisualizerMode, label: 'Luminescence' },
                { id: 'oscilloscope' as VisualizerMode, label: 'Oscilloscope' },
                { id: 'waterfall' as VisualizerMode, label: 'Waterfall' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono-tech transition-all ${
                    mode === m.id
                      ? 'bg-[#161622] text-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.3)] font-semibold'
                      : 'text-[#958ea0] hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label="Toggle Fullscreen"
              className="p-2 rounded-xl text-[#958ea0] hover:text-white hover:bg-white/5 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              aria-label="Close Spectral Visualizer"
              className="p-2 rounded-xl text-[#958ea0] hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Central Canvas Render Area */}
        <div className="flex-1 relative bg-[#08080C] overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={1000}
            height={500}
            className="w-full h-full object-contain"
          />

          {/* Overlaid Live Frequency Bands Readout */}
          <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-3 bg-[#0F0F16]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-[11px] font-mono-tech">
              <span className="text-[#958ea0]">Track:</span>
              <span className="text-white font-medium">{currentTrack?.title || 'Synthesis Master'}</span>
              <span className="text-white/20">·</span>
              <span className="text-[#06B6D4]">{currentTrack?.bpm || 128} BPM</span>
            </div>

            <div className="flex items-center gap-2 bg-[#0F0F16]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-[10px] font-mono-tech">
              <span className="text-[#8B5CF6]">SUB: {bandValues.sub}</span>
              <span className="text-white/20">/</span>
              <span className="text-[#06B6D4]">BASS: {bandValues.bass}</span>
              <span className="text-white/20">/</span>
              <span className="text-[#10B981]">MID: {bandValues.lowMid}</span>
              <span className="text-white/20">/</span>
              <span className="text-[#F59E0B]">HI: {bandValues.brilliance}</span>
            </div>
          </div>
        </div>

        {/* Bottom Controls Bar */}
        <div className="h-20 px-6 border-t border-white/10 bg-[#0F0F16] flex items-center justify-between gap-4">
          {/* Play/Pause Inline */}
          <div className="flex items-center gap-3">
            <button
              onClick={onTogglePlay}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white font-display text-xs font-semibold flex items-center gap-2 shadow-[0_0_14px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all active:scale-95"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              <span>{isPlaying ? 'Pause Audio' : 'Play Audio'}</span>
            </button>
            <span className="text-xs font-mono-tech text-[#958ea0]">
              {isPlaying ? 'Web Audio Real-Time FFT Active' : 'Playback Idle'}
            </span>
          </div>

          {/* Sensitivity Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono-tech text-[#958ea0]">FFT Sensitivity</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              aria-label="FFT Visualizer Sensitivity"
              className="w-28 h-1 bg-[#08080C] rounded-lg appearance-none cursor-pointer"
            />
            <span className="font-mono-tech text-xs text-[#06B6D4] w-8">
              {sensitivity.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
