import { t } from "@mikro-orm/core";

import { User } from "../../core/entities/user.entity.js";
import { Invitation } from "./invitation.entity.js";
import { createInvitationSchema } from "./invitation.entity-schema.js";
import { Workspace } from "./workspace.entity.js";

describe("entity metadata", () => {
  describe("built-in auth entity field ownership", () => {
    it.each([
      [Invitation, "inviter", User, { deleteRule: "cascade" }],
      [Invitation, "workspace", Workspace, { deleteRule: "cascade" }],
    ] as const)(
      "%s.%s targets the built-in class",
      (entity, field, target, options) => {
        const metadata = [createInvitationSchema().init().meta];
        const property = Object.values(
          metadata.find((meta) => meta.class === entity)?.properties ?? {},
        ).find((property) => property.name === field);
        expect(property).toMatchObject(options);
        expect(property?.cascade ?? []).not.toContain("remove");
        if (typeof property?.entity !== "function") {
          throw new Error("Missing class relation");
        }
        expect(property.entity()).toBe(target);
      },
    );
  });
});

describe("invitation column types", () => {
  it("keeps role and permission columns as arrays, independent of GraphQL enums", () => {
    const metadata = createInvitationSchema().init().meta;
    for (const field of ["roles"]) {
      expect(
        Object.values(metadata?.properties ?? {}).find(
          (property) => property.name === field,
        )?.type,
      ).toBe(t.array);
    }
  });
});
