import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";

import { runAuthQuery } from "../utils/run-auth-query.js";

type ExecutionContext = "authentication" | "workspace-delete";

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
        const session = current.getSessionContext();
        if (!session) return await invoke(current);
        if (current.isInTransaction()) {
          throw new Error(
            "Workspace deletion context must be established before starting a scoped transaction",
          );
        }
        const scoped = current.fork({
          session: {
            ...session,
            variables: {
              ...session.variables,
              "app.operation": "auth.workspace.delete",
            },
          },
        });
        const run = async () => {
          RequestContext.set(EntityManager, scoped);
          return await invoke(scoped);
        };
        return RequestContext.isActive()
          ? await RequestContext.child(run)
          : await RequestContext.run(
              new RequestContext({ type: "auth-operation" }),
              run,
            );
      },
    });
  }
  return service;
}
