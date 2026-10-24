import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";
import { hasRole, useMe } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DES" }] }),
  component: Dashboard,
});

function Tile({ label, value, to, cta }: { label: string; value: number | string; to: string; cta: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-card">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-4xl">{value}</p>
      <Link to={to} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">{cta} →</Link>
    </div>
  );
}

function Dashboard() {
  const { data: me } = useMe();
  const { data: s } = useQuery({
    queryKey: ["dash", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const uid = me!.user.id;
      const [exams, all, mineE, mineM] = await Promise.all([
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("scripts").select("status"),
        supabase.from("scripts").select("status").eq("evaluator_id", uid),
        supabase.from("scripts").select("status").eq("moderator_id", uid),
      ]);
      const allS = all.data ?? [];
      return {
        exams: exams.count ?? 0,
        scripts: allS.length,
        finalised: allS.filter((x) => x.status === "moderated").length,
        evalPending: (mineE.data ?? []).filter((x) => x.status === "assigned").length,
        modPending: (mineM.data ?? []).filter((x) => x.status === "evaluated").length,
      };
    },
  });

  const name = me?.profile?.full_name || me?.user.email;
  return (
    <div>
      <PageHeader eyebrow="Welcome" title={`Good day, ${name ?? ""}`} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {hasRole(me, "admin") && (
          <>
            <Tile label="Examinations" value={s?.exams ?? "—"} to="/admin/exams" cta="Manage examinations" />
            <Tile label="Scripts finalised" value={s ? `${s.finalised}/${s.scripts}` : "—"} to="/admin/exams" cta="View progress" />
          </>
        )}
        {hasRole(me, "evaluator") && <Tile label="Scripts to evaluate" value={s?.evalPending ?? "—"} to="/evaluate" cta="Open valuation queue" />}
        {hasRole(me, "moderator") && <Tile label="Scripts to moderate" value={s?.modPending ?? "—"} to="/moderate" cta="Open moderation queue" />}
        {hasRole(me, "student") && <Tile label="Declared results" value="View" to="/results" cta="Statement of marks" />}
      </div>
      {hasRole(me, "admin") && (
        <div className="mt-10 max-w-3xl rounded-md border border-border bg-secondary p-6 text-sm">
          <p className="font-serif text-lg">Getting started</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Ask staff and students to sign up, then grant Evaluator / Moderator roles under Users & Roles.</li>
            <li>Create an examination and set up its question paper.</li>
            <li>Upload scanned scripts or add sample scripts, then press Auto-assign.</li>
            <li>When every script is moderated, publish results.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
