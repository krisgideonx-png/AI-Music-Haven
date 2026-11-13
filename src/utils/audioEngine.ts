/**
 * Web Audio API playback & non-destructive loudness normalization engine
 * for AI Music Haven (Neural Acoustic Luminescence).
 * Handles real MP3/WAV/FLAC HTMLAudioElement playback, pitch-variant playback,
 * LUFS-based playback gain normalization, and FFT analyser routing.
 */

import {
  TARGET_PLAYBACK_LUFS,
  calculateLoudnessNormalizationGain,
  calculateLoudnessNormalizationDb,
  resolvePublicAssetUrl,
} from './audioMath.ts';

export {
  TARGET_PLAYBACK_LUFS,
  calculateLoudnessNormalizationGain,
  calculateLoudnessNormalizationDb,
};

export interface StemVoiceConfig {
  id: string;
  name: string;
  color: string;
  baseFreq: number;
  type: OscillatorType;
  filterType: BiquadFilterType;
  filterFreq: number;
}

export const DEFAULT_STEM_VOICES: StemVoiceConfig[] = [
  {
    id: 'vocals',
    name: 'Neural Vocals',
    color: '#F59E0B', // Amber
    baseFreq: 261.63, // C4
    type: 'sawtooth',
    filterType: 'bandpass',
    filterFreq: 1200,
  },
  {
    id: 'drums',
    name: 'Percussion / 808',
    color: '#06B6D4', // Cyan
    baseFreq: 55.0, // A1
    type: 'sine',
    filterType: 'lowpass',
    filterFreq: 400,
  },
  {
    id: 'bass',
    name: 'Sub Bass',
    color: '#8B5CF6', // Electric violet
    baseFreq: 65.41, // C2
    type: 'triangle',
    filterType: 'lowpass',
    filterFreq: 300,
  },
  {
    id: 'synth',
    name: 'Luminescence Pad',
    color: '#22D3EE', // Neon Teal
    baseFreq: 329.63, // E4
    type: 'sawtooth',
    filterType: 'lowpass',
    filterFreq: 2400,
  },
  {
    id: 'glitch',
    name: 'Spectral FX',
    color: '#10B981', // Emerald
    baseFreq: 523.25, // C5
    type: 'square',
    filterType: 'highpass',
    filterFreq: 1800,
  },
];

export interface PlaybackCallbacks {
  onStep?: (step: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  startRatio?: number;
  integratedLufs?: number;
  pitchRate?: number;
}

export interface LoudnessNormalizationResult {
  gain: number;
  gainDb: number;
  targetLufs: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private normalizationGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stemGains: Map<string, GainNode> = new Map();
  private stemOscillators: Map<string, { osc: OscillatorNode; filter: BiquadFilterNode; lfo?: OscillatorNode }> = new Map();
  private isPlaying: boolean = false;
  private stepInterval: ReturnType<typeof setInterval> | null = null;
  private currentStep: number = 0;
  private bpm: number = 124;
  private currentMasterVolume: number = 0.85;
  private currentNormGain: number = 1.0;

  // Real HTMLAudioElement stream path
  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private activeAudioUrl: string | null = null;
  private playbackCallbacks: PlaybackCallbacks | null = null;

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        this.normalizationGain = this.ctx.createGain();
        this.normalizationGain.gain.setValueAtTime(this.currentNormGain, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.currentMasterVolume, this.ctx.currentTime);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.85;

        this.normalizationGain.connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
    }

