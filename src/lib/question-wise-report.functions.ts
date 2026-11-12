import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAllPages } from "./pagination";
import type { QuestionWiseReport, ReportScope } from "./question-wise-report";

const inputSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("exam"), examId: z.string().uuid() }),
  z.object({ scope: z.literal("evaluator"), examId: z.string().uuid().optional() }),
  z.object({ scope: z.literal("moderator"), examId: z.string().uuid().optional() }),
]);

async function inIdChunks<T>(ids: string[], fetchChunk: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100) rows.push(...(await fetchChunk(ids.slice(i, i + 100))));
  return rows;
}

export const getQuestionWiseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<QuestionWiseReport> => {
    const scope: ReportScope = data.scope;
    const requiredRole = scope === "exam" ? "admin" : scope;
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: requiredRole,
    });
    if (roleError) throw new Error(roleError.message);
    if (!allowed) throw new Error("You do not have permission to export this report.");

    const sb = context.supabase;
    const scripts = await fetchAllPages((from, to) => {
      let query = sb.from("scripts").select(
        "id, exam_id, code, status, evaluator_id, moderator_id, evaluator_total, final_total, evaluated_at, moderated_at",
      );
      if (data.scope === "exam") query = query.eq("exam_id", data.examId);
      if (data.scope === "evaluator") query = query.eq("evaluator_id", context.userId);
      if (data.scope === "moderator") query = query.eq("moderator_id", context.userId);
      if (data.scope !== "exam" && data.examId) query = query.eq("exam_id", data.examId);
      return query.order("exam_id").order("id").range(from, to);
    });

    const empty: QuestionWiseReport = { scope, generatedAt: new Date().toISOString(), exams: [], questions: [], scripts: [], marks: [], owners: [], people: [] };
    if (!scripts.length) return empty;

    const examIds = [...new Set(scripts.map((s) => s.exam_id))];
    const scriptIds = scripts.map((s) => s.id);
    const [exams, questions, marks] = await Promise.all([
      inIdChunks(examIds, (ids) => fetchAllPages((from, to) =>
        sb.from("exams").select("id, code, title, course, exam_date, status").in("id", ids).order("id").range(from, to),
      )),
      inIdChunks(examIds, (ids) => fetchAllPages((from, to) =>
        sb.from("questions").select("id, exam_id, number, label, max_marks").in("exam_id", ids).order("exam_id").order("number").range(from, to),
      )),
      inIdChunks(scriptIds, (ids) => fetchAllPages((from, to) =>
        sb.from("marks").select("script_id, question_id, evaluator_marks, moderated_marks, evaluator_remark, moderation_reason")
          .in("script_id", ids).order("script_id").order("question_id").range(from, to),
      )),
    ]);

    let owners: Awaited<ReturnType<typeof fetchAllPages<{ script_id: string; student_id: string }>>> = [];
    let people: Array<{ id: string; full_name: string; email: string; roll_number: string | null }> = [];
    if (scope === "exam") {
      owners = await inIdChunks(scriptIds, (ids) => fetchAllPages((from, to) =>
        sb.from("script_owners").select("script_id, student_id").in("script_id", ids).order("script_id").range(from, to),
      ));
      const peopleIds = [...new Set([
        ...owners.map((o) => o.student_id),
        ...scripts.flatMap((s) => [s.evaluator_id, s.moderator_id]).filter((id): id is string => !!id),
      ])];
      people = await inIdChunks(peopleIds, (ids) => fetchAllPages((from, to) =>
        sb.from("profiles").select("id, full_name, email, roll_number").in("id", ids).order("id").range(from, to),
      ));
    }

    return {
      scope,
      generatedAt: new Date().toISOString(),
      exams: exams.map((e) => ({ id: e.id, code: e.code, title: e.title, course: e.course, examDate: e.exam_date, status: e.status })),
      questions: questions.map((q) => ({ id: q.id, examId: q.exam_id, number: q.number, label: q.label, maxMarks: Number(q.max_marks) })),
      scripts: scripts.map((s) => ({
        id: s.id, examId: s.exam_id, code: s.code, status: s.status,
        evaluatorId: s.evaluator_id, moderatorId: s.moderator_id,
        evaluatorTotal: s.evaluator_total == null ? null : Number(s.evaluator_total),
        finalTotal: s.final_total == null ? null : Number(s.final_total),
        evaluatedAt: s.evaluated_at, moderatedAt: s.moderated_at,
      })),
      marks: marks.map((m) => ({
        scriptId: m.script_id, questionId: m.question_id,
        evaluatorMarks: m.evaluator_marks == null ? null : Number(m.evaluator_marks),
        moderatedMarks: m.moderated_marks == null ? null : Number(m.moderated_marks),
        evaluatorRemark: m.evaluator_remark, moderationReason: m.moderation_reason,
      })),
      owners: owners.map((o) => ({ scriptId: o.script_id, studentId: o.student_id })),
      people: people.map((p) => ({ id: p.id, fullName: p.full_name, email: p.email, rollNumber: p.roll_number })),
    };
  });
