import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findRoleColumn, profileColumns, type Row } from "./dataset-profile";
import type { Json } from "@/integrations/supabase/types";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Only the Controller can run analytics.");
}

const pct = (v: number, max: number) => (max > 0 ? Math.round((v / max) * 10000) / 100 : 0);

/** Snapshot of real evaluation records (one row per evaluated script) saved as a dataset. */
export const createLiveDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const [{ data: scripts }, { data: exams }, { data: questions }, { data: marks }, { data: users }] = await Promise.all([
      sb.from("scripts").select("id, code, exam_id, evaluator_id, status, evaluator_total, final_total, evaluated_at").in("status", ["evaluated", "moderated"]),
      sb.from("exams").select("id, code, title, course"),
      sb.from("questions").select("id, exam_id, max_marks"),
      sb.from("marks").select("script_id, question_id, evaluator_marks, moderated_marks, evaluator_remark"),
      sb.rpc("list_users_with_roles"),
    ]);
    const rows: Row[] = (scripts ?? []).map((s) => {
      const ex = exams?.find((e) => e.id === s.exam_id);
      const qs = (questions ?? []).filter((q) => q.exam_id === s.exam_id);
      const max = qs.reduce((t, q) => t + Number(q.max_marks), 0);
      const qp = qs.map((q) => {
        const m = marks?.find((x) => x.script_id === s.id && x.question_id === q.id);
        return pct(Number(m?.evaluator_marks ?? 0), Number(q.max_marks));
      });
      const mean = qp.length ? qp.reduce((a, b) => a + b, 0) / qp.length : 0;
      const sd = qp.length ? Math.sqrt(qp.reduce((a, b) => a + (b - mean) ** 2, 0) / qp.length) : 0;
      const ev = (users ?? []).find((u: { id: string }) => u.id === s.evaluator_id) as { full_name: string; email: string } | undefined;
      const evalTotal = Number(s.evaluator_total ?? 0);
      const finalTotal = Number(s.final_total ?? s.evaluator_total ?? 0);
      return {
        script_id: s.id, script_code: s.code, exam: ex?.code ?? "", subject: ex?.course || ex?.title || "",
        evaluator: ev?.full_name || ev?.email || "Unassigned", date: s.evaluated_at?.slice(0, 10) ?? "",
        evaluator_pct: pct(evalTotal, max), final_pct: pct(finalTotal, max), moderation_delta: Math.round((finalTotal - evalTotal) * 100) / 100,
        question_mean_pct: Math.round(mean * 100) / 100, question_std_pct: Math.round(sd * 100) / 100,
        min_question_pct: qp.length ? Math.min(...qp) : 0, max_question_pct: qp.length ? Math.max(...qp) : 0,
        remarks_written: (marks ?? []).filter((m) => m.script_id === s.id && m.evaluator_remark).length,
      };
    });
    if (rows.length < 10) return { ok: false as const, error: `Live data has only ${rows.length} evaluated scripts; at least 10 are needed.` };
    const profile = profileColumns(rows);
    const { data, error } = await sb.from("ml_datasets").insert({
      name: `Live evaluation records · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      source: "live", row_count: rows.length, column_count: profile.length,
      profile: profile as unknown as Json, rows: rows as unknown as Json, created_by: context.userId,
    }).select("id").single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: data.id, rows: rows.length };
  });

/** Sends the chosen dataset to the Python Isolation Forest service and stores its real output. */
export const runAnomalyDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    datasetId: z.string().uuid(),
    nEstimators: z.number().int().min(10).max(1000),
    contamination: z.number().gt(0).max(0.5),
    features: z.array(z.string()).min(1),
    labelColumn: z.string().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const url = process.env["ML_SERVICE_URL"];
    const key = process.env["ML_SERVICE_KEY"];
    if (!url || !key) return { ok: false as const, error: "The Python ML service is not connected yet. Add its address and key in settings." };
    const { data: ds, error } = await context.supabase.from("ml_datasets").select("*").eq("id", data.datasetId).single();
    if (error || !ds) return { ok: false as const, error: "Dataset not found." };
    const rows = ds.rows as Row[];
    let res: Response;
    try {
      res = await fetch(`${url.replace(/\/+$/, "")}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-ML-Key": key },
        body: JSON.stringify({ rows, features: data.features, n_estimators: data.nEstimators, contamination: data.contamination, label_column: data.labelColumn }),
      });
    } catch (e) {
      console.error("ML service unreachable", e);
      return { ok: false as const, error: "Could not reach the Python ML service. It may be starting up — try again in a minute." };
    }
    if (!res.ok) {
      const body = await res.text();
      console.error("ML service error", res.status, body);
      return { ok: false as const, error: res.status === 401 ? "The ML service rejected the key. Check that both keys match." : `ML service error (${res.status}).` };
    }
    const out = (await res.json()) as { results: { index: number; score: number; is_anomaly: boolean }[]; metrics: Record<string, unknown> };
    const anomalies = out.results.filter((r) => r.is_anomaly).length;
    const { data: run, error: runErr } = await context.supabase.from("ml_runs").insert({
      dataset_id: ds.id, n_estimators: data.nEstimators, contamination: data.contamination, features: data.features,
      label_column: data.labelColumn, record_count: out.results.length, anomaly_count: anomalies,
      metrics: out.metrics as Json, created_by: context.userId,
    }).select("id").single();
    if (runErr) return { ok: false as const, error: runErr.message };
    const cols = (ds.profile as { name: string }[]).map((c) => c.name);
    const colOf = { exam: findRoleColumn(cols, "exam"), subject: findRoleColumn(cols, "subject"), evaluator: findRoleColumn(cols, "evaluator"), date: findRoleColumn(cols, "date") };
    const str = (r: Row, c?: string) => (c && r[c] != null && r[c] !== "" ? String(r[c]) : null);
    const items = out.results.map((r) => {
      const rec = rows[r.index] ?? {};
      const d = str(rec, colOf.date);
      return {
        run_id: run.id, row_index: r.index, record: rec as Json, score: r.score, is_anomaly: r.is_anomaly,
        script_id: typeof rec["script_id"] === "string" ? (rec["script_id"] as string) : null,
        exam: str(rec, colOf.exam), subject: str(rec, colOf.subject), evaluator: str(rec, colOf.evaluator),
        record_date: d && !Number.isNaN(Date.parse(d)) ? d.slice(0, 10) : null,
      };
    });
    for (let i = 0; i < items.length; i += 1000) {
      const { error: e } = await context.supabase.from("ml_results").insert(items.slice(i, i + 1000));
      if (e) return { ok: false as const, error: e.message };
    }
    await context.supabase.from("audit_log").insert({ actor_id: context.userId, action: "ml_run", details: `Isolation Forest on ${ds.name}: ${anomalies}/${out.results.length} flagged` }).then(() => null, () => null);
    return { ok: true as const, runId: run.id, anomalies, records: out.results.length };
  });
