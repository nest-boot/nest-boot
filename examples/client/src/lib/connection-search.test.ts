import { describe, expect, it } from "vitest";
import z from "zod";

import {
  createDateFilterItemSearchSchema,
  createInputFilterItemSearchSchema,
  createSelectFilterItemSearchSchema,
} from "./connection-search";

describe("connection filter search schemas", () => {
  it("accepts null equality conditions used by empty input filters", () => {
    const schema = createInputFilterItemSearchSchema(z.string().max(255), {
      fulltext: true,
    });

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });

  it("accepts null equality conditions used by empty select filters", () => {
    const schema = createSelectFilterItemSearchSchema(z.enum(["ACTIVE"]));

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });

  it("accepts null equality conditions used by empty date filters", () => {
    const schema = createDateFilterItemSearchSchema();

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });
});
