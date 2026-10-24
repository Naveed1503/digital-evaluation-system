import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  unassigned: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  assigned: "bg-accent text-accent-foreground",
  evaluating: "bg-warning/20 text-foreground",
  evaluated: "bg-warning/25 text-foreground",
  moderated: "bg-success/15 text-success",
  published: "bg-primary text-primary-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        styles[status] ?? "bg-muted",
      )}
    >
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        {eyebrow && <p className="eyebrow text-gold">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl text-foreground">{title}</h1>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
