import { describe, it, expect } from "vitest";
import { questionLabel, compareQuestions, nextPart } from "./question-label";

describe("question sub-parts", () => {
  it("labels whole and split questions", () => {
    expect(questionLabel({ number: 1, part: "" })).toBe("Q1");
    expect(questionLabel({ number: 1, part: "b" })).toBe("Q1b");
  });
  it("sorts 1a before 1b before 2", () => {
    const qs = [{ number: 2, part: "" }, { number: 1, part: "b" }, { number: 1, part: "a" }];
    expect(qs.sort(compareQuestions).map(questionLabel)).toEqual(["Q1a", "Q1b", "Q2"]);
  });
  it("suggests the next part letter", () => {
    expect(nextPart([{ number: 3, part: "a" }], 3)).toBe("b");
    expect(nextPart([], 3)).toBe("a");
  });
});
