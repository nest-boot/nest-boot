import { Invitation as BaseInvitation } from "../entities/invitation.entity.js";
import { Member as BaseMember } from "../entities/member.entity.js";
import { User as BaseUser } from "../entities/user.entity.js";
import { Workspace as BaseWorkspace } from "../entities/workspace.entity.js";
import { type InvitationService } from "../services/invitation.service.js";
import { type MemberService } from "../services/member.service.js";
import { InvitationResolver } from "./invitation.resolver.js";
import { MemberResolver } from "./member.resolver.js";

describe("workspace relation fields", () => {
  it("delegates member users, including null, to the service", async () => {
    const user = new BaseUser();
    const member = new BaseMember();
    const service = {
      getMemberUser: vi
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null),
    };
    const resolver = new MemberResolver(service as unknown as MemberService);
    await expect(resolver.user(member)).resolves.toBe(user);
    await expect(resolver.user(member)).resolves.toBeNull();
    expect(service.getMemberUser).toHaveBeenCalledWith(member);
  });

  it("delegates invitation relations and propagates authorization failures", async () => {
    const invitation = new BaseInvitation();
    const user = new BaseUser();
    const workspace = new BaseWorkspace();
    const service = {
      getInvitationInviter: vi.fn().mockResolvedValue(user),
      getInvitationWorkspace: vi.fn().mockResolvedValue(workspace),
    };
    const resolver = new InvitationResolver(
      service as unknown as InvitationService,
    );
    await expect(resolver.inviter(invitation)).resolves.toBe(user);
    await expect(resolver.workspace(invitation)).resolves.toBe(workspace);
    expect(service.getInvitationInviter).toHaveBeenCalledWith(invitation);
    expect(service.getInvitationWorkspace).toHaveBeenCalledWith(invitation);
    service.getInvitationInviter.mockRejectedValueOnce(new Error("denied"));
    await expect(resolver.inviter(invitation)).rejects.toThrow("denied");
  });
});
