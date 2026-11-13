# Security Specification — AI Music Haven

## 1. Data Invariants
1. **Verified Google Auth Gate**: No user may publish a track, edit a track, delete a track, post a comment, or write a private profile unless `request.auth != null && request.auth.token.email_verified == true`.
2. **Ownership Integrity**: Every track document MUST set `uploaderUid == request.auth.uid` on creation, and `uploaderUid` and `createdAt` are immutable across updates.
3. **Zero PII Exposure**: Public `/tracks/{trackId}` and `/tracks/{trackId}/comments/{commentId}` documents strictly whitelist non-PII fields via `keys().hasOnly(...)` and explicitly block `email`, `phone`, or `address`. User emails reside solely in the split private path `/users/{userId}/private/profile` readable only by `isOwner(userId)` or `isAdmin()`.
4. **Path Variable & Payload Size Hardening**: All document IDs (`trackId`, `commentId`, `userId`) must match `^[a-zA-Z0-9_\-]+$` and stay `<= 128` characters. All strings enforce `.size()` caps, arrays (`instruments <= 10`, `waveform <= 128`) are strictly bounded and type-checked, and `createdAt` / `updatedAt` must equal `request.time`.
5. **Non-Admin Privilege Containment**: Only an admin (`isAdmin()`) may set or modify popularity counters (`plays`, `likes`, `downloads`, `reposts`, `rating`, `ratingCount`) or alter `tier` on `/users/{userId}/private/profile` after creation (`Free` only on client self-create unless admin).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Upload**: Anonymous request (`auth == null`) calls `create` on `/tracks/trk_001`.
2. **Unverified Email Upload**: Authenticated user with `email_verified == false` calls `create` on `/tracks/trk_001`.
3. **Identity Spoofing**: User A (`uid: "userA"`) attempts `create` on `/tracks/trk_002` with `uploaderUid: "userB"`.
4. **Shadow / Ghost Field Injection**: User A creates `/tracks/trk_003` including an unexpected `"isVerified": true` or `"email": "a@example.com"` ghost field.
5. **Value Poisoning**: User A updates `/tracks/trk_001` setting `title` to a 5,000-character string or `bpm: 9999`.
6. **ID Poisoning**: User A calls `create` on `/tracks/bad..id..with..1500..chars...`.
7. **Timestamp Forgery**: User A creates `/tracks/trk_004` with a backdated client timestamp `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()`.
8. **Immutable Field Tampering**: User A updates `/tracks/trk_001` attempting to transfer `uploaderUid` or rewrite `createdAt`.
9. **Counter Manipulation**: User A updates their own track attempting to inflate `plays: 999999` or `downloads: 50000`.
10. **PII Blanket Read Attack**: Authenticated User B attempts `get` on `/users/userA/private/profile`.
11. **Email Spoofing Admin Bypass**: Attacker with custom unverified token `email: "xtianboy5@gmail.com"`, `email_verified: false` tries admin update/delete on User A's track.
12. **Orphaned Comment Write**: User A attempts `create` on `/tracks/nonexistent_track/comments/c_1` where parent track does not exist.

## 3. Verification Strategy
- Static ESLint verification via `@firebase/eslint-plugin-security-rules` against `DRAFT_firestore.rules` and `firestore.rules`.
- Automated Node assertion suite (`src/utils/firestoreRulesAudit.test.ts`) verifying all 8 Pillars, zero blanket reads, strict `keys().hasAll`/`hasOnly`, `affectedKeys().hasOnly`, `request.time`, `email_verified == true`, `isValidId`, and `exists()` parent checks.
- Client mutation sanitization tested in `src/utils/trackCategorizer.test.ts`.
