import { useEffect } from "react";
import { useQuery } from "@apollo/client/react";
import { t } from "i18next";
import { toast } from "sonner";
import { graphql } from "@/gql";
import { createPasswordSchema } from "@/lib/password-schema";

const GET_PASSWORD_POLICY = graphql(`
  query getPasswordPolicy {
    passwordPolicy {
      minLength
      maxLength
    }
  }
`);

/** Share the cached server policy across all new-password forms. */
export function usePasswordPolicy(skip = false) {
  const { data, error, refetch, loading } = useQuery(GET_PASSWORD_POLICY, {
    skip,
  });
  useEffect(() => {
    if (!error) return;
    const notification = toast.error(
      t("auth:form.password.policy_unavailable"),
      {
        duration: Infinity,
        action: {
          label: t("action.retry"),
          onClick: () => {
            void refetch().catch(() => undefined);
          },
        },
      },
    );
    return () => {
      toast.dismiss(notification);
    };
  }, [error, refetch]);
  return {
    passwordSchema: createPasswordSchema(data?.passwordPolicy),
    loading,
  };
}
