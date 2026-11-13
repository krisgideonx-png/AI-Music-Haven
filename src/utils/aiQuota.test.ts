import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_AI_MONTHLY_CAPS,
  getBillingCycleKey,
  resolveUserCapScope,
  normalizeUserQuotaState,
  canConsumeUserAiCap,
  consumeUserAiCap,
} from './aiQuota';

test('getBillingCycleKey formats UTC year and month consistently', () => {
  const date = new Date(Date.UTC(2026, 10, 11, 22, 0, 0));
  assert.equal(getBillingCycleKey(date), '2026-11');
});

test('resolveUserCapScope isolates guests, free users, and Haven Pro users', () => {
  const guest = resolveUserCapScope({ visitorId: 'vis-123', requestedTier: 'Haven Pro' });
  assert.equal(guest.tier, 'Guest');
  assert.equal(guest.scopeId, 'guest:vis-123');
  assert.equal(guest.limit, USER_AI_MONTHLY_CAPS.Guest);

  const freeUser = resolveUserCapScope({ uid: 'uid_alice', requestedTier: 'Free' });
  assert.equal(freeUser.tier, 'Free');
  assert.equal(freeUser.scopeId, 'user:uid_alice');
  assert.equal(freeUser.limit, USER_AI_MONTHLY_CAPS.Free);

  const proUser = resolveUserCapScope({ uid: 'uid_bob', requestedTier: 'Haven Pro' });
  assert.equal(proUser.tier, 'Haven Pro');
  assert.equal(proUser.scopeId, 'user:uid_bob');
  assert.equal(proUser.limit, USER_AI_MONTHLY_CAPS['Haven Pro']);
});

test('per-user AI cap enforces user isolation and cycle rollover reset', () => {
  const now = new Date(Date.UTC(2026, 10, 11));
  const aliceScope = resolveUserCapScope({ uid: 'alice_1', requestedTier: 'Free' });
  const bobScope = resolveUserCapScope({ uid: 'bob_2', requestedTier: 'Free' });

  let aliceQuota = normalizeUserQuotaState({
    scopeId: aliceScope.scopeId,
    tier: aliceScope.tier,
    used: 14,
    cycle: '2026-11',
    now,
  });
  const bobQuota = normalizeUserQuotaState({
    scopeId: bobScope.scopeId,
    tier: bobScope.tier,
    used: 0,
    cycle: '2026-11',
    now,
  });

  assert.equal(canConsumeUserAiCap(aliceQuota).allowed, true);
  aliceQuota = consumeUserAiCap(aliceQuota, 1);
  assert.equal(aliceQuota.used, 15);
  assert.equal(aliceQuota.remaining, 0);

  // Alice hitting her cap rejects further consumption without touching Bob's cap
  const blocked = canConsumeUserAiCap(aliceQuota);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason || '', /15\/15/);
  assert.equal(canConsumeUserAiCap(bobQuota).allowed, true);
  assert.equal(bobQuota.remaining, 15);

  // Rolling over to next month resets Alice's counter automatically
  const nextMonth = new Date(Date.UTC(2026, 11, 1));
  const resetAlice = normalizeUserQuotaState({
    scopeId: aliceScope.scopeId,
    tier: aliceScope.tier,
    used: aliceQuota.used,
    cycle: aliceQuota.cycle,
    now: nextMonth,
  });
  assert.equal(resetAlice.used, 0);
  assert.equal(resetAlice.remaining, 15);
  assert.equal(resetAlice.cycle, '2026-12');
});
