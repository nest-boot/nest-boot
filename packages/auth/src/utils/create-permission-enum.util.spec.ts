import { createPermissionEnum } from "./create-permission-enum.util.js";

describe("createPermissionEnum", () => {
  it("preserves permission values and maps GraphQL names", () => {
    expect(
      createPermissionEnum(["api-key:read", "user:set-role", "user:set-role"]),
    ).toEqual({
      API_KEY__READ: "api-key:read",
      USER__SET_ROLE: "user:set-role",
    });
  });
  it.each([
    ["api-key:read", "api_key:read"],
    ["a_:b", "a:_b"],
  ])("rejects colliding permissions %s and %s", (first, second) => {
    expect(() => createPermissionEnum([first, second])).toThrow(
      "Permission enum collision",
    );
  });
});
