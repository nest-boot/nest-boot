import { useId, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy } from "lucide-react";
import dayjs from "dayjs";
import z from "zod";

import type { PagePaginationActionsConfig } from "@/components/thread-ui/page";
import type { ApiKeyRow } from "@/components/api-keys-page";
import type { ApiKeySearch } from "@/schemas/api-key-search-schema";
import type { UserApiKeyPermission } from "@/gql/graphql";
import type { PermissionOption } from "@/lib/permissions";
import { useCreatedApiKey } from "@/app/_authenticated/contexts/created-api-key-context";
import { Link } from "@/components/link";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { ApiKeyStatusBadge } from "@/components/api-key-status-badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import { Page } from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { toast } from "@/components/thread-ui/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { getFormErrorMessage } from "@/lib/form-errors";

interface ApiKeyFormPageProps<Permission extends UserApiKeyPermission> {
  apiKey?: ApiKeyRow<Permission>;
  canWrite: boolean;
  listPath: string;
  listSearch?: ApiKeySearch;
  paginationActions?: PagePaginationActionsConfig;
  permissionValues: ReadonlyArray<Permission>;
  permissionOptions: ReadonlyArray<PermissionOption<Permission>>;
  memberOptions?: Array<{ value: string; label: string }>;
  canCreateServiceAccount?: boolean;
  defaultPermissions?: ReadonlyArray<Permission>;
  onToggle?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onSave: (input: {
    name: string;
    memberId?: string;
    permissions: Array<Permission>;
  }) => Promise<void>;
}

