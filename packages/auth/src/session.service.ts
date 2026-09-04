import { EntityManager } from "@mikro-orm/core";
import { headers, RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { Inject, Injectable } from "@nestjs/common";
import { makeSignature } from "better-auth/crypto";
import type { BetterAuthCookies } from "better-auth/types";

import { AUTH_TOKEN } from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { BaseSession, BaseUser } from "./entities/index.js";
import type { AuthenticatedSession } from "./interfaces/session-service.interface.js";

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
   * @param options - Auth module configuration.
   */
  constructor(
    @Inject(AUTH_TOKEN)
    auth: unknown,
    private readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    this.auth = auth as InternalAuth;
  }

  private readonly auth: InternalAuth;

  /**
   * Resolves the persisted user and session represented by the current request.
   *
   * @returns Application entities for a valid session, otherwise `null`.
   */
  async getSession<
    User extends BaseUser = BaseUser,
    Session extends BaseSession = BaseSession,
  >(): Promise<AuthenticatedSession<User, Session> | null> {
    const requestHeaders = headers();
    const candidates = [requestHeaders];
    if (requestHeaders.has("cookie") && requestHeaders.has("authorization")) {
      const cookieHeaders = new Headers(requestHeaders);
      cookieHeaders.delete("authorization");
      candidates.unshift(cookieHeaders);
    }

    for (const candidate of candidates) {
      const session = await this.resolveSession<User, Session>(candidate);
      if (session) return session;
    }

    return null;
  }

  private async resolveSession<
    User extends BaseUser,
    Session extends BaseSession,
  >(
    requestHeaders: HeadersInit,
  ): Promise<AuthenticatedSession<User, Session> | null> {
    const data = await this.auth.api.getSession({ headers: requestHeaders });
    if (!data) return null;

    const [user, session] = await this.runUnrestricted(
      async () =>
        await Promise.all([
          this.em.findOne(this.options.entities.user, { id: data.user.id }),
          this.em.findOne(this.options.entities.session, {
            token: data.session.token,
          }),
        ]),
    );

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
  async listSessions<Session extends BaseSession = BaseSession>(): Promise<
    Session[]
  > {
    const data = await this.auth.api.listSessions({ headers: headers() });
    if (data.length === 0) return [];

    const sessions = await this.runUnrestricted(
      async () =>
        await this.em.find(this.options.entities.session, {
          token: { $in: data.map(({ token }) => token) },
        }),
    );
    const sessionsByToken = new Map(
      sessions.map((session) => [session.token, session]),
    );

    return data.flatMap(({ token }) => {
      const session = sessionsByToken.get(token);
      return session ? [session as Session] : [];
    });
  }

  /** Revokes one session owned by the authenticated user. */
  async revokeSession(token: string): Promise<boolean> {
    const result = await this.auth.api.revokeSession({
      body: { token },
      headers: headers(),
    });
    return result.status;
  }

  /** Revokes every session except the authenticated user's current session. */
  async revokeOtherSessions(): Promise<boolean> {
    const result = await this.auth.api.revokeOtherSessions({
      headers: headers(),
    });
    return result.status;
  }

  /** Revokes every session belonging to the authenticated user. */
  async revokeSessions(): Promise<boolean> {
    const result = await this.auth.api.revokeSessions({ headers: headers() });
    return result.status;
  }

  /**
   * Creates response headers that select a persisted session in a browser.
   *
   * @remarks
   * The session cookie is intentionally browser-session scoped. Cached session
   * and account cookies are expired so the next request resolves fresh data.
   */
  async createSessionHeaders(sessionToken: string): Promise<Headers> {
    const { authCookies, secret } = await this.auth.$context;
    const responseHeaders = new Headers();

    responseHeaders.append(
      "set-cookie",
      await serializeSignedCookie(
        authCookies.sessionToken,
        sessionToken,
        secret,
      ),
    );
    responseHeaders.append(
      "set-cookie",
      await serializeSignedCookie(
        authCookies.dontRememberToken,
        "true",
        secret,
      ),
    );
    responseHeaders.append(
      "set-cookie",
      serializeExpiredCookie(authCookies.sessionData),
    );
    responseHeaders.append(
      "set-cookie",
      serializeExpiredCookie(authCookies.accountData),
    );

    return responseHeaders;
  }

  private async runUnrestricted<T>(callback: () => Promise<T>): Promise<T> {
    const run = () => {
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      return callback();
    };

    if (RequestContext.isActive()) return await RequestContext.child(run);
    return await RequestContext.run(
      new RequestContext({ type: "auth-session" }),
      run,
    );
  }
}

interface AuthCookie {
  name: string;
  attributes: BetterAuthCookies[keyof BetterAuthCookies]["attributes"];
}

async function serializeSignedCookie(
  cookie: AuthCookie,
  value: string,
  secret: string,
): Promise<string> {
  const signature = await makeSignature(value, secret);
  return serializeCookie(cookie.name, `${value}.${signature}`, {
    ...cookie.attributes,
    maxAge: undefined,
  });
}

function serializeExpiredCookie(cookie: AuthCookie): string {
  return serializeCookie(cookie.name, "", {
    ...cookie.attributes,
    expires: new Date(0),
    maxAge: 0,
  });
}

function serializeCookie(
  name: string,
  value: string,
  options: AuthCookie["attributes"],
): string {
  let serialized = `${name}=${value}`;
  if (options.maxAge !== undefined) {
    serialized += `; Max-Age=${String(Math.floor(options.maxAge))}`;
  }
  if (options.domain) serialized += `; Domain=${options.domain}`;
  if (options.path) serialized += `; Path=${options.path}`;
  if (options.expires)
    serialized += `; Expires=${options.expires.toUTCString()}`;
  if (options.httpOnly) serialized += "; HttpOnly";
  if (options.secure) serialized += "; Secure";
  if (options.sameSite) {
    serialized += `; SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`;
  }
  if (options.partitioned) serialized += "; Partitioned";
  return serialized;
}
