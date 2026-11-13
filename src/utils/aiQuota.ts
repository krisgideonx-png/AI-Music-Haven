export type AiQuotaTier = 'Guest' | 'Free' | 'Haven Pro';

export const USER_AI_MONTHLY_CAPS: Record<AiQuotaTier, number> = {
  Guest: 2,
  Free: 15,
  'Haven Pro': 250,
};

export interface UserAiQuotaState {
  scopeId: string;
  tier: AiQuotaTier;
  cycle: string;
  used: number;
  limit: number;
  remaining: number;
}

export function getBillingCycleKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function resolveEffectiveTier(params: {
  uid?: string | null;
  requestedTier?: string | null;
}): AiQuotaTier {
  if (!params.uid || !params.uid.trim()) {
    return 'Guest';
  }
  return params.requestedTier === 'Haven Pro' ? 'Haven Pro' : 'Free';
}

export function resolveUserCapScope(params: {
  uid?: string | null;
  visitorId?: string | null;
  requestedTier?: string | null;
}): { scopeId: string; tier: AiQuotaTier; limit: number } {
  const cleanUid = (params.uid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanVisitor = (params.visitorId || 'anonymous')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, '')
    .slice(0, 64);

  const tier = resolveEffectiveTier({
    uid: cleanUid,
    requestedTier: params.requestedTier,
  });

  const scopeId = cleanUid ? `user:${cleanUid}` : `guest:${cleanVisitor || 'anonymous'}`;
  return {
    scopeId,
    tier,
    limit: USER_AI_MONTHLY_CAPS[tier],
  };
}

export function normalizeUserQuotaState(params: {
  scopeId: string;
  tier: AiQuotaTier;
  used?: number;
  cycle?: string | null;
  now?: Date;
}): UserAiQuotaState {
  const currentCycle = getBillingCycleKey(params.now);
  const limit = USER_AI_MONTHLY_CAPS[params.tier];
  const isSameCycle = params.cycle === currentCycle;
  const rawUsed = isSameCycle ? Number(params.used ?? 0) : 0;
  const safeUsed = Number.isFinite(rawUsed) && rawUsed > 0 ? Math.floor(rawUsed) : 0;
  const remaining = Math.max(0, limit - safeUsed);

  return {
    scopeId: params.scopeId,
    tier: params.tier,
    cycle: currentCycle,
    used: safeUsed,
    limit,
    remaining,
  };
}

export function canConsumeUserAiCap(
  state: UserAiQuotaState,
  cost: number = 1
): { allowed: boolean; reason?: string } {
  const safeCost = Math.max(1, Math.floor(cost));
  if (state.used + safeCost > state.limit) {
    const upgradeHint =
      state.tier === 'Guest'
        ? 'Sign in with Google to unlock your personal monthly creator AI cap.'
        : state.tier === 'Free'
        ? 'Upgrade to Haven Pro for 250 monthly generations, or edit details manually at zero cost.'
        : 'Monthly Haven Pro AI cap reached; manual editing remains unlimited.';
    return {
      allowed: false,
      reason: `Your personal AI generation cap (${state.used}/${state.limit} for ${state.tier}) is exhausted for ${state.cycle}. ${upgradeHint}`,
    };
  }
  return { allowed: true };
}

export function consumeUserAiCap(
  state: UserAiQuotaState,
  cost: number = 1
): UserAiQuotaState {
  const safeCost = Math.max(1, Math.floor(cost));
  const nextUsed = state.used + safeCost;
  return {
    ...state,
    used: nextUsed,
    remaining: Math.max(0, state.limit - nextUsed),
  };
}
