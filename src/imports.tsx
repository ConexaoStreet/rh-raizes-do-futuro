import { useState } from "react";
import { z } from "zod";
import { client, json, rpc, runAction, useAsync } from "./api";
import { Field, Modal } from "./components";
import { localDate } from "./domain";
const employeeSchema = z.object({
  full_name: z.string().trim().min(2),
  registration: z.string().trim().min(1),
  email: z.union([z.email(), z.literal("")]),
  class_id: z.uuid(),
  join_date: z.iso.date(),
  status: z.literal("active"),
  expected_arrival: z.literal("08:00"),
  expected_departure: z.literal("14:00"),
});
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const separator = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("INVALID_CSV");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
type ImportRow = {
  full_name: string;
  registration: string;
  email: string;
  class_id: string;
  join_date: string;
  status: "active";
  expected_arrival: "08:00";
  expected_departure: "14:00";
};
export function ImportEmployees({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<string[]>([]);
  const [error, setError] = useState("");
  const classes = useAsync(async () => {
    const { data, error } = await client()
      .from("classes")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data;
  }, []);
  const duplicates = rows.map((r) => r.registration.trim());
  const issues = rows.map((row, index) =>
    !employeeSchema.safeParse(row).success
      ? "Revise os campos"
      : duplicates.indexOf(row.registration.trim()) !== index ||
          existing.includes(row.registration.trim())
        ? "Matrícula duplicada"
        : "",
  );
  async function read(file: File) {
    setError("");
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("LIMIT");
      let grid: string[][];
      if (file.name.toLowerCase().endsWith(".csv"))
        grid = parseCsv(await file.text());
      else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: ExcelJS } = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        grid = [];
        workbook.worksheets[0]?.eachRow((row) => {
          const values: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.type === ExcelJS.ValueType.Formula)
              throw new Error("FORMULA");
            values.push(cell.text);
          });
          grid.push(values);
        });
      } else throw new Error("TYPE");
      if (grid.length < 2 || grid.length > 1001) throw new Error("LIMIT");
      const header = grid[0].map((h) =>
        h
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase(),
      );
      const index = (names: string[]) =>
        header.findIndex((h) => names.includes(h));
      const ni = index(["nome", "nome completo", "full_name"]);
      const ri = index(["matricula", "registration", "codigo"]);
      const ei = index(["email", "e-mail"]);
      if (ni < 0 || ri < 0) throw new Error("COLUMNS");
      const parsed = grid
        .slice(1)
        .filter((r) => r.some((v) => v.trim()))
        .map((r) => ({
          full_name: r[ni]?.trim() || "",
          registration: r[ri]?.trim() || "",
          email: ei >= 0 ? r[ei]?.trim() || "" : "",
          class_id: classId,
          join_date: localDate(),
          status: "active" as const,
          expected_arrival: "08:00" as const,
          expected_departure: "14:00" as const,
        }));
      setRows(parsed);
      const found: string[] = [];
      for (let i = 0; i < parsed.length; i += 100) {
        const { data, error } = await client()
          .from("employees")
          .select("registration")
          .in(
            "registration",
            parsed.slice(i, i + 100).map((r) => r.registration),
          );
        if (error) throw error;
        found.push(...data.map((r) => r.registration));
      }
      setExisting(found);
    } catch {
      setError(
        "Não foi possível ler o arquivo. Use CSV ou XLSX, até 1.000 pessoas, com as colunas Nome, Matrícula e E-mail.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title="Importar colaboradores" onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Turma">
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setRows((r) =>
                r.map((item) => ({ ...item, class_id: e.target.value })),
              );
            }}
          >
            <option value="">Selecionar</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Arquivo CSV ou XLSX">
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={busy || !classId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void read(f);
            }}
          />
        </Field>
      </div>
      {error && <div className="notice danger">{error}</div>}
      {rows.length > 0 && (
        <>
          <div className="import-summary">
            {rows.length} pessoas · {issues.filter(Boolean).length} registros
            para revisar
          </div>
          <div className="table-scroll import-preview">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Matrícula</th>
                  <th>E-mail</th>
                  <th>Revisão</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {(["full_name", "registration", "email"] as const).map(
                      (key) => (
                        <td key={key}>
                          <input
                            aria-label={`${key} linha ${i + 1}`}
                            value={row[key]}
                            onChange={(e) =>
                              setRows((previous) =>
                                previous.map((r, j) =>
                                  j === i ? { ...r, [key]: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </td>
                      ),
                    )}
                    <td>{issues[i] || "Pronto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="modal-footer">
        <button onClick={onClose}>Cancelar</button>
        <button
          className="primary"
          disabled={busy || !rows.length || issues.some(Boolean)}
          onClick={async () => {
            if (!confirm(`Importar ${rows.length} colaboradores?`)) return;
            setBusy(true);
            const ok = await runAction(
              () => rpc("import_employees", { rows: json(rows) }),
              "Colaboradores importados.",
            );
            setBusy(false);
            if (ok) {
              onSaved();
              onClose();
            }
          }}
        >
          {busy ? "Aguarde..." : "Confirmar importação"}
        </button>
      </div>
    </Modal>
  );
}
