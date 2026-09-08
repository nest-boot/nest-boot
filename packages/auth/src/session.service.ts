import { EntityManager } from "@mikro-orm/core";
import {
  type CookieOptions,
  cookies,
  headers,
  RequestContext,
} from "@nest-boot/request-context";
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

  /** Revokes one session owned by the authenticated user by its public ID. */
  async revokeSession(id: string): Promise<boolean> {
    const session = (await this.listSessions()).find(
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
   * Selects a persisted session for the current browser response.
   *
   * @remarks
   * The session cookie is intentionally browser-session scoped. Cached session
   * and account cookies are expired so the next request resolves fresh data.
   */
  async setSession(sessionToken: string): Promise<void> {
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
