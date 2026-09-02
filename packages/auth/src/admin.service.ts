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
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { BaseAccount, BaseSession, BaseUser } from "./entities/index.js";
import type {
  AdminBanUserOptions,
  AdminCreateUserOptions,
  AdminHasPermissionOptions,
  AdminImpersonationOptions,
  AdminListUsersOptions,
  AdminListUsersResult,
  AdminUpdateUserOptions,
} from "./interfaces/admin-service.interface.js";
import type { AuthenticatedSession } from "./interfaces/session-service.interface.js";

const CREDENTIAL_ISSUER = "local:credential";
const CREDENTIAL_PROVIDER_ID = "credential";

/** User administration implemented with the configured MikroORM entities. */
@Injectable()
export class AdminService<
  User extends BaseUser = BaseUser,
  Account extends BaseAccount = BaseAccount,
  Session extends BaseSession = BaseSession,
> {
  /** Creates a new AdminService instance. */
  constructor(
    /** MikroORM entity manager used for authentication persistence. */
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly hashService: HashService,
  ) {}

  /** Creates a user and its credential account atomically. */
  async createUser(input: AdminCreateUserOptions): Promise<User> {
    return await this.runUnrestricted(async () => {
      const password = await this.hashPassword(input.password);
      const user = this.em.create(this.userEntity, {
        ...(input.data ?? {}),
        email: input.email,
        emailVerified: false,
        name: input.name,
        permissions: input.permissions ?? [],
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
    return await this.runUnrestricted(
      async () =>
        await this.em.findOne(
          this.userEntity,
          { id: userId } as FilterQuery<User>,
          { filters: false },
        ),
    );
  }

  /** Updates mutable user fields. */
  async updateUser(user: User, input: AdminUpdateUserOptions): Promise<User> {
    this.em.assign(user, input as never);
    await this.runUnrestricted(() => this.em.flush());
    return user;
  }

  /** Replaces a user's application permissions. */
  async setUserPermissions(user: User, permissions: string[]): Promise<User> {
    user.permissions = [...permissions];
    await this.runUnrestricted(() => this.em.flush());
    return user;
  }

  /** Lists users with Better Auth-compatible search and pagination concepts. */
  async listUsers(
    input: AdminListUsersOptions = {},
  ): Promise<AdminListUsersResult<User>> {
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
  async banUser(user: User, input: AdminBanUserOptions = {}): Promise<User> {
    user.banned = true;
    user.banReason = input.banReason ?? null;
    user.banExpiresAt = input.banExpiresIn
      ? new Date(Date.now() + input.banExpiresIn * 1000)
      : null;

    await this.runUnrestricted(async () => {
      await this.em.nativeDelete(this.sessionEntity, {
        userId: String(user.id),
      } as FilterQuery<Session>);
      await this.em.flush();
    });
    return user;
  }

  /** Removes a user's ban. */
  async unbanUser(user: User): Promise<User> {
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
    input: AdminImpersonationOptions = {},
  ): Promise<AuthenticatedSession<User, Session>> {
    if (
      user.banned &&
      (!user.banExpiresAt || user.banExpiresAt.getTime() > Date.now())
    ) {
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
    input: AdminImpersonationOptions = {},
  ): Promise<AuthenticatedSession<User, Session> | null> {
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

      const session = this.createSession(administrator, input);
      this.em.remove(currentSession).persist(session);
      await this.em.flush();
      return { session, user: administrator };
    });
  }

  /** Revokes one session when it belongs to the supplied user. */
  async revokeUserSession(user: User, token: string): Promise<boolean> {
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
    return await this.runUnrestricted(
      async () =>
        await this.em.nativeDelete(this.sessionEntity, {
          userId: String(user.id),
        } as FilterQuery<Session>),
    );
  }

  /** Permanently removes a user and their cascaded authentication records. */
  async removeUser(user: User): Promise<User> {
    await this.runUnrestricted(() => this.em.remove(user).flush());
    return user;
  }

  /** Sets or replaces a user's credential password. */
  async setUserPassword(user: User, newPassword: string): Promise<void> {
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
  hasPermission(user: User, input: AdminHasPermissionOptions): boolean {
    return Object.entries(input.permissions).every(([subject, actions]) =>
      actions.every((action) =>
        user.permissions.includes(`${subject}:${action}`),
      ),
    );
  }

  private createSession(
    user: User,
    input: AdminImpersonationOptions & { impersonatedBy?: User },
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

  private createUserFilter(input: AdminListUsersOptions): FilterQuery<User> {
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

  private async runUnrestricted<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };

    if (RequestContext.isActive()) return await RequestContext.child(run);
    return await RequestContext.run(
      new RequestContext({ type: "auth-admin" }),
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
