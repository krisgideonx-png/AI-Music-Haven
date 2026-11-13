import React, { useState } from 'react';
import { Captions, Loader2, AlertCircle } from 'lucide-react';
import { requestLyricsCaption, type CaptionQuotaContext } from '../utils/captionLyrics.ts';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface CaptionLyricsButtonProps {
  audioFile?: File | null;
  audioUrl?: string;
  title?: string;
  creator?: string;
  description?: string;
  quotaContext: CaptionQuotaContext;
  onCaptioned: (captions: string, quota?: UserAiQuotaState) => void;
  onQuotaUpdate?: (quota: UserAiQuotaState) => void;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}

export const CaptionLyricsButton: React.FC<CaptionLyricsButtonProps> = ({
  audioFile,
  audioUrl,
  title,
  creator,
  description,
  quotaContext,
  onCaptioned,
  onQuotaUpdate,
  label = 'Caption Lyrics',
  compact = false,
  disabled = false,
}) => {
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCaptionClick = async () => {
    setError(null);
    setIsCaptioning(true);
    try {
      const result = await requestLyricsCaption({
        audioFile,
        audioUrl,
        title,
        creator,
        description,
        quotaContext,
      });
      if (result.quota && onQuotaUpdate) {
        onQuotaUpdate(result.quota);
      }
      onCaptioned(result.captions, result.quota);
    } catch (err) {
      const typed = err as Error & { quota?: UserAiQuotaState };
      if (typed?.quota && onQuotaUpdate) {
        onQuotaUpdate(typed.quota);
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to caption lyrics from this song audio.'
      );
    } finally {
      setIsCaptioning(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled || isCaptioning}
        onClick={() => void handleCaptionClick()}
        data-testid="caption-lyrics-button"
        title="Auto-caption lyrics directly from the song audio track (charged to your personal AI cap)"
        className={`inline-flex items-center gap-1.5 rounded-lg border font-mono-tech transition-all disabled:opacity-50 ${
          compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
        } bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 border-[#06B6D4]/40 text-[#acedff] hover:text-white`}
      >
        {isCaptioning ? (
          <Loader2 className="w-3 h-3 text-[#06B6D4] animate-spin" />
        ) : (
          <Captions className="w-3 h-3 text-[#06B6D4]" />
        )}
        <span>{isCaptioning ? 'Captioning Lyrics...' : label}</span>
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
