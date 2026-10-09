import { useMutation } from "@apollo/client/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { t } from "i18next";
import { MemberType } from "@/gql/graphql";
import { createAbilitySubject } from "@/lib/ability";
import { graphql } from "@/gql";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

import { useCreatedApiKey } from "@/app/_authenticated/contexts/created-api-key-context";
import { ApiKeyFormPage } from "@/components/api-key-form-page";
import { useResourceNavigation } from "@/hooks/use-resource-navigation";
import { apiKeySearchSchema } from "@/schemas/api-key-search-schema";
import { getMemberApiKeysResourceKey } from "@/lib/resource-keys";
import {
  getDefaultApiKeyPermissions,
  getPermissionOptions,
  memberApiKeyPermissionValues,
} from "@/lib/permissions";
import { isAccessDenied } from "@/lib/auth-errors";

const CREATE_API_KEY_FROM_API_KEYS_ROUTE = graphql(`
  mutation createMemberApiKeyFromApiKeysRoute(
    $input: CreateMemberApiKeyInput!
  ) {
    createMemberApiKey(input: $input) {
      apiKey
      entity {
        workspaceId
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

const ADD_SERVICE_ACCOUNT_FOR_API_KEY = graphql(`
  mutation addServiceAccountForApiKey($input: AddMemberInput!) {
    addMember(input: $input) {
      id
    }
  }
`);

const GET_MEMBER_API_KEY_OPTIONS = graphql(`
  query getMemberApiKeyOptions(
    $includeMembers: Boolean! = false
    $after: String
    $memberFilter: MemberFilter
  ) {
    currentWorkspace @include(if: $includeMembers) {
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
    memberApiKeyPermissions {
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
    if (!context.ability.can("write", "MemberApiKey")) throw denied();
    const canCreateServiceAccount = context.ability.can(
      "write",
      createAbilitySubject("Member", {
        workspaceId: params.workspaceId,
        type: MemberType.SERVICE_ACCOUNT,
      }),
    );
    const includeMembers = context.ability.can(
      "read",
      createAbilitySubject("Member", {
        workspaceId: params.workspaceId,
        type: MemberType.SERVICE_ACCOUNT,
      }),
    );
    const memberFilter = {
      type: { $eq: "SERVICE_ACCOUNT" },
      status: { $eq: "ACTIVE" },
    };
    const { data } = await context.apolloClient
      .query({
        query: GET_MEMBER_API_KEY_OPTIONS,
        variables: { includeMembers, memberFilter },
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      })
      .catch((error: unknown) => {
        if (isAccessDenied(error)) throw denied();
        throw error;
      });
    const members =
      data?.currentWorkspace?.members.edges.map(({ node }) => node) ?? [];
    let pageInfo = data?.currentWorkspace?.members.pageInfo;
    while (pageInfo?.hasNextPage && pageInfo.endCursor) {
      const page = await context.apolloClient.query({
        query: GET_MEMBER_API_KEY_OPTIONS,
        variables: { includeMembers, memberFilter, after: pageInfo.endCursor },
        fetchPolicy: "network-only",
        context: { headers: { "x-workspace-id": params.workspaceId } },
      });
      members.push(
        ...(page.data?.currentWorkspace?.members.edges.map(
          ({ node }) => node,
        ) ?? []),
      );
      pageInfo = page.data?.currentWorkspace?.members.pageInfo;
    }
    return {
      canCreateServiceAccount,
      memberOptions: members.map((member) => ({
        value: member.id,
        label: member.name,
      })),
      permissionOptions: data?.memberApiKeyPermissions ?? [],
      title: t("api-key:create.title"),
    };
  },
});

function CreateApiKeyPage() {
  const navigate = Route.useNavigate();
  const { setCreatedKey } = useCreatedApiKey();
  const { workspaceId } = Route.useParams();
  const currentUser = useCurrentUserContext();
  const { backSearch } = useResourceNavigation({
    key: [currentUser.id, ...getMemberApiKeysResourceKey(workspaceId)],
    searchSchema: apiKeySearchSchema,
  });
  const { permissionOptions, memberOptions, canCreateServiceAccount } =
    Route.useRouteContext();
  const [addServiceAccount] = useMutation(ADD_SERVICE_ACCOUNT_FOR_API_KEY, {
    fetchPolicy: "no-cache",
  });
  const [createApiKey] = useMutation(CREATE_API_KEY_FROM_API_KEYS_ROUTE, {
    fetchPolicy: "no-cache",
  });
  return (
    <ApiKeyFormPage
      key={workspaceId}
      canWrite
      memberOptions={memberOptions}
      canCreateServiceAccount={canCreateServiceAccount}
      listPath={`/workspaces/${workspaceId}/api-keys`}
      listSearch={backSearch}
      permissionValues={memberApiKeyPermissionValues}
      permissionOptions={getPermissionOptions(permissionOptions)}
      defaultPermissions={getDefaultApiKeyPermissions(permissionOptions)}
      onSave={async (input) => {
        let memberId = input.memberId;
        if (!memberId) {
          const result = await addServiceAccount({
            variables: {
              input: {
                type: MemberType.SERVICE_ACCOUNT,
                name: input.name,
                ...(input.permissions.length
                  ? { roles: [], permissions: input.permissions }
                  : {}),
              },
            },
          });
          memberId = result.data?.addMember.id;
          if (!memberId) throw new Error(t("api-key:form.save_failed"));
        }
        const result = await createApiKey({
          variables: { input: { ...input, memberId } },
        });
        const created = result.data?.createMemberApiKey;
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
