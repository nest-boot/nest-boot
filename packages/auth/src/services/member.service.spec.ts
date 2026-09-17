/* eslint-disable @typescript-eslint/unbound-method */
import { LockMode } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import {
  createTestMember,
  createTestUser,
  createTestWorkspace,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { API_KEY } from "../auth.constants.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AccessControlService } from "./access-control.service.js";
import { MemberService } from "./member.service.js";

describe("MemberService", () => {
  it.each([false, true])(
    "rejects a missing member with context present=%s",
    async (present) => {
      const { em } = createWorkspaceServices();
      const service = new MemberService(em, {}, new AccessControlService({}));
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          if (present) RequestContext.set(Member, createTestMember());
          await expect(
            service.leaveWorkspace(undefined as unknown as Member),
          ).rejects.toThrow(ForbiddenException);
        },
      );
      expect(em.transactional).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    },
  );
  it("allows the current member to leave without any workspace ability rules", async () => {
    const { em } = createWorkspaceServices();
    const session = mockRlsContext(em);
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestMember(), { workspace });
    const lockedMember = Object.assign(createTestMember(), { workspace });
    const access = new AccessControlService({});
    const service = new MemberService(em, {}, access);
    em.findOne.mockResolvedValue(lockedMember);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, workspace);
      RequestContext.set(Member, member);
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
      expect(access.workspaceCan("read", workspace)).toBe(false);
      await expect(service.leaveWorkspace(member)).resolves.toBe(lockedMember);
    });
    expect(em.findOne).toHaveBeenCalledWith(
      Member,
      { id: member.id, workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.remove).toHaveBeenCalledWith(lockedMember);
    expect(em.flush).toHaveBeenCalledOnce();
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });

  it.each(["workspace", "member", "missing-member"] as const)(
    "rejects leaving with a mismatched %s identity before querying",
    async (mismatch) => {
      const { em } = createWorkspaceServices();
      const workspace = createTestWorkspace();
      const member = Object.assign(createTestMember(), { workspace });
      const service = new MemberService(em, {}, new AccessControlService({}));
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(
            Workspace,
            mismatch === "workspace"
              ? Object.assign(createTestWorkspace(), { id: "other-workspace" })
              : workspace,
          );
          if (mismatch !== "missing-member") {
            RequestContext.set(
              Member,
              mismatch === "member"
                ? Object.assign(createTestMember(), { id: "other-member" })
                : member,
            );
          }
          await expect(service.leaveWorkspace(member)).rejects.toThrow(
            ForbiddenException,
          );
        },
      );
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    },
  );

  it("does not bypass RLS when the departing member cannot be loaded", async () => {
    const { em } = createWorkspaceServices();
    const session = mockRlsContext(em);
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestMember(), { workspace });
    const service = new MemberService(em, {}, new AccessControlService({}));
    em.findOne.mockResolvedValue(null);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, workspace);
      RequestContext.set(Member, member);
      await expect(service.leaveWorkspace(member)).rejects.toThrow(
        "Workspace member not found",
      );
    });
    expect(em.remove).not.toHaveBeenCalled();
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
  });

  it.each(["disable", "remove", "leave"] as const)(
    "allows an authorized owner to %s without a role exception",
    async (operation) => {
      const { memberService, em } = createWorkspaceServices();
      const member = Object.assign(createTestMember(), { roles: ["owner"] });
      em.findOne.mockResolvedValue(member);
      const result =
        operation === "disable"
          ? memberService.updateMember(member, { status: "DISABLED" })
          : operation === "remove"
            ? memberService.removeMember(member)
            : memberService.leaveWorkspace(member);
      await expect(result).resolves.toBe(member);
      expect(em.flush).toHaveBeenCalledOnce();
    },
  );
  it("loads member users with Service checks and the injected RLS manager", async () => {
    const { memberService, em, accessControlService } =
      createWorkspaceServices();
    const session = mockRlsContext(em);
    const user = Object.assign(createTestUser(), { id: "user-1" });
    const member = Object.assign(createTestMember(), {
      user: { id: user.id, loadOrFail: vi.fn() },
    });
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(user);
    await expect(memberService.getMemberUser(member)).resolves.toBe(user);
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      member.workspace,
    );
    expect(accessControlService.assertUserCan).toHaveBeenCalledWith(
      "read",
      User,
    );
    expect(em.findOne).toHaveBeenLastCalledWith(
      User,
      { id: user.id },
      { refresh: true },
    );
    expect(member.user.loadOrFail).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(session);
    expect(em.fork).not.toHaveBeenCalled();
    vi.mocked(accessControlService.assertUserCan).mockImplementation(() => {
      throw new ForbiddenException();
    });
    em.findOne.mockClear();
    await expect(memberService.getMemberUser(member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("reads the browser user's own member association without selecting a workspace", async () => {
    const { memberService, em, accessControlService } =
      createWorkspaceServices();
    const user = Object.assign(createTestUser(), { id: "self" });
    const member = Object.assign(createTestMember(), {
      user: { id: user.id },
    });
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(user);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(User, user);
      await expect(memberService.getMemberUser(member)).resolves.toBe(user);
      expect(em.findOne).toHaveBeenCalledWith(
        Member,
        { id: member.id, workspace: member.workspace, user: user.id },
        { refresh: true },
      );
      expect(
        accessControlService.assertCurrentWorkspace,
      ).not.toHaveBeenCalled();
      expect(accessControlService.assertWorkspaceCan).not.toHaveBeenCalled();
      RequestContext.set(API_KEY, new WorkspaceApiKey());
      RequestContext.set(
        User,
        Object.assign(createTestUser(), { id: "other" }),
      );
      vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
        () => {
          throw new ForbiddenException();
        },
      );
      await expect(memberService.getMemberUser(member)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  it("returns null for absent member users and rows hidden by RLS", async () => {
    const { memberService, em } = createWorkspaceServices();
    const member = createTestMember();
    em.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(null);
    await expect(memberService.getMemberUser(member)).resolves.toBeNull();
    await expect(memberService.getMemberUser(member)).resolves.toBeNull();
    expect(em.findOne).toHaveBeenCalledTimes(2);
  });

  it("reads members with the scoped manager", async () => {
    const { memberService, em } = createWorkspaceServices();
    const context = mockRlsContext(em);
    em.findOne.mockResolvedValue(null);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, createTestWorkspace());
      await expect(memberService.getMember("hidden")).resolves.toBeNull();
    });
    expect(em.fork).not.toHaveBeenCalled();
    expect(em.getSessionContext()).toEqual(context);
  });

  it("authorizes member pagination before returning the selected workspace filter", () => {
    const { memberService, accessControlService, em } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    expect(memberService.getMemberListFilter(workspace)).toEqual({
      workspace,
    });
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      Member,
    );
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    expect(() => memberService.getMemberListFilter(workspace)).toThrow(
      ForbiddenException,
    );
    expect(em.find).not.toHaveBeenCalled();
  });

  it("rejects member reads without a request context before querying", async () => {
    const { memberService, em } = createWorkspaceServices();
    await expect(memberService.getMember("member-1")).rejects.toThrow(
      ForbiddenException,
    );
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("rejects member reads without a selected workspace before querying", async () => {
    const { memberService, em } = createWorkspaceServices();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await expect(memberService.getMember("member-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("checks workspace read ability before querying a member", async () => {
    const { memberService, em, accessControlService } =
      createWorkspaceServices();
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, createTestWorkspace());
      await expect(memberService.getMember("member-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("does not reuse a previous request's workspace for member reads", async () => {
    const { memberService, em } = createWorkspaceServices();
    for (const id of ["workspace-1", "workspace-2"]) {
      const workspace = Object.assign(createTestWorkspace(), { id });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(Workspace, workspace);
          await memberService.getMember("member-1");
          expect(em.findOne).toHaveBeenLastCalledWith(Member, {
            id: "member-1",
            workspace,
          });
        },
      );
    }
  });

  it("enforces self-removal rules without a resolver", async () => {
    const { memberService, em } = createWorkspaceServices();
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const actor = Object.assign(createTestMember(), {
        id: "actor",
        roles: ["admin"],
      });
      RequestContext.set(Member, actor);
      await expect(memberService.removeMember(actor)).rejects.toThrow(
        "You are not allowed to remove yourself",
      );
      expect(em.flush).not.toHaveBeenCalled();
    });
  });

  it("assigns and replaces the configured creator role through ordinary role updates", async () => {
    const { memberService, em } = createWorkspaceServices({
      creatorRole: "founder",
      roles: { founder: [], owner: [], member: [] },
    });
    const target = createTestMember();
    em.findOne.mockResolvedValue(target);

    await expect(
      memberService.setMemberRoles(target, ["founder"]),
    ).resolves.toBe(target);
    expect(target.roles).toEqual(["founder"]);

    await expect(memberService.setMemberRoles(target, ["owner"])).resolves.toBe(
      target,
    );
    expect(target.roles).toEqual(["owner"]);
  });

  it("does not require the configured creator role for direct permission changes", async () => {
    const { memberService, em } = createWorkspaceServices({
      creatorRole: "founder",
    });
    const target = createTestMember();
    em.findOne.mockResolvedValue(target);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(
        Member,
        Object.assign(createTestMember(), {
          id: "actor",
          roles: ["admin"],
        }),
      );
      await expect(
        memberService.setMemberPermissions(target, []),
      ).resolves.toBe(target);
    });
  });

  it("cancels pending invitations in the same transaction when adding a member", async () => {
    const { em, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "ALICE@example.com",
      name: "Alice",
    });
    await memberService.addMember(workspace, user);
    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(em.refreshOrFail).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        filters: false,
        lockMode: LockMode.PESSIMISTIC_WRITE,
      }),
    );
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      Invitation,
      { workspace, email: "alice@example.com", status: "pending" },
      { status: "canceled" },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a member by normalized email inside the workspace permission boundary", async () => {
    const { accessControlService, em, memberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
      name: "Alice",
    });
    em.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

    await expect(
      memberService.addMemberByEmail(workspace, " Alice@Example.com "),
    ).resolves.toEqual(expect.objectContaining({ user, workspace }));

    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      User,
      { email: "alice@example.com" },
      { filters: false },
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "create",
      Member,
    );
  });

  it("rejects workspace resources outside the selected request context", async () => {
    const { accessControlService, em, memberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    vi.mocked(accessControlService.assertCurrentWorkspace).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      memberService.getMemberConnectionByWorkspace(workspace, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.find).not.toHaveBeenCalled();
  });

  it("adds and updates a workspace member", async () => {
    const { em, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "bob@example.com",
      name: "Bob",
    });
    em.findOne.mockResolvedValue(null);

    const member = await memberService.addMember(workspace, user, {
      permissions: ["workspace:update"],
      roles: ["admin"],
    });
    expect(member).toEqual(
      expect.objectContaining({
        permissions: ["workspace:update"],
        roles: ["admin"],
        user,
        workspace,
      }),
    );

    em.findOne.mockResolvedValue(member);
    await expect(
      memberService.updateMember(member, { status: "DISABLED" }),
    ).resolves.toBe(member);
    expect(member.user).toBe(user);
    expect(member.name).toBe("Bob");
    expect(member.email).toBe("bob@example.com");
    expect(member.status).toBe("DISABLED");
    await expect(
      memberService.updateMember(member, {
        roles: ["member"],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects duplicate members and missing users", async () => {
    const { em, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = Object.assign(createTestUser(), {
      email: "alice@example.com",
    });
    const member = Object.assign(createTestMember(), {
      user,
      workspace,
    });
    em.findOne.mockResolvedValueOnce(member);

    await expect(memberService.addMember(workspace, user)).rejects.toThrow(
      "User is already a member",
    );

    em.findOne.mockReset();
    em.findOne.mockResolvedValueOnce(null);
    await expect(
      memberService.addMemberByEmail(workspace, "missing@example.com"),
    ).rejects.toThrow("User not found");
  });

  it("allows editing owner contact fields through update ability without an owner caller", async () => {
    const { memberService, em, accessControlService } =
      createWorkspaceServices();
    const owner = Object.assign(createTestMember(), { roles: ["owner"] });
    em.findOne.mockResolvedValue(owner);

    await expect(
      memberService.updateMember(owner, {
        name: "Shared owner name",
        email: "shared@example.com",
      }),
    ).resolves.toBe(owner);

    expect(accessControlService.assertWorkspaceCan).toHaveBeenLastCalledWith(
      "update",
      owner,
    );
    expect(accessControlService.assertCurrentMember).not.toHaveBeenCalled();
    expect(owner.roles).toEqual(["owner"]);
    expect(owner.name).toBe("Shared owner name");
    expect(em.flush).toHaveBeenCalledOnce();
  });

  it("does not edit owner contact fields without update ability", async () => {
    const { memberService, em, accessControlService } =
      createWorkspaceServices();
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );

    await expect(
      memberService.updateMember(
        Object.assign(createTestMember(), { roles: ["owner"] }),
        { name: "Denied" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("rechecks update ability under a row lock before disabling a member", async () => {
    const { em, memberService, accessControlService } =
      createWorkspaceServices();
    vi.spyOn(memberService, "getCurrentMember").mockReturnValue(
      Object.assign(createTestMember(), {
        id: "actor",
        roles: ["owner"],
      }),
    );
    const workspace = createTestWorkspace();
    const staleMember = Object.assign(createTestMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedMember = Object.assign(createTestMember(), {
      id: staleMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedMember);
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      (_action, subject) => {
        if (subject === promotedMember) throw new ForbiddenException();
      },
    );

    await expect(
      memberService.updateMember(staleMember, { status: "DISABLED" }),
    ).rejects.toThrow(ForbiddenException);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(em.findOne).toHaveBeenCalledWith(
      Member,
      { id: staleMember.id, workspace },
      {
        lockMode: LockMode.PESSIMISTIC_WRITE,
        refresh: true,
      },
    );
    expect(promotedMember.status).toBe("ACTIVE");
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("rejects updates when the member was removed before acquiring its lock", async () => {
    const { em, memberService } = createWorkspaceServices();
    em.findOne.mockResolvedValue(null);

    await expect(
      memberService.updateMember(createTestMember(), {
        status: "DISABLED",
      }),
    ).rejects.toThrow("Workspace member not found");
    expect(em.assign).not.toHaveBeenCalled();
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("preserves omitted member fields when updating status through a DTO", async () => {
    const { em, memberService } = createWorkspaceServices();
    const member = Object.assign(createTestMember(), {
      roles: ["admin"],
      permissions: ["workspace:update"],
    });
    em.findOne.mockResolvedValue(member);

    await memberService.updateMember(member, {
      status: "DISABLED",
    });

    expect(member.status).toBe("DISABLED");
    expect(member.roles).toEqual(["admin"]);
    expect(member.permissions).toEqual(["workspace:update"]);
    expect(em.assign).toHaveBeenCalledWith(member, { status: "DISABLED" });
  });

  it("edits shared member fields without changing private user fields", async () => {
    const { em, memberService } = createWorkspaceServices();
    const user = Object.assign(createTestUser(), {
      name: "Private name",
      email: "private@example.com",
    });
    const member = Object.assign(createTestMember(), {
      user,
      name: "Old name",
      email: "old@example.com",
    });
    em.findOne.mockResolvedValue(member);
    await memberService.updateMember(member, {
      name: " Shared name ",
      email: " Shared@Example.COM ",
    });
    expect(member.name).toBe("Shared name");
    expect(member.email).toBe("shared@example.com");
    expect(user.name).toBe("Private name");
    expect(user.email).toBe("private@example.com");
    expect(em.assign).toHaveBeenCalledWith(member, {
      name: "Shared name",
      email: "shared@example.com",
    });

    em.findOne.mockResolvedValue(member);
    await memberService.updateMember(member, {
      email: null,
      name: undefined,
    });
    expect(member.email).toBeNull();
    expect(member.name).toBe("Shared name");
    expect(user.email).toBe("private@example.com");
    expect(em.assign).toHaveBeenLastCalledWith(member, { email: null });
  });

  it.each(["", "  ", null])(
    "rejects invalid shared member name %s before persistence",
    async (name) => {
      const { em, memberService } = createWorkspaceServices();
      await expect(
        memberService.updateMember(createTestMember(), {
          name,
        } as never),
      ).rejects.toThrow("Member name must not be empty");
      expect(em.assign).not.toHaveBeenCalled();
      expect(em.flush).not.toHaveBeenCalled();
    },
  );

  it("preserves distinct configured case variants in direct member permissions", async () => {
    const permissions = ["Project:READ", "project:read"];
    const { em, memberService } = createWorkspaceServices({ permissions });
    const member = createTestMember();
    em.findOne.mockResolvedValue(member);
    await memberService.setMemberPermissions(member, permissions);
    expect(member.permissions).toEqual(permissions);
    await expect(
      memberService.setMemberPermissions(member, ["project:READ"]),
    ).rejects.toThrow("contains unknown permissions: project:READ");
  });

  it("allows shared contact emails without querying for duplicates", async () => {
    const { em, memberService } = createWorkspaceServices();
    const member = Object.assign(createTestMember(), {
      email: "old@example.com",
    });
    em.findOne
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce(createTestMember());
    await expect(
      memberService.updateMember(member, {
        email: "occupied@example.com",
      }),
    ).resolves.toBe(member);
    expect(member.email).toBe("occupied@example.com");
    expect(em.findOne).toHaveBeenCalledTimes(1);
    expect(em.assign).toHaveBeenCalledWith(member, {
      email: "occupied@example.com",
    });
    expect(em.flush).toHaveBeenCalledOnce();
  });

  it("authorizes the exact membership email lookup before accessing private users", async () => {
    const { em, memberService, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    em.findOne.mockResolvedValue(user);
    await expect(
      memberService.getUserForMembership(workspace, " Person@Example.COM "),
    ).resolves.toBe(user);
    expect(em.findOne).toHaveBeenCalledWith(
      User,
      { email: "person@example.com" },
      { filters: false },
    );
    em.findOne.mockClear();
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      () => {
        throw new ForbiddenException();
      },
    );
    await expect(
      memberService.getUserForMembership(workspace, "person@example.com"),
    ).rejects.toThrow(ForbiddenException);
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("validates direct member permissions against the workspace catalog", async () => {
    const { accessControlService, em, memberService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const user = createTestUser();
    em.findOne.mockResolvedValue(null);

    await expect(
      memberService.addMember(workspace, user, {
        permissions: ["user:get"],
      }),
    ).rejects.toThrow(
      "Workspace member contains unknown permissions: user:get",
    );

    const member = createTestMember();
    await expect(
      memberService.setMemberPermissions(member, [
        "workspace:update",
        "workspace:update",
      ]),
    ).rejects.toThrow(
      "Workspace member contains duplicate permissions: workspace:update",
    );
    em.findOne.mockResolvedValue(member);
    await expect(
      memberService.setMemberPermissions(member, ["workspace:update"]),
    ).resolves.toBe(member);
    expect(member.permissions).toEqual(["workspace:update"]);
    expect(
      accessControlService.assertCanGrantWorkspacePermissions,
    ).toHaveBeenCalledWith(["workspace:update"]);
  });

  it("reloads detached members in the auth transaction before persisting permissions", async () => {
    const { accessControlService, em, memberService } =
      createWorkspaceServices();
    mockRlsContext(em);
    const detached = Object.assign(createTestMember(), {
      status: "DISABLED",
      roles: ["owner"],
    });
    const managed = createTestMember();
    em.findOne.mockResolvedValue(managed);

    await expect(
      memberService.setMemberPermissions(detached, ["workspace:update"]),
    ).resolves.toBe(managed);

    expect(em.fork).not.toHaveBeenCalled();
    expect(em.transactional).toHaveBeenCalledOnce();
    expect(em.findOne).toHaveBeenCalledWith(
      Member,
      { id: detached.id, workspace: detached.workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenLastCalledWith(
      "update",
      managed,
    );
    expect(managed.permissions).toEqual(["workspace:update"]);
    expect(managed.status).toBe("ACTIVE");
    expect(managed.roles).toEqual(["member"]);
    expect(detached.permissions).toEqual([]);
    expect(em.persist).not.toHaveBeenCalled();
    expect(em.flush).toHaveBeenCalledOnce();
  });

  it("does not recreate a deleted member while setting permissions", async () => {
    const { em, memberService } = createWorkspaceServices();
    em.findOne.mockResolvedValue(null);

    await expect(
      memberService.setMemberPermissions(createTestMember(), [
        "workspace:update",
      ]),
    ).rejects.toThrow("Workspace member not found");
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("rechecks permission access against the locked member", async () => {
    const { accessControlService, em, memberService } =
      createWorkspaceServices();
    const detached = createTestMember();
    const managed = createTestMember();
    em.findOne.mockResolvedValue(managed);
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      (_action, subject) => {
        if (subject === managed) throw new ForbiddenException();
      },
    );

    await expect(
      memberService.setMemberPermissions(detached, ["workspace:update"]),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(managed.permissions).toEqual([]);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("checks role grants against the issuer permission ceiling", async () => {
    const { accessControlService, em, memberService } =
      createWorkspaceServices();
    const member = Object.assign(createTestMember(), {
      roles: ["member"],
    });
    em.findOne.mockResolvedValue(member);

    await memberService.setMemberRoles(member, ["admin"]);

    expect(
      accessControlService.assertCanGrantWorkspacePermissions,
    ).toHaveBeenCalledWith(
      expect.arrayContaining(["workspace:update", "member:create"]),
    );
  });

  it("lists configured roles and updates member roles", async () => {
    const { em, memberService } = createWorkspaceServices({
      permissions: [
        "workspace:update",
        "member:update",
        "workspace:delete",
        "invitation:cancel",
      ],
      roles: {
        admin: ["workspace:update", "member:update"],
        member: [],
        owner: ["workspace:delete"],
      },
    });
    const member = Object.assign(createTestMember(), {
      permissions: ["invitation:create"],
      roles: ["member"],
    });
    em.findOne.mockResolvedValue(member);

    expect(memberService.listRoles()).toEqual([
      { role: "admin", grantable: true },
      { role: "member", grantable: true },
      { role: "owner", grantable: true },
    ]);
    expect(memberService.listPermissions()).toEqual(
      [
        "workspace:update",
        "member:update",
        "workspace:delete",
        "invitation:cancel",
      ].map((permission) => ({ permission, grantable: true })),
    );

    await expect(memberService.setMemberRoles(member, ["admin"])).resolves.toBe(
      member,
    );
    expect(member.roles).toEqual(["admin"]);
    expect(memberService.getEffectiveMemberPermissions(member)).toEqual([
      "workspace:update",
      "member:update",
      "invitation:create",
    ]);
    await expect(
      memberService.setMemberRoles(member, ["missing"]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(memberService.setMemberRoles(member, ["owner"])).resolves.toBe(
      member,
    );
    expect(member.roles).toEqual(["owner"]);
  });

  it("rechecks update ability on the locked member before changing owner roles", async () => {
    const { em, memberService, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const staleMember = Object.assign(createTestMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedMember = Object.assign(createTestMember(), {
      id: staleMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedMember);
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      (_action, subject) => {
        if (subject === promotedMember) throw new ForbiddenException();
      },
    );

    await expect(
      memberService.setMemberRoles(staleMember, ["admin"]),
    ).rejects.toThrow(ForbiddenException);

    expect(em.findOne).toHaveBeenCalledWith(
      Member,
      { id: staleMember.id, workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(promotedMember.roles).toEqual(["owner"]);
    expect(em.flush).not.toHaveBeenCalled();
  });

  it("rejects owner role grants beyond the caller's permission scope", async () => {
    const { em, memberService, accessControlService } =
      createWorkspaceServices();
    const member = createTestMember();
    vi.mocked(
      accessControlService.assertCanGrantWorkspacePermissions,
    ).mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(
      memberService.setMemberRoles(member, ["owner"]),
    ).rejects.toThrow(ForbiddenException);
    expect(
      accessControlService.assertCanGrantWorkspacePermissions,
    ).toHaveBeenCalledWith(expect.arrayContaining(["workspace:delete"]));
    expect(em.transactional).not.toHaveBeenCalled();
    expect(member.roles).toEqual(["member"]);
  });

  it("finds members by identifier only in the request's selected workspace", async () => {
    const { em, memberService, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const member = createTestMember();
    em.findOne.mockResolvedValue(member);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Workspace, workspace);
      await expect(memberService.getMember(member.id)).resolves.toBe(member);
    });
    expect(accessControlService.assertCurrentWorkspace).toHaveBeenCalledWith(
      workspace,
    );
    expect(accessControlService.assertWorkspaceCan).toHaveBeenCalledWith(
      "read",
      Member,
    );
    expect(em.findOne).toHaveBeenCalledWith(Member, {
      id: member.id,
      workspace,
    });
  });

  it("rechecks delete ability and current identity under a row lock before removal", async () => {
    const { em, memberService, accessControlService } =
      createWorkspaceServices();
    const workspace = createTestWorkspace();
    const staleMember = Object.assign(createTestMember(), {
      roles: ["member"],
      workspace,
    });
    const promotedMember = Object.assign(createTestMember(), {
      id: staleMember.id,
      roles: ["owner"],
      workspace,
    });
    em.findOne.mockResolvedValue(promotedMember);
    vi.mocked(accessControlService.assertWorkspaceCan).mockImplementation(
      (_action, subject) => {
        if (subject === promotedMember) throw new ForbiddenException();
      },
    );
    vi.mocked(accessControlService.assertCurrentMember).mockImplementation(
      (member) => {
        if (member === promotedMember) throw new ForbiddenException();
      },
    );

    await expect(memberService.removeMember(staleMember)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(memberService.leaveWorkspace(staleMember)).rejects.toThrow(
      ForbiddenException,
    );
    expect(em.findOne).toHaveBeenCalledWith(
      Member,
      { id: staleMember.id, workspace },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(em.remove).not.toHaveBeenCalled();
  });

  it("removes a member only after reloading it under a row lock", async () => {
    const { em, memberService } = createWorkspaceServices();
    const workspace = createTestWorkspace();
    const member = Object.assign(createTestMember(), {
      roles: ["member"],
      workspace,
    });
    em.findOne.mockResolvedValue(member);

    await expect(memberService.removeMember(member)).resolves.toBe(member);
    expect(em.remove).toHaveBeenCalledWith(member);
  });

  it("checks flattened member permissions regardless of role", () => {
    const { memberService } = createWorkspaceServices();
    const owner = Object.assign(createTestMember(), {
      permissions: ["project:read", "project:update"],
      roles: ["owner"],
    });

    expect(
      memberService.hasPermissions(owner, {
        permissions: { project: ["read", "update"] },
      }),
    ).toBe(true);
    expect(
      memberService.hasPermissions(owner, {
        permissions: { project: ["delete"] },
      }),
    ).toBe(false);
  });
});
