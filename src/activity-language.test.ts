import { describe, expect, it } from "vitest";
import {
  activityChanges,
  activityReferenceName,
  describeActivity,
  describeDatasulActivity,
  resolveActivityNames,
} from "../shared/activity-language";

describe("registros em linguagem simples", () => {
  it("trata nomes de propriedades internas como atividades desconhecidas", () => {
    const result = describeActivity({
      action: "constructor",
      module: "constructor",
      success: true,
      new_values: JSON.parse('{"constructor":"hidden","status":"constructor"}'),
    });
    expect(result.title).toBe("Registrou uma atividade");
    expect(result.area).toBe("Outras atividades");
    expect(result.changes).toEqual([
      { field: "Situação", before: "Não informado", after: "Outra opção" },
    ]);
  });
  it("explica a ação e mostra somente os campos que mudaram", () => {
    const entry = {
      action: "update",
      module: "attendance_members",
      actor_name: "Maria",
      success: true,
      old_values: { full_name_snapshot: "João", status: "absent", version: 1 },
      new_values: { full_name_snapshot: "João", status: "present", version: 2 },
    };
    expect(describeActivity(entry)).toMatchObject({
      title: "Atualizou uma presença",
      description: "Maria atualizou uma presença.",
      subject: "João",
      result: "Concluído",
    });
    expect(activityChanges(entry)).toEqual([
      { field: "Situação", before: "Ausente", after: "Presente" },
    ]);
  });
  it("não descreve uma tentativa recusada como alteração concluída", () => {
    const result = describeActivity({
      action: "delete",
      module: "employees",
      actor_name: "Maria",
      success: false,
    });
    expect(result.title).toBe(
      "Não foi possível remover o cadastro de uma pessoa",
    );
    expect(result.description).toContain("tentou remover");
    expect(result.result).toBe("Não concluído");
  });
  it("preserva zero e traduz estados sem mostrar códigos desconhecidos", () => {
    const changes = activityChanges({
      action: "update",
      module: "performance_scores",
      success: true,
      old_values: { score: 8, status: "open" },
      new_values: { score: 0, status: "INTERNAL_NEW_STATUS" },
    });
    expect(changes).toEqual([
      { field: "Nota", before: "8", after: "0" },
      { field: "Situação", before: "Aberto", after: "Outra opção" },
    ]);
  });
  it("mantém identificadores e dados de proteção fora da apresentação", () => {
    const hidden = "00000000-0000-4000-8000-000000000004";
    const result = describeActivity({
      action: "unknown_internal_action",
      module: "private_internal_table",
      success: true,
      new_values: {
        id: hidden,
        token: "secret-test",
        version: 3,
        user_id: hidden,
      },
    });
    const rendered = JSON.stringify(result);
    expect(rendered).not.toMatch(
      /unknown_internal_action|private_internal_table|secret-test|00000000|version/,
    );
    expect(result.area).toBe("Outras atividades");
  });
  it("resolve nomes em conjunto e tolera referências que não podem ser consultadas", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    const entries = [
      { action: "update", module: "employees", success: true, entity_id: id },
      {
        action: "insert",
        module: "user_roles",
        success: true,
        new_values: {
          user_id: id,
          role_id: "00000000-0000-4000-8000-000000000003",
        },
      },
    ];
    const requests: string[] = [];
    const names = await resolveActivityNames(entries, async (request) => {
      requests.push(request.table);
      if (request.table === "roles") throw new Error("FORBIDDEN");
      return [{ id, name: "João" }];
    });
    expect(requests).toEqual(["employees", "profiles", "roles"]);
    expect(describeActivity(entries[0], names).subject).toBe("João");
    expect(describeActivity(entries[1], names).subject).toBe("João");
  });
  it("explica a conexão Datasul sem despejar códigos de resposta", () => {
    const result = describeDatasulActivity({
      method: "GET",
      actor_name: "Maria",
      success: false,
      response_status: 403,
      duration_ms: 1500,
    });
    expect(result.title).toBe(
      "Não foi possível consultar informações no Datasul",
    );
    expect(result.note).toBe("O Datasul não autorizou esse acesso.");
    expect(result.duration).toBe("1,5 segundos");
  });
  it("compara notas pelo critério, mesmo quando a ordem muda, e preserva a nota zero", async () => {
    const first = "00000000-0000-4000-8000-000000000010";
    const second = "00000000-0000-4000-8000-000000000011";
    const entry = {
      action: "scores_before",
      module: "performance_reviews",
      success: true,
      old_values: [
        { criterion_id: first, criterion_name: "Participação", score: 8 },
        { criterion_id: second, score: 7 },
      ],
      new_values: [
        { criterion_id: second, score: 9 },
        { criterion_id: first, score: 0 },
      ],
    };
    const requests: string[][] = [];
    const names = await resolveActivityNames([entry], async (request) => {
      expect(request.table).toBe("performance_criteria");
      requests.push(request.ids);
      return [{ id: second, name: "Pontualidade" }];
    });
    expect(requests).toEqual([[first, second]]);
    expect(activityChanges(entry, names)).toEqual([
      { field: "Nota: Participação", before: "8", after: "0" },
      { field: "Nota: Pontualidade", before: "7", after: "9" },
    ]);
    expect(
      activityChanges(
        { ...entry, new_values: [...entry.old_values].reverse() },
        names,
      ),
    ).toEqual([]);
  });
  it("explica os acessos do cargo sem nomes de comandos", () => {
    const id = "00000000-0000-4000-8000-000000000012";
    const name = activityReferenceName(
      { table: "permissions", field: "name", ids: [id] },
      { id, code: "ti.datasul.read", name: "Datasul GET" },
    );
    expect(name).toBe("Consultar o Datasul");
    expect(
      activityChanges(
        {
          action: "save_role",
          module: "roles",
          success: true,
          context: { old_permissions: [], new_permissions: [id] },
        },
        new Map([[id, name]]),
      ),
    ).toEqual([
      {
        field: "O que o cargo pode fazer",
        before: "Nenhum",
        after: "Consultar o Datasul",
      },
    ]);
    expect(
      activityReferenceName(
        { table: "permissions", field: "name", ids: [id] },
        { code: "constructor", name: "INTERNAL_COMMAND" },
      ),
    ).toBe("Outro acesso do cargo");
  });
});
