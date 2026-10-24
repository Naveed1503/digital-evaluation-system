import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScriptViewer } from "@/components/ScriptViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function MarkingWorkspace({ scriptId, mode }: { scriptId: string; mode: "evaluate" | "moderate" }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["marking", scriptId],
    queryFn: async () => {
      const { data: script, error } = await supabase
        .from("scripts")
        .select("*, exams(code,title,status)")
        .eq("id", scriptId)
        .single();
      if (error) throw error;
      const [{ data: questions }, { data: marks }] = await Promise.all([
        supabase.from("questions").select("*").eq("exam_id", script.exam_id).order("number"),
        supabase.from("marks").select("*").eq("script_id", scriptId),
      ]);
      return { script, questions: questions ?? [], marks: marks ?? [] };
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const v: Record<string, string> = {};
    for (const q of data.questions) {
      const m = data.marks.find((x) => x.question_id === q.id);
      const n = mode === "moderate" ? (m?.moderated_marks ?? m?.evaluator_marks) : m?.evaluator_marks;
      v[q.id] = n == null ? "" : String(n);
    }
    setValues(v);
    setRemark(data.marks.find((m) => m.remark)?.remark ?? "");
  }, [data, mode]);

  const total = useMemo(
    () => Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0),
    [values],
  );
  const maxTotal = data?.questions.reduce((s, q) => s + Number(q.max_marks), 0) ?? 0;

  if (isLoading || !data) return <p className="text-muted-foreground">Loading script…</p>;
  const { script, questions, marks } = data;
  const exam = script.exams as { code: string; title: string; status: string } | null;
  const locked =
    exam?.status === "published" ||
    (mode === "evaluate" && script.status === "moderated") ||
    (mode === "moderate" && !["evaluated", "moderated"].includes(script.status));

  async function submit() {
    const payload: Record<string, number> = {};
    for (const q of questions) {
      const raw = values[q.id];
      if (raw === "" || raw == null) return toast.error(`Enter marks for Q${q.number}`);
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > Number(q.max_marks))
        return toast.error(`Q${q.number}: marks must be between 0 and ${q.max_marks}`);
      payload[q.id] = n;
    }
    setBusy(true);
    const { error } =
      mode === "evaluate"
        ? await supabase.rpc("submit_evaluation", { _script_id: scriptId, _marks: payload })
        : await supabase.rpc("submit_moderation", { _script_id: scriptId, _marks: payload, _remark: remark });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "evaluate" ? "Valuation submitted" : "Moderation recorded");
    qc.invalidateQueries();
    navigate({ to: mode === "evaluate" ? "/evaluate" : "/moderate" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={mode === "evaluate" ? "/evaluate" : "/moderate"} className="text-sm text-primary hover:underline">
            ← Back to queue
          </Link>
          <h1 className="mt-1 text-2xl">
            {exam?.code} · <span className="font-mono text-xl">{script.code}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{exam?.title}</p>
        </div>
        <StatusBadge status={script.status} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <ScriptViewer code={script.code} filePath={script.file_path} sampleAnswers={script.sample_answers} />
        <aside className="h-fit rounded-md border border-border bg-card p-5 shadow-card xl:sticky xl:top-6">
          <p className="eyebrow text-gold">{mode === "evaluate" ? "Valuation sheet" : "Moderation sheet"}</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2">Q</th>
                {mode === "moderate" && <th>Evaluator</th>}
                <th>Marks</th>
                <th className="text-right">Max</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const m = marks.find((x) => x.question_id === q.id);
                return (
                  <tr key={q.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">
                      <span className="font-semibold">Q{q.number}</span>
                      {q.label && <span className="block text-xs text-muted-foreground">{q.label}</span>}
                    </td>
                    {mode === "moderate" && <td className="font-mono">{m?.evaluator_marks ?? "—"}</td>}
                    <td className="py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={Number(q.max_marks)}
                        step="0.5"
                        disabled={locked}
                        aria-label={`Marks for question ${q.number}`}
                        value={values[q.id] ?? ""}
                        onChange={(e) => setValues((s) => ({ ...s, [q.id]: e.target.value }))}
                        className="h-8 w-20 font-mono"
                      />
                    </td>
                    <td className="text-right font-mono text-muted-foreground">{q.max_marks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 flex items-baseline justify-between border-t-2 border-primary pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-mono text-2xl">
              {total} <span className="text-sm text-muted-foreground">/ {maxTotal}</span>
            </span>
          </div>
          {mode === "moderate" && (
            <div className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">
                Evaluator total: <span className="font-mono">{script.evaluator_total ?? "—"}</span>
              </p>
              <Textarea
                placeholder="Moderator remarks (optional)"
                value={remark}
                disabled={locked}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
          )}
          {locked ? (
            <p className="mt-4 rounded-sm bg-muted p-3 text-xs text-muted-foreground">
              This script is locked for {mode === "evaluate" ? "valuation" : "moderation"}.
            </p>
          ) : (
            <Button className="mt-5 w-full" onClick={submit} disabled={busy}>
              {mode === "evaluate" ? "Submit valuation" : "Confirm moderation"}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
