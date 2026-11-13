import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules satisfies all 8 security pillars and blueprint collections', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  // Pillar 1 & Global Safety Net
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  // Pillar 2 & 3: ID Validation + Validation Helpers
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /isValidTrackCreate/);
  assert.match(rules, /isValidTrackUpdate/);
  assert.match(rules, /isValidCommentCreate/);
  assert.match(rules, /isValidUserPrivateCreate/);

  // Verified Google Email mandate & Admin check
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /xtianboy5@gmail\.com/);
  assert.equal(/Elitically@gmail\.com/.test(rules), false);

  // Temporal integrity & immutability
  assert.match(rules, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
  assert.match(rules, /incoming\(\)\.uploaderUid\s*==\s*existing\(\)\.uploaderUid/);

  // Pillar 6: Split PII isolation & zero blanket reads
  assert.equal(/allow read:\s*if\s*isSignedIn\(\);/.test(rules), false);
  assert.match(rules, /match \/users\/\{userId\}\/private\/profile/);
  assert.match(rules, /allow list:\s*if false;/);

  // Every blueprint firestore path has a matching block in rules
  const blueprintPaths = Object.keys(blueprint.firestore || {});
  assert.ok(blueprintPaths.includes('/tracks/{trackId}'));
  assert.ok(blueprintPaths.includes('/tracks/{trackId}/comments/{commentId}'));
  assert.ok(blueprintPaths.includes('/users/{userId}/private/profile'));
  assert.ok(blueprintPaths.includes('/admins/{userId}'));
  assert.ok(blueprintPaths.includes('/catalog_overrides/{trackId}'));
  assert.ok(blueprintPaths.includes('/takedowns/{takedownId}'));
  assert.ok(blueprintPaths.includes('/listening_rooms/{roomCode}'));
  assert.match(rules, /match \/catalog_overrides\/\{trackId\}/);
  assert.match(rules, /match \/takedowns\/\{takedownId\}/);
  assert.match(rules, /match \/listening_rooms\/\{roomCode\}/);
  assert.match(rules, /isValidTakedown/);
  assert.match(rules, /isValidListeningRoom/);
  assert.match(rules, /isBoundedString\(data\.story, 0, 1500\)/);
  assert.match(rules, /isBoundedString\(data\.lyrics, 0, 4000\)/);
  assert.match(rules, /aiCreditsUsed/);
});
