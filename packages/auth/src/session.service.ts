import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { Inject, Injectable } from "@nestjs/common";

import { AUTH_TOKEN } from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { BaseSession, BaseUser } from "./entities/index.js";
import type { AuthenticatedSession } from "./interfaces/session-service.interface.js";

interface StatusResult {
  status: boolean;
}

interface InternalAuth {
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
   * Resolves the persisted user and session represented by request headers.
   *
   * @param headers - Fetch-compatible request headers containing the session
   * cookie or Bearer session token.
   * @returns Application entities for a valid session, otherwise `null`.
   */
  async getSession<
    User extends BaseUser = BaseUser,
    Session extends BaseSession = BaseSession,
  >(headers: HeadersInit): Promise<AuthenticatedSession<User, Session> | null> {
    const data = await this.auth.api.getSession({ headers });
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
   * @param headers - Request headers containing the current session.
   * @returns Active session entities in the order returned by the auth backend.
   */
  async listSessions<Session extends BaseSession = BaseSession>(
    headers: HeadersInit,
  ): Promise<Session[]> {
    const data = await this.auth.api.listSessions({ headers });
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
  async revokeSession(headers: HeadersInit, token: string): Promise<boolean> {
    const result = await this.auth.api.revokeSession({
      body: { token },
      headers,
    });
    return result.status;
  }

  /** Revokes every session except the authenticated user's current session. */
  async revokeOtherSessions(headers: HeadersInit): Promise<boolean> {
    const result = await this.auth.api.revokeOtherSessions({ headers });
    return result.status;
  }

  /** Revokes every session belonging to the authenticated user. */
  async revokeSessions(headers: HeadersInit): Promise<boolean> {
    const result = await this.auth.api.revokeSessions({ headers });
    return result.status;
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
