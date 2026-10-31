import { describe, expect, it } from "vitest";
import { findRoleColumn, profileColumns, toCsv } from "./dataset-profile";

describe("dataset profiling", () => {
  const rows = [
    { marks: "45", subject: "DS", date: "2026-01-02", ok: "yes" },
    { marks: 50, subject: "", date: "2026-01-03", ok: "no" },
    { marks: "", subject: "OS", date: "2026-01-04", ok: "true" },
  ];
  const p = Object.fromEntries(profileColumns(rows).map((c) => [c.name, c]));
  it("detects numeric columns even when stored as text", () => expect(p.marks!.type).toBe("number"));
  it("counts blank cells as missing", () => { expect(p.marks!.missing).toBe(1); expect(p.subject!.missing).toBe(1); });
  it("detects dates and yes/no columns", () => { expect(p.date!.type).toBe("date"); expect(p.ok!.type).toBe("boolean"); });
  it("finds the evaluator and subject columns by header name", () => {
    expect(findRoleColumn(["Marks", "Examiner", "Course"], "evaluator")).toBe("Examiner");
    expect(findRoleColumn(["Marks", "Examiner", "Course"], "subject")).toBe("Course");
  });
  it("quotes commas in CSV export", () => expect(toCsv([{ a: "x,y" }])).toBe('a\n"x,y"'));
});
