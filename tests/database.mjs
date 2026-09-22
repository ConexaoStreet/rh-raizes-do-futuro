import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createDatabase } from "./setup-database.mjs";
const db = await createDatabase();
const results = [];
const uid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const users = {
  admin: uid(1),
  rafaella: uid(2),
  nicolas: uid(3),
  collaborator: uid(4),
  second: uid(5),
  pending: uid(6),
  nomfa: uid(7),
};
const sessions = Object.fromEntries(
  Object.entries(users).map(([name], i) => [name, uid(100 + i)]),
);
async function root(sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims','{}',false)");
  return db.query(sql, params);
}
async function as(name, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: users[name],
      role: "authenticated",
      session_id: sessions[name],
    }),
  ]);
  await db.exec("set role authenticated");
  return db.query(sql, params);
}
async function clock(value) {
  await root("select set_config('test.clock',$1,false)", [value]);
}
async function value(result) {
  return Object.values(result.rows[0] || {})[0];
}
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    process.stdout.write("✓ " + name + "\n");
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    process.stderr.write("✗ " + name + ": " + error.message + "\n");
  }
}
async function blocked(
  promise,
  pattern = /FORBIDDEN|permission denied|OUTSIDE_WINDOW|INVALID_TRANSITION|SNAPSHOT_IMMUTABLE|CONFLICT|PENDING_MEMBERS|DUPLICATE_VOTE/,
) {
  await assert.rejects(promise, pattern);
}
for (const [name, id] of Object.entries(users)) {
  await root(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
    [id, `${name}@example.test`, JSON.stringify({ full_name: name })],
  );
  await root("insert into auth.sessions(id,user_id) values($1,$2)", [
    sessions[name],
    id,
  ]);
  await root(
    "update public.profiles set status=$2,onboarded_at=now(),terms_accepted_at=now() where id=$1",
    [id, name === "pending" ? "pending" : "active"],
  );
  const code =
    name === "admin"
      ? "SUPER_ADMIN"
      : ["rafaella", "nicolas", "nomfa"].includes(name)
        ? "MANAGER"
        : "COLLABORATOR";
  if (name !== "pending")
    await root(
      "insert into public.user_roles select $1,id from public.roles where code=$2",
      [id, code],
    );
  if (["admin", "rafaella", "nicolas"].includes(name))
    await root(
      "insert into private.session_security(session_id,user_id,verified_at,verified_until) values($1,$2,now(),now()+interval '8 hours')",
      [sessions[name], id],
    );
}
await root(
  `create or replace function private.business_now() returns timestamptz language sql stable set search_path='' as $$ select current_setting('test.clock')::timestamptz $$`,
);
await clock("2026-09-08T11:00:00Z");
const classId = await value(
  await as("admin", "select public.save_entity('classes',$1,null)", [
    JSON.stringify({ name: "Turma de teste", code: "TESTE" }),
  ]),
);
for (let i = 0; i < 57; i++)
  await as("rafaella", "select public.save_entity('employees',$1,null)", [
    JSON.stringify({
      full_name: `Pessoa ${String(i + 1).padStart(2, "0")}`,
      registration: `TEST-${i + 1}`,
      class_id: classId,
      join_date: "2026-09-01",
      expected_arrival: "08:00",
      expected_departure: "14:00",
    }),
  ]);
const employeeId = await value(
  await root("select id from public.employees where registration='TEST-1'"),
);
const secondEmployee = await value(
  await root("select id from public.employees where registration='TEST-2'"),
);
await root("update public.employees set profile_id=$1 where id=$2", [
  users.collaborator,
  employeeId,
]);
await root("update public.employees set profile_id=$1 where id=$2", [
  users.second,
  secondEmployee,
]);
await test("Todas as tabelas públicas e privadas usam RLS", async () =>
  assert.equal(
    await value(
      await root(
        "select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity",
      ),
    ),
    0,
  ));
await test("Colaborador só lê seu próprio cadastro", async () => {
  const rows = await as("collaborator", "select id from public.employees");
  assert.deepEqual(
    rows.rows.map((r) => r.id),
    [employeeId],
  );
});
await test("Cadastro pendente não lê dados internos", async () =>
  assert.equal(
    (await as("pending", "select * from public.employees")).rows.length,
    0,
  ));
await test("Gestor sem 2FA não acessa dados internos", async () =>
  assert.equal(
    (await as("nomfa", "select * from public.employees")).rows.length,
    0,
  ));
