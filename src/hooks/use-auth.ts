import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "evaluator" | "moderator" | "student";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      return {
        user: u.user,
        profile,
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
  });
}

export function hasRole(me: ReturnType<typeof useMe>["data"], role: AppRole) {
  return !!me?.roles.includes(role);
}
