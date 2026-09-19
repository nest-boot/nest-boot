import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { runAuthQuery } from "../utils/run-auth-query.js";

type ExecutionContext = "authentication" | "invitation-identity";

/**
 * Installs the explicit infrastructure-owned execution boundaries for auth services.
 * Domain methods only use their injected manager. Unlisted methods keep request RLS.
 * Contextual instances are created per invocation, never by mutating a shared EM.
 * @internal
 */
export function createContextualAuthService<T extends object>(
  em: EntityManager,
  create: (em: EntityManager) => T,
  operations: Partial<Record<keyof T, ExecutionContext>>,
): T {
  const service = create(em);
  for (const [name, context] of Object.entries(operations)) {
    Object.defineProperty(service, name, {
      configurable: true,
      value: async (...args: unknown[]) => {
        const invoke = async (manager: EntityManager) => {
          const instance = create(manager);
          const method = Reflect.get(instance, name) as (
            ...args: unknown[]
          ) => unknown;
          return await Reflect.apply(method, instance, args);
        };
        if (context === "authentication") return await runAuthQuery(em, invoke);

        const current = em.getContext(false);
        if (!current.isInTransaction()) return await runAuthQuery(em, invoke);
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
            await connection.execute(
              "set local role none",
              [],
              "run",
              transaction,
            );
            RequestContext.set(EntityManager, manager);
            const result = await invoke(manager);
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
      },
    });
  }
  return service;
}
