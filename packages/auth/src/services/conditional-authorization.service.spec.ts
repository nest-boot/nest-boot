/* eslint-disable @typescript-eslint/unbound-method */
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { createWorkspaceServices } from "../../test/workspace-service.fixture.js";
import { AuthAbility } from "../abilities/auth.ability.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { SessionService } from "./session.service.js";
import { UserService } from "./user.service.js";
import { UserApiKeyService } from "./user-api-key.service.js";
import { WorkspaceApiKeyService } from "./workspace-api-key.service.js";

describe("conditional service authorization", () => {
  it.each(["member", "workspace"] as const)(
    "checks current %s reads against the context instance",
    async (kind) => {
      await withIdentity(({ memberService, workspaceService }) => {
        const entity =
          kind === "member"
            ? RequestContext.get(Member)
            : RequestContext.get(Workspace);
        if (!entity) throw new Error("Missing test identity");
        const read = () =>
          kind === "member"
            ? memberService.getCurrentMember()
            : workspaceService.getCurrentWorkspace();
        expect(read()).toBe(entity);
        entity.id = "blocked";
        expect(() => read()).toThrow(ForbiddenException);
        entity.id = "allowed";
        RequestContext.set(
          AuthAbility,
          new AuthAbility([
            {
              action: "read",
              subject: kind === "member" ? "Member" : "Workspace",
              inverted: true,
            },
          ]),
        );
        expect(() => read()).toThrow(ForbiddenException);
        RequestContext.set(AuthAbility, null);
        expect(() => read()).toThrow(ForbiddenException);
        RequestContext.set(Member, null);
        RequestContext.set(Workspace, null);
        expect(read()).toBeNull();
      });
    },
  );

  it("does not require current-member read ability to remove another member", async () => {
    await withIdentity(async ({ memberService, workspace, em }) => {
      const actor = RequestContext.get(Member);
      if (!actor) throw new Error("Missing test member");
      actor.id = "blocked";
      const target = Object.assign(new Member(), {
        id: "target",
        workspace,
        roles: ["member"],
        status: "ACTIVE",
      });
      em.findOne.mockResolvedValue(target);
      await expect(memberService.removeMember(target)).resolves.toBe(target);
      expect(() => memberService.getCurrentMember()).toThrow(
        ForbiddenException,
      );
    });
  });

  it.each(["accept", "reject"] as const)(
    "checks the loaded invitation recipient before %s",
    async (operation) => {
      await withIdentity(async (fixture) => {
        const { invitationService, em, user, workspace } = fixture;
        const invitation = Object.assign(new Invitation(), {
          id: "blocked",
          workspace,
          email: "another-recipient@example.com",
          status: "pending",
          expiresAt: new Date(Date.now() + 60000),
          roles: ["member"],
        });
        em.findOne.mockImplementation((Entity: unknown) =>
          Promise.resolve(Entity === Invitation ? invitation : null),
        );
        await expect(
          operation === "accept"
            ? invitationService.acceptInvitation(user, invitation.id)
            : invitationService.rejectInvitation(user, invitation.id),
        ).rejects.toThrow(ForbiddenException);
        expect(invitation.status).toBe("pending");
        expect(em.persist).not.toHaveBeenCalled();
        expect(em.nativeUpdate).not.toHaveBeenCalled();
      });
    },
  );

  it.each([
    "member",
    "user-invitation",
    "workspace-invitation",
    "workspace",
  ] as const)(
    "enforces the ownership or ability boundary for a single %s read",
    async (kind) => {
      await withIdentity(
        async ({
          memberService,
          invitationService,
          workspaceService,
          em,
          user,
          workspace,
        }) => {
          const entity = Object.assign(
            kind === "member"
              ? new Member()
              : kind === "workspace"
                ? new Workspace()
                : new Invitation(),
            { id: "blocked", workspace, email: user.email },
          );
          em.findOne.mockResolvedValue(entity);
          const read = () =>
            kind === "member"
              ? memberService.getMember(entity.id)
              : kind === "workspace"
                ? workspaceService.findOne({ id: entity.id })
                : kind === "user-invitation"
                  ? invitationService.getInvitationByUser(entity.id, user)
                  : invitationService.getInvitationByWorkspace(
                      entity.id,
                      workspace,
                    );
          if (kind === "user-invitation") {
            await expect(read()).resolves.toBe(entity);
            expect(em.findOne).toHaveBeenLastCalledWith(Invitation, {
              id: entity.id,
              email: user.email.toLowerCase(),
            });
          } else {
            await expect(read()).rejects.toThrow(ForbiddenException);
          }
          em.findOne.mockResolvedValue(null);
          await expect(read()).resolves.toBeNull();
        },
      );
    },
  );

  it.each([
    "member",
    "user-invitation",
    "workspace-invitation",
    "user",
    "workspace",
    "session",
  ] as const)(
    "uses the ownership or instance-ability boundary for %s connections",
    async (kind) => {
      await withIdentity(
        async ({
          memberService,
          invitationService,
          workspaceService,
          userService,
          sessionService,
          user,
          workspace,
        }) => {
          const Entity =
            kind === "member"
              ? Member
              : kind === "user"
                ? User
                : kind === "workspace"
                  ? Workspace
                  : kind === "session"
                    ? Session
                    : Invitation;
          const node = Object.assign(new Entity(), { id: "allowed" });
          const result = {
            edges: [{ node, cursor: "cursor" }],
            pageInfo: { hasNextPage: true },
            totalCount: 2,
          };
          vi.spyOn(ConnectionManager.prototype, "find").mockResolvedValue(
            result as never,
          );
          const read = () =>
            kind === "member"
              ? memberService.getMemberConnectionByWorkspace(workspace, {
                  first: 1,
                })
              : kind === "user"
                ? userService.getUserConnection({ first: 1 })
                : kind === "workspace"
                  ? workspaceService.getWorkspaceConnectionByUser(user, {
                      first: 1,
                    })
                  : kind === "session"
                    ? sessionService.getSessionConnectionByUser(
                        Object.assign(new User(), { id: "other" }),
                        { first: 1 },
                      )
                    : kind === "user-invitation"
                      ? invitationService.getInvitationConnectionByUser(user, {
                          first: 1,
                        })
                      : invitationService.getInvitationConnectionByWorkspace(
                          workspace,
                          { first: 1 },
                        );
          await expect(read()).resolves.toBe(result);
          node.id = "blocked";
          if (kind === "workspace") {
            await expect(read()).resolves.toBe(result);
            expect(ConnectionManager.prototype.find).toHaveBeenLastCalledWith(
              expect.anything(),
              { first: 1 },
              expect.objectContaining({
                where: expect.objectContaining({ id: expect.anything() }),
              }),
            );
          } else if (kind === "user-invitation") {
            await expect(read()).resolves.toBe(result);
            expect(ConnectionManager.prototype.find).toHaveBeenLastCalledWith(
              expect.anything(),
              { first: 1 },
              expect.objectContaining({
                where: expect.objectContaining({
                  email: user.email.toLowerCase(),
                  status: "pending",
                }),
              }),
            );
          } else {
            await expect(read()).rejects.toThrow(ForbiddenException);
          }
          expect(result.edges).toHaveLength(1);
          expect(result.totalCount).toBe(2);
        },
      );
    },
  );

  it.each(["one", "all"] as const)(
    "checks every session before administrative %s revocation",
    async (scope) => {
      await withIdentity(async ({ em, user, sessionService }) => {
        const allowed = Object.assign(new Session(), { id: "allowed", user });
        const blocked = Object.assign(new Session(), { id: "blocked", user });
        em.findOne.mockResolvedValue(blocked);
        em.find.mockResolvedValue([allowed, blocked]);
        const revoke = () =>
          scope === "one"
            ? sessionService.revokeSession(user, blocked.id)
            : sessionService.revokeUserSessions(user);
        await expect(revoke()).rejects.toThrow(ForbiddenException);
        expect(em.nativeDelete).not.toHaveBeenCalled();
        expect(em.remove).not.toHaveBeenCalled();
        expect(em.flush).not.toHaveBeenCalled();
      });
    },
  );

  it.each([
    "user",
    "workspace",
    "member",
    "invitation",
    "user-key",
    "workspace-key",
  ] as const)("checks proposed %s fields before creation", async (kind) => {
    await withIdentity(
      async ({
        em,
        user,
        workspace,
        memberService,
        invitationService,
        workspaceService,
        userService,
        userApiKeyService,
        workspaceApiKeyService,
      }) => {
        em.findOne.mockResolvedValue(null);
        const create = () =>
          kind === "user"
            ? userService.createUser({
                name: "blocked",
                email: "new@example.com",
                password: "valid-password",
              })
            : kind === "workspace"
              ? workspaceService.createWorkspace(user, { name: "blocked" })
              : kind === "member"
                ? memberService.addMember(
                    workspace,
                    Object.assign(new User(), {
                      id: "invitee",
                      name: "blocked",
                      email: "new@example.com",
                    }),
                  )
                : kind === "invitation"
                  ? invitationService.createInvitation(workspace, user, {
                      email: "blocked@example.com",
                    })
                  : kind === "user-key"
                    ? userApiKeyService.createUserApiKey(user, {
                        name: "blocked",
                      })
                    : workspaceApiKeyService.createWorkspaceApiKey(workspace, {
                        name: "blocked",
                      });
        await expect(create()).rejects.toThrow(ForbiddenException);
        expect(em.persist).not.toHaveBeenCalled();
      },
    );
  });
});

