import { useQuery, useQueryClient } from "@tanstack/react-query";
import { questionLabel } from "@/lib/question-label";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { ScriptViewer } from "@/components/ScriptViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { getAiSuggestedMarks } from "@/lib/ai-mark.functions";

type Rec = Record<string, string>;

export function MarkingWorkspace({ scriptId, mode }: { scriptId: string; mode: "evaluate" | "moderate" }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
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
        supabase.from("questions").select("*").eq("exam_id", script.exam_id).order("number").order("part"),
        supabase.from("marks").select("*").eq("script_id", scriptId),
      ]);
      return { script, questions: questions ?? [], marks: marks ?? [] };
    },
  });

  const [values, setValues] = useState<Rec>({});
  const [notes, setNotes] = useState<Rec>({}); // evaluator remarks or moderator reasons
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<Record<string, { marks: number; reason: string }>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const suggestFn = useServerFn(getAiSuggestedMarks);

  async function askAi() {
    setAiBusy(true);
    try {
      const res = await suggestFn({ data: { scriptId } });
      if (!res.ok) { toast.error(res.error); return; }
      setAi(Object.fromEntries(res.suggestions.map((x) => [x.questionId, { marks: x.marks, reason: x.reason }])));
      toast.success("AI suggestions ready — review before using");
    } catch { toast.error("AI suggestion failed. Please mark manually."); }
    finally { setAiBusy(false); }
  }
  function useAll() {
    setValues((v) => { const n = { ...v }; for (const [k, x] of Object.entries(ai)) n[k] = String(x.marks); return n; });
  }

  useEffect(() => {
    if (!data) return;
    const v: Rec = {};
    const n: Rec = {};
    for (const q of data.questions) {
      const m = data.marks.find((x) => x.question_id === q.id);
      const num = mode === "moderate" ? (m?.moderated_marks ?? m?.evaluator_marks) : m?.evaluator_marks;
      v[q.id] = num == null ? "" : String(num);
      n[q.id] = (mode === "evaluate" ? m?.evaluator_remark : "") ?? "";
    }
    setValues(v);
    setNotes(n);
    setRemark(data.marks.find((m) => m.remark)?.remark ?? "");
  }, [data, mode]);

  const total = useMemo(() => Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0), [values]);

  if (isLoading || !data) return <p className="text-muted-foreground">Loading script…</p>;
  const { script, questions, marks } = data;
  const maxTotal = questions.reduce((s, q) => s + Number(q.max_marks), 0);
  const exam = script.exams as { code: string; title: string; status: string } | null;
  const notMine =
    !!me && (mode === "evaluate" ? script.evaluator_id !== me.user.id : script.moderator_id !== me.user.id);
  const locked =
    notMine ||
    exam?.status === "published" ||
    (mode === "evaluate" && script.status !== "assigned") ||
    (mode === "moderate" && !["evaluated", "moderated"].includes(script.status));

  const prevFor = (qid: string) => {
    const m = marks.find((x) => x.question_id === qid);
    return m?.moderated_marks ?? m?.evaluator_marks ?? null;
  };
  const changed = (qid: string) => mode === "moderate" && values[qid] !== "" && Number(values[qid]) !== Number(prevFor(qid));
  const answered = questions.filter((q) => values[q.id] !== "" && values[q.id] != null).length;

  function validate(requireAll: boolean): Record<string, number | string> | null {
    const out: Record<string, number | string> = {};
    for (const q of questions) {
      const raw = values[q.id] ?? "";
      if (raw === "") {
        if (requireAll) { toast.error(`Enter marks for Q${q.number}`); return null; }
        out[q.id] = "";
        continue;
      }
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > Number(q.max_marks)) {
        toast.error(`${questionLabel(q)}: marks must be between 0 and ${q.max_marks}`);
        return null;
      }
      if (mode === "moderate" && changed(q.id) && !notes[q.id]?.trim()) {
        toast.error(`Give a reason for changing Q${q.number}`);
        return null;
      }
      out[q.id] = n;
    }
    return out;
  }

  async function saveDraft() {
    const payload = validate(false);
    if (!payload) return;
    setBusy(true);
    const { error } = await supabase.rpc("save_evaluation_draft", { _script_id: scriptId, _marks: payload, _remarks: notes });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Draft saved");
    qc.invalidateQueries({ queryKey: ["marking", scriptId] });
  }

  async function submit() {
    const payload = validate(true);
    if (!payload) return;
    if (!confirm(mode === "evaluate" ? "Submit valuation? You can't edit it afterwards." : "Confirm moderation?")) return;
    setBusy(true);
    const reasons: Rec = {};
    for (const q of questions) if (changed(q.id)) reasons[q.id] = notes[q.id] ?? "";
    const { error } =
      mode === "evaluate"
        ? await supabase.rpc("submit_evaluation", { _script_id: scriptId, _marks: payload, _remarks: notes })
        : await supabase.rpc("submit_moderation", { _script_id: scriptId, _marks: payload, _remark: remark, _reasons: reasons });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(mode === "evaluate" ? "Valuation submitted" : "Moderation recorded");
    qc.invalidateQueries();
    navigate({ to: mode === "evaluate" ? "/evaluate" : "/moderate" });
  }

  return (
    <div>
      <div className="mb-5 grid min-w-0 gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <Link to={mode === "evaluate" ? "/evaluate" : "/moderate"} className="text-sm text-primary hover:underline">
            ← Back to queue
          </Link>
          <h1 className="mt-1 break-words text-xl sm:text-2xl">
            {exam?.code} · <span className="font-mono text-xl">{script.code}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{exam?.title}</p>
        </div>
        <StatusBadge status={script.status} />
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <ScriptViewer code={script.code} filePath={script.file_path} sampleAnswers={script.sample_answers} />
        <aside className="h-fit rounded-md border border-border bg-card p-3 shadow-card sm:p-5 xl:sticky xl:top-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-gold">{mode === "evaluate" ? "Valuation sheet" : "Moderation sheet"}</p>
            <span className="text-xs text-muted-foreground">{answered}/{questions.length} marked</span>
          </div>
          {!locked && (script.sample_answers as unknown[] | null)?.length ? (
            <div className="mt-3 rounded-sm border border-gold/50 bg-gold/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-gold" /> AI marking assistant</p>
                <div className="flex gap-2">
                  {Object.keys(ai).length > 0 && <Button size="sm" variant="ghost" onClick={useAll}>Use all</Button>}
                  <Button size="sm" variant="outline" onClick={askAi} disabled={aiBusy}>{aiBusy ? "Analysing…" : "Suggest marks"}</Button>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Compares each answer with the model answer. Suggestions only — you decide the final mark.</p>
            </div>
          ) : null}
          <div className="mt-3 space-y-3">
            {questions.map((q) => {
              const m = marks.find((x) => x.question_id === q.id);
              const isChanged = changed(q.id);
              return (
                <div key={q.id} className={`rounded-sm border p-3 ${isChanged ? "border-gold bg-gold/10" : "border-border"}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm font-semibold">{questionLabel(q)}</p>
                      {q.label && <p className="text-xs text-muted-foreground">{q.label}</p>}
                    </div>
                    {mode === "moderate" && (
                      <span className="text-xs text-muted-foreground">Eval: <span className="font-mono">{m?.evaluator_marks ?? "—"}</span></span>
                    )}
                    <Input
                      type="number" min={0} max={Number(q.max_marks)} step="0.5" disabled={locked}
                      aria-label={`Marks for question ${q.number}`}
                      value={values[q.id] ?? ""}
                      onChange={(e) => setValues((s) => ({ ...s, [q.id]: e.target.value }))}
                      className="h-11 w-20 font-mono text-base"
                    />
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">/{q.max_marks}</span>
                  </div>
                  {ai[q.id] && !locked && (
                    <div className="mt-2 flex items-start justify-between gap-2 rounded-sm bg-muted p-2 text-xs">
                      <span><span className="font-semibold text-gold">AI: {ai[q.id]!.marks}/{q.max_marks}</span> · {ai[q.id]!.reason}</span>
                      <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => setValues((s) => ({ ...s, [q.id]: String(ai[q.id]!.marks) }))}>Use</button>
                    </div>
                  )}
                  {mode === "moderate" && m?.evaluator_remark && (
                    <p className="mt-2 text-xs italic text-muted-foreground">Evaluator: “{m.evaluator_remark}”</p>
                  )}
                  {mode === "moderate" && m?.moderation_reason && !isChanged && (
                    <p className="mt-1 text-xs text-muted-foreground">Earlier change: {m.moderation_reason}</p>
                  )}
                  {(mode === "evaluate" || isChanged) && !locked && (
                    <Input
                      className="mt-2 h-11 text-base sm:text-sm"
                      placeholder={mode === "evaluate" ? "Remark (optional)" : "Reason for change (required)"}
                      value={notes[q.id] ?? ""}
                      onChange={(e) => setNotes((s) => ({ ...s, [q.id]: e.target.value }))}
                    />
                  )}
                  {mode === "evaluate" && locked && m?.evaluator_remark && (
                    <p className="mt-2 text-xs italic text-muted-foreground">“{m.evaluator_remark}”</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t-2 border-primary pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-mono text-2xl">{total} <span className="text-sm text-muted-foreground">/ {maxTotal}</span></span>
          </div>
          {mode === "moderate" && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Evaluator total: <span className="font-mono">{script.evaluator_total ?? "—"}</span></p>
              <Textarea placeholder="Overall moderator remarks (optional)" value={remark} disabled={locked} onChange={(e) => setRemark(e.target.value)} />
            </div>
          )}
          {locked ? (
            <p className="mt-4 rounded-sm bg-muted p-3 text-xs text-muted-foreground">
              {notMine
                ? `This script is assigned to another ${mode === "evaluate" ? "evaluator" : "moderator"}. You can view it, but only the assigned person can submit.`
                : `This script is locked for ${mode === "evaluate" ? "valuation" : "moderation"}.`}
            </p>
          ) : (
            <div className="mt-5 grid gap-2 sm:flex">
              {mode === "evaluate" && (
                <Button variant="outline" className="flex-1" onClick={saveDraft} disabled={busy}>Save draft</Button>
              )}
              <Button className="flex-1" onClick={submit} disabled={busy}>
                {mode === "evaluate" ? "Submit valuation" : "Confirm moderation"}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
