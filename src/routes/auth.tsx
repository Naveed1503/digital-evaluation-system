import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Digital Evaluation System" },
      { name: "description", content: "Sign in to the examination evaluation portal." },
      { property: "og:title", content: "Sign in — Digital Evaluation System" },
      { property: "og:description", content: "Access for controllers, evaluators, moderators and students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error(r.error.message);
    if (r.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-seal p-12 text-primary-foreground md:flex">
        <p className="font-serif text-lg">Digital Evaluation System</p>
        <div>
          <p className="eyebrow text-gold">Confidential</p>
          <p className="mt-3 font-serif text-3xl leading-snug">
            Access to answer scripts is restricted, anonymised and recorded.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">The first account created becomes the Controller (admin).</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              New accounts start as students; the Controller assigns staff roles.
            </p>
          </div>
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
          <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
