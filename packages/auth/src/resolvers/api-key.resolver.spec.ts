import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { mockAuthorization } from "../../test/mock-authorization.js";
import {
  Member,
  MemberApiKey,
  SystemAccount,
  SystemAccountApiKey,
  User,
  UserApiKey,
} from "../entities/index.js";
import type { MemberService } from "../services/member.service.js";
import type { SystemAccountService } from "../services/system-account.service.js";
import type { UserService } from "../services/user.service.js";
import { ApiKeyResolver } from "./api-key.resolver.js";

describe("ApiKeyResolver owner authorization", () => {
  let authorization: ReturnType<typeof mockAuthorization>;
  const users = { getUser: vi.fn() };
  const members = { getMember: vi.fn() };
  const systems = { getSystemAccount: vi.fn() };
  const resolver = () =>
    new ApiKeyResolver(
      users as unknown as UserService,
      members as unknown as MemberService,
      systems as unknown as SystemAccountService,
    );
  beforeEach(() => {
    users.getUser.mockReset();
    members.getMember.mockReset();
    systems.getSystemAccount.mockReset();
    authorization = mockAuthorization();
  });

  it("routes each owner through its existing identity service", async () => {
    const user = new User();
    const member = new Member();
    const system = new SystemAccount();
    users.getUser.mockResolvedValue(user);
    members.getMember.mockResolvedValue(member);
    systems.getSystemAccount.mockResolvedValue(system);
    for (const [key, owner, method] of [
      [
        Object.assign(new UserApiKey(), { owner: ref(User, user) }),
        user,
        users.getUser,
      ],
      [
        Object.assign(new MemberApiKey(), { owner: ref(Member, member) }),
        member,
        members.getMember,
      ],
      [
        Object.assign(new SystemAccountApiKey(), {
          owner: ref(SystemAccount, system),
        }),
        system,
        systems.getSystemAccount,
      ],
    ] as const) {
      await expect(resolver().owner(key)).resolves.toBe(owner);
      expect(method).toHaveBeenCalledExactlyOnceWith(owner.id);
    }
  });

  it("returns null when the key or owner is forbidden, without swallowing infrastructure errors", async () => {
    const key = Object.assign(new UserApiKey(), { user: new User() });
    authorization.authorize.mockImplementationOnce(() => {
      throw new ForbiddenException();
    });
    await expect(resolver().owner(key)).resolves.toBeNull();
    expect(users.getUser).not.toHaveBeenCalled();
    authorization.can.mockReturnValueOnce(false);
    await expect(resolver().owner(key)).resolves.toBeNull();
    expect(users.getUser).not.toHaveBeenCalled();
    users.getUser.mockRejectedValueOnce(new ForbiddenException());
    await expect(resolver().owner(key)).resolves.toBeNull();
    users.getUser.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(resolver().owner(key)).rejects.toThrow("database unavailable");
  });

  it("does not require disabled member or system feature services", async () => {
    const base = new ApiKeyResolver(users as unknown as UserService);
    await expect(
      base.owner(Object.assign(new MemberApiKey(), { member: new Member() })),
    ).resolves.toBeNull();
    await expect(
      base.owner(
        Object.assign(new SystemAccountApiKey(), {
          owner: ref(SystemAccount, new SystemAccount()),
        }),
      ),
    ).resolves.toBeNull();
  });
  it("allows existing self-profile access without granting access to another identity", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const user = new User();
      const member = new Member();
      RequestContext.set(User, user);
      RequestContext.set(Member, member);
      authorization.can.mockReturnValue(false);
      await expect(
        resolver().owner(Object.assign(new UserApiKey(), { user })),
      ).resolves.toBe(user);
      await expect(
        resolver().owner(Object.assign(new MemberApiKey(), { member })),
      ).resolves.toBe(member);
      await expect(
        resolver().owner(Object.assign(new UserApiKey(), { user: new User() })),
      ).resolves.toBeNull();
      expect(users.getUser).not.toHaveBeenCalled();
      expect(members.getMember).not.toHaveBeenCalled();
    });
  });
});
