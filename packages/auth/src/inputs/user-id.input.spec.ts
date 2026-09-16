import { validateSync } from "class-validator";

import { UserIdInput } from "./user.input.js";

describe("UserIdInput", () => {
  it("accepts id as the target identifier", () => {
    expect(
      validateSync(Object.assign(new UserIdInput(), { id: "user-1" })),
    ).toEqual([]);
  });

  it("does not accept userId in place of id", () => {
    expect(
      validateSync(Object.assign(new UserIdInput(), { userId: "user-1" })),
    ).toEqual([
      expect.objectContaining({
        property: "id",
        constraints: { isString: expect.any(String) },
      }),
    ]);
  });
});
