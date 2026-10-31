import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/StatusBadge";
import { ScriptViewer } from "@/components/ScriptViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRADE_BANDS, finalMark, generateScriptCode, gradeFor, percentage } from "@/lib/grading";
import { makeSampleAnswers } from "@/lib/sample-answers";

export const Route = createFileRoute("/_authenticated/admin/exams/$examId")({
  head: () => ({ meta: [
    { title: 'Examination detail — Digital Evaluation System' },
    { name: "description", content: 'Manage question papers, script allocation, moderation and publication.' },
    { property: "og:title", content: 'Examination detail — Digital Evaluation System' },
    { property: "og:description", content: 'Manage question papers, script allocation, moderation and publication.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ExamDetail,
});

const MAX_FILE_MB = 20;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const NONE = "__none__";

function useExam(examId: string) {
  return useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const [exam, questions, scripts, owners, users, marks, revisions] = await Promise.all([
        supabase.from("exams").select("*").eq("id", examId).single(),
        supabase.from("questions").select("*").eq("exam_id", examId).order("number"),
        supabase.from("scripts").select("*").eq("exam_id", examId).order("code"),
        supabase.from("script_owners").select("script_id, student_id, scripts!inner(exam_id)").eq("scripts.exam_id", examId),
        supabase.rpc("list_users_with_roles"),
        supabase.from("marks").select("*, scripts!inner(exam_id)").eq("scripts.exam_id", examId),
        supabase.from("mark_revisions").select("*, scripts!inner(exam_id, code), questions(number)").eq("scripts.exam_id", examId).order("created_at", { ascending: false }),
      ]);
      if (exam.error) throw exam.error;
      return {
        exam: exam.data,
        questions: questions.data ?? [],
        scripts: scripts.data ?? [],
        owners: owners.data ?? [],
        users: users.data ?? [],
        marks: marks.data ?? [],
        revisions: revisions.data ?? [],
      };
    },
  });
}

type ExamData = NonNullable<ReturnType<typeof useExam>["data"]>;

function ExamDetail() {
  const { examId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useExam(examId);
  const refresh = () => qc.invalidateQueries();

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  const { exam, questions, scripts, owners, users, marks, revisions } = data;
  const nameOf = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name || u?.email || "—";
  };
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
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} scripts allocated`);
    refresh();
  }
  async function publish() {
    if (!confirm("Publish results? Marks will be locked and visible to students.")) return;
    const { error } = await supabase.rpc("publish_results", { _exam_id: examId });
    if (error) { toast.error(error.message); return; }
    toast.success("Results published");
    refresh();
  }
  async function deleteExam() {
    if (!confirm(`Delete ${exam.code} and all its scripts and marks? This cannot be undone.`)) return;
    const paths = scripts.map((s) => s.file_path).filter((p): p is string => !!p);
    if (paths.length) await supabase.storage.from("answer-scripts").remove(paths);
    const { error } = await supabase.from("exams").delete().eq("id", examId);
    if (error) { toast.error(error.message); return; }
    toast.success("Examination deleted");
    qc.invalidateQueries();
    navigate({ to: "/admin/exams" });
  }

  return (
    <div>
      <Link to="/admin/exams" className="text-sm text-primary hover:underline">← All examinations</Link>
      <PageHeader eyebrow={`${exam.code} · ${exam.course}`} title={exam.title}>
        <StatusBadge status={exam.status} />
        <EditExamDialog exam={exam} onDone={refresh} />
        <Button variant="ghost" className="text-destructive" onClick={deleteExam}>Delete</Button>
        {!published && (
          <>
            <Button variant="outline" onClick={autoAssign} disabled={!counts.unassigned || !questions.length}>
              Auto-assign ({counts.unassigned})
            </Button>
            <Button onClick={publish} disabled={!counts.total || counts.moderated !== counts.total}>Publish results</Button>
          </>
        )}
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Scripts", counts.total], ["Unassigned", counts.unassigned], ["Evaluated", counts.evaluated], ["Moderated", counts.moderated]].map(([l, v]) => (
          <div key={l} className="rounded-md border border-border bg-card p-4 shadow-card">
            <p className="eyebrow text-muted-foreground">{l}</p>
            <p className="mt-1 font-mono text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="questions">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="questions">Question paper</TabsTrigger>
          <TabsTrigger value="scripts">Scripts & allocation</TabsTrigger>
          <TabsTrigger value="tabulation">Results</TabsTrigger>
          <TabsTrigger value="revisions">Moderation changes ({revisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-6">
          <QuestionsPanel examId={examId} questions={questions} editable={exam.status === "draft"} onChange={refresh} maxTotal={maxTotal} />
        </TabsContent>

        <TabsContent value="scripts" className="mt-6">
          {!published && (
            <ScriptIntake examId={examId} questions={questions} students={users.filter((u) => u.roles.includes("student"))} onDone={refresh} />
          )}
          <div className="mt-4 overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Code</th><th>Candidate</th><th>Source</th><th>Evaluator</th><th>Moderator</th><th>Status</th><th className="pr-4 text-right">Actions</th></tr>
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
                    <td className="space-x-1 pr-4 text-right">
                      <ViewScriptDialog script={s} />
                      {!published && <ReassignDialog script={s} users={users} onDone={refresh} />}
                      {!published && s.status !== "moderated" && <DeleteScriptButton script={s} onDone={refresh} />}
                    </td>
                  </tr>
                ))}
                {!scripts.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No scripts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="tabulation" className="mt-6">
          <ResultsPanel data={data} nameOf={nameOf} ownerOf={ownerOf} maxTotal={maxTotal} />
        </TabsContent>

        <TabsContent value="revisions" className="mt-6">
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">When</th><th>Script</th><th>Q</th><th className="text-center">From → To</th><th>Reason</th><th>Moderator</th></tr>
              </thead>
              <tbody>
                {revisions.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="font-mono">{(r.scripts as { code: string } | null)?.code}</td>
                    <td>Q{(r.questions as { number: number } | null)?.number}</td>
                    <td className="text-center font-mono">{r.old_marks ?? "—"} → <span className="font-bold text-gold">{r.new_marks}</span></td>
                    <td>{r.reason}</td>
                    <td>{nameOf(r.changed_by)}</td>
                  </tr>
                ))}
                {!revisions.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No marks have been changed during moderation.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Results ---------- */
function ResultsPanel({ data, nameOf, ownerOf, maxTotal }: { data: ExamData; nameOf: (id: string | null) => string; ownerOf: (s: string) => string | null; maxTotal: number }) {
  const { scripts, questions, marks, exam } = data;
  const rows = scripts.map((s) => {
    const fin = s.final_total ?? s.evaluator_total;
    const pct = fin == null ? null : percentage(Number(fin), maxTotal);
    return { s, fin, pct, grade: pct == null ? null : gradeFor(pct).grade };
  });
  const scored = rows.filter((r) => r.pct != null);
  const avg = scored.length ? Math.round((scored.reduce((a, r) => a + (r.pct ?? 0), 0) / scored.length) * 100) / 100 : 0;
  const passed = scored.filter((r) => r.grade !== "F").length;
  const highest = scored.reduce((m, r) => Math.max(m, Number(r.fin)), 0);

  function exportCsv() {
    const head = ["Script", "Candidate", ...questions.map((q) => `Q${q.number}`), "Evaluator total", "Final total", "Percentage", "Grade"];
    const lines = rows.map(({ s, pct, grade }) => [
      s.code, nameOf(ownerOf(s.id)),
      ...questions.map((q) => {
        const m = marks.find((x) => x.script_id === s.id && x.question_id === q.id);
        return m ? (finalMark(m.evaluator_marks, m.moderated_marks) ?? "") : "";
      }),
      s.evaluator_total ?? "", s.final_total ?? "", pct ?? "", grade ?? "",
    ]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${exam.code}-results.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Average", `${avg}%`], ["Pass rate", scored.length ? `${Math.round((passed / scored.length) * 100)}%` : "—"], ["Highest", `${highest}/${maxTotal}`], ["Scored", `${scored.length}/${scripts.length}`]].map(([l, v]) => (
          <div key={l} className="rounded-md border border-border bg-card p-4"><p className="eyebrow text-muted-foreground">{l}</p><p className="mt-1 font-mono text-2xl">{v}</p></div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {GRADE_BANDS.map((b) => (
          <span key={b.grade} className="rounded-sm border border-border bg-card px-2 py-1">
            <b>{b.grade}</b> {scored.filter((r) => r.grade === b.grade).length}
          </span>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>Download CSV</Button>
      </div>
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
            {rows.map(({ s, pct, grade }) => (
              <tr key={s.id} className="border-t border-border font-mono">
                <td className="px-4 py-2">{s.code}</td>
                <td className="font-sans">{nameOf(ownerOf(s.id))}</td>
                {questions.map((q) => {
                  const m = marks.find((x) => x.script_id === s.id && x.question_id === q.id);
                  const f = m ? finalMark(m.evaluator_marks, m.moderated_marks) : null;
                  const changed = m?.moderated_marks != null && m.moderated_marks !== m.evaluator_marks;
                  return <td key={q.id} title={m?.moderation_reason ?? undefined} className={`text-center ${changed ? "font-bold text-gold" : ""}`}>{f ?? "—"}</td>;
                })}
                <td className="text-right text-muted-foreground">{s.evaluator_total ?? "—"}</td>
                <td className="text-right">{s.final_total ?? "—"}</td>
                <td className="text-right">{pct ?? "—"}</td>
                <td className="pr-4 text-right font-sans font-semibold">{grade ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Gold figures were changed during moderation — hover to see the reason. Results are calculated automatically from final marks.</p>
    </div>
  );
}

/* ---------- Exam edit ---------- */
type Exam = ExamData["exam"];
function EditExamDialog({ exam, onDone }: { exam: Exam; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: exam.code, title: exam.title, course: exam.course, exam_date: exam.exam_date ?? "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("exams").update({ ...f, exam_date: f.exam_date || null }).eq("id", exam.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Examination updated");
    setOpen(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Edit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit examination</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          {(["code", "title", "course"] as const).map((k) => (
            <div key={k} className="space-y-1"><Label className="capitalize">{k}</Label><Input required value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          <div className="space-y-1"><Label>Exam date</Label><Input type="date" value={f.exam_date} onChange={(e) => setF({ ...f, exam_date: e.target.value })} /></div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Script actions ---------- */
type Script = ExamData["scripts"][number];
type U = ExamData["users"][number];

function ViewScriptDialog({ script }: { script: Script }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost">View</Button></DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Script {script.code}</DialogTitle></DialogHeader>
        <div className="max-h-[75vh] overflow-auto">
          <ScriptViewer code={script.code} filePath={script.file_path} sampleAnswers={script.sample_answers} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReassignDialog({ script, users, onDone }: { script: Script; users: U[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [ev, setEv] = useState(script.evaluator_id ?? NONE);
  const [mod, setMod] = useState(script.moderator_id ?? NONE);
  const evalLocked = !["unassigned", "assigned"].includes(script.status);
  const modLocked = script.status === "moderated";
  async function save() {
    const { error } = await supabase.rpc("reassign_script", {
      _script_id: script.id,
      _evaluator: (ev === NONE ? null : ev) as string,
      _moderator: (mod === NONE ? null : mod) as string,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Allocation updated");
    setOpen(false);
    onDone();
  }
  const pick = (role: "evaluator" | "moderator", value: string, set: (v: string) => void, disabled: boolean) => (
    <Select value={value} onValueChange={set} disabled={disabled}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— Not assigned —</SelectItem>
        {users.filter((u) => u.roles.includes(role)).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">{script.evaluator_id ? "Reassign" : "Assign"}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Allocate script {script.code}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Evaluator</Label>{pick("evaluator", ev, setEv, evalLocked)}
            {evalLocked && <p className="text-xs text-muted-foreground">Locked — valuation already submitted.</p>}</div>
          <div className="space-y-1"><Label>Moderator</Label>{pick("moderator", mod, setMod, modLocked)}</div>
          <Button className="w-full" onClick={save}>Save allocation</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteScriptButton({ script, onDone }: { script: Script; onDone: () => void }) {
  async function del() {
    if (!confirm(`Delete script ${script.code} and any marks on it?`)) return;
    if (script.file_path) await supabase.storage.from("answer-scripts").remove([script.file_path]);
    const { error } = await supabase.from("scripts").delete().eq("id", script.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Script deleted");
    onDone();
  }
  return <Button size="sm" variant="ghost" className="text-destructive" onClick={del}>Delete</Button>;
}

/* ---------- Questions ---------- */
type Q = ExamData["questions"][number];

function QuestionRow({ q, editable, onChange }: { q: Q; editable: boolean; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const [label, setLabel] = useState(q.label);
  const [max, setMax] = useState(String(q.max_marks));
  const [model, setModel] = useState(q.model_answer ?? "");
  async function save() {
    const n = Number(max);
    if (!(n > 0)) { toast.error("Max marks must be more than 0"); return; }
    const { error } = await supabase.from("questions").update({ label, max_marks: n, model_answer: model }).eq("id", q.id);
    if (error) { toast.error(error.message); return; }
    setEdit(false);
    onChange();
  }
  async function remove() {
    if (!confirm(`Remove Q${q.number}?`)) return;
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) { toast.error(error.message); return; }
    onChange();
  }
  if (edit)
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-3 sm:flex sm:flex-wrap sm:px-4">
        <span className="w-8 font-semibold">Q{q.number}</span>
        <Input className="h-8 min-w-0 flex-1" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input className="h-8 w-20" type="number" step="0.5" value={max} onChange={(e) => setMax(e.target.value)} />
        <Button size="sm" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
        <Textarea className="col-span-3 mt-1 text-sm sm:basis-full" placeholder="Model answer / key points (used by the AI marking assistant)" value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
    );
  return (
    <div className="grid min-w-0 gap-2 border-b border-border px-4 py-3 sm:flex sm:items-center sm:justify-between">
      <div><span className="font-semibold">Q{q.number}</span> <span className="text-muted-foreground">{q.label}</span>{q.model_answer ? <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px]">Model answer set</span> : null}</div>
      <div className="flex items-center gap-3">
        <span className="font-mono">{q.max_marks} marks</span>
        {editable && (
          <>
            <button onClick={() => setEdit(true)} className="text-xs text-primary hover:underline">Edit</button>
            <button onClick={remove} className="text-xs text-destructive hover:underline">Remove</button>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionsPanel({ examId, questions, editable, onChange, maxTotal }: { examId: string; questions: Q[]; editable: boolean; onChange: () => void; maxTotal: number }) {
  const [label, setLabel] = useState("");
  const [max, setMax] = useState("10");
  const [model, setModel] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const number = (questions.at(-1)?.number ?? 0) + 1;
    const { error } = await supabase.from("questions").insert({ exam_id: examId, number, label, max_marks: Number(max), model_answer: model });
    if (error) { toast.error(error.message); return; }
    setLabel(""); setModel("");
    onChange();
  }
  return (
    <div className="max-w-2xl">
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        {questions.map((q) => <QuestionRow key={q.id} q={q} editable={editable} onChange={onChange} />)}
        <div className="flex justify-between bg-muted px-4 py-3 font-semibold"><span>Maximum marks</span><span className="font-mono">{maxTotal}</span></div>
      </div>
      {editable ? (
        <form onSubmit={add} className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 space-y-1"><Label>Question topic (optional)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Stacks & queues" /></div>
          <div className="w-full space-y-1 sm:w-28"><Label>Max marks</Label><Input type="number" min={0.5} step="0.5" required value={max} onChange={(e) => setMax(e.target.value)} /></div>
          <Button type="submit">Add question</Button>
          <div className="w-full space-y-1 sm:basis-full"><Label>Model answer / key points (optional, used by AI marking assistant)</Label><Textarea value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Stack is LIFO; push adds on top; pop removes top; overflow when full" /></div>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">The question paper is locked once valuation begins.</p>
      )}
    </div>
  );
}

/* ---------- Intake ---------- */
function ScriptIntake({ examId, questions, students, onDone }: { examId: string; questions: Q[]; students: U[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function createScript(opts: { studentId?: string | undefined; file?: File | null }) {
    const { data: s, error } = await supabase
      .from("scripts")
      .insert({ exam_id: examId, code: generateScriptCode(), sample_answers: opts.file ? null : makeSampleAnswers(questions.map((q) => q.number)) })
      .select()
      .single();
    if (error) throw error;
    if (opts.file) {
      const ext = opts.file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${examId}/${s.id}.${ext}`;
      const up = await supabase.storage.from("answer-scripts").upload(path, opts.file, { upsert: true, contentType: opts.file.type });
      if (up.error) { await supabase.from("scripts").delete().eq("id", s.id); throw up.error; }
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
    if (!file) { toast.error("Choose a scanned PDF or image"); return; }
    if (!ALLOWED.includes(file.type)) { toast.error("Only PDF, JPG, PNG or WEBP files are accepted"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`File must be under ${MAX_FILE_MB} MB`); return; }
    if (!student) { toast.error("Select the candidate"); return; }
    setBusy(true);
    try {
      await createScript({ studentId: student, file });
      toast.success("Script uploaded securely and coded");
      setOpen(false); setFile(null); setStudent("");
      onDone();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  async function samples() {
    if (!questions.length) { toast.error("Add questions first"); return; }
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
                <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Stored privately. Evaluators only ever see the anonymous script code.</p>
            </div>
            <div className="space-y-1">
              <Label>Scanned file (PDF, JPG, PNG, WEBP · max {MAX_FILE_MB} MB)</Label>
              <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={samples} disabled={busy}>
        Add sample scripts {students.length ? "(one per student)" : "(3)"}
      </Button>
    </div>
  );
}
