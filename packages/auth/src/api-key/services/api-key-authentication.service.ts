import { EntityManager, Reference } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { resolveAuthFeatures } from "../../core/utils/resolve-auth-features.util.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import type { ApiKeyValidation } from "../types/api-key-validation.type.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";
import { assertApiKeyOwner } from "../utils/assert-api-key-owner.util.js";

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
    const owners: ("user" | "workspace_member" | "system_account")[] = [
      ...(features.userApiKey ? ["user" as const] : []),
      ...(features.workspaceApiKey ? ["workspace_member" as const] : []),
      ...(features.systemApiKey ? ["system_account" as const] : []),
    ];
    const key = hashApiKey(plaintext);
    const apiKey = await this.em.findOne(
      ApiKey,
      {
        key,
        ownerType: { $in: owners },
      },
      { refresh: true },
    );
    if (!apiKey || !owners.includes(apiKey.ownerType)) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (apiKey.revokedAt) {
      throw new UnauthorizedException("API key is revoked");
    }
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      throw new UnauthorizedException("API key has expired");
    }
    // Owner rows may have been deleted. Re-read them rather than trusting an
    // uninitialized reference or an identity-map entry retained by this manager.
    const ownerId = apiKey.owner?.id;
    if (!ownerId) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (apiKey.ownerType === "system_account") {
      const systemAccount = await this.em.findOne(SystemAccount, ownerId, {
        refresh: true,
      });
      if (!systemAccount?.enabled) {
        throw new UnauthorizedException("Invalid API key");
      }
      assertApiKeyOwner(apiKey, "system_account");
      return {
        apiKey: toApiKeyView(apiKey),
        ownerType: "system_account",
        systemAccount,
      };
    }
    if (apiKey.ownerType === "user") {
      const user = await this.em.findOne(User, ownerId, { refresh: true });
      if (!user) {
        throw new UnauthorizedException("Invalid API key");
      }
      if (
        user.banned &&
        (!user.banExpiresAt || user.banExpiresAt > new Date())
      ) {
        throw new UnauthorizedException("Invalid API key");
      }
      assertApiKeyOwner(apiKey, "user");
      return { apiKey: toApiKeyView(apiKey), ownerType: "user", user };
    }
    const member = await this.em.findOne(WorkspaceMember, ownerId, {
      refresh: true,
      populate: ["workspace", "user"],
    });
    if (!member) {
      throw new UnauthorizedException("Invalid API key");
    }
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
    assertApiKeyOwner(apiKey, "workspace_member");
    return {
      apiKey: toApiKeyView(apiKey),
      ownerType: "workspace_member",
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
      ApiKey,
      { id: apiKey.id, ownerType: apiKey.ownerType },
      { lastUsedAt: now, updatedAt: now },
    );
    return apiKey;
  }
}
