import { EntityManager } from "@mikro-orm/core";
import type { Provider } from "@nestjs/common";

import { SystemAccountService } from "../admin/services/system-account.service.js";
import { featureProvider } from "../common/feature-provider.js";
import { UserService } from "../core/services/user.service.js";
import { WorkspaceMemberService } from "../workspace/services/workspace-member.service.js";
import { SystemApiKeyResolver } from "./resolvers/system-api-key.resolver.js";
import { SystemApiKeyRelationResolver } from "./resolvers/system-api-key-relation.resolver.js";
import { UserApiKeyResolver } from "./resolvers/user-api-key.resolver.js";
import { UserApiKeyRelationResolver } from "./resolvers/user-api-key-relation.resolver.js";
import { WorkspaceApiKeyResolver } from "./resolvers/workspace-api-key.resolver.js";
import { WorkspaceApiKeyConnectionResolver } from "./resolvers/workspace-api-key-connection.resolver.js";
import { WorkspaceApiKeyRelationResolver } from "./resolvers/workspace-api-key-relation.resolver.js";
import { ApiKeyService } from "./services/api-key.service.js";
import { SystemApiKeyService } from "./services/system-api-key.service.js";
import { UserApiKeyService } from "./services/user-api-key.service.js";
import { WorkspaceApiKeyService } from "./services/workspace-api-key.service.js";

/** Credential scopes are registered independently from their owning identity features. */
export const apiKeyProviders: Provider[] = [
  featureProvider(
    UserApiKeyService,
    "userApiKey",
    [EntityManager, ApiKeyService],
    (options, em: EntityManager, apiKeys: ApiKeyService) =>
      new UserApiKeyService(em, options, apiKeys),
  ),
  featureProvider(
    WorkspaceApiKeyService,
    "workspaceApiKey",
    [EntityManager, ApiKeyService],
    (options, em: EntityManager, apiKeys: ApiKeyService) =>
      new WorkspaceApiKeyService(em, options, apiKeys),
  ),
  featureProvider(
    SystemApiKeyService,
    "systemApiKeyManagement",
    [EntityManager, ApiKeyService],
    (options, em: EntityManager, apiKeys: ApiKeyService) =>
      new SystemApiKeyService(em, options, apiKeys),
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
    [WorkspaceMemberService],
    (_options, identities: WorkspaceMemberService) =>
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