await test("Colaborador não chama endpoint administrativo", async () =>
  blocked(
    as("collaborator", "select public.save_entity('employees',$1,null)", [
      JSON.stringify({ full_name: "Invasão", registration: "BAD" }),
    ]),
  ));
await test("Gestor não promove a si mesmo", async () =>
  blocked(
    as("rafaella", "select public.manage_user($1,$2,$3,$4)", [
      users.rafaella,
      "active",
      [],
      "Tentativa indevida",
    ]),
  ));
await test("Escrita direta e alteração de permissões são bloqueadas", async () => {
  await blocked(
    as("collaborator", "update public.profiles set status='active'"),
  );
  await blocked(as("rafaella", "delete from public.audit_logs"));
  await blocked(
    as("admin", "update public.audit_logs set action=$1", ["alterado"]),
  );
});
await test("Segunda-feira bloqueia a chamada", async () => {
  await clock("2026-09-07T11:00:00Z");
  await blocked(
    as("rafaella", "select public.open_attendance($1)", [classId]),
    /INVALID_COURSE_DAY/,
  );
});
await test("Terça antes das 08h bloqueia a chamada", async () => {
  await clock("2026-09-08T10:59:59Z");
  await blocked(
    as("rafaella", "select public.open_attendance($1)", [classId]),
    /OUTSIDE_WINDOW/,
  );
});
await test("Terça com feriado ou sem curso bloqueia", async () => {
  await clock("2026-09-08T11:00:00Z");
  const holiday = await value(
    await as("admin", "select public.save_entity('course_calendar',$1,null)", [
      JSON.stringify({
        scheduled_date: "2026-09-08",
        has_course: false,
        kind: "holiday",
        reason: "Feriado da unidade",
      }),
    ]),
  );
  await blocked(
    as("rafaella", "select public.open_attendance($1)", [classId]),
    /INVALID_COURSE_DAY/,
  );
  await root("delete from public.course_calendar where id=$1", [holiday]);
});
let attendanceId;
await test("Terça às 08h cria chamada com snapshot de 57 pessoas", async () => {
  attendanceId = await value(
    await as("rafaella", "select public.open_attendance($1)", [classId]),
  );
  assert.equal(
    await value(
      await root(
        "select original_member_count from public.attendance_sessions where id=$1",
        [attendanceId],
      ),
    ),
    57,
  );
  assert.equal(
    await value(
      await root(
        "select count(*)::int from public.attendance_members where session_id=$1",
        [attendanceId],
      ),
    ),
    57,
  );
});
await test("Não duplica a chamada da mesma turma e data", async () =>
  assert.equal(
    await value(
      await as("nicolas", "select public.open_attendance($1)", [classId]),
    ),
    attendanceId,
  ));
let members = (
  await root(
    "select * from public.attendance_members where session_id=$1 order by full_name_snapshot",
    [attendanceId],
  )
).rows;
await test("Finalização sem status exige motivo", async () =>
  blocked(
    as("rafaella", "select public.finalize_attendance($1,null)", [
      attendanceId,
    ]),
    /PENDING_MEMBERS/,
  ));
await test("Salvamento em lote é transacional e calcula 17 minutos de atraso", async () => {
  await as("rafaella", "select public.save_attendance($1,$2)", [
    attendanceId,
    JSON.stringify(
      members.map((m, i) => ({
        id: m.id,
        version: m.version,
        status: i === 0 ? "late" : "present",
        actual_arrival: i === 0 ? "08:17" : null,
      })),
    ),
  ]);
  assert.equal(
    await value(
      await root(
        "select delay_minutes from public.attendance_members where id=$1",
        [members[0].id],
      ),
    ),
    17,
  );
});
await test("Duas edições não sobrescrevem silenciosamente", async () =>
  blocked(
    as("nicolas", "select public.save_attendance($1,$2)", [
      attendanceId,
      JSON.stringify([{ id: members[0].id, version: 1, status: "absent" }]),
    ]),
    /CONFLICT/,
  ));
