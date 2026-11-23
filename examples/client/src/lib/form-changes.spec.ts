import { describe, expect, it } from "vitest";
import { getFormChanges } from "./form-changes";

describe("form changes", () => {
  it("omits untouched identifiers when another field changes", () => {
    expect(
      getFormChanges(
        { name: "Original", username: "old-username" },
        { name: "Renamed", username: "old-username" },
      ),
    ).toEqual({ name: "Renamed" });
  });

  it("keeps explicit clears and false values", () => {
    expect(
      getFormChanges(
        {
          name: "Old",
          email: "old@example.com" as string | null,
          verified: true,
          count: 1,
        },
        { name: "", email: null, verified: false, count: 0 },
      ),
    ).toEqual({ name: "", email: null, verified: false, count: 0 });
  });

  it("does not submit a reverted field", () => {
    expect(getFormChanges({ name: "Original" }, { name: "Original" })).toEqual(
      {},
    );
  });

  it("ignores grant order without changing either array", () => {
    const initial = { name: "Key", permissions: ["READ", "WRITE"] };
    const values = { name: "Key", permissions: ["WRITE", "READ"] };
    expect(
      getFormChanges(initial, values, { setFields: ["permissions"] }),
    ).toEqual({});
    expect(initial.permissions).toEqual(["READ", "WRITE"]);
    expect(values.permissions).toEqual(["WRITE", "READ"]);
    expect(getFormChanges(initial, values)).toEqual({
      permissions: ["WRITE", "READ"],
    });
  });

  it("preserves retired grants when only the key name changes", () => {
    expect(
      getFormChanges(
        { name: "Original", permissions: [] },
        { name: "Renamed", permissions: [] },
        { setFields: ["permissions"] },
      ),
    ).toEqual({ name: "Renamed" });
  });

  it("preserves intentional grant removal, including an empty set", () => {
    const initial = { permissions: ["READ"] };
    expect(
      getFormChanges(
        initial,
        { permissions: [] },
        { setFields: ["permissions"] },
      ),
    ).toEqual({ permissions: [] });
    expect(
      getFormChanges(
        initial,
        { permissions: ["WRITE"] },
        { setFields: ["permissions"] },
      ),
    ).toEqual({ permissions: ["WRITE"] });
  });
});
