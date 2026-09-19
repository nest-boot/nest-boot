import { randomBytes } from "node:crypto";

import {
  EntityManager,
  type FilterQuery,
  Reference,
  type RequiredEntityData,
} from "@mikro-orm/core";
import type { EntityManager as SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  ConnectionManager,
} from "@nest-boot/graphql-connection";
import { HashService } from "@nest-boot/hash";
import { RequestContext } from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { UserConnection } from "../connections/user.connection-definition.js";
import { Account } from "../entities/account.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UserApiKey } from "../entities/user-api-key.entity.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import { RevokedAuthenticationException } from "../infrastructure/revoked-authentication.exception.js";
import type { AuthenticatedSession } from "../interfaces/authenticated-session.interface.js";
import type { BanUserOptions } from "../interfaces/ban-user-options.interface.js";
import type { CreateUserOptions } from "../interfaces/create-user-options.interface.js";
import type { ImpersonationOptions } from "../interfaces/impersonation-options.interface.js";
import type { UpdateUserOptions } from "../interfaces/update-user-options.interface.js";
import type { UserHasPermissionsOptions } from "../interfaces/user-has-permissions-options.interface.js";
import type { UserPermissionOption } from "../objects/user-permission-option.object.js";
import type { UserRoleOption } from "../objects/user-role-option.object.js";
import type { AuthModuleRoles } from "../types/auth-module-roles.type.js";
import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_ROLE,
} from "../user.constants.js";
import {
  listAuthPermissions,
  normalizeAuthPermissions,
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "../utils/auth-role.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";
import { resolveUserPermissions } from "../utils/resolve-effective-permissions.util.js";
import { AccessControlService } from "./access-control.service.js";
import { UserDeletionService } from "./user-deletion.service.js";
const CREDENTIAL_ISSUER = "local:credential";
const CREDENTIAL_PROVIDER_ID = "credential";
const MUTABLE_USER_FIELDS = new Set([
  "email",
  "emailVerified",
  "image",
  "name",
]);

/** User management implemented with the built-in MikroORM entities. */
@Injectable()
export class UserService {
  /** Creates a new UserService instance. */
  constructor(
    /** MikroORM entity manager used for authentication persistence. */
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly hashService: HashService,
    private readonly accessControlService: AccessControlService,
    @Inject(UserDeletionService)
    private readonly userDeletionService: {
      deleteUser(
        userId: string,
        beforeDelete?: () => Promise<void>,
      ): Promise<User | null>;
    },
  ) {}

  /** Creates a user and its credential account atomically. */
  async createUser(input: CreateUserOptions): Promise<User> {
    this.accessControlService.assertUserCan("create", User);
    if (input.roles !== undefined || input.permissions !== undefined) {
      this.accessControlService.assertUserCan("set-role", User);
    }
    this.assertPasswordLength(input.password);
    const permissions = this.normalizePermissions(input.permissions ?? []);
    const roles = this.normalizeRoles(input.roles ?? [this.defaultRole]);
    this.accessControlService.assertCanGrantUserPermissions(
      resolveAuthPermissions(roles, permissions, this.roles),
    );
    const email = input.email.trim().toLowerCase();

    const password = await this.hashPassword(input.password);

    return await this.em.transactional(
      async (em) => {
        const user = em.create(User, {
          email,
          emailVerified: false,
          name: input.name,
          permissions,
          roles,
        } as unknown as RequiredEntityData<User>);
        this.accessControlService.assertUserCan("create", user);
        if (input.roles !== undefined || input.permissions !== undefined) {
          this.accessControlService.assertUserCan("set-role", user);
        }
        em.persist(user);
        await em.flush();

        const userId = String(user.id);
        const account = em.create(Account, {
          accountId: userId,
          issuer: CREDENTIAL_ISSUER,
          password,
          providerId: CREDENTIAL_PROVIDER_ID,
          user,
        } as unknown as RequiredEntityData<Account>);
        em.persist(account);
        await em.flush();
        return user;
      },
      { clear: true },
    );
  }

  /** Gets a user by identifier within the request's RLS scope. */
  async getUser(userId: string): Promise<User | null> {
    this.accessControlService.assertUserCan("get", User);
    const user = await this.em.findOne(User, {
      id: userId,
    } as FilterQuery<User>);
    if (user) this.accessControlService.assertUserCan("get", user);
    return user;
  }

  /** Gets a user by normalized email within the request's RLS scope. */
  async getUserByEmail(email: string): Promise<User | null> {
    this.accessControlService.assertUserCan("get", User);
    const user = await this.em.findOne(User, {
      email: email.trim().toLowerCase(),
    } as FilterQuery<User>);
    if (user) this.accessControlService.assertUserCan("get", user);
    return user;
  }

  /** Updates mutable user fields. */
  async updateUser(
    user: User | string,
    input: UpdateUserOptions,
  ): Promise<User> {
    user = await this.resolveUserForAction(user, "update");
    this.accessControlService.assertUserCan("update", user);
    const data = this.createUserUpdateData(input);
    if (input.email !== undefined || input.emailVerified !== undefined) {
      this.accessControlService.assertUserCan("set-email", user);
    }
    this.assertAuthorizationCanCommit(user);
    const previous = {
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      name: user.name,
    };
    try {
      this.em.assign(user, data as never);
      await this.em.persist(user).flush();
    } catch (error) {
      Object.assign(user, previous);
      throw error;
    }
    RequestIdentity.updateUser(this.em, this.options, user);
    return user;
  }

  /** Replaces a user's application permissions. */
  async setUserPermissions(
    user: User | string,
    permissions: string[],
  ): Promise<User> {
    user = await this.resolveUserForAction(user, "set-role");
    this.accessControlService.assertUserCan("set-role", user);
    const normalized = this.normalizePermissions(permissions);
    this.accessControlService.assertCanGrantUserPermissions(normalized);
    this.assertAuthorizationCanCommit(user);
    const previous = user.permissions;
    user.permissions = normalized;
    try {
      await this.em.persist(user).flush();
    } catch (error) {
      user.permissions = previous;
      throw error;
    }
    RequestIdentity.updateUser(this.em, this.options, user);
    return user;
  }

  /** Replaces the roles assigned to a user. */
  async setUserRoles(
    user: User | string,
    roleNames: string | readonly string[],
  ): Promise<User> {
    user = await this.resolveUserForAction(user, "set-role");
    this.accessControlService.assertUserCan("set-role", user);
    const roles = this.normalizeRoles(roleNames);
    this.accessControlService.assertCanGrantUserPermissions(
      resolveAuthPermissions(roles, [], this.roles),
    );
    this.assertAuthorizationCanCommit(user);
    const previous = user.roles;
    user.roles = roles;
    try {
      await this.em.persist(user).flush();
    } catch (error) {
      user.roles = previous;
      throw error;
    }
    RequestIdentity.updateUser(this.em, this.options, user);
    return user;
  }

  private isCurrentUser(user: User): boolean {
    const current = RequestContext.isActive() ? RequestContext.get(User) : null;
    return !!current && current.id === user.id;
  }

  private affectsCurrentAuthentication(user: User): boolean {
    const session = RequestContext.isActive()
      ? RequestContext.get(Session)
      : null;
    return this.isCurrentUser(user) || session?.impersonatedBy?.id === user.id;
  }

  private assertIdentityRevocationCanCommit(user: User): void {
    if (this.affectsCurrentAuthentication(user) && this.em.isInTransaction()) {
      throw new BadRequestException(
        "Revoke your own identity outside an active transaction",
      );
    }
  }

  private assertAuthorizationCanCommit(user: User): void {
    if (this.isCurrentUser(user) && this.em.isInTransaction()) {
      throw new BadRequestException(
        "Change your own authorization outside an active transaction",
      );
    }
  }

  private async resolveUserForAction(
    user: User | string,
    action: string,
  ): Promise<User> {
    if (typeof user !== "string") return user;
    this.accessControlService.assertUserCan(action, User);
    const entity = await this.em.findOne(
      User,
      { id: user } as FilterQuery<User>,
      { refresh: true },
    );
    if (!entity) throw new NotFoundException("User not found");
    return entity;
  }

  /** Lists all configured roles with the current principal's grant availability. */
  listRoles(): UserRoleOption[] {
    this.accessControlService.assertUserCan("set-role", User);
    return Object.entries(this.roles).map(([role, permissions]) => ({
      role,
      grantable: this.accessControlService.canGrantUserPermissions(permissions),
    }));
  }

  /** Lists all configured permissions with the current principal's grant availability. */
  listPermissions(): UserPermissionOption[] {
    this.accessControlService.assertUserCan("set-role", User);
    return listAuthPermissions(this.permissions).map((permission) => ({
      permission,
      grantable: this.accessControlService.canGrantUserPermissions([
        permission,
      ]),
    }));
  }

  /** Resolves permissions inherited from roles plus direct user permissions. */
  getEffectiveUserPermissions(user: User): string[] {
    return resolveUserPermissions(this.options, user);
  }

  /** Paginates users without bypassing application RLS. */
  async getUserConnection(
    args: ConnectionArgsInterface<User>,
  ): Promise<ConnectionInterface<User>> {
    this.accessControlService.assertUserCan("list", User);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<User>(UserConnection, args);
    for (const { node } of connection.edges) {
      this.accessControlService.assertUserCan("list", node);
    }
    return connection;
  }

  /** Bans a user and immediately revokes all of their sessions. */
  async banUser(
    user: User | string,
    input: BanUserOptions = {},
  ): Promise<User> {
    user = await this.resolveUserForAction(user, "ban");
    this.accessControlService.assertUserCan("ban", user);
    this.assertIdentityRevocationCanCommit(user);
    const banExpiresAt =
      input.banExpiresIn === undefined
        ? null
        : new Date(Date.now() + input.banExpiresIn * 1000);
    if (
      input.banExpiresIn !== undefined &&
      (!Number.isSafeInteger(input.banExpiresIn) ||
        input.banExpiresIn <= 0 ||
        Number.isNaN(banExpiresAt?.getTime()))
    ) {
      throw new BadRequestException(
        "Ban duration must be a positive integer number of seconds",
      );
    }
    const previous = {
      banned: user.banned,
      banReason: user.banReason,
      banExpiresAt: user.banExpiresAt,
    };
    user.banned = true;
    user.banReason = input.banReason ?? null;
    user.banExpiresAt = banExpiresAt;
    const apiKey = getCurrentApiKey();

    try {
      await this.em.transactional(
        async (em) => {
          // Persist the final use in the same transaction before revoking identity.
          if (apiKey instanceof UserApiKey && apiKey.user.id === user.id) {
            const now = new Date();
            await em.nativeUpdate(
              UserApiKey,
              { id: apiKey.id },
              {
                lastUsedAt: now,
                updatedAt: now,
              },
            );
          }
          await em.nativeDelete(Session, {
            $or: [{ user: String(user.id) }, { impersonatedBy: user }],
          } as FilterQuery<Session>);
          await em.persist(user).flush();
        },
        { clear: true },
      );
    } catch (error) {
      Object.assign(user, previous);
      throw error;
    }
    if (this.affectsCurrentAuthentication(user)) RequestIdentity.clear(this.em);
    return user;
  }

  /** Removes a user's ban. */
  async unbanUser(user: User | string): Promise<User> {
    user = await this.resolveUserForAction(user, "ban");
    this.accessControlService.assertUserCan("ban", user);
    this.assertAuthorizationCanCommit(user);
    const previous = {
      banned: user.banned,
      banReason: user.banReason,
      banExpiresAt: user.banExpiresAt,
    };
    user.banned = false;
    user.banReason = null;
    user.banExpiresAt = null;
    try {
      await this.em.persist(user).flush();
    } catch (error) {
      Object.assign(user, previous);
      throw error;
    }
    RequestIdentity.updateUser(this.em, this.options, user);
    return user;
  }

  /** Creates a session that impersonates another user. */
  async impersonateUser(
    administrator: User,
    user: User | string,
    input: ImpersonationOptions = {},
  ): Promise<AuthenticatedSession> {
    this.accessControlService.assertCurrentUser(administrator);
    user = await this.resolveUserForAction(user, "impersonate");
    this.accessControlService.assertUserCan("impersonate", user);
    if (this.isAdmin(user)) {
      this.accessControlService.assertUserCan("impersonate-admins", user);
    }
    if (this.isActivelyBanned(user)) {
      throw new ForbiddenException("Banned users cannot be impersonated");
    }
    const session = await this.em.transactional(
      async (em) => {
        const session = this.createSession(em, user, {
          ...input,
          impersonatedBy: administrator,
        });
        await em.persist(session).flush();
        return session;
      },
      { clear: true },
    );
    return { session, user };
  }

  /** Ends impersonation and creates a replacement administrator session. */
  async stopImpersonating(
    currentSession: Session,
    input: ImpersonationOptions = {},
  ): Promise<AuthenticatedSession | null> {
    this.accessControlService.assertCurrentSession(currentSession);
    const impersonatedByReference = currentSession.impersonatedBy;
    if (!impersonatedByReference) return null;
    this.assertIdentityRevocationCanCommit(
      Reference.unwrapReference(impersonatedByReference),
    );

    const result = await this.em.transactional(
      async (em) => {
        const impersonatedBy = Reference.unwrapReference(
          impersonatedByReference,
        ) as User;
        const administrator = await em.findOne(
          User,
          { id: String(impersonatedBy.id) } as FilterQuery<User>,
          { filters: false },
        );
        if (!administrator) return null;
        if (this.isActivelyBanned(administrator)) {
          await em.remove(currentSession).flush();
          return "banned-administrator" as const;
        }

        const session = this.createSession(em, administrator, input);
        em.remove(currentSession).persist(session);
        await em.flush();
        return { session, user: administrator };
      },
      { clear: true },
    );
    // A missing administrator has already cascaded deletion to this session.
    if (result === null) RequestIdentity.clear(this.em);
    // Publish the committed revocation even when restoration returns an error.
    if (result === "banned-administrator") {
      RequestIdentity.clear(this.em);
      throw new RevokedAuthenticationException(
        "Banned administrators cannot restore their session",
      );
    }
    return result;
  }

  /** Permanently deletes a user and all dependent authentication records. */
  async deleteUser(user: User | string): Promise<User> {
    user = await this.resolveUserForAction(user, "delete");
    this.accessControlService.assertUserCan("delete", user);
    this.assertIdentityRevocationCanCommit(user);
    const deleted = await this.userDeletionService.deleteUser(String(user.id));
    if (deleted === null) throw new NotFoundException("User not found");
    if (this.affectsCurrentAuthentication(user)) RequestIdentity.clear(this.em);
    return user;
  }

  /** Sets or replaces a user's credential password. */
  async setUserPassword(
    user: User | string,
    newPassword: string,
  ): Promise<void> {
    user = await this.resolveUserForAction(user, "set-password");
    this.accessControlService.assertUserCan("set-password", user);
    this.assertPasswordLength(newPassword);
    const password = await this.hashPassword(newPassword);
    await this.em.transactional(
      async (em) => {
        const account = await em.findOne(
          Account,
          {
            issuer: CREDENTIAL_ISSUER,
            accountId: String(user.id),
            providerId: CREDENTIAL_PROVIDER_ID,
            user: String(user.id),
          } as FilterQuery<Account>,
          { filters: false },
        );

        if (account) {
          account.password = password;
        } else {
          em.persist(
            em.create(Account, {
              accountId: String(user.id),
              issuer: CREDENTIAL_ISSUER,
              password,
              providerId: CREDENTIAL_PROVIDER_ID,
              user,
            } as unknown as RequiredEntityData<Account>),
          );
        }
        await em.flush();
      },
      { clear: true },
    );
  }

  /** Checks flattened `subject:action` values against a user's permissions. */
  hasPermissions(user: User, input: UserHasPermissionsOptions): boolean {
    const permissions = new Set(this.getEffectiveUserPermissions(user));
    return Object.entries(input.permissions).every(([subject, actions]) =>
      actions.every((action) => permissions.has(`${subject}:${action}`)),
    );
  }

  /** Returns whether any assigned role is classified as administrative. */
  isAdmin(user: User): boolean {
    const adminRoles = new Set(
      this.options.user?.adminRoles ?? DEFAULT_USER_ADMIN_ROLES,
    );
    return (user.roles ?? [this.defaultRole]).some((role) =>
      adminRoles.has(role),
    );
  }

  private normalizeRoles(role: string | readonly string[]): string[] {
    return normalizeAuthRoles(role, this.roles);
  }

  private normalizePermissions(permissions: readonly string[]): string[] {
    return normalizeAuthPermissions(permissions, this.permissions, "User");
  }

  private createUserUpdateData(
    input: UpdateUserOptions,
  ): Record<string, unknown> {
    const unsupportedFields = Object.keys(input).filter(
      (field) => !MUTABLE_USER_FIELDS.has(field),
    );
    if (unsupportedFields.length > 0) {
      throw new BadRequestException(
        `User update contains unsupported fields: ${unsupportedFields.join(", ")}`,
      );
    }

    return {
      ...Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
      ...(input.email === undefined
        ? {}
        : { email: input.email.trim().toLowerCase() }),
    };
  }

  private get roles(): AuthModuleRoles {
    return resolveAuthCatalog(this.options, "user").roles;
  }

  private get defaultRole(): string {
    return this.options.user?.defaultRole ?? DEFAULT_USER_ROLE;
  }

  private get permissions(): readonly string[] {
    return resolveAuthCatalog(this.options, "user").permissions;
  }

  private createSession(
    em: EntityManager,
    user: User,
    input: ImpersonationOptions & { impersonatedBy?: User },
  ): Session {
    const expiresIn = this.options.session?.expiresIn ?? 60 * 60 * 24 * 7;
    return em.create(Session, {
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      impersonatedBy: input.impersonatedBy ?? null,
      ipAddress: input.ipAddress ?? null,
      token: randomBytes(32).toString("base64url"),
      userAgent: input.userAgent ?? null,
      user,
    } as unknown as RequiredEntityData<Session>);
  }

  private async hashPassword(password: string): Promise<string> {
    return await (
      this.options.emailAndPassword?.password?.hash ??
      ((value: string) => this.hashService.hash(value))
    )(password);
  }

  private assertPasswordLength(password: string): void {
    const minimum = this.options.emailAndPassword?.minPasswordLength ?? 8;
    const maximum = this.options.emailAndPassword?.maxPasswordLength ?? 128;

    if (password.length < minimum) {
      throw new BadRequestException(
        `Password must contain at least ${String(minimum)} characters`,
      );
    }
    if (password.length > maximum) {
      throw new BadRequestException(
        `Password must contain at most ${String(maximum)} characters`,
      );
    }
  }

  private isActivelyBanned(user: User): boolean {
    return (
      user.banned &&
      (!user.banExpiresAt || user.banExpiresAt.getTime() > Date.now())
    );
  }
}
