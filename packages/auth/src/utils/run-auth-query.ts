import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { RevokedAuthenticationException } from "../infrastructure/revoked-authentication.exception.js";
import { clearRequestAuthentication } from "./clear-request-authentication.util.js";
import { getCurrentApiKey } from "./get-current-api-key.util.js";

/**
 * Runs service-authorized persistence without the application's database session.
 * Never changes the caller's EntityManager or detaches an active transaction.
 */
export async function runAuthQuery<T>(
  em: EntityManager,
  callback: (em: EntityManager) => Promise<T>,
): Promise<T> {
  const current = em.getContext(false);
  if (!current.getSessionContext() && !current.global) {
    return await callback(current);
  }
  if (current.isInTransaction()) {
    throw new Error(
      "Auth persistence cannot bypass an active RLS transaction. Call Auth services before starting the scoped transaction.",
    );
  }

  // A clean identity map is intentional: flushing auth changes must not also
  // flush unrelated, pending application writes under the base database role.
  const fork = current.fork();
  fork.clearSessionContext();
  const run = () => {
    RequestContext.set(EntityManager, fork);
    return callback(fork);
  };

  if (RequestContext.isActive()) {
    const hasIdentity = () =>
      Boolean(
        RequestContext.get(User) ??
        RequestContext.get(Session) ??
        getCurrentApiKey(),
      );
    const authenticated = hasIdentity();
    const { result, revoked } = await RequestContext.child(async () => ({
      result: await run(),
      revoked: authenticated && !hasIdentity(),
    })).catch((error: unknown) => {
      // Only an explicit post-commit rejection can revoke identity on failure.
      if (error instanceof RevokedAuthenticationException) {
        clearRequestAuthentication(current);
      }
      throw error;
    });
    // Publish an explicit, successful credential revocation back to the caller.
    // Other failed operations leave its identity and scoped manager unchanged.
    if (revoked) clearRequestAuthentication(current);
    return result;
  }
  return await RequestContext.run(
    new RequestContext({ type: "auth-persistence" }),
    run,
  );
}
