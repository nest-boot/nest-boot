import { useQuery } from "@apollo/client/react";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import dayjs from "dayjs";
import { t } from "i18next";
import { ArrowRight, Plus } from "lucide-react";
import { pick } from "lodash";

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
import { WorkspaceOrderField } from "@/gql/graphql";
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

  const { data } = useQuery(GET_WORKSPACES_FROM_USER_WORKSPACES_ROUTE, {
    variables: {
      ...pick(search, ["after", "before", "first", "last"]),
      orderBy: {
        field: search.orderBy?.field ?? WorkspaceOrderField.CREATED_AT,
        direction: search.orderBy?.direction ?? OrderDirection.DESC,
      },
    },
  });

  const workspaces = data?.workspaces.edges.map(({ node }) => node) ?? [];
  const pageInfo = data?.workspaces.pageInfo;

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

      <PageContent>
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
