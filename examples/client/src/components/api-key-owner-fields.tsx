import { useTranslation } from "react-i18next";

import { Field, FieldLabel } from "./ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";

export interface ApiKeyAccountOption {
  value: string;
  label: string;
}

interface ApiKeyOwnerTypeFieldProps {
  id: string;
  value: "you" | "serviceAccount";
  onChange: (value: "you" | "serviceAccount") => void;
  disabled: boolean;
  canSelectServiceAccount: boolean;
}

/** Workspace credentials can belong to the current member or a service account. */
export function ApiKeyOwnerTypeField({
  id,
  value,
  onChange,
  disabled,
  canSelectServiceAccount,
}: ApiKeyOwnerTypeFieldProps) {
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel id={id}>{t("api-key:form.owner.label")}</FieldLabel>
      <Tabs
        value={value}
        onValueChange={(value) => {
          if (value === "you" || value === "serviceAccount") {
            onChange(value);
          }
        }}
      >
        <TabsList aria-labelledby={id}>
          <TabsTrigger value="you" disabled={disabled}>
            {t("api-key:form.owner.you")}
          </TabsTrigger>
          <TabsTrigger
            value="serviceAccount"
            disabled={disabled || !canSelectServiceAccount}
          >
            {t("api-key:form.owner.service_account")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="you">
          <p className="text-muted-foreground">
            {t("api-key:form.owner.you_description")}
          </p>
        </TabsContent>
        <TabsContent value="serviceAccount">
          <p className="text-muted-foreground">
            {t("api-key:form.owner.service_account_description")}
          </p>
        </TabsContent>
      </Tabs>
    </Field>
  );
}

interface ApiKeyAccountFieldProps {
  id: string;
  scope: "workspace" | "system";
  options: Array<ApiKeyAccountOption>;
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  canCreate: boolean;
}

/** Controlled account picker; clearing the value requests account creation when allowed. */
export function ApiKeyAccountField({
  id,
  scope,
  options,
  value,
  onChange,
  disabled,
  canCreate,
}: ApiKeyAccountFieldProps) {
  const { t } = useTranslation();
  const systemOwner = scope === "system";
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {t(
          systemOwner
            ? "admin:system_accounts.select_label"
            : "api-key:form.member.label",
        )}
      </FieldLabel>
      <Combobox
        items={options}
        value={options.find((option) => option.value === value) ?? null}
        onValueChange={(option) => onChange(option?.value ?? "")}
        disabled={disabled}
      >
        <ComboboxInput
          disabled={disabled}
          id={id}
          placeholder={t(
            systemOwner
              ? "admin:system_accounts.select_search"
              : "api-key:form.member.search",
          )}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {t(
              systemOwner
                ? "admin:system_accounts.select_empty"
                : "api-key:form.member.empty",
            )}
          </ComboboxEmpty>
          <ComboboxList>
            {(option: { value: string; label: string }) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="text-muted-foreground text-sm">
        {t(
          systemOwner
            ? canCreate
              ? "admin:system_accounts.auto_create"
              : "admin:system_accounts.select_required"
            : canCreate
              ? "api-key:form.member.auto_create"
              : "api-key:form.member.required",
        )}
      </p>
    </Field>
  );
}
