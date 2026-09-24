# Example client

TanStack Start client for the Nest Boot full-stack example. It uses Apollo
Client and GraphQL for browser authentication and application APIs, including
social and generic OAuth authorization flows. Better Auth remains an internal
server implementation detail. The UI uses shadcn, internationalization, and
Playwright end-to-end tests. The shadcn components use the Base UI Rhea style
(`base-rhea`) with the neutral color palette and Lucide icons.

Email/password flows use GraphQL end to end. The example includes persistent
and browser-session sign-in, enumeration-safe password recovery, reset-token
handling, registration verification with resend and callback states, and
authenticated password changes under `/user/security`. The security page also
lists active sessions and can revoke one or every other session. The personal
profile page at `/user/profile` supports a two-stage email change that confirms
the current address before verifying the new address.

## Run locally

Start the example server first, then run the client:

```bash
cp examples/server/.env.example examples/server/.env
pnpm --filter @nest-boot/example-server dev
pnpm --filter @nest-boot/example-client dev
```

The client listens on `http://localhost:3000` and proxies `/api` requests to
`http://localhost:4000`.

## UI components

`components.json` selects the shadcn `base-rhea` style and the
[Thread UI registry](https://thread-ui.vercel.app/r/registry.json). Components
are checked into `src/components/ui` and `src/components/thread-ui`; Thread UI
translations are in `public/locales/{en,zh}/thread-ui.json`.

Use `toast.add({ type: "success", title: "..." })` from
`@/components/thread-ui/toast` for notifications. `AppProvider` mounts the
matching Base UI toaster. Keep `i18next` as a runtime dependency and
`react-day-picker` at the version required by Thread UI's calendar registry.

Refresh installed Thread UI components through the registry without adding
test-only component extensions. End-to-end tests default to English and locate
registry controls by role and translated accessible name; language preference
tests also cover Chinese. Resource creation and long permission forms use
standalone pages; confirmation dialogs retain their viewport bounds.

The theme comes from `@thread-ui/theme`. After refreshing components, refresh
the theme last from this directory:

```bash
pnpm dlx shadcn@latest add @thread-ui/theme --overwrite
```

This `registry:theme` item writes colors, radii, and base styles into
`src/styles.css`, as configured in `components.json`; it is not a runtime CSS
package. Keep the Tailwind imports and generated styles in that entry point,
without a separate local palette. Pages use `bg-canvas`, sidebars use
`bg-sidebar`, and the topbar uses `bg-topbar`, all supplied by the theme.

ESLint includes [@shadcn/lint](https://github.com/shadcn-ui/lint) checks for
component restyling, raw colors, arbitrary values, inline styles, dynamic
component classes, and unknown Tailwind classes. Prefer default component
styles and existing `variant`/`size` props. Use `FormLayout` with
`FormLayoutItem` for form layout and plain `div` elements for other custom
layout; do not add Card or Field styling exceptions to the lint rules.
Keep card titles and descriptions in `CardHeader`, the body in `CardContent`,
and submit buttons and standalone card actions in `CardFooter`. When a submit
button is outside its form, connect it to the form's `id` with the native `form`
attribute so validation, Enter-key submission, and loading states keep working.
Use `Page variant="compact"` for form pages, with full-width `PageLayoutSection`
elements so cards stay stacked within the compact page.
`PagePagination` groups `PagePreviousAction` and `PageNextAction` inside
`PageActions`, after the primary action. Each action supports `disabled`,
`onClick`, and `render` for router links. The registry component hides pagination
below the `@2xl/page` container breakpoint (42rem). Page padding belongs to the
outer wrapper, so a compact page can reach that breakpoint and display pagination.
Its default accessible labels are translated through the `thread-ui` namespace.
Use theme color tokens from `src/styles.css` in application code.

API key lists use `DataFilter` and `DataTable`; rows and name links open details.
Use `DataFilterField` for toolbar filter configurations. `DataFilterItem` is a
standalone controlled condition; `DataFilterItemProps` describes its component
props, including `value` and `onChange`.
Creation and details use separate pages at `/user/api-keys/create`,
`/user/api-keys/$apiKeyId`, `/workspaces/$workspaceId/api-keys/create`, and
`/workspaces/$workspaceId/api-keys/$apiKeyId`. Creation and details both use
compact pages. Details include `PagePagination` and its previous/next
actions, following the registry's narrow-container visibility rule.
The create page reveals the full
key once in a success Card. Keep that secret in component state only, outside
URLs and persistent storage; the creation mutation does not cache it. Details
query through the current user/workspace and allow read-only viewing when the
principal lacks write permission. Enable/disable and delete remain list actions.

The Overview pages are `/user`, `/admin`, and `/workspaces/$workspaceId`.
They show live resource counts and authorized management links, using default
Card sections inside PageLayout. Multi-card summaries use a plain grid wrapper
for equal-height cards and aligned footer actions, without restyling Card.
Counts preserve the server's lower-bound indicator, and failed queries expose
a retry action. Workspace overview queries
send both the workspace ID variable and header to isolate results when switching.
Overview sidebar links use `activeOptions={{ exact: true }}`; resource links
remain active on their detail routes. Workspace list rows, workspace switching,
and successful workspace creation open the workspace Overview. The identity
row still opens Profile, and the administrator menu opens `/admin`.
Top-level pages linked from the sidebar have no back action. Details, creation,
and invitation pages retain their return-to-list breadcrumbs.

Shared resource search schemas, their inferred types, and tests live in
`src/schemas`. Common DataFilter schema builders stay in
`lib/data-filter-search-schema.ts`; their results are optional and normalize
invalid field values to `undefined`. `lib/connection-search.ts` provides the
common pagination schema factory and previous/next search helpers. Keep reusable
functions in `lib` and schema definitions and inferred types in `schemas`.
Resource key constants and factories live in `lib/resource-keys.ts`; callers add
their user scope. GraphQL variable conversion uses `lib/connection-query-variables.ts`.

API keys, administrator users, members, and workspaces share
`useResourceNavigation({ key, searchSchema, search?, query? })` for list state and
optional adjacent-record navigation:

```tsx
// List: the URL supplies the authoritative search.
useResourceNavigation({
  key: [currentUser.id, ...userApiKeysResourceKey],
  searchSchema: apiKeySearchSchema,
  search: Route.useSearch(),
});

// Creation: restore the list state for return links, without querying neighbors.
const { backSearch } = useResourceNavigation({
  key: [currentUser.id, ...userApiKeysResourceKey],
  searchSchema: apiKeySearchSchema,
});

// Detail: a stable closure queries neighbors of the current record.
const navigation = useResourceNavigation({
  key: [currentUser.id, ...userApiKeysResourceKey],
  searchSchema: apiKeySearchSchema,
  query, // useCallback(({ search }) => ..., [record, loadNeighbors])
});
```

The hook returns `search`, `setSearch`, `clearSearch`, `backSearch`,
`previousEdge`, `nextEdge`, `loading`, `error`, and `refetch()`.

- The storage key is exactly `resource-navigation:${JSON.stringify(key)}`.
  Callers supply the complete scope: `[currentUser.id, "user", "api-keys"]` for
  personal keys, or `[currentUser.id, "workspaces", workspaceId, "api-keys"]`
  for workspace keys. The hook does not depend on authentication context or add
  key segments.
- Pass the same `searchSchema` for every caller sharing a key. It must accept
  `{}` and normalize JSON-compatible search values idempotently, including any
  client-side default sort. Resource-specific fields such as `savedViewId` stay
  in this schema. Invalid stored data is discarded; unavailable storage falls
  back to shared memory for the current tab.
- Supplied `search` is validated and synchronized on mount, value changes, and
  key changes. A query in the same hook sees the supplied state immediately.
  Equal inputs are not reapplied over explicit shared updates. Omitting `search`
  or passing `undefined` only reads saved state. `setSearch` accepts a value or a
  function of the latest stored value (possibly `undefined`); `{}` saves schema
  defaults, while `clearSearch()` or `setSearch(undefined)` removes stored state.
  Invalid updates throw without replacing a valid value. Public `search` and
  `backSearch` use schema defaults when storage is empty, without writing a
  fictitious list visit.
- Without `query`, the hook only manages search state: no request runs, `loading`
  is false, edges and errors are absent, and `refetch()` resolves to `undefined`.
  Details supply a stable `query({ search })` closure that captures the current
  record and calls `createConnectionCursor(record, search)`. Include the record
  in `useCallback` dependencies so browser back/forward and record changes
  trigger new requests. The hook also reruns for key, filter, sort, or other
  non-pagination search changes. Changing only `first`, `last`, `after`, or
  `before` does not repeat adjacent-record queries.
- The cursor utility uses the record ID alone when `orderBy` is absent or null,
  matching the server's default ID ordering. GraphQL order names map to camelCase
  record fields (`CREATED_AT` to `createdAt`); include every supported sort field
  in the detail query. Explicit null values are supported; missing sort fields
  throw and become navigation errors. List pagination is not a record cursor.
  No record or cursor is passed to the hook, and no cursor map is persisted.
- The query returns `{ previousEdge?, nextEdge? }`. Each `ResourceNavigationEdge`
  contains a full `cursor` and `node.id: string | number`. Omit unavailable edges.
  Detail pages use Apollo `useLazyQuery` to fetch both directions in one request:
  the current cursor is `before` with `last: 1` and `after` with `first: 1`, sharing
  filters and ordering. `{}` is a valid result with no neighbors; a missing owner
  returns `undefined` and becomes a navigation error. Obsolete responses are
  ignored; loading and errors hide stale links. `refetch()` supports retrying.
- Detail links consume `backSearch`. Loading and errors preserve saved search.
  Success positions saved search after `previousEdge.cursor`, keeping the current
  record first when returning to the list while retaining filters, sorting, view
  metadata, and page size. No predecessor means the filtered first page. This
  position is saved internally; direct visits without saved search use defaults
  without creating a stored list visit.

The list URL remains authoritative: a bare list URL resets its search instead of
silently restoring storage. Browser history restores its own URLs; no cross-tab
synchronization or frozen snapshot of changing records is provided.

Administrator user keys are `[currentUser.id, "admin", "users"]`; member keys
are `[currentUser.id, "workspaces", workspaceId, "members"]`. List and neighbor
requests use the same normalized conditions. Member queries explicitly send the
workspace header and verify the returned workspace ID. Workspace management uses
`[currentUser.id, "user", "workspaces"]` without `query`; creation return links
and redirects after leaving or deleting a workspace preserve its saved search.
Workspace settings has no previous/next actions or neighbor requests. Profile
and security remain independent compact forms without record navigation.

Create users at `/admin/users/create` and invite members at
`/workspaces/$workspaceId/members/invite`. Both routes check the relevant creation
ability, validate with TanStack Form, and keep submit actions in `CardFooter`.
User creation returns to the refreshed user list. Invitations show the link in a
success Card on the same page; automatic clipboard failures leave the link
available for manual copying, and returning to Members refreshes the invitation
list. Role choices are restricted to the caller's grantable workspace roles.

Use TanStack Form (`@tanstack/react-form`) for editable forms, including login,
password recovery/change, administrator edits, and password-confirmed account
deletion. Keep values, validation, errors, and submission state in the form;
Apollo mutations still perform requests. Await those requests and any refresh
before ending submission. Separate Card forms save independently, so saving
roles must not reset an unsaved profile draft.

The migrated forms validate on submit and clear request errors on edit/retry.
They do not bind blur validation: clearing a submit error on blur can move the
footer button between pointer-down and pointer-up and swallow a retry click.
Keep submission guards and native form associations for Enter-key submission.
Use local UI state for dialogs/success screens, URL state for DataFilter and
pagination, and direct mutations for actions with no editable fields.

Application JSX also rejects native form controls and tables in favor of the
existing components, and uses Thread UI's form controls and buttons instead of
importing their lower-level shadcn counterparts. The local `client-ui/card-structure`
rule checks Card section nesting, title/description placement, form field
placement, and explicit submit buttons. It understands import aliases,
namespaces, render props, and nested cards; dialogs form a separate boundary.
Reusable components may return Card sections without a local Card wrapper.
Inline list actions remain in `CardContent`; deciding whether an `onClick`
action applies to a row or the whole card still requires review.

The workspace menu refreshes whenever its popup mounts. It uses Apollo's
`no-cache` policy so each opening gets current membership without relying on
other queries invalidating the cache. `fetchMore` merges pages with `updateQuery`
and deduplicates workspace IDs; there is no separate React copy of connection
or pagination data. A closed menu's late requests cannot update a new opening.
Loading, initial-query retry, and pagination failures have explicit UI states.

The topbar's user row links to the profile. Its Language and Theme submenus
persist preferences in the browser, with Chinese/English and light/dark/system
options. Use `useTranslation` in rendered components so text updates when the
language changes; route metadata can use the shared i18next instance.

The rules recognize both shadcn/ui and Thread UI imports. Thread UI
implementations can define their own variants and structural styles; the
Badge implementation permits its palette-based color variants. The existing
ignore for generated `src/components/ui` source remains in place.

## Generated GraphQL types

The checked-in GraphQL client types are generated from
`examples/server/schema.gql`:

```bash
pnpm --filter @nest-boot/example-client codegen
```

## Verification

```bash
pnpm --filter @nest-boot/example-client build
pnpm --filter @nest-boot/example-client lint
pnpm --filter @nest-boot/example-client test
pnpm --filter @nest-boot/example-client test:e2e
```
