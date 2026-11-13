import type { AudioTrack } from '../types/index.ts';

export const ADMIN_EMAIL = 'xtianboy5@gmail.com';

export interface AuthIdentity {
  uid?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
}

export function isAdminUser(user?: AuthIdentity | null): boolean {
  if (!user || !user.email || user.emailVerified !== true) {
    return false;
  }
  return user.email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function canEditTrack(
  track?: Pick<AudioTrack, 'uploaderUid'> | null,
  user?: AuthIdentity | null
): boolean {
  if (!track || !user || !user.uid) {
    return false;
  }
  if (isAdminUser(user)) {
    return true;
  }
  return Boolean(track.uploaderUid && track.uploaderUid === user.uid);
}

export function canDeleteTrack(
  track?: Pick<AudioTrack, 'uploaderUid'> | null,
  user?: AuthIdentity | null
): boolean {
  return canEditTrack(track, user);
}

export function getTrackPermissionRole(
  track?: Pick<AudioTrack, 'uploaderUid'> | null,
  user?: AuthIdentity | null
): 'admin' | 'owner' | 'readonly' {
  if (isAdminUser(user)) {
    return 'admin';
  }
  if (track?.uploaderUid && user?.uid && track.uploaderUid === user.uid) {
    return 'owner';
  }
  return 'readonly';
}

export function getCreatorUploadedTracks<T extends Pick<AudioTrack, 'uploaderUid'>>(
  tracks: T[],
  user?: AuthIdentity | null
): T[] {
  if (!user || !user.uid) {
    return [];
  }
  return tracks.filter((t) => Boolean(t.uploaderUid && t.uploaderUid === user.uid));
}
