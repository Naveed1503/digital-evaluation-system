import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./pagination";

describe("paged report queries", () => {
  it("retrieves all 2,501 rows beyond the 1,000-row response limit", async () => {
    const source = Array.from({ length: 2501 }, (_, i) => i + 1);
    const pageSizes: number[] = [];
    const rows = await fetchAllPages(async (from, to) => {
      const page = source.slice(from, to + 1);
      pageSizes.push(page.length);
      return { data: page, error: null };
    });
    expect(rows).toHaveLength(2501);
    expect(rows[0]).toBe(1);
    expect(rows[2500]).toBe(2501);
    expect(pageSizes).toEqual([1000, 1000, 501]);
  });
});