await test("Às 14h exatas novas alterações são bloqueadas", async () => {
  await clock("2026-09-08T17:00:00Z");
  await blocked(
    as("rafaella", "select public.save_attendance($1,$2)", [
      attendanceId,
      JSON.stringify([{ id: members[1].id, version: 2, status: "absent" }]),
    ]),
    /OUTSIDE_WINDOW/,
  );
});
await test("Finalização às 13h59 funciona e exige manutenção depois", async () => {
  await clock("2026-09-08T16:59:59Z");
  await as("rafaella", "select public.finalize_attendance($1,null)", [
    attendanceId,
  ]);
  await blocked(
    as("nicolas", "select public.save_attendance($1,$2)", [
      attendanceId,
      JSON.stringify([{ id: members[1].id, version: 2, status: "absent" }]),
    ]),
    /INVALID_TRANSITION/,
  );
});
let maintenanceId;
await test("Manutenção fora do horário exige motivo", async () => {
  await clock("2026-09-08T22:00:00Z");
  await blocked(
    as("rafaella", "select public.start_maintenance($1,'')", [attendanceId]),
    /REASON_REQUIRED/,
  );
  maintenanceId = await value(
    await as(
      "rafaella",
      "select public.start_maintenance($1,'Correção informada ao RH')",
      [attendanceId],
    ),
  );
});
await test("Manutenção não acrescenta, remove nem troca pessoas", async () => {
  await blocked(
    as("rafaella", "delete from public.attendance_members where id=$1", [
      members[0].id,
    ]),
  );
  await blocked(
    as(
      "rafaella",
      "insert into public.attendance_members(session_id,employee_id,full_name_snapshot,registration_snapshot,expected_arrival,expected_departure) values($1,$2,$3,$4,$5,$6)",
      [attendanceId, secondEmployee, "Novo nome", "BAD", "08:00", "14:00"],
    ),
  );
  await blocked(
    as("rafaella", "select public.save_attendance($1,$2)", [
      attendanceId,
      JSON.stringify([
        {
          id: members[0].id,
          version: 2,
          employee_id: secondEmployee,
          status: "present",
        },
      ]),
    ]),
    /SNAPSHOT_IMMUTABLE/,
  );
});
await test("Correção permite alterar presença e gera antes/depois com sessão de manutenção", async () => {
  await as("nicolas", "select public.save_attendance($1,$2)", [
    attendanceId,
    JSON.stringify([{ id: members[1].id, version: 2, status: "absent" }]),
  ]);
  const log = (
    await root(
      "select * from public.audit_logs where module='attendance_members' and entity_id=$1 order by created_at desc limit 1",
      [members[1].id],
    )
  ).rows[0];
  assert.equal(log.old_values.status, "present");
  assert.equal(log.new_values.status, "absent");
  assert.equal(log.context.maintenance_id, maintenanceId);
  assert.equal(log.actor_user_id, users.nicolas);
});
await test("Encerrar manutenção bloqueia nova alteração", async () => {
  await as("rafaella", "select public.end_maintenance($1)", [attendanceId]);
  await blocked(
    as("rafaella", "select public.save_attendance($1,$2)", [
      attendanceId,
      JSON.stringify([{ id: members[1].id, version: 3, status: "present" }]),
    ]),
    /INVALID_TRANSITION/,
  );
});
await test("Segunda manutenção tem histórico separado", async () => {
  const second = await value(
    await as(
      "nicolas",
      "select public.start_maintenance($1,'Segunda revisão do registro')",
      [attendanceId],
    ),
  );
  assert.notEqual(second, maintenanceId);
  await as("nicolas", "select public.end_maintenance($1)", [attendanceId]);
  assert.equal(
    await value(
      await root(
        "select count(*)::int from public.attendance_maintenance where session_id=$1",
        [attendanceId],
      ),
    ),
    2,
  );
});
await test("Novo cadastro e desligamento preservam os 57 nomes históricos", async () => {
  await as("rafaella", "select public.save_entity('employees',$1,null)", [
    JSON.stringify({
      full_name: "Pessoa nova",
      registration: "TEST-58",
      class_id: classId,
      join_date: "2026-09-09",
    }),
  ]);
  await root("update public.employees set status='inactive' where id=$1", [
    secondEmployee,
  ]);
  assert.equal(
    await value(
      await root(
        "select count(*)::int from public.attendance_members where session_id=$1",
        [attendanceId],
      ),
    ),
    57,
  );
});
await test("Reposição autorizada fora da terça é aceita", async () => {
  await clock("2026-09-09T11:00:00Z");
  await as("admin", "select public.save_entity('course_calendar',$1,null)", [
    JSON.stringify({
      scheduled_date: "2026-09-09",
      class_id: classId,
      has_course: true,
      kind: "replacement",
      reason: "Reposição autorizada",
    }),
  ]);
  assert.ok(
    await value(
      await as("rafaella", "select public.open_attendance($1)", [classId]),
    ),
  );
});
await test("Relatório usa dados finais e contabiliza manutenção", async () => {
  const r = await value(
    await as(
      "rafaella",
      "select public.report_snapshot('2026-09-08','2026-09-08',null,null)",
    ),
  );
  assert.equal(r.metrics.records, 57);
  assert.equal(r.metrics.absent, 1);
  assert.equal(r.records[0].maintenance_count, 2);
});
await test("Usuário suspenso perde acesso com a mesma sessão", async () => {
  await root("update public.profiles set status='suspended' where id=$1", [
    users.second,
  ]);
  assert.equal(
    (await as("second", "select * from public.employees")).rows.length,
    0,
  );
});
await test("Revogação invalida sessão imediatamente", async () => {
  await as("admin", "select public.revoke_session($1)", [sessions.second]);
  await root("update public.profiles set status='active' where id=$1", [
    users.second,
  ]);
  assert.equal(
    (await as("second", "select * from public.employees")).rows.length,
    0,
  );
});
await test("Conteúdo anônimo e elegibilidade não são consultáveis", async () => {
  for (const person of ["rafaella", "nicolas", "collaborator", "admin"]) {
    await blocked(
      as(person, "select * from private.anonymous_manager_reviews"),
    );
    await blocked(
      as(person, "select * from private.manager_review_eligibility"),
    );
  }
});
await test("Tabelas anônimas não possuem autoria nem horário", async () => {
  const columns = (
    await root(
      "select column_name from information_schema.columns where table_schema='private' and table_name='anonymous_manager_reviews'",
    )
  ).rows.map((c) => c.column_name);
  for (const key of [
    "user_id",
    "employee_id",
    "email",
    "created_at",
    "ip",
    "token_id",
  ])
    assert.ok(!columns.includes(key));
});
await test("Colaborador não consegue avaliar sem elegibilidade", async () =>
  blocked(
    as(
      "collaborator",
      "select public.submit_manager_review($1,$2,$3,$4,$5,$6)",
      [uid(900), uid(901), "{}", "", "", ""],
    ),
    /INVALID_TRANSITION|FORBIDDEN/,
  ));
