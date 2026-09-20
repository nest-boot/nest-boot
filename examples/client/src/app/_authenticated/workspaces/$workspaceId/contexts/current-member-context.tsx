import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { GetCurrentWorkspaceFromWorkspaceLayoutQuery } from "@/gql/graphql";

type CurrentMember = NonNullable<
  GetCurrentWorkspaceFromWorkspaceLayoutQuery["currentMember"]
>;
const CurrentMemberContext = createContext<CurrentMember | null>(null);

/** Shares the identity already loaded and authorized by the route. */
export function CurrentMemberProvider({
  value,
  children,
}: {
  value: CurrentMember;
  children: ReactNode;
}) {
  return <CurrentMemberContext value={value}>{children}</CurrentMemberContext>;
}

export function useCurrentMemberContext() {
  const context = useContext(CurrentMemberContext);
  if (!context)
    throw new Error(
      "useCurrentMemberContext must be used within a CurrentMemberProvider",
    );
  return context;
}
