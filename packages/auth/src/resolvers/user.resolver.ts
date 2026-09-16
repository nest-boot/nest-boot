import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";

import {
  AccountConnection,
  AccountConnectionArgs,
} from "../connections/account.connection-definition.js";
import {
  ApiKeyConnection,
  ApiKeyConnectionArgs,
} from "../connections/api-key.connection-definition.js";
import {
  InvitationConnection,
  InvitationConnectionArgs,
} from "../connections/invitation.connection-definition.js";
import {
  SessionConnection,
  SessionConnectionArgs,
} from "../connections/session.connection-definition.js";
import {
  UserConnection,
  UserConnectionArgs,
} from "../connections/user.connection-definition.js";
import {
  WorkspaceConnection,
  WorkspaceConnectionArgs,
} from "../connections/workspace.connection-definition.js";
import { type Account } from "../entities/account.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { type Invitation } from "../entities/invitation.entity.js";
import { type Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { type Workspace } from "../entities/workspace.entity.js";
import {
  BanUserInput,
  CreateUserInput,
  SetUserPasswordInput,
  SetUserPermissionsInput,
  SetUserRolesInput,
  UpdateUserInput,
} from "../inputs/user.input.js";
import { AccountService } from "../services/account.service.js";
import { ApiKeyService } from "../services/api-key.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { DeleteUserPayload } from "../types/delete-user-payload.type.js";

/** GraphQL transport for user administration. */
@Resolver(() => User)
export class UserResolver {
  /** Creates the user-management GraphQL resolver. */
  constructor(
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly apiKeyService: ApiKeyService,
    private readonly sessionService: SessionService,
    private readonly invitationService: InvitationService,
    private readonly accountService: AccountService,
  ) {}

  /** Lists active sessions belonging to the parent user after service authorization. */
  @ResolveField(() => SessionConnection)
  async sessions(
    @Parent() user: User,
    @Args({ type: () => SessionConnectionArgs })
    args: ConnectionArgsInterface<Session>,
  ) {
    return await this.sessionService.getSessionConnectionByUser(user, args);
  }

  /** Paginates the parent's linked accounts after service authorization. */
  @ResolveField(() => AccountConnection)
  async accounts(
    @Parent() user: User,
    @Args({ type: () => AccountConnectionArgs })
    args: ConnectionArgsInterface<Account>,
  ) {
    return await this.accountService.getAccountConnectionByUser(user, args);
  }

  /** Paginates workspaces joined by the parent user. */
  @ResolveField(() => WorkspaceConnection)
  async workspaces(
    @Parent() user: User,
    @Args({ type: () => WorkspaceConnectionArgs })
    args: ConnectionArgsInterface<Workspace>,
  ) {
    return await this.workspaceService.getWorkspaceConnectionByUser(user, args);
  }

  /** Returns an accessible API key owned by the parent user. */
  @ResolveField(() => ApiKey, { nullable: true })
  async apiKey(
    @Parent() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKey | null> {
    return await this.apiKeyService.getUserApiKey(id, user);
  }

  /** Paginates API keys owned by the parent user. */
  @ResolveField(() => ApiKeyConnection)
  async apiKeys(
    @Parent() user: User,
    @Args({ type: () => ApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
  ) {
    return await this.apiKeyService.getApiKeyConnectionByUser(user, args);
  }

  /** Paginates pending invitations addressed to the parent user. */
  @ResolveField(() => InvitationConnection)
  async invitations(
    @Parent() user: User,
    @Args({ type: () => InvitationConnectionArgs })
    args: ConnectionArgsInterface<Invitation>,
  ) {
    return await this.invitationService.getInvitationConnectionByUser(
      user,
      args,
    );
  }

  /** Lists configured user-administration roles. */
  @Query(() => [String])
  userRoles(): string[] {
    return this.userService.listRoles().map(({ name }) => name);
  }

  /** Lists permissions available to user-administration roles. */
  @Query(() => [String])
  userPermissions(): string[] {
    return this.userService.listPermissions();
  }

  /** Paginates users using the application's connection definition. */
  @Query(() => UserConnection)
  async users(
    @Args({ type: () => UserConnectionArgs })
    args: ConnectionArgsInterface<User>,
  ) {
    return await this.userService.getUserConnection(args);
  }

  /** Returns a user by identifier. */
  @Query(() => User, { nullable: true })
  async user(@Args("id", { type: () => ID }) id: string): Promise<User | null> {
    return await this.userService.getUser(id);
  }

  /** Creates a credential user. */
  @Mutation(() => User)
  async createUser(@Args("input") input: CreateUserInput) {
    return await this.userService.createUser(input);
  }

  /** Updates mutable user profile fields. */
  @Mutation(() => User)
  async updateUser(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateUserInput,
  ) {
    return await this.userService.updateUser(id, { ...input });
  }

  /** Replaces the direct permissions assigned to a user. */
  @Mutation(() => User)
  async setUserPermissions(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserPermissionsInput,
  ) {
    return await this.userService.setUserPermissions(id, input.permissions);
  }

  /** Replaces the application roles assigned to a user. */
  @Mutation(() => User)
  async setUserRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserRolesInput,
  ) {
    return await this.userService.setUserRoles(id, input.roles);
  }

  /** Bans a user and revokes their sessions. */
  @Mutation(() => User)
  async banUser(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { nullable: true }) input?: BanUserInput,
  ) {
    return await this.userService.banUser(id, {
      banExpiresIn: input?.expiresIn,
      banReason: input?.reason,
    });
  }

  /** Removes an active user ban. */
  @Mutation(() => User)
  async unbanUser(@Args("id", { type: () => ID }) id: string) {
    return await this.userService.unbanUser(id);
  }

  /** Replaces a user's credential password. */
  @Mutation(() => Boolean)
  async setUserPassword(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserPasswordInput,
  ): Promise<boolean> {
    await this.userService.setUserPassword(id, input.password);
    return true;
  }

  /** Permanently deletes a user and returns only the deleted user's ID. */
  @Mutation(() => DeleteUserPayload)
  async deleteUser(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DeleteUserPayload> {
    const user = await this.userService.deleteUser(id);
    return { id: user.id };
  }
}
