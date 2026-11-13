import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

export interface AiQuotaRequestContext {
  userId?: string | null;
  visitorId: string;
  tier: 'Free' | 'Haven Pro';
  quotaUsed: number;
  quotaCycle: string;
}

interface MicTranscribeButtonProps {
  targetField: 'lyrics' | 'description' | 'search';
  quotaContext: AiQuotaRequestContext;
  onTranscribed: (text: string, quota?: UserAiQuotaState) => void;
  onQuotaUpdate?: (quota: UserAiQuotaState) => void;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}

export const MicTranscribeButton: React.FC<MicTranscribeButtonProps> = ({
  targetField,
  quotaContext,
  onTranscribed,
  onQuotaUpdate,
  label,
  compact = false,
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const stopStream = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Ignore cleanup errors
      }
      stopStream();
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error('Could not encode recorded microphone audio.'));
      reader.readAsDataURL(blob);
    });

  const handleStopAndTranscribe = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const handleStartRecording = async () => {
    setError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const chosenMime =
        candidateTypes.find((type) =>
          typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(type) : false
        ) || '';

      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        stopStream();
        if (!mountedRef.current) return;

        const mimeType = (recorder.mimeType || chosenMime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 100) {
          setStatus('idle');
          setRecordingSeconds(0);
          setError('Recording was empty. Please speak or sing closer to your microphone.');
          return;
        }

        void (async () => {
          setStatus('transcribing');
          try {
            const audioBase64 = await blobToBase64(blob);
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64,
                mimeType,
                targetField,
                ...quotaContext,
              }),
            });
            const data = await response.json();
            if (data?.quota && onQuotaUpdate) {
              onQuotaUpdate(data.quota as UserAiQuotaState);
            }
            if (!response.ok) {
              throw new Error(
                typeof data?.error === 'string'
                  ? data.error
                  : 'Could not transcribe microphone audio.'
              );
            }
            const text = typeof data?.text === 'string' ? data.text.trim() : '';
            if (!text) {
              throw new Error('No speech or lyrics could be recognized from the recording.');
            }
            if (mountedRef.current) {
              onTranscribed(text, data?.quota as UserAiQuotaState | undefined);
            }
          } catch (err) {
            if (mountedRef.current) {
              setError(err instanceof Error ? err.message : 'Transcription failed.');
            }
          } finally {
            if (mountedRef.current) {
              setStatus('idle');
              setRecordingSeconds(0);
            }
          }
        })();
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setStatus('recording');

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 45) {
            handleStopAndTranscribe();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      stopStream();
      setStatus('idle');
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Enable mic permission to transcribe audio.'
          : err instanceof Error
          ? err.message
          : 'Unable to access microphone.';
      setError(message);
    }
  };

  const buttonText =
    status === 'recording'
      ? `Stop & Transcribe (${recordingSeconds}s)`
      : status === 'transcribing'
      ? 'Transcribing...'
      : label || 'Mic Transcribe';

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled || status === 'transcribing'}
        onClick={() => {
          if (status === 'recording') {
            handleStopAndTranscribe();
          } else {
            void handleStartRecording();
          }
        }}
        data-testid={`mic-transcribe-${targetField}`}
        title={
          status === 'recording'
            ? 'Stop recording and transcribe with AI'
            : 'Record from microphone and transcribe to text (charged to your personal AI cap)'
        }
        className={`inline-flex items-center gap-1.5 rounded-lg border font-mono-tech transition-all disabled:opacity-50 ${
          compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
        } ${
          status === 'recording'
            ? 'bg-red-500/20 border-red-400/60 text-red-200 animate-pulse'
            : 'bg-white/5 hover:bg-[#06B6D4]/15 border-white/15 hover:border-[#06B6D4]/50 text-[#e4e1e8] hover:text-white'
        }`}
      >
        {status === 'transcribing' ? (
          <Loader2 className="w-3 h-3 text-[#06B6D4] animate-spin" />
        ) : status === 'recording' ? (
          <Square className="w-3 h-3 fill-red-400 text-red-400" />
        ) : (
          <Mic className="w-3 h-3 text-[#06B6D4]" />
        )}
        <span>{buttonText}</span>
      </button>

      {error && (
        <div
          role="alert"
          className="max-w-xs text-right text-[10px] text-red-300 flex items-center gap-1 justify-end"
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
