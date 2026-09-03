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
import { toast } from "sonner";

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
import { graphql } from "@/gql";
import { WorkspaceMemberRole, WorkspaceOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
  getNextPageSearch,
  getPreviousPageSearch,
} from "@/lib/connection-search";

const GET_WORKSPACES_FROM_USER_WORKSPACES_ROUTE = graphql(`
  query getWorkspacesFromUserWorkspacesRoute(
    $after: String
    $before: String
    $first: Int
    $last: Int
    $orderBy: WorkspaceOrder
  ) {
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
    currentUserWorkspaceInvitations {
      id
      role
      expiresAt
      workspace {
        id
        name
      }
    }
  }
`);

const ACCEPT_WORKSPACE_INVITATION_FROM_USER_WORKSPACES_ROUTE = graphql(`
  mutation acceptWorkspaceInvitationFromUserWorkspacesRoute(
    $invitationId: ID!
  ) {
    acceptWorkspaceInvitation(invitationId: $invitationId) {
      invitation {
        id
        status
      }
      member {
        id
      }
    }
  }
`);

const REJECT_WORKSPACE_INVITATION_FROM_USER_WORKSPACES_ROUTE = graphql(`
  mutation rejectWorkspaceInvitationFromUserWorkspacesRoute(
    $invitationId: ID!
  ) {
    rejectWorkspaceInvitation(invitationId: $invitationId) {
      id
      status
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
        ...pick(search, ["after", "before", "first", "last"]),
        orderBy: {
          field: search.orderBy?.field ?? WorkspaceOrderField.CREATED_AT,
          direction: search.orderBy?.direction ?? OrderDirection.DESC,
        },
      },
    },
  );

  const [acceptWorkspaceInvitation] = useMutation(
    ACCEPT_WORKSPACE_INVITATION_FROM_USER_WORKSPACES_ROUTE,
  );
  const [rejectWorkspaceInvitation] = useMutation(
    REJECT_WORKSPACE_INVITATION_FROM_USER_WORKSPACES_ROUTE,
  );

  const handleAcceptInvitation = async (invitationId: string) => {
    setAcceptingInvitationId(invitationId);

    try {
      await acceptWorkspaceInvitation({ variables: { invitationId } });
      await refetch();
      toast.success(t("user:workspaces.invitations.toast.accepted"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("user:workspaces.invitations.toast.accept_failed"),
      );
    } finally {
      setAcceptingInvitationId(null);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    setRejectingInvitationId(invitationId);

    try {
      await rejectWorkspaceInvitation({ variables: { invitationId } });
      await refetch();
      toast.success(t("user:workspaces.invitations.toast.rejected"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("user:workspaces.invitations.toast.reject_failed"),
      );
    } finally {
      setRejectingInvitationId(null);
    }
  };

  const workspaces = data?.workspaces.edges.map(({ node }) => node) ?? [];
  const invitations = data?.currentUserWorkspaceInvitations ?? [];
  const pageInfo = data?.workspaces.pageInfo;
  const invitationActionPending =
    acceptingInvitationId !== null || rejectingInvitationId !== null;

  return (
    <Page data-testid="user-workspaces-page">
      <PageHeader>
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

      <PageContent className="space-y-8">
        {invitations.length > 0 ? (
          <section
            className="space-y-3"
            data-testid="user-workspace-invitations"
          >
            <div>
              <h3 className="font-semibold">
                {t("user:workspaces.invitations.title")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("user:workspaces.invitations.description")}
              </p>
            </div>

            <DataTable
              columns={[
                {
                  accessorKey: "workspace.name",
                  header: t("user:workspaces.invitations.table.workspace"),
                  cell: ({ row }) => (
                    <span
                      className="font-medium"
                      data-testid={`user-workspace-invitation-${row.original.id}`}
                    >
                      {row.original.workspace.name}
                    </span>
                  ),
                },
                {
                  accessorKey: "role",
                  header: t("user:workspaces.invitations.table.role"),
                  cell: ({ row }) => getRoleLabel(row.original.role),
                },
                {
                  accessorKey: "expiresAt",
                  header: t("user:workspaces.invitations.table.expires_at"),
                  cell: ({ row }) =>
                    dayjs(row.original.expiresAt).format("YYYY-MM-DD HH:mm"),
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
                        data-testid={`user-workspace-invitation-reject-${row.original.id}`}
                        disabled={invitationActionPending}
                        loading={rejectingInvitationId === row.original.id}
                        onClick={() => handleRejectInvitation(row.original.id)}
                      >
                        <X />
                        {t("user:workspaces.invitations.reject")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`user-workspace-invitation-accept-${row.original.id}`}
                        disabled={invitationActionPending}
                        loading={acceptingInvitationId === row.original.id}
                        onClick={() => handleAcceptInvitation(row.original.id)}
                      >
                        <Check />
                        {t("user:workspaces.invitations.accept")}
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={invitations}
            />
          </section>
        ) : null}

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
      </PageContent>
    </Page>
  );
}

function getRoleLabel(role: WorkspaceMemberRole): string {
  switch (role) {
    case WorkspaceMemberRole.OWNER:
      return t("workspace-member:role.owner");
    case WorkspaceMemberRole.ADMIN:
      return t("workspace-member:role.admin");
    case WorkspaceMemberRole.MEMBER:
      return t("workspace-member:role.member");
  }
}
