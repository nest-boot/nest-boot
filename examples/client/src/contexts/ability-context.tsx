import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { SerializedAbilityRule } from "@/lib/ability";
import { createAbility } from "@/lib/ability";

const AbilityContext = createContext<ReturnType<typeof createAbility> | null>(
  null,
);

/** Publishes server-owned rules for the identity selected by the enclosing route. */
export function AbilityProvider({
  rules,
  children,
}: {
  rules: ReadonlyArray<SerializedAbilityRule>;
  children: ReactNode;
}) {
  const ability = useMemo(() => createAbility(rules), [rules]);
  return <AbilityContext value={ability}>{children}</AbilityContext>;
}

/** Reads the unified ability for the current user and optional workspace. */
export function useAbility() {
  const ability = useContext(AbilityContext);
  if (!ability)
    throw new Error("useAbility must be used within an AbilityProvider");
  return ability;
}