/** Both scopes use the same editor; only creation can reveal the full secret. */
export function ApiKeyFormPage<Permission extends UserApiKeyPermission>({
  apiKey,
  canWrite,
  listPath,
  listSearch,
  paginationActions,
  permissionValues,
  permissionOptions,
  defaultPermissions = [],
  memberOptions,
  canCreateServiceAccount = true,
  onSave,
  onToggle,
  onDelete,
}: ApiKeyFormPageProps<Permission>) {
  const { t } = useTranslation();
  const formId = useId();
  const { secret } = useCreatedApiKey();
  const createdKey = apiKey ? secret : undefined;
  const [pendingAction, setPendingAction] = useState<"toggle" | "delete">();
  const [copied, setCopied] = useState(false);
  const keyStart = apiKey?.start || apiKey?.prefix;
  const isPermission = (value: UserApiKeyPermission): value is Permission =>
    permissionValues.some((permission) => permission === value);
  const form = useForm({
    defaultValues: {
      name: apiKey?.name ?? "",
      memberId: "",
      permissions: (apiKey?.permissions ??
        defaultPermissions.filter((permission) =>
          permissionOptions.some(
            (option) =>
              option.value === permission && option.grantable !== false,
          ),
        )) as Array<UserApiKeyPermission>,
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("api-key:form.name.required"))
          .max(255, t("api-key:form.name.too_long")),
        memberId: z.string(),
        permissions: z.array(z.enum(permissionValues)),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canWrite || pendingAction) return;
      if (memberOptions && !value.memberId && !canCreateServiceAccount) {
        formApi.setErrorMap({
          onSubmit: { form: t("api-key:form.member.required"), fields: {} },
        });
        return;
      }
      const input = {
        name: value.name.trim(),
        ...(memberOptions && value.memberId
          ? { memberId: value.memberId }
          : {}),
        permissions: value.permissions.filter(isPermission),
      };
      try {
        await onSave(input);
        if (apiKey) formApi.reset({ ...input, memberId: value.memberId });
        toast.add({
          type: "success",
          title: t(
            apiKey
              ? "api-key:toast.updated_success"
              : "api-key:toast.created_success",
          ),
        });
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              error instanceof Error
                ? error.message
                : t("api-key:form.save_failed"),
            fields: {},
          },
        });
      }
    },
  });
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const error = useStore(form.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  const handleAction = async (action: "toggle" | "delete") => {
    if (!apiKey || !canWrite || submitting || pendingAction) return;
    const operation = action === "delete" ? onDelete : onToggle;
    if (!operation) return;
    setPendingAction(action);
    try {
      if (
        action === "delete" &&
        !(await alertDialog({
          title: t("api-key:delete.title"),
          description: t("api-key:delete.description", { name: apiKey.name }),
          cancelText: t("action.cancel"),
          confirmText: t("action.delete"),
          variant: "destructive",
        }))
      )
        return;
      await operation();
      toast.add({
        type: "success",
        title: t(
          action === "delete"
            ? "api-key:toast.deleted_success"
            : apiKey.enabled
              ? "api-key:toast.disabled_success"
              : "api-key:toast.enabled_success",
        ),
      });
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : t("api-key:form.save_failed"),
      });
    } finally {
      setPendingAction(undefined);
    }
  };

  return (
    <Page
      variant="compact"
      title={t(apiKey ? "api-key:edit.title" : "api-key:create.title")}
      description={t(
        apiKey ? "api-key:edit.description" : "api-key:create.description",
      )}
      breadcrumbActions={[
        {
          label: t("api-key:title"),
          render: <Link to={listPath} search={listSearch} />,
        },
      ]}
      paginationActions={createdKey ? undefined : paginationActions}
      secondaryActions={
        apiKey && canWrite
          ? [
              ...(onToggle
                ? [
                    {
                      label: t(
                        apiKey.enabled ? "action.disable" : "action.enable",
                      ),
                      disabled: submitting || !!pendingAction,
                      loading: pendingAction === "toggle",
                      onAction: () => handleAction("toggle"),
                    },
                  ]
                : []),
              ...(onDelete
                ? [
                    {
                      label: t("action.delete"),
                      destructive: true,
                      disabled: submitting || !!pendingAction,
                      loading: pendingAction === "delete",
                      onAction: () => handleAction("delete"),
                    },
                  ]
                : []),
            ]
          : undefined
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (form.state.isSubmitting || pendingAction || !canWrite) return;
          form.setErrorMap({ onSubmit: undefined });
          form.handleSubmit();
        }}
      >
        <PageLayout>
          <PageLayoutSection>
            <Card>
              <CardContent>
                <FormLayout>
                  {createdKey && (
                    <FormLayoutItem>
                      <Alert>
                        <AlertTriangle />
                        <AlertTitle>{t("api-key:created.warning")}</AlertTitle>
                        <AlertDescription>
                          {t("api-key:created.description")}
                        </AlertDescription>
                      </Alert>
                    </FormLayoutItem>
                  )}
                  {memberOptions && !apiKey && (
                    <FormLayoutItem>
                      <form.Field name="memberId">
                        {(field) => (
                          <Field>
                            <FieldLabel htmlFor={`${formId}-member`}>
                              {t("api-key:form.member.label")}
                            </FieldLabel>
                            <Combobox
                              items={memberOptions}
                              value={
                                memberOptions.find(
                                  (option) =>
                                    option.value === field.state.value,
                                ) ?? null
                              }
                              onValueChange={(option) =>
                                field.handleChange(option?.value ?? "")
                              }
                              disabled={
                                !canWrite || submitting || !!pendingAction
                              }
                            >
                              <ComboboxInput
                                disabled={
                                  !canWrite || submitting || !!pendingAction
                                }
                                id={`${formId}-member`}
                                placeholder={t("api-key:form.member.search")}
                                showClear
                              />
                              <ComboboxContent>
                                <ComboboxEmpty>
                                  {t("api-key:form.member.empty")}
                                </ComboboxEmpty>
                                <ComboboxList>
                                  {(option: {
                                    value: string;
                                    label: string;
                                  }) => (
                                    <ComboboxItem
                                      key={option.value}
                                      value={option}
                                    >
                                      {option.label}
                                    </ComboboxItem>
                                  )}
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                            <p className="text-muted-foreground text-sm">
                              {t(
                                canCreateServiceAccount
                                  ? "api-key:form.member.auto_create"
                                  : "api-key:form.member.required",
                              )}
                            </p>
                          </Field>
                        )}
                      </form.Field>
                    </FormLayoutItem>
                  )}
                  <FormLayoutItem>
                    <form.Field name="name">
                      {(field) => (
                        <Input
                          id={`${formId}-name`}
                          label={t("api-key:form.name.label")}
                          placeholder={t("api-key:form.name.placeholder")}
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          disabled={!canWrite || submitting || !!pendingAction}
                          error={getFormErrorMessage(field.state.meta.errors)}
                        />
                      )}
                    </form.Field>
                  </FormLayoutItem>
                  {apiKey && (
                    <FormLayoutItem>
                      <Field data-disabled={!createdKey}>
                        <FieldLabel htmlFor={`${formId}-key`}>
                          {t("api-key:table.key_start")}
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id={`${formId}-key`}
                            value={
                              createdKey ?? (keyStart ? `${keyStart}...` : "—")
                            }
                            disabled={!createdKey}
                            readOnly
                          />
                          {createdKey && (
                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                size="icon-xs"
                                aria-label={t(
                                  copied
                                    ? "api-key:created.copied"
                                    : "api-key:created.copy",
                                )}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      createdKey,
                                    );
                                    setCopied(true);
                                  } catch {
                                    toast.add({
                                      type: "error",
                                      title: t("api-key:created.copy_failed"),
                                    });
                                  }
                                }}
                              >
                                {copied ? <Check /> : <Copy />}
                              </InputGroupButton>
                            </InputGroupAddon>
                          )}
                        </InputGroup>
                      </Field>
                    </FormLayoutItem>
                  )}
                  {apiKey && (
                    <FormLayoutItem>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground text-sm">
                            {t("api-key:table.status")}
                          </dt>
                          <dd>
                            <ApiKeyStatusBadge apiKey={apiKey} />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-sm">
                            {t("api-key:table.created_at")}
                          </dt>
                          <dd>
                            {dayjs(apiKey.createdAt).format("YYYY-MM-DD HH:mm")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-sm">
                            {t("api-key:table.last_used")}
                          </dt>
                          <dd>
                            {apiKey.lastUsedAt
                              ? dayjs(apiKey.lastUsedAt).format(
                                  "YYYY-MM-DD HH:mm",
                                )
                              : t("api-key:never_used")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-sm">
                            {t("api-key:table.expires_at")}
                          </dt>
                          <dd>
                            {apiKey.expiresAt
                              ? dayjs(apiKey.expiresAt).format("YYYY-MM-DD")
                              : t("api-key:never_expires")}
                          </dd>
                        </div>
                      </dl>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </CardContent>
            </Card>
          </PageLayoutSection>
          <PageLayoutSection>
            <Card>
              <CardContent>
                <FormLayout>
                  <FormLayoutItem>
                    <form.Field name="permissions">
                      {(field) => (
                        <PermissionCheckboxGroup
                          options={permissionOptions}
                          value={field.state.value}
                          onChange={field.handleChange}
                          disabled={!canWrite || submitting || !!pendingAction}
                        />
                      )}
                    </form.Field>
                    <p className="text-muted-foreground text-sm">
                      {t("api-key:form.permissions_hint")}
                    </p>
                  </FormLayoutItem>
                  {error && (
                    <FormLayoutItem>
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </FormLayoutItem>
                  )}
                </FormLayout>
              </CardContent>
              {canWrite && (
                <CardFooter>
                  <Button
                    type="submit"
                    form={formId}
                    loading={submitting}
                    disabled={!!pendingAction}
                  >
                    {t(apiKey ? "action.save" : "action.create")}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </PageLayoutSection>
        </PageLayout>
      </form>
    </Page>
  );
}
