import { describe, expect, it } from "vitest";
import { clampMark } from "./ai-mark.server";

describe("AI suggested marks are kept within the question's limits", () => {
  it("never exceeds the maximum marks", () => expect(clampMark(12, 10)).toBe(10));
  it("never goes below zero", () => expect(clampMark(-3, 10)).toBe(0));
  it("rounds to the nearest half mark", () => expect(clampMark(6.3, 10)).toBe(6.5));
});
