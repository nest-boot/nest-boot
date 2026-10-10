import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";

import { CurrentSession } from "../decorators/current-session.decorator.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { AuthService } from "../services/auth.service.js";
import { SessionService } from "../services/session.service.js";

/** GraphQL transport for session inspection, revocation and impersonation. */
@Resolver(() => Session)
export class SessionResolver {
  /**
   * Creates the session-management resolver.
   * @param sessionService - Service for session queries and revocation.
   * @param authService - Service for authentication operations.
   */
  constructor(
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Returns the session represented by the current request.
   * @param currentSession - Session represented by the current request.
   * @returns Current authenticated session, or null.
   */
  @Query(() => Session, { nullable: true })
  currentSession(
    @CurrentSession() currentSession: Session | null,
  ): Session | null {
    return currentSession;
  }

  /**
   * Whether the parent session is making the current request.
   * @param session - Session whose metadata is being accessed.
   * @param currentSession - Session represented by the current request.
   * @returns Whether the parent session is the current request's session.
   */
  @ResolveField(() => Boolean)
  current(
    @Parent() session: Session,
    @CurrentSession() currentSession: Session | null,
  ): boolean {
    return session.id === currentSession?.id;
  }

  /**
   * Administrator that started the parent impersonation session.
   * @param session - Session whose metadata is being accessed.
   * @returns Identifier of the impersonating administrator, or null.
   */
  @ResolveField(() => ID, { nullable: true })
  impersonatedById(@Parent() session: Session): string | null {
    return session.impersonatedBy ? String(session.impersonatedBy.id) : null;
  }

  /**
   * Resolves the administrator after Service-level profile authorization.
   * @param session - Session whose metadata is being accessed.
   * @returns Administrator who started impersonation, or null.
   */
  @ResolveField(() => User, { nullable: true })
  async impersonatedBy(@Parent() session: Session): Promise<User | null> {
    return await this.sessionService.getSessionImpersonator(session);
  }

  /**
   * Revokes one active session owned by the authenticated user.
   * @param id - Identifier of the record to access.
   * @returns Whether the selected session was revoked successfully.
   */
  @Mutation(() => Boolean)
  async revokeCurrentUserSession(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return await this.sessionService.revokeCurrentUserSession(id);
  }

  /**
   * Revokes every active session except the current session.
   * @returns Whether the other sessions were revoked successfully.
   */
  @Mutation(() => Boolean)
  async revokeCurrentUserOtherSessions(): Promise<boolean> {
    return await this.sessionService.revokeCurrentUserOtherSessions();
  }

  /**
   * Revokes every active session owned by the authenticated user.
   * @returns Whether the user's sessions were revoked successfully.
   */
  @Mutation(() => Boolean)
  async revokeCurrentUserSessions(): Promise<boolean> {
    return await this.sessionService.revokeCurrentUserSessions();
  }

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
