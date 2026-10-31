import type { ReactNode } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toCsv, type Row } from "@/lib/dataset-profile";

export const C = {
  primary: "var(--color-primary)",
  gold: "var(--color-gold)",
  danger: "var(--color-destructive)",
  muted: "var(--color-muted-foreground)",
};

export function Kpi({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: ReactNode; hint?: string; icon: React.ComponentType<{ className?: string }>; tone?: "default" | "gold" | "danger" }) {
  const ring = tone === "danger" ? "bg-destructive/10 text-destructive" : tone === "gold" ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary";
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${ring}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({ eyebrow, title, children, action }: { eyebrow?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          {eyebrow && <p className="eyebrow text-gold">{eyebrow}</p>}
          <h2 className="text-lg">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function SourceBadge({ source }: { source: string }) {
  return source === "live"
    ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Live evaluation data</span>
    : <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium">Uploaded file</span>;
}

export function ReviewBadge({ status }: { status: string }) {
  const map: Record<string, string> = { pending: "bg-muted text-foreground", reviewed: "bg-primary/10 text-primary", investigate: "bg-destructive/10 text-destructive" };
  const label: Record<string, string> = { pending: "Pending review", reviewed: "Reviewed", investigate: "Needs investigation" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] ?? ""}`}>{label[status] ?? status}</span>;
}

export function downloadCsv(name: string, rows: Row[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadPdf(name: string, title: string, summary: string[], head: string[], body: (string | number)[][]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  summary.forEach((s, i) => doc.text(s, 14, 24 + i * 5));
  autoTable(doc, { head: [head], body, startY: 26 + summary.length * 5, styles: { fontSize: 8 }, headStyles: { fillColor: [20, 33, 61] } });
  doc.save(name);
}

export const fmt = (n: unknown, d = 3) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(d) : "—");
