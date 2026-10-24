import { cn } from "@/lib/utils";

const styles: Record<string, { badge: string; dot: string }> = {
  unassigned: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  draft: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  assigned: { badge: "bg-accent text-accent-foreground", dot: "bg-primary" },
  evaluating: { badge: "bg-warning/15 text-warning-foreground", dot: "bg-warning" },
  evaluated: { badge: "bg-warning/20 text-warning-foreground", dot: "bg-warning" },
  moderated: { badge: "bg-success/12 text-success", dot: "bg-success" },
  published: { badge: "bg-primary text-primary-foreground", dot: "bg-gold" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = styles[status] ?? { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        s.badge,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          {eyebrow && <p className="eyebrow text-gold">{eyebrow}</p>}
          <h1 className="mt-1.5 text-3xl text-foreground">{title}</h1>
        </div>
        {children && <div className="flex gap-2">{children}</div>}
      </div>
      <div className="gold-line" />
    </div>
  );
}
