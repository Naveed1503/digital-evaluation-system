export type ReportScope = "exam" | "evaluator" | "moderator";

export type QuestionWiseReport = {
  scope: ReportScope;
  generatedAt: string;
  exams: Array<{ id: string; code: string; title: string; course: string; examDate: string | null; status: string }>;
  questions: Array<{ id: string; examId: string; number: number; label: string; maxMarks: number }>;
  scripts: Array<{
    id: string;
    examId: string;
    code: string;
    status: string;
    evaluatorId: string | null;
    moderatorId: string | null;
    evaluatorTotal: number | null;
    finalTotal: number | null;
    evaluatedAt: string | null;
    moderatedAt: string | null;
  }>;
  marks: Array<{
    scriptId: string;
    questionId: string;
    evaluatorMarks: number | null;
    moderatedMarks: number | null;
    evaluatorRemark: string | null;
    moderationReason: string | null;
  }>;
  owners: Array<{ scriptId: string; studentId: string }>;
  people: Array<{ id: string; fullName: string; email: string; rollNumber: string | null }>;
};
