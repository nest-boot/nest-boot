import { EntityManager, TransactionContext } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { authorize } from "../../common/utils/authorize.util.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import { AuthContext } from "../../core/auth-context.js";
import { ApiKey, type ApiKeyRecord } from "../entities/api-key.entity.js";
import type { CreateApiKeyOptions } from "../interfaces/create-api-key-options.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import {
  generateApiKey,
  hashApiKey,
} from "../utils/api-key-credential.util.js";
import { isCurrentApiKey } from "../utils/is-current-api-key.util.js";

/**
 * Shared credential authorization, persistence and request-identity synchronization.
 * @internal
 */
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly em: EntityManager,
    private readonly authContext: AuthContext,
  ) {}
  /**
   * Prepares shared credential fields without choosing an owner or authorizing persistence.
   * @param options - Configuration for this operation.
   * @param permissions - Permission names to apply.
   * @param defaultPrefix - Prefix used when no custom prefix is supplied.
   * @returns Plaintext API key and the credential fields to persist.
   */
  prepareCreation(
    options: CreateApiKeyOptions,
    permissions: string[],
    defaultPrefix: string,
  ) {
    this.assertExpiration(options.expiresAt);
    const prefix = options.prefix ?? defaultPrefix;
    const apiKey = generateApiKey(prefix);
    return {
      apiKey,
      data: {
        revokedAt: null,
        expiresAt: options.expiresAt ?? null,
        key: hashApiKey(apiKey),
        name: options.name,
        permissions,
        prefix,
        start: apiKey.slice(0, 8),
      },
    };
  }

  /**
   * Authorizes the created record and every caller-controlled credential field.
   * @param apiKey - Credential with its concrete owner already assigned.
   * @param input - Requested creation fields.
   */
  authorizeCreation(apiKey: ApiKeyRecord, input: CreateApiKeyOptions): void {
    authorize("write", apiKey);
    const fields = ["name", "permissions"];
    if (input.expiresAt !== undefined) {
      fields.push("expiresAt");
    }
    if (input.prefix !== undefined) {
      fields.push("prefix");
    }
    for (const field of fields) {
      authorize("write", apiKey, field);
    }
  }

  /**
   * Validates expiration for both key creation and updates.
   * @param expiresAt - Requested expiration time, or null for no expiration.
   */
  assertExpiration(expiresAt: Date | null | undefined): void {
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException("API key expiration must be in the future");
    }
  }

  /**
   * Writes scalar changes without dirtying ORM snapshots or publishing an uncommitted credential.
   * @param apiKey - API key whose metadata is being accessed.
   * @param input - Requested field values for the operation.
   * @param permissions - Permission names to apply.
   * @returns API key after its changes have been persisted.
   */
  async update<Key extends ApiKeyRecord>(
    apiKey: Key,
    input: UpdateApiKeyOptions,
    permissions: string[] | undefined,
  ): Promise<Key> {
    this.assertCurrentKeyCanChange(apiKey);
    this.assertExpiration(input.expiresAt);
    const data = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
      ...(permissions !== undefined && { permissions }),
    };
    const updated = Object.assign(new ApiKey(), apiKey, data);
    authorize("write", updated);
    for (const field of Object.keys(data)) {
      authorize("write", updated, field);
    }
    if (Object.keys(data).length) {
      updated.updatedAt = new Date();
      const affected = await this.manager.nativeUpdate(
        ApiKey,
        { id: apiKey.id, ownerType: apiKey.ownerType },
        { ...data, updatedAt: updated.updatedAt },
      );
      if (affected === 0) {
        throw new NotFoundException("API key not found");
      }
    }
    this.publish(updated);
    return updated;
  }

  /**
   * Permanently revokes a key, publishing self-revocation only after persistence succeeds.
   * @param apiKey - Authorized credential to revoke.
   * @returns Retained credential metadata with its original revocation time.
   */
  async revoke<Key extends ApiKeyRecord>(apiKey: Key): Promise<Key> {
    this.assertCurrentKeyCanChange(apiKey);
    authorize("write", apiKey, "revokedAt");
    if (apiKey.revokedAt) {
      this.publish(apiKey);
      return apiKey;
    }
    const revokedAt = new Date();
    const candidate = Object.assign(new ApiKey(), apiKey, { revokedAt });
    authorize("write", candidate);
    authorize("write", candidate, "revokedAt");
    // A conditional write preserves the first timestamp under concurrent revocation.
    const current = isCurrentApiKey(apiKey);
    const affected = await this.manager.nativeUpdate(
      ApiKey,
      { id: apiKey.id, ownerType: apiKey.ownerType, revokedAt: null },
      {
        revokedAt,
        updatedAt: revokedAt,
        ...(current && { lastUsedAt: revokedAt }),
      },
    );
    if (affected) {
      candidate.updatedAt = revokedAt;
      if (current) {
        candidate.lastUsedAt = revokedAt;
      }
    } else {
      const persisted = await this.manager.findOne(
        ApiKey,
        { id: apiKey.id, ownerType: apiKey.ownerType },
        { refresh: true, disableIdentityMap: true },
      );
      if (!persisted?.revokedAt) {
        throw new NotFoundException("API key not found");
      }
      candidate.revokedAt = persisted.revokedAt;
      candidate.updatedAt = persisted.updatedAt;
      candidate.lastUsedAt = persisted.lastUsedAt;
    }
    this.publish(candidate);
    return candidate;
  }

  /**
   * Revokes the request identity only after deletion succeeds.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Metadata of the deleted API key.
   */
  async delete<Key extends ApiKeyRecord>(apiKey: Key): Promise<Key> {
    this.assertCurrentKeyCanChange(apiKey);
    await this.manager.remove(apiKey).flush();
    this.publish(apiKey, true);
    return apiKey;
  }
  private get manager(): EntityManager {
    return (
      TransactionContext.getEntityManager(this.em.name) ??
      (RequestContext.isActive()
        ? RequestContext.get(EntityManager)
        : undefined) ??
      this.em
    );
  }
  private publish(apiKey: ApiKeyRecord, deleted = false): void {
    if (!isCurrentApiKey(apiKey)) {
      return;
    }
    if (
      deleted ||
      apiKey.revokedAt ||
      (apiKey.expiresAt && apiKey.expiresAt <= new Date())
    ) {
      this.authContext.clear();
    } else {
      const identity = omitCredentials(apiKey, ["key"]);
      identity.permissions = [...apiKey.permissions];
      this.authContext.set({ apiKey: identity });
    }
  }

  private assertCurrentKeyCanChange(apiKey: ApiKeyRecord): void {
    if (isCurrentApiKey(apiKey) && this.manager.isInTransaction()) {
      throw new BadRequestException(
        "Change the current API key outside an active transaction",
      );
    }
  }
}
