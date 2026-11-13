import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";

import { AuthSession } from "../decorators/auth-session.decorator.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { SessionService } from "../services/session.service.js";

/** Self-service session inspection and revocation. */
@Resolver(() => Session)
export class SessionResolver {
  /**
   * Creates this resolver.
   * @param sessionService - Self-service session operations.
   */
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Returns the session represented by the current request.
   * @param currentSession - Session represented by the current request.
   * @returns Current authenticated session, or null.
   */
  @Query(() => Session, { nullable: true })
  currentSession(
    @AuthSession() currentSession: Session | null,
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
    @AuthSession() currentSession: Session | null,
  ): boolean {
    return session.id === currentSession?.id;
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
}
