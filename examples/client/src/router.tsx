import {
  ApolloClient,
  InMemoryCache,
  routerWithApolloClient,
} from "@apollo/client-integration-tanstack-start";
import {
  ApolloLink,
  CombinedGraphQLErrors,
  HttpLink,
  ServerError,
  UnconventionalError,
} from "@apollo/client";
import { createRouter } from "@tanstack/react-router";
import { ErrorLink } from "@apollo/client/link/error";

import { routeTree } from "./routeTree.gen";
import { NotFoundPage } from "./components/route-page-template/not-found-page";
import i18next from "@/lib/i18n";

export const getRouter = () => {
  const apolloClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([
      new ErrorLink(({ error }) => {
        if (CombinedGraphQLErrors.is(error)) {
          let hasAuthError = false;

          error.errors.forEach(({ message, extensions }) => {
            console.log(`GraphQL error: ${message}`);

            if (
              extensions?.code &&
              ["UNAUTHORIZED", "UNAUTHENTICATED"].includes(
                extensions.code as string,
              )
            ) {
              hasAuthError = true;
            }

            if (hasAuthError) {
              window.location.href = "/auth/login";
            }
          });
        } else if (ServerError.is(error)) {
          console.log(`Server error: ${error.message}`);
        } else if (UnconventionalError.is(error)) {
          console.log(`Other error: ${error.message}`);
        }
      }),
      new ApolloLink((operation, forward) => {
        operation.setContext(({ headers = {} }) => {
          const workspaceId =
            location.pathname.match(/^\/workspaces\/(\d+)/)?.[1];

          if (workspaceId) {
            document.cookie = `workspace_id=${encodeURIComponent(workspaceId)}; path=/; max-age=31536000; samesite=lax`;
          }

          return {
            headers: {
              ...headers,
              ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
              "x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          };
        });

        return forward(operation);
      }),
      new HttpLink({ uri: "/api/graphql", credentials: "include" }),
    ]),
    dataMasking: true,
  });

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
    notFoundMode: "root",
    defaultPreload: "intent",
    context: {
      ...routerWithApolloClient.defaultContext,
      i18n: i18next,
    },
  });

  return routerWithApolloClient(router, apolloClient);
};
