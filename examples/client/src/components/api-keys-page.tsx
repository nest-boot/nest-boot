import { useMemo } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { isEmpty } from "lodash";

import type { DataFilterField } from "@/components/thread-ui/data-filter";
import type {
  UpdateUserApiKeyInput,
  UserApiKey,
  UserApiKeyPermission,
} from "@/gql/graphql";
import type { ApiKeySearch } from "@/schemas/api-key-search-schema";
import type { PageInfo } from "@/lib/graphql-connection";
import type { createAbility } from "@/lib/ability";
import { toast } from "@/components/thread-ui/toast";
import { createAbilitySubject } from "@/lib/ability";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { ApiKeyStatusBadge } from "@/components/api-key-status-badge";
import { Link } from "@/components/link";
import { DataFilter } from "@/components/thread-ui/data-filter";
import {
  DataTable,
  createDataTableColumnHelper,
} from "@/components/thread-ui/data-table";
import { Page } from "@/components/thread-ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { getNextSearch, getPreviousSearch } from "@/lib/graphql-connection";

export type ApiKeyRow<Permission extends UserApiKeyPermission> = Omit<
  Pick<
    UserApiKey,
    | "id"
    | "name"
    | "start"
    | "prefix"
    | "enabled"
    | "permissions"
    | "createdAt"
    | "lastUsedAt"
    | "expiresAt"
  >,
  "permissions"
> & { permissions: Array<Permission> };

