import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/exams/")({
  head: () => ({ meta: [{ title: "Examinations — DES" }] }),
  component: ExamsPage,
});

function ExamsPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*, scripts(status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", title: "", course: "", exam_date: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("exams").insert({ ...form, exam_date: form.exam_date || null });
    if (error) return toast.error(error.message);
    toast.success("Examination created");
    setOpen(false);
    setForm({ code: "", title: "", course: "", exam_date: "" });
    qc.invalidateQueries({ queryKey: ["exams"] });
  }

  return (
    <div>
      <PageHeader eyebrow="Controller" title="Examinations">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New examination</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New examination</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-3">
              {(
                [
                  ["code", "Paper code", "CS301"],
                  ["title", "Paper title", "Data Structures"],
                  ["course", "Course / Semester", "B.Tech CSE · Sem 3"],
                ] as const
              ).map(([k, l, p]) => (
                <div key={k} className="space-y-1">
                  <Label>{l}</Label>
                  <Input required placeholder={p} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Exam date</Label>
                <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      {data.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          No examinations yet. Create one to begin.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((e) => {
            const sc = (e.scripts ?? []) as { status: string }[];
            const done = sc.filter((s) => s.status === "moderated").length;
            return (
              <Link
                key={e.id}
                to="/admin/exams/$examId"
                params={{ examId: e.id }}
                className="block rounded-md border border-border bg-card p-5 shadow-card transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-sm text-gold">{e.code}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="mt-2 font-serif text-lg">{e.title}</p>
                <p className="text-sm text-muted-foreground">{e.course}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${sc.length ? (done / sc.length) * 100 : 0}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {done} of {sc.length} scripts finalised
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
