// Run only against an isolated loopback database and Next server.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const base = process.env.TEST_UNITY_API_BASE;
const token = process.env.TEST_UNITY_BRIDGE_TOKEN;
const dbUrl = process.env.DATABASE_URL;
if (!base || !token || !dbUrl || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
    !/^postgresql:\/\/[^@/]*@127\.0\.0\.1:\d+\/[^?]*test[^?]*/.test(dbUrl)) {
  throw new Error('Use an isolated loopback test API and database.');
}

const db = new PrismaClient();
const suffix = crypto.randomBytes(4).toString('hex');
const email = `setup-${suffix}@example.com`;
const otherEmail = `other-${suffix}@example.com`;
const thirdEmail = `third-${suffix}@example.com`;
const registrationRaceEmail = `reg-${suffix}@example.com`;
const username = `u${suffix}`;
const legacyId = `legacy_long_${suffix}`;
const registrationRaceName = `z${suffix}`;
const post = async (path, body) => {
  const res = await fetch(base + path, { method: 'POST', headers: {
    'Content-Type': 'application/json', 'x-bridge-token': token,
  }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

try {
  const created = await post('/api/unity/auth/google', { email, googleSub: `sub-${suffix}` });
  assert.equal(created.status, 200);
  assert.equal(created.body.playerId, email);
  assert.equal(created.body.needsUsernameSetup, true);
  const userBefore = await db.user.findUnique({ where: { id: email }, include: { farm: true, unityCredential: true } });
  assert.equal(userBefore?.usernameSetupRequired, true);
  assert.ok(userBefore?.farm);
  assert.equal(userBefore?.unityCredential?.hash, null);

  assert.equal((await post('/api/unity/auth/setup-username', { playerId: email, username: 'long_username', password: 'secret4' })).status, 400);
  assert.equal((await post('/api/unity/auth/login', { username: 'long_username', password: 'secret4' })).status, 400);
  const setup = await post('/api/unity/auth/setup-username', { playerId: email, username, password: 'secret4' });
  assert.equal(setup.status, 200);
  assert.equal(setup.body.playerId, email);
  const userAfter = await db.user.findUnique({ where: { id: email }, include: { farm: true, unityCredential: true } });
  assert.equal(userAfter?.usernameSetupRequired, false);
  assert.equal(userAfter?.farm?.id, userBefore?.farm?.id);
  assert.equal(userAfter?.unityCredential?.username, username);
  assert.ok(userAfter?.unityCredential?.hash);
  assert.notEqual(userAfter?.unityCredential?.hash, 'secret4');
  assert.equal((await post('/api/unity/auth/setup-username', { playerId: email, username, password: 'secret4' })).status, 200);
  assert.equal((await post('/api/unity/auth/setup-username', { playerId: email, username, password: 'wrong' })).status, 409);

  const byPassword = await post('/api/unity/auth/login', { username, password: 'secret4' });
  assert.equal(byPassword.status, 200);
  assert.equal(byPassword.body.playerId, email);
  assert.equal((await post('/api/unity/auth/login', { username, password: 'wrong' })).status, 401);
  const byGoogle = await post('/api/unity/auth/google', { email, googleSub: `sub-${suffix}` });
  assert.equal(byGoogle.body.playerId, email);
  assert.equal(byGoogle.body.needsUsernameSetup, false);
  assert.equal(byGoogle.body.username, username);

  const other = await post('/api/unity/auth/google', { email: otherEmail, googleSub: `other-sub-${suffix}` });
  assert.equal(other.status, 200);
  const collision = await post('/api/unity/auth/setup-username', { playerId: otherEmail, username, password: 'secret4' });
  assert.equal(collision.status, 409);
  assert.equal(collision.body.code, 'USERNAME_IN_USE');
  assert.equal((await db.user.findUnique({ where: { id: otherEmail } }))?.usernameSetupRequired, true);

  assert.equal((await post('/api/unity/auth/google', { email: thirdEmail, googleSub: `third-sub-${suffix}` })).status, 200);
  const raceAlias = `r${suffix}`;
  const contenders = await Promise.all([
    post('/api/unity/auth/setup-username', { playerId: otherEmail, username: raceAlias, password: 'secret4' }),
    post('/api/unity/auth/setup-username', { playerId: thirdEmail, username: raceAlias, password: 'secret4' }),
  ]);
  assert.deepEqual(contenders.map(x => x.status).sort(), [200, 409]);
  assert.equal(await db.unityCredential.count({ where: { username: raceAlias } }), 1);

  assert.equal((await post('/api/unity/auth/google', { email: registrationRaceEmail, googleSub: `reg-sub-${suffix}` })).status, 200);
  const crossRace = await Promise.all([
    post('/api/unity/auth/setup-username', { playerId: registrationRaceEmail, username: registrationRaceName, password: 'secret4' }),
    post('/api/unity/auth/login', { username: registrationRaceName, password: 'secret4' }),
  ]);
  assert.deepEqual(crossRace.map(x => x.status).sort(), [200, 409]);
  const idOwner = await db.unityCredential.findUnique({ where: { userId: registrationRaceName } });
  const aliasOwner = await db.unityCredential.findUnique({ where: { username: registrationRaceName } });
  assert.equal(Number(!!idOwner) + Number(!!aliasOwner), 1);

  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync('secret4', salt, 64).toString('hex');
  await db.user.create({ data: { id: legacyId, displayName: legacyId, farm: { create: {
    terrain: new Array(3600).fill(0), crops: {}, objects: {}, forage: {}, shippingBoxes: {}, gameMeta: {},
  } }, unityCredential: { create: { salt: salt.toString('hex'), hash } } } });
  const legacy = await post('/api/unity/auth/login', { username: legacyId, password: 'secret4' });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.playerId, legacyId);
  console.log('Cloud username setup smoke: migration, Google, password alias, conflicts, legacy login passed.');
} finally {
  await db.user.deleteMany({ where: { id: { in: [email, otherEmail, thirdEmail, registrationRaceEmail, registrationRaceName, legacyId] } } });
  await db.$disconnect();
}
