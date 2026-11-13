import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { useAuthWorkspaceMemberContext } from "../../contexts/auth-workspace-member-context";
import { WorkspaceMemberType } from "@/gql/graphql";
import { createAbilitySubject } from "@/lib/ability";
import { graphql } from "@/gql";
import { useAuthUserContext } from "@/app/_authenticated/contexts/auth-user-context";

import { useCreatedApiKey } from "@/app/_authenticated/contexts/created-api-key-context";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { getWorkspaceApiKeysResourceKey } from "@/lib/resource-keys";
import {
  getDefaultApiKeyPermissions,
  getPermissionOptions,
  workspaceApiKeyPermissionValues,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

const CREATE_WORKSPACE_API_KEY = graphql(`
  mutation createWorkspaceApiKey($input: CreateWorkspaceApiKeyInput!) {
    createWorkspaceApiKey(input: $input) {
      apiKey
      entity {
        id
        name
        start
        prefix
        revokedAt
        permissions
        createdAt
        lastUsedAt
        expiresAt
      }
    }
  }
`);

const GET_WORKSPACE_API_KEY_OPTIONS = graphql(`
  query getWorkspaceApiKeyOptions(
    $includeWorkspaceMembers: Boolean! = false
    $after: String
    $memberFilter: WorkspaceMemberFilter
  ) {
    selectedWorkspace @include(if: $includeWorkspaceMembers) {
      members(first: 100, after: $after, filter: $memberFilter) {
        edges {
          node {
            id
            name
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
    workspaceApiKeyPermissions {
      permission
      grantable
      default
    }
  }
`);

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/api-keys/create/",
)({
  component: CreateApiKeyPage,
  beforeLoad: async ({ context, params }) => {
    const denied = () =>
      redirect({
        to: "/workspaces/$workspaceId/api-keys",
        params: { workspaceId: params.workspaceId },
      });
    if (!context.ability.can("write", "WorkspaceApiKey")) throw denied();
    const canCreateWorkspaceServiceAccount = context.ability.can(
      "write",
      createAbilitySubject("WorkspaceMember", {
        workspaceId: params.workspaceId,
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
      }),
    );
    const includeWorkspaceMembers = context.ability.can(
      "read",
      createAbilitySubject("WorkspaceMember", {
        workspaceId: params.workspaceId,
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
      }),
    );
    const memberFilter = {
      type: { $eq: "SERVICE_ACCOUNT" },
      status: { $eq: "ACTIVE" },
    };
    const { data } = await context.apolloClient
      .query({
        query: GET_WORKSPACE_API_KEY_OPTIONS,
        variables: { includeWorkspaceMembers, memberFilter },
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    const members =
      data?.selectedWorkspace?.members.edges.map(({ node }) => node) ?? [];
    let pageInfo = data?.selectedWorkspace?.members.pageInfo;
    while (pageInfo?.hasNextPage && pageInfo.endCursor) {
      const page = await context.apolloClient.query({
        query: GET_WORKSPACE_API_KEY_OPTIONS,
        variables: {
          includeWorkspaceMembers,
          memberFilter,
          after: pageInfo.endCursor,
        },
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      });
      members.push(
        ...(page.data?.selectedWorkspace?.members.edges.map(
          ({ node }) => node,
        ) ?? []),
      );
      pageInfo = page.data?.selectedWorkspace?.members.pageInfo;
    }
    return {
      canCreateWorkspaceServiceAccount,
      memberOptions: members.map((member) => ({
        value: member.id,
        label: member.name,
      })),
      permissionOptions: data?.workspaceApiKeyPermissions ?? [],
      title: t("api-key:create.title"),
    };
  },
});

function CreateApiKeyPage() {
  const navigate = Route.useNavigate();
  const { setCreatedKey } = useCreatedApiKey();
  const { workspaceId } = Route.useParams();
  const currentUser = useAuthUserContext();
  const currentWorkspaceMember = useAuthWorkspaceMemberContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...getWorkspaceApiKeysResourceKey(workspaceId)],
    searchSchema: apiKeySearchSchema,
  });
  const { permissionOptions, memberOptions, canCreateWorkspaceServiceAccount } =
    Route.useRouteContext();
  const [createApiKey] = useMutation(CREATE_WORKSPACE_API_KEY, {
    fetchPolicy: "no-cache",
  });
  return (
    <ApiKeyFormPage
      key={workspaceId}
      canWrite
      currentWorkspaceMemberId={currentWorkspaceMember.id}
      memberOptions={memberOptions}
      canCreateWorkspaceServiceAccount={canCreateWorkspaceServiceAccount}
      listPath={`/workspaces/${workspaceId}/api-keys`}
      listSearch={backSearch}
      permissionValues={workspaceApiKeyPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      defaultPermissions={getDefaultApiKeyPermissions(permissionOptions)}
      onSave={async (input) => {
        const result = await createApiKey({
          variables: { input },
        });
        const created = result.data?.createWorkspaceApiKey;
        if (!created) throw new Error(t("api-key:form.save_failed"));
        setCreatedKey({
          pathname: `/workspaces/${workspaceId}/api-keys/${created.entity.id}`,
          secret: created.apiKey,
        });
        await navigate({
          to: "/workspaces/$workspaceId/api-keys/$apiKeyId",
          params: { workspaceId, apiKeyId: created.entity.id },
          replace: true,
        });
      }}
    />
  );
}
