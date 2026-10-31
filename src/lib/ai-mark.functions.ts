import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { suggestMarks } from "./ai-mark.server";

export const getAiSuggestedMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scriptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: only the assigned evaluator/moderator or an admin can read the script.
    const { data: script, error } = await context.supabase
      .from("scripts").select("id, exam_id, sample_answers").eq("id", data.scriptId).maybeSingle();
    if (error || !script) return { ok: false as const, error: "Script not found or not assigned to you." };
    const answers = (Array.isArray(script.sample_answers) ? script.sample_answers : []) as { q: number; text: string }[];
    if (!answers.length) return { ok: false as const, error: "AI suggestions need typed answers. Scanned scripts must be marked manually." };
    const { data: qs } = await context.supabase
      .from("questions").select("id, number, label, max_marks, model_answer").eq("exam_id", script.exam_id).order("number");
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "AI service is not configured." };
    try {
      const out = await suggestMarks(key, (qs ?? []).map((q) => ({
        number: q.number, label: q.label, max: Number(q.max_marks), modelAnswer: q.model_answer ?? "",
        answer: answers.find((a) => a.q === q.number)?.text ?? "",
      })));
      return { ok: true as const, suggestions: out.map((s) => ({ ...s, questionId: qs!.find((q) => q.number === s.number)!.id })) };
    } catch (e) {
      console.error("AI suggest failed", e);
      const status = (e as { statusCode?: number }).statusCode;
      return { ok: false as const, error: status === 402 ? "AI credits are used up. Add credits in workspace settings." : status === 429 ? "AI is busy — try again in a minute." : "AI suggestion failed. Please mark manually." };
    }
  });
