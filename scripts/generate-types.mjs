import fs from "node:fs/promises";
import { createDatabase } from "../tests/setup-database.mjs";
const db = await createDatabase();
const { rows: tables } = await db.query(
  `select table_name,column_name,data_type,is_nullable,column_default,is_generated from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
);
const { rows: relationships } = await db.query(
  `select con.conname,rel.relname table_name,ref.relname referenced_table,(select jsonb_agg(a.attname order by k.n) from unnest(con.conkey) with ordinality k(attnum,n) join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum) columns,(select jsonb_agg(a.attname order by k.n) from unnest(con.confkey) with ordinality k(attnum,n) join pg_attribute a on a.attrelid=con.confrelid and a.attnum=k.attnum) referenced_columns from pg_constraint con join pg_class rel on rel.oid=con.conrelid join pg_class ref on ref.oid=con.confrelid join pg_namespace n on n.oid=rel.relnamespace join pg_namespace nr on nr.oid=ref.relnamespace where con.contype='f' and n.nspname='public' and nr.nspname='public'`,
);
const typeFor = (t) =>
  [
    "integer",
    "bigint",
    "numeric",
    "real",
    "double precision",
    "smallint",
  ].includes(t)
    ? "number"
    : t === "boolean"
      ? "boolean"
      : t === "jsonb"
        ? "Json"
        : t === "ARRAY"
          ? "string[]"
          : "string";
let output = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\nexport type Database = { public: { Tables: {\n`;
for (const name of [...new Set(tables.map((t) => t.table_name))]) {
  const columns = tables.filter((t) => t.table_name === name);
  output += `${name}: { Row: {\n${columns.map((c) => `${c.column_name}: ${typeFor(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""}`).join("\n")}\n}; Insert: {\n${columns
    .filter((c) => c.is_generated !== "ALWAYS")
    .map(
      (c) =>
        `${c.column_name}${c.column_default || c.is_nullable === "YES" ? "?" : ""}: ${typeFor(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""}`,
    )
    .join(
      "\n",
    )}\n}; Update: Partial<Database['public']['Tables']['${name}']['Insert']>; Relationships: ${JSON.stringify(relationships.filter((r) => r.table_name === name).map((r) => ({ foreignKeyName: r.conname, columns: r.columns, isOneToOne: false, referencedRelation: r.referenced_table, referencedColumns: r.referenced_columns })))} };\n`;
}
output += "}; Views: Record<string, never>; Functions: {\n";
const { rows: functions } = await db.query(
  `select p.proname,p.proargnames,p.proargtypes::oid[] argtypes,pg_get_function_result(p.oid) result_type from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname`,
);
for (const f of functions) {
  let args = [];
  for (let i = 0; i < (f.proargnames || []).length; i++) {
    const {
      rows: [t],
    } = await db.query("select format_type($1::oid,null) type", [
      f.argtypes[i],
    ]);
    const type = t.type === "uuid[]" ? "string[]" : typeFor(t.type);
    args.push(`${f.proargnames[i]}: ${type} | null`);
  }
  output += `${f.proname}: { Args: ${args.length ? "{" + args.join(";") + "}" : "Record<string, never>"}; Returns: ${f.result_type === "void" ? "undefined" : typeFor(f.result_type)} };\n`;
}
output +=
  '}; Enums: Record<string,never>; CompositeTypes: Record<string,never> } }\nexport type TableName = keyof Database["public"]["Tables"]\nexport type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"]\n';
await fs.writeFile("src/database.types.ts", output);
await db.close();
process.stdout.write(
  `Tipos gerados: ${new Set(tables.map((t) => t.table_name)).size} tabelas, ${functions.length} funções.\n`,
);
