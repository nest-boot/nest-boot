---
"@nest-boot/auth": minor
---

Separate workspace selection from authentication. Rename the request decorators to AuthUser, AuthSession, AuthApiKey, AuthWorkspaceMember, AuthWorkspace and SelectedWorkspace, while preserving currentUser, currentSession and currentWorkspaceMember GraphQL names. Expose selection through selectedWorkspace and authenticated workspace scope through currentWorkspace. Rename authentication response user data to AuthUserData. Update example clients and preserve the 8.x release series.

Header selection takes precedence over the workspace Cookie for all credential types. Selection does not require membership or grant permissions. WorkspaceApiKey requires explicit selection for private access, applies member grants only in its owning workspace, and can access other workspaces through explicit public-resource rules. Malformed selectors return 400; empty headers clear selection and unknown IDs do not fall back to the Cookie.

Project authenticated user, active workspace member, authenticated workspace and selected target into app.auth.user.id, app.auth.workspace_member.id, app.auth.workspace.id and app.selected.workspace.id. System credentials use the existing authenticated role and derive workspace scope from effective account/key/configuration grants without a database system-account identifier. Keep request context preparation outside business transactions. Generate example policy migrations from the native ORM metadata.

Retain captured API-key usage auditing when member credentials access public resources outside their owning workspace, without changing the business request's scope.
