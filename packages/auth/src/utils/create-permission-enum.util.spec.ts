import { createPermissionEnum } from "./create-permission-enum.util.js";

describe("createPermissionEnum", () => {
  it("preserves permission values and maps GraphQL names", () => {
    expect(
      createPermissionEnum([
        "user-api-key:read",
        "user:set-roles",
        "user:set-roles",
      ]),
    ).toEqual({
      USER_API_KEY__READ: "user-api-key:read",
      USER__SET_ROLES: "user:set-roles",
    });
  });
  it.each([
    ["user-api-key:read", "user_api_key:read"],
    ["a_:b", "a:_b"],
  ])("rejects colliding permissions %s and %s", (first, second) => {
    expect(() => createPermissionEnum([first, second])).toThrow(
      "Permission enum collision",
    );
  });
});
