import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import { pick } from "lodash";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { toast } from "@/components/thread-ui/toast";

import { Link } from "@/components/link";
import { DataTable } from "@/components/thread-ui/data-table";
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PagePrimaryAction,
  PageTitle,
} from "@/components/thread-ui/page";
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
import { WorkspaceOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
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
  validateSearch: zodValidator(
    createConnectionSearchSchema({
      pageSize: 20,
      orderField: WorkspaceOrderField,
      defaultOrderField: WorkspaceOrderField.CREATED_AT,
      defaultOrderDirection: OrderDirection.DESC,
    }),
  ),
});

function UserWorkspacesComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const location = useLocation();
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

  const { data, refetch } = useQuery(
    GET_WORKSPACES_FROM_USER_WORKSPACES_ROUTE,
    {
      variables: {
        invitationFirst: invitationPage.first,
        invitationLast: invitationPage.last,
        invitationAfter: invitationPage.after,
        invitationBefore: invitationPage.before,
        ...pick(search, ["after", "before", "first", "last"]),
        orderBy: {
          field: search.orderBy?.field ?? WorkspaceOrderField.CREATED_AT,
          direction: search.orderBy?.direction ?? OrderDirection.DESC,
        },
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

  return (
    <Page data-testid="user-workspaces-page">
      <PageHeader>
        <Breadcrumbs />
        <PageTitle>{t("user:workspaces.title")}</PageTitle>
        <PageDescription>{t("user:workspaces.description")}</PageDescription>
        <PageActions>
          <PagePrimaryAction
            data-testid="user-workspace-create-action"
            render={<Link to="/workspaces/create" />}
          >
            <Plus data-icon="inline-start" />
            {t("user:workspaces.create")}
          </PagePrimaryAction>
        </PageActions>
      </PageHeader>

      <PageContent>
        <PageLayout>
          {invitations.length > 0 ||
          invitationPage.after ||
          invitationPage.before ? (
            <PageLayoutSection>
              <Card data-testid="user-invitations">
                <CardHeader>
                  <CardTitle>
                    {t("user:workspaces.invitations.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("user:workspaces.invitations.description")}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <DataTable
                    columns={[
                      {
                        accessorKey: "workspace.name",
                        header: t(
                          "user:workspaces.invitations.table.workspace",
                        ),
                        cell: ({ row }) => (
                          <span
                            className="font-medium"
                            data-testid={`user-invitation-${row.original.id}`}
                          >
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
                        header: t(
                          "user:workspaces.invitations.table.expires_at",
                        ),
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
                              data-testid={`user-invitation-reject-${row.original.id}`}
                              disabled={invitationActionPending}
                              loading={
                                rejectingInvitationId === row.original.id
                              }
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
                              data-testid={`user-invitation-accept-${row.original.id}`}
                              disabled={invitationActionPending}
                              loading={
                                acceptingInvitationId === row.original.id
                              }
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
                <DataTable
                  columns={[
                    {
                      accessorKey: "name",
                      header: t("user:workspaces.table.name"),
                      cell: ({ row }) => (
                        <span
                          className="font-medium"
                          data-testid={`user-workspace-row-${row.original.id}`}
                        >
                          {row.original.name}
                        </span>
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
                    {
                      id: "open",
                      header: "",
                      size: 64,
                      cell: ({ row }) => (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("user:workspaces.open")}
                          render={
                            <Link
                              to="/workspaces/$workspaceId/settings"
                              params={{ workspaceId: row.original.id }}
                            />
                          }
                        >
                          <ArrowRight />
                        </Button>
                      ),
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
                      to: "/workspaces/$workspaceId/settings",
                      params: { workspaceId: row.original.id },
                    });
                  }}
                />
              </CardContent>
            </Card>
          </PageLayoutSection>
        </PageLayout>
      </PageContent>
    </Page>
  );
}
