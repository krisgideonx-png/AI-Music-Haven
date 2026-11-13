/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { 
  AudioTrack, 
  HavenTab, 
  Playlist, 
  CommunityPost, 
  CreatorProfile, 
  CopyrightReport,
  TrackTakedownNotice,
  ListeningRoom,
  SleepTimerMode,
  SleepTimerState,
} from './types/index.ts';
import { 
  INITIAL_TRACKS, 
  INITIAL_PLAYLISTS, 
  INITIAL_POSTS, 
  INITIAL_CREATORS, 
  INITIAL_REPORTS 
} from './data/initialTracks.ts';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  syncPrivateUserProfile,
  syncUserAiCreditUsageToFirestore,
  publishTrackToFirestore,
  updateTrackInFirestore,
  deleteTrackFromFirestore,
  saveCatalogOverrideToFirestore,
  subscribeToPublishedTracks,
  subscribeToCatalogOverrides,
  createTakedownNoticeInFirestore,
  subscribeToTakedownNotices,
  saveListeningRoomToFirestore,
  updateListeningRoomInFirestore,
  deleteListeningRoomFromFirestore,
  subscribeToListeningRoomFirestore,
} from './firebase.ts';
import {
  getBillingCycleKey,
  normalizeUserQuotaState,
  resolveUserCapScope,
  type UserAiQuotaState,
} from './utils/aiQuota.ts';
import type { AiQuotaRequestContext } from './components/MicTranscribeButton.tsx';
import {
  ADMIN_EMAIL,
  isAdminUser,
  canEditTrack,
  canDeleteTrack,
  getTrackPermissionRole,
} from './utils/accessControl.ts';
import { buildCreatorHandle, sanitizeTrackUpdates } from './utils/trackCategorizer.ts';
import { audioEngine } from './utils/audioEngine.ts';
import { clampSleepMinutes, computeSleepFadeMultiplier } from './utils/sleepTimer.ts';
import {
  normalizeRoomCode,
  isValidRoomCode,
  computeSyncedPositionSeconds,
  shouldSeekOnSync,
} from './utils/roomSync.ts';
import { parseTrackIdFromSearch } from './utils/trackShare.ts';
import { Navigation } from './components/Navigation.tsx';
import { HomeView } from './components/HomeView.tsx';
import { ExploreView } from './components/ExploreView.tsx';
import { GenresView } from './components/GenresView.tsx';
import { AIDiscoveryView } from './components/AIDiscoveryView.tsx';
import { CommunityView } from './components/CommunityView.tsx';
import { UploadView } from './components/UploadView.tsx';
import { LibraryView } from './components/LibraryView.tsx';
import { CreatorDashboardView } from './components/CreatorDashboardView.tsx';
import { PricingView } from './components/PricingView.tsx';
import { AdminView } from './components/AdminView.tsx';
import { RoomsView } from './components/RoomsView.tsx';
import { TrackDetailsModal } from './components/TrackDetailsModal.tsx';
import { SpectralVisualizerModal } from './components/SpectralVisualizerModal.tsx';
import { MasterPlayer } from './components/MasterPlayer.tsx';

