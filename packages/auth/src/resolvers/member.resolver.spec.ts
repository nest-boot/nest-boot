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
    ).resolves.toEqual({ id: createdMember.id });

    expect(memberService.addMemberByEmail).toHaveBeenCalledWith(
      workspace,
      "alice@example.com",
    );
  });
  it("forwards permission changes and propagates service errors", async () => {
    const denied = new ForbiddenException();
    const { resolver, memberService } = createResolver({
      memberService: {
        setMemberPermissions: vi.fn().mockRejectedValue(denied),
      },
    });

    await expect(
      resolver.setMemberPermissions("member_2", {
        permissions: [],
      }),
    ).rejects.toBe(denied);
    expect(memberService.setMemberPermissions).toHaveBeenCalledWith(
      "member_2",
      [],
    );
  });

  it("forwards member updates without a preliminary lookup", async () => {
    const updated = {
      id: "member_2",
      status: MemberStatus.DISABLED,
    } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
        updateMember: vi.fn(async () => updated),
      },
    });

    await expect(
      resolver.updateMember("member_2", {
        status: MemberStatus.DISABLED,
      }),
    ).resolves.toEqual({ id: updated.id });

    expect(memberService.updateMember).toHaveBeenCalledWith(updated.id, {
      status: MemberStatus.DISABLED,
    });
    expect(memberService.getMember).not.toHaveBeenCalled();
  });

  it("propagates update errors from MemberService", async () => {
    const denied = new ForbiddenException();
    const input = { status: MemberStatus.DISABLED };
    const { resolver, memberService } = createResolver({
      memberService: { updateMember: vi.fn().mockRejectedValue(denied) },
    });

    await expect(resolver.updateMember("member_2", input)).rejects.toBe(denied);
    expect(memberService.updateMember).toHaveBeenCalledWith("member_2", input);
  });

  it("lists roles and updates member roles through MemberService", async () => {
    const member = { id: "member_2", roles: ["member"] } as Member;
    const roles = [{ role: "admin", grantable: false }];
    const permissions = [{ permission: "workspace:update", grantable: true }];
    const { resolver, memberService } = createResolver({
      memberService: {
        listPermissions: vi.fn(() => permissions),
        listRoles: vi.fn(() => roles),
        setMemberRoles: vi.fn(async () => member),
      },
    });

    expect(resolver.workspaceRoles()).toEqual(roles);
    expect(resolver.workspacePermissions()).toEqual(permissions);
    await expect(
      resolver.setMemberRoles(member.id, {
        roles: ["admin"],
      }),
    ).resolves.toEqual({ id: member.id });
    expect(memberService.getMember).not.toHaveBeenCalled();
    expect(memberService.setMemberRoles).toHaveBeenCalledWith(member.id, [
      "admin",
    ]);
  });

  it("propagates removal errors from MemberService", async () => {
    const denied = new ForbiddenException();
    const { resolver, memberService } = createResolver({
      memberService: {
        removeMember: vi.fn().mockRejectedValue(denied),
      },
    });

    await expect(resolver.removeMember("member_1")).rejects.toBe(denied);

    expect(memberService.removeMember).toHaveBeenCalledWith("member_1");
  });

  it("returns only the removed member identifier", async () => {
    const member = { id: "member_2", name: "Removed member" } as Member;
    const { resolver, memberService } = createResolver({
      memberService: {
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
