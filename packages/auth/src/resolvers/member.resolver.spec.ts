import { ForbiddenException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { Member } from "../entities/member.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { MemberStatus } from "../enums/member-status.enum.js";
import { type MemberService } from "../services/member.service.js";
import { MemberResolver } from "./member.resolver.js";

describe("MemberResolver", () => {
  it("returns the current workspace member from request context", () => {
    const member = { id: "member_1" } as Member;
    const { resolver } = createResolver({
      memberService: {
        getCurrentMember: vi.fn(() => member),
      },
    });

    expect(resolver.currentMember()).toBe(member);
  });

  it("returns null when no current workspace member is available", () => {
    const { resolver } = createResolver();

    expect(resolver.currentMember()).toBeNull();
  });

  it("finds a member by id through the service", async () => {
    const member = { id: "member_1" } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        getMember: vi.fn(async () => member),
      },
    });

    await expect(resolver.member("member_1")).resolves.toBe(member);

    expect(memberService.getMember).toHaveBeenCalledWith("member_1");
  });

  it("delegates adding an existing user to MemberService", async () => {
    const workspace = { id: "workspace_1" } as Workspace;
    const createdMember = { id: "member_2" } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        addMemberByEmail: vi.fn(async () => createdMember),
      },
    });

    await expect(
      resolver.addMember(workspace, { email: "alice@example.com" }),
    ).resolves.toBe(createdMember);

    expect(memberService.addMemberByEmail).toHaveBeenCalledWith(
      workspace,
      "alice@example.com",
    );
  });
  it("rejects direct permission changes by non owners", async () => {
    const target = {
      id: "member_2",
      roles: ["member"],
    } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        getMember: vi.fn(async () => target),
        setMemberPermissions: vi.fn(async () => {
          throw new ForbiddenException();
        }),
      },
    });

    await expect(
      resolver.setMemberPermissions(target.id, {
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberService.setMemberPermissions).toHaveBeenCalledWith(
      target.id,
      [],
    );
  });

  it("rejects updating other owners", async () => {
    const { resolver, memberService } = createResolver({
      memberService: {
        updateMember: vi.fn(async () => {
          throw new ForbiddenException();
        }),
        getMember: vi.fn(
          async () =>
            ({
              id: "member_2",
              roles: ["owner"],
            }) as Member,
        ),
      },
    });

    await expect(
      resolver.updateMember("member_2", {
        status: MemberStatus.DISABLED,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(memberService.updateMember).toHaveBeenCalled();
  });

  it("allows authorized members to update member status", async () => {
    const member = {
      id: "member_2",
      roles: ["member"],
    } as Member;
    const updated = {
      ...member,
      status: MemberStatus.DISABLED,
    } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        getMember: vi.fn(async () => member),
        updateMember: vi.fn(async () => updated),
      },
    });

    await expect(
      resolver.updateMember("member_2", {
        status: MemberStatus.DISABLED,
      }),
    ).resolves.toBe(updated);

    expect(memberService.updateMember).toHaveBeenCalledWith(member.id, {
      status: MemberStatus.DISABLED,
    });
    expect(memberService.getMember).not.toHaveBeenCalled();
  });

  it("lists roles and updates member roles through MemberService", async () => {
    const member = { id: "member_2", roles: ["member"] } as Member;
    const roles = [{ name: "admin", permissions: ["workspace:update"] }];
    const { resolver, memberService } = createResolver({
      memberService: {
        getMember: vi.fn(async () => member),
        listPermissions: vi.fn(() => ["workspace:update"]),
        listRoles: vi.fn(() => roles),
        setMemberRoles: vi.fn(async () => member),
      },
    });

    expect(resolver.workspaceRoles()).toEqual(roles.map(({ name }) => name));
    expect(resolver.workspacePermissions()).toEqual(["workspace:update"]);
    await expect(
      resolver.setMemberRoles(member.id, {
        roles: ["admin"],
      }),
    ).resolves.toBe(member);
    expect(memberService.getMember).not.toHaveBeenCalled();
    expect(memberService.setMemberRoles).toHaveBeenCalledWith(member.id, [
      "admin",
    ]);
  });

  it("allows owners to update their own owner member record", async () => {
    const member = {
      id: "member_1",
      roles: ["owner"],
    } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        getMember: vi.fn(async () => member),
        updateMember: vi.fn(async () => member),
      },
    });

    await expect(
      resolver.updateMember("member_1", {
        status: MemberStatus.ACTIVE,
      }),
    ).resolves.toBe(member);
    expect(memberService.updateMember).toHaveBeenCalledWith(member.id, {
      status: MemberStatus.ACTIVE,
    });
  });

  it("rejects self removal", async () => {
    const { resolver, memberService } = createResolver({
      memberService: {
        removeMember: vi.fn(async () => {
          throw new ForbiddenException();
        }),
        getMember: vi.fn(
          async () =>
            ({
              id: "member_1",
            }) as Member,
        ),
      },
    });

    await expect(resolver.removeMember("member_1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(memberService.removeMember).toHaveBeenCalled();
  });

  it("allows owners to remove other members", async () => {
    const member = { id: "member_2", name: "Removed member" } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        getMember: vi.fn(async () => member),
        removeMember: vi.fn(async () => member),
      },
    });

    await expect(resolver.removeMember("member_2")).resolves.toEqual({
      id: member.id,
    });

    expect(memberService.removeMember).toHaveBeenCalledWith(member.id);
  });
});

function createResolver(overrides?: {
  memberService?: Partial<MemberService>;
}) {
  const memberService = {
    addMemberByEmail: vi.fn(),
    getMember: vi.fn(),
    getCurrentMember: vi.fn(() => null),
    getMemberListFilter: vi.fn((workspace) => ({ workspace })),
    listPermissions: vi.fn(() => []),
    listRoles: vi.fn(() => []),
    removeMember: vi.fn(),
    setMemberPermissions: vi.fn(),
    updateMember: vi.fn(),
    setMemberRoles: vi.fn(),
    ...overrides?.memberService,
  } as unknown as Mocked<MemberService>;
  const resolver = new MemberResolver(memberService);

  return {
    resolver,
    memberService,
  };
}
