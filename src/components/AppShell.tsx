import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type AppRole } from "@/hooks/use-auth";

const NAV: { to: string; label: string; roles: AppRole[] }[] = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin", "evaluator", "moderator", "student"] },
  { to: "/admin/exams", label: "Examinations", roles: ["admin"] },
  { to: "/admin/users", label: "Users & Roles", roles: ["admin"] },
  { to: "/admin/audit", label: "Audit Trail", roles: ["admin"] },
  { to: "/evaluate", label: "My Valuation", roles: ["evaluator"] },
  { to: "/moderate", label: "Moderation", roles: ["moderator"] },
  { to: "/results", label: "My Results", roles: ["student"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const roles = me?.roles ?? [];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-6 py-6">
          <p className="eyebrow text-sidebar-primary">Office of the Controller</p>
          <p className="mt-1 font-serif text-lg leading-tight">Digital Evaluation System</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter((n) => n.roles.some((r) => roles.includes(r))).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="block rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-sidebar-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="truncate font-medium">{me?.profile?.full_name || me?.user.email}</p>
          <p className="mt-0.5 text-xs capitalize text-sidebar-foreground/70">{roles.join(" · ")}</p>
          <button onClick={signOut} className="mt-3 text-xs text-sidebar-primary hover:underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">{children}</main>
    </div>
  );
}
