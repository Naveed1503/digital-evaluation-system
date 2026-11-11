import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildQuestionWiseWorkbook } from "./question-wise-excel";
import type { QuestionWiseReport, ReportScope } from "./question-wise-report";

function report(scope: ReportScope): QuestionWiseReport {
  return {
    scope,
    generatedAt: "2026-11-11T11:00:00.000Z",
    exams: [{ id: "exam-1", code: "CS301", title: "Data Structures", course: "B.Tech CSE", examDate: "2026-11-01", status: "evaluating" }],
    questions: [
      { id: "q1", examId: "exam-1", number: 1, label: "Stacks", maxMarks: 10 },
      { id: "q2", examId: "exam-1", number: 2, label: "Queues", maxMarks: 10 },
    ],
    scripts: [{ id: "script-1", examId: "exam-1", code: "SCRIPT-001", status: "moderated", evaluatorId: "eval-1", moderatorId: "mod-1", evaluatorTotal: 13, finalTotal: 14, evaluatedAt: null, moderatedAt: null }],
    marks: [
      { scriptId: "script-1", questionId: "q1", evaluatorMarks: 7, moderatedMarks: 8, evaluatorRemark: "Good", moderationReason: "Step marks added" },
      { scriptId: "script-1", questionId: "q2", evaluatorMarks: 6, moderatedMarks: null, evaluatorRemark: "", moderationReason: null },
    ],
    owners: scope === "exam" ? [{ scriptId: "script-1", studentId: "student-1" }] : [],
    people: scope === "exam" ? [
      { id: "student-1", fullName: "Test Student", email: "student@example.com", rollNumber: "R23CS001" },
      { id: "eval-1", fullName: "Evaluator One", email: "eval@example.com", rollNumber: null },
      { id: "mod-1", fullName: "Moderator One", email: "mod@example.com", rollNumber: null },
    ] : [],
  };
}

function rows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet ${sheetName}`);
  return XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "" });
}

describe("question-wise Excel reports", () => {
  it("gives the Controller final question marks, identity and the correct grade", () => {
    const sheetRows = rows(buildQuestionWiseWorkbook(report("exam")), "CS301 Marks");
    expect(sheetRows[0]).toMatchObject({
      "Roll Number": "R23CS001",
      "Candidate Name": "Test Student",
      "Q1 Secured (/ 10)": 8,
      "Q2 Secured (/ 10)": 6,
      "Evaluator Total": 13,
      "Final Total": 14,
      "Percentage": 70,
      "Grade": "A",
    });
  });

  it("gives the Moderator question-level changes and reasons without candidate identity", () => {
    const workbook = buildQuestionWiseWorkbook(report("moderator"));
    const main = rows(workbook, "CS301 Marks")[0]!;
    const detail = rows(workbook, "CS301 Q Detail")[0]!;
    expect(main["Candidate Name"]).toBeUndefined();
    expect(main["Q1 Secured (/ 10)"]).toBe(8);
    expect(detail).toMatchObject({
      "Evaluator Marks": 7,
      "Moderated Marks": 8,
      "Final Marks": 8,
      "Moderation Difference": 1,
      "Moderation Reason": "Step marks added",
    });
  });

  it("gives the Evaluator only their question marks and remarks", () => {
    const workbook = buildQuestionWiseWorkbook(report("evaluator"));
    const main = rows(workbook, "CS301 Marks")[0]!;
    const detail = rows(workbook, "CS301 Q Detail")[0]!;
    expect(main["Candidate Name"]).toBeUndefined();
    expect(main["Final Total"]).toBeUndefined();
    expect(main["Q1 Secured (/ 10)"]).toBe(7);
    expect(main["Q2 Secured (/ 10)"]).toBe(6);
    expect(detail["Evaluator Remark"]).toBe("Good");
    expect(detail["Moderated Marks"]).toBeUndefined();
  });
});
