import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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
  Menu,
  BrainCircuit,
  BarChart3,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type AppRole } from "@/hooks/use-auth";

const NAV: { to: string; label: string; roles: AppRole[]; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin", "evaluator", "moderator", "student"], icon: LayoutDashboard },
  { to: "/admin/exams", label: "Examinations", roles: ["admin"], icon: FileStack },
  { to: "/admin/users", label: "Users & Roles", roles: ["admin"], icon: Users },
  { to: "/analytics", label: "Evaluation Analytics", roles: ["admin"], icon: BarChart3 },
  { to: "/admin/insights", label: "ML Insights", roles: ["admin"], icon: BrainCircuit },
  { to: "/admin/audit", label: "Audit Trail", roles: ["admin"], icon: ScrollText },
  { to: "/evaluate", label: "My Valuation", roles: ["evaluator"], icon: PenLine },
  { to: "/moderate", label: "Moderation", roles: ["moderator"], icon: ShieldCheck },
  { to: "/moderate/flags", label: "Flagged Records", roles: ["moderator", "admin"], icon: Flag },
  { to: "/results", label: "My Results", roles: ["student"], icon: GraduationCap },
];

function initials(name?: string | null, email?: string) {
  const source = name || email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const roles = me?.roles ?? [];
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <>
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15 ring-1 ring-sidebar-primary/40">
            <Landmark className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-sidebar-primary">Office of the Controller</p>
            <p className="mt-0.5 font-serif text-[15px] leading-tight text-sidebar-accent-foreground">
              Digital Evaluation System
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.filter((n) => n.roles.some((r) => roles.includes(r))).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMenuOpen(false)}
              className="group flex min-h-11 items-center gap-3 rounded-md border-l-[3px] border-transparent px-3 py-2.5 text-sm text-sidebar-foreground/85 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border-sidebar-primary",
              }}
            >
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
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-primary"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <header className="sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <Landmark className="h-5 w-5 shrink-0 text-sidebar-primary" />
          <span className="min-w-0 font-serif text-sm leading-snug">Digital Evaluation System</span>
        </Link>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation" className="h-11 w-11 shrink-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" aria-describedby={undefined} className="flex w-[min(20rem,88vw)] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">Portal navigation</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
      </header>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">{sidebar}</aside>
      <main className="portal-main min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
