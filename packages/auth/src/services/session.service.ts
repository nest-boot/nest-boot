import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import type { EntityManager as SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  ConnectionManager,
} from "@nest-boot/graphql-connection";
import {
  type CookieOptions,
  cookies,
  headers,
  RequestContext,
} from "@nest-boot/request-context";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { makeSignature } from "better-auth/crypto";
import type { BetterAuthCookies } from "better-auth/types";

import { AUTH_TOKEN } from "../auth.constants.js";
import { SessionConnection } from "../connections/session.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import type { AuthenticatedSession } from "../interfaces/authenticated-session.interface.js";
import { AccessControlService } from "./access-control.service.js";

interface StatusResult {
  status: boolean;
}

interface InternalAuth {
  $context: Promise<{
    authCookies: BetterAuthCookies;
    secret: string;
  }>;
  api: {
    getSession(options: { headers: HeadersInit }): Promise<{
      session: { token: string };
      user: { id: string };
    } | null>;
    listSessions(options: {
      headers: HeadersInit;
    }): Promise<{ token: string }[]>;
    revokeSession(options: {
      body: { token: string };
      headers: HeadersInit;
    }): Promise<StatusResult>;
    revokeOtherSessions(options: {
      headers: HeadersInit;
    }): Promise<StatusResult>;
    revokeSessions(options: { headers: HeadersInit }): Promise<StatusResult>;
  };
}

/** Application-facing session management operations. */
@Injectable()
export class SessionService {
  /**
   * Creates a new SessionService instance.
   * @param auth - Internal Better Auth instance.
   * @param em - Entity manager used to resolve application entities.
   * @param accessControlService - Authorization for parent-scoped reads and administrative revocation.
   */
  constructor(
    @Inject(AUTH_TOKEN)
    auth: unknown,
    private readonly em: EntityManager,
    private readonly accessControlService: AccessControlService,
  ) {
    this.auth = auth as InternalAuth;
  }

  private readonly auth: InternalAuth;

