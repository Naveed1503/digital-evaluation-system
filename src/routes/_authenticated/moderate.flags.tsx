import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, ReviewBadge } from "@/components/analytics/shared";

export const Route = createFileRoute("/_authenticated/moderate/flags")({
  head: () => ({ meta: [
    { title: "Flagged records — Digital Evaluation System" },
    { name: "description", content: "Review records flagged by Isolation Forest anomaly detection and record moderator decisions." },
    { property: "og:title", content: "Flagged records — Digital Evaluation System" },
    { property: "og:description", content: "Review records flagged by Isolation Forest anomaly detection and record moderator decisions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FlagsPage,
});

type Flag = { id: string; run_id: string; row_index: number; record: Record<string, unknown>; score: number; exam: string | null; subject: string | null; evaluator: string | null; record_date: string | null; review_status: string; review_comment: string | null; reviewed_at: string | null; script_id: string | null };

function FlagsPage() {
  const [status, setStatus] = useState("pending");
  const [open, setOpen] = useState<Flag | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["ml-flags", status],
    queryFn: async () => {
      let q = supabase.from("ml_results").select("*").eq("is_anomaly", true).order("score", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("review_status", status);
      return ((await q).data ?? []) as unknown as Flag[];
    },
  });
  return (
    <div>
      <PageHeader eyebrow="Moderation · ML assisted" title="Flagged records">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Review status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending review</option><option value="investigate">Needs investigation</option><option value="reviewed">Reviewed</option><option value="all">All flagged</option>
        </select>
      </PageHeader>
      <p className="mb-4 rounded-md border border-gold/40 bg-gold/5 p-3 text-sm text-muted-foreground">
        These records were flagged as unusual by the Isolation Forest model. The flag is advisory only — <strong className="text-foreground">marks are never changed automatically</strong>. Use the normal moderation workflow to change any mark.
      </p>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : !data.length ? <Empty>No flagged records in this view.</Empty> : (
        <div className="overflow-x-auto rounded-md border border-border bg-card shadow-card"><table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Record</th><th>Exam</th><th>Subject</th><th>Evaluator</th><th>Date</th><th>Anomaly score</th><th>Status</th><th /></tr></thead>
          <tbody>{data.map((f) => (
            <tr key={f.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{String(f.record["script_code"] ?? `Row ${f.row_index + 1}`)}</td><td>{f.exam ?? "—"}</td><td>{f.subject ?? "—"}</td><td>{f.evaluator ?? "—"}</td><td className="text-xs">{f.record_date ?? "—"}</td>
              <td className="font-mono">{Number(f.score).toFixed(3)}</td><td><ReviewBadge status={f.review_status} /></td>
              <td className="pr-3 text-right"><Button size="sm" variant="outline" onClick={() => setOpen(f)}>Inspect</Button></td>
            </tr>))}</tbody>
        </table></div>
      )}
      <ReviewDialog flag={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function ReviewDialog({ flag, onClose }: { flag: Flag | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(status: "reviewed" | "investigate") {
    if (!flag) return;
    if (status === "investigate" && !comment.trim()) { toast.error("Add a comment explaining what needs investigation"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("review_ml_flag", { _result_id: flag.id, _status: status, _comment: comment });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "reviewed" ? "Marked as reviewed" : "Marked for further investigation");
    setComment(""); onClose();
    qc.invalidateQueries({ queryKey: ["ml-flags"] }); qc.invalidateQueries({ queryKey: ["analytics"] });
  }
  return (
    <Dialog open={!!flag} onOpenChange={(o) => { if (!o) { setComment(""); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Flagged record · score {flag ? Number(flag.score).toFixed(3) : ""}</DialogTitle></DialogHeader>
        {flag && (
          <div className="space-y-4">
            <div className="max-h-64 overflow-auto rounded-sm border border-border"><table className="w-full text-sm"><tbody>
              {Object.entries(flag.record).filter(([k]) => k !== "script_id").map(([k, v]) => <tr key={k} className="border-t border-border first:border-0"><td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{k}</td><td className="px-3 py-1.5 font-mono text-xs">{v == null ? "—" : String(v)}</td></tr>)}
            </tbody></table></div>
            {flag.review_comment && <p className="text-sm"><span className="text-muted-foreground">Previous comment:</span> {flag.review_comment}</p>}
            {flag.script_id && <Link to="/moderate/$scriptId" params={{ scriptId: flag.script_id }} className="text-sm text-primary hover:underline">Open script in moderation workspace →</Link>}
            <Textarea placeholder="Moderator comment" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="grid gap-2 sm:flex sm:justify-end">
              <Button variant="outline" disabled={busy} onClick={() => save("investigate")}>Requires further investigation</Button>
              <Button disabled={busy} onClick={() => save("reviewed")}>Mark as reviewed</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
