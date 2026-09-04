import { randomBytes } from "node:crypto";

import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
  Reference,
  type RequiredEntityData,
} from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { AuthorizationService } from "./authorization.service.js";
import type { BaseAccount, BaseSession, BaseUser } from "./entities/index.js";
import type { AuthRole } from "./interfaces/auth-role.interface.js";
import type { AuthenticatedSession } from "./interfaces/session-service.interface.js";
import type {
  BanUserOptions,
  CreateUserOptions,
  ImpersonationOptions,
  ListUsersOptions,
  ListUsersResult,
  UpdateUserOptions,
  UserHasPermissionOptions,
} from "./interfaces/user-service.interface.js";
import type { AuthModuleRoles } from "./types/auth-module-roles.type.js";
import {
  DEFAULT_USER_ADMIN_ROLES,
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLE,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import {
  listAuthPermissions,
  listAuthRoles,
  normalizeAuthPermissions,
  normalizeAuthRoles,
  resolveAuthPermissions,
} from "./utils/auth-role.util.js";

const CREDENTIAL_ISSUER = "local:credential";
const CREDENTIAL_PROVIDER_ID = "credential";

/** User management implemented with the configured MikroORM entities. */
@Injectable()
export class UserService<
  User extends BaseUser = BaseUser,
  Account extends BaseAccount = BaseAccount,
  Session extends BaseSession = BaseSession,
> {
  /** Creates a new UserService instance. */
  constructor(
    /** MikroORM entity manager used for authentication persistence. */
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly hashService: HashService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /** Creates a user and its credential account atomically. */
  async createUser(input: CreateUserOptions): Promise<User> {
    this.authorizationService.assertUserCan("create", this.userEntity);
    if (input.roles !== undefined || input.permissions !== undefined) {
      this.authorizationService.assertUserCan("set-role", this.userEntity);
    }
    const permissions = this.normalizePermissions(input.permissions ?? []);

    return await this.runUnrestricted(async () => {
      const password = await this.hashPassword(input.password);
      const user = this.em.create(this.userEntity, {
        ...(input.data ?? {}),
        email: input.email,
        emailVerified: false,
        name: input.name,
        permissions,
        roles: this.normalizeRoles(input.roles ?? [this.defaultRole]),
      } as unknown as RequiredEntityData<User>);
      const account = this.em.create(this.accountEntity, {
        accountId: String(user.id),
        issuer: CREDENTIAL_ISSUER,
        password,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId: String(user.id),
      } as unknown as RequiredEntityData<Account>);

      await this.em.persist(user).persist(account).flush();
      return user;
    });
  }

  /** Gets a user by identifier without applying application RLS filters. */
  async getUser(userId: string): Promise<User | null> {
    this.authorizationService.assertUserCan("get", this.userEntity);
    return await this.runUnrestricted(
      async () =>
        await this.em.findOne(
          this.userEntity,
          { id: userId } as FilterQuery<User>,
          { filters: false },
        ),
    );
  }

  /** Gets a user by normalized email without applying application RLS filters. */
  async getUserByEmail(email: string): Promise<User | null> {
    this.authorizationService.assertUserCan("get", this.userEntity);
    return await this.runUnrestricted(
      async () =>
        await this.em.findOne(
          this.userEntity,
          { email: email.trim().toLowerCase() } as FilterQuery<User>,
          { filters: false },
        ),
    );
  }

  /** Updates mutable user fields. */
  async updateUser(user: User, input: UpdateUserOptions): Promise<User> {
    this.authorizationService.assertUserCan("update", user);
    if (input.email !== undefined) {
      this.authorizationService.assertUserCan("set-email", user);
    }
    if ("banned" in input || "banReason" in input || "banExpiresAt" in input) {
      this.authorizationService.assertUserCan("ban", user);
    }
    if ("roles" in input || "permissions" in input) {
      throw new BadRequestException(
        "Use setRole or setUserPermissions to update authorization fields",
      );
    }
    this.em.assign(user, input as never);
    await this.runUnrestricted(() => this.em.flush());
    return user;
  }

  /** Replaces a user's application permissions. */
  async setUserPermissions(user: User, permissions: string[]): Promise<User> {
    this.authorizationService.assertUserCan("set-role", user);
    user.permissions = this.normalizePermissions(permissions);
    await this.runUnrestricted(() => this.em.flush());
    return user;
  }

  /** Replaces the roles assigned to a user. */
  async setRole(user: User, role: string | readonly string[]): Promise<User> {
    this.authorizationService.assertUserCan("set-role", user);
    user.roles = this.normalizeRoles(role);
    await this.runUnrestricted(() => this.em.flush());
    return user;
  }

  /** Lists configured user-administration roles. */
  listRoles(): AuthRole[] {
    this.authorizationService.assertUserCan("set-role", this.userEntity);
    return listAuthRoles(this.roles);
  }

  /** Lists configured user-administration permissions. */
  listPermissions(): string[] {
    this.authorizationService.assertUserCan("set-role", this.userEntity);
    return listAuthPermissions(this.permissions);
  }

  /** Resolves permissions inherited from roles plus direct user permissions. */
  getUserPermissions(user: User): string[] {
    return resolveAuthPermissions(
      user.roles ?? [this.defaultRole],
      user.permissions ?? [],
      this.roles,
    );
  }

  /** Lists users with Better Auth-compatible search and pagination concepts. */
  async listUsers(
    input: ListUsersOptions = {},
  ): Promise<ListUsersResult<User>> {
    this.authorizationService.assertUserCan("list", this.userEntity);
    return await this.runUnrestricted(async () => {
      const where = this.createUserFilter(input);
      const [users, total] = await this.em.findAndCount(
        this.userEntity,
        where,
        {
          filters: false,
          limit: input.limit,
          offset: input.offset,
          orderBy: {
            [input.sortBy ?? "createdAt"]: input.sortDirection ?? "asc",
          } as never,
        },
      );

      return {
        users,
        total,
        limit: input.limit ?? null,
        offset: input.offset ?? null,
      };
    });
  }

  /** Lists a user's active sessions. */
  async listUserSessions(user: User): Promise<Session[]> {
    this.authorizationService.assertUserCan("list", this.sessionEntity);
    return await this.runUnrestricted(
      async () =>
        await this.em.find(
          this.sessionEntity,
          {
            expiresAt: { $gt: new Date() },
            userId: String(user.id),
          } as FilterQuery<Session>,
          { filters: false, orderBy: { createdAt: "desc" } as never },
        ),
    );
  }

  /** Bans a user and immediately revokes all of their sessions. */
  async banUser(user: User, input: BanUserOptions = {}): Promise<User> {
    this.authorizationService.assertUserCan("ban", user);
    user.banned = true;
    user.banReason = input.banReason ?? null;
    user.banExpiresAt = input.banExpiresIn
      ? new Date(Date.now() + input.banExpiresIn * 1000)
      : null;

    await this.runUnrestricted(async () => {
      await this.em.nativeDelete(this.sessionEntity, {
        $or: [{ userId: String(user.id) }, { impersonatedBy: user }],
      } as FilterQuery<Session>);
      await this.em.flush();
    });
    return user;
  }

  /** Removes a user's ban. */
  async unbanUser(user: User): Promise<User> {
    this.authorizationService.assertUserCan("ban", user);
    user.banned = false;
    user.banReason = null;
    user.banExpiresAt = null;
    await this.runUnrestricted(() => this.em.flush());
    return user;
  }

  /** Creates a session that impersonates another user. */
  async impersonateUser(
    administrator: User,
    user: User,
    input: ImpersonationOptions = {},
  ): Promise<AuthenticatedSession<User, Session>> {
    this.authorizationService.assertCurrentUser(administrator);
    this.authorizationService.assertUserCan("impersonate", user);
    if (
      !this.hasPermission(administrator, {
        permissions: { user: ["impersonate"] },
      })
    ) {
      throw new ForbiddenException("You are not allowed to impersonate users");
    }
    if (
      this.isAdmin(user) &&
      !this.hasPermission(administrator, {
        permissions: { user: ["impersonate-admins"] },
      })
    ) {
      throw new ForbiddenException("You are not allowed to impersonate admins");
    }
    if (this.isActivelyBanned(user)) {
      throw new ForbiddenException("Banned users cannot be impersonated");
    }
    const session = this.createSession(user, {
      ...input,
      impersonatedBy: administrator,
    });
    await this.runUnrestricted(() => this.em.persist(session).flush());
    return { session, user };
  }

  /** Ends impersonation and creates a replacement administrator session. */
  async stopImpersonating(
    currentSession: Session,
    input: ImpersonationOptions = {},
  ): Promise<AuthenticatedSession<User, Session> | null> {
    this.authorizationService.assertCurrentSession(currentSession);
    const impersonatedByReference = currentSession.impersonatedBy;
    if (!impersonatedByReference) return null;

    return await this.runUnrestricted(async () => {
      const impersonatedBy = Reference.unwrapReference(
        impersonatedByReference,
      ) as BaseUser;
      const administrator = await this.em.findOne(
        this.userEntity,
        { id: String(impersonatedBy.id) } as FilterQuery<User>,
        { filters: false },
      );
      if (!administrator) return null;
      if (this.isActivelyBanned(administrator)) {
        await this.em.remove(currentSession).flush();
        throw new ForbiddenException(
          "Banned administrators cannot restore their session",
        );
      }

      const session = this.createSession(administrator, input);
      this.em.remove(currentSession).persist(session);
      await this.em.flush();
      return { session, user: administrator };
    });
  }

  /** Revokes one session when it belongs to the supplied user. */
  async revokeUserSession(user: User, token: string): Promise<boolean> {
    this.authorizationService.assertUserCan("revoke", this.sessionEntity);
    return await this.runUnrestricted(async () => {
      const session = await this.em.findOne(
        this.sessionEntity,
        { token, userId: String(user.id) } as FilterQuery<Session>,
        { filters: false },
      );
      if (!session) return false;

      await this.em.remove(session).flush();
      return true;
    });
  }

  /** Revokes every session belonging to a user. */
  async revokeUserSessions(user: User): Promise<number> {
    this.authorizationService.assertUserCan("revoke", this.sessionEntity);
    return await this.runUnrestricted(
      async () =>
        await this.em.nativeDelete(this.sessionEntity, {
          userId: String(user.id),
        } as FilterQuery<Session>),
    );
  }

  /** Permanently removes a user and their cascaded authentication records. */
  async removeUser(user: User): Promise<User> {
    this.authorizationService.assertUserCan("delete", user);
    await this.runUnrestricted(() => this.em.remove(user).flush());
    return user;
  }

  /** Sets or replaces a user's credential password. */
  async setUserPassword(user: User, newPassword: string): Promise<void> {
    this.authorizationService.assertUserCan("set-password", user);
    await this.runUnrestricted(async () => {
      const password = await this.hashPassword(newPassword);
      const account = await this.em.findOne(
        this.accountEntity,
        {
          issuer: CREDENTIAL_ISSUER,
          accountId: String(user.id),
          providerId: CREDENTIAL_PROVIDER_ID,
          userId: String(user.id),
        } as FilterQuery<Account>,
        { filters: false },
      );

      if (account) {
        account.password = password;
      } else {
        this.em.persist(
          this.em.create(this.accountEntity, {
            accountId: String(user.id),
            issuer: CREDENTIAL_ISSUER,
            password,
            providerId: CREDENTIAL_PROVIDER_ID,
            userId: String(user.id),
          } as unknown as RequiredEntityData<Account>),
        );
      }
      await this.em.flush();
    });
  }

  /** Checks flattened `subject:action` values against a user's permissions. */
  hasPermission(user: User, input: UserHasPermissionOptions): boolean {
    const permissions = new Set(this.getUserPermissions(user));
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

  private get roles(): AuthModuleRoles {
    return this.options.user?.roles ?? DEFAULT_USER_ROLES;
  }

  private get defaultRole(): string {
    return this.options.user?.defaultRole ?? DEFAULT_USER_ROLE;
  }

  private get permissions(): readonly string[] {
    return this.options.user?.permissions ?? DEFAULT_USER_PERMISSIONS;
  }

  private createSession(
    user: User,
    input: ImpersonationOptions & { impersonatedBy?: User },
  ): Session {
    const expiresIn = this.options.session?.expiresIn ?? 60 * 60 * 24 * 7;
    return this.em.create(this.sessionEntity, {
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      impersonatedBy: input.impersonatedBy ?? null,
      ipAddress: input.ipAddress ?? null,
      token: randomBytes(32).toString("base64url"),
      userAgent: input.userAgent ?? null,
      userId: String(user.id),
    } as unknown as RequiredEntityData<Session>);
  }

  private createUserFilter(input: ListUsersOptions): FilterQuery<User> {
    const where: Record<string, unknown> = {};

    if (input.searchValue) {
      const operator = input.searchOperator ?? "contains";
      const pattern =
        operator === "starts_with"
          ? `${input.searchValue}%`
          : operator === "ends_with"
            ? `%${input.searchValue}`
            : `%${input.searchValue}%`;
      where[input.searchField ?? "email"] = { $like: pattern };
    }

    if (input.filterField && input.filterValue !== undefined) {
      const operator = input.filterOperator ?? "eq";
      where[input.filterField] =
        operator === "eq"
          ? input.filterValue
          : operator === "contains"
            ? { $like: `%${String(input.filterValue)}%` }
            : { [`$${operator}`]: input.filterValue };
    }

    return where as FilterQuery<User>;
  }

  private async hashPassword(password: string): Promise<string> {
    return await (
      this.options.emailAndPassword?.password?.hash ??
      ((value: string) => this.hashService.hash(value))
    )(password);
  }

  private isActivelyBanned(user: BaseUser): boolean {
    return (
      user.banned &&
      (!user.banExpiresAt || user.banExpiresAt.getTime() > Date.now())
    );
  }

  private async runUnrestricted<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };

    if (RequestContext.isActive()) return await RequestContext.child(run);
    return await RequestContext.run(
      new RequestContext({ type: "auth-user" }),
      run,
    );
  }

  private get accountEntity(): EntityClass<Account> {
    return this.options.entities.account as EntityClass<Account>;
  }

  private get sessionEntity(): EntityClass<Session> {
    return this.options.entities.session as EntityClass<Session>;
  }

  private get userEntity(): EntityClass<User> {
    return this.options.entities.user as EntityClass<User>;
  }
}
