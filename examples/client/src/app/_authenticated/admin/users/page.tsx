import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { Plus } from "lucide-react";
import { z } from "zod";
import { toast } from "@/components/thread-ui/toast";
import { useAbility } from "@/contexts/ability-context";

import { createAbilitySubject } from "@/lib/ability";
import { Badge } from "@/components/thread-ui/badge";
import { Button } from "@/components/thread-ui/button";
import { DataTable } from "@/components/thread-ui/data-table";
import { Input } from "@/components/thread-ui/input";
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

const PAGE_SIZE = 20;

const GET_USERS_FROM_USERS_ROUTE = graphql(`
  query getUsersFromUsersRoute(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $filter: UserFilter
  ) {
    users(
      first: $first
      last: $last
      after: $after
      before: $before
      filter: $filter
      orderBy: { field: CREATED_AT, direction: DESC }
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
    z.object({
      after: z.string().optional(),
      before: z.string().optional(),
      search: z.string().optional().catch(undefined),
    }),
  ),
});

function AdminUsersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ability = useAbility();
  const [searchInput, setSearchInput] = useState(search.search ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { data, loading, refetch } = useQuery(GET_USERS_FROM_USERS_ROUTE, {
    fetchPolicy: "network-only",
    variables: {
      first: search.before ? undefined : PAGE_SIZE,
      last: search.before ? PAGE_SIZE : undefined,
      after: search.after,
      before: search.before,
      filter: search.search
        ? {
            $or: [
              { name: { $prefix: search.search } },
              { email: { $prefix: search.search } },
            ],
          }
        : undefined,
    },
  });
  const [createUser, { loading: creating }] = useMutation(
    CREATE_USER_FROM_USERS_ROUTE,
  );
  const users = data?.users.edges.map(({ node }) => node) ?? [];
  const canCreate = ability.can("create", "User");

  const handleCreate = async () => {
    try {
      await createUser({ variables: { input: { name, email, password } } });
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      await refetch();
      toast.add({ type: "success", title: t("admin:users.create.success") });
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : t("admin:users.create.failed"),
      });
    }
  };

  return (
    <Page data-testid="admin-users-page">
      <PageHeader>
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
        <form
          className="mb-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({
              to: "/admin/users",
              search: {
                search: searchInput.trim() || undefined,
              },
            });
          }}
        >
          <Input
            aria-label={t("admin:users.search")}
            placeholder={t("admin:users.search")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Button type="submit">{t("admin:users.search_action")}</Button>
        </form>

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
                <Badge color={row.original.emailVerified ? "green" : "gray"}>
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
              !ability.can("read", createAbilitySubject("User", row.original))
            )
              return;
            navigate({
              to: "/admin/users/$userId",
              params: { userId: row.original.id },
            });
          }}
          pagination={{
            hasPreviousPage: data?.users.pageInfo.hasPreviousPage ?? false,
            hasNextPage: data?.users.pageInfo.hasNextPage ?? false,
            onPreviousPage: () =>
              navigate({
                to: "/admin/users",
                search: {
                  search: search.search,
                  before: data?.users.pageInfo.startCursor ?? undefined,
                },
              }),
            onNextPage: () =>
              navigate({
                to: "/admin/users",
                search: {
                  search: search.search,
                  after: data?.users.pageInfo.endCursor ?? undefined,
                },
              }),
          }}
        />
        {loading ? (
          <p className="text-muted-foreground mt-3 text-sm">
            {t("admin:users.loading")}
          </p>
        ) : null}
      </PageContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:users.create.title")}</DialogTitle>
            <DialogDescription>
              {t("admin:users.create.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label={t("admin:users.table.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              type="email"
              label={t("admin:users.table.email")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              type="password"
              label={t("admin:users.create.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button
              disabled={!name.trim() || !email.trim() || password.length < 8}
              loading={creating}
              onClick={handleCreate}
            >
              {t("admin:users.create.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
