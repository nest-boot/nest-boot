import { EntityManager } from "@mikro-orm/core";
import type { Provider } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { InvitationResolver } from "../features/invitations/invitation.resolver.js";
import { InvitationService } from "../features/invitations/invitation.service.js";
import { MemberResolver } from "../resolvers/member.resolver.js";
import { MemberApiKeyResolver } from "../resolvers/member-api-key.resolver.js";
import { UserWorkspaceResolver } from "../resolvers/user-workspace.resolver.js";
import { WorkspaceResolver } from "../resolvers/workspace.resolver.js";
import { MemberService } from "../services/member.service.js";
import { MemberApiKeyService } from "../services/member-api-key.service.js";
import { WorkspaceService } from "../services/workspace.service.js";

/** Resolve feature options before instantiating services or exposing GraphQL resolvers, including forRootAsync. */
export const workspaceProviders: Provider[] = [
  {
    provide: MemberApiKeyService,
    inject: [MODULE_OPTIONS_TOKEN, EntityManager],
    useFactory: (options: AuthModuleOptions, em: EntityManager) =>
      options.workspace?.enabled === true
        ? new MemberApiKeyService(em, options)
        : null,
  },
  {
    provide: WorkspaceResolver,
    inject: [
      MODULE_OPTIONS_TOKEN,
      WorkspaceService,
      MemberApiKeyService,
      MemberService,
      InvitationService,
    ],
    useFactory: (
      options: AuthModuleOptions,
      workspaces: WorkspaceService,
      keys: MemberApiKeyService,
      members: MemberService,
      invitations: InvitationService,
    ) =>
      options.workspace?.enabled === true
        ? new WorkspaceResolver(workspaces, keys, members, invitations)
        : null,
  },
  {
    provide: MemberResolver,
    inject: [MODULE_OPTIONS_TOKEN, MemberService],
    useFactory: (options: AuthModuleOptions, members: MemberService) =>
      options.workspace?.enabled === true ? new MemberResolver(members) : null,
  },
  {
    provide: MemberApiKeyResolver,
    inject: [MODULE_OPTIONS_TOKEN, MemberApiKeyService],
    useFactory: (options: AuthModuleOptions, keys: MemberApiKeyService) =>
      options.workspace?.enabled === true
        ? new MemberApiKeyResolver(keys)
        : null,
  },
  {
    provide: InvitationResolver,
    inject: [MODULE_OPTIONS_TOKEN, InvitationService],
    useFactory: (options: AuthModuleOptions, invitations: InvitationService) =>
      options.workspace?.enabled === true
        ? new InvitationResolver(invitations)
        : null,
  },
  {
    provide: UserWorkspaceResolver,
    inject: [MODULE_OPTIONS_TOKEN, WorkspaceService, InvitationService],
    useFactory: (
      options: AuthModuleOptions,
      workspaces: WorkspaceService,
      invitations: InvitationService,
    ) =>
      options.workspace?.enabled === true
        ? new UserWorkspaceResolver(workspaces, invitations)
        : null,
  },
];
