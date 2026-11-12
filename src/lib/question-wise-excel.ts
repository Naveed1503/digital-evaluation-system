import * as XLSX from "xlsx";
import { finalMark, gradeFor, percentage } from "./grading";
import type { QuestionWiseReport } from "./question-wise-report";

type Cell = string | number;
type ExportRow = Record<string, Cell>;

function safeSheetName(base: string, used: Set<string>) {
  const clean = base.replace(/[\\/?*[\]:]/g, "-").trim() || "Report";
  let name = clean.slice(0, 31);
  let n = 2;
  while (used.has(name)) {
    name = `${clean.slice(0, 27)}-${n}`.slice(0, 31);
    n += 1;
  }
  used.add(name);
  return name;
}

function addRowsSheet(workbook: XLSX.WorkBook, name: string, rows: ExportRow[], headers: string[]) {
  const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(42, Math.max(12, header.length + 2)) }));
  if (rows.length) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function buildQuestionWiseWorkbook(report: QuestionWiseReport) {
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const roleLabel = report.scope === "exam" ? "Controller" : report.scope === "evaluator" ? "Evaluator" : "Moderator";
  addRowsSheet(workbook, safeSheetName("Report Summary", used), [{
    "Report": "Question-wise examination marks",
    "Prepared for": roleLabel,
    "Generated at": new Date(report.generatedAt).toLocaleString(),
    "Examinations": report.exams.length,
    "Scripts": report.scripts.length,
    "Question mark entries": report.marks.length,
    "Access note": report.scope === "exam" ? "Controller report with candidate identity" : "Only scripts assigned to the signed-in staff member; candidate identity is excluded",
  }], ["Report", "Prepared for", "Generated at", "Examinations", "Scripts", "Question mark entries", "Access note"]);

  const markByKey = new Map(report.marks.map((m) => [`${m.scriptId}:${m.questionId}`, m]));
  const ownerByScript = new Map(report.owners.map((o) => [o.scriptId, o.studentId]));
  const personById = new Map(report.people.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const person = personById.get(id);
    return person?.fullName || person?.email || "—";
  };

  for (const exam of report.exams) {
    const scripts = report.scripts.filter((s) => s.examId === exam.id).sort((a, b) => a.code.localeCompare(b.code));
    if (!scripts.length) continue;
    const questions = report.questions.filter((q) => q.examId === exam.id).sort((a, b) => a.number - b.number);
    const maxTotal = questions.reduce((sum, q) => sum + q.maxMarks, 0);
    const rows: ExportRow[] = [];
    const details: ExportRow[] = [];

    for (const script of scripts) {
      const studentId = ownerByScript.get(script.id);
      const student = studentId ? personById.get(studentId) : undefined;
      const currentTotal = report.scope === "evaluator" ? script.evaluatorTotal : (script.finalTotal ?? script.evaluatorTotal);
      const pct = currentTotal == null ? null : percentage(currentTotal, maxTotal);
      const row: ExportRow = {
        "Paper Code": exam.code,
        "Script Code": script.code,
      };
      if (report.scope === "exam") {
        row["Roll Number"] = student?.rollNumber ?? "";
        row["Candidate Name"] = student?.fullName ?? "";
        row["Candidate Email"] = student?.email ?? "";
        row["Evaluator"] = nameOf(script.evaluatorId);
        row["Moderator"] = nameOf(script.moderatorId);
      }
      row["Status"] = script.status;
      for (const question of questions) {
        const mark = markByKey.get(`${script.id}:${question.id}`);
        const secured = report.scope === "evaluator" ? mark?.evaluatorMarks : finalMark(mark?.evaluatorMarks ?? null, mark?.moderatedMarks ?? null);
        row[`Q${question.number} Secured (/ ${question.maxMarks})`] = secured ?? "";
      }
      row["Evaluator Total"] = script.evaluatorTotal ?? "";
      if (report.scope !== "evaluator") row["Final Total"] = script.finalTotal ?? "";
      row["Percentage"] = pct ?? "";
      row["Grade"] = pct == null ? "" : gradeFor(pct).grade;
      rows.push(row);

      for (const question of questions) {
        const mark = markByKey.get(`${script.id}:${question.id}`);
        const detail: ExportRow = {
          "Paper Code": exam.code,
          "Script Code": script.code,
          "Question": `Q${question.number}`,
          "Topic": question.label,
          "Maximum Marks": question.maxMarks,
          "Evaluator Marks": mark?.evaluatorMarks ?? "",
        };
        if (report.scope === "evaluator") {
          detail["Evaluator Remark"] = mark?.evaluatorRemark ?? "";
        } else {
          const final = finalMark(mark?.evaluatorMarks ?? null, mark?.moderatedMarks ?? null);
          detail["Moderated Marks"] = mark?.moderatedMarks ?? "";
          detail["Final Marks"] = final ?? "";
          detail["Moderation Difference"] = final == null || mark?.evaluatorMarks == null ? "" : final - mark.evaluatorMarks;
          detail["Evaluator Remark"] = mark?.evaluatorRemark ?? "";
          detail["Moderation Reason"] = mark?.moderationReason ?? "";
        }
        details.push(detail);
      }
    }

    const mainHeaders = Object.keys(rows[0] ?? { "Paper Code": "", "Script Code": "" });
    addRowsSheet(workbook, safeSheetName(`${exam.code} Marks`, used), rows, mainHeaders);
    addRowsSheet(workbook, safeSheetName(`${exam.code} Q Detail`, used), details, Object.keys(details[0] ?? { "Script Code": "", "Question": "" }));
  }
  return workbook;
}

export function downloadQuestionWiseWorkbook(report: QuestionWiseReport, subjectCode?: string) {
  const workbook = buildQuestionWiseWorkbook(report);
  const date = report.generatedAt.slice(0, 10);
  const subject = subjectCode ? `-${subjectCode.replace(/[^a-z0-9-]/gi, "")}` : "";
  XLSX.writeFile(workbook, `question-wise-marks${subject}-${report.scope}-${date}.xlsx`, { compression: true });
}
