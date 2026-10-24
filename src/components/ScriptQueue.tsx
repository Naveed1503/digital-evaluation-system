import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { PageHeader, StatusBadge } from "@/components/StatusBadge";

export function ScriptQueue({ mode }: { mode: "evaluate" | "moderate" }) {
  const { data: me } = useMe();
  const { data = [], isLoading } = useQuery({
    queryKey: ["queue", mode, me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const col = mode === "evaluate" ? "evaluator_id" : "moderator_id";
      const { data, error } = await supabase
        .from("scripts")
        .select("id, code, status, evaluator_total, final_total, exams(code,title,status)")
        .eq(col, me!.user.id)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const pendingStatus = mode === "evaluate" ? "assigned" : "evaluated";
  const pending = data.filter((s) => s.status === pendingStatus);

  return (
    <div>
      <PageHeader eyebrow={mode === "evaluate" ? "Evaluator" : "Moderator"} title={mode === "evaluate" ? "My valuation queue" : "Moderation queue"}>
        <div className="rounded-md border border-border bg-card px-4 py-2 text-sm">
          <span className="font-mono text-lg">{pending.length}</span> pending · {data.length} total
        </div>
      </PageHeader>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          No scripts allocated to you yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Script code</th>
                <th>Examination</th>
                <th>Status</th>
                <th>{mode === "evaluate" ? "Your total" : "Evaluator / Final"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => {
                const ex = s.exams as { code: string; title: string; status: string } | null;
                const canOpen = mode === "evaluate" || s.status === "evaluated" || s.status === "moderated";
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono">{s.code}</td>
                    <td>
                      {ex?.code} <span className="text-muted-foreground">· {ex?.title}</span>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="font-mono">
                      {mode === "evaluate" ? (s.evaluator_total ?? "—") : `${s.evaluator_total ?? "—"} / ${s.final_total ?? "—"}`}
                    </td>
                    <td className="pr-4 text-right">
                      {canOpen ? (
                        <Link
                          to={mode === "evaluate" ? "/evaluate/$scriptId" : "/moderate/$scriptId"}
                          params={{ scriptId: s.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {s.status === pendingStatus ? "Open →" : "View"}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Awaiting valuation</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