async function service(sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ role: "service_role" }),
  ]);
  await db.exec("set role service_role");
  return db.query(sql, params);
}
await test("2FA: código errado contabiliza tentativa e não libera sessão", async () => {
  assert.equal(
    (
      await value(
        await service("select public.issue_otp($1,$2,$3)", [
          users.nomfa,
          sessions.nomfa,
          "hmac-test",
        ]),
      )
    ).ok,
    true,
  );
  const result = await value(
    await service("select public.verify_otp($1,$2,$3)", [
      users.nomfa,
      sessions.nomfa,
      "wrong",
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(
    await value(
      await root(
        "select attempts from private.otp_challenges where user_id=$1",
        [users.nomfa],
      ),
    ),
    1,
  );
  assert.equal(
    (await as("nomfa", "select * from public.employees")).rows.length,
    0,
  );
});
await test("2FA: código correto é de uso único", async () => {
  assert.equal(
    (
      await value(
        await service("select public.verify_otp($1,$2,$3)", [
          users.nomfa,
          sessions.nomfa,
          "hmac-test",
        ]),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await value(
        await service("select public.verify_otp($1,$2,$3)", [
          users.nomfa,
          sessions.nomfa,
          "hmac-test",
        ]),
      )
    ).ok,
    false,
  );
  assert.ok(
    (await as("nomfa", "select * from public.employees")).rows.length > 0,
  );
});
await test("2FA: reenvio tem intervalo mínimo", async () =>
  assert.equal(
    (
      await value(
        await service("select public.issue_otp($1,$2,$3)", [
          users.nomfa,
          sessions.nomfa,
          "new-hmac",
        ]),
      )
    ).error,
    "RATE_LIMITED",
  ));
await test("Colaborador não emite nem valida código diretamente", async () =>
  blocked(
    as("collaborator", "select public.verify_otp($1,$2,$3)", [
      users.nomfa,
      sessions.nomfa,
      "hmac-test",
    ]),
  ));
await fs.mkdir("docs/verification", { recursive: true });
await fs.writeFile(
  "docs/verification/database-tests.json",
  JSON.stringify(
    {
      engine: "PostgreSQL 17 via PGlite",
      generated_at: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);
await db.close();
process.stdout.write(
  `${results.filter((r) => r.passed).length}/${results.length} verificações passaram.\n`,
);
if (results.some((r) => !r.passed)) process.exit(1);
