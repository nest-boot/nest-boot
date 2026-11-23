import { useId, useState } from "react";
import { useForm, useSelector } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { PermissionOption } from "@/lib/permissions";
import {
  defaultFormOptions,
  handleFieldBlur,
  resetFormAfterSave,
  submitForm,
} from "@/lib/form";
import { useFormChanges, useSyncFormChanges } from "@/hooks/use-form-changes";
import { SystemAccountPermission } from "@/gql/graphql";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";

import { Button } from "@/components/thread-ui/button";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Badge } from "@/components/thread-ui/badge";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { Link } from "@/components/link";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { toast } from "@/components/thread-ui/toast";
import { getFormErrorMessage } from "@/lib/form-errors";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { systemAccountSearchSchema } from "@/schemas/system-account-search-schema";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/thread-ui/input";

interface Account {
  id: string;
  name: string;
  enabled: boolean;
  updatedAt: string;
  permissions: Array<SystemAccountPermission>;
  createdById?: string | null;
}
interface Props {
  account?: Account;
  canWrite: boolean;
  canEditName?: boolean;
  canEditPermissions?: boolean;
  canToggle?: boolean;
  canReadKeys?: boolean;
  options: ReadonlyArray<PermissionOption<SystemAccountPermission>>;
  onSave: (
    input: {
      name: string;
      permissions: Array<SystemAccountPermission>;
    },
    changes: Partial<{
      name: string;
      permissions: Array<SystemAccountPermission>;
    }>,
  ) => Promise<void>;
  onToggle?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}
/** Administrator editor for an independent identity and its explicit grant ceiling. */
export function SystemAccountFormPage({
  account,
  canWrite,
  canEditName = canWrite,
  canEditPermissions = canWrite,
  canToggle = canWrite,
  canReadKeys,
  options,
  onSave,
  onToggle,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const canSave = canWrite && (!account || canEditName || canEditPermissions);
  const id = useId();
  const user = useAuthUserContext();
  const [pending, setPending] = useState(false);
  const { backSearch } = useResourceNavigation({
    key: [user.id, "admin", "system-accounts"],
    searchSchema: systemAccountSearchSchema,
  });
  const metadataChanges = useFormChanges(
    {
      name: account?.name.trim() ?? "",
      permissions:
        account?.permissions ?? ([] as Array<SystemAccountPermission>),
    },
    {
      revision: account?.updatedAt,
      setFields: ["permissions"],
      normalize: (values) => ({ ...values, name: values.name.trim() }),
    },
  );
  const form = useForm({
    ...defaultFormOptions,
    defaultValues: metadataChanges.defaultValues,
    validators: {
      onDynamic: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("api-key:form.name.required"))
          .max(255, t("api-key:form.name.too_long")),
        permissions: z.array(z.enum(SystemAccountPermission)),
      }),
    },

    onSubmit: async ({ value, formApi }) => {
      if (!canSave || pending) return;
      const values = metadataChanges.normalize(value);
      const changes = metadataChanges.getChanges(values);
      if (account && !Object.keys(changes).length) return;
      try {
        await onSave(values, changes);
        metadataChanges.accept(values);
        resetFormAfterSave(formApi, value, values);
        toast.add({ type: "success", title: t("admin:system_accounts.saved") });
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: {
            form: error instanceof Error ? error.message : t("admin:failed"),
            fields: {},
          },
        });
      }
    },
  });
  const submitting = useSelector(form.store, (state) => state.isSubmitting);
  useSyncFormChanges(form, metadataChanges, Boolean(account));
  const error = useSelector(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );
  const action = async (remove: boolean) => {
    const operation = remove ? onDelete : onToggle;
    if (!account || pending || submitting || !canWrite || !operation) return;
    if (!remove && !canToggle) return;
    setPending(true);
    try {
      if (
        remove &&
        !(await alertDialog({
          title: t("admin:system_accounts.delete_title"),
          description: t("admin:system_accounts.delete_description"),
          confirmText: t("action.delete"),
          cancelText: t("action.cancel"),
          variant: "destructive",
        }))
      )
        return;
      await operation();
    } catch (error) {
      toast.add({
        type: "error",
        title: error instanceof Error ? error.message : t("admin:failed"),
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <Page
      variant="compact"
      title={account?.name ?? t("admin:system_accounts.create")}
      description={t("admin:system_accounts.description")}
      breadcrumbActions={[
        {
          label: t("admin:system_accounts.title"),
          render: <Link to="/admin/system-accounts" search={backSearch} />,
        },
      ]}
      secondaryActions={
        account && canWrite
          ? [
              ...(canToggle && onToggle
                ? [
                    {
                      label: t(
                        account.enabled ? "action.disable" : "action.enable",
                      ),
                      disabled: pending || submitting,
                      onAction: () => action(false),
                    },
                  ]
                : []),
              ...(onDelete
                ? [
                    {
                      label: t("action.delete"),
                      destructive: true,
                      disabled: pending || submitting,
                      onAction: () => action(true),
                    },
                  ]
                : []),
            ]
          : undefined
      }
    >
      <PageLayout>
        <PageLayoutSection>
          <Card>
            <CardContent>
              {account && (
                <div className="mb-4 flex items-center gap-4">
                  <Badge color={account.enabled ? "green" : "gray"}>
                    {t(
                      account.enabled
                        ? "admin:system_accounts.enabled"
                        : "admin:system_accounts.disabled",
                    )}
                  </Badge>
                  {canReadKeys && (
                    <Button
                      variant="outline"
                      render={<Link to="/admin/api-keys" />}
                    >
                      {t("api-key:title")}
                    </Button>
                  )}
                </div>
              )}
              <form
                id={id}
                noValidate
                onSubmit={(event) => {
                  void submitForm(event, form, !canSave || pending);
                }}
              >
                <FormLayout>
                  <FormLayoutItem>
                    <form.Field name="name">
                      {(field) => (
                        <Input
                          name={field.name}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={() => handleFieldBlur(field)}
                          error={getFormErrorMessage(field.state.meta.errors)}
                          label={t("admin:users.table.name")}
                          disabled={!canEditName || pending || submitting}
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                  <FormLayoutItem>
                    <form.Field name="permissions">
                      {(field) => (
                        <PermissionCheckboxGroup
                          options={options}
                          value={field.state.value}
                          onChange={field.handleChange}
                          disabled={
                            !canEditPermissions || pending || submitting
                          }
                        />
                      )}
                    </form.Field>
                    <p className="text-muted-foreground mt-3 text-sm">
                      {t("admin:system_accounts.permissions_hint")}
                    </p>
                  </FormLayoutItem>
                  {account && (
                    <FormLayoutItem>
                      <p className="text-muted-foreground text-sm">
                        {t("admin:system_accounts.creator")}:{" "}
                        {account.createdById ?? "—"}
                      </p>
                    </FormLayoutItem>
                  )}
                  {error && (
                    <FormLayoutItem>
                      <FieldError>{error}</FieldError>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </form>
            </CardContent>
            {canSave && (
              <CardFooter>
                <SubmitButton formApi={form} form={id} disabled={pending}>
                  {t(account ? "action.save" : "action.create")}
                </SubmitButton>
              </CardFooter>
            )}
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
