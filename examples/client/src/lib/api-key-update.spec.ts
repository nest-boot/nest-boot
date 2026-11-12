import { describe, expect, it } from "vitest";

import { getApiKeyUpdateInput } from "./api-key-update";

describe("API-key edits", () => {
  it("omits an unchanged empty projection so renaming a retired-only key cannot make it unrestricted", () => {
    expect(
      getApiKeyUpdateInput(
        { name: "Original", permissions: [] },
        { name: "Renamed", permissions: [] },
      ),
    ).toEqual({ name: "Renamed" });
  });

  it("does not replace stored grants merely because the editor changed their order", () => {
    const current = { name: "Key", permissions: ["READ", "WRITE"] };
    const input = { name: "Key", permissions: ["WRITE", "READ"] };
    expect(getApiKeyUpdateInput(current, input)).toEqual({});
    expect(current.permissions).toEqual(["READ", "WRITE"]);
    expect(input.permissions).toEqual(["WRITE", "READ"]);
  });

  it("retains an intentional permission removal, including an explicitly empty array", () => {
    const current = { name: "Key", permissions: ["READ"] };
    expect(
      getApiKeyUpdateInput(current, { name: "Key", permissions: [] }),
    ).toEqual({ permissions: [] });
    expect(
      getApiKeyUpdateInput(current, { name: "Key", permissions: ["WRITE"] }),
    ).toEqual({ permissions: ["WRITE"] });
  });
});
