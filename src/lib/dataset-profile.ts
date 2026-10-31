export type ColumnProfile = { name: string; type: "number" | "date" | "text" | "boolean"; missing: number; unique: number };
export type Row = Record<string, unknown>;

export const MAX_DATASET_ROWS = 20000;

const isMissing = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const isNum = (v: unknown) => typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
const isBool = (v: unknown) => typeof v === "boolean" || (typeof v === "string" && /^(true|false|yes|no)$/i.test(v.trim()));
const isDate = (v: unknown) => v instanceof Date || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) && !Number.isNaN(Date.parse(v)));

/** Infers a column type from its non-missing values (all must agree, else text). */
export function profileColumns(rows: Row[]): ColumnProfile[] {
  const names = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return names.map((name) => {
    const vals = rows.map((r) => r[name]);
    const present = vals.filter((v) => !isMissing(v));
    const type: ColumnProfile["type"] =
      present.length === 0 ? "text"
      : present.every(isNum) ? "number"
      : present.every(isBool) ? "boolean"
      : present.every(isDate) ? "date"
      : "text";
    return { name, type, missing: vals.length - present.length, unique: new Set(present.map(String)).size };
  });
}

/** Finds the column that plays a role (exam, subject, evaluator, date) by its header name. */
export function findRoleColumn(cols: string[], role: "exam" | "subject" | "evaluator" | "date"): string | undefined {
  const pats: Record<typeof role, RegExp> = {
    exam: /^(exam|exam_?code|exam_?name|examination)$/i,
    subject: /^(subject|course|paper|subject_?name)$/i,
    evaluator: /^(evaluator|examiner|valuer|evaluator_?name|evaluator_?id)$/i,
    date: /^(date|evaluated_?at|evaluation_?date|exam_?date)$/i,
  };
  return cols.find((c) => pats[role].test(c.trim()));
}

export function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
