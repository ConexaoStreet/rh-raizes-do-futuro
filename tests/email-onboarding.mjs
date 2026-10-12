import assert from "node:assert/strict";
import { createDatabase } from "./setup-database.mjs";

const db = await createDatabase();
const uid = (n) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let passed = 0;
async function root(sql, args = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims','{}',false)");
  return db.query(sql, args);
}
async function as(n, sql, args = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: uid(n), session_id: uid(100 + n), role: "authenticated" }),
  ]);
  await db.exec("set role authenticated");
  return db.query(sql, args);
}
const value = (result) => Object.values(result.rows[0] || {})[0];
async function check(name, run) {
  await run();
  passed++;
  console.log(`✓ ${name}`);
}

try {
  const dept = value(await root("insert into public.departments(name) values('Área de auditoria de e-mail') returning id"));
  const otherDept = value(await root("insert into public.departments(name) values('Outra área de auditoria') returning id"));
  const assignedClass = value(await root("insert into public.classes(name,code) values('Turma de auditoria de e-mail','EMAIL-AUDIT') returning id"));
  const accounts = [
    [1, "COLLABORATOR", "colaborador@outlook.com"],
    [2, "MANAGER", "gestor@empresa.com.br"],
    [3, "INSTRUCTOR", "instrutor@maxxspace.com"],
    [4, "DIRECTOR", "diretor@yahoo.com.br"],
    [5, "COLLABORATOR", "pendente@empresa.com.br"],
    [6, "COLLABORATOR", "revogado@empresa.com.br"],
    [7, "COLLABORATOR", "semcadastro@empresa.com.br"],
    [8, "COLLABORATOR", "semtermos@empresa.com.br"],
  ];
  for (const [n, role, email] of accounts) {
    await root("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)", [
      uid(n), email, n === 5 ? null : new Date().toISOString(),
      JSON.stringify({ full_name: `Pessoa Auditoria Email ${n}`, requested_role_code: "SUPER_ADMIN", requested_department_id: otherDept }),
    ]);
    await root("insert into auth.sessions(id,user_id) values($1,$2)", [uid(100 + n), uid(n)]);
    if (n !== 7) await root("insert into public.employees(full_name,registration,department_id,class_id,access_role_code) values($1,$2,$3,$4,$5)", [
      `Pessoa Auditoria Email ${n}`, `EMAIL-${n}`, dept, assignedClass, role,
    ]);
    if (role === "MANAGER") await root("insert into public.managers(full_name) values($1)", [`Pessoa Auditoria Email ${n}`]);
  }
  const payload = (n, extra = {}) => JSON.stringify({ full_name: `Pessoa Auditoria Email ${n}`, phone: "00000000000", department_id: otherDept, role_code: "SUPER_ADMIN", terms: true, ...extra });
  for (const [n, role, email] of accounts.slice(0, 4)) {
    await check(`${role}: e-mail confirmado de outro provedor conclui o cadastro com o cargo e setor autorizados`, async () => {
      await as(n, "select public.complete_profile($1)", [payload(n)]);
      const profile = (await root("select status,email,requested_role_code,requested_department_id,requested_class from public.profiles where id=$1", [uid(n)])).rows[0];
      assert.equal(profile.status, "active");
      assert.equal(profile.email, email);
      assert.equal(profile.requested_role_code, role);
      assert.equal(profile.requested_department_id, dept);
      assert.equal(profile.requested_class, "Turma de auditoria de e-mail");
      const employee = (await root("select department_id,class_id from public.employees where profile_id=$1", [uid(n)])).rows[0];
      assert.equal(employee.department_id, dept);
      assert.equal(employee.class_id, assignedClass);
      assert.deepEqual(value(await as(n, "select private.roles_for_current_user()")), [role]);
      assert.equal(value(await as(n, "select private.account_ready()")), !["MANAGER", "DIRECTOR"].includes(role));
    });
  }
  await check("Gestor mantém o vínculo no RH e precisa confirmar a segunda etapa", async () => {
    assert.equal(value(await root("select profile_id from public.managers where full_name='Pessoa Auditoria Email 2'")), uid(2));
    await root("insert into private.session_security(session_id,user_id,verified_at,verified_until) values($1,$2,now(),now()+interval '8 hours')", [uid(102), uid(2)]);
    assert.equal(value(await as(2, "select private.account_ready()")), true);
  });
  await check("E-mail sem confirmação continua recusado", () => assert.rejects(as(5, "select public.complete_profile($1)", [payload(5)]), /EMAIL_NOT_VERIFIED/));
  await check("Sessão revogada continua recusada", async () => {
    await root("insert into private.session_security(session_id,user_id,revoked_at) values($1,$2,now())", [uid(106), uid(6)]);
    await assert.rejects(as(6, "select public.complete_profile($1)", [payload(6)]), /FORBIDDEN/);
  });
  await check("Endereço válido não concede acesso sem pré-cadastro", () => assert.rejects(as(7, "select public.complete_profile($1)", [payload(7)]), /PRE_REGISTRATION_NOT_FOUND/));
  await check("Aceite dos termos continua obrigatório", () => assert.rejects(as(8, "select public.complete_profile($1)", [payload(8, { terms: false })]), /TERMS_REQUIRED/));
  await check("Tentativas recusadas não recebem cargo nem vínculo", async () => {
    assert.equal(Number(value(await root("select count(*) from public.user_roles where user_id=any($1::uuid[])", [[5, 6, 7, 8].map(uid)]))), 0);
    assert.equal(Number(value(await root("select count(*) from public.employees where profile_id=any($1::uuid[])", [[5, 6, 7, 8].map(uid)]))), 0);
  });
  assert.equal(passed, 10);
  console.log(`${passed} verificações de ativação com qualquer provedor aprovadas.`);
} finally {
  await db.close();
}
