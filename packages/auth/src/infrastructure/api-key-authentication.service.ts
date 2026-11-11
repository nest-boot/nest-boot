import { EntityManager, Reference } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { ApiKeyEntity } from "../entities/api-key.entity.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import type { ApiKeyValidation } from "../types/api-key-validation.type.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";
import { assertApiKeyOwner } from "../utils/assert-api-key-owner.util.js";
import { omitCredentials } from "../utils/omit-credentials.util.js";
import { resolveAuthFeatures } from "../utils/resolve-auth-features.util.js";

/**
 * Authenticates all three credential kinds; management stays in their domain services.
 * @internal
 */
@Injectable()
export class ApiKeyAuthenticationService {
  constructor(
    private readonly em: EntityManager,
    private readonly options: AuthModuleOptions,
  ) {}

  /**
   * Resolves one unambiguous, active credential and its owner.
   * @param plaintext - Unhashed API key presented by the caller.
   * @returns Validated credential and its owning identity.
   * @throws {UnauthorizedException} When the credential or its owner is invalid.
   */
  async validate(plaintext: string): Promise<ApiKeyValidation> {
    if (!plaintext) {
      throw new UnauthorizedException("Missing API key");
    }
    const features = resolveAuthFeatures(this.options);
    if (!features.apiKey) {
      throw new UnauthorizedException("API keys are disabled");
    }
    const owners: ("user" | "member" | "system_account")[] = [
      ...(features.userApiKey ? ["user" as const] : []),
      ...(features.workspaceApiKey ? ["member" as const] : []),
      ...(features.systemAccountApiKey ? ["system_account" as const] : []),
    ];
    const key = hashApiKey(plaintext);
    const apiKey = await this.em.findOne(ApiKeyEntity, {
      key,
      ownerType: { $in: owners },
    });
    if (!apiKey || !owners.includes(apiKey.ownerType)) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (!apiKey.enabled) {
      throw new UnauthorizedException("API key is disabled");
    }
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      throw new UnauthorizedException("API key has expired");
    }
    if (apiKey.ownerType === "system_account") {
      await this.em.populate(apiKey, ["owner"]);
      const systemAccount =
        apiKey.systemAccount && Reference.unwrapReference(apiKey.systemAccount);
      if (!systemAccount?.enabled) {
        throw new UnauthorizedException("Invalid API key");
      }
      assertApiKeyOwner(apiKey, "system_account");
      return {
        apiKey: omitCredentials(apiKey, []),
        ownerType: "system_account",
        systemAccount,
      };
    }
    if (apiKey.ownerType === "user") {
      await this.em.populate(apiKey, ["owner"]);
      if (!apiKey.user) {
        throw new UnauthorizedException("Invalid API key");
      }
      const user = Reference.unwrapReference(apiKey.user);
      if (
        user.banned &&
        (!user.banExpiresAt || user.banExpiresAt > new Date())
      ) {
        throw new UnauthorizedException("Invalid API key");
      }
      assertApiKeyOwner(apiKey, "user");
      return { apiKey: omitCredentials(apiKey, []), ownerType: "user", user };
    }
    await this.em.populate(apiKey, ["owner"]);
    if (!apiKey.member) {
      throw new UnauthorizedException("Invalid API key");
    }
    const member = Reference.unwrapReference(apiKey.member);
    await this.em.populate(member, ["workspace", "user"]);
    const user = member.user ? Reference.unwrapReference(member.user) : null;
    if (
      member.status !== "ACTIVE" ||
      !member.workspace ||
      (member.type === "USER" && !user) ||
      (member.type === "SERVICE_ACCOUNT" && user) ||
      (user?.banned && (!user.banExpiresAt || user.banExpiresAt > new Date()))
    ) {
      throw new UnauthorizedException("Invalid API key");
    }
    const workspace = Reference.unwrapReference(member.workspace);
    assertApiKeyOwner(apiKey, "member");
    return {
      apiKey: omitCredentials(apiKey, []),
      ownerType: "member",
      workspace,
      member,
      user,
    };
  }

  /**
   * Captures the authenticating key's RLS scope before a handler can replace it.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Callback that records usage for the captured key.
   */
  captureUsage(apiKey: ApiKeyMetadata): () => Promise<ApiKeyMetadata> {
    const system = apiKey.ownerType === "system_account";
    // System credentials have no request-role SQL access. Only the framework's
    // captured usage writer bypasses RLS, with an isolated manager and exact key ID.
    // Human/member usage retains the caller's transaction and database scope.
    const manager = this.em.fork({
      useContext: false,
      keepTransactionContext: !system,
    });
    if (system) {
      manager.clearSessionContext();
    }
    const recorder = new ApiKeyAuthenticationService(manager, this.options);
    return () => recorder.recordUsage(apiKey);
  }

  /**
   * Records successful use for the credential's concrete owner type. Deleted keys remain deleted.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Key metadata after recording its last-used timestamp.
   */
  async recordUsage(apiKey: ApiKeyMetadata): Promise<ApiKeyMetadata> {
    const now = new Date();
    apiKey.lastUsedAt = now;
    apiKey.updatedAt = now;
    await this.em.nativeUpdate(
      ApiKeyEntity,
      { id: apiKey.id, ownerType: apiKey.ownerType },
      { lastUsedAt: now, updatedAt: now },
    );
    return apiKey;
  }
}
