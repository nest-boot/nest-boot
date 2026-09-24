import { describe, expect, it } from "vitest";
import {
  getDataFilterDate,
  getDataFilterDateRangeValue,
  getDataFilterDateValue,
} from "@/components/thread-ui/data-filter/utils/data-filter-date-value";

describe("date filter calendar values", () => {
  it("sends the selected calendar date instead of its UTC timestamp", () => {
    const date = new Date(2026, 8, 24);
    expect(getDataFilterDateValue(date)).toBe("2026-09-24");
    expect(getDataFilterDate("2026-09-24")).toEqual(date);
    expect(getDataFilterDateValue()).toBeUndefined();
  });
  it("preserves range bounds as dates including incomplete selections", () => {
    const from = new Date(2026, 2, 8);
    const to = new Date(2026, 2, 9);
    expect(getDataFilterDateRangeValue({ from, to })).toEqual([
      "2026-03-08",
      "2026-03-09",
    ]);
    expect(getDataFilterDateRangeValue({ from })).toEqual([
      "2026-03-08",
      undefined,
    ]);
  });
});
