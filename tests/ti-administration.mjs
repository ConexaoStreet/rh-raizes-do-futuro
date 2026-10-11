import assert from "node:assert/strict";
import { createDatabase } from "./setup-database.mjs";

const db = await createDatabase();
const results = [];
const uid = (n) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actors = {
  ti: 1,
  owner: 2,
  other: 3,
  pending: 4,
  suspended: 5,
  revoked: 6,
  nomfa: 7,
  manager: 8,
};
async function root(sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims','{}',false)");
  return db.query(sql, params);
}
async function as(name, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: uid(actors[name]),
      role: "authenticated",
      session_id: uid(100 + actors[name]),
    }),
  ]);
  await db.exec("set role authenticated");
  return db.query(sql, params);
}
const value = (result) => Object.values(result.rows[0] || {})[0];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    results.push({ name, passed: false });
    process.stderr.write(`✗ ${name}: ${error.message}\n`);
  }
}
const denied = (
  request,
  pattern = /row-level security|FORBIDDEN|permission denied/,
) => assert.rejects(request, pattern);
for (const [name, n] of Object.entries(actors)) {
  await root(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
    [
      uid(n),
      `${name}@example.test`,
      JSON.stringify({ full_name: `Pessoa ${name}` }),
    ],
  );
  await root("insert into auth.sessions(id,user_id) values($1,$2)", [
    uid(100 + n),
    uid(n),
  ]);
  await root(
    "update public.profiles set status=$2,onboarded_at=now(),terms_accepted_at=now() where id=$1",
    [
      uid(n),
      name === "pending"
        ? "pending"
        : name === "suspended"
          ? "suspended"
          : "active",
    ],
  );
  await root(
    "insert into public.user_roles select $1,id from public.roles where code=$2 on conflict do nothing",
    [
      uid(n),
      ["ti", "nomfa"].includes(name)
        ? "TI_ADMIN"
        : name === "manager"
          ? "MANAGER"
          : "COLLABORATOR",
    ],
  );
  await root(
    "insert into private.session_security(session_id,user_id,verified_at,verified_until,revoked_at) values($1,$2,now(),$3,$4)",
    [
      uid(100 + n),
      uid(n),
      name === "nomfa"
        ? null
        : new Date(Date.now() + 8 * 3600000).toISOString(),
      name === "revoked" ? new Date().toISOString() : null,
    ],
  );
}
await root("grant delete on storage.objects to authenticated");
const ticket = (name, overrides = {}) => ({
  user_id: uid(actors[name]),
  category: "bug",
  subject: "Chamado de teste",
  description: "Descrição suficiente para a conferência isolada",
  ...overrides,
});
async function createTicket(name, overrides = {}) {
  const row = ticket(name, overrides);
  return value(
    await as(
      name,
      "insert into public.ti_support_tickets(user_id,category,subject,description,status) values($1,$2,$3,$4,$5) returning id",
      [
        row.user_id,
        row.category,
        row.subject,
        row.description,
        row.status || "open",
      ],
    ),
  );
}
const paths = Object.fromEntries(
  Object.keys(actors).map((name) => [
    name,
    `${uid(actors[name])}/evidence.pdf`,
  ]),
);
for (const name of Object.keys(actors)) {
  const row = ticket(name);
  await root(
    "insert into public.ti_support_tickets(user_id,category,subject,description) values($1,$2,$3,$4)",
    [row.user_id, row.category, row.subject, row.description],
  );
  await root(
    "insert into storage.objects(bucket_id,name,metadata) values('ti-support',$1,'{" +
      '"size":16,"mimetype":"application/pdf"' +
      "}')",
    [paths[name]],
  );
}

