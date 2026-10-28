import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { hasRole, useMe } from "@/hooks/use-auth";
import { gradeFor, percentage } from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: 'Dashboard — Digital Evaluation System' },
    { name: "description", content: 'Monitor examination progress, assignments and declared results.' },
    { property: "og:title", content: 'Dashboard — Digital Evaluation System' },
    { property: "og:description", content: 'Monitor examination progress, assignments and declared results.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
});

const STAGES = ["unassigned", "assigned", "evaluated", "moderated"] as const;

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-3 shadow-card sm:p-5">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 grid min-w-0 gap-2 sm:flex sm:items-end sm:justify-between">
        <h2 className="text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );
}

function Dashboard() {
  const { data: me } = useMe();
  const name = me?.profile?.full_name || me?.user.email;
  return (
    <div>
      <PageHeader eyebrow={me?.roles.join(" · ") || "Welcome"} title={`Good day, ${name ?? ""}`} />
      {hasRole(me, "admin") && <AdminPanel />}
      {hasRole(me, "evaluator") && <QueuePanel mode="evaluate" />}
      {hasRole(me, "moderator") && <QueuePanel mode="moderate" />}
      {hasRole(me, "student") && <StudentPanel />}
    </div>
  );
}

/* ---------------- Controller ---------------- */
function AdminPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dash-admin"],
    queryFn: async () => {
      const [exams, users, audit] = await Promise.all([
        supabase.from("exams").select("id, code, title, status, questions(id), scripts(status, evaluator_id, moderator_id)").order("created_at", { ascending: false }),
        supabase.rpc("list_users_with_roles"),
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      return { exams: exams.data ?? [], users: users.data ?? [], audit: audit.data ?? [] };
    },
  });
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const { exams, users, audit } = data;
  const all = exams.flatMap((e) => e.scripts as { status: string; evaluator_id: string | null; moderator_id: string | null }[]);
  const count = (s: string) => all.filter((x) => x.status === s).length;
  const evaluators = users.filter((u) => u.roles.includes("evaluator"));
  const moderators = users.filter((u) => u.roles.includes("moderator"));
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.full_name || users.find((u) => u.id === id)?.email || "—";

  async function run(fn: "auto_assign" | "publish_results", examId: string) {
    if (fn === "publish_results" && !confirm("Publish results? Marks will be locked and visible to students.")) return;
    const { error } = await supabase.rpc(fn, { _exam_id: examId });
    if (error) { toast.error(error.message); return; }
    toast.success(fn === "auto_assign" ? "Scripts allocated" : "Results published");
    qc.invalidateQueries();
  }

  function nextStep(e: (typeof exams)[number]) {
    const sc = e.scripts as { status: string }[];
    if (e.status === "published") return <span className="text-xs text-success">Results declared</span>;
    if (!(e.questions as unknown[]).length) return <Link to="/admin/exams/$examId" params={{ examId: e.id }} className="text-sm text-primary hover:underline">Set question paper →</Link>;
    if (!sc.length) return <Link to="/admin/exams/$examId" params={{ examId: e.id }} className="text-sm text-primary hover:underline">Add scripts →</Link>;
    if (sc.some((s) => s.status === "unassigned")) return <Button size="sm" variant="outline" onClick={() => run("auto_assign", e.id)}>Auto-assign</Button>;
    if (sc.every((s) => s.status === "moderated")) return <Button size="sm" onClick={() => run("publish_results", e.id)}>Publish results</Button>;
    return <span className="text-xs text-muted-foreground">Valuation in progress</span>;
  }

  const setup = [
    { done: evaluators.length > 0 && moderators.length > 0, text: "Grant Evaluator and Moderator roles", to: "/admin/users" },
    { done: exams.length > 0, text: "Create an examination", to: "/admin/exams" },
    { done: all.length > 0, text: "Add answer scripts", to: "/admin/exams" },
    { done: all.some((s) => s.status !== "unassigned"), text: "Allocate scripts", to: "/admin/exams" },
    { done: exams.some((e) => e.status === "published"), text: "Publish results", to: "/admin/exams" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Stat label="Examinations" value={exams.length} hint={`${exams.filter((e) => e.status === "published").length} published`} />
        <Stat label="Unassigned" value={count("unassigned")} />
        <Stat label="With evaluators" value={count("assigned")} />
        <Stat label="Awaiting moderation" value={count("evaluated")} />
        <Stat label="Finalised" value={count("moderated")} hint={`of ${all.length} scripts`} />
      </div>

      {setup.some((s) => !s.done) && (
        <div className="mt-6 rounded-md border border-border bg-secondary p-5">
          <p className="font-serif text-lg">Setup checklist</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-5">
            {setup.map((s) => (
              <li key={s.text}>
                <Link to={s.to} className={`block rounded-sm border p-3 text-sm ${s.done ? "border-success/40 bg-success/10 text-success" : "border-border bg-card hover:border-primary"}`}>
                  {s.done ? "✓ " : "○ "}{s.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Examination pipeline" action={<Link to="/admin/exams" className="text-sm text-primary hover:underline">All examinations →</Link>}>
        <div className="overflow-x-auto rounded-md border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3">Paper</th><th>Status</th>{STAGES.map((s) => <th key={s} className="text-center capitalize">{s}</th>)}<th className="w-40">Progress</th><th className="pr-4 text-right">Next step</th></tr>
            </thead>
            <tbody>
              {exams.map((e) => {
                const sc = e.scripts as { status: string }[];
                const fin = sc.filter((s) => s.status === "moderated").length;
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to="/admin/exams/$examId" params={{ examId: e.id }} className="hover:underline">
                        <span className="font-mono text-gold">{e.code}</span> {e.title}
                      </Link>
                    </td>
                    <td><StatusBadge status={e.status} /></td>
                    {STAGES.map((s) => <td key={s} className="text-center font-mono">{sc.filter((x) => x.status === s).length}</td>)}
                    <td><Bar done={fin} total={sc.length} /><span className="text-xs text-muted-foreground">{fin}/{sc.length}</span></td>
                    <td className="pr-4 text-right">{nextStep(e)}</td>
                  </tr>
                );
              })}
              {!exams.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No examinations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Examiner workload">
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Examiner</th><th>Role</th><th className="text-center">Pending</th><th className="text-center">Done</th></tr>
              </thead>
              <tbody>
                {[...evaluators.map((u) => ({ u, role: "Evaluator", mine: all.filter((s) => s.evaluator_id === u.id), pend: "assigned" })),
                  ...moderators.map((u) => ({ u, role: "Moderator", mine: all.filter((s) => s.moderator_id === u.id), pend: "evaluated" }))].map(({ u, role, mine, pend }) => (
                  <tr key={u.id + role} className="border-t border-border">
                    <td className="px-4 py-2.5">{u.full_name || u.email}</td>
                    <td className="text-muted-foreground">{role}</td>
                    <td className="text-center font-mono">{mine.filter((s) => s.status === pend).length}</td>
                    <td className="text-center font-mono">{mine.filter((s) => (role === "Evaluator" ? ["evaluated", "moderated"] : ["moderated"]).includes(s.status)).length}</td>
                  </tr>
                ))}
                {!evaluators.length && !moderators.length && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No examiners yet — <Link to="/admin/users" className="text-primary hover:underline">grant roles</Link>.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Recent activity" action={<Link to="/admin/audit" className="text-sm text-primary hover:underline">Audit trail →</Link>}>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {audit.map((a) => (
              <li key={a.id} className="grid min-w-0 gap-1 break-words px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                <span><span className="font-semibold capitalize">{a.action.replace("_", " ")}</span> <span className="text-muted-foreground">by {nameOf(a.actor_id)} · {a.details}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
            {!audit.length && <li className="p-6 text-center text-sm text-muted-foreground">No activity yet.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}

/* ---------------- Evaluator / Moderator ---------------- */
function QueuePanel({ mode }: { mode: "evaluate" | "moderate" }) {
  const { data: me } = useMe();
  const { data = [] } = useQuery({
    queryKey: ["dash-queue", mode, me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("id, code, status, exams(code,title)")
        .eq(mode === "evaluate" ? "evaluator_id" : "moderator_id", me!.user.id)
        .order("code");
      return data ?? [];
    },
  });
  const pendStatus = mode === "evaluate" ? "assigned" : "evaluated";
  const pending = data.filter((s) => s.status === pendStatus);
  const done = data.filter((s) => (mode === "evaluate" ? ["evaluated", "moderated"] : ["moderated"]).includes(s.status)).length;
  const waiting = mode === "moderate" ? data.filter((s) => s.status === "assigned").length : 0;
  return (
    <Section
      title={mode === "evaluate" ? "My valuation work" : "My moderation work"}
      action={<Link to={mode === "evaluate" ? "/evaluate" : "/moderate"} className="text-sm text-primary hover:underline">Full queue →</Link>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Pending" value={pending.length} />
        <Stat label="Completed" value={done} hint={`of ${data.length} allocated`} />
        {mode === "moderate" ? <Stat label="Still with evaluators" value={waiting} /> : (
          <div className="min-w-0 rounded-md border border-border bg-card p-3 shadow-card sm:p-5">
            <p className="eyebrow text-muted-foreground">Progress</p>
            <div className="mt-4"><Bar done={done} total={data.length} /></div>
            <p className="mt-2 text-xs text-muted-foreground">{data.length ? Math.round((done / data.length) * 100) : 0}% complete</p>
          </div>
        )}
      </div>
      <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-card">
        {pending.slice(0, 6).map((s) => {
          const ex = s.exams as { code: string; title: string } | null;
          return (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 break-words px-4 py-3 text-sm">
              <span><span className="font-mono">{s.code}</span> <span className="text-muted-foreground">· {ex?.code} {ex?.title}</span></span>
              <Button asChild size="sm">
                <Link to={mode === "evaluate" ? "/evaluate/$scriptId" : "/moderate/$scriptId"} params={{ scriptId: s.id }}>
                  {mode === "evaluate" ? "Evaluate" : "Moderate"}
                </Link>
              </Button>
            </li>
          );
        })}
        {!pending.length && <li className="p-6 text-center text-sm text-muted-foreground">Nothing pending. 🎓</li>}
      </ul>
    </Section>
  );
}

/* ---------------- Student ---------------- */
function StudentPanel() {
  const { data: me } = useMe();
  const { data = [] } = useQuery({
    queryKey: ["dash-student", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const { data: owned } = await supabase.from("script_owners").select("script_id").eq("student_id", me!.user.id);
      const ids = (owned ?? []).map((o) => o.script_id);
      if (!ids.length) return [];
      const { data: scripts } = await supabase.from("scripts").select("id, final_total, evaluator_total, exam_id, exams(code,title)").in("id", ids);
      const out = [];
      for (const s of scripts ?? []) {
        const { data: qs } = await supabase.from("questions").select("max_marks").eq("exam_id", s.exam_id);
        const max = (qs ?? []).reduce((a, q) => a + Number(q.max_marks), 0);
        out.push({ ...s, max });
      }
      return out;
    },
  });
  return (
    <Section title="My declared results" action={<Link to="/results" className="text-sm text-primary hover:underline">Statement of marks →</Link>}>
      {data.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No results declared yet. They appear here as soon as the Controller publishes them.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {data.map((s) => {
            const ex = s.exams as { code: string; title: string } | null;
            const total = Number(s.final_total ?? s.evaluator_total ?? 0);
            const pct = percentage(total, s.max);
            return (
              <Link key={s.id} to="/results" className="min-w-0 rounded-md border border-border bg-card p-3 shadow-card sm:p-5 hover:border-primary">
                <p className="font-mono text-sm text-gold">{ex?.code}</p>
                <p className="font-serif text-lg">{ex?.title}</p>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-mono">{total}/{s.max} · {pct}%</span>
                  <span className="font-serif text-2xl">{gradeFor(pct).grade}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Section>
  );
}
