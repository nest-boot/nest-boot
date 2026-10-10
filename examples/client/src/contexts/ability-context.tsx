import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { createAbility } from "@/lib/ability";

const AbilityContext = createContext<ReturnType<typeof createAbility> | null>(
  null,
);

/** Shares the enclosing route's server-derived ability with its components. */
export function AbilityProvider({
  ability,
  children,
}: {
  ability: ReturnType<typeof createAbility>;
  children: ReactNode;
}) {
  return <AbilityContext value={ability}>{children}</AbilityContext>;
}

/** Reads the unified ability for the current user and optional workspace. */
export function useAbility() {
  const ability = useContext(AbilityContext);
  if (!ability)
    throw new Error("useAbility must be used within an AbilityProvider");
  return ability;
}
