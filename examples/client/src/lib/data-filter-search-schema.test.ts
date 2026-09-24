import { describe, expect, it } from "vitest";
import z from "zod";

import {
  createDataFilterDateSearchSchema,
  createDataFilterInputSearchSchema,
  createDataFilterSelectSearchSchema,
} from "./data-filter-search-schema";

describe("data filter search schemas", () => {
  it("accepts null equality conditions used by empty input filters", () => {
    const schema = createDataFilterInputSearchSchema(z.string().max(255), {
      fulltext: true,
    });

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });

  it("accepts null equality conditions used by empty select filters", () => {
    const schema = createDataFilterSelectSearchSchema(z.enum(["ACTIVE"]));

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });

  it("accepts null equality conditions used by empty date filters", () => {
    const schema = createDataFilterDateSearchSchema();

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });
});
