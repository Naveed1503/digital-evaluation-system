/**
 * Machine-learning helpers (pure, dependency-free).
 * 1. Z-score anomaly detection for unusual marking.
 * 2. K-Means clustering for student performance grouping.
 */

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

export function zScores(xs: number[]): number[] {
  const m = mean(xs);
  const sd = stdDev(xs);
  return xs.map((x) => (sd === 0 ? 0 : (x - m) / sd));
}

export type ScriptScore = { id: string; evaluatorId: string | null; pct: number };

export type ScriptFlag = { id: string; z: number; kind: "high" | "low" };
export type EvaluatorBias = {
  evaluatorId: string;
  scripts: number;
  meanPct: number;
  bias: number; // mean z-score of this evaluator's scripts
  label: "Lenient" | "Strict" | "Normal";
};

/** Flags scripts whose |z| >= threshold, and evaluators whose average z leans strongly one way. */
export function detectUnusualMarking(
  scores: ScriptScore[],
  scriptThreshold = 2,
  biasThreshold = 0.75,
): { flags: ScriptFlag[]; evaluators: EvaluatorBias[] } {
  const z = zScores(scores.map((s) => s.pct));
  const flags: ScriptFlag[] = [];
  scores.forEach((s, i) => {
    if (Math.abs(z[i]) >= scriptThreshold) flags.push({ id: s.id, z: z[i], kind: z[i] > 0 ? "high" : "low" });
  });
  const byEval = new Map<string, number[]>();
  scores.forEach((s, i) => {
    if (!s.evaluatorId) return;
    byEval.set(s.evaluatorId, [...(byEval.get(s.evaluatorId) ?? []), i]);
  });
  const evaluators: EvaluatorBias[] = [...byEval.entries()].map(([evaluatorId, idx]) => {
    const bias = mean(idx.map((i) => z[i]));
    return {
      evaluatorId,
      scripts: idx.length,
      meanPct: mean(idx.map((i) => scores[i].pct)),
      bias,
      label: bias >= biasThreshold ? "Lenient" : bias <= -biasThreshold ? "Strict" : "Normal",
    };
  });
  return { flags, evaluators };
}

function dist2(a: number[], b: number[]) {
  return a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
}

/**
 * Deterministic K-Means: centroids start at evenly spaced points after
 * sorting by average feature value, then Lloyd iterations until stable.
 */
export function kMeans(points: number[][], k: number, maxIter = 100): { labels: number[]; centroids: number[][] } {
  if (points.length === 0) return { labels: [], centroids: [] };
  const kk = Math.min(k, points.length);
  const order = points.map((p, i) => ({ i, m: mean(p) })).sort((a, b) => a.m - b.m);
  let centroids = Array.from({ length: kk }, (_, c) => {
    const pos = kk === 1 ? 0 : Math.round((c * (order.length - 1)) / (kk - 1));
    return [...points[order[pos].i]];
  });
  let labels = new Array(points.length).fill(-1);
  for (let it = 0; it < maxIter; it++) {
    const next = points.map((p) => {
      let best = 0;
      for (let c = 1; c < kk; c++) if (dist2(p, centroids[c]) < dist2(p, centroids[best])) best = c;
      return best;
    });
    const same = next.every((l, i) => l === labels[i]);
    labels = next;
    centroids = centroids.map((old, c) => {
      const members = points.filter((_, i) => labels[i] === c);
      return members.length ? old.map((_, d) => mean(members.map((m) => m[d]))) : old;
    });
    if (same) break;
  }
  return { labels, centroids };
}

export const GROUP_NAMES = ["Needs support", "Average", "Strong"] as const;

/** Clusters question-wise percentage vectors into 3 groups named by centroid average. */
export function groupStudents(vectors: number[][]): { group: string[]; centroids: { name: string; avg: number }[] } {
  const { labels, centroids } = kMeans(vectors, 3);
  const ranked = centroids.map((c, idx) => ({ idx, avg: mean(c) })).sort((a, b) => a.avg - b.avg);
  const names = ranked.length === 3 ? GROUP_NAMES : ranked.length === 2 ? ["Needs support", "Strong"] : ["Average"];
  const nameOf = new Map(ranked.map((r, i) => [r.idx, names[i]]));
  return {
    group: labels.map((l) => nameOf.get(l)!),
    centroids: ranked.map((r, i) => ({ name: names[i], avg: Math.round(r.avg * 10) / 10 })),
  };
}
