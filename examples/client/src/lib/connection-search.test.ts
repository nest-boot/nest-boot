import { describe, expect, it } from "vitest";
import z from "zod";

import {
  createDateFilterSearchSchema,
  createInputFilterSearchSchema,
  createSelectFilterSearchSchema,
} from "./connection-search";

describe("connection filter search schemas", () => {
  it("accepts null equality conditions used by empty input filters", () => {
    const schema = createInputFilterSearchSchema(z.string().max(255), {
      fulltext: true,
    });

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });

  it("accepts null equality conditions used by empty select filters", () => {
    const schema = createSelectFilterSearchSchema(z.enum(["ACTIVE"]));

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });

  it("accepts null equality conditions used by empty date filters", () => {
    const schema = createDateFilterSearchSchema();

    expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
    expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
  });
});
