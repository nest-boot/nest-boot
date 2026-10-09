import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { useTranslation } from "react-i18next";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";
import { Link } from "@/components/link";
import { ServiceAccountForm } from "@/components/service-account-form";
import { Page } from "@/components/thread-ui/page";
import { MemberType } from "@/gql/graphql";
import { graphql } from "@/gql";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { createAbilitySubject } from "@/lib/ability";
import { getMembersResourceKey } from "@/lib/resource-keys";
import { memberSearchSchema } from "@/schemas/member-search-schema";
import { isAccessDenied } from "@/lib/auth-errors";

const GET_SERVICE_ACCOUNT_GRANTS = graphql(`
  query getServiceAccountGrantsFromCreateMemberRoute {
    workspaceRoles {
      role
      grantable
    }
    workspacePermissions {
      permission
      grantable
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/members/create-service-account/",
)({
  component: CreateServiceAccountPage,
  beforeLoad: async ({ context, params }) => {
    if (!context.ability.can("read", "Member")) {
      throw redirect({ to: "/workspaces/$workspaceId", params });
    }
    if (
      !context.ability.can(
        "write",
        createAbilitySubject("Member", {
          workspaceId: params.workspaceId,
          type: MemberType.SERVICE_ACCOUNT,
        }),
      )
    ) {
      throw redirect({ to: "/workspaces/$workspaceId/members", params });
    }
    const { data } = await context.apolloClient
      .query({
        query: GET_SERVICE_ACCOUNT_GRANTS,
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error))
          throw redirect({ to: "/workspaces/$workspaceId/members", params });
        throw error;
      });
    return {
      title: t("member:service_account.create"),
      roleOptions: data?.workspaceRoles ?? [],
      permissionOptions: data?.workspacePermissions ?? [],
    };
  },
});

function CreateServiceAccountPage() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { roleOptions, permissionOptions } = Route.useRouteContext();
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...getMembersResourceKey(workspaceId)],
    searchSchema: memberSearchSchema,
  });

  return (
    <Page
      variant="compact"
      title={t("member:service_account.create")}
      breadcrumbActions={[
        {
          label: t("member:title"),
          render: (
            <Link
              to="/workspaces/$workspaceId/members"
              params={{ workspaceId }}
              search={backSearch}
            />
          ),
        },
      ]}
    >
      <ServiceAccountForm
        key={workspaceId}
        workspaceId={workspaceId}
        roleOptions={roleOptions}
        permissionOptions={permissionOptions}
      />
    </Page>
  );
}
