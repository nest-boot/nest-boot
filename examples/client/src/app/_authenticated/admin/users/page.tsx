import { useForm, useStore } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { isEmpty, pick } from "lodash";
import { z } from "zod";
import type { DataFilterItemProps } from "@/components/thread-ui/data-filter";
import { FieldError } from "@/components/ui/field";
import { getFormErrorMessage } from "@/lib/form-errors";
import { DataFilter } from "@/components/thread-ui/data-filter";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { toast } from "@/components/thread-ui/toast";
import { useAbility } from "@/contexts/ability-context";

import { createAbilitySubject } from "@/lib/ability";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
import { DataTable } from "@/components/thread-ui/data-table";
import { Input } from "@/components/thread-ui/input";
import { FormLayout, FormLayoutItem } from "@/components/thread-ui/form-layout";
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
import { graphql } from "@/gql";
import { UserOrderField } from "@/gql/graphql";
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
  formatConnectionFilterValue,
  formatFilterValues,
} from "@/lib/format-filter-values";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_SIZE = 20;

const GET_USERS_FROM_USERS_ROUTE = graphql(`
  query getUsersFromUsersRoute(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $filter: UserFilter
    $query: String
    $orderBy: UserOrder
  ) {
    users(
      first: $first
      last: $last
      after: $after
      before: $before
      filter: $filter
      query: $query
      orderBy: $orderBy
    ) {
      edges {
        node {
          id
          name
          email
          emailVerified
          banned
          createdAt
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`);