export default function App() {
  const [tracks, setTracks] = useState<AudioTrack[]>(INITIAL_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(INITIAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [currentTab, setCurrentTab] = useState<HavenTab>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSpectralModalOpen, setIsSpectralModalOpen] = useState<boolean>(false);
  const [selectedTrackForDetails, setSelectedTrackForDetails] = useState<AudioTrack | null>(null);
  const [trackDetailsInitialEdit, setTrackDetailsInitialEdit] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(0.85);
  const [userTier, setUserTier] = useState<'Free' | 'Haven Pro'>('Haven Pro');

  // Firebase Auth state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [cloudTrackIds, setCloudTrackIds] = useState<Set<string>>(() => new Set());
  const [catalogOverrides, setCatalogOverrides] = useState<Record<string, Partial<AudioTrack>>>({});
  const [takenDownCatalogIds, setTakenDownCatalogIds] = useState<Set<string>>(() => new Set());

  // Dynamic state arrays
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_POSTS);
  const [creators] = useState<CreatorProfile[]>(INITIAL_CREATORS);
  const [reports, setReports] = useState<CopyrightReport[]>(INITIAL_REPORTS);
  const [takedownNotices, setTakedownNotices] = useState<TrackTakedownNotice[]>([]);

  // Sleep Timer state
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    mode: 'off',
    remainingSeconds: 0,
    totalSeconds: 0,
  });

  // Synchronized Listening Room state
  const roomClientIdRef = useRef<string>('');
  if (!roomClientIdRef.current) {
    const existingId =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('haven_room_client_id') : null;
    const generated =
      existingId || `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    roomClientIdRef.current = generated;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('haven_room_client_id', generated);
    }
  }
  const [activeRoom, setActiveRoom] = useState<ListeningRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomLoading, setRoomLoading] = useState<boolean>(false);

  const playbackRef = useRef<number | null>(null);
  const sleepTimerModeRef = useRef<SleepTimerMode>('off');
  const tracksRef = useRef<AudioTrack[]>(tracks);
  const currentTrackRef = useRef<AudioTrack>(currentTrack);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const playbackProgressRef = useRef<number>(playbackProgress);
  const isApplyingRemoteRoomRef = useRef<boolean>(false);

  sleepTimerModeRef.current = sleepTimer.mode;
  tracksRef.current = tracks;
  currentTrackRef.current = currentTrack;
  isPlayingRef.current = isPlaying;
  playbackProgressRef.current = playbackProgress;

  const isAdmin = isAdminUser(authUser);

  // Per-user AI generation cap state (charged strictly to the requesting user's cap, never global owner limit)
  const visitorIdRef = useRef<string>('');
  if (!visitorIdRef.current) {
    let existingVisitor: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        existingVisitor =
          window.localStorage.getItem('haven_visitor_id') ||
          window.sessionStorage.getItem('haven_room_client_id');
      } catch {
        existingVisitor = null;
      }
    }
    const generated =
      existingVisitor || `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    visitorIdRef.current = generated;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('haven_visitor_id', generated);
      } catch {
        // Ignore storage write restriction
      }
    }
  }

  const [aiQuota, setAiQuota] = useState<UserAiQuotaState>(() => {
    const scope = resolveUserCapScope({ visitorId: visitorIdRef.current });
    let storedUsed = 0;
    let storedCycle = getBillingCycleKey();
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('haven_guest_ai_quota_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.cycle === storedCycle && Number.isFinite(Number(parsed?.used))) {
            storedUsed = Math.max(0, Math.floor(Number(parsed.used)));
          }
        }
      } catch {
        // Ignore malformed localStorage cache
      }
    }
    return normalizeUserQuotaState({
      scopeId: scope.scopeId,
      tier: scope.tier,
      used: storedUsed,
      cycle: storedCycle,
    });
  });

  const handleAiQuotaUpdate = (nextQuota: UserAiQuotaState) => {
    setAiQuota(nextQuota);
    if (!authUser) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            'haven_guest_ai_quota_v1',
            JSON.stringify({ cycle: nextQuota.cycle, used: nextQuota.used })
          );
        } catch {
          // Ignore storage errors
        }
      }
    } else {
      void syncUserAiCreditUsageToFirestore(authUser, nextQuota.used, nextQuota.cycle).catch(() => {});
    }
  };

  const aiQuotaRequestContext: AiQuotaRequestContext = {
    userId: authUser?.uid || null,
    visitorId: visitorIdRef.current,
    tier: userTier,
    quotaUsed: aiQuota.used,
    quotaCycle: aiQuota.cycle,
  };

  // Redirect away from admin tab if user is not xtianboy5@gmail.com
  useEffect(() => {
    if (!authLoading && currentTab === 'admin' && !isAdmin) {
      setCurrentTab('home');
    }
  }, [authLoading, currentTab, isAdmin]);

  // Subscribe to Firebase Authentication state & sync each user's isolated AI generation cap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        void (async () => {
          try {
            const profile = await syncPrivateUserProfile(user);
            const effectiveTier = profile?.tier || userTier;
            if (profile?.tier) {
              setUserTier(profile.tier);
            }
            const scope = resolveUserCapScope({
              uid: user.uid,
              visitorId: visitorIdRef.current,
              requestedTier: effectiveTier,
            });
            const baseState = normalizeUserQuotaState({
              scopeId: scope.scopeId,
              tier: scope.tier,
              used: profile?.aiCreditsUsed ?? 0,
              cycle: profile?.aiQuotaCycle ?? getBillingCycleKey(),
            });
            setAiQuota(baseState);

            const res = await fetch(
              `/api/quota?userId=${encodeURIComponent(user.uid)}&visitorId=${encodeURIComponent(visitorIdRef.current)}&tier=${encodeURIComponent(effectiveTier)}&quotaUsed=${baseState.used}&quotaCycle=${encodeURIComponent(baseState.cycle)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data?.quota) {
                setAiQuota(data.quota as UserAiQuotaState);
              }
            }
          } catch (err) {
            console.error('Failed syncing user profile:', err);
          }
        })();
      } else {
        const scope = resolveUserCapScope({ visitorId: visitorIdRef.current });
        let guestUsed = 0;
        const cycle = getBillingCycleKey();
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('haven_guest_ai_quota_v1');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.cycle === cycle && Number.isFinite(Number(parsed?.used))) {
                guestUsed = Math.max(0, Math.floor(Number(parsed.used)));
              }
            }
          } catch {
            // Ignore malformed storage
          }
        }
        setAiQuota(
          normalizeUserQuotaState({
            scopeId: scope.scopeId,
            tier: scope.tier,
            used: guestUsed,
            cycle,
          })
        );
      }
    });
    return () => unsub();
  }, []);

  // Keep signed-in user's AI cap limit synchronized when userTier toggles in PricingView
  useEffect(() => {
    if (!authUser) return;
    setAiQuota((prev) => {
      const scope = resolveUserCapScope({
        uid: authUser.uid,
        visitorId: visitorIdRef.current,
        requestedTier: userTier,
      });
      return normalizeUserQuotaState({
        scopeId: scope.scopeId,
        tier: scope.tier,
        used: prev.used,
        cycle: prev.cycle,
      });
    });
  }, [authUser, userTier]);

  // Subscribe to published tracks stored in Firestore
  useEffect(() => {
    const initialById = new Map(INITIAL_TRACKS.map((t) => [t.id, t]));
    const unsub = subscribeToPublishedTracks(
      (cloudTracks) => {
        const ids = new Set(cloudTracks.map((t) => t.id));
        setCloudTrackIds(ids);

        const hydratedCloud = cloudTracks.map((t) => {
          const seed = initialById.get(t.id);
          return {
            ...t,
            audioUrl: t.audioUrl || seed?.audioUrl,
            pitchSemitones: t.pitchSemitones ?? seed?.pitchSemitones,
            pitchRate: t.pitchRate ?? seed?.pitchRate,
          };
        });

        const merged = [
          ...hydratedCloud,
          ...INITIAL_TRACKS.filter((t) => !ids.has(t.id) && !takenDownCatalogIds.has(t.id)).map((t) =>
            catalogOverrides[t.id] ? { ...t, ...catalogOverrides[t.id] } : t
          ),
        ];
        setTracks(merged);
      },
      (err) => {
        console.error('Track subscription error:', err.message);
      }
    );
    return () => unsub();
  }, [catalogOverrides, takenDownCatalogIds]);

  // Subscribe to creator takedown notices for the signed-in user (or all for admin)
  useEffect(() => {
    const unsub = subscribeToTakedownNotices(
      authUser?.uid,
      isAdmin,
      (notices) => {
        setTakedownNotices(notices);
      },
      (err) => {
        console.error('Takedown subscription error:', err.message);
      }
    );
    return () => unsub();
  }, [authUser?.uid, isAdmin]);

  // Subscribe to admin metadata overrides for curated catalog tracks
  useEffect(() => {
    const unsub = subscribeToCatalogOverrides(
      (overrides) => {
        setCatalogOverrides(overrides);
        setTracks((prev) =>
          prev.map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id] } : t))
        );
        setCurrentTrack((prev) =>
          overrides[prev.id] ? { ...prev, ...overrides[prev.id] } : prev
        );
        setSelectedTrackForDetails((prev) =>
          prev && overrides[prev.id] ? { ...prev, ...overrides[prev.id] } : prev
        );
      },
      (err) => {
        console.error('Catalog override subscription error:', err.message);
      }
    );
    return () => unsub();
  }, []);

  const handleSignInGoogle = async () => {
    setAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      setAuthUser(user);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthUser(null);
  };

  // Sync master volume to audio engine (respecting active sleep fade-out in final 5s)
  useEffect(() => {
    if (sleepTimer.mode === 'countdown' && sleepTimer.remainingSeconds <= 5) {
      const fade = computeSleepFadeMultiplier(sleepTimer.remainingSeconds);
      audioEngine.setMasterVolume(masterVolume * fade);
    } else {
      audioEngine.setMasterVolume(masterVolume);
    }
  }, [masterVolume, sleepTimer.mode, sleepTimer.remainingSeconds]);

  // Countdown tick for Sleep Timer
  useEffect(() => {
    if (sleepTimer.mode !== 'countdown') return;
    const interval = window.setInterval(() => {
      setSleepTimer((prev) => {
        if (prev.mode !== 'countdown') return prev;
        const nextRemaining = prev.remainingSeconds - 1;
        if (nextRemaining <= 0) {
          audioEngine.stopPlayback();
          setIsPlaying(false);
          if (playbackRef.current) {
            cancelAnimationFrame(playbackRef.current);
            playbackRef.current = null;
          }
          audioEngine.setMasterVolume(masterVolume);
          return { mode: 'off', remainingSeconds: 0, totalSeconds: 0 };
        }
        return { ...prev, remainingSeconds: nextRemaining };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sleepTimer.mode, masterVolume]);

  // Keep end-of-track sleep timer countdown aligned with active track progress
  useEffect(() => {
    if (sleepTimer.mode !== 'end_of_track') return;
    const dur = Math.max(1, currentTrack.duration || 180);
    const remaining = Math.max(0, Math.round(dur * (1 - playbackProgress)));
    setSleepTimer((prev) =>
      prev.mode === 'end_of_track' && prev.remainingSeconds !== remaining
        ? { ...prev, remainingSeconds: remaining, totalSeconds: dur }
        : prev
    );
  }, [sleepTimer.mode, playbackProgress, currentTrack.duration]);

  const handleSetSleepTimer = (mode: SleepTimerMode, minutes?: number) => {
    if (mode === 'off') {
      setSleepTimer({ mode: 'off', remainingSeconds: 0, totalSeconds: 0 });
      audioEngine.setMasterVolume(masterVolume);
      return;
    }
    if (mode === 'end_of_track') {
      const dur = Math.max(1, currentTrack.duration || 180);
      const remaining = Math.max(1, Math.round(dur * (1 - playbackProgress)));
      setSleepTimer({
        mode: 'end_of_track',
        remainingSeconds: remaining,
        totalSeconds: dur,
      });
      return;
    }
    const safeMinutes = clampSleepMinutes(minutes ?? 15);
    const totalSec = safeMinutes * 60;
    setSleepTimer({
      mode: 'countdown',
      remainingSeconds: totalSec,
      totalSeconds: totalSec,
    });
  };

  // Helper to start playback for a given track (supports both real MP3 audioUrl, pitch variants, and LUFS normalization)
  const startTrackPlayback = (track: AudioTrack, startRatio: number = 0) => {
    audioEngine.setBpm(track.bpm);
    audioEngine.startPlayback(track.id, track.audioUrl, {
      startRatio,
      integratedLufs: track.lufs,
      pitchRate: track.pitchRate,
      onTimeUpdate: (curr, dur) => {
        const effectiveDur = dur > 0 ? dur : track.duration || 180;
        if (effectiveDur > 0) {
          setPlaybackProgress(Math.min(1, Math.max(0, curr / effectiveDur)));
        }
      },
      onEnded: () => {
        if (sleepTimerModeRef.current === 'end_of_track') {
          audioEngine.stopPlayback();
          setIsPlaying(false);
          setPlaybackProgress(0);
          setSleepTimer({ mode: 'off', remainingSeconds: 0, totalSeconds: 0 });
          return;
        }
        const catalog = tracksRef.current;
        const idx = catalog.findIndex((t) => t.id === track.id);
        const nextIdx = (idx + 1) % catalog.length;
        const nextTrack = catalog[nextIdx];
        if (nextTrack) {
          setCurrentTrack(nextTrack);
          setPlaybackProgress(0);
          startTrackPlayback(nextTrack, 0);
        } else {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }
      },
    });
  };

  // Apply authoritative remote Listening Room state to local audio engine
  const applyRemoteRoomState = (room: ListeningRoom) => {
    setActiveRoom(room);
    const matched =
      tracksRef.current.find((t) => t.id === room.trackId) ||
      room.trackSnapshot ||
      currentTrackRef.current;

    const targetDur = Math.max(1, matched.duration || room.trackDuration || 180);
    const syncedSeconds = computeSyncedPositionSeconds(
      {
        isPlaying: room.isPlaying,
        positionSeconds: room.positionSeconds,
        updatedAtMs: room.updatedAtMs,
        trackDuration: targetDur,
      },
      Date.now()
    );
    const targetRatio = Math.max(0, Math.min(1, syncedSeconds / targetDur));

    const trackChanged = currentTrackRef.current.id !== matched.id;
    const playStateChanged = isPlayingRef.current !== room.isPlaying;
    const localSeconds = playbackProgressRef.current * Math.max(1, currentTrackRef.current.duration || 180);
    const needsSeek = shouldSeekOnSync(localSeconds, syncedSeconds, 1.8);

    if (!trackChanged && !playStateChanged && !needsSeek) {
      return;
    }

    isApplyingRemoteRoomRef.current = true;
    try {
      if (trackChanged) {
        setCurrentTrack(matched);
      }
      setPlaybackProgress(targetRatio);

      if (room.isPlaying) {
        if (trackChanged || !isPlayingRef.current || needsSeek) {
          audioEngine.stopPlayback();
          startTrackPlayback(matched, targetRatio);
        }
        setIsPlaying(true);
      } else {
        audioEngine.stopPlayback();
        setIsPlaying(false);
      }
    } finally {
      window.setTimeout(() => {
        isApplyingRemoteRoomRef.current = false;
      }, 60);
    }
  };

  // Subscribe to real-time SSE + Firestore listener while connected to a Listening Room
  useEffect(() => {
    const roomCode = activeRoom?.code;
    if (!roomCode) return;

    const evtSource = new EventSource(`/api/rooms/${roomCode}/events`);
    const onRoomState = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed?.room) {
          applyRemoteRoomState(parsed.room as ListeningRoom);
        }
      } catch {
        // Ignore malformed frame
      }
    };
    const onRoomClosed = () => {
      setActiveRoom(null);
      setRoomError(`Listening room ${roomCode} was ended by the host.`);
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    };

    evtSource.addEventListener('room:state', onRoomState);
    evtSource.addEventListener('room:closed', onRoomClosed);

    const unsubFirestore = subscribeToListeningRoomFirestore(roomCode, () => {
      // SSE provides sub-second sync across devices; Firestore mirror keeps persistence warm
    });

    return () => {
      evtSource.removeEventListener('room:state', onRoomState);
      evtSource.removeEventListener('room:closed', onRoomClosed);
      evtSource.close();
      unsubFirestore();
    };
  }, [activeRoom?.code]);

  const canControlActiveRoom = (room: ListeningRoom | null) =>
    Boolean(room && (room.hostId === roomClientIdRef.current || room.allowGuestControl));

  const syncActiveRoomCommand = async (payload: {
    action: 'play' | 'pause' | 'seek' | 'track' | 'settings';
    positionSeconds?: number;
    track?: AudioTrack;
    isPlaying?: boolean;
    allowGuestControl?: boolean;
  }) => {
    if (!activeRoom || isApplyingRemoteRoomRef.current) return;
    if (!canControlActiveRoom(activeRoom)) return;

    try {
      const response = await fetch(`/api/rooms/${activeRoom.code}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: roomClientIdRef.current,
          ...payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRoomError(data?.error || 'Could not sync playback with room.');
        return;
      }
      if (data?.room) {
        applyRemoteRoomState(data.room as ListeningRoom);
      }

      if (authUser && activeRoom.hostUid === authUser.uid) {
        void updateListeningRoomInFirestore(activeRoom.code, {
          trackId: payload.track?.id,
          trackTitle: payload.track?.title,
          trackCreator: payload.track?.creator,
          trackCoverArt: payload.track?.coverArt,
          trackDuration: payload.track?.duration,
          isPlaying: payload.isPlaying,
          positionSeconds: payload.positionSeconds,
          allowGuestControl: payload.allowGuestControl,
        }).catch(() => {});
      }
    } catch {
      setRoomError('Network hiccup syncing with room.');
    }
  };

  const handleCreateRoom = async (params: {
    name: string;
    track: AudioTrack;
    displayName: string;
    allowGuestControl: boolean;
  }) => {
    setRoomError(null);
    setRoomLoading(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          hostId: roomClientIdRef.current,
          hostUid: authUser?.uid,
          hostName: params.displayName,
          track: params.track,
          isPlaying: false,
          positionSeconds: 0,
          allowGuestControl: params.allowGuestControl,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.room) {
        throw new Error(data?.error || 'Could not create listening room.');
      }

      const created = data.room as ListeningRoom;
      applyRemoteRoomState(created);

      const url = new URL(window.location.href);
      url.searchParams.set('room', created.code);
      window.history.replaceState({}, '', url.toString());

      if (authUser) {
        void saveListeningRoomToFirestore(
          {
            code: created.code,
            name: created.name,
            hostName: created.hostName,
            trackId: created.trackId,
            trackTitle: created.trackTitle,
            trackCreator: created.trackCreator,
            trackCoverArt: created.trackCoverArt,
            trackDuration: created.trackDuration,
            isPlaying: created.isPlaying,
            positionSeconds: created.positionSeconds,
            allowGuestControl: created.allowGuestControl,
          },
          authUser
        ).catch(() => {});
      }
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleJoinRoom = async (code: string, displayName: string) => {
    const cleaned = normalizeRoomCode(code);
    if (!isValidRoomCode(cleaned)) {
      setRoomError('Please enter a valid 4–8 character Room Code.');
      return;
    }
    setRoomError(null);
    setRoomLoading(true);
    try {
      const response = await fetch(`/api/rooms/${cleaned}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: roomClientIdRef.current,
          displayName: displayName || authUser?.displayName || 'Haven Listener',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.room) {
        throw new Error(data?.error || `Room ${cleaned} was not found.`);
      }
      applyRemoteRoomState(data.room as ListeningRoom);
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleaned);
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setRoomLoading(false);
    }
  };

  // Auto-join room from URL ?room=CODE when opened on another device or tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = normalizeRoomCode(params.get('room') || '');
    if (isValidRoomCode(roomParam)) {
      setCurrentTab('rooms');
      void handleJoinRoom(roomParam, authUser?.displayName || 'Synced Listener');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open shared track dossier when loaded via ?track=<id> unique share link
  const handledSharedTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sharedTrackId = parseTrackIdFromSearch(window.location.search);
    if (!sharedTrackId || handledSharedTrackIdRef.current === sharedTrackId) return;
    const matched = tracks.find((t) => t.id === sharedTrackId);
    if (matched) {
      handledSharedTrackIdRef.current = sharedTrackId;
      setCurrentTrack(matched);
      setPlaybackProgress(0);
      setTrackDetailsInitialEdit(false);
      setSelectedTrackForDetails(matched);
    }
  }, [tracks]);

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    const code = activeRoom.code;
    setActiveRoom(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
    try {
      await fetch(`/api/rooms/${code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: roomClientIdRef.current }),
      });
    } catch {
      // Ignore cleanup failures
    }
  };

  const handleCloseRoom = async () => {
    if (!activeRoom) return;
    const code = activeRoom.code;
    const hostUid = activeRoom.hostUid;
    setActiveRoom(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
    try {
      await fetch(`/api/rooms/${code}?clientId=${encodeURIComponent(roomClientIdRef.current)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: roomClientIdRef.current }),
      });
      if (authUser && hostUid === authUser.uid) {
        void deleteListeningRoomFromFirestore(code).catch(() => {});
      }
    } catch {
      // Ignore cleanup failures
    }
  };

  const handleResyncRoomClock = async () => {
    if (!activeRoom) return;
    try {
      const response = await fetch(`/api/rooms/${activeRoom.code}`);
      const data = await response.json();
      if (response.ok && data?.room) {
        applyRemoteRoomState(data.room as ListeningRoom);
      }
    } catch {
      setRoomError('Could not refresh room clock.');
    }
  };

  // Handle Play/Pause (synced across active room if joined and permitted)
  const handleTogglePlay = () => {
    if (activeRoom && canControlActiveRoom(activeRoom) && !isApplyingRemoteRoomRef.current) {
      const posSec = Math.round(playbackProgress * Math.max(1, currentTrack.duration || 180));
      void syncActiveRoomCommand({
        action: isPlaying ? 'pause' : 'play',
        positionSeconds: posSec,
        isPlaying: !isPlaying,
      });
      return;
    }

    if (isPlaying) {
      audioEngine.stopPlayback();
      setIsPlaying(false);
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
        playbackRef.current = null;
      }
    } else {
      startTrackPlayback(currentTrack, playbackProgress);
      setIsPlaying(true);
    }
  };

  // Fallback playback timer loop for synthetic tracks without audioUrl
  useEffect(() => {
    if (!isPlaying || currentTrack.audioUrl) {
      if (playbackRef.current) cancelAnimationFrame(playbackRef.current);
      return;
    }

    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setPlaybackProgress((prev) => {
        const duration = currentTrack.duration || 180;
        const next = prev + delta / duration;
        if (next >= 1) {
          if (sleepTimerModeRef.current === 'end_of_track') {
            setIsPlaying(false);
            setSleepTimer({ mode: 'off', remainingSeconds: 0, totalSeconds: 0 });
            return 0;
          }
          return 0; // loop
        }
        return next;
      });

      playbackRef.current = requestAnimationFrame(loop);
    };

    playbackRef.current = requestAnimationFrame(loop);

    return () => {
      if (playbackRef.current) cancelAnimationFrame(playbackRef.current);
    };
  }, [isPlaying, currentTrack.duration, currentTrack.audioUrl]);

  // Track selection (routes through active room when connected & permitted)
  const handleSelectTrack = (track: AudioTrack) => {
    if (activeRoom && canControlActiveRoom(activeRoom) && !isApplyingRemoteRoomRef.current) {
      void syncActiveRoomCommand({
        action: 'track',
        track,
        positionSeconds: 0,
        isPlaying: true,
      });
      return;
    }

    const wasPlaying = isPlaying;
    if (wasPlaying) {
      audioEngine.stopPlayback();
    }
    setCurrentTrack(track);
    setPlaybackProgress(0);
    audioEngine.setBpm(track.bpm);

    if (wasPlaying) {
      startTrackPlayback(track, 0);
      setIsPlaying(true);
    }
  };

  // Skip Next / Prev
  const handlePrevTrack = () => {
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + tracks.length) % tracks.length;
    handleSelectTrack(tracks[prevIdx]);
  };

  const handleNextTrack = () => {
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % tracks.length;
    handleSelectTrack(tracks[nextIdx]);
  };

  // Like track
  const handleLikeTrack = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, likes: t.isLiked ? t.likes - 1 : t.likes + 1, isLiked: !t.isLiked }
          : t
      )
    );
    if (currentTrack.id === trackId) {
      setCurrentTrack((prev) => ({
        ...prev,
        likes: prev.isLiked ? prev.likes - 1 : prev.likes + 1,
        isLiked: !prev.isLiked,
      }));
    }
  };

  // Publish new completed track from Upload (persisted to Firestore for authenticated Google user)
  const handlePublishTrack = async (newTrack: AudioTrack) => {
    if (!authUser) {
      throw new Error('You must sign in with a Google account to publish a track.');
    }
    await publishTrackToFirestore(newTrack, authUser);
    setTracks((prev) => [newTrack, ...prev.filter((t) => t.id !== newTrack.id)]);
    setCurrentTrack(newTrack);
    setPlaybackProgress(0);
  };

  // Update existing track title and metadata details (Admin can edit all songs; creators can edit only their own uploads)
  const handleUpdateTrack = async (trackId: string, updates: Partial<AudioTrack>) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target || !canEditTrack(target, authUser)) {
      throw new Error(`Permission denied: only the song uploader or Admin (${ADMIN_EMAIL}) can edit this song.`);
    }

    const safeUpdates = sanitizeTrackUpdates(updates);
    if (Object.keys(safeUpdates).length === 0) return;

    if (cloudTrackIds.has(trackId)) {
      await updateTrackInFirestore(trackId, safeUpdates);
    } else if (isAdmin && authUser?.uid) {
      await saveCatalogOverrideToFirestore(target, safeUpdates, authUser.uid);
    }

    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, ...safeUpdates } : t))
    );
    if (currentTrack.id === trackId) {
      setCurrentTrack((prev) => ({ ...prev, ...safeUpdates }));
    }
    if (selectedTrackForDetails?.id === trackId) {
      setSelectedTrackForDetails((prev) => (prev ? { ...prev, ...safeUpdates } : prev));
    }
  };

  // Take down (delete) song & deliver admin or auto-generated reason notice to owning creator
  const handleTakeDownTrack = async (
    target: AudioTrack,
    reason: string,
    autoGenerated: boolean
  ) => {
    if (!canDeleteTrack(target, authUser)) {
      throw new Error(`Permission denied: only the song uploader or Admin (${ADMIN_EMAIL}) can remove this song.`);
    }

    const noticeId = `td_${target.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}_${Date.now()}`;
    const targetUid = target.uploaderUid || 'catalog_curated';
    const localNotice: TrackTakedownNotice = {
      id: noticeId,
      trackId: target.id,
      trackTitle: target.title,
      creatorName: target.creator,
      targetUploaderUid: targetUid,
      reason,
      autoGenerated,
      adminEmail: authUser?.email || ADMIN_EMAIL,
      createdAt: 'Just now',
    };

    if (isAdmin && target.uploaderUid) {
      await createTakedownNoticeInFirestore({
        id: noticeId,
        trackId: target.id,
        trackTitle: target.title,
        creatorName: target.creator,
        targetUploaderUid: target.uploaderUid,
        reason,
        autoGenerated,
        adminEmail: authUser?.email || ADMIN_EMAIL,
      });
    }

    if (cloudTrackIds.has(target.id)) {
      await deleteTrackFromFirestore(target.id);
    } else {
      setTakenDownCatalogIds((prev) => new Set(prev).add(target.id));
    }

    setTakedownNotices((prev) => [localNotice, ...prev.filter((n) => n.id !== noticeId)]);
    const remaining = tracks.filter((t) => t.id !== target.id);
    setTracks(remaining);
    if (currentTrack.id === target.id && remaining.length > 0) {
      audioEngine.stopPlayback();
      setIsPlaying(false);
      setCurrentTrack(remaining[0]);
      setPlaybackProgress(0);
    }
    if (selectedTrackForDetails?.id === target.id) {
      setSelectedTrackForDetails(null);
      setTrackDetailsInitialEdit(false);
    }
  };

  const openTrackModal = (track: AudioTrack, editMode: boolean = false) => {
    const allowedEdit = editMode && canEditTrack(track, authUser);
    setTrackDetailsInitialEdit(allowedEdit);
    setSelectedTrackForDetails(track);
  };

  // Add Comment / Review
  const handleAddComment = (trackId: string, text: string, rating: number) => {
    const activeName = authUser?.displayName || 'Haven Listener';
    const activeHandle = buildCreatorHandle(authUser?.displayName, authUser?.uid);
    const activeAvatar =
      authUser?.photoURL ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

    const newComment = {
      id: `c-${Date.now()}`,
      userName: activeName,
      userHandle: activeHandle,
      userAvatar: activeAvatar,
      text,
      timestamp: 'Just now',
      rating,
      likes: 1,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, comments: [newComment, ...t.comments] } : t
      )
    );

    if (selectedTrackForDetails?.id === trackId) {
      setSelectedTrackForDetails((prev) =>
        prev ? { ...prev, comments: [newComment, ...prev.comments] } : prev
      );
    }
  };

  // Add Community Post
  const handleAddPost = (content: string, trackId?: string) => {
    const activeName = authUser?.displayName || 'Haven Creator';
    const activeHandle = buildCreatorHandle(authUser?.displayName, authUser?.uid);
    const activeAvatar =
      authUser?.photoURL ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      creator: activeName,
      creatorHandle: activeHandle,
      creatorAvatar: activeAvatar,
      content,
      trackId,
      timestamp: 'Just now',
      likes: 1,
      commentsCount: 0,
      reposts: 0,
      isLiked: true,
    };
    setPosts((prev) => [newPost, ...prev]);
  };

  // Create Playlist
  const handleCreatePlaylist = (title: string, description: string, isPublic: boolean) => {
    const activeName = authUser?.displayName || 'Haven Creator';
    const activeHandle = buildCreatorHandle(authUser?.displayName, authUser?.uid);

    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      title,
      description,
      coverArt: currentTrack.coverArt,
      creator: activeName,
      creatorHandle: activeHandle,
      isPublic,
      isCollaborative: false,
      trackIds: [currentTrack.id],
      likes: 1,
      updatedAt: 'Just now',
    };
    setPlaylists((prev) => [newPl, ...prev]);
  };

  // Resolve Copyright report
  const handleResolveReport = (reportId: string, action: 'Dismissed' | 'Resolved') => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: action } : r))
    );
  };

  // Set Featured track
  const handleSetFeaturedTrack = (trackId: string) => {
    const found = tracks.find((t) => t.id === trackId);
    if (found) {
      setTracks((prev) => [found, ...prev.filter((t) => t.id !== trackId)]);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080C] text-[#e4e1e8] flex flex-col font-sans selection:bg-[#8B5CF6]/30 selection:text-[#acedff]">
      {/* Global Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSearch={() => {
          if (currentTab !== 'explore') setCurrentTab('explore');
        }}
        takedowns={takedownNotices}
        activeRoomCode={activeRoom?.code || null}
        userTier={userTier}
        authUser={authUser}
        authLoading={authLoading}
        onSignInGoogle={() => void handleSignInGoogle()}
        onSignOut={() => void handleSignOut()}
      />

      {/* Main View Port Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'home' && (
          <HomeView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onSelectTab={setCurrentTab}
            onOpenTrackDetails={(track) => setSelectedTrackForDetails(track)}
            onLikeTrack={handleLikeTrack}
            playlists={playlists}
            creators={creators}
          />
        )}

        {currentTab === 'explore' && (
          <ExploreView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onOpenTrackDetails={(track) => setSelectedTrackForDetails(track)}
            onLikeTrack={handleLikeTrack}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentTab === 'genres' && (
          <GenresView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onOpenTrackDetails={(track) => setSelectedTrackForDetails(track)}
            onLikeTrack={handleLikeTrack}
          />
        )}

        {currentTab === 'ai-discovery' && (
          <AIDiscoveryView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onOpenTrackDetails={(track) => setSelectedTrackForDetails(track)}
            onLikeTrack={handleLikeTrack}
            aiQuota={aiQuota}
            aiQuotaRequestContext={aiQuotaRequestContext}
            onAiQuotaUpdate={handleAiQuotaUpdate}
          />
        )}

        {currentTab === 'community' && (
          <CommunityView
            posts={posts}
            creators={creators}
            playlists={playlists}
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onOpenTrackDetails={(track) => setSelectedTrackForDetails(track)}
            onLikeTrack={handleLikeTrack}
            onAddPost={handleAddPost}
          />
        )}

        {currentTab === 'upload' && (
          <UploadView
            authUser={authUser}
            authLoading={authLoading}
            aiQuota={aiQuota}
            aiQuotaRequestContext={aiQuotaRequestContext}
            onAiQuotaUpdate={handleAiQuotaUpdate}
            onSignInGoogle={handleSignInGoogle}
            onPublishTrack={handlePublishTrack}
            onGoToTrack={(track) => setSelectedTrackForDetails(track)}
          />
        )}

        {currentTab === 'library' && (
          <LibraryView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onOpenTrackDetails={(track) => setSelectedTrackForDetails(track)}
            onLikeTrack={handleLikeTrack}
            playlists={playlists}
            onCreatePlaylist={handleCreatePlaylist}
            creators={creators}
          />
        )}

        {currentTab === 'creator-dashboard' && (
          <CreatorDashboardView
            tracks={tracks}
            takedowns={takedownNotices}
            authUser={authUser}
            aiQuota={aiQuota}
            onSignInGoogle={() => void handleSignInGoogle()}
            onNavigateToUpload={() => setCurrentTab('upload')}
            onOpenAdminDashboard={isAdmin ? () => setCurrentTab('admin') : undefined}
            onOpenTrackDetails={(track) => openTrackModal(track, false)}
            onEditTrackDetails={(track) => openTrackModal(track, true)}
          />
        )}

        {currentTab === 'pricing' && (
          <PricingView
            currentTier={userTier}
            onSelectTier={setUserTier}
            aiQuota={aiQuota}
          />
        )}

        {currentTab === 'rooms' && (
          <RoomsView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            activeRoom={activeRoom}
            roomClientId={roomClientIdRef.current}
            defaultDisplayName={authUser?.displayName || 'Haven Listener'}
            roomError={roomError}
            roomLoading={roomLoading}
            isSignedIn={Boolean(authUser)}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onLeaveRoom={handleLeaveRoom}
            onCloseRoom={handleCloseRoom}
            onRoomPlayPause={async () => {
              const posSec = Math.round(playbackProgress * Math.max(1, currentTrack.duration || 180));
              await syncActiveRoomCommand({
                action: isPlaying ? 'pause' : 'play',
                positionSeconds: posSec,
                isPlaying: !isPlaying,
              });
            }}
            onRoomSeek={async (ratio) => {
              const posSec = Math.round(ratio * Math.max(1, currentTrack.duration || 180));
              setPlaybackProgress(ratio);
              audioEngine.seekAudio(ratio, currentTrack.duration);
              await syncActiveRoomCommand({
                action: 'seek',
                positionSeconds: posSec,
              });
            }}
            onRoomSelectTrack={async (track) => {
              await syncActiveRoomCommand({
                action: 'track',
                track,
                positionSeconds: 0,
                isPlaying: true,
              });
            }}
            onRoomToggleGuestControl={async (allow) => {
              await syncActiveRoomCommand({
                action: 'settings',
                allowGuestControl: allow,
              });
            }}
            onResyncClock={handleResyncRoomClock}
            onClearError={() => setRoomError(null)}
          />
        )}

        {currentTab === 'admin' && isAdmin && (
          <AdminView
            adminEmail={authUser?.email}
            reports={reports}
            tracks={tracks}
            takedowns={takedownNotices}
            onOpenTrackDetails={(track) => openTrackModal(track, false)}
            onEditTrackDetails={(track) => openTrackModal(track, true)}
            onTakeDownTrack={handleTakeDownTrack}
            onResolveReport={handleResolveReport}
            onSetFeaturedTrack={handleSetFeaturedTrack}
          />
        )}
      </main>

      {/* Persistent Audio Master Player Docked at Bottom */}
      <MasterPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        playbackProgress={playbackProgress}
        onSeek={(ratio) => {
          setPlaybackProgress(ratio);
          audioEngine.seekAudio(ratio, currentTrack.duration);
          if (activeRoom && canControlActiveRoom(activeRoom) && !isApplyingRemoteRoomRef.current) {
            const posSec = Math.round(ratio * Math.max(1, currentTrack.duration || 180));
            void syncActiveRoomCommand({ action: 'seek', positionSeconds: posSec });
          }
        }}
        masterVolume={masterVolume}
        onChangeVolume={setMasterVolume}
        onOpenSpectralModal={() => setIsSpectralModalOpen(true)}
        onLikeTrack={handleLikeTrack}
        queue={tracks}
        onSelectTrack={handleSelectTrack}
        onOpenTrackDetails={(track) => openTrackModal(track, false)}
        sleepTimer={sleepTimer}
        onSetSleepTimer={handleSetSleepTimer}
        activeRoomCode={activeRoom?.code || null}
        onOpenRooms={() => setCurrentTab('rooms')}
      />

      {/* Track Details Modal */}
      <TrackDetailsModal
        track={selectedTrackForDetails}
        isOpen={Boolean(selectedTrackForDetails)}
        initialEditMode={trackDetailsInitialEdit}
        canEdit={canEditTrack(selectedTrackForDetails, authUser)}
        permissionRole={getTrackPermissionRole(selectedTrackForDetails, authUser)}
        aiQuota={aiQuota}
        aiQuotaRequestContext={aiQuotaRequestContext}
        onAiQuotaUpdate={handleAiQuotaUpdate}
        onClose={() => {
          setSelectedTrackForDetails(null);
          setTrackDetailsInitialEdit(false);
        }}
        isPlaying={isPlaying && currentTrack.id === selectedTrackForDetails?.id}
        playbackProgress={currentTrack.id === selectedTrackForDetails?.id ? playbackProgress : 0}
        onSeek={(ratio) => {
          if (selectedTrackForDetails && currentTrack.id !== selectedTrackForDetails.id) {
            handleSelectTrack(selectedTrackForDetails);
          }
          setPlaybackProgress(ratio);
          audioEngine.seekAudio(ratio, selectedTrackForDetails?.duration || currentTrack.duration);
          if (activeRoom && canControlActiveRoom(activeRoom) && !isApplyingRemoteRoomRef.current) {
            const posSec = Math.round(
              ratio * Math.max(1, selectedTrackForDetails?.duration || currentTrack.duration || 180)
            );
            void syncActiveRoomCommand({ action: 'seek', positionSeconds: posSec });
          }
        }}
        onTogglePlay={() => {
          if (selectedTrackForDetails) {
            if (currentTrack.id === selectedTrackForDetails.id) {
              handleTogglePlay();
            } else {
              handleSelectTrack(selectedTrackForDetails);
            }
          }
        }}
        onLikeTrack={handleLikeTrack}
        onAddComment={handleAddComment}
        onUpdateTrack={handleUpdateTrack}
        relatedTracks={tracks.filter(
          (t) => t.id !== selectedTrackForDetails?.id && t.genre === selectedTrackForDetails?.genre
        )}
        onSelectTrack={(t) => {
          handleSelectTrack(t);
          openTrackModal(t, false);
        }}
      />

      {/* Real-Time Spectral Luminescence FFT Modal */}
      <SpectralVisualizerModal
        isOpen={isSpectralModalOpen}
        onClose={() => setIsSpectralModalOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  );
}
