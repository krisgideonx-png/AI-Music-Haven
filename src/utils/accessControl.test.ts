import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_EMAIL,
  isAdminUser,
  canEditTrack,
  canDeleteTrack,
  getTrackPermissionRole,
  getCreatorUploadedTracks,
} from './accessControl';

test('isAdminUser grants access exclusively to verified xtianboy5@gmail.com', () => {
  assert.equal(ADMIN_EMAIL, 'xtianboy5@gmail.com');

  assert.equal(
    isAdminUser({ uid: 'admin-1', email: 'xtianboy5@gmail.com', emailVerified: true }),
    true
  );
  assert.equal(
    isAdminUser({ uid: 'admin-1', email: 'Xtianboy5@gmail.com', emailVerified: true }),
    true
  );

  // Unverified email spoofing attempt must fail
  assert.equal(
    isAdminUser({ uid: 'spoof-1', email: 'xtianboy5@gmail.com', emailVerified: false }),
    false
  );

  // Other accounts and null must fail
  assert.equal(
    isAdminUser({ uid: 'user-2', email: 'Elitically@gmail.com', emailVerified: true }),
    false
  );
  assert.equal(
    isAdminUser({ uid: 'user-3', email: 'creator@example.com', emailVerified: true }),
    false
  );
  assert.equal(isAdminUser(null), false);
});

test('canEditTrack lets admin edit ALL songs while creators can ONLY edit their own uploads', () => {
  const admin = { uid: 'admin-uid', email: 'xtianboy5@gmail.com', emailVerified: true };
  const creatorA = { uid: 'creator-a', email: 'artistA@gmail.com', emailVerified: true };
  const creatorB = { uid: 'creator-b', email: 'artistB@gmail.com', emailVerified: true };

  const seededSong = { uploaderUid: undefined };
  const songByA = { uploaderUid: 'creator-a' };
  const songByB = { uploaderUid: 'creator-b' };

  // Unauthenticated users cannot edit any song
  assert.equal(canEditTrack(seededSong, null), false);
  assert.equal(canEditTrack(songByA, null), false);

  // Admin can edit all songs (seeded + any creator upload)
  assert.equal(canEditTrack(seededSong, admin), true);
  assert.equal(canEditTrack(songByA, admin), true);
  assert.equal(canEditTrack(songByB, admin), true);
  assert.equal(canDeleteTrack(songByB, admin), true);
  assert.equal(getTrackPermissionRole(songByA, admin), 'admin');

  // Creator A can edit ONLY their own uploads
  assert.equal(canEditTrack(songByA, creatorA), true);
  assert.equal(getTrackPermissionRole(songByA, creatorA), 'owner');
  assert.equal(canEditTrack(songByB, creatorA), false);
  assert.equal(canEditTrack(seededSong, creatorA), false);
  assert.equal(getTrackPermissionRole(songByB, creatorA), 'readonly');

  // Creator B can edit ONLY their own uploads
  assert.equal(canEditTrack(songByB, creatorB), true);
  assert.equal(canEditTrack(songByA, creatorB), false);
});

test('getCreatorUploadedTracks filters catalog strictly to tracks uploaded by the user', () => {
  const creatorA = { uid: 'creator-a', email: 'artistA@gmail.com', emailVerified: true };
  const tracks = [
    { id: '1', uploaderUid: undefined },
    { id: '2', uploaderUid: 'creator-a' },
    { id: '3', uploaderUid: 'creator-b' },
    { id: '4', uploaderUid: 'creator-a' },
  ];

  assert.deepEqual(
    getCreatorUploadedTracks(tracks, creatorA).map((t) => t.id),
    ['2', '4']
  );
  assert.deepEqual(getCreatorUploadedTracks(tracks, null), []);
});
