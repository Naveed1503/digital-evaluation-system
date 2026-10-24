import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { finalMark, generateScriptCode, gradeFor, percentage } from "@/lib/grading";
import { makeSampleAnswers } from "@/lib/sample-answers";

export const Route = createFileRoute("/_authenticated/admin/exams/$examId")({
  head: () => ({ meta: [{ title: "Examination detail — DES" }] }),
  component: ExamDetail,
});

function useExam(examId: string) {
  return useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const [exam, questions, scripts, owners, users, marks] = await Promise.all([
        supabase.from("exams").select("*").eq("id", examId).single(),
        supabase.from("questions").select("*").eq("exam_id", examId).order("number"),
        supabase.from("scripts").select("*").eq("exam_id", examId).order("code"),
        supabase.from("script_owners").select("script_id, student_id, scripts!inner(exam_id)").eq("scripts.exam_id", examId),
        supabase.rpc("list_users_with_roles"),
        supabase.from("marks").select("*, scripts!inner(exam_id)").eq("scripts.exam_id", examId),
      ]);
      if (exam.error) throw exam.error;
      return {
        exam: exam.data,
        questions: questions.data ?? [],
        scripts: scripts.data ?? [],
        owners: owners.data ?? [],
        users: users.data ?? [],
        marks: marks.data ?? [],
      };
    },
  });
}

