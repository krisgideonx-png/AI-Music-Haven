import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { AudioTrack, HavenLicense, TrackTakedownNotice } from './types/index.ts';
import {
  sanitizeTrackForFirestore,
  sanitizeTrackUpdates,
  sanitizeString,
  clampNumber,
} from './utils/trackCategorizer.ts';
import { getBillingCycleKey } from './utils/aiQuota.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface UserAiProfileQuota {
  tier: 'Free' | 'Haven Pro';
  aiCreditsUsed: number;
  aiQuotaCycle: string;
}

export async function syncPrivateUserProfile(user: User): Promise<UserAiProfileQuota | null> {
  if (!user.emailVerified || !user.email) return null;
  const profilePath = `users/${user.uid}/private/profile`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'profile');
  const currentCycle = getBillingCycleKey();

  try {
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        email: user.email.slice(0, 254),
        displayName: (user.displayName || 'Haven Creator').slice(0, 80),
        photoURL: (user.photoURL || '').slice(0, 500),
        tier: 'Free',
        aiCreditsUsed: 0,
        aiQuotaCycle: currentCycle,
        createdAt: serverTimestamp(),
      });
      return { tier: 'Free', aiCreditsUsed: 0, aiQuotaCycle: currentCycle };
    } else {
      const data = snap.data();
      const storedCycle = typeof data.aiQuotaCycle === 'string' ? data.aiQuotaCycle : currentCycle;
      const storedUsed = storedCycle === currentCycle ? Math.max(0, Number(data.aiCreditsUsed || 0)) : 0;
      await updateDoc(profileRef, {
        displayName: (user.displayName || 'Haven Creator').slice(0, 80),
        photoURL: (user.photoURL || '').slice(0, 500),
        aiCreditsUsed: storedUsed,
        aiQuotaCycle: currentCycle,
        updatedAt: serverTimestamp(),
      });
      return {
        tier: data.tier === 'Haven Pro' ? 'Haven Pro' : 'Free',
        aiCreditsUsed: storedUsed,
        aiQuotaCycle: currentCycle,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function syncUserAiCreditUsageToFirestore(
  user: User,
  used: number,
  cycle: string
): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const profilePath = `users/${user.uid}/private/profile`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'profile');
  const safeUsed = Math.max(0, Math.min(10000, Math.floor(used)));
  const safeCycle = /^[0-9]{4}-[0-9]{2}$/.test(cycle) ? cycle : getBillingCycleKey();
  try {
    await updateDoc(profileRef, {
      aiCreditsUsed: safeUsed,
      aiQuotaCycle: safeCycle,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await syncPrivateUserProfile(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function publishTrackToFirestore(
  track: AudioTrack,
  user: User
): Promise<void> {
  const sanitized = sanitizeTrackForFirestore(track, user.uid);
  const trackId = String(sanitized.id);
  const path = `tracks/${trackId}`;

  try {
    await setDoc(doc(db, 'tracks', trackId), {
      ...sanitized,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTrackInFirestore(
  trackId: string,
  updates: Partial<AudioTrack>
): Promise<void> {
  const safeUpdates = sanitizeTrackUpdates(updates);
  if (Object.keys(safeUpdates).length === 0) return;

  const path = `tracks/${trackId}`;
  try {
    await updateDoc(doc(db, 'tracks', trackId), {
      ...safeUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTrackFromFirestore(trackId: string): Promise<void> {
  const path = `tracks/${trackId}`;
  try {
    await deleteDoc(doc(db, 'tracks', trackId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCatalogOverrideToFirestore(
  baseTrack: AudioTrack,
  updates: Partial<AudioTrack>,
  adminUid: string
): Promise<void> {
  const safeUpdates = sanitizeTrackUpdates(updates);
  const merged = { ...baseTrack, ...safeUpdates };
  const safeId = sanitizeString(baseTrack.id, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  const validLicenses: HavenLicense[] = [
    'Free Personal',
    'Attribution Required',
    'Commercial Permitted',
    'All Rights Reserved',
  ];
  const path = `catalog_overrides/${safeId}`;
  const docRef = doc(db, 'catalog_overrides', safeId);

  const payload = {
    title: sanitizeString(merged.title, 120, 'Untitled AI Track'),
    creator: sanitizeString(merged.creator, 80, 'Haven Creator'),
    description: sanitizeString(merged.description, 1000, 'Uploaded to AI Music Haven.'),
    story: typeof merged.story === 'string' ? sanitizeString(merged.story, 1500, '') : '',
    lyrics: typeof merged.lyrics === 'string' ? sanitizeString(merged.lyrics, 4000, '') : '',
    aiToolOrigin: sanitizeString(merged.aiToolOrigin, 60, 'Custom / Fine-Tuned'),
    bpm: Math.round(clampNumber(merged.bpm, 40, 240, 120)),
    key: sanitizeString(merged.key, 30, 'C Minor'),
    genre: sanitizeString(merged.genre, 60, 'Electronic'),
    subgenre: sanitizeString(merged.subgenre, 60, 'Ambient'),
    mood: sanitizeString(merged.mood, 60, 'Atmospheric'),
    vocalType: sanitizeString(merged.vocalType, 80, 'Instrumental'),
    license: validLicenses.includes(merged.license) ? merged.license : 'Commercial Permitted',
    coverArt: sanitizeString(
      merged.coverArt,
      500,
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
    ),
    categoryConfirmed: typeof merged.categoryConfirmed === 'boolean' ? merged.categoryConfirmed : true,
    updatedByUid: sanitizeString(adminUid, 128),
    updatedAt: serverTimestamp(),
  };

  let snapExists = false;
  try {
    const snap = await getDoc(docRef);
    snapExists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return;
  }

  if (!snapExists) {
    try {
      await setDoc(docRef, {
        id: safeId,
        ...payload,
        visibility: 'public',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(docRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export function subscribeToCatalogOverrides(
  onOverrides: (overrides: Record<string, Partial<AudioTrack>>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'catalog_overrides';
  const q = query(
    collection(db, 'catalog_overrides'),
    where('visibility', '==', 'public'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const overrides: Record<string, Partial<AudioTrack>> = {};
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const id = String(d.id || docSnap.id);
        overrides[id] = {
          title: typeof d.title === 'string' ? d.title : undefined,
          creator: typeof d.creator === 'string' ? d.creator : undefined,
          description: typeof d.description === 'string' ? d.description : undefined,
          story: typeof d.story === 'string' ? d.story : undefined,
          lyrics: typeof d.lyrics === 'string' ? d.lyrics : undefined,
          aiToolOrigin: typeof d.aiToolOrigin === 'string' ? d.aiToolOrigin : undefined,
          bpm: typeof d.bpm === 'number' ? d.bpm : undefined,
          key: typeof d.key === 'string' ? d.key : undefined,
          genre: typeof d.genre === 'string' ? d.genre : undefined,
          subgenre: typeof d.subgenre === 'string' ? d.subgenre : undefined,
          mood: typeof d.mood === 'string' ? d.mood : undefined,
          vocalType: typeof d.vocalType === 'string' ? d.vocalType : undefined,
          license: typeof d.license === 'string' ? (d.license as HavenLicense) : undefined,
          coverArt: typeof d.coverArt === 'string' ? d.coverArt : undefined,
          categoryConfirmed: typeof d.categoryConfirmed === 'boolean' ? d.categoryConfirmed : undefined,
        };
      });
      onOverrides(overrides);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeToPublishedTracks(
  onTracks: (tracks: AudioTrack[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'tracks';
  const q = query(
    collection(db, 'tracks'),
    where('visibility', '==', 'public'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AudioTrack[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdTs = d.createdAt && typeof d.createdAt.toDate === 'function'
          ? d.createdAt.toDate()
          : null;

        return {
          id: String(d.id || docSnap.id),
          uploaderUid: d.uploaderUid ? String(d.uploaderUid) : undefined,
          title: String(d.title || 'Untitled AI Track'),
          creator: String(d.creator || 'Haven Creator'),
          creatorHandle: String(d.creatorHandle || '@creator'),
          creatorAvatar: String(
            d.creatorAvatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
          ),
          description: String(d.description || ''),
          story: typeof d.story === 'string' && d.story.trim() ? d.story : undefined,
          lyrics: typeof d.lyrics === 'string' && d.lyrics.trim() ? d.lyrics : undefined,
          aiToolOrigin: String(d.aiToolOrigin || 'Custom / Fine-Tuned'),
          bpm: Number(d.bpm || 120),
          key: String(d.key || 'C Minor'),
          duration: Number(d.duration || 180),
          genre: String(d.genre || 'Electronic'),
          subgenre: String(d.subgenre || 'Ambient'),
          mood: String(d.mood || 'Atmospheric'),
          vocalType: String(d.vocalType || 'Instrumental'),
          instruments: Array.isArray(d.instruments) ? d.instruments.map(String) : ['Synthesizer'],
          language: String(d.language || 'English'),
          energyLevel: (['Chill', 'Medium', 'High', 'Explosive'].includes(String(d.energyLevel))
            ? d.energyLevel
            : 'Medium') as AudioTrack['energyLevel'],
          musicalStyle: String(d.musicalStyle || 'AI Composition'),
          license: (d.license || 'Attribution Required') as AudioTrack['license'],
          coverArt: String(
            d.coverArt ||
              'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
          ),
          waveform: Array.isArray(d.waveform) ? d.waveform.map(Number) : [0.3, 0.5, 0.4],
          createdAt: createdTs ? createdTs.toLocaleDateString() : 'Just now',
          plays: Number(d.plays || 1),
          likes: Number(d.likes || 1),
          downloads: Number(d.downloads || 0),
          reposts: Number(d.reposts || 0),
          rating: Number(d.rating || 5),
          ratingCount: Number(d.ratingCount || 1),
          fileFormat: String(d.fileFormat || 'WAV 24-bit'),
          fileSize: String(d.fileSize || '10.0 MB'),
          sampleRate: String(d.sampleRate || '48 kHz / 24-bit'),
          lufs: Number(d.lufs || -14.0),
          suggestedGenre: d.suggestedGenre ? String(d.suggestedGenre) : undefined,
          suggestedSubgenre: d.suggestedSubgenre ? String(d.suggestedSubgenre) : undefined,
          categoryConfirmed: typeof d.categoryConfirmed === 'boolean' ? d.categoryConfirmed : true,
          comments: [],
          _createdAtMs: createdTs ? createdTs.getTime() : Date.now(),
        } as AudioTrack & { _createdAtMs?: number };
      });

      items.sort((a, b) => {
        const aMs = (a as AudioTrack & { _createdAtMs?: number })._createdAtMs ?? 0;
        const bMs = (b as AudioTrack & { _createdAtMs?: number })._createdAtMs ?? 0;
        return bMs - aMs;
      });

      onTracks(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function createTakedownNoticeInFirestore(
  notice: Omit<TrackTakedownNotice, 'createdAt'>
): Promise<void> {
  const safeId = sanitizeString(notice.id, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `takedowns/${safeId}`;
  try {
    await setDoc(doc(db, 'takedowns', safeId), {
      id: safeId,
      trackId: sanitizeString(notice.trackId, 128).replace(/[^a-zA-Z0-9_-]/g, '_'),
      trackTitle: sanitizeString(notice.trackTitle, 120, 'Removed Track'),
      creatorName: sanitizeString(notice.creatorName, 80, 'Creator'),
      targetUploaderUid: sanitizeString(notice.targetUploaderUid, 128),
      reason: sanitizeString(notice.reason, 1000, 'Removed following administrative moderation review.'),
      autoGenerated: Boolean(notice.autoGenerated),
      adminEmail: sanitizeString(notice.adminEmail, 254, 'xtianboy5@gmail.com'),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToTakedownNotices(
  userUid: string | null | undefined,
  isAdmin: boolean,
  onNotices: (notices: TrackTakedownNotice[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userUid) {
    onNotices([]);
    return () => {};
  }

  const path = 'takedowns';
  const q = isAdmin
    ? query(collection(db, 'takedowns'), limit(50))
    : query(collection(db, 'takedowns'), where('targetUploaderUid', '==', userUid), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TrackTakedownNotice[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdTs = d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate() : null;
        return {
          id: String(d.id || docSnap.id),
          trackId: String(d.trackId || ''),
          trackTitle: String(d.trackTitle || 'Removed Track'),
          creatorName: String(d.creatorName || 'Creator'),
          targetUploaderUid: String(d.targetUploaderUid || ''),
          reason: String(d.reason || ''),
          autoGenerated: Boolean(d.autoGenerated),
          adminEmail: String(d.adminEmail || 'xtianboy5@gmail.com'),
          createdAt: createdTs ? createdTs.toLocaleString() : 'Just now',
          _createdAtMs: createdTs ? createdTs.getTime() : Date.now(),
        } as TrackTakedownNotice & { _createdAtMs?: number };
      });

      items.sort((a, b) => {
        const aMs = (a as TrackTakedownNotice & { _createdAtMs?: number })._createdAtMs ?? 0;
        const bMs = (b as TrackTakedownNotice & { _createdAtMs?: number })._createdAtMs ?? 0;
        return bMs - aMs;
      });

      onNotices(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function saveListeningRoomToFirestore(
  room: {
    code: string;
    name: string;
    hostName: string;
    trackId: string;
    trackTitle: string;
    trackCreator: string;
    trackCoverArt: string;
    trackDuration: number;
    isPlaying: boolean;
    positionSeconds: number;
    allowGuestControl: boolean;
  },
  user: User
): Promise<void> {
  const safeCode = room.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const path = `listening_rooms/${safeCode}`;
  try {
    await setDoc(doc(db, 'listening_rooms', safeCode), {
      code: safeCode,
      name: sanitizeString(room.name, 80, `Haven Room ${safeCode}`),
      hostUid: sanitizeString(user.uid, 128),
      hostName: sanitizeString(room.hostName, 80, user.displayName || 'Haven Host'),
      trackId: sanitizeString(room.trackId, 128).replace(/[^a-zA-Z0-9_-]/g, '_'),
      trackTitle: sanitizeString(room.trackTitle, 120, 'Untitled Track'),
      trackCreator: sanitizeString(room.trackCreator, 80, 'Haven Creator'),
      trackCoverArt: sanitizeString(
        room.trackCoverArt,
        500,
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
      ),
      trackDuration: Math.round(clampNumber(room.trackDuration, 1, 3600, 180)),
      isPlaying: Boolean(room.isPlaying),
      positionSeconds: clampNumber(room.positionSeconds, 0, 3600, 0),
      allowGuestControl: Boolean(room.allowGuestControl),
      visibility: 'room_code',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateListeningRoomInFirestore(
  roomCode: string,
  updates: {
    name?: string;
    trackId?: string;
    trackTitle?: string;
    trackCreator?: string;
    trackCoverArt?: string;
    trackDuration?: number;
    isPlaying?: boolean;
    positionSeconds?: number;
    allowGuestControl?: boolean;
  }
): Promise<void> {
  const safeCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const path = `listening_rooms/${safeCode}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.name === 'string') payload.name = sanitizeString(updates.name, 80, `Haven Room ${safeCode}`);
  if (typeof updates.trackId === 'string') payload.trackId = sanitizeString(updates.trackId, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (typeof updates.trackTitle === 'string') payload.trackTitle = sanitizeString(updates.trackTitle, 120, 'Untitled Track');
  if (typeof updates.trackCreator === 'string') payload.trackCreator = sanitizeString(updates.trackCreator, 80, 'Haven Creator');
  if (typeof updates.trackCoverArt === 'string') payload.trackCoverArt = sanitizeString(updates.trackCoverArt, 500, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80');
  if (typeof updates.trackDuration === 'number') payload.trackDuration = Math.round(clampNumber(updates.trackDuration, 1, 3600, 180));
  if (typeof updates.isPlaying === 'boolean') payload.isPlaying = updates.isPlaying;
  if (typeof updates.positionSeconds === 'number') payload.positionSeconds = clampNumber(updates.positionSeconds, 0, 3600, 0);
  if (typeof updates.allowGuestControl === 'boolean') payload.allowGuestControl = updates.allowGuestControl;

  try {
    await updateDoc(doc(db, 'listening_rooms', safeCode), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteListeningRoomFromFirestore(roomCode: string): Promise<void> {
  const safeCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const path = `listening_rooms/${safeCode}`;
  try {
    await deleteDoc(doc(db, 'listening_rooms', safeCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToListeningRoomFirestore(
  roomCode: string,
  onRoomData: (data: {
    code: string;
    trackId: string;
    isPlaying: boolean;
    positionSeconds: number;
    updatedAtMs: number;
  } | null) => void
): Unsubscribe {
  const safeCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (safeCode.length < 4) return () => {};
  const docRef = doc(db, 'listening_rooms', safeCode);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onRoomData(null);
        return;
      }
      const d = snap.data();
      const updatedMs =
        d.updatedAt && typeof d.updatedAt.toMillis === 'function'
          ? d.updatedAt.toMillis()
          : Date.now();
      onRoomData({
        code: String(d.code || safeCode),
        trackId: String(d.trackId || ''),
        isPlaying: Boolean(d.isPlaying),
        positionSeconds: Number(d.positionSeconds || 0),
        updatedAtMs: updatedMs,
      });
    },
    () => {
      // Ignore permission/missing transient errors while falling back to server SSE
    }
  );
}
