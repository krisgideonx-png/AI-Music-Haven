const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeRoomCode(input: string): string {
  return (input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code || '');
}

export function generateRoomCode(length: number = 6): string {
  const safeLen = Math.max(4, Math.min(8, length));
  let result = '';
  for (let i = 0; i < safeLen; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    result += ROOM_CODE_ALPHABET[idx];
  }
  return result;
}

/**
 * Computes drift-compensated playback timestamp in seconds for a room.
 */
export function computeSyncedPositionSeconds(
  roomState: {
    isPlaying: boolean;
    positionSeconds: number;
    updatedAtMs: number;
    trackDuration: number;
  },
  nowMs: number = Date.now()
): number {
  const dur = Math.max(1, roomState.trackDuration || 180);
  const basePos = Math.max(0, Math.min(dur, roomState.positionSeconds || 0));

  if (!roomState.isPlaying) {
    return basePos;
  }

  const elapsedSec = Math.max(0, (nowMs - (roomState.updatedAtMs || nowMs)) / 1000);
  return (basePos + elapsedSec) % dur;
}

/**
 * Returns true when local playback clock diverges from room clock beyond tolerance.
 */
export function shouldSeekOnSync(
  localSeconds: number,
  remoteSeconds: number,
  toleranceSeconds: number = 1.6
): boolean {
  if (!Number.isFinite(localSeconds) || !Number.isFinite(remoteSeconds)) {
    return false;
  }
  return Math.abs(localSeconds - remoteSeconds) > Math.max(0.25, toleranceSeconds);
}
