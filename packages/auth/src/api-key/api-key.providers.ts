import { EntityManager } from "@mikro-orm/core";
import type { Provider } from "@nestjs/common";

import { SystemAccountService } from "../admin/services/system-account.service.js";
import { featureProvider } from "../common/feature-provider.js";
import { UserService } from "../core/services/user.service.js";
import { MemberService } from "../workspace/services/member.service.js";
import { SystemApiKeyResolver } from "./resolvers/system-api-key.resolver.js";
import { SystemApiKeyRelationResolver } from "./resolvers/system-api-key-relation.resolver.js";
import { UserApiKeyResolver } from "./resolvers/user-api-key.resolver.js";
import { UserApiKeyRelationResolver } from "./resolvers/user-api-key-relation.resolver.js";
import { WorkspaceApiKeyResolver } from "./resolvers/workspace-api-key.resolver.js";
import { WorkspaceApiKeyConnectionResolver } from "./resolvers/workspace-api-key-connection.resolver.js";
import { WorkspaceApiKeyRelationResolver } from "./resolvers/workspace-api-key-relation.resolver.js";
import { SystemApiKeyService } from "./services/system-api-key.service.js";
import { UserApiKeyService } from "./services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "./services/workspace-api-key.service.js";

/** Credential scopes are registered independently from their owning identity features. */
export const apiKeyProviders: Provider[] = [
  featureProvider(
    UserApiKeyService,
    "userApiKey",
    [EntityManager],
    (options, em: EntityManager) => new UserApiKeyService(em, options),
  ),
  featureProvider(
    WorkspaceApiKeyService,
    "workspaceApiKey",
    [EntityManager],
    (options, em: EntityManager) => new WorkspaceApiKeyService(em, options),
  ),
  featureProvider(
    SystemApiKeyService,
    "systemApiKeyManagement",
    [EntityManager],
    (options, em: EntityManager) => new SystemApiKeyService(em, options),
  ),
  featureProvider(
    UserApiKeyResolver,
    "userApiKey",
    [UserApiKeyService],
    (_options, keys: UserApiKeyService) => new UserApiKeyResolver(keys),
  ),
  featureProvider(
    WorkspaceApiKeyResolver,
    "workspaceApiKey",
    [WorkspaceApiKeyService],
    (_options, keys: WorkspaceApiKeyService) =>
      new WorkspaceApiKeyResolver(keys),
  ),
  featureProvider(
    WorkspaceApiKeyConnectionResolver,
    "workspaceApiKey",
    [WorkspaceApiKeyService],
    (_options, keys: WorkspaceApiKeyService) =>
      new WorkspaceApiKeyConnectionResolver(keys),
  ),
  featureProvider(
    SystemApiKeyResolver,
    "systemApiKeyManagement",
    [SystemApiKeyService],
    (_options, keys: SystemApiKeyService) => new SystemApiKeyResolver(keys),
  ),
  featureProvider(
    UserApiKeyRelationResolver,
    "userApiKey",
    [UserService],
    (_options, identities: UserService) =>
      new UserApiKeyRelationResolver(identities),
  ),
  featureProvider(
    WorkspaceApiKeyRelationResolver,
    "workspaceApiKey",
    [MemberService],
    (_options, identities: MemberService) =>
      new WorkspaceApiKeyRelationResolver(identities),
  ),
  featureProvider(
    SystemApiKeyRelationResolver,
    "systemApiKeyManagement",
    [SystemAccountService],
    (_options, identities: SystemAccountService) =>
      new SystemApiKeyRelationResolver(identities),
  ),
];
