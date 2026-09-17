import { EntityManager, Reference } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { UserApiKey } from "../entities/user-api-key.entity.js";
import { WorkspaceApiKey } from "../entities/workspace-api-key.entity.js";
import type { ApiKey } from "../types/api-key.type.js";
import type { ApiKeyValidation } from "../types/api-key-validation.type.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";

/** Authenticates both credential kinds; management stays in their domain services. @internal */
@Injectable()
export class ApiKeyAuthenticationService {
  constructor(private readonly em: EntityManager) {}

  /** Resolves one unambiguous, active credential and its owner. */
  async validate(plaintext: string): Promise<ApiKeyValidation> {
    if (!plaintext) throw new UnauthorizedException("Missing API key");
    const key = hashApiKey(plaintext);
    const userKey = await this.em.findOne(
      UserApiKey,
      { key },
      { populate: ["user"] },
    );
    const workspaceKey = await this.em.findOne(
      WorkspaceApiKey,
      { key },
      { populate: ["workspace"] },
    );
    if ((!userKey && !workspaceKey) || (userKey && workspaceKey)) {
      throw new UnauthorizedException("Invalid API key");
    }
    const apiKey = userKey ?? workspaceKey;
    if (!apiKey) throw new UnauthorizedException("Invalid API key");
    if (!apiKey.enabled) throw new UnauthorizedException("API key is disabled");
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date())
      throw new UnauthorizedException("API key has expired");
    if (userKey) {
      const user = Reference.unwrapReference(userKey.user);
      if (
        user.banned &&
        (!user.banExpiresAt || user.banExpiresAt > new Date())
      ) {
        throw new UnauthorizedException("Invalid API key");
      }
      return { apiKey: userKey, ownerType: "user", user };
    }
    if (!workspaceKey) throw new UnauthorizedException("Invalid API key");
    const workspace = Reference.unwrapReference(workspaceKey.workspace);
    if (workspace.deletedAt) throw new UnauthorizedException("Invalid API key");
    return { apiKey: workspaceKey, ownerType: "workspace", workspace };
  }

  /** Records successful use in the credential's own table. */
  async recordUsage(apiKey: ApiKey): Promise<ApiKey> {
    const now = new Date();
    apiKey.lastUsedAt = now;
    apiKey.updatedAt = now;
    if (apiKey instanceof UserApiKey) {
      await this.em.nativeUpdate(
        UserApiKey,
        { id: apiKey.id },
        { lastUsedAt: now, updatedAt: now },
      );
    } else {
      await this.em.nativeUpdate(
        WorkspaceApiKey,
        { id: apiKey.id },
        { lastUsedAt: now, updatedAt: now },
      );
    }
    return apiKey;
  }
}
