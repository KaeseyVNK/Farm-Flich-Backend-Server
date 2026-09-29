import assert from "node:assert/strict";
import { resolveGoogleLink, resolveGoogleLogin } from "../src/lib/unity/google-auth-service.ts";

class MemoryDb {
  users = new Map();
  farms = new Map();
  credentials = new Map();
  failCredentialCreate = false;
  async $transaction(work) {
    const snapshot = structuredClone({ users: this.users, farms: this.farms, credentials: this.credentials });
    const tx = {
      user: {
        findUnique: async ({ where }) => this.users.get(where.id) || null,
        create: async ({ data }) => {
          if (this.users.has(data.id)) throw Object.assign(new Error("unique violation"), { code: "P2002" });
          this.users.set(data.id, { ...data }); return this.users.get(data.id);
        },
      },
      farm: {
        findUnique: async ({ where }) => this.farms.get(where.ownerId) || null,
        create: async ({ data }) => {
          if (this.farms.has(data.ownerId)) throw Object.assign(new Error("unique violation"), { code: "P2002" });
          this.farms.set(data.ownerId, { ...data }); return this.farms.get(data.ownerId);
        },
      },
      unityCredential: {
        findUnique: async ({ where }) => [...this.credentials.values()].find(record => Object.entries(where).every(([key, value]) => record[key] === value)) || null,
        create: async ({ data }) => {
          if (this.failCredentialCreate) { this.failCredentialCreate = false; throw new Error("simulated insert failure"); }
          if ([...this.credentials.values()].some(r => r.userId === data.userId || r.email === data.email || r.googleSub === data.googleSub)) {
            throw Object.assign(new Error("unique violation"), { code: "P2002" });
          }
          this.credentials.set(data.userId, { ...data }); return this.credentials.get(data.userId);
        },
        update: async ({ where, data }) => {
          const row = this.credentials.get(where.userId); if (!row) throw new Error("record missing");
          Object.assign(row, data); return row;
        },
      },
    };
    try { return await work(tx); }
    catch (error) { this.users = snapshot.users; this.farms = snapshot.farms; this.credentials = snapshot.credentials; throw error; }
  }
}

const db = new MemoryDb();
assert.deepEqual(await resolveGoogleLogin(db, " bad ", "sub"), { ok: false, code: "INVALID_IDENTITY" });
const first = await resolveGoogleLogin(db, " Alice@Example.com ", "sub-alice");
assert.equal(first.ok, true); assert.equal(first.playerId, "alice@example.com"); assert.equal(first.message, "Account created");
assert.equal(db.farms.size, 1); assert.equal(db.users.size, 1);
assert.equal(db.users.get(first.playerId).characterSetupRequired, true);
assert.equal(db.credentials.get(first.playerId).salt, null);
assert.equal((await resolveGoogleLogin(db, "alice@example.com", "sub-alice")).playerId, first.playerId);

const changedEmail = await resolveGoogleLogin(db, "alice2@example.com", "sub-alice");
assert.equal(changedEmail.playerId, first.playerId); assert.equal(db.farms.has(first.playerId), true);
assert.equal((await resolveGoogleLogin(db, "alice2@example.com", "other-sub")).code, "GOOGLE_SUB_MISMATCH");

db.credentials.set("password@example.com", { userId: "password@example.com", email: "password@example.com", googleSub: null, salt: "salt", hash: "hash" });
assert.equal((await resolveGoogleLogin(db, "password@example.com", "new-sub")).code, "ACCOUNT_LINK_REQUIRED");
assert.equal(db.credentials.get("password@example.com").googleSub, null);
const linked = await resolveGoogleLink(db, "password@example.com", "password@example.com", "new-sub");
assert.equal(linked.ok, true); assert.equal((await resolveGoogleLink(db, "password@example.com", "password@example.com", "new-sub")).ok, true);
assert.equal((await resolveGoogleLink(db, "missing", "missing@example.com", "missing-sub")).code, "PLAYER_NOT_FOUND");

db.credentials.set("other", { userId: "other", email: null, googleSub: "taken-sub", salt: "s", hash: "h" });
db.credentials.set("other-password", { userId: "other-password", email: "other-password@example.com", googleSub: null, salt: "s", hash: "h" });
assert.equal((await resolveGoogleLink(db, "other-password", "other-password@example.com", "taken-sub")).code, "GOOGLE_SUB_IN_USE");
const emailOwnerBeforeCollision = structuredClone(db.credentials.get(first.playerId));
const contenderBeforeCollision = structuredClone(db.credentials.get("other-password"));
assert.equal((await resolveGoogleLink(db, "other-password", "alice2@example.com", "another-sub")).code, "EMAIL_IN_USE");
assert.deepEqual(db.credentials.get(first.playerId), emailOwnerBeforeCollision);
assert.deepEqual(db.credentials.get("other-password"), contenderBeforeCollision);
assert.equal((await resolveGoogleLogin(db, "alice2@example.com", "another-sub")).code, "GOOGLE_SUB_MISMATCH");

db.credentials.set("reserved@example.com", { userId: "reserved@example.com", email: null, googleSub: null, salt: "s", hash: "h" });
assert.equal((await resolveGoogleLink(db, "other-password", "reserved@example.com", "another-sub")).code, "EMAIL_IN_USE");
assert.equal(db.credentials.get("other-password").email, "other-password@example.com");
assert.equal((await resolveGoogleLogin(db, "reserved@example.com", "sub-alice")).code, "EMAIL_IN_USE");
assert.equal(db.credentials.get(first.playerId).email, "alice2@example.com");

const rollbackDb = new MemoryDb(); rollbackDb.failCredentialCreate = true;
await assert.rejects(resolveGoogleLogin(rollbackDb, "rollback@example.com", "rollback-sub"));
assert.equal(rollbackDb.users.size, 0); assert.equal(rollbackDb.farms.size, 0); assert.equal(rollbackDb.credentials.size, 0);
console.log("Google cloud identity service: 19 isolated checks passed.");
