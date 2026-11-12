import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { getQuestionWiseReport } from "@/lib/question-wise-report.functions";
import { downloadQuestionWiseWorkbook } from "@/lib/question-wise-excel";

type Props = { disabled?: boolean } & (
  | { scope: "exam"; examId: string }
  | { scope: "evaluator" | "moderator" }
);

export function QuestionWiseExportButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const [examId, setExamId] = useState("");
  const getReport = useServerFn(getQuestionWiseReport);
  const { data: me } = useMe();

  // For staff scopes, list only the subjects that have scripts assigned to this user.
  const { data: subjects = [] } = useQuery({
    queryKey: ["export-subjects", props.scope, me?.user.id],
    enabled: props.scope !== "exam" && !!me,
    queryFn: async () => {
      const col = props.scope === "evaluator" ? "evaluator_id" : "moderator_id";
      const { data, error } = await supabase
        .from("scripts")
        .select("exam_id, exams(id, code, title)")
        .eq(col, me!.user.id);
      if (error) throw error;
      const seen = new Map<string, { id: string; code: string; title: string }>();
      for (const row of data ?? []) {
        const exam = row.exams as { id: string; code: string; title: string } | null;
        if (exam && !seen.has(exam.id)) seen.set(exam.id, exam);
      }
      return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
    },
  });

  const needsPick = props.scope !== "exam" && subjects.length > 1;
  const selected = subjects.find((s) => s.id === examId);

  async function exportExcel() {
    setBusy(true);
    try {
      const input =
        props.scope === "exam"
          ? { scope: "exam" as const, examId: props.examId }
          : { scope: props.scope, examId: examId || undefined };
      const report = await getReport({ data: input });
      if (!report.scripts.length) {
        toast.info("There are no assigned scripts to export for this subject.");
        return;
      }
      downloadQuestionWiseWorkbook(report, selected?.code);
      toast.success(`Excel downloaded with ${report.scripts.length} scripts and question-wise marks.`);
    } catch (error) {
      console.error("Question-wise Excel export failed", error);
      toast.error("Could not prepare the Excel report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.scope !== "exam" && subjects.length > 0 && (
        <select
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          aria-label="Select subject to export"
          className="h-9 max-w-[220px] rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">All my subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.title}
            </option>
          ))}
        </select>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || props.disabled}
        onClick={exportExcel}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
        {busy ? "Preparing…" : "Question-wise Excel"}
      </Button>
    </div>
  );
}
