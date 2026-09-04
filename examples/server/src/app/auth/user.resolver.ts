import {
  type BaseSession,
  CurrentSession,
  CurrentUser,
  SessionService,
  UserCan,
  UserService,
} from '@nest-boot/auth';
import {
  Args,
  Context,
  ID,
  Mutation,
  Query,
  Resolver,
} from '@nest-boot/graphql';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

import { User } from '../user/user.entity.js';
import { applyAuthResponseHeaders } from './auth-response-headers.util.js';
import { Account } from './entities/account.entity.js';
import { Session } from './entities/session.entity.js';
import {
  BanUserInput,
  CreateUserInput,
  ListUsersInput,
  SetUserPasswordInput,
  SetUserPermissionsInput,
  SetUserRolesInput,
  UpdateUserInput,
} from './inputs/user.input.js';
import { AuthSessionType } from './types/auth.type.js';
import { AuthRoleType } from './types/auth-role.type.js';
import { UserListType } from './types/user.type.js';

/** GraphQL transport for user administration. */
@Resolver(() => User)
export class UserResolver {
  /** Creates the user-management GraphQL resolver. */
  constructor(
    private readonly userService: UserService<User, Account, Session>,
    private readonly sessionService: SessionService,
  ) {}

  /** Lists configured user-administration roles. */
  @UserCan('set-role', User)
  @Query(() => [AuthRoleType])
  userRoles(): AuthRoleType[] {
    return this.userService.listRoles();
  }

  /** Lists permissions available to user-administration roles. */
  @UserCan('set-role', User)
  @Query(() => [String])
  userPermissions(): string[] {
    return this.userService.listPermissions();
  }

  /** Lists users with offset pagination and optional search. */
  @UserCan('list', User)
  @Query(() => UserListType)
  async users(
    @Args('input', { nullable: true }) input?: ListUsersInput,
  ): Promise<UserListType> {
    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;
    const result = await this.userService.listUsers({
      limit,
      offset,
      searchValue: input?.search,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
    return { ...result, limit, offset };
  }

  /** Returns a user by identifier. */
  @UserCan('get', User)
  @Query(() => User, { nullable: true })
  async user(@Args('id', { type: () => ID }) id: string): Promise<User | null> {
    return await this.userService.getUser(id);
  }

  /** Creates a credential user. */
  @UserCan('create', User)
  @Mutation(() => User)
  async createUser(@Args('input') input: CreateUserInput) {
    return await this.userService.createUser(input);
  }

  /** Updates mutable user profile fields. */
  @UserCan('update', User)
  @Mutation(() => User)
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ) {
    const user = await this.getUserOrFail(id);
    return await this.userService.updateUser(user, { ...input });
  }

  /** Replaces the direct permissions assigned to a user. */
  @UserCan('set-role', User)
  @Mutation(() => User)
  async setUserPermissions(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SetUserPermissionsInput,
  ) {
    const user = await this.getUserOrFail(id);
    return await this.userService.setUserPermissions(user, input.permissions);
  }

  /** Replaces the application roles assigned to a user. */
  @UserCan('set-role', User)
  @Mutation(() => User)
  async setUserRoles(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SetUserRolesInput,
  ) {
    const user = await this.getUserOrFail(id);
    return await this.userService.setRole(user, input.roles);
  }

  /** Bans a user and revokes their sessions. */
  @UserCan('ban', User)
  @Mutation(() => User)
  async banUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { nullable: true }) input?: BanUserInput,
  ) {
    const user = await this.getUserOrFail(id);
    return await this.userService.banUser(user, {
      banExpiresIn: input?.expiresIn,
      banReason: input?.reason,
    });
  }

  /** Removes an active user ban. */
  @UserCan('ban', User)
  @Mutation(() => User)
  async unbanUser(@Args('id', { type: () => ID }) id: string) {
    return await this.userService.unbanUser(await this.getUserOrFail(id));
  }

  /** Lists active sessions belonging to a user. */
  @UserCan('list', Session)
  @Query(() => [AuthSessionType])
  async userSessions(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<AuthSessionType[]> {
    const sessions = await this.userService.listUserSessions(
      await this.getUserOrFail(userId),
    );
    return sessions.map((session) => ({
      id: session.id,
      token: session.token,
      current: false,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress ?? null,
      userAgent: session.userAgent ?? null,
      impersonatedById: session.impersonatedBy
        ? String(session.impersonatedBy.id)
        : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  /** Revokes one user session by token. */
  @UserCan('revoke', Session)
  @Mutation(() => Boolean)
  async revokeUserSession(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('token') token: string,
  ): Promise<boolean> {
    return await this.userService.revokeUserSession(
      await this.getUserOrFail(userId),
      token,
    );
  }

  /** Revokes all sessions belonging to a user. */
  @UserCan('revoke', Session)
  @Mutation(() => Boolean)
  async revokeUserSessions(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<boolean> {
    await this.userService.revokeUserSessions(await this.getUserOrFail(userId));
    return true;
  }

  /** Replaces a user's credential password. */
  @UserCan('set-password', User)
  @Mutation(() => Boolean)
  async setUserPassword(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SetUserPasswordInput,
  ): Promise<boolean> {
    await this.userService.setUserPassword(
      await this.getUserOrFail(id),
      input.password,
    );
    return true;
  }

  /** Permanently deletes a user. */
  @UserCan('delete', User)
  @Mutation(() => User)
  async deleteUser(@Args('id', { type: () => ID }) id: string) {
    return await this.userService.removeUser(await this.getUserOrFail(id));
  }

  /** Starts a browser session that acts as another user. */
  @Mutation(() => User)
  async impersonateUser(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() administrator: User,
    @Context('res') response: Response,
  ): Promise<User> {
    const result = await this.userService.impersonateUser(
      administrator,
      await this.getUserOrFail(id),
    );
    applyAuthResponseHeaders(
      response,
      await this.sessionService.createSessionHeaders(result.session.token),
    );
    return result.user;
  }

  /** Restores the administrator session that started impersonation. */
  @Mutation(() => User, { nullable: true })
  async stopImpersonating(
    @CurrentSession() currentSession: BaseSession,
    @Context('res') response: Response,
  ): Promise<User | null> {
    const result = await this.userService.stopImpersonating(currentSession);
    if (!result) return null;

    applyAuthResponseHeaders(
      response,
      await this.sessionService.createSessionHeaders(result.session.token),
    );
    return result.user;
  }

  private async getUserOrFail(id: string): Promise<User> {
    const user = await this.userService.getUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