async function withIdentity(
  callback: (context: ReturnType<typeof fixture>) => void | Promise<void>,
) {
  const data = fixture();
  await RequestContext.run(new RequestContext({ type: "test" }), async () => {
    RequestContext.set(User, data.user);
    RequestContext.set(Workspace, data.workspace);
    RequestContext.set(
      Member,
      Object.assign(new Member(), {
        id: "member",
        workspace: data.workspace,
        status: "ACTIVE",
      }),
    );
    const rules = [
      { action: "manage", subject: "all" },
      {
        action: ["read", "write", "update", "revoke"],
        subject: ["User", "Workspace", "Member", "Invitation", "Session"],
        inverted: true,
        conditions: { id: "blocked" },
      },
      {
        action: ["create", "write"],
        subject: [
          "User",
          "Workspace",
          "Member",
          "UserApiKey",
          "WorkspaceApiKey",
        ],
        inverted: true,
        conditions: { name: "blocked" },
      },
      {
        action: "write",
        subject: "Invitation",
        inverted: true,
        conditions: { email: "blocked@example.com" },
      },
    ];
    RequestContext.set(AuthAbility, new AuthAbility(rules));
    await callback(data);
  });
}

function fixture() {
  const result = createWorkspaceServices();
  result.authorization.assertCanGrantPermissions.mockRestore();
  result.authorization.assertCan.mockRestore();
  result.authorization.can.mockRestore();
  const query = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    toRaw: vi.fn(),
  };
  Object.assign(result.em, { createQueryBuilder: vi.fn(() => query) });
  const user = Object.assign(new User(), {
    id: "actor",
    name: "Actor",
    email: "actor@example.com",
    roles: ["admin"],
  });
  const workspace = Object.assign(new Workspace(), { id: "workspace" });
  return {
    ...result,
    user,
    workspace,
    userService: new UserService(
      result.em,
      {},
      { hash: vi.fn().mockResolvedValue("hash") } as never,
      {} as never,
    ),
    sessionService: new SessionService({}, result.em),
    userApiKeyService: new UserApiKeyService(result.em, {}),
    workspaceApiKeyService: new WorkspaceApiKeyService(result.em, {}),
  };
}
