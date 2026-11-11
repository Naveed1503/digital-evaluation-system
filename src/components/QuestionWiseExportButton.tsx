import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getQuestionWiseReport } from "@/lib/question-wise-report.functions";
import { downloadQuestionWiseWorkbook } from "@/lib/question-wise-excel";

type Props = { disabled?: boolean } & (
  | { scope: "exam"; examId: string }
  | { scope: "evaluator" | "moderator" }
);

export function QuestionWiseExportButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const getReport = useServerFn(getQuestionWiseReport);

  async function exportExcel() {
    setBusy(true);
    try {
      const input = props.scope === "exam" ? { scope: "exam" as const, examId: props.examId } : { scope: props.scope };
      const report = await getReport({ data: input });
      if (!report.scripts.length) {
        toast.info("There are no assigned scripts to export.");
        return;
      }
      downloadQuestionWiseWorkbook(report);
      toast.success(`Excel downloaded with ${report.scripts.length} scripts and question-wise marks.`);
    } catch (error) {
      console.error("Question-wise Excel export failed", error);
      toast.error("Could not prepare the Excel report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy || props.disabled} onClick={exportExcel}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {busy ? "Preparing…" : "Question-wise Excel"}
    </Button>
  );
}
