import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { Check, Plus, X } from "lucide-react";
import { isEmpty } from "lodash";
import type { DataFilterField } from "@/components/thread-ui/data-filter";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { createConnectionQueryVariables } from "@/lib/connection-query-variables";
import { workspaceSearchSchema } from "@/schemas/workspace-search-schema";
import { workspacesResourceKey } from "@/lib/resource-keys";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { DataFilter } from "@/components/thread-ui/data-filter";
import { toast } from "@/components/thread-ui/toast";

import { Link } from "@/components/link";
import { DataTable } from "@/components/thread-ui/data-table";
import { Page } from "@/components/thread-ui/page";
import { Button } from "@/components/thread-ui/button";
import {
  PageLayout,
  PageLayoutSection,
} from "@/components/thread-ui/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { graphql } from "@/gql";
import {
  getNextPageSearch,
  getPreviousPageSearch,
} from "@/lib/connection-search";
import { getRolesLabel } from "@/utils/get-role-label";

const GET_WORKSPACES_FROM_USER_WORKSPACES_ROUTE = graphql(`
  query getWorkspacesFromUserWorkspacesRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $orderBy: WorkspaceOrder
    $query: String
    $filter: WorkspaceFilter
    $invitationFirst: Int
    $invitationLast: Int
    $invitationAfter: String
    $invitationBefore: String
  ) {
    currentUser {
      workspaces(
        after: $after
        before: $before
        first: $first
        last: $last
        orderBy: $orderBy
        query: $query
        filter: $filter
      ) {
        edges {
          node {
            id
            name
            createdAt
            updatedAt
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
    currentUser {
      invitations(
        first: $invitationFirst
        last: $invitationLast
        after: $invitationAfter
        before: $invitationBefore
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        edges {
          node {
            workspaceId
            id
            roles
            expiresAt
            workspace {
              id
              name
            }
          }
        }
        pageInfo {
          endCursor
          startCursor
          hasNextPage
          hasPreviousPage
        }
      }
    }
  }
`);

const ACCEPT_INVITATION_FROM_USER_WORKSPACES_ROUTE = graphql(`
  mutation acceptInvitationFromUserWorkspacesRoute($id: ID!) {
    acceptInvitation(id: $id) {
      id
    }
  }
`);

