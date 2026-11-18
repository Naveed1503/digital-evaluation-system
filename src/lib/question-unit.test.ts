import { describe, it, expect } from "vitest";
import { bestOfTotal, examMaxTotal } from "./question-label";

const sem = [
  { number: 1, part: "a", unit: 1, max_marks: 10 },
  { number: 1, part: "b", unit: 1, max_marks: 10 },
  { number: 2, part: "a", unit: 1, max_marks: 20 },
  { number: 3, part: "", unit: 2, max_marks: 20 },
  { number: 4, part: "", unit: 2, max_marks: 20 },
];

describe("semester best-of-two per unit", () => {
  it("max counts one question per unit", () => {
    expect(examMaxTotal(sem)).toBe(40);
  });
  it("takes the better of the two answers in a unit", () => {
    const marks: Record<string, number> = { "1a": 6, "1b": 5, "2a": 14, "3": 12, "4": 9 };
    expect(bestOfTotal(sem, (q) => marks[`${q.number}${q.part}`] ?? 0)).toBe(26);
  });
  it("internal questions without units all add up", () => {
    const internal = [{ number: 1, part: "a", max_marks: 5 }, { number: 1, part: "b", max_marks: 5 }, { number: 2, part: "", max_marks: 10 }];
    expect(examMaxTotal(internal)).toBe(20);
  });
});
