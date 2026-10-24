export const GRADE_BANDS = [
  { min: 90, grade: "O", label: "Outstanding" },
  { min: 80, grade: "A+", label: "Excellent" },
  { min: 70, grade: "A", label: "Very Good" },
  { min: 60, grade: "B+", label: "Good" },
  { min: 50, grade: "B", label: "Above Average" },
  { min: 40, grade: "C", label: "Pass" },
  { min: 0, grade: "F", label: "Fail" },
] as const;

export function percentage(total: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.round((total / max) * 10000) / 100;
}

export function gradeFor(pct: number) {
  return GRADE_BANDS.find((b) => pct >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
}

/** Final marks: moderated marks win when present, otherwise evaluator marks. */
export function finalMark(evaluator: number | null, moderated: number | null): number | null {
  return moderated ?? evaluator;
}

export function generateScriptCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `DES-${s}`;
}