await check(
  "T.I. tem somente os acessos previstos; gestor e colaborador não ganham T.I.",
  async () => {
    for (const permission of [
      "ti.view",
      "ti.manage",
      "ti.users.manage",
      "ti.storage.manage",
      "ti.database.view",
      "ti.notifications.manage",
      "ti.datasul.read",
    ]) {
      assert.equal(
        value(await as("ti", "select public.has_permission($1)", [permission])),
        true,
      );
      assert.equal(
        value(
          await as("owner", "select public.has_permission($1)", [permission]),
        ),
        false,
      );
      assert.equal(
        value(
          await as("manager", "select public.has_permission($1)", [permission]),
        ),
        false,
      );
    }
  },
);
await check(
  "T.I. sem segunda verificação não recebe acesso administrativo",
  async () => {
    assert.equal(
      value(await as("nomfa", "select public.has_permission('ti.manage')")),
      false,
    );
    assert.equal(
      (
        await as(
          "nomfa",
          "select id from public.settings where key='ti_datasul'",
        )
      ).rows.length,
      0,
    );
  },
);
await check(
  "Consulta do Datasul respeita a permissão de pessoas e continua separada da edição",
  async () => {
    await root("begin");
    try {
      await root(
        "insert into public.roles(code,name,level) values('TI_READONLY_TEST','Consulta isolada da T.I.',60)",
      );
      await root(
        "insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p where r.code='TI_READONLY_TEST' and p.code in ('ti.view','ti.datasul.read')",
      );
      await root("delete from public.user_roles where user_id=$1", [
        uid(actors.other),
      ]);
      await root(
        "insert into public.user_roles select $1,id from public.roles where code='TI_READONLY_TEST'",
        [uid(actors.other)],
      );
      const own = value(
        await root(
          "insert into public.employees(full_name,registration,profile_id,status) values('Pessoa da consulta','CONSULTA-OWN',$1,'active') returning id",
          [uid(actors.other)],
        ),
      );
      const other = value(
        await root(
          "insert into public.employees(full_name,registration,status) values('Outra pessoa da consulta','CONSULTA-OTHER','active') returning id",
        ),
      );
      assert.equal(
        value(
          await as("other", "select public.has_permission('ti.datasul.read')"),
        ),
        true,
      );
      assert.equal(
        value(
          await as("other", "select public.has_permission('employee.view')"),
        ),
        false,
      );
      assert.deepEqual(
        (await as("other", "select id from public.employees")).rows.map(
          (row) => row.id,
        ),
        [own],
      );
      assert.equal(
        value(
          await as("other", "select public.ti_snapshot()->'employees_total'"),
        ),
        2,
      );
      await root(
        "insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p where r.code='TI_READONLY_TEST' and p.code='employee.view'",
      );
      assert.deepEqual(
        new Set(
          (await as("other", "select id from public.employees")).rows.map(
            (row) => row.id,
          ),
        ),
        new Set([own, other]),
      );
      assert.equal(
        value(
          await as("other", "select public.has_permission('employee.manage')"),
        ),
        false,
      );
    } finally {
      await root("rollback");
    }
  },
);
await check(
  "Chamado criado pelo titular fica salvo e não aparece para outra pessoa",
  async () => {
    const id = await createTicket("owner");
    assert.equal(
      (
        await as(
          "owner",
          "select status from public.ti_support_tickets where id=$1",
          [id],
        )
      ).rows[0].status,
      "open",
    );
    assert.equal(
      (
        await as(
          "other",
          "select id from public.ti_support_tickets where id=$1",
          [id],
        )
      ).rows.length,
      0,
    );
  },
);
await check(
  "Titular não cria chamado em nome alheio nem já resolvido",
  async () => {
    await denied(createTicket("owner", { user_id: uid(actors.other) }));
    await denied(createTicket("owner", { status: "resolved" }));
  },
);
await check(
  "Categoria e descrição inválidas são recusadas no banco",
  async () => {
    await denied(
      createTicket("owner", { category: "invalid" }),
      /check constraint/,
    );
    await denied(
      createTicket("owner", { description: "curta" }),
      /check constraint/,
    );
  },
);
await check(
  "Somente T.I. altera a situação de um chamado e a alteração persiste",
  async () => {
    const id = await createTicket("owner");
    assert.equal(
      (
        await as(
          "owner",
          "update public.ti_support_tickets set status='closed' where id=$1 returning id",
          [id],
        )
      ).rows.length,
      0,
    );
    await as(
      "ti",
      "update public.ti_support_tickets set status='resolved' where id=$1",
      [id],
    );
    assert.equal(
      (
        await as(
          "owner",
          "select status from public.ti_support_tickets where id=$1",
          [id],
        )
      ).rows[0].status,
      "resolved",
    );
    await denied(
      as(
        "ti",
        "update public.ti_support_tickets set status='invalid' where id=$1",
        [id],
      ),
      /check constraint/,
    );
  },
);
await check(
  "Anexo de suporte é privado, limitado e permite apenas os formatos previstos",
  async () => {
    const bucket = (
      await root("select * from storage.buckets where id='ti-support'")
    ).rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 10485760);
    assert.deepEqual(
      bucket.allowed_mime_types.sort(),
      ["application/pdf", "image/jpeg", "image/png", "image/webp"].sort(),
    );
  },
);
await check(
  "Anexo do titular fica visível para ele e T.I., sem exposição a outra pessoa",
  async () => {
    assert.equal(
      (
        await as(
          "owner",
          "select name from storage.objects where bucket_id='ti-support' and name=$1",
          [paths.owner],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await as(
          "other",
          "select name from storage.objects where bucket_id='ti-support' and name=$1",
          [paths.owner],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await as(
          "ti",
          "select name from storage.objects where bucket_id='ti-support' and name=$1",
          [paths.owner],
        )
      ).rows.length,
      1,
    );
  },
);
await check("Upload não aceita a pasta de outra pessoa", async () => {
  await denied(
    as(
      "owner",
      "insert into storage.objects(bucket_id,name) values('ti-support',$1)",
      [`${uid(actors.other)}/forged.pdf`],
    ),
  );
  await as(
    "owner",
    "insert into storage.objects(bucket_id,name) values('ti-support',$1)",
    [`${uid(actors.owner)}/new.pdf`],
  );
});
await check("Remoção de um upload só alcança o próprio arquivo", async () => {
  assert.equal(
    (
      await as(
        "other",
        "delete from storage.objects where bucket_id='ti-support' and name=$1 returning name",
        [paths.owner],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await as(
        "owner",
        "delete from storage.objects where bucket_id='ti-support' and name=$1 returning name",
        [`${uid(actors.owner)}/new.pdf`],
      )
    ).rows.length,
    1,
  );
});
for (const name of ["pending", "suspended", "revoked"]) {
  await check(
    `Conta ${name} não consulta chamados nem os próprios anexos com a sessão antiga`,
    async () => {
      assert.equal(
        (
          await as(
            name,
            "select id from public.ti_support_tickets where user_id=$1",
            [uid(actors[name])],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await as(
            name,
            "select name from storage.objects where bucket_id='ti-support' and name=$1",
            [paths[name]],
          )
        ).rows.length,
        0,
      );
    },
  );
  await check(`Conta ${name} não abre chamado nem envia arquivo`, async () => {
    await denied(createTicket(name));
    await denied(
      as(
        name,
        "insert into storage.objects(bucket_id,name) values('ti-support',$1)",
        [`${uid(actors[name])}/blocked.pdf`],
      ),
    );
  });
}
await check(
  "T.I. altera apenas as configurações autorizadas; o titular não consegue alterá-las",
  async () => {
    await denied(
      as(
        "owner",
        "select public.ti_update_setting('ti_datasul','{\"enabled\":true}')",
      ),
    );
    await as(
      "ti",
      "select public.ti_update_setting('ti_datasul','{\"enabled\":true}')",
    );
    assert.equal(
      value(
        await as(
          "ti",
          "select (value->>'enabled')::boolean from public.settings where key='ti_datasul'",
        ),
      ),
      true,
    );
    await denied(
      as(
        "ti",
        "select public.ti_update_setting('lateness','{\"changed\":true}')",
      ),
    );
    await denied(
      as("ti", "update public.settings set value='{}' where key='ti_datasul'"),
    );
  },
);
await check(
  "Aviso de manutenção bloqueia operações comuns e conserva o acesso da T.I.",
  async () => {
    await as(
      "ti",
      "select public.ti_update_setting('maintenance','{\"enabled\":true,\"allow_managers\":false}')",
    );
    assert.equal(
      value(await as("owner", "select private.account_ready()")),
      false,
    );
    assert.equal(
      value(await as("ti", "select public.has_permission('ti.manage')")),
      true,
    );
    assert.equal(
      (await as("owner", "select id from public.ti_support_tickets")).rows
        .length,
      0,
    );
    await root(
      "update public.settings set value=value||'{\"enabled\":false}' where key='maintenance'",
    );
  },
);
await check(
  "Configuração exige verificação recente e rejeita valores inválidos sem gravar",
  async () => {
    const before = value(
      await as("ti", "select value from public.settings where key='ti_site'"),
    );
    await denied(
      as("ti", "select public.ti_update_setting('ti_site','[]')"),
      /INVALID_TRANSITION/,
    );
    await root(
      "update private.session_security set verified_at=now()-interval '16 minutes' where user_id=$1",
      [uid(actors.ti)],
    );
    const bootstrap = value(await as("ti", "select public.bootstrap()"));
    assert.equal(bootstrap.ready, true);
    assert.equal(bootstrap.mfa_verified, true);
    assert.equal(bootstrap.recently_verified, false);
    await denied(
      as("ti", "select public.ti_update_setting('ti_site','{}')"),
      /RECENT_VERIFICATION_REQUIRED/,
    );
    await root(
      "update private.session_security set verified_at=now() where user_id=$1",
      [uid(actors.ti)],
    );
    assert.deepEqual(
      value(
        await as("ti", "select value from public.settings where key='ti_site'"),
      ),
      before,
    );
  },
);
await check(
  "Anexo sem registro pode ser limpo pelo remetente; arquivo registrado ou de outra pessoa permanece protegido",
  async () => {
    const employee = value(
      await root(
        "insert into public.employees(full_name,registration,profile_id,status) values('Titular dos anexos','ANEXO-LOCAL',$1,'active') returning id",
        [uid(actors.owner)],
      ),
    );
    const orphan = `${employee}/orphan.pdf`;
    const registered = `${employee}/registered.pdf`;
    for (const path of [orphan, registered]) {
      await as(
        "owner",
        "insert into storage.objects(bucket_id,name,owner_id) values('documents',$1,$2)",
        [path, uid(actors.owner)],
      );
    }
    assert.equal(
      (
        await as(
          "owner",
          "select name from storage.objects where bucket_id='documents' and name=$1",
          [orphan],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await as(
          "other",
          "delete from storage.objects where bucket_id='documents' and name=$1 returning name",
          [orphan],
        )
      ).rows.length,
      0,
    );
    await as("owner", "select public.attach_file($1)", [
      JSON.stringify({
        employee_id: employee,
        bucket: "documents",
        path: registered,
        filename: "registered.pdf",
        size_bytes: 16,
        mime_type: "application/pdf",
      }),
    ]);
    assert.equal(
      (
        await as(
          "owner",
          "delete from storage.objects where bucket_id='documents' and name=$1 returning name",
          [registered],
        )
      ).rows.length,
      0,
    );
    await root("update public.attachments set archived=true where path=$1", [
      registered,
    ]);
    assert.equal(
      (
        await as(
          "owner",
          "delete from storage.objects where bucket_id='documents' and name=$1 returning name",
          [registered],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await as(
          "owner",
          "delete from storage.objects where bucket_id='documents' and name=$1 returning name",
          [orphan],
        )
      ).rows.length,
      1,
    );
  },
);
await check(
  "Notificação de T.I. conserva dono e escopo, sem ganhar acesso no RH",
  async () => {
    const id = value(
      await as("ti", "select public.ti_send_notification($1,$2,$3,$4)", [
        uid(actors.owner),
        "Teste local",
        "Conferência isolada de notificação",
        "/notificacoes",
      ]),
    );
    assert.equal(
      (
        await as(
          "owner",
          "select scope,user_id from public.notifications where id=$1",
          [id],
        )
      ).rows[0].scope,
      "ti",
    );
    assert.equal(
      (
        await as("other", "select id from public.notifications where id=$1", [
          id,
        ])
      ).rows.length,
      0,
    );
    await denied(
      as("owner", "select public.ti_send_notification($1,$2,$3,$4)", [
        uid(actors.other),
        "Teste",
        "Sem permissão",
        "/",
      ]),
    );
    await denied(
      as("ti", "select public.ti_send_notification($1,$2,$3,$4)", [
        uid(actors.pending),
        "Teste",
        "Conta pendente",
        "/",
      ]),
      /INVALID_USER/,
    );
  },
);
await check(
  "Revogação por T.I. invalida imediatamente a sessão escolhida",
  async () => {
    await as("ti", "select public.revoke_session($1)", [
      uid(100 + actors.other),
    ]);
    assert.equal(
      value(await as("other", "select private.account_ready()")),
      false,
    );
    assert.equal(
      (await as("other", "select id from public.ti_support_tickets")).rows
        .length,
      0,
    );
  },
);
await check(
  "Configuração de manutenção inválida não bloqueia as contas nem é salva",
  async () => {
    const before = value(
      await root("select value from public.settings where key='maintenance'"),
    );
    try {
      for (const invalid of [
        { enabled: "banana" },
        { allow_managers: "banana" },
        { title: 42 },
        { message: [] },
      ]) {
        await denied(
          as("ti", "select public.ti_update_setting('maintenance',$1)", [
            JSON.stringify(invalid),
          ]),
          /INVALID_TRANSITION/,
        );
      }
      assert.deepEqual(
        value(
          await root(
            "select value from public.settings where key='maintenance'",
          ),
        ),
        before,
      );
      assert.equal(
        value(await as("owner", "select private.account_ready()")),
        true,
      );
    } finally {
      await root(
        "update public.settings set value=$1 where key='maintenance'",
        [JSON.stringify(before)],
      );
    }
  },
);
await check(
  "Anexo já vinculado a um chamado não é apagado pela limpeza de um envio",
  async () => {
    const path = `${uid(actors.owner)}/linked.pdf`;
    await as(
      "owner",
      "insert into storage.objects(bucket_id,name) values('ti-support',$1)",
      [path],
    );
    const id = await createTicket("owner", {
      subject: "Chamado com evidência",
    });
    await as(
      "ti",
      "update public.ti_support_tickets set attachment_path=$2 where id=$1",
      [id, path],
    );
    assert.equal(
      (
        await as(
          "owner",
          "delete from storage.objects where bucket_id='ti-support' and name=$1 returning name",
          [path],
        )
      ).rows.length,
      0,
    );
  },
);
await db.close();
process.stdout.write(
  `${results.filter((r) => r.passed).length}/${results.length} verificações de T.I. e suporte aprovadas.\n`,
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
