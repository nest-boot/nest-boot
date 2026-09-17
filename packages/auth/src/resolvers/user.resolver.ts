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
import { UserPermission } from "../enums/user-permission.enum.js";
import { UserRole } from "../enums/user-role.enum.js";
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
import { AccountService } from "../services/account.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { SessionService } from "../services/session.service.js";
import { UserService } from "../services/user.service.js";
import { UserApiKeyService } from "../services/user-api-key.service.js";
import { WorkspaceService } from "../services/workspace.service.js";

/** GraphQL transport for user administration. */
@Resolver(() => User)
export class UserResolver {
  /** Creates the user-management GraphQL resolver. */
  constructor(
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly apiKeyService: UserApiKeyService,
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
  @ResolveField(() => UserApiKey, { nullable: true })
  async apiKey(
    @Parent() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<UserApiKey | null> {
    return await this.apiKeyService.getUserApiKey(id, user);
  }

  /** Paginates API keys owned by the parent user. */
  @ResolveField(() => UserApiKeyConnection)
  async apiKeys(
    @Parent() user: User,
    @Args({ type: () => UserApiKeyConnectionArgs })
    args: ConnectionArgsInterface<UserApiKey>,
  ) {
    return await this.apiKeyService.getUserApiKeyConnection(user, args);
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
  @Query(() => [UserRole])
  userRoles(): string[] {
    return this.userService.listRoles().map(({ name }) => name);
  }

  /** Lists permissions available to user-administration roles. */
  @Query(() => [UserPermission])
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
  @Mutation(() => CreateUserPayload)
  async createUser(
    @Args("input") input: CreateUserInput,
  ): Promise<CreateUserPayload> {
    const user = await this.userService.createUser(input);
    return { id: user.id };
  }

  /** Updates mutable user profile fields. */
  @Mutation(() => UpdateUserPayload)
  async updateUser(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateUserInput,
  ): Promise<UpdateUserPayload> {
    const user = await this.userService.updateUser(id, { ...input });
    return { id: user.id };
  }

  /** Replaces the direct permissions assigned to a user. */
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

  /** Replaces the application roles assigned to a user. */
  @Mutation(() => SetUserRolesPayload)
  async setUserRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetUserRolesInput,
  ): Promise<SetUserRolesPayload> {
    const user = await this.userService.setUserRoles(id, input.roles);
    return { id: user.id };
  }

  /** Bans a user and revokes their sessions. */
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

  /** Removes an active user ban. */
  @Mutation(() => UnbanUserPayload)
  async unbanUser(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<UnbanUserPayload> {
    const user = await this.userService.unbanUser(id);
    return { id: user.id };
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
