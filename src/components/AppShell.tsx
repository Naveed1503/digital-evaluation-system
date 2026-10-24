import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileStack,
  Users,
  ScrollText,
  PenLine,
  ShieldCheck,
  GraduationCap,
  LogOut,
  Landmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type AppRole } from "@/hooks/use-auth";

const NAV: { to: string; label: string; roles: AppRole[]; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin", "evaluator", "moderator", "student"], icon: LayoutDashboard },
  { to: "/admin/exams", label: "Examinations", roles: ["admin"], icon: FileStack },
  { to: "/admin/users", label: "Users & Roles", roles: ["admin"], icon: Users },
  { to: "/admin/audit", label: "Audit Trail", roles: ["admin"], icon: ScrollText },
  { to: "/evaluate", label: "My Valuation", roles: ["evaluator"], icon: PenLine },
  { to: "/moderate", label: "Moderation", roles: ["moderator"], icon: ShieldCheck },
  { to: "/results", label: "My Results", roles: ["student"], icon: GraduationCap },
];

function initials(name?: string | null, email?: string) {
  const source = name || email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

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
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15 ring-1 ring-sidebar-primary/40">
            <Landmark className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-sidebar-primary">Office of the Controller</p>
            <p className="mt-0.5 truncate font-serif text-[15px] leading-tight text-sidebar-accent-foreground">
              Digital Evaluation System
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.filter((n) => n.roles.some((r) => roles.includes(r))).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/85 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm",
              }}
            >
              <span className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary transition-all duration-200 group-[.active]:h-5 [.active_&]:h-5" />
              <n.icon className="h-4 w-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary ring-1 ring-sidebar-primary/40">
              {initials(me?.profile?.full_name, me?.user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {me?.profile?.full_name || me?.user.email}
              </p>
              <p className="mt-0.5 truncate text-[11px] capitalize text-sidebar-foreground/60">
                {roles.join(" · ")}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-md p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">{children}</main>
    </div>
  );
}
