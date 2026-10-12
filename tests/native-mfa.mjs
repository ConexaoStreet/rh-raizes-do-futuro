import assert from "node:assert/strict";
import { createDatabase } from "./setup-database.mjs";

const db = await createDatabase();
const uid = (n) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let passed = 0;
async function root(sql, args = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims','{}',false)");
  return db.query(sql, args);
}
const value = (r) => Object.values(r.rows[0] || {})[0];
async function as(n, sql, extra = {}) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: uid(n),
      role: "authenticated",
      session_id: uid(100 + n),
      aal: "aal2",
      amr: [
        { method: "password", timestamp: stamps[n] },
        { method: "totp", timestamp: stamps[n] },
      ],
      ...extra,
    }),
  ]);
  await db.exec("set role authenticated");
  return db.query(sql);
}
async function check(name, fn) {
  await fn();
  passed++;
  process.stdout.write(`✓ ${name}\n`);
}
const denied = (promise) =>
  assert.rejects(promise, /FORBIDDEN|permission denied|NATIVE_MFA_REQUIRED/);
const stamps = {};
try {
  for (let n = 1; n <= 14; n++) {
    await root(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",
      [
        uid(n),
        `native-${n}@example.test`,
        JSON.stringify({ full_name: `Auditoria MFA ${n}` }),
      ],
    );
    await root(
      "update public.profiles set status='active',onboarded_at=now(),terms_accepted_at=now() where id=$1",
      [uid(n)],
    );
    await root(
      "insert into public.user_roles select $1,id from public.roles where code=$2",
      [uid(n), n === 1 ? "COLLABORATOR" : "MANAGER"],
    );
    await root(
      "insert into auth.mfa_factors(id,user_id,factor_type,status) values($1,$2,'totp','verified')",
      [uid(200 + n), uid(n)],
    );
    await root(
      "insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",
      [uid(100 + n), uid(n), uid(200 + n)],
    );
    const proof = value(
      await root(
        "insert into auth.mfa_amr_claims(session_id,authentication_method) values($1,'totp') returning floor(extract(epoch from updated_at))::bigint",
        [uid(100 + n)],
      ),
    );
    stamps[n] = Number(proof);
  }
  await check(
    "Prova nativa realista confirma só a própria sessão e não promove colaborador",
    async () => {
      const r = value(
        await as(1, "select public.confirm_authenticator_session()"),
      );
      assert.equal(r.ok, true);
      const row = (
        await root(
          "select verified_at,verified_until,verified_factor_id from private.session_security where session_id=$1",
          [uid(101)],
        )
      ).rows[0];
      assert.equal(row.verified_factor_id, uid(201));
      assert.equal(
        new Date(row.verified_until) - new Date(row.verified_at),
        8 * 60 * 60 * 1000,
      );
      assert.equal(
        value(await as(1, "select (public.bootstrap()->>'recently_verified')::boolean")),
        true,
      );
      await denied(as(1, "select public.system_health()"));
      assert.equal(
        Number(
          value(
            await root(
              "select count(*) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$1 and r.code<>'COLLABORATOR'",
              [uid(1)],
            ),
          ),
        ),
        0,
      );
    },
  );
  await check(
    "Repetir a mesma prova mantém exatamente seus prazos",
    async () => {
      const before = (
        await root(
          "select verified_at,verified_until from private.session_security where session_id=$1",
          [uid(101)],
        )
      ).rows[0];
      const r = value(
        await as(1, "select public.confirm_authenticator_session()"),
      );
      assert.equal(r.ok, true);
      const after = (
        await root(
          "select verified_at,verified_until from private.session_security where session_id=$1",
          [uid(101)],
        )
      ).rows[0];
      assert.deepEqual(after, before);
    },
  );
  await check("aal1 não confirma a sessão", () =>
    denied(
      as(2, "select public.confirm_authenticator_session()", { aal: "aal1" }),
    ),
  );
  await check("Acesso sem método de senha não confirma a sessão", () =>
    denied(
      as(3, "select public.confirm_authenticator_session()", {
        amr: [{ method: "totp", timestamp: stamps[3] }],
      }),
    ),
  );
  await check("Fator ainda não verificado não confirma a sessão", async () => {
    await root("update auth.mfa_factors set status='unverified' where id=$1", [
      uid(204),
    ]);
    await denied(as(4, "select public.confirm_authenticator_session()"));
  });
  await check(
    "Fator pertencente a outro usuário não confirma a sessão",
    async () => {
      await root("update auth.mfa_factors set user_id=$1 where id=$2", [
        uid(1),
        uid(205),
      ]);
      await denied(as(5, "select public.confirm_authenticator_session()"));
    },
  );
  await check("Timestamp que diverge da prova do serviço não confirma", () =>
    denied(
      as(6, "select public.confirm_authenticator_session()", {
        amr: [
          { method: "password", timestamp: stamps[6] },
          { method: "totp", timestamp: stamps[6] - 1 },
        ],
      }),
    ),
  );
  await check("Prova antiga não confirma a sessão", async () => {
    const proof = value(
      await root(
        "update auth.mfa_amr_claims set updated_at=now()-interval '16 minutes' where session_id=$1 returning floor(extract(epoch from updated_at))::bigint",
        [uid(107)],
      ),
    );
    stamps[7] = Number(proof);
    await denied(as(7, "select public.confirm_authenticator_session()"));
  });
  await check("Prova mais de 30 segundos no futuro é recusada", async () => {
    const proof = value(
      await root(
        "update auth.mfa_amr_claims set updated_at=now()+interval '31 seconds' where session_id=$1 returning floor(extract(epoch from updated_at))::bigint",
        [uid(108)],
      ),
    );
    stamps[8] = Number(proof);
    await denied(as(8, "select public.confirm_authenticator_session()"));
  });
  await check("Sessão revogada não recebe confirmação", async () => {
    await root(
      "insert into private.session_security(session_id,user_id,revoked_at) values($1,$2,now())",
      [uid(109), uid(9)],
    );
    await denied(as(9, "select public.confirm_authenticator_session()"));
  });
  await check("Perfil inativo não confirma acesso", async () => {
    await root("update public.profiles set status='inactive' where id=$1", [
      uid(10),
    ]);
    await denied(as(10, "select public.confirm_authenticator_session()"));
  });
  await check("Endereço sem confirmação não confirma acesso", async () => {
    await root("update auth.users set email_confirmed_at=null where id=$1", [
      uid(11),
    ]);
    await denied(as(11, "select public.confirm_authenticator_session()"));
  });
  await check("Prova nativa de outra sessão não confirma", async () => {
    await root(
      "update auth.mfa_amr_claims set session_id=$1 where session_id=$2",
      [uid(101), uid(112)],
    );
    await denied(as(12, "select public.confirm_authenticator_session()"));
  });
  await check(
    "Sessão do banco em aal1 não aceita somente a alegação do JWT",
    async () => {
      await root("update auth.sessions set aal='aal1' where id=$1", [uid(113)]);
      await denied(as(13, "select public.confirm_authenticator_session()"));
    },
  );
  await check("JWT sem timestamp válido é recusado", () =>
    denied(
      as(14, "select public.confirm_authenticator_session()", {
        amr: [{ method: "password" }, { method: "totp", timestamp: "invalid" }],
      }),
    ),
  );
  await check(
    "Remover o fator invalida confirmação recente e acesso administrativo",
    async () => {
      await root("update auth.mfa_factors set status='verified' where id=$1", [
        uid(204),
      ]);
      const r = value(
        await as(4, "select public.confirm_authenticator_session()"),
      );
      assert.equal(r.ok, true);
      assert.equal(value(await as(4, "select private.account_ready()")), true);
      await root("delete from auth.mfa_factors where id=$1", [uid(204)]);
      assert.equal(
        value(await as(4, "select (public.bootstrap()->>'recently_verified')::boolean")),
        false,
      );
      assert.equal(value(await as(4, "select private.account_ready()")), false);
      const boot = value(await as(4, "select public.bootstrap()"));
      assert.equal(boot.mfa_verified, false);
      assert.equal(boot.mfa_required, true);
    },
  );
  await check(
    "Janela existente continua explícita e pode ser encerrada",
    async () => {
      await root(
        "update public.settings set value=jsonb_set(value,'{enabled}','true') where key='registration_access_window'",
      );
      const boot = value(
        await as(2, "select public.bootstrap()", { aal: "aal1" }),
      );
      assert.equal(boot.ready, true);
      assert.equal(boot.mfa_required, false);
      await root(
        "update public.settings set value=jsonb_set(value,'{enabled}','false') where key='registration_access_window'",
      );
      assert.equal(
        value(await as(2, "select private.account_ready()", { aal: "aal1" })),
        false,
      );
    },
  );
  await check(
    "E-mail confirmado substitui vínculo nativo sem perder suas regras",
    async () => {
      await root("update auth.mfa_factors set user_id=$1 where id=$2", [
        uid(5),
        uid(205),
      ]);
      value(await as(5, "select public.confirm_authenticator_session()"));
      await root(
        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)",
      );
      await db.exec("set role service_role");
      const issued = value(
        await db.query("select public.issue_otp($1,$2,$3)", [
          uid(5),
          uid(105),
          "audit-test-hash",
        ]),
      );
      assert.equal(issued.ok, true);
      const verified = value(
        await db.query("select public.verify_otp($1,$2,$3)", [
          uid(5),
          uid(105),
          "audit-test-hash",
        ]),
      );
      assert.equal(verified.ok, true);
      const row = (
        await root(
          "select verified_factor_id from private.session_security where session_id=$1",
          [uid(105)],
        )
      ).rows[0];
      assert.equal(row.verified_factor_id, null);
      assert.equal(value(await as(5, "select private.account_ready()")), true);
    },
  );
  assert.equal(passed, 18);
  console.log(
    `${passed} verificações do aplicativo e das provas de sessão aprovadas.`,
  );
} catch (error) {
  console.error(JSON.stringify({message:error.message,code:error.code}));
  process.exitCode=1;
} finally {
  await db.close();
}
