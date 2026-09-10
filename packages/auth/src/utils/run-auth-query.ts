import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

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

  if (RequestContext.isActive()) return await RequestContext.child(run);
  return await RequestContext.run(
    new RequestContext({ type: "auth-persistence" }),
    run,
  );
}
