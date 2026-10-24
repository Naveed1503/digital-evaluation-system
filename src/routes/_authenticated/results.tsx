import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-auth";
import { finalMark, gradeFor, percentage } from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({ meta: [{ title: "My results — DES" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const { data: me } = useMe();
  const { data = [], isLoading } = useQuery({
    queryKey: ["results", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const { data: owned } = await supabase.from("script_owners").select("script_id").eq("student_id", me!.user.id);
      const ids = (owned ?? []).map((o) => o.script_id);
      if (!ids.length) return [];
      // RLS only returns scripts whose results are published
      const { data: scripts } = await supabase.from("scripts").select("*, exams(*)").in("id", ids);
      const out = [];
      for (const s of scripts ?? []) {
        const [{ data: qs }, { data: ms }] = await Promise.all([
          supabase.from("questions").select("*").eq("exam_id", s.exam_id).order("number"),
          supabase.from("marks").select("*").eq("script_id", s.id),
        ]);
        out.push({ script: s, questions: qs ?? [], marks: ms ?? [] });
      }
      return out;
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Student" title="Statement of marks">
        {data.length > 0 && <Button variant="outline" onClick={() => window.print()}>Print / Save PDF</Button>}
      </PageHeader>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          No results have been declared for you yet.
        </p>
      ) : (
        <div className="space-y-6">
          {data.map(({ script, questions, marks }) => {
            const exam = script.exams as { code: string; title: string; course: string; exam_date: string | null };
            const max = questions.reduce((s, q) => s + Number(q.max_marks), 0);
            const total = Number(script.final_total ?? script.evaluator_total ?? 0);
            const pct = percentage(total, max);
            const g = gradeFor(pct);
            return (
              <article key={script.id} className="max-w-3xl rounded-md border-2 border-primary bg-card p-8 shadow-card">
                <div className="flex items-start justify-between border-b border-border pb-4">
                  <div>
                    <p className="font-mono text-sm text-gold">{exam.code}</p>
                    <h2 className="text-2xl">{exam.title}</h2>
                    <p className="text-sm text-muted-foreground">{exam.course}</p>
                  </div>
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-seal text-primary-foreground">
                    <span className="font-serif text-2xl">{g.grade}</span>
                    <span className="text-[9px] uppercase tracking-wider">{g.label}</span>
                  </div>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="py-2">Question</th><th className="text-right">Max</th><th className="text-right">Secured</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {questions.map((q) => {
                      const m = marks.find((x) => x.question_id === q.id);
                      return (
                        <tr key={q.id} className="border-t border-border">
                          <td className="py-2 font-sans">Q{q.number} {q.label && <span className="text-muted-foreground">· {q.label}</span>}</td>
                          <td className="text-right">{q.max_marks}</td>
                          <td className="text-right">{m ? finalMark(m.evaluator_marks, m.moderated_marks) : "—"}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-primary font-bold">
                      <td className="py-2 font-sans">Total</td><td className="text-right">{max}</td><td className="text-right">{total}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-4 text-sm">Percentage: <span className="font-mono font-semibold">{pct}%</span> · Result: <span className="font-semibold">{g.grade === "F" ? "Not passed" : "Pass"}</span></p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