function ExamDetail() {
  const { examId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useExam(examId);
  const refresh = () => qc.invalidateQueries({ queryKey: ["exam", examId] });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  const { exam, questions, scripts, owners, users, marks } = data;
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.full_name || users.find((u) => u.id === id)?.email || "—";
  const ownerOf = (sid: string) => owners.find((o) => o.script_id === sid)?.student_id ?? null;
  const maxTotal = questions.reduce((s, q) => s + Number(q.max_marks), 0);
  const counts = {
    total: scripts.length,
    unassigned: scripts.filter((s) => s.status === "unassigned").length,
    evaluated: scripts.filter((s) => ["evaluated", "moderated"].includes(s.status)).length,
    moderated: scripts.filter((s) => s.status === "moderated").length,
  };
  const published = exam.status === "published";

  async function autoAssign() {
    const { data: n, error } = await supabase.rpc("auto_assign", { _exam_id: examId });
    if (error) return toast.error(error.message);
    toast.success(`${n} scripts allocated`);
    refresh();
  }
  async function publish() {
    if (!confirm("Publish results? Marks will be locked and visible to students.")) return;
    const { error } = await supabase.rpc("publish_results", { _exam_id: examId });
    if (error) return toast.error(error.message);
    toast.success("Results published");
    refresh();
  }

  return (
    <div>
      <Link to="/admin/exams" className="text-sm text-primary hover:underline">← All examinations</Link>
      <PageHeader eyebrow={`${exam.code} · ${exam.course}`} title={exam.title}>
        <StatusBadge status={exam.status} />
        {!published && (
          <>
            <Button variant="outline" onClick={autoAssign} disabled={!counts.unassigned || !questions.length}>
              Auto-assign ({counts.unassigned})
            </Button>
            <Button onClick={publish} disabled={!counts.total || counts.moderated !== counts.total}>
              Publish results
            </Button>
          </>
        )}
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Scripts", counts.total],
          ["Unassigned", counts.unassigned],
          ["Evaluated", counts.evaluated],
          ["Moderated", counts.moderated],
        ].map(([l, v]) => (
          <div key={l} className="rounded-md border border-border bg-card p-4 shadow-card">
            <p className="eyebrow text-muted-foreground">{l}</p>
            <p className="mt-1 font-mono text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Question paper</TabsTrigger>
          <TabsTrigger value="scripts">Answer scripts</TabsTrigger>
          <TabsTrigger value="tabulation">Tabulation</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-6">
          <QuestionsPanel examId={examId} questions={questions} editable={exam.status === "draft"} onChange={refresh} maxTotal={maxTotal} />
        </TabsContent>

        <TabsContent value="scripts" className="mt-6">
          {!published && (
            <ScriptIntake examId={examId} questions={questions} students={users.filter((u) => u.roles.includes("student"))} onDone={refresh} />
          )}
          <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Code</th><th>Candidate</th><th>Source</th><th>Evaluator</th><th>Moderator</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-mono">{s.code}</td>
                    <td>{nameOf(ownerOf(s.id))}</td>
                    <td className="text-muted-foreground">{s.file_path ? "Scanned file" : "Sample"}</td>
                    <td>{nameOf(s.evaluator_id)}</td>
                    <td>{nameOf(s.moderator_id)}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
                {!scripts.length && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No scripts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="tabulation" className="mt-6">
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Code</th><th>Candidate</th>
                  {questions.map((q) => <th key={q.id} className="text-center">Q{q.number}</th>)}
                  <th className="text-right">Eval.</th><th className="text-right">Final</th><th className="text-right">%</th><th className="pr-4 text-right">Grade</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((s) => {
                  const fin = s.final_total ?? s.evaluator_total;
                  const pct = fin == null ? null : percentage(Number(fin), maxTotal);
                  return (
                    <tr key={s.id} className="border-t border-border font-mono">
                      <td className="px-4 py-2">{s.code}</td>
                      <td className="font-sans">{nameOf(ownerOf(s.id))}</td>
                      {questions.map((q) => {
                        const m = marks.find((x) => x.script_id === s.id && x.question_id === q.id);
                        const f = m ? finalMark(m.evaluator_marks, m.moderated_marks) : null;
                        const changed = m?.moderated_marks != null && m.moderated_marks !== m.evaluator_marks;
                        return (
                          <td key={q.id} className={`text-center ${changed ? "font-bold text-gold" : ""}`}>{f ?? "—"}</td>
                        );
                      })}
                      <td className="text-right text-muted-foreground">{s.evaluator_total ?? "—"}</td>
                      <td className="text-right">{s.final_total ?? "—"}</td>
                      <td className="text-right">{pct ?? "—"}</td>
                      <td className="pr-4 text-right font-sans font-semibold">{pct == null ? "—" : gradeFor(pct).grade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Gold figures were changed during moderation.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Q = { id: string; number: number; label: string; max_marks: number };

function QuestionsPanel({ examId, questions, editable, onChange, maxTotal }: { examId: string; questions: Q[]; editable: boolean; onChange: () => void; maxTotal: number }) {
  const [label, setLabel] = useState("");
  const [max, setMax] = useState("10");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const number = (questions.at(-1)?.number ?? 0) + 1;
    const { error } = await supabase.from("questions").insert({ exam_id: examId, number, label, max_marks: Number(max) });
    if (error) return toast.error(error.message);
    setLabel("");
    onChange();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }
  return (
    <div className="max-w-2xl">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        {questions.map((q) => (
          <div key={q.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
            <div><span className="font-semibold">Q{q.number}</span> <span className="text-muted-foreground">{q.label}</span></div>
            <div className="flex items-center gap-4">
              <span className="font-mono">{q.max_marks} marks</span>
              {editable && <button onClick={() => remove(q.id)} className="text-xs text-destructive hover:underline">Remove</button>}
            </div>
          </div>
        ))}
        <div className="flex justify-between bg-muted px-4 py-3 font-semibold">
          <span>Maximum marks</span><span className="font-mono">{maxTotal}</span>
        </div>
      </div>
      {editable ? (
        <form onSubmit={add} className="mt-4 flex items-end gap-3">
          <div className="flex-1 space-y-1"><Label>Question topic (optional)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Stacks & queues" /></div>
          <div className="w-28 space-y-1"><Label>Max marks</Label><Input type="number" min={0.5} step="0.5" required value={max} onChange={(e) => setMax(e.target.value)} /></div>
          <Button type="submit">Add question</Button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">The question paper is locked once valuation begins.</p>
      )}
    </div>
  );
}

type U = { id: string; full_name: string; email: string };

function ScriptIntake({ examId, questions, students, onDone }: { examId: string; questions: Q[]; students: U[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function createScript(opts: { studentId?: string; file?: File | null }) {
    const { data: s, error } = await supabase
      .from("scripts")
      .insert({
        exam_id: examId,
        code: generateScriptCode(),
        sample_answers: opts.file ? null : makeSampleAnswers(questions.map((q) => q.number)),
      })
      .select()
      .single();
    if (error) throw error;
    if (opts.file) {
      const ext = opts.file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${examId}/${s.id}.${ext}`;
      const up = await supabase.storage.from("answer-scripts").upload(path, opts.file, { upsert: true });
      if (up.error) throw up.error;
      const u = await supabase.from("scripts").update({ file_path: path }).eq("id", s.id);
      if (u.error) throw u.error;
    }
    if (opts.studentId) {
      const o = await supabase.from("script_owners").insert({ script_id: s.id, student_id: opts.studentId });
      if (o.error) throw o.error;
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Choose a scanned PDF or image");
    setBusy(true);
    try {
      await createScript({ studentId: student || undefined, file });
      toast.success("Script uploaded and coded");
      setOpen(false); setFile(null); setStudent("");
      onDone();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  async function samples() {
    if (!questions.length) return toast.error("Add questions first");
    setBusy(true);
    try {
      const targets = students.length ? students.map((s) => s.id) : [undefined, undefined, undefined];
      for (const t of targets) await createScript({ studentId: t });
      toast.success(`${targets.length} sample scripts added`);
      onDone();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button>Upload scanned script</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload answer script</DialogTitle></DialogHeader>
          <form onSubmit={upload} className="space-y-4">
            <div className="space-y-1">
              <Label>Candidate</Label>
              <Select value={student} onValueChange={setStudent}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Evaluators only ever see the anonymous script code.</p>
            </div>
            <div className="space-y-1">
              <Label>Scanned file (PDF, JPG, PNG)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Upload</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={samples} disabled={busy}>
        Add sample scripts {students.length ? `(one per student)` : "(3)"}
      </Button>
    </div>
  );
}
