import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  createTestInvitation,
  createTestMember,
  createTestUser,
  createTestWorkspace,
  createWorkspaceServices,
} from "../../test/workspace-service.fixture.js";
import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { API_KEY } from "../auth.constants.js";
import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import { AccessControlService } from "./access-control.service.js";
import { InvitationService } from "./invitation.service.js";

describe("InvitationService read authorization", () => {
  const options = {};

  it.each([
    {
      name: "recipient without a workspace",
      recipient: true,
      selected: "",
      member: false,
      canRead: false,
      allowed: true,
    },
    {
      name: "recipient in another workspace",
      recipient: true,
      selected: "other",
      member: true,
      canRead: false,
      allowed: true,
    },
    {
      name: "unrelated user without a workspace",
      recipient: false,
      selected: "",
      member: false,
      canRead: false,
      allowed: false,
    },
    {
      name: "reader in another workspace",
      recipient: false,
      selected: "other",
      member: true,
      canRead: true,
      allowed: false,
    },
    {
      name: "non-member in the selected workspace",
      recipient: false,
      selected: "workspace-1",
      member: false,
      canRead: true,
      allowed: false,
    },
    {
      name: "member without invitation read permission",
      recipient: false,
      selected: "workspace-1",
      member: true,
      canRead: false,
      allowed: false,
    },
    {
      name: "authorized workspace reader",
      recipient: false,
      selected: "workspace-1",
      member: true,
      canRead: true,
      allowed: true,
    },
  ])(
    "checks $name even when the database returns the row",
    async (scenario) => {
      const { em } = createWorkspaceServices();
      const service = new InvitationService(
        em,
        options,
        new AccessControlService(options),
      );
      const workspace = createTestWorkspace();
      const invitation = Object.assign(createTestInvitation(), {
        email: "recipient@example.com",
        workspace: ref(Workspace, workspace),
      });
      em.findOne.mockResolvedValue(invitation);

      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(
            User,
            Object.assign(createTestUser(), {
              email: scenario.recipient
                ? "Recipient@example.com"
                : "other@example.com",
            }),
          );
          RequestContext.set(
            UserAbility,
            new UserAbility([{ action: "read", subject: Invitation }]),
          );
          if (scenario.selected) {
            const selected = Object.assign(createTestWorkspace(), {
              id: scenario.selected,
            });
            RequestContext.set(Workspace, selected);
            if (scenario.member)
              RequestContext.set(
                Member,
                Object.assign(createTestMember(), {
                  workspace: ref(Workspace, selected),
                }),
              );
          }
          RequestContext.set(
            WorkspaceAbility,
            new WorkspaceAbility(
              scenario.canRead ? [{ action: "read", subject: Invitation }] : [],
            ),
          );

          if (scenario.allowed) {
            await expect(service.getInvitation(invitation.id)).resolves.toBe(
              invitation,
            );
          } else {
            await expect(service.getInvitation(invitation.id)).rejects.toThrow(
              ForbiddenException,
            );
          }
        },
      );
    },
  );

  it.each([
    {
      name: "workspace API key",
      key: true,
      recipient: false,
      selected: "workspace-1",
      userRead: "none",
      workspaceRead: "allow",
      allowed: true,
    },
    {
      name: "API key in another workspace",
      key: true,
      recipient: false,
      selected: "other",
      userRead: "none",
      workspaceRead: "allow",
      allowed: false,
    },
    {
      name: "API key without read permission",
      key: true,
      recipient: false,
      selected: "workspace-1",
      userRead: "none",
      workspaceRead: "none",
      allowed: false,
    },
    {
      name: "API key with unmatched read conditions",
      key: true,
      recipient: false,
      selected: "workspace-1",
      userRead: "none",
      workspaceRead: "conditional",
      allowed: false,
    },
    {
      name: "member with only workspace read permission",
      key: false,
      recipient: false,
      selected: "workspace-1",
      userRead: "none",
      workspaceRead: "allow",
      allowed: true,
    },
    {
      name: "recipient with only workspace read permission",
      key: false,
      recipient: true,
      selected: "workspace-1",
      userRead: "none",
      workspaceRead: "allow",
      allowed: true,
    },
    {
      name: "recipient with unmatched user conditions and workspace access",
      key: false,
      recipient: true,
      selected: "workspace-1",
      userRead: "conditional",
      workspaceRead: "allow",
      allowed: true,
    },
    {
      name: "recipient without either read permission",
      key: false,
      recipient: true,
      selected: "workspace-1",
      userRead: "none",
      workspaceRead: "none",
      allowed: true,
    },
  ])("checks $name independently of RLS", async (scenario) => {
    const { em } = createWorkspaceServices();
    const service = new InvitationService(
      em,
      options,
      new AccessControlService(options),
    );
    const invitation = Object.assign(createTestInvitation(), {
      email: "recipient@example.com",
      workspace: ref(Workspace, createTestWorkspace()),
    });
    em.findOne.mockResolvedValue(invitation);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const workspace = Object.assign(createTestWorkspace(), {
        id: scenario.selected,
      });
      RequestContext.set(Workspace, workspace);
      if (scenario.key) {
        RequestContext.set(
          API_KEY,
          Object.assign(new WorkspaceApiKey(), {
            user: null,
            workspace: ref(Workspace, workspace),
          }),
        );
      } else {
        RequestContext.set(
          User,
          Object.assign(createTestUser(), {
            email: scenario.recipient ? invitation.email : "other@example.com",
          }),
        );
        RequestContext.set(
          Member,
          Object.assign(createTestMember(), {
            workspace: ref(Workspace, workspace),
          }),
        );
      }
      RequestContext.set(
        UserAbility,
        new UserAbility(
          scenario.userRead === "conditional"
            ? [
                {
                  action: "read",
                  subject: Invitation,
                  conditions: { email: "different@example.com" },
                },
              ]
            : [],
        ),
      );
      RequestContext.set(
        WorkspaceAbility,
        new WorkspaceAbility(
          scenario.workspaceRead === "none"
            ? []
            : [
                {
                  action: "read",
                  subject: Invitation,
                  ...(scenario.workspaceRead === "conditional"
                    ? { conditions: { email: "different@example.com" } }
                    : {}),
                },
              ],
        ),
      );

      if (scenario.allowed) {
        await expect(service.getInvitation(invitation.id)).resolves.toBe(
          invitation,
        );
        em.findOne.mockResolvedValueOnce(null);
        await expect(service.getInvitation("hidden")).resolves.toBeNull();
      } else {
        await expect(service.getInvitation(invitation.id)).rejects.toThrow(
          ForbiddenException,
        );
      }
      expect(em.findOne.mock.calls).toHaveLength(
        scenario.allowed
          ? 2
          : scenario.workspaceRead === "none" && scenario.userRead === "none"
            ? 0
            : 1,
      );
      expect(em.fork.mock.calls).toHaveLength(0);
    });
  });

  it("allows the recipient's own invitation without a management ability", async () => {
    const { em } = createWorkspaceServices();
    const service = new InvitationService(
      em,
      options,
      new AccessControlService(options),
    );
    const invitation = Object.assign(createTestInvitation(), {
      email: "recipient@example.com",
    });
    em.findOne.mockResolvedValue(invitation);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(
        User,
        Object.assign(createTestUser(), { email: invitation.email }),
      );
      RequestContext.set(
        UserAbility,
        new UserAbility([
          {
            action: "read",
            subject: Invitation,
            conditions: { email: "different@example.com" },
          },
        ]),
      );

      await expect(service.getInvitation(invitation.id)).resolves.toBe(
        invitation,
      );
      expect(em.findOne.mock.calls).toHaveLength(1);
    });
  });
});
