import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";
import { detectUnusualMarking, groupStudents } from "@/lib/ml";
import { percentage } from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/admin/insights")({
  head: () => ({ meta: [
    { title: "ML insights — Digital Evaluation System" },
    { name: "description", content: "Machine-learning alerts for unusual marking and K-Means grouping of student performance." },
    { property: "og:title", content: "ML insights — Digital Evaluation System" },
    { property: "og:description", content: "Machine-learning alerts for unusual marking and K-Means grouping of student performance." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InsightsPage,
});

const GROUP_STYLE: Record<string, string> = {
  Strong: "bg-primary text-primary-foreground",
  Average: "bg-gold/20 text-foreground",
  "Needs support": "bg-destructive/15 text-destructive",
};

function InsightsPage() {
  const { data } = useQuery({
    queryKey: ["ml-insights"],
    queryFn: async () => {
      const [exams, scripts, questions, marks, users] = await Promise.all([
        supabase.from("exams").select("id, code, title").order("created_at", { ascending: false }),
        supabase.from("scripts").select("id, code, exam_id, evaluator_id, status"),
        supabase.from("questions").select("id, exam_id, number, max_marks").order("number"),
        supabase.from("marks").select("script_id, question_id, evaluator_marks, moderated_marks"),
        supabase.rpc("list_users_with_roles"),
      ]);
      return {
        exams: exams.data ?? [], scripts: scripts.data ?? [], questions: questions.data ?? [],
        marks: marks.data ?? [], users: (users.data ?? []) as { id: string; full_name: string | null; email: string }[],
      };
    },
  });
  const [examId, setExamId] = useState<string>("");
  const exam = data?.exams.find((e) => e.id === examId) ?? data?.exams[0];

  const analysis = useMemo(() => {
    if (!data || !exam) return null;
    const qs = data.questions.filter((q) => q.exam_id === exam.id);
    const max = qs.reduce((s, q) => s + Number(q.max_marks), 0);
    const done = data.scripts.filter((s) => s.exam_id === exam.id && ["evaluated", "moderated", "published"].includes(s.status));
    const rows = done.map((s) => {
      const ms = data.marks.filter((m) => m.script_id === s.id);
      const evalTotal = ms.reduce((t, m) => t + Number(m.evaluator_marks ?? 0), 0);
      const vec = qs.map((q) => {
        const m = ms.find((x) => x.question_id === q.id);
        const v = Number(m?.moderated_marks ?? m?.evaluator_marks ?? 0);
        return percentage(v, Number(q.max_marks));
      });
      return { s, evalPct: percentage(evalTotal, max), vec };
    });
    const anomaly = detectUnusualMarking(rows.map((r) => ({ id: r.s.id, evaluatorId: r.s.evaluator_id, pct: r.evalPct })));
    const groups = groupStudents(rows.map((r) => r.vec));
    return { qs, rows, anomaly, groups };
  }, [data, exam]);

  const nameOf = (id: string) => {
    const u = data?.users.find((x) => x.id === id);
    return u?.full_name || u?.email || "Unknown";
  };
  const codeOf = (id: string) => data?.scripts.find((s) => s.id === id)?.code ?? id;

  return (
    <div>
      <PageHeader eyebrow="Machine learning" title="Evaluation insights">
        {data && data.exams.length > 0 && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={exam?.id ?? ""}
            onChange={(e) => setExamId(e.target.value)}
            aria-label="Examination"
          >
            {data.exams.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.title}</option>)}
          </select>
        )}
      </PageHeader>

      {!data ? <p className="text-muted-foreground">Loading…</p> : !analysis ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">Create an examination first.</p>
      ) : analysis.rows.length < 3 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          At least 3 evaluated scripts are needed for analysis ({analysis.rows.length} so far).
        </p>
      ) : (
        <div className="grid min-w-0 gap-6">
          <section className="rounded-md border border-border bg-card p-4 shadow-card sm:p-6">
            <p className="eyebrow text-gold">Algorithm 1 · Z-score anomaly detection</p>
            <h2 className="mt-1 text-xl">Unusual marking alerts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each script's evaluator percentage is compared with the exam average: z = (score − mean) ÷ standard deviation.
              Scripts with |z| ≥ 2 are flagged for moderation; evaluators averaging z ≥ +0.75 are marked lenient, ≤ −0.75 strict.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto rounded-sm border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">Evaluator</th><th>Scripts</th><th>Avg %</th><th>Bias (z)</th><th>Pattern</th></tr>
                  </thead>
                  <tbody>
                    {analysis.anomaly.evaluators.map((e) => (
                      <tr key={e.evaluatorId} className="border-t border-border">
                        <td className="px-3 py-2">{nameOf(e.evaluatorId)}</td>
                        <td className="font-mono">{e.scripts}</td>
                        <td className="font-mono">{e.meanPct.toFixed(1)}</td>
                        <td className="font-mono">{e.bias.toFixed(2)}</td>
                        <td><span className={`rounded-full px-2 py-0.5 text-xs ${e.label === "Normal" ? "bg-muted" : "bg-gold/25 font-semibold"}`}>{e.label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-sm border border-border p-3">
                <p className="text-sm font-semibold">Flagged scripts ({analysis.anomaly.flags.length})</p>
                {analysis.anomaly.flags.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No outliers — marking looks consistent.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {analysis.anomaly.flags.map((f) => (
                      <li key={f.id} className="flex justify-between gap-2">
                        <span className="font-mono">{codeOf(f.id)}</span>
                        <span className="text-muted-foreground">{f.kind === "high" ? "Unusually high" : "Unusually low"} · z {f.z.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-4 shadow-card sm:p-6">
            <p className="eyebrow text-gold">Algorithm 2 · K-Means clustering (k = 3)</p>
            <h2 className="mt-1 text-xl">Student performance groups</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each script becomes a vector of question-wise percentages. K-Means groups similar vectors and the groups are
              named by their centre's average. Student identity stays hidden; only anonymous codes are shown.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {analysis.groups.centroids.map((c) => {
                const count = analysis.groups.group.filter((g) => g === c.name).length;
                return (
                  <div key={c.name} className="rounded-sm border border-border p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${GROUP_STYLE[c.name]}`}>{c.name}</span>
                    <p className="mt-2 font-mono text-2xl">{count}</p>
                    <p className="text-xs text-muted-foreground">scripts · centre avg {c.avg}%</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 overflow-x-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Script</th>{analysis.qs.map((q) => <th key={q.id}>Q{q.number} %</th>)}<th>Group</th></tr>
                </thead>
                <tbody>
                  {analysis.rows.map((r, i) => (
                    <tr key={r.s.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{r.s.code}</td>
                      {r.vec.map((v, j) => <td key={j} className="font-mono">{v}</td>)}
                      <td><span className={`rounded-full px-2 py-0.5 text-xs ${GROUP_STYLE[analysis.groups.group[i] ?? ""]}`}>{analysis.groups.group[i]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