interface ApiKeysPageProps<Permission extends UserApiKeyPermission> {
  subject: "UserApiKey" | "WorkspaceApiKey";
  ability: ReturnType<typeof createAbility>;
  title: string;
  description: string;
  search: ApiKeySearch;
  apiKeys: Array<ApiKeyRow<Permission>>;
  pageInfo?: PageInfo;
  createPath: string;
  detailPath: (id: string) => string;
  updateLoading: boolean;
  deleteLoading: boolean;
  updateApiKey: (
    id: string,
    input: Omit<UpdateUserApiKeyInput, "permissions"> & {
      permissions?: Array<Permission> | null;
    },
  ) => Promise<unknown>;
  deleteApiKey: (id: string) => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

/** Shared API-key management UI; routes supply authorization, data, and mutations. */
export function ApiKeysPage<Permission extends UserApiKeyPermission>({
  subject,
  ability,
  title,
  description,
  search,
  apiKeys,
  pageInfo,
  createPath,
  detailPath,
  updateLoading,
  deleteLoading,
  updateApiKey,
  deleteApiKey,
  refetch,
}: ApiKeysPageProps<Permission>) {
  const { t, i18n } = useTranslation();
  const apiKeysColumnHelper =
    createDataTableColumnHelper<(typeof apiKeys)[number]>();
  const canCreate = ability.can("write", subject);
  const canUpdate = (apiKey: ApiKeyRow<Permission>) =>
    ability.can("write", createAbilitySubject(subject, apiKey));
  const canDelete = (apiKey: ApiKeyRow<Permission>) =>
    ability.can("write", createAbilitySubject(subject, apiKey));
  const navigate = useNavigate();
  const location = useLocation();

  const query = search?.query ?? "";
  const filterValues = (search?.filter ?? {}) as Record<string, unknown>;

  const filters: Array<DataFilterField> = useMemo(() => {
    return [
      {
        label: t("api-key:filter.items.name.label"),
        field: "name",
        type: "input",
        placeholder: t("api-key:filter.items.name.placeholder"),
        operators: ["$fulltext"],
        defaultOperator: "$fulltext",
      },
      {
        label: t("api-key:filter.items.prefix.label"),
        field: "prefix",
        type: "input",
        placeholder: t("api-key:filter.items.prefix.placeholder"),
        operators: ["$eq", "$ne"],
        defaultOperator: "$eq",
      },
      {
        label: t("api-key:filter.items.created_at.label"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ];
  }, [t]);

  const handleDeleteApiKey = async (apiKey: ApiKeyRow<Permission>) => {
    if (!canDelete(apiKey)) return;
    const confirmed = await alertDialog({
      title: t("api-key:delete.title"),
      description: t("api-key:delete.description", {
        name: apiKey.name,
      }),
      cancelText: t("action.cancel"),
      confirmText: t("action.delete"),
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      await deleteApiKey(apiKey.id);

      await refetch();
      toast.add({ type: "success", title: t("api-key:toast.deleted_success") });
    } catch (err) {
      if (err instanceof Error) {
        toast.add({ type: "error", title: err.message });
      }
    }
  };

  const handleToggleApiKey = async (apiKey: ApiKeyRow<Permission>) => {
    if (!canUpdate(apiKey)) return;
    try {
      await updateApiKey(apiKey.id, { enabled: !apiKey.enabled });
      toast.add({
        type: "success",
        title: t(
          apiKey.enabled
            ? "api-key:toast.disabled_success"
            : "api-key:toast.enabled_success",
        ),
      });
    } catch (err) {
      if (err instanceof Error) {
        toast.add({ type: "error", title: err.message });
      }
    }
  };

  return (
    <Page
      title={title}
      description={description}
      primaryAction={{
        disabled: !canCreate,
        onAction: () => navigate({ to: createPath }),
        label: t("api-key:create.button"),
      }}
    >
      <Card>
        <CardContent>
          <div className="space-y-4">
            <DataFilter
              filters={filters}
              value={{ filter: filterValues, query }}
              onChange={(value) => {
                navigate({
                  to: location.pathname,
                  search: {
                    ...(value.query ? { query: value.query } : {}),
                    ...(!isEmpty(value.filter) ? { filter: value.filter } : {}),
                  },
                });
              }}
              search={{
                placeholder: t("api-key:filter.search.placeholder"),
              }}
            />

            <DataTable
              locale={i18n.resolvedLanguage}
              columns={apiKeysColumnHelper.columns([
                apiKeysColumnHelper.column("name", {
                  header: t("api-key:table.name"),
                  render: (props, { row }) => {
                    const apiKey = row.original;

                    return (
                      <Link
                        {...props}
                        to={detailPath(apiKey.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="font-medium"
                      >
                        {apiKey.name}
                      </Link>
                    );
                  },
                }),
                apiKeysColumnHelper.column("status", {
                  field: null,
                  header: t("api-key:table.status"),
                  size: 80,
                  render: (props, { row }) => (
                    <ApiKeyStatusBadge {...props} apiKey={row.original} />
                  ),
                }),
                apiKeysColumnHelper.column("start", {
                  header: t("api-key:table.key_start"),
                  size: 100,
                  getValue: (row) => row.start ?? row.prefix ?? "—",
                  render: (props, { getValue }) => (
                    <code {...props} className="text-xs">
                      {getValue()}
                    </code>
                  ),
                }),
                apiKeysColumnHelper.column("lastUsedAt", {
                  header: t("api-key:table.last_used"),
                  type: "datetime",
                  getValue: (row) => row.lastUsedAt ?? t("api-key:never_used"),
                }),
                apiKeysColumnHelper.column("expiresAt", {
                  header: t("api-key:table.expires_at"),
                  type: "date",
                  getValue: (row) =>
                    row.expiresAt ?? t("api-key:never_expires"),
                }),
                apiKeysColumnHelper.column("createdAt", {
                  header: t("api-key:table.created_at"),
                  type: "date",
                }),
              ])}
              data={apiKeys}
              onRowClick={(row) =>
                navigate({ to: detailPath(row.original.id) })
              }
              pagination={{
                hasPreviousPage: pageInfo?.hasPreviousPage,
                hasNextPage: pageInfo?.hasNextPage,
                onPreviousPage: () => {
                  navigate({
                    to: location.pathname,
                    search: getPreviousSearch(search, pageInfo),
                  });
                },
                onNextPage: () => {
                  navigate({
                    to: location.pathname,
                    search: getNextSearch(search, pageInfo),
                  });
                },
              }}
              rowActions={(row) => [
                {
                  disabled: updateLoading || !canUpdate(row.original),
                  label: row.original.enabled
                    ? t("action.disable")
                    : t("action.enable"),
                  onClick: () => handleToggleApiKey(row.original),
                },
                {
                  disabled: updateLoading || !canUpdate(row.original),
                  label: t("action.edit"),
                  onClick: () => navigate({ to: detailPath(row.original.id) }),
                },
                {
                  disabled: deleteLoading || !canDelete(row.original),
                  label: t("action.delete"),
                  onClick: () => handleDeleteApiKey(row.original),
                },
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
