import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";

export const MODEL = "openai/gpt-6-astra";

export type MarkQuestion = { number: number; label: string; max: number; modelAnswer: string; answer: string };

const schema = z.object({
  suggestions: z.array(z.object({ number: z.number(), marks: z.number(), reason: z.string() })),
});

/** Rounds to the nearest 0.5 and clamps into [0, max]. */
export function clampMark(v: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(max, Math.max(0, Math.round(v * 2) / 2));
}

export async function suggestMarks(apiKey: string, questions: MarkQuestion[]) {
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const prompt = questions
    .map((q) => `### Q${q.number} (max ${q.max} marks)${q.label ? ` — ${q.label}` : ""}\nMODEL ANSWER / RUBRIC:\n${q.modelAnswer || "(none given — judge on correctness and completeness)"}\nSTUDENT ANSWER:\n${q.answer || "(no answer)"}`)
    .join("\n\n");
  const result = streamText({
    model: provider.responses(MODEL),
    instructions:
      "You are an experienced university examiner. For each question, award marks (multiples of 0.5, between 0 and the maximum) by comparing the student answer with the model answer/rubric. Give a one-sentence reason. An empty answer gets 0.",
    prompt,
    output: Output.object({ schema }),
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
    },
  });
  const out = await result.output;
  return questions.map((q) => {
    const s = out.suggestions.find((x) => x.number === q.number);
    return { number: q.number, marks: clampMark(s?.marks ?? 0, q.max), reason: s?.reason ?? "No suggestion returned." };
  });
}
