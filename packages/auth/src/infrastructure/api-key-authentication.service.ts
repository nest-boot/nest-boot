import { EntityManager, Reference } from "@mikro-orm/core";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import type { ApiKeyValidation } from "../types/api-key-validation.type.js";
import { hashApiKey } from "../utils/api-key-credential.util.js";

/**
 * Authenticates both credential kinds; management stays in their domain services.
 * @internal
 */
@Injectable()
export class ApiKeyAuthenticationService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Resolves one unambiguous, active credential and its owner.
   * @param plaintext - Unhashed API key presented by the caller.
   * @returns Validated credential and its owning identity.
   * @throws {UnauthorizedException} When the credential or its owner is invalid.
   */
  async validate(plaintext: string): Promise<ApiKeyValidation> {
    if (!plaintext) throw new UnauthorizedException("Missing API key");
    const key = hashApiKey(plaintext);
    const userKey = await this.em.findOne(
      UserApiKey,
      { key },
      { populate: ["user"] },
    );
    const memberKey = await this.em.findOne(
      MemberApiKey,
      { key },
      { populate: ["member.workspace", "member.user"] },
    );
    if ((!userKey && !memberKey) || (userKey && memberKey)) {
      throw new UnauthorizedException("Invalid API key");
    }
    const apiKey = userKey ?? memberKey;
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
    if (!memberKey) throw new UnauthorizedException("Invalid API key");
    if (!memberKey.member) throw new UnauthorizedException("Invalid API key");
    const member = Reference.unwrapReference(memberKey.member);
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
    return {
      apiKey: memberKey,
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
    // Forking copies the session context without changing the request identity.
    // An existing transaction remains attached; unrelated pending writes do not.
    const recorder = new ApiKeyAuthenticationService(
      this.em.fork({ useContext: false, keepTransactionContext: true }),
    );
    return () => recorder.recordUsage(apiKey);
  }

  /**
   * Records successful use in the credential's own table. Deleted keys remain deleted.
   * @param apiKey - API key whose metadata is being accessed.
   * @returns Key metadata after recording its last-used timestamp.
   */
  async recordUsage(apiKey: ApiKeyMetadata): Promise<ApiKeyMetadata> {
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
        MemberApiKey,
        { id: apiKey.id },
        { lastUsedAt: now, updatedAt: now },
      );
    }
    return apiKey;
  }
}
