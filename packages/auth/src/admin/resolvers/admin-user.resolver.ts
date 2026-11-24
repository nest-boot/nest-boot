import { Args, ID, Info, Mutation, Query, Resolver } from "@nest-boot/graphql";
import { type ConnectionArgsInterface } from "@nest-boot/graphql-connection";
import { type GraphQLResolveInfo } from "graphql";

import {
  UserConnection,
  UserConnectionArgs,
} from "../../core/connections/user.connection-definition.js";
import { User } from "../../core/entities/user.entity.js";
import { UserService } from "../../core/services/user.service.js";
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

/** Optional user administration API. */
@Resolver(() => User)
export class AdminUserResolver {
  /**
   * Creates this resolver.
   * @param userService - Authorized user administration.
   */
  constructor(private readonly userService: UserService) {}

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
