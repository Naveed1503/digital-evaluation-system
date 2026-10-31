import { describe, expect, it } from "vitest";
import { detectUnusualMarking, groupStudents, kMeans, zScores } from "./ml";

describe("z-score anomaly detection", () => {
  it("z-scores of [40,50,60] are -1.22, 0, 1.22", () => {
    expect(zScores([40, 50, 60]).map((z) => Math.round(z * 100) / 100)).toEqual([-1.22, 0, 1.22]);
  });
  it("flags a script far above the rest", () => {
    const scores = [50, 52, 48, 51, 49, 50, 53, 47, 50, 95].map((pct, i) => ({ id: `s${i}`, evaluatorId: "e", pct }));
    const { flags } = detectUnusualMarking(scores);
    expect(flags.map((f) => f.id)).toEqual(["s9"]);
    expect(flags[0].kind).toBe("high");
  });
  it("labels a consistently generous evaluator as Lenient and a harsh one as Strict", () => {
    const scores = [
      ...[85, 88, 90].map((pct, i) => ({ id: `a${i}`, evaluatorId: "A", pct })),
      ...[55, 60, 58].map((pct, i) => ({ id: `b${i}`, evaluatorId: "B", pct })),
      ...[30, 32, 28].map((pct, i) => ({ id: `c${i}`, evaluatorId: "C", pct })),
    ];
    const ev = Object.fromEntries(detectUnusualMarking(scores).evaluators.map((e) => [e.evaluatorId, e.label]));
    expect(ev).toEqual({ A: "Lenient", B: "Normal", C: "Strict" });
  });
});

describe("k-means grouping", () => {
  it("separates three clear clusters", () => {
    const { labels } = kMeans([[10], [12], [50], [52], [90], [92]], 3);
    expect(labels[0]).toBe(labels[1]);
    expect(labels[2]).toBe(labels[3]);
    expect(labels[4]).toBe(labels[5]);
    expect(new Set(labels).size).toBe(3);
  });
  it("names the highest-scoring group Strong and the lowest Needs support", () => {
    const { group } = groupStudents([[20, 25], [90, 95], [55, 60], [22, 18], [88, 92], [58, 50]]);
    expect(group).toEqual(["Needs support", "Strong", "Average", "Needs support", "Strong", "Average"]);
  });
});
