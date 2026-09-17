/* eslint-disable @typescript-eslint/unbound-method */
import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  createTestMember,
  createTestUser,
  createTestWorkspace,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AccessControlService } from "./access-control.service.js";
import { MemberService } from "./member.service.js";

describe("MemberService direct permission authorization", () => {
  const permissions = ["member:update", "workspace:update", "workspace:delete"];
  const options = {
    workspace: {
      permissions,
      creatorRole: "founder",
      roles: {
        founder: permissions,
        admin: ["member:update", "workspace:update"],
        custom: [],
      },
    },
  };

  it.each([
    {
      role: "admin",
      direct: [],
      key: undefined,
      expected: ["admin", "custom"],
    },
    {
      role: "custom",
      direct: permissions,
      key: undefined,
      expected: ["founder", "admin", "custom"],
    },
    { role: "founder", direct: [], key: "user", expected: ["custom"] },
    {
      role: "founder",
      direct: [],
      key: "workspace",
      expected: ["admin", "custom"],
    },
  ])(
    "lists assignable roles for $role with key=$key",
    async ({ role, direct, key, expected }) => {
      const { em } = createWorkspaceServices();
      const access = new AccessControlService(options);
      const service = new MemberService(em, options, access);
      const workspace = createTestWorkspace();
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        if (key !== "workspace")
          RequestContext.set(
            Member,
            Object.assign(createTestMember(), {
              roles: [role],
              permissions: direct,
            }),
          );
        if (key)
          RequestContext.set(
            ApiKey,
            Object.assign(new ApiKey(), {
              user: key === "user" ? ref(User, createTestUser()) : null,
              workspace: key === "workspace" ? ref(Workspace, workspace) : null,
              permissions:
                key === "user"
                  ? ["member:update"]
                  : ["member:update", "workspace:update"],
            }),
          );
        RequestContext.set(
          WorkspaceAbility,
          new WorkspaceAbility([{ action: "create", subject: Invitation }]),
        );
        expect(service.listAssignableRoles().map(({ name }) => name)).toEqual(
          expected,
        );
        for (const { permissions: grants } of service.listAssignableRoles()) {
          expect(() => {
            access.assertCanGrantWorkspacePermissions(grants);
          }).not.toThrow();
        }
        RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
        expect(service.listAssignableRoles()).toEqual([]);
      });
    },
  );

  it.each([
    {
      name: "administrator",
      role: "admin",
      canUpdate: true,
      grant: "workspace:update",
      allowed: true,
    },
    {
      name: "custom role with direct grants",
      role: "custom",
      canUpdate: true,
      grant: "workspace:update",
      allowed: true,
    },
    {
      name: "creator without update ability",
      role: "founder",
      canUpdate: false,
      grant: "workspace:update",
      allowed: false,
    },
    {
      name: "administrator exceeding the grant ceiling",
      role: "admin",
      canUpdate: true,
      grant: "workspace:delete",
      allowed: false,
    },
    {
      name: "personal API key with narrower grants",
      role: "admin",
      canUpdate: true,
      grant: "workspace:update",
      key: "user",
      allowed: false,
    },
    {
      name: "workspace API key within its grants",
      role: "admin",
      canUpdate: true,
      grant: "workspace:update",
      key: "workspace",
      allowed: true,
    },
    {
      name: "workspace API key exceeding its grants",
      role: "admin",
      canUpdate: true,
      grant: "workspace:delete",
      key: "workspace",
      allowed: false,
    },
  ])(
    "checks $name using ability and the credential grant ceiling",
    async (scenario) => {
      const { em } = createWorkspaceServices();
      const service = new MemberService(
        em,
        options,
        new AccessControlService(options),
      );
      const workspace = createTestWorkspace();
      const target = Object.assign(createTestMember(), {
        workspace: ref(Workspace, workspace),
      });
      em.findOne.mockResolvedValue(target);
      const actor = Object.assign(createTestMember(), {
        id: "actor",
        workspace: ref(Workspace, workspace),
        roles: [scenario.role],
        permissions:
          scenario.role === "custom"
            ? ["member:update", "workspace:update"]
            : [],
      });

      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(Workspace, workspace);
          if (scenario.key !== "workspace") RequestContext.set(Member, actor);
          if (scenario.key) {
            RequestContext.set(
              ApiKey,
              Object.assign(new ApiKey(), {
                user:
                  scenario.key === "user" ? ref(User, createTestUser()) : null,
                workspace:
                  scenario.key === "workspace"
                    ? ref(Workspace, workspace)
                    : null,
                permissions:
                  scenario.key === "workspace"
                    ? ["member:update", "workspace:update"]
                    : ["member:update"],
              }),
            );
          }
          RequestContext.set(
            WorkspaceAbility,
            new WorkspaceAbility(
              scenario.canUpdate ? [{ action: "update", subject: Member }] : [],
            ),
          );
          const operation = service.setMemberPermissions(target, [
            scenario.grant,
          ]);
          if (scenario.allowed) {
            await expect(operation).resolves.toBe(target);
            expect(target.permissions).toEqual([scenario.grant]);
            expect(em.flush).toHaveBeenCalledOnce();
          } else {
            await expect(operation).rejects.toBeInstanceOf(ForbiddenException);
            expect(target.permissions).toEqual([]);
            expect(em.flush).not.toHaveBeenCalled();
          }
          expect(em.fork).not.toHaveBeenCalled();
        },
      );
    },
  );
});
