import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, ArrowUpRight } from "lucide-react";
import { client, json, rpc, runAction, useAsync, useDebounce } from "./api";
import { useAuth } from "./auth";
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  Heading,
  Loading,
  Modal,
  Pagination,
} from "./components";
import type { TableName } from "./database.types";
import { dateLabel } from "./domain";
export type EntityRecord = {
  id: string;
  version: number;
  [key: string]: unknown;
};
export type FieldSpec = {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "time"
    | "number"
    | "textarea"
    | "select"
    | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
  reference?: TableName;
  wide?: boolean;
  min?: number;
  max?: number;
  step?: string;
};
export type EntitySpec = {
  title: string;
  singular: string;
  table: TableName;
  permission: string;
  search: string;
  columns: {
    key: string;
    label: string;
    type?: "date" | "status" | "boolean" | "reference" | "option";
  }[];
  fields: FieldSpec[];
};
const options = (values: [string, string][]) =>
  values.map(([value, label]) => ({ value, label }));
const active: FieldSpec = { key: "active", label: "Ativo", type: "checkbox" };
const name: FieldSpec = { key: "name", label: "Nome", required: true };
const cycleFields: FieldSpec[] = [
  { key: "title", label: "Título", required: true, wide: true },
  { key: "start_date", label: "Data inicial", type: "date", required: true },
  { key: "end_date", label: "Data final", type: "date", required: true },
  {
    key: "status",
    label: "Situação",
    type: "select",
    options: options([
      ["draft", "Rascunho"],
      ["scheduled", "Agendado"],
      ["open", "Aberto"],
      ["closed", "Encerrado"],
      ["archived", "Arquivado"],
    ]),
    required: true,
  },
];
export const specs: Record<string, EntitySpec> = {
  colaboradores: {
    title: "Colaboradores",
    singular: "colaborador",
    table: "employees",
    permission: "employee.manage",
    search: "full_name",
    columns: [
      { key: "full_name", label: "Nome" },
      { key: "member_group", label: "Grupo", type: "option" },
      { key: "registration", label: "Matrícula" },
      { key: "class_id", label: "Turma", type: "reference" },
      { key: "manager_id", label: "Gestor", type: "reference" },
      { key: "status", label: "Situação", type: "status" },
    ],
    fields: [
      { key: "full_name", label: "Nome completo", required: true, wide: true },
      { key: "social_name", label: "Nome social" },
      {
        key: "member_group",
        label: "Grupo",
        type: "select",
        required: true,
        options: options([
          ["class", "Turma"],
          ["rh", "Equipe de RH"],
        ]),
      },
      { key: "registration", label: "Matrícula", required: true },
      { key: "email", label: "E-mail", type: "email" },
      { key: "phone", label: "Telefone", type: "tel" },
      {
        key: "join_date",
        label: "Data de entrada",
        type: "date",
        required: true,
      },
      {
        key: "class_id",
        label: "Turma",
        type: "select",
        reference: "classes",
        required: true,
      },
      {
        key: "department_id",
        label: "Área",
        type: "select",
        reference: "departments",
      },
      {
        key: "job_position_id",
        label: "Função",
        type: "select",
        reference: "job_positions",
      },
      {
        key: "manager_id",
        label: "Gestor",
        type: "select",
        reference: "managers",
      },
      {
        key: "expected_arrival",
        label: "Entrada prevista",
        type: "time",
        required: true,
      },
      {
        key: "expected_departure",
        label: "Saída prevista",
        type: "time",
        required: true,
      },
      {
        key: "status",
        label: "Situação",
        type: "select",
        required: true,
        options: options([
          ["active", "Ativo"],
          ["inactive", "Desativado"],
        ]),
      },
    ],
  },
  feedbacks: {
    title: "Feedbacks",
    singular: "feedback",
    table: "feedbacks",
    permission: "feedback.manage",
    search: "title",
    columns: [
      { key: "title", label: "Título" },
      { key: "employee_id", label: "Colaborador", type: "reference" },
      { key: "kind", label: "Tipo", type: "status" },
      { key: "due_date", label: "Prazo", type: "date" },
      { key: "status", label: "Situação", type: "status" },
    ],
    fields: [
      {
        key: "employee_id",
        label: "Colaborador",
        type: "select",
        reference: "employees",
        required: true,
        wide: true,
      },
      { key: "title", label: "Título", required: true, wide: true },
      {
        key: "kind",
        label: "Tipo",
        type: "select",
        required: true,
        options: options([
          ["positive", "Positivo"],
          ["development", "Desenvolvimento"],
          ["alignment", "Alinhamento"],
          ["recognition", "Reconhecimento"],
          ["guidance", "Orientação"],
          ["formal", "Formal"],
          ["other", "Outro"],
        ]),
      },
      { key: "due_date", label: "Prazo", type: "date" },
      {
        key: "description",
        label: "Descrição",
        type: "textarea",
        required: true,
        wide: true,
      },
      {
        key: "strengths",
        label: "Pontos positivos",
        type: "textarea",
        wide: true,
      },
      {
        key: "improvements",
        label: "Pontos a desenvolver",
        type: "textarea",
        wide: true,
      },
      {
        key: "actions",
        label: "Ações combinadas",
        type: "textarea",
        wide: true,
      },
      {
        key: "status",
        label: "Situação",
        type: "select",
        required: true,
        options: options([
          ["open", "Aberto"],
          ["following", "Em acompanhamento"],
          ["completed", "Concluído"],
          ["archived", "Arquivado"],
        ]),
      },
      {
        key: "released",
        label: "Liberar para o colaborador",
        type: "checkbox",
      },
      { key: "allow_response", label: "Permitir resposta", type: "checkbox" },
    ],
  },
  turmas: {
    title: "Turmas",
    singular: "turma",
    table: "classes",
    permission: "settings.manage",
    search: "name",
    columns: [
      { key: "name", label: "Turma" },
      { key: "code", label: "Código" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [name, { key: "code", label: "Código", required: true }, active],
  },
  areas: {
    title: "Áreas",
    singular: "área",
    table: "departments",
    permission: "settings.manage",
    search: "name",
    columns: [
      { key: "name", label: "Área" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [name, active],
  },
  funcoes: {
    title: "Funções",
    singular: "função",
    table: "job_positions",
    permission: "settings.manage",
    search: "name",
    columns: [
      { key: "name", label: "Função" },
      { key: "description", label: "Descrição" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [
      name,
      { key: "description", label: "Descrição", type: "textarea", wide: true },
      active,
    ],
  },
  gestores: {
    title: "Gestores",
    singular: "gestor",
    table: "managers",
    permission: "system.manage",
    search: "full_name",
    columns: [
      { key: "full_name", label: "Nome" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [
      { key: "full_name", label: "Nome completo", required: true, wide: true },
      {
        key: "profile_id",
        label: "Conta individual",
        type: "select",
        reference: "profiles",
      },
      active,
    ],
  },
  ciclos: {
    title: "Ciclos de notas",
    singular: "ciclo",
    table: "performance_cycles",
    permission: "performance.manage",
    search: "title",
    columns: [
      { key: "title", label: "Título" },
      { key: "start_date", label: "Início", type: "date" },
      { key: "end_date", label: "Fim", type: "date" },
      { key: "status", label: "Situação", type: "status" },
    ],
    fields: cycleFields,
  },
  criterios: {
    title: "Critérios de notas",
    singular: "critério",
    table: "performance_criteria",
    permission: "settings.manage",
    search: "name",
    columns: [
      { key: "name", label: "Critério" },
      { key: "weight", label: "Peso" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [
      name,
      {
        key: "weight",
        label: "Peso",
        type: "number",
        required: true,
        min: 0.1,
        max: 100,
        step: "0.1",
      },
      active,
    ],
  },
  "criterios-gestao": {
    title: "Critérios da gestão",
    singular: "critério",
    table: "manager_review_criteria",
    permission: "review.manage",
    search: "name",
    columns: [
      { key: "name", label: "Critério" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [name, active],
  },
  categorias: {
    title: "Tipos de justificativa",
    singular: "tipo",
    table: "justification_categories",
    permission: "settings.manage",
    search: "name",
    columns: [
      { key: "name", label: "Tipo" },
      { key: "active", label: "Ativo", type: "boolean" },
    ],
    fields: [name, active],
  },
  eventos: {
    title: "Eventos",
    singular: "evento",
    table: "events",
    permission: "calendar.manage",
    search: "title",
    columns: [
      { key: "title", label: "Evento" },
      { key: "event_date", label: "Data", type: "date" },
      { key: "status", label: "Situação", type: "status" },
    ],
    fields: [
      { key: "title", label: "Título", required: true, wide: true },
      { key: "event_date", label: "Data", type: "date", required: true },
      { key: "class_id", label: "Turma", type: "select", reference: "classes" },
      { key: "description", label: "Descrição", type: "textarea", wide: true },
      {
        key: "status",
        label: "Situação",
        type: "select",
        options: options([
          ["open", "Aberto"],
          ["completed", "Concluído"],
          ["cancelled", "Cancelado"],
        ]),
        required: true,
      },
    ],
  },
};
export function useReferences(fields: FieldSpec[]) {
  const tables = useMemo(
    () => [
      ...new Set(
        fields
          .map((f) => f.reference)
          .filter((t): t is TableName => Boolean(t)),
      ),
    ],
    [fields],
  );
  return useAsync(async () => {
    const result: Record<string, { value: string; label: string }[]> = {};
    await Promise.all(
      tables.map(async (table) => {
        const name =
          table === "employees" || table === "managers" || table === "profiles"
            ? "full_name"
            : "name";
        const { data, error } = await client()
          .from(table)
          .select(`id,${name}`)
          .order(name)
          .limit(1000);
        if (error) throw error;
        result[table] = (data as unknown as Record<string, string>[]).map(
          (row) => ({ value: row.id, label: row[name] }),
        );
      }),
    );
    return result;
  }, [tables]);
}
export function EntityForm({
  spec,
  record,
  onClose,
  onSaved,
}: {
  spec: EntitySpec;
  record: EntityRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useReferences(spec.fields);
  const [busy, setBusy] = useState(false);
  const defaults: Record<string, unknown> = {
    ...Object.fromEntries(
      spec.fields.map((f) => [
        f.key,
        f.type === "checkbox"
          ? ["active", "allow_response"].includes(f.key)
          : f.key === "status"
            ? f.options?.[0]?.value
            : f.key === "expected_arrival"
              ? "08:00"
              : f.key === "expected_departure"
                ? "14:00"
                : f.key === "join_date"
                  ? new Date().toISOString().slice(0, 10)
                  : f.type === "select" && f.required
                    ? f.options?.[0]?.value || ""
                    : "",
      ]),
    ),
    ...record,
  };
  const { register, handleSubmit } = useForm<Record<string, unknown>>({
    defaultValues: defaults,
  });
  return (
    <Modal
      open
      title={`${record ? "Editar" : "Novo"} ${spec.singular}`}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={handleSubmit(async (data) => {
          if (
            record &&
            spec.table === "employees" &&
            data.status === "inactive" &&
            !confirm("Desativar este colaborador?")
          )
            return;
          setBusy(true);
          const payload: Record<string, unknown> = {};
          for (const field of spec.fields) {
            const value = data[field.key];
            payload[field.key] =
              field.type === "checkbox"
                ? Boolean(value)
                : field.type === "number"
                  ? Number(value)
                  : value === "" &&
                      ["date", "time", "select"].includes(field.type || "")
                    ? null
                    : value;
          }
          if (record) payload.id = record.id;
          const ok = await runAction(() =>
            rpc("save_entity", {
              entity: spec.table,
              payload: json(payload),
              expected_version: record?.version || null,
            }),
          );
          setBusy(false);
          if (ok) {
            onSaved();
            onClose();
          }
        })}
      >
        <div className="form-grid">
          {spec.fields.map((field) => (
            <Field key={field.key} label={field.label} wide={field.wide}>
              {field.type === "textarea" ? (
                <textarea
                  rows={3}
                  {...register(field.key, { required: field.required })}
                />
              ) : field.type === "select" ? (
                <select {...register(field.key, { required: field.required })}>
                  <option value="">Selecionar</option>
                  {(field.reference
                    ? ref.data?.[field.reference] || []
                    : field.options || []
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <input type="checkbox" {...register(field.key)} />
              ) : (
                <input
                  type={field.type || "text"}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  {...register(field.key, { required: field.required })}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || ref.loading}>
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function EntityPage({
  spec,
  onSelect,
  extra,
  filter,
  subnav,
}: {
  spec: EntitySpec;
  onSelect?: (record: EntityRecord) => void;
  extra?: React.ReactNode;
  filter?: { key: string; value: string };
  subnav?: React.ReactNode;
}) {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const query = useDebounce(search);
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<EntityRecord | null | undefined>(undefined);
  const refs = useReferences(spec.fields);
  const results = useAsync(async () => {
    let q = client()
      .from(spec.table)
      .select("*", { count: "exact" })
      .order(spec.search)
      .range(page * 25, page * 25 + 24);
    if (query) q = q.ilike(spec.search, `%${query.replace(/[%_]/g, "")}%`);
    if (filter) q = q.eq(filter.key as never, filter.value as never);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: data as unknown as EntityRecord[], total: count || 0 };
  }, [spec.table, query, page, filter?.key, filter?.value]);
  return (
    <>
      <Heading title={spec.title} eyebrow="GESTÃO DE RH">
        {extra}
        {can(spec.permission) && (
          <button className="primary" onClick={() => setEdit(null)}>
            <Plus size={18} />
            Novo {spec.singular}
          </button>
        )}
      </Heading>
      {subnav}
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label={`Buscar ${spec.title.toLowerCase()}`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar"
            />
          </div>
          <span className="muted">{results.data?.total || 0} registros</span>
        </div>
        {results.loading ? (
          <Loading />
        ) : results.error ? (
          <ErrorState retry={results.reload} />
        ) : !results.data?.rows.length ? (
          <Empty />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {spec.columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {results.data.rows.map((row) => (
                  <tr key={row.id}>
                    {spec.columns.map((column, index) => {
                      const value = row[column.key];
                      const field = spec.fields.find(
                        (f) => f.key === column.key,
                      );
                      const formatted =
                        column.type === "status" ? (
                          <Badge value={value} />
                        ) : column.type === "date" ? (
                          dateLabel(String(value || ""))
                        ) : column.type === "boolean" ? (
                          value ? (
                            "Sim"
                          ) : (
                            "Não"
                          )
                        ) : column.type === "reference" ? (
                          refs.data?.[field?.reference || ""]?.find(
                            (item) => item.value === value,
                          )?.label || "—"
                        ) : column.type === "option" ? (
                          field?.options?.find((item) => item.value === value)
                            ?.label || "—"
                        ) : (
                          String(value ?? "—")
                        );
                      return (
                        <td key={column.key} data-label={column.label}>
                          {index === 0 && spec.table === "employees" ? (
                            <Link
                              className="row-link"
                              to={`/colaboradores/${row.id}`}
                            >
                              <span className="avatar">
                                {String(value)
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((s) => s[0])
                                  .join("")}
                              </span>
                              {formatted}
                            </Link>
                          ) : index === 0 && onSelect ? (
                            <button
                              className="text-button"
                              onClick={() => onSelect(row)}
                            >
                              {formatted}
                            </button>
                          ) : (
                            formatted
                          )}
                        </td>
                      );
                    })}
                    <td className="row-actions">
                      {onSelect && (
                        <button
                          className="icon-button"
                          aria-label="Abrir detalhes"
                          onClick={() => onSelect(row)}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      )}
                      {can(spec.permission) && (
                        <button
                          className="icon-button"
                          aria-label={`Editar ${String(row[spec.search])}`}
                          onClick={() => setEdit(row)}
                        >
                          <Pencil size={17} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          total={results.data?.total || 0}
          onChange={setPage}
        />
      </section>
      {edit !== undefined && (
        <EntityForm
          key={edit?.id || "new"}
          spec={spec}
          record={edit}
          onClose={() => setEdit(undefined)}
          onSaved={results.reload}
        />
      )}
    </>
  );
}
