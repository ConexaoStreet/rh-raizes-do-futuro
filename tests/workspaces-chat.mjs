import assert from "node:assert/strict";
import { createDatabase } from "./setup-database.mjs";

const db = await createDatabase();
const deadline = setTimeout(() => {
  process.stderr.write("Runner de banco não concluiu todas as verificações.\n");
  process.exit(1);
}, 60000);
const uid = (i) => `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const people = {
  alice: 1,
  bob: 2,
  manager: 3,
  instructor: 4,
  pending: 5,
  unassigned: 6,
};
let passed = 0;
process.on("beforeExit", () => {
  if (passed !== 17) process.exitCode = 1;
});
async function root(sql, args = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims','{}',false)");
  return db.query(sql, args);
}
async function as(name, sql, args = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: uid(people[name]),
      session_id: uid(100 + people[name]),
      role: "authenticated",
    }),
  ]);
  await db.exec("set role authenticated");
  return db.query(sql, args);
}
const value = (result) => Object.values(result.rows[0] || {})[0];
async function check(name, fn) {
  await fn();
  passed++;
  process.stdout.write(`✓ ${name}\n`);
}
const denied = (request, pattern = /FORBIDDEN|permission denied/) =>
  assert.rejects(request, pattern);
for (const [name, n] of Object.entries(people)) {
  await root(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
    [uid(n), `${name}@example.test`, JSON.stringify({ full_name: name })],
  );
  await root("insert into auth.sessions(id,user_id) values($1,$2)", [
    uid(100 + n),
    uid(n),
  ]);
  await root(
    "update public.profiles set status=$2,onboarded_at=now(),terms_accepted_at=now() where id=$1",
    [uid(n), name === "pending" ? "pending" : "active"],
  );
  await root(
    "insert into public.user_roles select $1,id from public.roles where code=$2 on conflict do nothing",
    [
      uid(n),
      name === "manager"
        ? "MANAGER"
        : name === "instructor"
          ? "INSTRUCTOR"
          : "COLLABORATOR",
    ],
  );
  await root(
    "insert into private.session_security(session_id,user_id,verified_at,verified_until) values($1,$2,now(),now()+interval '8 hours')",
    [uid(100 + n), uid(n)],
  );
}
const deptA = value(
  await root(
    "insert into public.departments(name) values('Setor A de teste') returning id",
  ),
);
const deptB = value(
  await root(
    "insert into public.departments(name) values('Setor B de teste') returning id",
  ),
);
for (const [name, department] of [
  ["alice", deptA],
  ["bob", deptB],
  ["pending", deptA],
]) {
  await root(
    "insert into public.employees(profile_id,full_name,registration,department_id) values($1,$2,$3,$4)",
    [uid(people[name]), `Pessoa ${name}`, `CHAT-${name}`, department],
  );
}

await check("Setor é determinado pelo vínculo validado no RH", async () => {
  const snapshot = value(
    await as("alice", "select public.workspace_snapshot(null)"),
  );
  assert.equal(snapshot.viewer, uid(people.alice));
  assert.equal(snapshot.department.id, deptA);
  assert.equal(snapshot.departments.length, 1);
  assert.equal(snapshot.overview, false);
  assert.equal(
    snapshot.members.some((m) => m.full_name === "Pessoa bob"),
    false,
  );
});
await check("Outro setor e conta pendente não acessam o espaço", async () => {
  await denied(as("alice", "select public.workspace_snapshot($1)", [deptB]));
  await denied(as("pending", "select public.workspace_snapshot(null)"));
  await root(
    "update auth.users set raw_user_meta_data=raw_user_meta_data||$2::jsonb where id=$1",
    [uid(people.alice), JSON.stringify({ department_id: deptB })],
  );
  assert.equal(
    value(await as("alice", "select public.workspace_snapshot(null)"))
      .department.id,
    deptA,
  );
});
await check(
  "Usuário sem setor recebe estado vazio sem escolher setor alheio",
  async () => {
    const snapshot = value(
      await as("unassigned", "select public.workspace_snapshot(null)"),
    );
    assert.equal(snapshot.department, null);
    assert.equal(snapshot.departments.length, 0);
  },
);
await check(
  "Gestor e instrutor acompanham todos os setores sem ganhar T.I.",
  async () => {
    for (const name of ["manager", "instructor"]) {
      const snapshot = value(
        await as(name, "select public.workspace_snapshot($1)", [deptB]),
      );
      assert.equal(snapshot.overview, true);
      assert.equal(snapshot.department.id, deptB);
      assert.ok(snapshot.departments.length >= 2);
    }
    assert.equal(
      value(await as("instructor", "select private.can('role.manage')")),
      false,
    );
    assert.equal(
      value(await as("instructor", "select private.can('audit.security')")),
      false,
    );
  },
);
let task;
await check(
  "Tarefa do setor salva e detecta edições concorrentes",
  async () => {
    task = value(
      await as("alice", "select public.save_sector_task($1,null)", [
        JSON.stringify({
          department_id: deptA,
          title: "Preparar reunião",
          description: "Organizar a pauta",
          status: "todo",
          priority: "normal",
        }),
      ]),
    );
    const changed = value(
      await as("alice", "select public.save_sector_task($1,$2)", [
        JSON.stringify({ id: task.id, status: "doing" }),
        task.version,
      ]),
    );
    await denied(
      as("alice", "select public.save_sector_task($1,$2)", [
        JSON.stringify({ id: task.id, status: "done" }),
        task.version,
      ]),
      /CONFLICT/,
    );
    await denied(
      as("bob", "select public.save_sector_task($1,$2)", [
        JSON.stringify({ id: task.id, status: "done" }),
        changed.version,
      ]),
    );
    assert.equal(
      value(await as("alice", "select public.workspace_snapshot(null)"))
        .tasks[0].status,
      "doing",
    );
  },
);
const rooms = value(await as("alice", "select public.chat_rooms_snapshot()"));
const general = rooms.rooms.find((r) => r.department_id === null).id;
const roomA = rooms.rooms.find((r) => r.department_id === deptA).id;
const roomB = value(
  await as("bob", "select public.chat_rooms_snapshot()"),
).rooms.find((r) => r.department_id === deptB).id;
await root("select set_config('test.chat_clock',$1,false)", [
  new Date().toISOString(),
]);
await root(
  "create or replace function private.chat_now() returns timestamptz language sql stable set search_path='' as $$ select current_setting('test.chat_clock')::timestamptz $$",
);
let instant = Date.now();
async function advance(seconds = 3) {
  instant += seconds * 1000;
  await root("select set_config('test.chat_clock',$1,false)", [
    new Date(instant).toISOString(),
  ]);
}
async function send(
  name,
  room,
  text,
  attachments = [],
  request = uid(300 + passed),
) {
  return value(
    await as(name, "select public.send_chat_message($1,$2,$3,$4)", [
      room,
      text,
      attachments,
      request,
    ]),
  );
}
await check(
  "Salas e mensagens respeitam setor, manutenção e suspensão",
  async () => {
    assert.deepEqual(
      rooms.rooms.map((r) => r.id).sort(),
      [general, roomA].sort(),
    );
    await denied(send("alice", roomB, "Indevido"));
    await denied(as("alice", "select public.chat_history($1,null)", [roomB]));
    await denied(send("pending", general, "Indevido"));
    await root(
      "update public.settings set value=value||'{\"enabled\":true,\"allow_managers\":false}'::jsonb where key='maintenance'",
    );
    await denied(as("alice", "select public.chat_rooms_snapshot()"));
    await root(
      "update public.settings set value=value||'{\"enabled\":false}'::jsonb where key='maintenance'",
    );
  },
);
let message;
let fileMessage;
await check(
  "Censura acontece no servidor e não guarda o texto ofensivo",
  async () => {
    message = await send("alice", roomA, "p.o.r.r.a", [], uid(401));
    assert.equal(message.filtered, true);
    assert.equal(message.body.includes("p.o.r.r.a"), false);
    const history = value(
      await as("alice", "select public.chat_history($1,null)", [roomA]),
    );
    assert.equal(history.messages[0].body, message.body);
    assert.equal(history.messages[0].author_name, "alice");
    assert.equal(
      value(
        await root(
          "select to_jsonb(m)::text from public.chat_messages m where id=$1",
          [message.id],
        ),
      ).includes("p.o.r.r.a"),
      false,
    );
  },
);
await check("Retry idempotente não duplica e flood é bloqueado", async () => {
  const repeat = await send("alice", roomA, "p.o.r.r.a", [], uid(401));
  assert.equal(repeat.id, message.id);
  await denied(send("alice", roomA, "Mais uma", [], uid(402)), /RATE_LIMIT/);
  await advance();
  await denied(
    send("alice", roomA, "x".repeat(2001), [], uid(403)),
    /INVALID_MESSAGE/,
  );
  await denied(send("alice", roomA, "   ", [], uid(404)), /INVALID_MESSAGE/);
});
const filePayload = (
  room = roomA,
  filename = "planilha.xlsx",
  mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  size = 1200,
) => ({ room_id: room, filename, mime_type: mime, size_bytes: size });
let attachment;
await check(
  "Reserva aceita planilha e recusa tipo, extensão ou tamanho perigoso",
  async () => {
    attachment = value(
      await as("alice", "select public.reserve_chat_attachment($1)", [
        JSON.stringify(filePayload()),
      ]),
    );
    assert.ok(attachment.path.startsWith(`${roomA}/${uid(people.alice)}/`));
    for (const data of [
      filePayload(roomA, "script.html", "text/html"),
      filePayload(roomA, "script.html", "application/pdf"),
      filePayload(
        roomA,
        "macro.xlsm",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
      filePayload(roomA, "grande.pdf", "application/pdf", 10485761),
    ])
      await denied(
        as("alice", "select public.reserve_chat_attachment($1)", [
          JSON.stringify(data),
        ]),
        /INVALID_FILE/,
      );
    await denied(
      as("bob", "select public.reserve_chat_attachment($1)", [
        JSON.stringify(filePayload()),
      ]),
    );
  },
);
await check(
  "Upload e leitura só aceitam reserva do dono e sala autorizada",
  async () => {
    await denied(
      as(
        "bob",
        "insert into storage.objects(bucket_id,name) values('chat-files',$1)",
        [attachment.path],
      ),
      /row-level security/,
    );
    await as(
      "alice",
      "insert into storage.objects(bucket_id,name,metadata) values('chat-files',$1,$2)",
      [
        attachment.path,
        JSON.stringify({ size: 1200, mimetype: attachment.mime_type }),
      ],
    );
    assert.equal(
      (
        await as("bob", "select id from storage.objects where name=$1", [
          attachment.path,
        ])
      ).rows.length,
      0,
    );
    await denied(
      send("bob", roomB, "Arquivo indevido", [attachment.id], uid(405)),
      /INVALID_ATTACHMENT/,
    );
  },
);
await check(
  "Enviar anexo vincula arquivo à mensagem uma única vez",
  async () => {
    await advance();
    const sent = await send(
      "alice",
      roomA,
      "Segue a planilha",
      [attachment.id],
      uid(406),
    );
    fileMessage = sent;
    assert.equal(sent.attachments.length, 1);
    const seen = value(
      await as("manager", "select public.chat_history($1,null)", [roomA]),
    );
    assert.equal(seen.messages[0].attachments[0].filename, "planilha.xlsx");
    await advance();
    await denied(
      send("alice", general, "Outra sala", [attachment.id], uid(407)),
      /INVALID_ATTACHMENT/,
    );
    await denied(
      send("alice", roomA, "Reutilizar", [attachment.id], uid(408)),
      /INVALID_ATTACHMENT/,
    );
  },
);
await check(
  "Denúncia é privada, moderador oculta mensagem e arquivos",
  async () => {
    await as("alice", "select public.report_chat_message($1,$2)", [
      message.id,
      "Revisar linguagem",
    ]);
    await denied(as("alice", "select public.chat_reports_queue($1)", [roomA]));
    const queue = value(
      await as("instructor", "select public.chat_reports_queue($1)", [roomA]),
    );
    assert.equal(queue.reports.length, 1);
    assert.equal(queue.reports[0].message.id, message.id);
    assert.equal(
      (await as("bob", "select id from public.chat_reports")).rows.length,
      0,
    );
    await denied(
      as("alice", "select public.moderate_chat_message($1,$2)", [
        message.id,
        "Conteúdo inadequado",
      ]),
    );
    await as("instructor", "select public.moderate_chat_message($1,$2)", [
      message.id,
      "Conteúdo inadequado",
    ]);
    const history = value(
      await as("alice", "select public.chat_history($1,null)", [roomA]),
    );
    assert.equal(
      history.messages.find((m) => m.id === message.id).body,
      "Mensagem removida pela moderação.",
    );
    assert.equal(
      value(
        await as("instructor", "select public.chat_reports_queue($1)", [roomA]),
      ).reports.length,
      0,
    );
    await as("instructor", "select public.moderate_chat_message($1,$2)", [
      fileMessage.id,
      "Anexo em revisão",
    ]);
    assert.equal(
      (
        await as("alice", "select id from storage.objects where name=$1", [
          attachment.path,
        ])
      ).rows.length,
      0,
    );
    assert.deepEqual(
      value(
        await as("alice", "select public.chat_history($1,null)", [roomA]),
      ).messages.find((m) => m.id === fileMessage.id).attachments,
      [],
    );
  },
);
await check(
  "Histórico pagina sem duplicar e retry antigo retorna a mensagem correta",
  async () => {
    for (let i = 0; i < 31; i++) {
      await advance(65);
      await send("alice", general, `Combinado ${i}`, [], uid(500 + i));
    }
    const latest = value(
      await as("alice", "select public.chat_history($1,null)", [general]),
    );
    assert.equal(latest.messages.length, 30);
    assert.equal(latest.has_more, true);
    const older = value(
      await as("alice", "select public.chat_history($1,$2)", [
        general,
        latest.messages.at(-1).sequence,
      ]),
    );
    assert.equal(older.messages.length, 1);
    assert.equal(older.has_more, false);
    const retry = await send("alice", general, "Combinado 0", [], uid(500));
    assert.equal(retry.id, older.messages[0].id);
  },
);
await check(
  "Moderação pode encerrar revisão com registro e sem remover mensagem",
  async () => {
    const recent = value(
      await as("alice", "select public.chat_history($1,null)", [general]),
    ).messages[0];
    await as("alice", "select public.report_chat_message($1,$2)", [
      recent.id,
      "Conferir contexto",
    ]);
    const report = value(
      await as("instructor", "select public.chat_reports_queue($1)", [general]),
    ).reports[0];
    await denied(
      as("alice", "select public.dismiss_chat_report($1,$2)", [
        report.id,
        "Tudo certo",
      ]),
    );
    await as("instructor", "select public.dismiss_chat_report($1,$2)", [
      report.id,
      "Conferido; conteúdo adequado",
    ]);
    assert.equal(
      value(
        await as("instructor", "select public.chat_reports_queue($1)", [
          general,
        ]),
      ).reports.length,
      0,
    );
    assert.equal(
      value(await as("alice", "select public.chat_history($1,null)", [general]))
        .messages[0].moderated,
      false,
    );
    await as("alice", "select public.report_chat_message($1,$2)", [
      recent.id,
      "Novo contexto para revisão",
    ]);
    assert.equal(
      value(
        await as("instructor", "select public.chat_reports_queue($1)", [
          general,
        ]),
      ).reports.length,
      1,
    );
  },
);
await check(
  "Tarefa não aceita responsável de outro setor e reserva pendente pode ser descartada",
  async () => {
    await denied(
      as("alice", "select public.save_sector_task($1,null)", [
        JSON.stringify({
          department_id: deptA,
          title: "Tarefa atribuída",
          assigned_to: uid(people.bob),
        }),
      ]),
      /INVALID_ASSIGNEE/,
    );
    const unused = value(
      await as("alice", "select public.reserve_chat_attachment($1)", [
        JSON.stringify(filePayload()),
      ]),
    );
    await denied(
      as("bob", "select public.discard_chat_attachment($1)", [unused.id]),
    );
    await as("alice", "select public.discard_chat_attachment($1)", [unused.id]);
    assert.equal(
      value(
        await root(
          "select count(*)::int from public.chat_attachments where id=$1",
          [unused.id],
        ),
      ),
      0,
    );
  },
);
await check(
  "Reserva expirada pode ser limpa pelo dono mesmo após mudança de setor",
  async () => {
    const expired = value(
      await as("alice", "select public.reserve_chat_attachment($1)", [
        JSON.stringify(filePayload()),
      ]),
    );
    await as(
      "alice",
      "insert into storage.objects(bucket_id,name,metadata) values('chat-files',$1,$2)",
      [
        expired.path,
        JSON.stringify({ size: 1200, mimetype: expired.mime_type }),
      ],
    );
    await root(
      "update public.chat_attachments set expires_at=now()-interval '1 minute' where id=$1",
      [expired.id],
    );
    await root(
      "update public.employees set department_id=$1 where profile_id=$2",
      [deptB, uid(people.alice)],
    );
    await denied(as("alice", "select public.chat_history($1,null)", [roomA]));
    assert.equal(
      (
        await as("alice", "select id from storage.objects where name=$1", [
          expired.path,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await as("bob", "select id from storage.objects where name=$1", [
          expired.path,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await as(
          "alice",
          "delete from storage.objects where bucket_id='chat-files' and name=$1 returning id",
          [expired.path],
        )
      ).rows.length,
      1,
    );
    await as("alice", "select public.discard_chat_attachment($1)", [
      expired.id,
    ]);
    assert.equal(
      value(
        await root(
          "select count(*)::int from public.chat_attachments where id=$1",
          [expired.id],
        ),
      ),
      0,
    );
    assert.equal(
      value(
        await root(
          "select provolatile from pg_proc where oid='private.chat_file_mutation_allowed(text,text)'::regprocedure",
        ),
      ),
      "v",
    );
    await root(
      "update public.employees set department_id=$1 where profile_id=$2",
      [deptA, uid(people.alice)],
    );
  },
);
await check(
  "Escrita direta, acesso anon e alteração de setor permanecem negados",
  async () => {
    await denied(
      as(
        "alice",
        "update public.chat_messages set body='Sem filtro' where id=$1",
        [message.id],
      ),
    );
    await denied(
      as(
        "alice",
        "update public.sector_tasks set department_id=$1 where id=$2",
        [deptB, task.id],
      ),
    );
    await root("select 1");
    for (const table of [
      "chat_rooms",
      "chat_messages",
      "chat_attachments",
      "chat_reports",
      "sector_tasks",
    ])
      assert.equal(
        value(
          await root("select has_table_privilege('anon',$1,'SELECT')", [
            `public.${table}`,
          ]),
        ),
        false,
      );
    await root("update public.profiles set status='suspended' where id=$1", [
      uid(people.alice),
    ]);
    await denied(as("alice", "select public.chat_history($1,null)", [roomA]));
    assert.equal(
      (
        await as("alice", "select id from storage.objects where name=$1", [
          attachment.path,
        ])
      ).rows.length,
      0,
    );
  },
);
process.stdout.write(`${passed} verificações de setores e chat aprovadas.\n`);
await db.close();
clearTimeout(deadline);
