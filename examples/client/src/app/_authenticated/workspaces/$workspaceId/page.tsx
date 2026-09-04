import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId/",
)({
  beforeLoad: ({ params: { workspaceId } }) => {
    throw redirect({
      to: "/workspaces/$workspaceId/settings",
      params: { workspaceId },
    });
  },
});
