import { t } from "i18next";
import { z } from "zod";

/** New credentials follow server policy; existing credentials only need to be nonempty. */
export function createPasswordSchema(policy?: {
  minLength: number;
  maxLength: number;
}) {
  if (!policy) {
    return z
      .string()
      .refine(() => false, t("auth:form.password.policy_unavailable"));
  }
  return z
    .string()
    .min(
      policy.minLength,
      t("auth:form.password.min", { min: policy.minLength }),
    )
    .max(
      policy.maxLength,
      t("auth:form.password.max", { max: policy.maxLength }),
    );
}

export function createExistingPasswordSchema() {
  return z.string().min(1, t("auth:form.password.required"));
}
