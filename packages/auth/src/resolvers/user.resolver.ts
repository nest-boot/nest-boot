import {
  Args,
  ID,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import type { GraphQLResolveInfo } from "graphql";

import {
  AccountConnection,
  AccountConnectionArgs,
} from "../connections/account.connection-definition.js";
import {
  SessionConnection,
  SessionConnectionArgs,
} from "../connections/session.connection-definition.js";
import {
  UserConnection,
  UserConnectionArgs,
} from "../connections/user.connection-definition.js";
import {
  UserApiKeyConnection,
  UserApiKeyConnectionArgs,
} from "../connections/user-api-key.connection-definition.js";
import {
  WorkspaceConnection,
  WorkspaceConnectionArgs,
} from "../connections/workspace.connection-definition.js";
import { type Account } from "../entities/account.entity.js";
import { type Invitation } from "../entities/invitation.entity.js";
import { type Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { type Workspace } from "../entities/workspace.entity.js";
import {
  InvitationConnection,
  InvitationConnectionArgs,
} from "../features/invitations/invitation.connection-definition.js";
import { InvitationService } from "../features/invitations/invitation.service.js";
import { BanUserInput } from "../inputs/ban-user.input.js";
import { CreateUserInput } from "../inputs/create-user.input.js";
import { SetUserPasswordInput } from "../inputs/set-user-password.input.js";
import { SetUserPermissionsInput } from "../inputs/set-user-permissions.input.js";
import { SetUserRolesInput } from "../inputs/set-user-roles.input.js";
import { UpdateUserInput } from "../inputs/update-user.input.js";
import { BanUserPayload } from "../objects/ban-user-payload.object.js";
import { CreateUserPayload } from "../objects/create-user-payload.object.js";
import { DeleteUserPayload } from "../objects/delete-user-payload.object.js";
import { SetUserPermissionsPayload } from "../objects/set-user-permissions-payload.object.js";
import { SetUserRolesPayload } from "../objects/set-user-roles-payload.object.js";
import { UnbanUserPayload } from "../objects/unban-user-payload.object.js";
import { UpdateUserPayload } from "../objects/update-user-payload.object.js";
import { UserPermissionOption } from "../objects/user-permission-option.object.js";
import { UserRoleOption } from "../objects/user-role-option.object.js";
import { AccountService } from "../services/account.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { UserApiKeyService } from "../services/user-api-key.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";

/** GraphQL transport for user administration. */
@Resolver(() => User)
export class UserResolver {
  /**
   * Creates the user-management GraphQL resolver.
   * @param userService - Service for user profiles and permissions.
   * @param workspaceService - Service for workspace queries and mutations.
   * @param apiKeyService - Service for validating or managing API keys.
   * @param sessionService - Service for session queries and revocation.
   * @param invitationService - Service for invitation queries and mutations.
   * @param accountService - Service for linked authentication accounts.
   */
  constructor(
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly apiKeyService: UserApiKeyService,
    private readonly sessionService: SessionService,
    private readonly invitationService: InvitationService,
    private readonly accountService: AccountService,
  ) {}

  /**
   * Lists active sessions belonging to the parent user after service authorization.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated active sessions belonging to the user.
   */
  @ResolveField(() => SessionConnection)
  async sessions(
    @Parent() user: User,
    @Args({ type: () => SessionConnectionArgs })
    args: ConnectionArgsInterface<Session>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.sessionService.getSessionConnectionByUser(
      user,
      args,
      info,
    );
  }

  /**
   * Paginates the parent's linked accounts after service authorization.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated linked accounts with credentials omitted.
   */
  @ResolveField(() => AccountConnection)
  async accounts(
    @Parent() user: User,
    @Args({ type: () => AccountConnectionArgs })
    args: ConnectionArgsInterface<Account>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.accountService.getAccountConnectionByUser(
      user,
      args,
      info,
    );
  }

  /**
   * Paginates workspaces joined by the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated workspaces accessible to the user.
   */
  @ResolveField(() => WorkspaceConnection)
  async workspaces(
    @Parent() user: User,
    @Args({ type: () => WorkspaceConnectionArgs })
    args: ConnectionArgsInterface<Workspace>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.workspaceService.getWorkspaceConnectionByUser(
      user,
      args,
      info,
    );
  }

  /**
   * Returns an accessible API key owned by the parent user.
   * @param user - The user whose account is being accessed.
   * @param id - Identifier of the record to access.
   * @returns Accessible API key metadata, or null if unavailable.
   */
  @ResolveField(() => UserApiKey, { nullable: true })
  async apiKey(
    @Parent() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKeyMetadata<UserApiKey> | null> {
    return await this.apiKeyService.getUserApiKey(id, user);
  }

  /**
   * Paginates API keys owned by the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated API key metadata with credential hashes omitted.
   */
  @ResolveField(() => UserApiKeyConnection)
  async apiKeys(
    @Parent() user: User,
    @Args({ type: () => UserApiKeyConnectionArgs })
    args: ConnectionArgsInterface<UserApiKey>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.apiKeyService.getUserApiKeyConnection(user, args, info);
  }

  /**
   * Paginates pending invitations addressed to the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated invitations visible to the current principal.
   */
  @ResolveField(() => InvitationConnection)
  async invitations(
    @Parent() user: User,
    @Args({ type: () => InvitationConnectionArgs })
    args: ConnectionArgsInterface<Invitation>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.invitationService.getInvitationConnectionByUser(
      user,
      args,
      info,
    );
  }

  /**
   * Lists configured user roles with the current principal's grant availability.
   * @returns User role choices and whether each may be granted.
   */
  @Query(() => [UserRoleOption])
  userRoles(): UserRoleOption[] {
    return this.userService.listRoles();
  }

  /**
   * Lists configured user permissions with the current principal's grant availability.
   * @returns User permission choices and whether each may be granted.
   */
  @Query(() => [UserPermissionOption])
  userPermissions(): UserPermissionOption[] {
    return this.userService.listPermissions();
  }

  /**
   * Paginates users using the application's connection definition.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated users matching the query.
   */
  @Query(() => UserConnection)
  async users(
    @Args({ type: () => UserConnectionArgs })
    args: ConnectionArgsInterface<User>,
    @Info() info?: GraphQLResolveInfo,
  ) {
    return await this.userService.getUserConnection(args, info);
  }

  /**
   * Returns a user by identifier.
   * @param id - Identifier of the record to access.
   * @returns Matching user, or null if unavailable.
   */
  @Query(() => User, { nullable: true })
  async user(@Args("id", { type: () => ID }) id: string): Promise<User | null> {
    return await this.userService.getUser(id);
  }

  /**
   * Creates a credential user.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the created user.
   */
  @Mutation(() => CreateUserPayload)
  async createUser(
    @Args("input") input: CreateUserInput,
  ): Promise<CreateUserPayload> {
    const user = await this.userService.createUser(input);
    return { id: user.id };
  }

  /**
   * Updates mutable user profile fields.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the updated user.
   */
  @Mutation(() => UpdateUserPayload)
  async updateUser(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateUserInput,
  ): Promise<UpdateUserPayload> {
    const user = await this.userService.updateUser(id, { ...input });
    return { id: user.id };
  }

  /**
   * Replaces the direct permissions assigned to a user.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the user whose permissions were replaced.
   */
  @Mutation(() => SetUserPermissionsPayload)
  async setUserPermissions(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserPermissionsInput,
  ): Promise<SetUserPermissionsPayload> {
    const user = await this.userService.setUserPermissions(
      id,
      input.permissions,
    );
    return { id: user.id };
  }

  /**
   * Replaces the application roles assigned to a user.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the user whose roles were replaced.
   */
  @Mutation(() => SetUserRolesPayload)
  async setUserRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserRolesInput,
  ): Promise<SetUserRolesPayload> {
    const user = await this.userService.setUserRoles(id, input.roles);
    return { id: user.id };
  }

  /**
   * Bans a user and revokes their sessions.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Identifier of the banned user.
   */
  @Mutation(() => BanUserPayload)
  async banUser(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { nullable: true, defaultValue: {} }) input?: BanUserInput,
  ): Promise<BanUserPayload> {
    const user = await this.userService.banUser(id, {
      banExpiresIn: input?.expiresIn,
      banReason: input?.reason,
    });
    return { id: user.id };
  }

  /**
   * Removes an active user ban.
   * @param id - Identifier of the record to access.
   * @returns Identifier of the unbanned user.
   */
  @Mutation(() => UnbanUserPayload)
  async unbanUser(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<UnbanUserPayload> {
    const user = await this.userService.unbanUser(id);
    return { id: user.id };
  }

  /**
   * Replaces a user's credential password.
   * @param id - Identifier of the record to access.
   * @param input - Requested field values for the operation.
   * @returns Whether the password was replaced successfully.
   */
  @Mutation(() => Boolean)
  async setUserPassword(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserPasswordInput,
  ): Promise<boolean> {
    await this.userService.setUserPassword(id, input.password);
    return true;
  }

  /**
   * Permanently deletes a user and returns only the deleted user's ID.
   * @param id - Identifier of the record to access.
   * @returns Identifier of the deleted user.
   */
  @Mutation(() => DeleteUserPayload)
  async deleteUser(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DeleteUserPayload> {
    const user = await this.userService.deleteUser(id);
    return { id: user.id };
  }
}
