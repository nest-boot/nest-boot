import { toZodSchema } from "@nest-boot/validator";

import { UserIdInput } from "./user-id.input.js";

describe("UserIdInput", () => {
  it("accepts id as the target identifier", () => {
    expect(toZodSchema(UserIdInput).parse({ id: "user-1" })).toEqual({
      id: "user-1",
    });
  });

  it("does not accept userId in place of id", () => {
    expect(
      toZodSchema(UserIdInput).safeParse({ userId: "user-1" }).error?.issues,
    ).toEqual([
      expect.objectContaining({
        path: ["id"],
        code: "invalid_type",
        expected: "string",
      }),
    ]);
  });
});
