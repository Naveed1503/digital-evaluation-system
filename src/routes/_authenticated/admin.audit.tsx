import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit trail — DES" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const [log, users, scripts, exams] = await Promise.all([
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.rpc("list_users_with_roles"),
        supabase.from("scripts").select("id, code"),
        supabase.from("exams").select("id, code"),
      ]);
      return { log: log.data ?? [], users: users.data ?? [], scripts: scripts.data ?? [], exams: exams.data ?? [] };
    },
  });
  return (
    <div>
      <PageHeader eyebrow="Transparency" title="Audit trail" />
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">When</th><th>Who</th><th>Action</th><th>Exam</th><th>Script</th><th>Details</th></tr>
          </thead>
          <tbody>
            {data?.log.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-2.5 text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                <td>{data.users.find((u) => u.id === l.actor_id)?.email ?? "—"}</td>
                <td className="font-semibold capitalize">{l.action.replace("_", " ")}</td>
                <td className="font-mono">{data.exams.find((e) => e.id === l.exam_id)?.code ?? "—"}</td>
                <td className="font-mono">{data.scripts.find((s) => s.id === l.script_id)?.code ?? "—"}</td>
                <td className="text-muted-foreground">{l.details}</td>
              </tr>
            ))}
            {!data?.log.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
