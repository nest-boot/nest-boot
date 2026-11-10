import { type PolicyCallback } from "@mikro-orm/pglite";

import { softDeletePolicies as exportedPolicies } from "../index.js";
import { softDeletePolicies } from "./soft-delete.policies.js";

describe("softDeletePolicies", () => {
  it("is exported from the package entry point", () => {
    expect(exportedPolicies).toBe(softDeletePolicies);
  });
  it("uses native restrictive policies without granting a database role", () => {
    expect(softDeletePolicies()).toEqual([
      {
        type: "restrictive",
        command: "all",
        using: expect.any(Function),
        check: expect.any(Function),
      },
      {
        type: "restrictive",
        command: "delete",
        using: expect.any(Function),
      },
    ]);
  });
  it("defaults to deletedAt and supports a custom mapped property", () => {
    const resolve = (property?: string) =>
      softDeletePolicies({ property })[0].using as PolicyCallback<
        Record<string, unknown>
      >;
    expect(resolve()({ deletedAt: "deleted_at" } as never, {} as never)).toBe(
      '"deleted_at" is null',
    );
    expect(
      resolve("removedOn")({ removedOn: 'Removed"Date' } as never, {} as never),
    ).toBe('"Removed""Date" is null');
    expect(() => softDeletePolicies({ property: "" })).toThrow(/property/i);
    expect(() => resolve()({}, {} as never)).toThrow(/mapped column/i);
    expect(() => resolve("constructor")({}, {} as never)).toThrow(
      /mapped column/i,
    );
    expect(softDeletePolicies()).not.toBe(softDeletePolicies());
  });
});
