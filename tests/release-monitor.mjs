import assert from "node:assert/strict";
import { createDatabase } from "./setup-database.mjs";

const db = await createDatabase();
const payload = {
  commit: "a".repeat(40),
  version: "2.0.20261009223358-aaaaaaa",
  pack: 2,
  published_at: "2026-10-09T22:33:58Z",
  changes: ["Cada equipe ganhou seu espaço.", "O chat recebe anexos privados."],
};
const record = async (data) =>
  (
    await db.query("select private.record_site_release($1)", [
      JSON.stringify(data),
    ])
  ).rows[0].record_site_release;
assert.equal(await record(payload), true);
assert.equal(await record(payload), false);
assert.equal(
  (
    await db.query(
      "select count(*)::int as total from public.site_updates where release_tag=$1",
      [payload.version],
    )
  ).rows[0].total,
  1,
);
for (const invalid of [
  { ...payload, commit: "bad" },
  { ...payload, changes: [] },
  { ...payload, changes: ["x".repeat(1201)] },
  { ...payload, pack: 0 },
  { ...payload, published_at: "bad" },
])
  assert.equal(await record(invalid), false);
await db.exec("set role anon");
await assert.rejects(
  db.query("select private.record_site_release($1)", [JSON.stringify(payload)]),
  /permission denied/,
);
await db.exec("reset role");
await db.exec("select private.poll_site_release()");
const queued = (
  await db.query("select request_id from private.release_monitor")
).rows[0].request_id;
assert.ok(queued);
await db.query(
  "insert into net._http_response(id,status_code,content) values($1,200,$2)",
  [
    queued,
    JSON.stringify({
      ...payload,
      commit: "b".repeat(40),
      version: "2.0.20261009223458-bbbbbbb",
    }),
  ],
);
await db.exec("select private.poll_site_release()");
assert.equal(
  (
    await db.query(
      "select count(*)::int as total from public.site_updates where kind='release'",
    )
  ).rows[0].total,
  2,
);
assert.equal(
  (await db.query("select last_error from private.release_monitor")).rows[0]
    .last_error,
  null,
);
await db.close();
process.stdout.write(
  "10 verificações do registro automático e privado de publicações aprovadas.\n",
);
