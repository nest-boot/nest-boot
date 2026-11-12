import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { runAuthQuery } from "../../common/utils/run-auth-query.js";
/**
 * Looks up an invitation identity without changing its locked transaction or caller role.
 * @param em - Entity manager for this persistence boundary.
 * @param callback - Work to run in the isolated identity lookup.
 * @returns Result of the requested operation.
 */
export async function readInvitationIdentity<T>(
  em: EntityManager,
  callback: (em: EntityManager) => Promise<T>,
): Promise<T> {
  const current = em.getContext(false);
  if (!current.getSessionContext() && !current.global) {
    return await callback(current);
  }
  if (!current.isInTransaction()) {
    return await runAuthQuery(em, callback);
  }
  // Reuse the locked transaction's connection. The isolated identity lookup
  // runs in a savepoint so errors restore the caller's role on rollback.
  const reader = current.fork({
    useContext: false,
    keepTransactionContext: true,
  });
  const run = () =>
    reader.transactional(async (manager) => {
      const connection = manager.getConnection();
      const transaction = manager.getTransactionContext();
      const [{ role }]: { role: string }[] = await connection.execute(
        "select current_user as role",
        [],
        "all",
        transaction,
      );
      await connection.execute("set local role none", [], "run", transaction);
      RequestContext.set(EntityManager, manager);
      const result = await callback(manager);
      await connection.execute(
        `set local role "${role.replaceAll('"', '""')}"`,
        [],
        "run",
        transaction,
      );
      return result;
    });
  return RequestContext.isActive()
    ? await RequestContext.child(run)
    : await RequestContext.run(
        new RequestContext({ type: "invitation-identity" }),
        run,
      );
}
