import { describe, expect, it } from "vitest";
import z from "zod";

import {
  createDataFilterInputSearchSchema,
  createDataFilterSelectSearchSchema,
  dataFilterDateSearchSchema,
} from "./data-filter-search-schema";

describe("data filter search schemas", () => {
  it("accepts null equality conditions used by empty input filters", () => {
    const schema = createDataFilterInputSearchSchema(z.string().max(255), {
      fulltext: true,
    });

    expect(schema.safeParse({ $eq: null }).success).toBe(true);
    expect(schema.safeParse({ $ne: null }).success).toBe(true);
  });

  it("accepts null equality conditions used by empty select filters", () => {
    const schema = createDataFilterSelectSearchSchema(z.enum(["ACTIVE"]));

    expect(schema.safeParse({ $eq: null }).success).toBe(true);
    expect(schema.safeParse({ $ne: null }).success).toBe(true);
  });

  it("accepts null equality conditions used by empty date filters", () => {
    expect(dataFilterDateSearchSchema.safeParse({ $eq: null }).success).toBe(
      true,
    );
    expect(dataFilterDateSearchSchema.safeParse({ $ne: null }).success).toBe(
      true,
    );
  });
});
