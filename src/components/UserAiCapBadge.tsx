import React from 'react';
import { Gauge } from 'lucide-react';
import type { UserAiQuotaState } from '../utils/aiQuota.ts';

interface UserAiCapBadgeProps {
  quota: UserAiQuotaState;
  compact?: boolean;
}

export const UserAiCapBadge: React.FC<UserAiCapBadgeProps> = ({ quota, compact = false }) => {
  const isExhausted = quota.remaining <= 0;
  const isLow = !isExhausted && quota.remaining <= Math.max(1, Math.floor(quota.limit * 0.2));

  return (
    <div
      data-testid="user-ai-cap-badge"
      className={`inline-flex items-center gap-2 rounded-xl border font-mono-tech ${
        compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
      } ${
        isExhausted
          ? 'bg-red-500/10 border-red-500/35 text-red-200'
          : isLow
          ? 'bg-amber-500/10 border-amber-500/35 text-amber-200'
          : 'bg-[#08080C]/80 border-[#06B6D4]/30 text-[#acedff]'
      }`}
    >
      <Gauge
        className={`w-3.5 h-3.5 shrink-0 ${
          isExhausted ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-[#06B6D4]'
        }`}
      />
      <span>
        Your AI Cap: <strong>{quota.used}/{quota.limit}</strong> ({quota.remaining} left · {quota.tier})
      </span>
      {!compact && (
        <span className="text-[#958ea0] hidden sm:inline">
          · Charged to your personal limit
        </span>
      )}
    </div>
  );
};