const CREATE_USER_FROM_USERS_ROUTE = graphql(`
  mutation createUserFromUsersRoute($input: CreateUserInput!) {
    createUser(input: $input) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated/admin/users/")({
  component: AdminUsersPage,
  beforeLoad: () => ({ title: t("admin:users.title") }),
  validateSearch: zodValidator(
    createConnectionSearchSchema({
      filterSchema: z
        .object({
          name: createDataFilterInputSearchSchema().optional().catch(undefined),
          email: createDataFilterInputSearchSchema()
            .optional()
            .catch(undefined),
          created_at: dataFilterDateSearchSchema.optional().catch(undefined),
        })
        .optional(),
      pageSize: PAGE_SIZE,
      orderField: UserOrderField,
      defaultOrderField: UserOrderField.CREATED_AT,
      defaultOrderDirection: OrderDirection.DESC,
    }),
  ),
});

function AdminUsersPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ability = useAbility();
  const query = search.query ?? "";
  const filterValues = (search.filter ?? {}) as Record<string, unknown>;
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, refetch } = useQuery(GET_USERS_FROM_USERS_ROUTE, {
    fetchPolicy: "network-only",
    variables: {
      ...pick(search, ["after", "before", "first", "last"]),
      query,
      filter: formatFilterValues(filterValues, formatConnectionFilterValue),
      orderBy: {
        field: search.orderBy?.field ?? UserOrderField.CREATED_AT,
        direction: search.orderBy?.direction ?? OrderDirection.DESC,
      },
    },
  });
  const [createUser] = useMutation(CREATE_USER_FROM_USERS_ROUTE);
  const users = data?.users.edges.map(({ node }) => node) ?? [];
  const canCreate = ability.can("create", "User");
  const filters: Array<DataFilterItemProps> = useMemo(
    () => [
      {
        label: t("admin:users.table.name"),
        field: "name",
        type: "input",
        operators: ["$eq", "$ne"],
        defaultOperator: "$eq",
      },
      {
        label: t("admin:users.table.email"),
        field: "email",
        type: "input",
        operators: ["$eq", "$ne"],
        defaultOperator: "$eq",
      },
      {
        label: t("admin:users.table.created_at"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ],
    [t],
  );

  const createForm = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, t("auth:form.name.required")),
        email: z.string().trim().email(t("auth:form.email.invalid")),
        password: z.string().min(8, t("auth:form.password.min")),
      }),
    },
    listeners: {
      onChange: ({ formApi }) => formApi.setErrorMap({ onSubmit: undefined }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!canCreate) return;
      try {
        await createUser({
          variables: {
            input: {
              ...value,
              name: value.name.trim(),
              email: value.email.trim(),
            },
          },
        });
        await refetch();
        setCreateOpen(false);
        formApi.reset();
        toast.add({ type: "success", title: t("admin:users.create.success") });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("admin:users.create.failed");
        formApi.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.add({ type: "error", title: message });
      }
    },
  });
  const creating = useStore(createForm.store, (state) => state.isSubmitting);
  const { name, email, password } = useStore(
    createForm.store,
    (state) => state.values,
  );
  const createError = useStore(createForm.store, (state) =>
    getFormErrorMessage(state.errors),
  );

  return (
    <Page data-testid="admin-users-page">
      <PageHeader>
        <Breadcrumbs />
        <PageTitle>{t("admin:users.title")}</PageTitle>
        <PageDescription>{t("admin:users.description")}</PageDescription>
        {canCreate ? (
          <PageActions>
            <PagePrimaryAction onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              {t("admin:users.create.action")}
            </PagePrimaryAction>
          </PageActions>
        ) : null}
      </PageHeader>
      <PageContent>
        <Card>
          <CardContent>
            <div className="space-y-4">
              <DataFilter
                filters={filters}
                loading={loading}
                value={{ filter: filterValues, query }}
                search={{ placeholder: t("admin:users.search") }}
                onChange={(value) => {
                  navigate({
                    to: "/admin/users",
                    search: {
                      query: value.query || undefined,
                      filter: isEmpty(value.filter) ? undefined : value.filter,
                      orderBy: search.orderBy,
                    },
                  });
                }}
              />

              <DataTable
                data={users}
                columns={[
                  {
                    accessorKey: "name",
                    header: t("admin:users.table.name"),
                    cell: ({ row }) => (
                      <div>
                        <p className="font-medium">{row.original.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {row.original.email}
                        </p>
                      </div>
                    ),
                  },
                  {
                    accessorKey: "emailVerified",
                    header: t("admin:users.table.email_status"),
                    cell: ({ row }) => (
                      <Badge
                        color={row.original.emailVerified ? "green" : "gray"}
                      >
                        {t(
                          row.original.emailVerified
                            ? "admin:users.verified"
                            : "admin:users.unverified",
                        )}
                      </Badge>
                    ),
                  },
                  {
                    accessorKey: "banned",
                    header: t("admin:users.table.status"),
                    cell: ({ row }) => (
                      <Badge color={row.original.banned ? "red" : "green"}>
                        {t(
                          row.original.banned
                            ? "admin:users.banned"
                            : "admin:users.active",
                        )}
                      </Badge>
                    ),
                  },
                  {
                    accessorKey: "createdAt",
                    header: t("admin:users.table.created_at"),
                    cell: ({ row }) =>
                      dayjs(row.original.createdAt).format("YYYY-MM-DD"),
                  },
                ]}
                onRowClick={(row) => {
                  if (
                    !ability.can(
                      "read",
                      createAbilitySubject("User", row.original),
                    )
                  )
                    return;
                  navigate({
                    to: "/admin/users/$userId",
                    params: { userId: row.original.id },
                  });
                }}
                pagination={{
                  hasPreviousPage:
                    data?.users.pageInfo.hasPreviousPage ?? false,
                  hasNextPage: data?.users.pageInfo.hasNextPage ?? false,
                  onPreviousPage: () =>
                    navigate({
                      to: "/admin/users",
                      search: getPreviousPageSearch(
                        search,
                        data?.users.pageInfo,
                      ),
                    }),
                  onNextPage: () =>
                    navigate({
                      to: "/admin/users",
                      search: getNextPageSearch(search, data?.users.pageInfo),
                    }),
                }}
              />
              {loading ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  {t("admin:users.loading")}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </PageContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:users.create.title")}</DialogTitle>
            <DialogDescription>
              {t("admin:users.create.description")}
            </DialogDescription>
          </DialogHeader>
          <form
            id="admin-create-user-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (createForm.state.isSubmitting) return;
              createForm.setErrorMap({ onSubmit: undefined });
              createForm.handleSubmit();
            }}
          >
            <FormLayout>
              <FormLayoutItem>
                <createForm.Field name="name">
                  {(field) => (
                    <Input
                      label={t("admin:users.table.name")}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      error={getFormErrorMessage(field.state.meta.errors)}
                    />
                  )}
                </createForm.Field>
              </FormLayoutItem>
              <FormLayoutItem>
                <createForm.Field name="email">
                  {(field) => (
                    <Input
                      type="email"
                      label={t("admin:users.table.email")}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      error={getFormErrorMessage(field.state.meta.errors)}
                    />
                  )}
                </createForm.Field>
              </FormLayoutItem>
              <FormLayoutItem>
                <createForm.Field name="password">
                  {(field) => (
                    <Input
                      type="password"
                      label={t("admin:users.create.password")}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      error={getFormErrorMessage(field.state.meta.errors)}
                    />
                  )}
                </createForm.Field>
              </FormLayoutItem>
              {createError && (
                <FormLayoutItem>
                  <FieldError>{createError}</FieldError>
                </FormLayoutItem>
              )}
            </FormLayout>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button
              disabled={
                !canCreate ||
                !name.trim() ||
                !email.trim() ||
                password.length < 8
              }
              loading={creating}
              type="submit"
              form="admin-create-user-form"
            >
              {t("admin:users.create.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
