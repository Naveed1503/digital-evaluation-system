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

export type UnitQuestion = QuestionLike & { unit?: number | null; max_marks: number | string };

/**
 * Semester rule: questions inside a unit are alternatives (e.g. Q1 or Q2).
 * Each question number's parts are summed and only the best number in a unit counts.
 * Questions without a unit (internal pattern) always add up.
 */
export function bestOfTotal<T extends UnitQuestion>(questions: T[], valueOf: (q: T) => number) {
  const perNumber = new Map<string, { unit: number | null; sum: number }>();
  for (const q of questions) {
    const unit = q.unit ?? null;
    const key = `${unit ?? "-"}:${q.number}`;
    const cur = perNumber.get(key) ?? { unit, sum: 0 };
    cur.sum += valueOf(q) || 0;
    perNumber.set(key, cur);
  }
  let total = 0;
  const best = new Map<number, number>();
  for (const { unit, sum } of perNumber.values()) {
    if (unit == null) total += sum;
    else best.set(unit, Math.max(best.get(unit) ?? 0, sum));
  }
  for (const v of best.values()) total += v;
  return Math.round(total * 100) / 100;
}

/** Maximum marks of the paper under the best-of rule. */
export function examMaxTotal(questions: UnitQuestion[]) {
  return bestOfTotal(questions, (q) => Number(q.max_marks));
}
