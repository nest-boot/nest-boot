import { useId, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy } from "lucide-react";
import dayjs from "dayjs";
import z from "zod";

import type { ApiKeyRow } from "@/components/api-keys-page";
import type { UserApiKeyPermission } from "@/gql/graphql";
import type { PermissionOption } from "@/lib/permissions";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Link } from "@/components/link";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
import { Input } from "@/components/thread-ui/input";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
import {
  Page,
  PageContent,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/thread-ui/page";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import { toast } from "@/components/thread-ui/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getFormErrorMessage } from "@/lib/form-errors";
import { getApiKeyStatus } from "@/lib/api-key-status";

interface ApiKeyFormPageProps<Permission extends UserApiKeyPermission> {
  apiKey?: ApiKeyRow<Permission>;
  canWrite: boolean;
  listPath: string;
  permissionValues: ReadonlyArray<Permission>;
  permissionOptions: ReadonlyArray<PermissionOption<Permission>>;
  defaultPermissions?: ReadonlyArray<Permission>;
  onSave: (input: {
    name: string;
    permissions: Array<Permission>;
  }) => Promise<string | undefined>;
}

/** Both scopes use the same editor; only creation can reveal the full secret. */
export function ApiKeyFormPage<Permission extends UserApiKeyPermission>({
  apiKey,
  canWrite,
  listPath,
  permissionValues,
  permissionOptions,
  defaultPermissions = [],
  onSave,
}: ApiKeyFormPageProps<Permission>) {
  const { t } = useTranslation();
  const formId = useId();
  const [createdKey, setCreatedKey] = useState<string>();
  const [copied, setCopied] = useState(false);
  const isPermission = (value: UserApiKeyPermission): value is Permission =>
    permissionValues.some((permission) => permission === value);
  const form = useForm({
    defaultValues: {
      name: apiKey?.name ?? "",
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
        permissions: z.array(z.enum(permissionValues)),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canWrite || createdKey) return;
      const input = {
        name: value.name.trim(),
        permissions: value.permissions.filter(isPermission),
      };
      try {
        const secret = await onSave(input);
        if (!apiKey) {
          if (!secret) throw new Error(t("api-key:form.save_failed"));
          setCreatedKey(secret);
        } else {
          formApi.reset(input);
        }
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
  const status = apiKey ? getApiKeyStatus(apiKey) : undefined;

  return (
    <Page variant="compact">
      <PageHeader>
        <Breadcrumbs />
        <PageTitle>
          {t(
            createdKey
              ? "api-key:created.title"
              : apiKey
                ? "api-key:edit.title"
                : "api-key:create.title",
          )}
        </PageTitle>
        {!createdKey && (
          <PageDescription>
            {t(
              apiKey
                ? "api-key:edit.description"
                : "api-key:create.description",
            )}
          </PageDescription>
        )}
      </PageHeader>
      <PageContent>
        <PageLayout>
          {createdKey ? (
            <PageLayoutSection>
              <Card>
                <CardHeader>
                  <CardTitle>{t("api-key:created.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <AlertTriangle />
                      <AlertTitle>{t("api-key:created.warning")}</AlertTitle>
                      <AlertDescription>
                        {t("api-key:created.description")}
                      </AlertDescription>
                    </Alert>
                    <div className="bg-muted rounded-md p-4">
                      <code
                        className="text-sm break-all"
                        data-testid="api-key-created-value"
                      >
                        {createdKey}
                      </code>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(createdKey);
                          setCopied(true);
                        } catch {
                          toast.add({
                            type: "error",
                            title: t("api-key:created.copy_failed"),
                          });
                        }
                      }}
                    >
                      {copied ? (
                        <Check data-icon="inline-start" />
                      ) : (
                        <Copy data-icon="inline-start" />
                      )}
                      {t(
                        copied
                          ? "api-key:created.copied"
                          : "api-key:created.copy",
                      )}
                    </Button>
                    <Button
                      data-testid="api-key-back"
                      render={<Link to={listPath} />}
                    >
                      {t("api-key:back")}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </PageLayoutSection>
          ) : (
            <>
              <PageLayoutSection>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {apiKey?.name ?? t("api-key:details")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      id={formId}
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (form.state.isSubmitting || !canWrite) return;
                        form.setErrorMap({ onSubmit: undefined });
                        form.handleSubmit();
                      }}
                    >
                      <FormLayout>
                        <FormLayoutItem>
                          <form.Field name="name">
                            {(field) => (
                              <Input
                                id={`${formId}-name`}
                                data-testid={
                                  apiKey
                                    ? "api-key-rename-input"
                                    : "api-key-name-input"
                                }
                                label={t("api-key:form.name.label")}
                                placeholder={t("api-key:form.name.placeholder")}
                                value={field.state.value}
                                onChange={(event) =>
                                  field.handleChange(event.target.value)
                                }
                                disabled={!canWrite || submitting}
                                error={getFormErrorMessage(
                                  field.state.meta.errors,
                                )}
                              />
                            )}
                          </form.Field>
                        </FormLayoutItem>
                        <FormLayoutItem>
                          <form.Field name="permissions">
                            {(field) => (
                              <PermissionCheckboxGroup
                                options={permissionOptions}
                                value={field.state.value}
                                onChange={field.handleChange}
                                disabled={!canWrite || submitting}
                              />
                            )}
                          </form.Field>
                        </FormLayoutItem>
                        {error && (
                          <FormLayoutItem>
                            <Alert variant="destructive">
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          </FormLayoutItem>
                        )}
                      </FormLayout>
                    </form>
                  </CardContent>
                  <CardFooter>
                    <div className="flex flex-wrap gap-2">
                      {canWrite && (
                        <Button
                          type="submit"
                          form={formId}
                          data-testid={
                            apiKey
                              ? "api-key-rename-submit"
                              : "api-key-create-submit"
                          }
                          loading={submitting}
                        >
                          {t(apiKey ? "action.save" : "action.create")}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        data-testid="api-key-back"
                        render={<Link to={listPath} />}
                      >
                        {t("api-key:back")}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </PageLayoutSection>
              {apiKey && status && (
                <PageLayoutSection>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("api-key:usage")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground text-sm">
                            {t("api-key:table.status")}
                          </dt>
                          <dd>
                            <Badge color={status.color}>
                              {t(`api-key:status.${status.label}`)}
                            </Badge>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-sm">
                            {t("api-key:table.key_start")}
                          </dt>
                          <dd>
                            <code>{apiKey.start ?? apiKey.prefix ?? "—"}</code>
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
                    </CardContent>
                  </Card>
                </PageLayoutSection>
              )}
            </>
          )}
        </PageLayout>
      </PageContent>
    </Page>
  );
}
