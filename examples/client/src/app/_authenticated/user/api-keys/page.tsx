import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { isEmpty, pick } from "lodash";
import { AlertTriangle, Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

import type { DataFilterItemProps } from "@/components/thread-ui/data-filter";
import type { AuthPermission } from "@/lib/permissions";
import { alertDialog } from "@/components/thread-ui/alert-dialog";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
import { DataFilter } from "@/components/thread-ui/data-filter";
import {
  formatConnectionFilterValue,
  formatFilterValues,
} from "@/lib/format-filter-values";
import { DataTable } from "@/components/thread-ui/data-table";
import { Input } from "@/components/thread-ui/input";
import { PermissionCheckboxGroup } from "@/components/permission-checkbox-group";
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PagePrimaryAction,
  PageTitle,
} from "@/components/thread-ui/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { graphql } from "@/gql";
import * as Gql from "@/gql/graphql";
import { getApiKeyStatus } from "@/lib/api-key-status";
import {
  OrderDirection,
  createConnectionSearchSchema,
  getNextPageSearch,
  getPreviousPageSearch,
} from "@/lib/connection-search";
import {
  createDataFilterInputSearchSchema,
  dataFilterDateSearchSchema,
} from "@/lib/data-filter-search-schema";
import {
  authPermissionOptions,
  authPermissionValues,
  isAuthPermission,
  workspacePermissionValues,
} from "@/lib/permissions";

const { ApiKeyOrderField } = Gql;
type GetUserApiKeysFromUserApiKeysRouteQuery =
  Gql.GetUserApiKeysFromUserApiKeysRouteQuery;

const GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE = graphql(`
  query getUserApiKeysFromUserApiKeysRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $filter: ApiKeyFilter
    $orderBy: ApiKeyOrder
    $query: String
  ) {
    userApiKeys(
      after: $after
      before: $before
      first: $first
      last: $last
      orderBy: $orderBy
      filter: $filter
      query: $query
    ) {
      edges {
        node {
          id
          name
          start
          prefix
          enabled
          permissions
          createdAt
          lastUsedAt
          expiresAt
        }
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
    }
  }
`);

const CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation createUserApiKeyFromUserApiKeysRoute($input: CreateApiKeyInput!) {
    createUserApiKey(input: $input) {
      apiKey
      entity {
        id
        name
        start
        prefix
        enabled
        permissions
        createdAt
        lastUsedAt
        expiresAt
      }
    }
  }
`);

const UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation updateUserApiKeyFromUserApiKeysRoute(
    $id: ID!
    $input: UpdateApiKeyInput!
  ) {
    updateUserApiKey(id: $id, input: $input) {
      id
      name
      start
      prefix
      enabled
      permissions
      createdAt
      lastUsedAt
      expiresAt
    }
  }
`);

const DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE = graphql(`
  mutation deleteUserApiKeyFromUserApiKeysRoute($id: ID!) {
    deleteUserApiKey(id: $id) {
      id
      name
      start
      prefix
      enabled
      permissions
      createdAt
      lastUsedAt
      expiresAt
    }
  }
`);

export const Route = createFileRoute("/_authenticated/user/api-keys/")({
  component: ApiKeysComponent,
  validateSearch: zodValidator(
    createConnectionSearchSchema({
      filterSchema: z
        .object({
          name: createDataFilterInputSearchSchema(z.string().max(255), {
            fulltext: true,
          })
            .optional()
            .catch(undefined),
          prefix: createDataFilterInputSearchSchema()
            .optional()
            .catch(undefined),
          created_at: dataFilterDateSearchSchema.optional().catch(undefined),
        })
        .optional(),
      pageSize: 20,
      orderField: ApiKeyOrderField,
      defaultOrderField: ApiKeyOrderField.CREATED_AT,
      defaultOrderDirection: OrderDirection.DESC,
    }),
  ),
});

function ApiKeysComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const location = useLocation();

  const query = search?.query ?? "";
  const filterValues = (search?.filter ?? {}) as Record<string, unknown>;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingApiKey, setRenamingApiKey] = useState<ApiKeyRow | null>(null);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [createdDialogOpen, setCreatedDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, refetch } = useQuery(
    GET_USER_API_KEYS_FROM_USER_API_KEYS_ROUTE,
    {
      variables: {
        ...pick(search, ["after", "before", "first", "last"]),
        query,
        filter: formatFilterValues(filterValues, formatConnectionFilterValue),
        orderBy: {
          field: search?.orderBy?.field ?? ApiKeyOrderField.CREATED_AT,
          direction: search?.orderBy?.direction ?? OrderDirection.DESC,
        },
      },
    },
  );

  const userApiKeys = data?.userApiKeys.edges.map((edge) => edge.node) ?? [];
  const pageInfo = data?.userApiKeys.pageInfo;

  const createForm = useForm({
    defaultValues: {
      name: "",
      permissions: [...workspacePermissionValues] as Array<AuthPermission>,
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("api-key:form.name.required"))
          .max(255, t("api-key:form.name.too_long")),
        permissions: z.array(z.enum(authPermissionValues)),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await createUserApiKey({
          variables: {
            input: {
              name: value.name.trim(),
              permissions: value.permissions,
            },
          },
        });

        const apiKey = result.data?.createUserApiKey.apiKey;

        if (apiKey) {
          setCreatedApiKey(apiKey);
          setCreatedDialogOpen(true);
          setCreateDialogOpen(false);
          createForm.reset();
          await refetch();
          toast.success(t("api-key:toast.created_success"));
        }
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message);
        }
      }
    },
  });

  const renameForm = useForm({
    defaultValues: {
      name: "",
      permissions: [] as Array<AuthPermission>,
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, t("api-key:form.name.required"))
          .max(255, t("api-key:form.name.too_long")),
        permissions: z.array(z.enum(authPermissionValues)),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!renamingApiKey) return;

      try {
        await updateUserApiKey({
          variables: {
            id: renamingApiKey.id,
            input: {
              name: value.name.trim(),
              permissions: value.permissions,
            },
          },
        });

        setRenameDialogOpen(false);
        setRenamingApiKey(null);
        renameForm.reset();
        toast.success(t("api-key:toast.updated_success"));
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message);
        }
      }
    },
  });

  const filters: Array<DataFilterItemProps> = useMemo(() => {
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
  }, []);

  const [createUserApiKey, { loading: createLoading }] = useMutation(
    CREATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const [updateUserApiKey, { loading: updateLoading }] = useMutation(
    UPDATE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );
  const [deleteUserApiKey, { loading: deleteLoading }] = useMutation(
    DELETE_USER_API_KEY_FROM_USER_API_KEYS_ROUTE,
  );

  const handleCreateDialogOpenChange = (open: boolean) => {
    if (!open) {
      createForm.reset();
    }
    setCreateDialogOpen(open);
  };

  const handleRenameDialogOpenChange = (open: boolean) => {
    if (!open) {
      renameForm.reset();
      setRenamingApiKey(null);
    }
    setRenameDialogOpen(open);
  };

  const handleOpenRename = (apiKey: ApiKeyRow) => {
    setRenamingApiKey(apiKey);
    renameForm.setFieldValue("name", apiKey.name);
    renameForm.setFieldValue(
      "permissions",
      apiKey.permissions.filter(isAuthPermission),
    );
    setRenameDialogOpen(true);
  };

  const handleDeleteApiKey = async (apiKey: ApiKeyRow) => {
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
      await deleteUserApiKey({
        variables: { id: apiKey.id },
      });

      await refetch();
      toast.success(t("api-key:toast.deleted_success"));
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  };

  const handleToggleApiKey = async (apiKey: ApiKeyRow) => {
    try {
      await updateUserApiKey({
        variables: {
          id: apiKey.id,
          input: { enabled: !apiKey.enabled },
        },
      });
      toast.success(
        t(
          apiKey.enabled
            ? "api-key:toast.disabled_success"
            : "api-key:toast.enabled_success",
        ),
      );
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  };

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Page>
      <PageHeader>
        <PageTitle>{t("api-key:user.title")}</PageTitle>
        <PageDescription>{t("api-key:user.description")}</PageDescription>
        <PageActions>
          <PagePrimaryAction
            data-testid="api-key-create-action"
            onClick={() => setCreateDialogOpen(true)}
          >
            <KeyRound data-icon="inline-start" />
            {t("api-key:create.button")}
          </PagePrimaryAction>
        </PageActions>
      </PageHeader>
      <PageContent>
        <div className="mb-4" data-testid="api-keys-page">
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
        </div>

        <DataTable
          columns={[
            {
              accessorKey: "name",
              header: t("api-key:table.name"),
              cell: ({ row }) => {
                const apiKey = row.original;

                return (
                  <span
                    className="font-medium"
                    data-testid={`api-key-row-${apiKey.id}`}
                  >
                    {apiKey.name}
                  </span>
                );
              },
            },
            {
              accessorKey: "status",
              header: t("api-key:table.status"),
              size: 80,
              cell: ({ row }) => {
                const status = getApiKeyStatus(row.original);

                return (
                  <Badge
                    color={status.color}
                    data-testid={`api-key-status-${row.original.id}`}
                  >
                    {t(`api-key:status.${status.label}`)}
                  </Badge>
                );
              },
            },
            {
              accessorKey: "start",
              header: t("api-key:table.key_start"),
              size: 100,
              cell: ({ row }) => (
                <code className="text-xs">
                  {row.original.start ?? row.original.prefix ?? "—"}
                </code>
              ),
            },
            {
              accessorKey: "lastUsedAt",
              header: t("api-key:table.last_used"),
              cell: ({ row }) =>
                row.original.lastUsedAt
                  ? dayjs(row.original.lastUsedAt).format("YYYY-MM-DD HH:mm")
                  : t("api-key:never_used"),
            },
            {
              accessorKey: "expiresAt",
              header: t("api-key:table.expires_at"),
              cell: ({ row }) =>
                row.original.expiresAt
                  ? dayjs(row.original.expiresAt).format("YYYY-MM-DD")
                  : t("api-key:never_expires"),
            },
            {
              accessorKey: "createdAt",
              header: t("api-key:table.created_at"),
              cell: ({ row }) =>
                dayjs(row.original.createdAt).format("YYYY-MM-DD"),
            },
          ]}
          data={userApiKeys}
          pagination={{
            hasPreviousPage: pageInfo?.hasPreviousPage,
            hasNextPage: pageInfo?.hasNextPage,
            onPreviousPage: () => {
              navigate({
                to: location.pathname,
                search: getPreviousPageSearch(search, pageInfo),
              });
            },
            onNextPage: () => {
              navigate({
                to: location.pathname,
                search: getNextPageSearch(search, pageInfo),
              });
            },
          }}
          rowActions={(row) => [
            {
              disabled: updateLoading,
              label: row.original.enabled
                ? t("action.disable")
                : t("action.enable"),
              onClick: () => handleToggleApiKey(row.original),
            },
            {
              disabled: updateLoading,
              label: t("action.edit"),
              onClick: () => handleOpenRename(row.original),
            },
            {
              disabled: deleteLoading,
              label: t("action.delete"),
              onClick: () => handleDeleteApiKey(row.original),
            },
          ]}
        />

        <Dialog
          open={createDialogOpen}
          onOpenChange={handleCreateDialogOpenChange}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("api-key:create.title")}</DialogTitle>
              <DialogDescription>
                {t("api-key:create.description")}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                createForm.handleSubmit();
              }}
            >
              <div className="flex flex-col gap-4 py-4">
                <createForm.Field name="name">
                  {(field) => (
                    <Input
                      id="api-key-name"
                      data-testid="api-key-name-input"
                      label={t("api-key:form.name.label")}
                      placeholder={t("api-key:form.name.placeholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      error={
                        field.state.meta.errors.length > 0
                          ? field.state.meta.errors
                              .map((error: any) =>
                                typeof error === "string"
                                  ? error
                                  : error?.message || error,
                              )
                              .join(", ")
                          : undefined
                      }
                    />
                  )}
                </createForm.Field>
                <createForm.Field name="permissions">
                  {(field) => (
                    <PermissionCheckboxGroup
                      options={authPermissionOptions}
                      value={field.state.value}
                      onChange={field.handleChange}
                      disabled={createLoading}
                    />
                  )}
                </createForm.Field>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCreateDialogOpenChange(false)}
                >
                  {t("action.cancel")}
                </Button>
                <Button
                  type="submit"
                  data-testid="api-key-create-submit"
                  loading={createLoading}
                >
                  {t("action.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={renameDialogOpen}
          onOpenChange={handleRenameDialogOpenChange}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("api-key:edit.title")}</DialogTitle>
              <DialogDescription>
                {t("api-key:edit.description")}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                renameForm.handleSubmit();
              }}
            >
              <div className="flex flex-col gap-4 py-4">
                <renameForm.Field name="name">
                  {(field) => (
                    <Input
                      id="api-key-rename"
                      data-testid="api-key-rename-input"
                      label={t("api-key:form.name.label")}
                      placeholder={t("api-key:form.name.placeholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      error={
                        field.state.meta.errors.length > 0
                          ? field.state.meta.errors
                              .map((error: any) =>
                                typeof error === "string"
                                  ? error
                                  : error?.message || error,
                              )
                              .join(", ")
                          : undefined
                      }
                    />
                  )}
                </renameForm.Field>
                <renameForm.Field name="permissions">
                  {(field) => (
                    <PermissionCheckboxGroup
                      options={authPermissionOptions}
                      value={field.state.value}
                      onChange={field.handleChange}
                      disabled={updateLoading}
                    />
                  )}
                </renameForm.Field>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRenameDialogOpenChange(false)}
                >
                  {t("action.cancel")}
                </Button>
                <Button
                  type="submit"
                  data-testid="api-key-rename-submit"
                  loading={updateLoading}
                >
                  {t("action.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={createdDialogOpen}
          onOpenChange={(open) => {
            setCreatedDialogOpen(open);
            if (!open) {
              setCopied(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("api-key:created.title")}</DialogTitle>
            </DialogHeader>
            <Alert className="mt-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="font-semibold">
                {t("api-key:created.warning")}
              </AlertTitle>
              <AlertDescription>
                {t("api-key:created.description")}
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-4 py-4">
              <div className="bg-muted rounded-md p-4">
                <code
                  className="text-sm break-all"
                  data-testid="api-key-created-value"
                >
                  {createdApiKey}
                </code>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (createdApiKey) {
                    copyToClipboard(createdApiKey);
                  }
                }}
              >
                {copied ? (
                  <>
                    <Check data-icon="inline-start" />
                    {t("api-key:created.copied")}
                  </>
                ) : (
                  <>
                    <Copy data-icon="inline-start" />
                    {t("api-key:created.copy")}
                  </>
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button
                data-testid="api-key-created-close"
                onClick={() => setCreatedDialogOpen(false)}
              >
                {t("action.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </Page>
  );
}

type ApiKeyRow =
  GetUserApiKeysFromUserApiKeysRouteQuery["userApiKeys"]["edges"][number]["node"];
