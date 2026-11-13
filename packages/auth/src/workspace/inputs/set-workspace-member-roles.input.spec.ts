import "reflect-metadata";

import { toZodSchema } from "@nest-boot/validator";

import { SetWorkspaceMemberRolesInput } from "./set-workspace-member-roles.input.js";

describe("configured validation", () => {
  describe("configurable input validation", () => {
    it("accepts owner role names and leaves grant authorization to the Service", () => {
      const input = Object.assign(new SetWorkspaceMemberRolesInput(), {
        roles: ["owner"],
      });
      expect(
        toZodSchema(SetWorkspaceMemberRolesInput).safeParse(input).success,
      ).toBe(true);
    });
    it.each([[], "owner", [123], undefined])(
      "rejects invalid role list %j",
      (roles) => {
        const input = Object.assign(new SetWorkspaceMemberRolesInput(), {
          roles,
        });
        expect(
          toZodSchema(SetWorkspaceMemberRolesInput).safeParse(input).success,
        ).toBe(false);
      },
    );
  });
});
