import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export function AuthPageShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          to="/"
          className="text-primary flex items-center gap-2 self-center font-medium"
        >
          <Logo className="size-6" />
          {t("app.name")}
        </Link>

        {children}
      </div>
    </div>
  );
}
