import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMe, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [
    { title: 'Users and roles — Digital Evaluation System' },
    { name: "description", content: 'Manage authorized examination staff and student roles.' },
    { property: "og:title", content: 'Users and roles — Digital Evaluation System' },
    { property: "og:description", content: 'Manage authorized examination staff and student roles.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["admin", "evaluator", "moderator", "student"];

function UsersPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return data;
    },
  });

  async function toggle(userId: string, role: AppRole, on: boolean) {
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: userId, role })
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  return (
    <div>
      <PageHeader eyebrow="Controller" title="Users & roles" />
      <p className="mb-4 text-sm text-muted-foreground">
        People join by signing up. Tick a box to grant a role; one person may hold several.
      </p>
      <div className="overflow-x-auto rounded-md border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th><th>Email</th>
              {ROLES.map((r) => <th key={r} className="text-center capitalize">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                <td className="text-muted-foreground">{u.email}</td>
                {ROLES.map((r) => (
                  <td key={r} className="text-center">
                    <Checkbox
                      aria-label={`${r} role for ${u.email}`}
                      checked={u.roles.includes(r)}
                      disabled={r === "admin" && u.id === me?.user.id}
                      onCheckedChange={(v) => toggle(u.id, r, !!v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