  /** Paginates active sessions visible to the caller for the parent user. */
  async getSessionConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Session>,
  ): Promise<ConnectionInterface<Session>> {
    this.assertCanListSessions(user);
    return await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find<Session>(SessionConnection, args, {
      exclude: ["token"] as never,
      where: {
        user: String(user.id),
        expiresAt: { $gt: new Date() },
      } as FilterQuery<Session>,
    });
  }

  /** Loads a visible impersonator after authorizing access to the parent session. */
  async getSessionImpersonator(session: Session): Promise<User | null> {
    this.assertCanListSessions({ id: session.user.id } as User);
    return session.impersonatedBy
      ? await this.em.findOne(User, {
          id: String(session.impersonatedBy.id),
        } as FilterQuery<User>)
      : null;
  }

  private assertCanListSessions(user: User): void {
    const current = RequestContext.isActive()
      ? RequestContext.get(User)
      : undefined;
    const apiKey = RequestContext.isActive()
      ? RequestContext.get(ApiKey)
      : undefined;
    if (!current || String(current.id) !== String(user.id) || apiKey) {
      this.accessControlService.assertUserCan("list", Session);
    }
  }

  /** Revokes one session by ID when it belongs to the supplied user. */
  async revokeSession(user: User | string, id: string): Promise<boolean> {
    user = await this.resolveUserForRevocation(user);
    this.accessControlService.assertUserCan("revoke", Session);
    return await this.em.transactional(
      async (em) => {
        const session = await em.findOne(
          Session,
          {
            id,
            user: String(user.id),
          } as FilterQuery<Session>,
          { filters: false },
        );
        if (!session) return false;

        await em.remove(session).flush();
        return true;
      },
      { clear: true },
    );
  }

  /** Revokes the user's sessions, including impersonation sessions they started. */
  async revokeUserSessions(user: User | string): Promise<number> {
    user = await this.resolveUserForRevocation(user);
    this.accessControlService.assertUserCan("revoke", Session);
    return await this.em.nativeDelete(Session, {
      $or: [{ user: String(user.id) }, { impersonatedBy: user }],
    } as FilterQuery<Session>);
  }

  private async resolveUserForRevocation(user: User | string): Promise<User> {
    if (typeof user !== "string") return user;
    this.accessControlService.assertUserCan("revoke", Session);
    const entity = await this.em.findOne(
      User,
      { id: user } as FilterQuery<User>,
      { refresh: true },
    );
    if (!entity) throw new NotFoundException("User not found");
    return entity;
  }

  /**
   * Resolves the persisted user and session represented by the current request.
   *
   * @returns Application entities for a valid session, otherwise `null`.
   */
  async getCurrentAuthenticatedSession(): Promise<AuthenticatedSession | null> {
    const requestHeaders = headers();
    const candidates = [requestHeaders];
    if (requestHeaders.has("cookie") && requestHeaders.has("authorization")) {
      const cookieHeaders = new Headers(requestHeaders);
      cookieHeaders.delete("authorization");
      candidates.unshift(cookieHeaders);
    }

    for (const candidate of candidates) {
      const session = await this.resolveSession(candidate);
      if (session) return session;
    }

    return null;
  }

  private async resolveSession(
    requestHeaders: HeadersInit,
  ): Promise<AuthenticatedSession | null> {
    const data = await this.auth.api.getSession({ headers: requestHeaders });
    if (!data) return null;

    const [user, session] = await Promise.all([
      this.em.findOne(User, { id: data.user.id }),
      this.em.findOne(Session, {
        token: data.session.token,
      }),
    ]);

    if (!user || !session) return null;
    if (
      user.banned &&
      (!user.banExpiresAt || user.banExpiresAt.getTime() > Date.now())
    ) {
      return null;
    }

    return {
      session: session as Session,
      user: user as User,
    };
  }

  /**
   * Lists the persisted active sessions belonging to the authenticated user.
   *
   * @returns Active session entities in the order returned by the auth backend.
   */
  async listCurrentUserSessions(): Promise<Session[]> {
    const data = await this.auth.api.listSessions({ headers: headers() });
    if (data.length === 0) return [];

    // Better Auth already authorized this list; the credential-bearing entities
    // are needed internally by revocation. GraphQL uses getSessionConnectionByUser without credential columns.
    const sessions = await this.em.find(Session, {
      token: { $in: data.map(({ token }) => token) },
    });
    const sessionsByToken = new Map(
      sessions.map((session) => [session.token, session]),
    );

    return data.flatMap(({ token }) => {
      const session = sessionsByToken.get(token);
      return session ? [session as Session] : [];
    });
  }

  /** Revokes one session owned by the authenticated user by its public ID. */
  async revokeCurrentUserSession(id: string): Promise<boolean> {
    const session = (await this.listCurrentUserSessions()).find(
      (candidate) => String(candidate.id) === id,
    );
    if (!session) return false;

    const result = await this.auth.api.revokeSession({
      body: { token: session.token },
      headers: headers(),
    });
    return result.status;
  }

  /** Revokes every session except the authenticated user's current session. */
  async revokeCurrentUserOtherSessions(): Promise<boolean> {
    const result = await this.auth.api.revokeOtherSessions({
      headers: headers(),
    });
    return result.status;
  }

  /** Revokes every session belonging to the authenticated user. */
  async revokeCurrentUserSessions(): Promise<boolean> {
    const result = await this.auth.api.revokeSessions({ headers: headers() });
    return result.status;
  }

  /**
   * Writes a persisted session's signed cookie to the current browser response.
   *
   * @remarks
   * The session cookie is intentionally browser-session scoped. Cached session
   * and account cookies are expired so the next request resolves fresh data.
   * This does not change the current request's identity, abilities, or RLS scope.
   */
  async setSessionCookie(sessionToken: string): Promise<void> {
    const { authCookies, secret } = await this.auth.$context;
    const cookieStore = cookies();

    cookieStore.set(
      authCookies.sessionToken.name,
      await createSignedCookieValue(sessionToken, secret),
      createSessionCookieOptions(authCookies.sessionToken),
    );
    cookieStore.set(
      authCookies.dontRememberToken.name,
      await createSignedCookieValue("true", secret),
      createSessionCookieOptions(authCookies.dontRememberToken),
    );
    expireCookieAndChunks(cookieStore, authCookies.sessionData);
    expireCookieAndChunks(cookieStore, authCookies.accountData);
  }
}

interface AuthCookie {
  name: string;
  attributes: BetterAuthCookies[keyof BetterAuthCookies]["attributes"];
}

async function createSignedCookieValue(
  value: string,
  secret: string,
): Promise<string> {
  const signature = await makeSignature(value, secret);
  return `${value}.${signature}`;
}

function createSessionCookieOptions(cookie: AuthCookie): CookieOptions {
  const options = createCookieOptions(cookie);
  delete options.maxAge;
  return options;
}

function createExpiredCookieOptions(cookie: AuthCookie): CookieOptions {
  return {
    ...createCookieOptions(cookie),
    expires: new Date(0),
    maxAge: 0,
  };
}

function expireCookieAndChunks(
  cookieStore: ReturnType<typeof cookies>,
  cookie: AuthCookie,
): void {
  const options = createExpiredCookieOptions(cookie);
  cookieStore.set(cookie.name, "", options);

  for (const { name } of cookieStore.getAll()) {
    if (isCookieChunk(name, cookie.name)) {
      cookieStore.set(name, "", options);
    }
  }
}

function isCookieChunk(name: string, cookieName: string): boolean {
  const prefix = `${cookieName}.`;
  if (!name.startsWith(prefix)) return false;

  const suffix = name.slice(prefix.length);
  const index = Number(suffix);
  return Number.isSafeInteger(index) && index >= 0 && String(index) === suffix;
}

function createCookieOptions(cookie: AuthCookie): CookieOptions {
  const { attributes } = cookie;
  return {
    domain: attributes.domain,
    expires: attributes.expires,
    httpOnly: attributes.httpOnly,
    maxAge: attributes.maxAge,
    partitioned: attributes.partitioned,
    path: attributes.path,
    sameSite:
      typeof attributes.sameSite === "string"
        ? (attributes.sameSite.toLowerCase() as CookieOptions["sameSite"])
        : attributes.sameSite,
    secure: attributes.secure,
  };
}
