// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFormChanges } from "./use-form-changes";

afterEach(cleanup);

describe("form change baseline", () => {
  it("keeps the loaded baseline when a refetch changes the props", () => {
    const { result, rerender } = renderHook(
      (initial) => useFormChanges(initial),
      { initialProps: { name: "Original", username: "old-username" } },
    );
    rerender({ name: "Server update", username: "new-username" });
    expect(result.current.defaultValues.username).toBe("old-username");
    expect(
      result.current.getChanges({ name: "Draft", username: "old-username" }),
    ).toEqual({ name: "Draft" });
  });

  it("advances the baseline only when the save is accepted", () => {
    const { result } = renderHook(() =>
      useFormChanges(
        { name: "Original", permissions: ["READ"] },
        { setFields: ["permissions"] },
      ),
    );
    const saved = { name: "Saved", permissions: ["READ", "WRITE"] };
    expect(result.current.getChanges(saved)).toEqual(saved);
    act(() => result.current.accept(saved));
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
