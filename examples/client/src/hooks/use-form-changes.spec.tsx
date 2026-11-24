// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFormChanges } from "./use-form-changes";

afterEach(cleanup);

describe("form change baseline", () => {
  it("keeps the loaded baseline when a refetch changes the props", () => {
    const { result, rerender } = renderHook(
      (initial) => useFormChanges(initial, { revision: 0 }),
      { initialProps: { name: "Original", slug: "old-slug" } },
    );
    rerender({ name: "Server update", slug: "new-slug" });
    expect(result.current.defaultValues.slug).toBe("old-slug");
    expect(
      result.current.getChanges({ name: "Draft", slug: "old-slug" }),
    ).toEqual({ name: "Draft" });
  });

  it("advances the baseline only when the save is accepted", () => {
    const { result } = renderHook(() =>
      useFormChanges(
        { name: "Original", permissions: ["READ"] },
        { revision: 0, setFields: ["permissions"] },
      ),
    );
    const saved = { name: "Saved", permissions: ["READ", "WRITE"] };
    expect(result.current.getChanges(saved)).toEqual(saved);
    act(() => {
      result.current.accept(saved);
      expect(result.current.getChanges(saved)).toEqual({});
    });
    saved.permissions.push("OTHER");
    expect(
      result.current.getChanges({
        name: "Saved",
        permissions: ["WRITE", "READ"],
      }),
    ).toEqual({});
    expect(
      result.current.getChanges({
        name: "Next",
        permissions: ["READ", "WRITE"],
      }),
    ).toEqual({ name: "Next" });
  });
});
