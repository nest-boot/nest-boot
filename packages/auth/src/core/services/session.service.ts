import { EntityManager, LockMode } from "@mikro-orm/core";
import type { EntityManager as SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import {
  type CookieOptions,
  cookies,
  headers,
  RequestContext,
} from "@nest-boot/request-context";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { makeSignature } from "better-auth/crypto";
import type { BetterAuthCookies } from "better-auth/types";
import { parseCookie, stringifyCookie } from "cookie";
import type { GraphQLResolveInfo } from "graphql";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { authorize } from "../../common/utils/authorize.util.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import { runAuthQuery } from "../../common/utils/run-auth-query.js";
import { AuthContext } from "../auth-context.js";
import {
  adaptBetterAuth,
  type BetterAuthAdapter,
} from "../better-auth-adapter.js";
import { SessionConnection } from "../connections/session.connection-definition.js";
import { AUTH_TOKEN } from "../constants/auth.constants.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import type { AuthenticatedSession } from "../interfaces/authenticated-session.interface.js";

/** Application-facing session management operations. */
@Injectable()
export class SessionService {
  /**
   * Creates a new SessionService instance.
   * @param auth - Internal Better Auth instance.
   * @param em - Entity manager used to resolve application entities.
   * @param authContext - Current request authentication context.
   */
  constructor(
    @Inject(AUTH_TOKEN)
    auth: unknown,
    private readonly em: EntityManager,
    private readonly authContext: AuthContext,
  ) {
    this.auth = adaptBetterAuth(auth);
  }

  private readonly auth: BetterAuthAdapter;

  /**
   * Binds a Better Auth operation to the session already verified for this request.
   * @returns Request headers authenticated by the verified session.
   * @internal
   */
  async getCurrentSessionHeaders(): Promise<Headers> {
    const session = RequestContext.isActive()
      ? RequestContext.get(Session)
      : null;
    if (!session || getCurrentApiKey()) {
      throw new ForbiddenException("A user session is required");
    }
    const { authCookies, secret } = await this.auth.$context;
    const requestHeaders = new Headers(headers());
    requestHeaders.delete("authorization");
    // Native caches are bound to this signed token; retain their names for chunk cleanup.
    const requestCookies = parseCookie(requestHeaders.get("cookie") ?? "");
    requestCookies[authCookies.sessionToken.name] =
      await createSignedCookieValue(session.token, secret);
    requestHeaders.set("cookie", stringifyCookie(requestCookies));
    return requestHeaders;
  }

  /**
   * Paginates active sessions visible to the caller for the parent user.
   * @param user - The user whose account is being accessed.
   * @param args - Pagination, filtering, and ordering arguments.
   * @param info - GraphQL selection information used to shape the query.
   * @returns Paginated active sessions with session tokens omitted.
   */
  async getSessionConnectionByUser(
    user: User,
    args: ConnectionArgsInterface<Session>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<Omit<Session, "token">>> {
    this.assertCanListSessions(user);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find(SessionConnection, args, {
      ...(info && { info }),
      exclude: ["token"],
      where: {
        user: String(user.id),
        expiresAt: { $gt: new Date() },
      },
    });
    for (const { node } of connection.edges) {
      this.assertCanListSessions(user, node);
    }
    return {
      ...connection,
      edges: connection.edges.map((edge) => ({
        ...edge,
        node: omitCredentials(edge.node, ["token"]),
      })),
    };
  }

  /**
   * Authorizes both the parent session and the impersonator's private profile.
   * @param session - Session whose metadata is being accessed.
   * @returns Administrator who started the session, or null.
   */
  async getSessionImpersonator(session: Session): Promise<User | null> {
    this.assertCanListSessions({ id: session.user.id } as User, session);
    if (!session.impersonatedBy) {
      return null;
    }
    const current = RequestContext.isActive() ? RequestContext.get(User) : null;
    const self =
      !getCurrentApiKey() && current?.id === session.impersonatedBy.id;
    if (!self) {
      authorize("read", User);
    }
    const user = await this.em.findOne(User, {
      id: String(session.impersonatedBy.id),
    });
    if (user && !self) {
      authorize("read", user);
    }
    return user;
  }

  private assertCanListSessions(user: User, session?: Session): void {
    const current = RequestContext.isActive()
      ? RequestContext.get(User)
      : undefined;
    const apiKey = RequestContext.isActive() ? getCurrentApiKey() : undefined;
    if (!current || String(current.id) !== String(user.id) || apiKey) {
      authorize("read", session ?? Session);
    }
  }

  /**
   * Revokes one session by ID when it belongs to the supplied user.
   * @param target - User entity or identifier to authorize.
   * @param id - Identifier of the record to access.
   * @returns Whether the selected session was revoked.
   */
  async revokeSession(target: User | string, id: string): Promise<boolean> {
    return await runAuthQuery(this.em, async (em) => {
      const user = await this.resolveUserForRevocation(em, target);
      authorize("revoke", Session);
      const current = RequestContext.isActive()
        ? RequestContext.get(Session)
        : null;
      const revokesCurrent = current?.id === id;
      if (revokesCurrent) {
        this.assertRevocationCanCommit();
      }
      const revoked = await em.transactional(
        async (em) => {
          const session = await em.findOne(
            Session,
            {
              id,
              user: String(user.id),
            },
            { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          if (!session) {
            return false;
          }
          authorize("revoke", session);
          await em.remove(session).flush();
          return true;
        },
        { clear: true },
      );
      if (revoked && revokesCurrent) {
        this.authContext.clear();
      }
      return revoked;
    });
  }

  /**
   * Revokes the user's sessions, including impersonation sessions they started.
   * @param target - User entity or identifier to authorize.
   * @returns Number of sessions revoked.
   */
  async revokeUserSessions(target: User | string): Promise<number> {
    return await runAuthQuery(this.em, async (em) => {
      const user = await this.resolveUserForRevocation(em, target);
      authorize("revoke", Session);
      const current = RequestContext.isActive()
        ? RequestContext.get(Session)
        : null;
      const revokesCurrent =
        current?.user.id === user.id || current?.impersonatedBy?.id === user.id;
      if (revokesCurrent) {
        this.assertRevocationCanCommit();
      }
      const count = await em.transactional(
        async (em) => {
          const sessions = await em.find(
            Session,
            {
              $or: [{ user: String(user.id) }, { impersonatedBy: user }],
            },
            { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          for (const session of sessions) {
            authorize("revoke", session);
          }
          if (sessions.length === 0) {
            return 0;
          }
          // Delete only the locked, authorized snapshot; never include unchecked new sessions.
          return await em.nativeDelete(Session, {
            id: { $in: sessions.map(({ id }) => id) },
          });
        },
        { clear: true },
      );
      if (revokesCurrent) {
        this.authContext.clear();
      }
      return count;
    });
  }

  private async resolveUserForRevocation(
    em: EntityManager,
    user: User | string,
  ): Promise<User> {
    if (typeof user !== "string") {
      return user;
    }
    authorize("revoke", Session);
    const entity = await em.findOne(User, { id: user }, { refresh: true });
    if (!entity) {
      throw new NotFoundException("User not found");
    }
    return entity;
  }

  /**
   * Resolves the persisted user and session represented by the current request.
   * @returns Application entities for a valid session, otherwise `null`.
   */
  async getCurrentAuthenticatedSession(): Promise<AuthenticatedSession | null> {
    return await runAuthQuery(this.em, async (em) => {
      const requestHeaders = headers();
      const candidates = [requestHeaders];
      if (requestHeaders.has("cookie") && requestHeaders.has("authorization")) {
        const cookieHeaders = new Headers(requestHeaders);
        cookieHeaders.delete("authorization");
        candidates.unshift(cookieHeaders);
      }

      for (const candidate of candidates) {
        const session = await this.resolveSession(em, candidate);
        if (session) {
          return session;
        }
      }

      return null;
    });
  }

  private async resolveSession(
    em: EntityManager,
    requestHeaders: HeadersInit,
  ): Promise<AuthenticatedSession | null> {
    const data = await this.auth.api.getSession({ headers: requestHeaders });
    if (!data) {
      return null;
    }

    const [user, session] = await Promise.all([
      em.findOne(User, { id: data.user.id }),
      em.findOne(Session, {
        token: data.session.token,
      }),
    ]);

    if (!user || !session) {
      return null;
    }
    if (
      user.banned &&
      (!user.banExpiresAt || user.banExpiresAt.getTime() > Date.now())
    ) {
      return null;
    }

    return {
      session: session,
      user: user,
    };
  }

  /**
   * Lists the persisted active sessions belonging to the authenticated user.
   * @returns Active session entities in the order returned by the auth backend.
   */
  async listCurrentUserSessions(): Promise<Session[]> {
    const requestHeaders = await this.getCurrentSessionHeaders();
    return await runAuthQuery(this.em, async (em) => {
      const data = await this.auth.api.listSessions({
        headers: requestHeaders,
      });
      if (data.length === 0) {
        return [];
      }

      // Better Auth already authorized this list; the credential-bearing entities
      // are needed internally by revocation. GraphQL uses getSessionConnectionByUser without credential columns.
      const sessions = await em.find(Session, {
        token: { $in: data.map(({ token }) => token) },
      });
      const sessionsByToken = new Map(
        sessions.map((session) => [session.token, session]),
      );

      return data.flatMap(({ token }) => {
        const session = sessionsByToken.get(token);
        return session ? [session] : [];
      });
    });
  }

  /**
   * Revokes one session owned by the authenticated user by its public ID.
   * @param id - Identifier of the record to access.
   * @returns Whether the selected session was revoked successfully.
   */
  async revokeCurrentUserSession(id: string): Promise<boolean> {
    this.assertRevocationCanCommit();
    const requestHeaders = await this.getCurrentSessionHeaders();
    const session = (await this.listCurrentUserSessions()).find(
      (candidate) => String(candidate.id) === id,
    );
    if (!session) {
      return false;
    }

    const current = RequestContext.isActive()
      ? RequestContext.get(Session)
      : null;
    const revokesCurrent = current?.id === session.id;

    const result = await this.auth.api.revokeSession({
      body: { token: session.token },
      headers: requestHeaders,
    });
    if (result.status && revokesCurrent) {
      this.authContext.clear();
    }
    return result.status;
  }

  /**
   * Revokes every session except the authenticated user's current session.
   * @returns Whether the other sessions were revoked successfully.
   */
  async revokeCurrentUserOtherSessions(): Promise<boolean> {
    this.assertRevocationCanCommit();
    const result = await this.auth.api.revokeOtherSessions({
      headers: await this.getCurrentSessionHeaders(),
    });
    return result.status;
  }

  /**
   * Revokes every session belonging to the authenticated user.
   * @returns Whether the user's sessions were revoked successfully.
   */
  async revokeCurrentUserSessions(): Promise<boolean> {
    this.assertRevocationCanCommit();
    const result = await this.auth.api.revokeSessions({
      headers: await this.getCurrentSessionHeaders(),
    });
    if (result.status) {
      this.authContext.clear();
    }
    return result.status;
  }

  /**
   * Writes a persisted session's signed cookie to the current browser response.
   *
   * The session cookie is intentionally browser-session scoped. Cached session
   * and account cookies are expired so the next request resolves fresh data.
   * This does not change the current request's identity, abilities, or RLS scope.
   * @param sessionToken - Token of the session to adopt.
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
  private assertRevocationCanCommit(): void {
    if (this.em.isInTransaction()) {
      throw new BadRequestException(
        "Revoke the current session outside an active transaction",
      );
    }
  }
}

interface AuthCookie {
  name: string;
  attributes: BetterAuthCookies[keyof BetterAuthCookies]["attributes"];
}

/**
 * Returns cookie value with its HMAC signature appended.
 * @param value - Value to inspect or transform.
 * @param secret - Secret used to sign authentication data.
 * @returns Cookie value with its HMAC signature appended.
 */
async function createSignedCookieValue(
  value: string,
  secret: string,
): Promise<string> {
  const signature = await makeSignature(value, secret);
  return `${value}.${signature}`;
}

/**
 * Returns cookie attributes with expiration derived from the session configuration.
 * @param cookie - Cookie definition and its attributes.
 * @returns Cookie attributes with expiration derived from the session configuration.
 */
function createSessionCookieOptions(cookie: AuthCookie): CookieOptions {
  const options = createCookieOptions(cookie);
  delete options.maxAge;
  return options;
}

/**
 * Returns cookie attributes that remove the cookie immediately.
 * @param cookie - Cookie definition and its attributes.
 * @returns Cookie attributes that remove the cookie immediately.
 */
function createExpiredCookieOptions(cookie: AuthCookie): CookieOptions {
  return {
    ...createCookieOptions(cookie),
    expires: new Date(0),
    maxAge: 0,
  };
}

/**
 * Expires the session cookie and all of its numbered chunks.
 * @param cookieStore - Response cookie store to update.
 * @param cookie - Cookie definition and its attributes.
 */
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

/**
 * Returns whether the name identifies a numbered chunk of the base cookie.
 * @param name - Name used to identify the resource.
 * @param cookieName - Base name of the cookie whose chunks are matched.
 * @returns Whether the name identifies a numbered chunk of the base cookie.
 */
function isCookieChunk(name: string, cookieName: string): boolean {
  const prefix = `${cookieName}.`;
  if (!name.startsWith(prefix)) {
    return false;
  }

  const suffix = name.slice(prefix.length);
  const index = Number(suffix);
  return Number.isSafeInteger(index) && index >= 0 && String(index) === suffix;
}

/**
 * Returns hTTP cookie options copied from the auth cookie definition.
 * @param cookie - Cookie definition and its attributes.
 * @returns HTTP cookie options copied from the auth cookie definition.
 */
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
