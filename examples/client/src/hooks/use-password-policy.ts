import { useEffect } from "react";
import { useQuery } from "@apollo/client/react";
import { t } from "i18next";
import { toast } from "@/components/thread-ui/toast";
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
    const notification = toast.add({
      type: "warning",
      title: t("auth:form.password.policy_unavailable"),
      timeout: 0,
      actionProps: {
        children: t("action.retry"),
        onClick: () => {
          void refetch().catch(() => undefined);
        },
      },
    });
    return () => {
      toast.close(notification);
    };
  }, [error, refetch]);
  return {
    passwordSchema: createPasswordSchema(data?.passwordPolicy),
    loading,
  };
}
