import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <img
            src="/logo.svg"
            alt="Nest Boot Example"
            className="aspect-square size-6"
          />
          Nest Boot Example
        </Link>

        {children}
      </div>
    </div>
  );
}
