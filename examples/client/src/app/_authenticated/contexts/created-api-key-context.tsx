import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

interface CreatedApiKey {
  pathname: string;
  secret: string;
}

const CreatedApiKeyContext = createContext<{
  createdKey: CreatedApiKey | undefined;
  setCreatedKey: (key: CreatedApiKey) => void;
} | null>(null);

/** Keeps a newly created secret in memory only until its detail page is left. */
export function CreatedApiKeyProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [createdKey, setCreatedKey] = useState<CreatedApiKey>();

  useEffect(
    () =>
      router.subscribe("onBeforeNavigate", ({ toLocation }) => {
        setCreatedKey((key) =>
          key?.pathname === toLocation.pathname.replace(/\/$/, "")
            ? key
            : undefined,
        );
      }),
    [router],
  );

  return (
    <CreatedApiKeyContext value={{ createdKey, setCreatedKey }}>
      {children}
    </CreatedApiKeyContext>
  );
}

export function useCreatedApiKey() {
  const context = useContext(CreatedApiKeyContext);
  const pathname = useLocation({ select: (location) => location.pathname });
  if (!context) throw new Error("CreatedApiKeyProvider is required");
  return {
    secret:
      context.createdKey?.pathname === pathname.replace(/\/$/, "")
        ? context.createdKey.secret
        : undefined,
    setCreatedKey: context.setCreatedKey,
  };
}
