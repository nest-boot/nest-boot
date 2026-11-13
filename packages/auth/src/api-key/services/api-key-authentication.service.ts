import { EntityManager, Reference } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { runAuthQuery } from "../../common/utils/run-auth-query.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { resolveAuthFeatures } from "../../core/utils/resolve-auth-features.util.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import type { ApiKeyObject } from "../objects/api-key.object.js";
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
    return await runAuthQuery(this.em, async (em) => {
      const owners: ("user" | "workspace_member" | "system_account")[] = [
        ...(features.userApiKey ? ["user" as const] : []),
        ...(features.workspaceApiKey ? ["workspace_member" as const] : []),
        ...(features.systemApiKey ? ["system_account" as const] : []),
      ];
      const key = hashApiKey(plaintext);
      const apiKey = await em.findOne(
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
        const systemAccount = await em.findOne(SystemAccount, ownerId, {
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
        const user = await em.findOne(User, ownerId, { refresh: true });
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
      const member = await em.findOne(WorkspaceMember, ownerId, {
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
    });
  }

  /**
   * Captures the authenticating key's RLS scope before a handler can replace it.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Callback that records usage for the captured key.
   */
  captureUsage(apiKey: ApiKeyObject): () => Promise<ApiKeyObject> {
    const isolated =
      apiKey.ownerType === "system_account" ||
      (apiKey.ownerType === "workspace_member" &&
        this.em.getSessionContext()?.variables?.[
          "app.auth.workspace_member.id"
        ] !== apiKey.member?.id);
    // System credentials and member keys used outside their owning workspace have
    // no request-role access to their key row. Isolate only that captured audit
    // write; never change the business request's database scope or transaction.
    const manager = this.em.fork({
      useContext: false,
      keepTransactionContext: !isolated,
    });
    if (isolated) {
      manager.clearSessionContext();
    }
    return () => this.writeUsage(manager, apiKey);
  }

  /**
   * Records successful use for the credential's concrete owner type. Deleted keys remain deleted.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Key metadata after recording its last-used timestamp.
   */
  async recordUsage(apiKey: ApiKeyObject): Promise<ApiKeyObject> {
    return await this.writeUsage(this.em, apiKey);
  }

  private async writeUsage(
    manager: EntityManager,
    apiKey: ApiKeyObject,
  ): Promise<ApiKeyObject> {
    const now = new Date();
    await manager.nativeUpdate(
      ApiKey,
      { id: apiKey.id, ownerType: apiKey.ownerType },
      { lastUsedAt: now, updatedAt: now },
    );
    apiKey.lastUsedAt = now;
    apiKey.updatedAt = now;
    return apiKey;
  }
}