const REJECT_INVITATION_FROM_USER_WORKSPACES_ROUTE = graphql(`
  mutation rejectInvitationFromUserWorkspacesRoute($id: ID!) {
    rejectInvitation(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authenticated/user/workspaces/")({
  component: UserWorkspacesComponent,
  beforeLoad: () => ({ title: t("user:workspaces.title") }),
  validateSearch: zodValidator(workspaceSearchSchema),
});

function UserWorkspacesComponent() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const currentUser = useCurrentUserContext();
  useResourceNavigation({
    key: [currentUser.id, ...workspacesResourceKey],
    searchSchema: workspaceSearchSchema,
    search,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const query = search.query ?? "";
  const filterValues = (search.filter ?? {}) as Record<string, unknown>;
  const [invitationPage, setInvitationPage] = useState<{
    first?: number;
    last?: number;
    after?: string;
    before?: string;
  }>({ first: 20 });
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<
    string | null
  >(null);
  const [rejectingInvitationId, setRejectingInvitationId] = useState<
    string | null
  >(null);

  const { data, loading, refetch } = useQuery(
    GET_WORKSPACES_FROM_USER_WORKSPACES_ROUTE,
    {
      fetchPolicy: "network-only",
      variables: {
        invitationFirst: invitationPage.first,
        invitationLast: invitationPage.last,
        invitationAfter: invitationPage.after,
        invitationBefore: invitationPage.before,
        ...createConnectionQueryVariables(search),
      },
    },
  );

  const [acceptInvitation] = useMutation(
    ACCEPT_INVITATION_FROM_USER_WORKSPACES_ROUTE,
  );
  const [rejectInvitation] = useMutation(
    REJECT_INVITATION_FROM_USER_WORKSPACES_ROUTE,
  );

  const handleAcceptInvitation = async (invitationId: string) => {
    setAcceptingInvitationId(invitationId);

    try {
      await acceptInvitation({ variables: { id: invitationId } });
      await refetch();
      toast.add({
        type: "success",
        title: t("user:workspaces.invitations.toast.accepted"),
      });
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : t("user:workspaces.invitations.toast.accept_failed"),
      });
    } finally {
      setAcceptingInvitationId(null);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    setRejectingInvitationId(invitationId);

    try {
      await rejectInvitation({ variables: { id: invitationId } });
      await refetch();
      toast.add({
        type: "success",
        title: t("user:workspaces.invitations.toast.rejected"),
      });
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : t("user:workspaces.invitations.toast.reject_failed"),
      });
    } finally {
      setRejectingInvitationId(null);
    }
  };

  const workspaces =
    data?.currentUser.workspaces.edges.map(({ node }) => node) ?? [];
  const invitations =
    data?.currentUser.invitations.edges.map(({ node }) => node) ?? [];
  const invitationPageInfo = data?.currentUser.invitations.pageInfo;
  const pageInfo = data?.currentUser.workspaces.pageInfo;
  const invitationActionPending =
    acceptingInvitationId !== null || rejectingInvitationId !== null;
  const filters: Array<DataFilterField> = useMemo(
    () => [
      {
        label: t("user:workspaces.table.name"),
        field: "name",
        type: "input",
        operators: ["$eq", "$ne"],
        defaultOperator: "$eq",
      },
      {
        label: t("user:workspaces.table.created_at"),
        field: "created_at",
        type: "date-picker",
        max: dayjs().toISOString(),
        operators: ["$gte", "$lte"],
        defaultOperator: "$gte",
      },
    ],
    [t],
  );

  return (
    <Page
      title={t("user:workspaces.title")}
      description={t("user:workspaces.description")}
      primaryAction={{
        render: <Link to="/user/workspaces/create" />,
        icon: <Plus data-icon="inline-start" />,
        label: t("user:workspaces.create"),
      }}
    >
      <PageLayout>
        {invitations.length > 0 ||
        invitationPage.after ||
        invitationPage.before ? (
          <PageLayoutSection>
            <Card>
              <CardHeader>
                <CardTitle>{t("user:workspaces.invitations.title")}</CardTitle>
                <CardDescription>
                  {t("user:workspaces.invitations.description")}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <DataTable
                  columns={[
                    {
                      accessorKey: "workspace.name",
                      header: t("user:workspaces.invitations.table.workspace"),
                      cell: ({ row }) => (
                        <span className="font-medium">
                          {row.original.workspace.name}
                        </span>
                      ),
                    },
                    {
                      accessorKey: "roles",
                      header: t("user:workspaces.invitations.table.role"),
                      cell: ({ row }) => getRolesLabel(row.original.roles),
                    },
                    {
                      accessorKey: "expiresAt",
                      header: t("user:workspaces.invitations.table.expires_at"),
                      cell: ({ row }) =>
                        dayjs(row.original.expiresAt).format(
                          "YYYY-MM-DD HH:mm",
                        ),
                    },
                    {
                      id: "actions",
                      header: "",
                      size: 220,
                      cell: ({ row }) => (
                        <div
                          className="flex justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={invitationActionPending}
                            loading={rejectingInvitationId === row.original.id}
                            onClick={() =>
                              handleRejectInvitation(row.original.id)
                            }
                          >
                            <X />
                            {t("user:workspaces.invitations.reject")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={invitationActionPending}
                            loading={acceptingInvitationId === row.original.id}
                            onClick={() =>
                              handleAcceptInvitation(row.original.id)
                            }
                          >
                            <Check />
                            {t("user:workspaces.invitations.accept")}
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                  data={invitations}
                  pagination={{
                    hasPreviousPage: invitationPageInfo?.hasPreviousPage,
                    hasNextPage: invitationPageInfo?.hasNextPage,
                    onPreviousPage: () =>
                      setInvitationPage({
                        last: 20,
                        before: invitationPageInfo?.startCursor ?? undefined,
                      }),
                    onNextPage: () =>
                      setInvitationPage({
                        first: 20,
                        after: invitationPageInfo?.endCursor ?? undefined,
                      }),
                  }}
                />
              </CardContent>
            </Card>
          </PageLayoutSection>
        ) : null}

        <PageLayoutSection>
          <Card>
            <CardContent>
              <div className="space-y-4">
                <DataFilter
                  filters={filters}
                  loading={loading}
                  value={{ filter: filterValues, query }}
                  search={{ placeholder: t("user:workspaces.search") }}
                  onChange={(value) => {
                    navigate({
                      to: "/user/workspaces",
                      search: {
                        query: value.query || undefined,
                        filter: isEmpty(value.filter)
                          ? undefined
                          : value.filter,
                        orderBy: search.orderBy,
                      },
                    });
                  }}
                />
                <DataTable
                  columns={[
                    {
                      accessorKey: "name",
                      header: t("user:workspaces.table.name"),
                      cell: ({ row }) => (
                        <Link
                          to="/workspaces/$workspaceId"
                          params={{ workspaceId: row.original.id }}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium"
                        >
                          {row.original.name}
                        </Link>
                      ),
                    },
                    {
                      accessorKey: "createdAt",
                      header: t("user:workspaces.table.created_at"),
                      cell: ({ row }) =>
                        dayjs(row.original.createdAt).format("YYYY-MM-DD"),
                    },
                    {
                      accessorKey: "updatedAt",
                      header: t("user:workspaces.table.updated_at"),
                      cell: ({ row }) =>
                        dayjs(row.original.updatedAt).format("YYYY-MM-DD"),
                    },
                  ]}
                  data={workspaces}
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
                  onRowClick={(row) => {
                    navigate({
                      to: "/workspaces/$workspaceId",
                      params: { workspaceId: row.original.id },
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </PageLayoutSection>
      </PageLayout>
    </Page>
  );
}
