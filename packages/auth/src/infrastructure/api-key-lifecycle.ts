import type { EntityManager } from "@mikro-orm/core";
import { BadRequestException } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { ApiKey } from "../types/api-key.type.js";
import {
  generateApiKey,
  hashApiKey,
} from "../utils/api-key-credential.util.js";
import { RequestIdentity } from "./request-identity.js";

/** Persists already-authorized key changes and publishes their committed identity effects. @internal */
export class ApiKeyLifecycle {
  /** Prepares shared credential fields without choosing an owner or authorizing persistence. */
  static prepareCreation(options: CreateApiKeyOptions, permissions: string[]) {
    this.assertExpiration(options.expiresAt);
    const prefix = options.prefix ?? process.env.API_KEY_PREFIX ?? "sk";
    const apiKey = generateApiKey(prefix);
    return {
      apiKey,
      data: {
        enabled: true,
        expiresAt: options.expiresAt ?? null,
        key: hashApiKey(apiKey),
        name: options.name,
        permissions,
        prefix,
        start: apiKey.slice(0, 8),
      },
    };
  }

  /** Validates expiration for both key creation and updates. */
  static assertExpiration(expiresAt: Date | null | undefined): void {
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
  }

  /** Restores managed fields on persistence failure; never publishes an uncommitted credential. */
  static async update<Key extends ApiKey>(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: Key,
    input: UpdateApiKeyOptions,
    permissions: string[] | undefined,
  ): Promise<Key> {
    this.assertExpiration(input.expiresAt);
    RequestIdentity.assertApiKeyCanCommit(em, apiKey);
    const previous = {
      name: apiKey.name,
      enabled: apiKey.enabled,
      expiresAt: apiKey.expiresAt,
      permissions: apiKey.permissions,
      lastUsedAt: apiKey.lastUsedAt,
    };
    if (input.name !== undefined) apiKey.name = input.name;
    if (input.enabled !== undefined) apiKey.enabled = input.enabled;
    if (input.expiresAt !== undefined) apiKey.expiresAt = input.expiresAt;
    if (permissions !== undefined) apiKey.permissions = permissions;
    // Commit the final use before revocation removes the interceptor's identity.
    if (input.enabled === false && RequestIdentity.isCurrentApiKey(apiKey))
      apiKey.lastUsedAt = new Date();
    try {
      await em.persist(apiKey).flush();
    } catch (error) {
      Object.assign(apiKey, previous);
      throw error;
    }
    RequestIdentity.updateApiKey(em, options, apiKey);
    return apiKey;
  }

  /** Revokes the request identity only after deletion succeeds. */
  static async delete<Key extends ApiKey>(
    em: EntityManager,
    options: AuthModuleOptions,
    apiKey: Key,
  ): Promise<Key> {
    RequestIdentity.assertApiKeyCanCommit(em, apiKey);
    await em.remove(apiKey).flush();
    RequestIdentity.updateApiKey(em, options, apiKey, true);
    return apiKey;
  }
}
