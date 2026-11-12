export type QuestionLike = { number: number; part?: string | null };

/** "Q1" for a whole question, "Q1a" for a sub-part. */
export function questionLabel(q: QuestionLike) {
  return `Q${q.number}${q.part ?? ""}`;
}

/** Orders Q1, Q1a, Q1b, Q2 ... */
export function compareQuestions(a: QuestionLike, b: QuestionLike) {
  return a.number - b.number || (a.part ?? "").localeCompare(b.part ?? "");
}

/** Next part letter for a question number ("a" if none yet). */
export function nextPart(existing: QuestionLike[], number: number) {
  const parts = existing.filter((q) => q.number === number).map((q) => q.part ?? "").filter(Boolean).sort();
  const last = parts.at(-1);
  return last ? String.fromCharCode(last.charCodeAt(0) + 1) : "a";
}
