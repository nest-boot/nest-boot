import { Args, ID, Mutation, Resolver } from "@nest-boot/graphql";

import { Session } from "../../core/entities/session.entity.js";
import { User } from "../../core/entities/user.entity.js";
import { AuthService } from "../../core/services/auth.service.js";
import { SessionService } from "../../core/services/session.service.js";

/** Optional session administration and impersonation. */
@Resolver(() => Session)
export class AdminSessionResolver {
  /**
   * Creates this resolver.
   * @param sessionService - Authorized session administration.
   * @param authService - Impersonation lifecycle.
   */
  constructor(
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Revokes one user session by its public ID.
   * @param userId - Identifier of the user that owns the resource.
   * @param id - Identifier of the record to access.
   * @returns Whether the selected session was revoked.
   */
  @Mutation(() => Boolean)
  async revokeSession(
    @Args("userId", { type: () => ID }) userId: string,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return await this.sessionService.revokeSession(userId, id);
  }

  /**
   * Revokes all sessions belonging to a user.
   * @param userId - Identifier of the user that owns the resource.
   * @returns True after the requested sessions are revoked.
   */
  @Mutation(() => Boolean)
  async revokeUserSessions(
    @Args("userId", { type: () => ID }) userId: string,
  ): Promise<boolean> {
    await this.sessionService.revokeUserSessions(userId);
    return true;
  }

  /**
   * Starts a browser session that acts as another user.
   * @param id - Identifier of the record to access.
   * @returns User represented by the new impersonation session.
   */
  @Mutation(() => User)
  async impersonateUser(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<User> {
    return await this.authService.impersonateUser(id);
  }

  /**
   * Restores the administrator session that started impersonation.
   * @returns Restored administrator, or null when there was no impersonation session.
   */
  @Mutation(() => User, { nullable: true })
  async stopImpersonating(): Promise<User | null> {
    return await this.authService.stopImpersonating();
  }
}
