import { describe, expect, it } from "vitest";
import { finalMark, gradeFor, percentage } from "./grading";

describe("grading rules", () => {
  it("computes percentage to two decimals", () => {
    expect(percentage(67, 80)).toBe(83.75);
  });
  it("90% and above is O", () => {
    expect(gradeFor(90).grade).toBe("O");
  });
  it("just under 40% fails", () => {
    expect(gradeFor(39.99).grade).toBe("F");
  });
  it("40% is a pass (C)", () => {
    expect(gradeFor(40).grade).toBe("C");
  });
  it("moderated marks override evaluator marks", () => {
    expect(finalMark(12, 14)).toBe(14);
    expect(finalMark(12, null)).toBe(12);
  });
});
