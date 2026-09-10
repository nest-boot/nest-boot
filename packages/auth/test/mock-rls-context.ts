import type { EntityManager, SessionContext } from "@mikro-orm/core";
import { vi } from "vitest";

/** Stages a native session on the caller and provides an isolated auth fork. */
export function mockRlsContext(
  em: Pick<EntityManager, "getSessionContext" | "fork">,
): SessionContext {
  const context: SessionContext = {
    role: "authenticated",
    variables: { "app.workspace": "workspace-1" },
  };
  vi.mocked(em.getSessionContext).mockReturnValue(context);
  const fork = {
    ...em,
    getContext: vi.fn<() => EntityManager>(),
    getSessionContext: vi
      .fn<() => SessionContext | undefined>()
      .mockReturnValue(context),
    clearSessionContext: vi.fn(() => {
      fork.getSessionContext.mockReturnValue(undefined);
    }),
  };
  fork.getContext.mockReturnValue(fork as unknown as EntityManager);
  vi.mocked(em.fork).mockReturnValue(fork as unknown as EntityManager);
  return context;
}
