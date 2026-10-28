import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type Answer = { q: number; text: string };

export function ScriptViewer({
  code,
  filePath,
  sampleAnswers,
}: {
  code: string;
  filePath: string | null;
  sampleAnswers: unknown;
}) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["signed", filePath],
    enabled: !!filePath,
    queryFn: async () => {
      if (!filePath) throw new Error("No script file available");
      const { data, error } = await supabase.storage
        .from("answer-scripts")
        .createSignedUrl(filePath, 60 * 30);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const header = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-4 py-2">
      <span className="eyebrow text-muted-foreground">Answer Script</span>
      <span className="font-mono text-sm text-foreground">{code}</span>
    </div>
  );

  if (filePath) {
    const isPdf = filePath.toLowerCase().endsWith(".pdf");
    return (
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-border bg-muted">
        {header}
        {isLoading || !url ? (
          <div className="p-8 text-sm text-muted-foreground">Loading script securely…</div>
        ) : isPdf ? (
          <>
            <div className="border-b border-border bg-card p-3">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open PDF</a>
              </Button>
            </div>
            <iframe title="Answer script" src={url} className="h-full min-h-[50dvh] w-full sm:min-h-[70vh]" />
          </>
        ) : (
          <div className="overflow-auto p-4">
            <img src={url} alt={`Answer script ${code}`} className="mx-auto max-w-full shadow-card" />
          </div>
        )}
      </div>
    );
  }

  const answers = (Array.isArray(sampleAnswers) ? sampleAnswers : []) as Answer[];
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-border">
      {header}
      <div className="ruled-paper min-h-[70vh] overflow-auto break-words px-4 py-6 sm:px-10 font-serif text-[15px] text-foreground">
        {answers.length === 0 && <p className="text-muted-foreground">No content on this script.</p>}
        {answers.map((a) => (
          <div key={a.q} className="mb-8">
            <p className="font-bold text-primary">Ans. {a.q}</p>
            <p className="whitespace-pre-wrap italic">{a.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
