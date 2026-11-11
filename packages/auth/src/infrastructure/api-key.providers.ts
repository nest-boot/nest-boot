import { EntityManager } from "@mikro-orm/core";
import type { Provider } from "@nestjs/common";

import { ApiKeyResolver } from "../resolvers/api-key.resolver.js";
import { MemberApiKeyResolver } from "../resolvers/member-api-key.resolver.js";
import { SystemAccountApiKeyResolver } from "../resolvers/system-account-api-key.resolver.js";
import { UserApiKeyResolver } from "../resolvers/user-api-key.resolver.js";
import { WorkspaceApiKeyResolver } from "../resolvers/workspace-api-key.resolver.js";
import { MemberService } from "../services/member.service.js";
import { MemberApiKeyService } from "../services/member-api-key.service.js";
import { SystemAccountService } from "../services/system-account.service.js";
import { SystemAccountApiKeyService } from "../services/system-account-api-key.service.js";
import { UserService } from "../services/user.service.js";
import { UserApiKeyService } from "../services/user-api-key.service.js";
import { featureProvider } from "./feature-provider.js";

/** Credential scopes are registered independently from their owning identity features. */
export const apiKeyProviders: Provider[] = [
  featureProvider(
    UserApiKeyService,
    "userApiKey",
    [EntityManager],
    (options, em: EntityManager) => new UserApiKeyService(em, options),
  ),
  featureProvider(
    MemberApiKeyService,
    "workspaceApiKey",
    [EntityManager],
    (options, em: EntityManager) => new MemberApiKeyService(em, options),
  ),
  featureProvider(
    SystemAccountApiKeyService,
    "systemAccountApiKeyManagement",
    [EntityManager],
    (options, em: EntityManager) => new SystemAccountApiKeyService(em, options),
  ),
  featureProvider(
    UserApiKeyResolver,
    "userApiKey",
    [UserApiKeyService],
    (_options, keys: UserApiKeyService) => new UserApiKeyResolver(keys),
  ),
  featureProvider(
    MemberApiKeyResolver,
    "workspaceApiKey",
    [MemberApiKeyService],
    (_options, keys: MemberApiKeyService) => new MemberApiKeyResolver(keys),
  ),
  featureProvider(
    WorkspaceApiKeyResolver,
    "workspaceApiKey",
    [MemberApiKeyService],
    (_options, keys: MemberApiKeyService) => new WorkspaceApiKeyResolver(keys),
  ),
  featureProvider(
    SystemAccountApiKeyResolver,
    "systemAccountApiKeyManagement",
    [SystemAccountApiKeyService],
    (_options, keys: SystemAccountApiKeyService) =>
      new SystemAccountApiKeyResolver(keys),
  ),
  featureProvider(
    ApiKeyResolver,
    "apiKeyGraphQL",
    [
      UserService,
      { token: MemberService, optional: true },
      { token: SystemAccountService, optional: true },
    ],
    (
      _options,
      users: UserService,
      members: MemberService | null,
      systems: SystemAccountService | null,
    ) => new ApiKeyResolver(users, members ?? undefined, systems ?? undefined),
  ),
];