    if (!this.audioEl && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const el = new Audio();
      el.preload = 'metadata';
      el.crossOrigin = 'anonymous';
      el.addEventListener('timeupdate', () => {
        if (this.isPlaying && this.activeAudioUrl && this.playbackCallbacks?.onTimeUpdate) {
          const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
          this.playbackCallbacks.onTimeUpdate(el.currentTime, dur);
        }
      });
      el.addEventListener('ended', () => {
        if (this.activeAudioUrl && this.playbackCallbacks?.onEnded) {
          this.playbackCallbacks.onEnded();
        }
      });
      this.audioEl = el;

      if (this.ctx && this.normalizationGain && !this.mediaSource) {
        try {
          this.mediaSource = this.ctx.createMediaElementSource(el);
          this.mediaSource.connect(this.normalizationGain);
        } catch {
          // Graceful fallback to direct element volume if MediaElementSource fails
        }
      }
    }
  }

  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public sampleFrequencyBins(target: Uint8Array<ArrayBuffer>): number {
    if (!this.analyser || !this.isPlaying || target.length === 0) {
      target.fill(0);
      return 0;
    }
    this.analyser.getByteFrequencyData(target);
    let sum = 0;
    const sampleCount = Math.min(32, target.length);
    for (let i = 0; i < sampleCount; i++) {
      sum += target[i];
    }
    return Math.max(0, Math.min(1, sum / (sampleCount * 255)));
  }

  public getPlaybackClockSeconds(): number {
    if (this.audioEl && this.activeAudioUrl && Number.isFinite(this.audioEl.currentTime)) {
      return this.audioEl.currentTime;
    }
    return (this.currentStep * (60 / Math.max(60, this.bpm))) / 4;
  }

  /**
   * Automated LUFS loudness normalization helper.
   * Adjusts playback gain non-destructively based on the incoming track's integrated LUFS
   * so all songs across the catalog play at a consistent perceived volume (-14.0 LUFS target).
   */
  public normalizeTrackLoudness(
    integratedLufs?: number,
    targetLufs: number = TARGET_PLAYBACK_LUFS
  ): LoudnessNormalizationResult {
    const gain = calculateLoudnessNormalizationGain(integratedLufs, targetLufs);
    const gainDb = calculateLoudnessNormalizationDb(integratedLufs, targetLufs);
    this.currentNormGain = gain;

    if (this.normalizationGain && this.ctx) {
      this.normalizationGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.03);
    }

    if (this.audioEl && !this.mediaSource) {
      this.audioEl.volume = Math.max(0, Math.min(1, this.currentMasterVolume * gain));
    }

    return { gain, gainDb, targetLufs };
  }

  public getCurrentNormalizationGain(): number {
    return this.currentNormGain;
  }

  public setMasterVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.currentMasterVolume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.03);
    }
    if (this.audioEl && !this.mediaSource) {
      this.audioEl.volume = Math.max(0, Math.min(1, clamped * this.currentNormGain));
    }
  }

  public setStemGain(id: string, gain: number) {
    const node = this.stemGains.get(id);
    if (node && this.ctx) {
      const clamped = Math.max(0, Math.min(1.5, gain));
      node.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.04);
    }
  }

  public setBpm(bpm: number) {
    this.bpm = Math.max(60, Math.min(220, bpm));
  }

  public seekAudio(ratio: number, fallbackDuration: number = 180) {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    if (this.audioEl && this.activeAudioUrl) {
      const targetDur =
        Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0
          ? this.audioEl.duration
          : fallbackDuration;
      if (targetDur > 0) {
        try {
          this.audioEl.currentTime = clampedRatio * targetDur;
        } catch {
          // Ignore seek before metadata loaded
        }
      }
    }
  }

  public isUsingRealAudio(): boolean {
    return Boolean(this.activeAudioUrl);
  }

  private applyPitchVariant(el: HTMLAudioElement, pitchRate?: number) {
    const rate =
      typeof pitchRate === 'number' && Number.isFinite(pitchRate)
        ? Math.max(0.5, Math.min(2.0, pitchRate))
        : 1.0;

    const pitchEl = el as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };

    const preserve = Math.abs(rate - 1.0) < 0.001;
    pitchEl.preservesPitch = preserve;
    pitchEl.mozPreservesPitch = preserve;
    pitchEl.webkitPreservesPitch = preserve;
    el.playbackRate = rate;
  }

  public startPlayback(
    _trackSeed: string,
    audioUrl?: string,
    callbacks?: PlaybackCallbacks
  ) {
    this.init();
    void this.resume();

    this.stopPlayback();
    this.isPlaying = true;
    this.playbackCallbacks = callbacks || null;
    this.currentStep = 0;

    // Automatically normalize playback gain from the track's integrated LUFS
    this.normalizeTrackLoudness(callbacks?.integratedLufs);

    const resolvedAudioUrl = resolvePublicAssetUrl(audioUrl);
    if (resolvedAudioUrl && this.audioEl) {
      const normalizedNextUrl = new URL(resolvedAudioUrl, document.baseURI).href;
      const isSameSource = this.audioEl.src === normalizedNextUrl;
      this.activeAudioUrl = resolvedAudioUrl;

      if (!isSameSource) {
        this.audioEl.src = resolvedAudioUrl;
        this.audioEl.load();
      }

      this.applyPitchVariant(this.audioEl, callbacks?.pitchRate);

      const startRatio = callbacks?.startRatio ?? 0;
      const applyStartOffset = () => {
        if (!this.audioEl) return;
        this.applyPitchVariant(this.audioEl, callbacks?.pitchRate);
        if (startRatio > 0 && Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
          this.audioEl.currentTime = startRatio * this.audioEl.duration;
        }
      };

      if (this.audioEl.readyState >= 1) {
        applyStartOffset();
      } else {
        this.audioEl.addEventListener('loadedmetadata', applyStartOffset, { once: true });
      }

      void this.audioEl.play().catch(() => {
        // Ignore browser autoplay interruption
      });
      return;
    }

    this.activeAudioUrl = null;
    const synthTarget = this.normalizationGain || this.masterGain;
    if (!this.ctx || !synthTarget) return;

    // Fallback Web Audio synthesis if no audioUrl is available
    DEFAULT_STEM_VOICES.forEach((voice) => {
      if (!this.ctx || !synthTarget) return;
      const stemGain = this.ctx.createGain();
      stemGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      stemGain.connect(synthTarget);
      this.stemGains.set(voice.id, stemGain);

      const filter = this.ctx.createBiquadFilter();
      filter.type = voice.filterType;
      filter.frequency.setValueAtTime(voice.filterFreq, this.ctx.currentTime);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);
      filter.connect(stemGain);

      const osc = this.ctx.createOscillator();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(voice.baseFreq, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.5 + Math.random() * 2, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(voice.baseFreq * 0.03, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(filter);
      lfo.start();
      osc.start();

      this.stemOscillators.set(voice.id, { osc, filter, lfo });
    });

    const stepDurationMs = (60000 / this.bpm) / 4;
    const chords = [
      [261.63, 329.63, 392.0, 523.25],
      [220.0, 261.63, 329.63, 440.0],
      [174.61, 220.0, 261.63, 349.23],
      [196.0, 246.94, 293.66, 392.0],
    ];

    this.stepInterval = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      this.currentStep = (this.currentStep + 1) % 64;
      if (callbacks?.onStep) callbacks.onStep(this.currentStep);

      const chordIdx = Math.floor(this.currentStep / 16) % chords.length;
      const currentChord = chords[chordIdx];
      const noteIdx = this.currentStep % currentChord.length;

      const synthData = this.stemOscillators.get('synth');
      if (synthData) {
        const freq = currentChord[noteIdx];
        synthData.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
        const cutoff = 800 + Math.sin(this.currentStep * 0.4) * 600;
        synthData.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.05);
      }

      const bassData = this.stemOscillators.get('bass');
      if (bassData && (this.currentStep % 4 === 0 || this.currentStep % 8 === 6)) {
        const baseRoot = currentChord[0] / 4;
        bassData.osc.frequency.setValueAtTime(baseRoot, this.ctx.currentTime);
        bassData.filter.frequency.setValueAtTime(280, this.ctx.currentTime);
        bassData.filter.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.15);
      }

      const drumData = this.stemOscillators.get('drums');
      if (drumData && this.currentStep % 4 === 0) {
        drumData.osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        drumData.osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.08);
      }

      const vocalData = this.stemOscillators.get('vocals');
      if (vocalData && this.currentStep % 8 === 0) {
        const vocalNote = currentChord[(noteIdx + 1) % currentChord.length];
        vocalData.osc.frequency.setTargetAtTime(vocalNote, this.ctx.currentTime, 0.1);
      }
    }, stepDurationMs);
  }

  public stopPlayback() {
    this.isPlaying = false;
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {
        // Ignored
      }
    }
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    this.stemOscillators.forEach(({ osc, lfo }) => {
      try {
        osc.stop();
        osc.disconnect();
        lfo?.stop();
        lfo?.disconnect();
      } catch {
        // Ignored
      }
    });
    this.stemOscillators.clear();
    this.stemGains.clear();
  }

  public triggerSoundSnippet(freq: number = 440, type: OscillatorType = 'sine', duration: number = 0.2) {
    this.init();
    void this.resume();
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignored
    }
  }
}

export const audioEngine = new AudioEngine();
