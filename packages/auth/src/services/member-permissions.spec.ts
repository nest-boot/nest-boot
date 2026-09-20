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
import { AuthAbility } from "../abilities/auth.ability.js";
import { API_KEY } from "../auth.constants.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace.constants.js";
import { AccessControlService } from "./access-control.service.js";
import { MemberService } from "./member.service.js";

describe("MemberService direct permission authorization", () => {
  const permissions = ["member:write", "workspace:update", "workspace:delete"];
  const options = {
    workspace: {
      permissions,
      creatorRole: "founder",
      roles: {
        founder: permissions,
        admin: ["member:write", "workspace:update"],
        custom: [],
      },
    },
  };

  it.each([
    {
      role: "admin",
      direct: [],
      key: undefined,
      expected: ["admin", "member", "custom"],
    },
    {
      role: "custom",
      direct: permissions,
      key: undefined,
      expected: ["founder", "custom"],
    },
    {
      role: "founder",
      direct: [],
      key: "user",
      expected: ["custom"],
    },
    {
      role: "founder",
      direct: [],
      key: "workspace",
      expected: ["custom"],
    },
  ])(
    "lists grantable roles for $role with key=$key",
    async ({ role, direct, key, expected }) => {
      const { em } = createWorkspaceServices();
      const access = new AccessControlService(options);
      const service = new MemberService(em, options, access);
      const workspace = createTestWorkspace();
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        RequestContext.set(User, createTestUser());
        RequestContext.set(Workspace, workspace);
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
            API_KEY,
            Object.assign(
              key === "user" ? new UserApiKey() : new WorkspaceApiKey(),
              {
                user: key === "user" ? ref(User, createTestUser()) : null,
                workspace:
                  key === "workspace" ? ref(Workspace, workspace) : null,
                permissions:
                  key === "user"
                    ? ["member:write"]
                    : ["member:write", "workspace:update"],
              },
            ),
          );
        RequestContext.set(
          AuthAbility,
          new AuthAbility([{ action: "write", subject: Invitation }]),
        );
        expect(service.listRoles()).toEqual(
          ["owner", "admin", "member", "founder", "custom"].map((role) => ({
            role,
            grantable: expected.includes(role),
          })),
        );
        for (const { role } of service
          .listRoles()
          .filter(({ grantable }) => grantable)) {
          const grants =
            role in DEFAULT_WORKSPACE_ROLES
              ? DEFAULT_WORKSPACE_ROLES[
                  role as keyof typeof DEFAULT_WORKSPACE_ROLES
                ]
              : options.workspace.roles[
                  role as keyof typeof options.workspace.roles
                ];
          expect(() => {
            access.assertCanGrantWorkspacePermissions(grants);
          }).not.toThrow();
        }
        RequestContext.set(AuthAbility, new AuthAbility());
        expect(() => service.listRoles()).toThrow(ForbiddenException);
        RequestContext.set(
          AuthAbility,
          new AuthAbility([{ action: "read", subject: Member }]),
        );
        expect(service.listRoles().every(({ grantable }) => !grantable)).toBe(
          true,
        );
        expect(service.listPermissions()).toEqual(
          DEFAULT_WORKSPACE_PERMISSIONS.map((permission) => ({
            permission,
            grantable: false,
          })),
        );
        RequestContext.set(
          AuthAbility,
          new AuthAbility([{ action: "set-permissions", subject: Member }]),
        );
        expect(service.listPermissions()).toEqual(
          DEFAULT_WORKSPACE_PERMISSIONS.map((permission) => ({
            permission,
            grantable: access.canGrantWorkspacePermissions([permission]),
          })),
        );
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
            ? ["member:write", "workspace:update"]
            : [],
      });

      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, createTestUser());
          RequestContext.set(Workspace, workspace);
          if (scenario.key !== "workspace") RequestContext.set(Member, actor);
          if (scenario.key) {
            RequestContext.set(
              API_KEY,
              Object.assign(
                scenario.key === "user"
                  ? new UserApiKey()
                  : new WorkspaceApiKey(),
                {
                  user:
                    scenario.key === "user"
                      ? ref(User, createTestUser())
                      : null,
                  workspace:
                    scenario.key === "workspace"
                      ? ref(Workspace, workspace)
                      : null,
                  permissions:
                    scenario.key === "workspace"
                      ? ["member:write", "workspace:update"]
                      : ["member:write"],
                },
              ),
            );
          }
          RequestContext.set(
            AuthAbility,
            new AuthAbility(
              scenario.canUpdate
                ? [{ action: "set-permissions", subject: Member }]
                : [],
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
