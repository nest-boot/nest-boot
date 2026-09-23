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
profile page supports a two-stage email change that confirms the current
address before verifying the new address.

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

When refreshing registry components, preserve the alert dialog `data-testid`
attributes and checkbox group option `testId` support used by the example's
end-to-end tests. Resource creation and long permission forms use standalone
compact pages; confirmation dialogs retain their viewport bounds.

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
Use theme color tokens from `src/styles.css` in application code.

API key lists use `DataFilter` and `DataTable`; rows and name links open details.
Creation and details use separate compact pages at `/user/api-keys/create`,
`/user/api-keys/$apiKeyId`, `/workspaces/$workspaceId/api-keys/create`, and
`/workspaces/$workspaceId/api-keys/$apiKeyId`. The create page reveals the full
key once in a success Card. Keep that secret in component state only, outside
URLs and persistent storage; the creation mutation does not cache it. Details
query through the current user/workspace and allow read-only viewing when the
principal lacks write permission. Enable/disable and delete remain list actions.

API-key pages also demonstrate two hooks for list/detail navigation:

- `usePageSearch({ key, searchSchema, search? })` returns `pageSearch` and
  `setPageSearch`. Lists pass `search: Route.useSearch()`; the hook applies it
  through the setter in an effect on mount, value changes, or user/page scope
  changes. Omitting `search` only reads saved state; explicitly passing
  `search: undefined` clears it. Equal search objects are not reapplied on
  rerenders, so manual updates are retained until the supplied search changes.
  The setter accepts a value or a function of the latest shared value;
  `{}` resets to schema defaults and `undefined` clears storage.
  Writes are schema-validated; invalid updates throw and preserve the saved value.
  The current user's ID scopes every key. Personal keys use `["user", "api-keys"]`; workspace keys
  use `["workspaces", workspaceId, "api-keys"]`. All callers of a key must reuse
  the same schema. Schemas must normalize JSON-compatible search values
  idempotently, as the existing connection search schemas do. Invalid stored
  data is discarded; unavailable storage falls back to memory for that tab.
- `usePageNavigation({ key, searchSchema, record, query })` reads those
  conditions and calculates the current cursor from the live record's ID and
  sort value. Without `orderBy` (or with `null`), the server defaults to ID
  ascending and the cursor contains only the ID. When a list applies its own
  default ordering, its search schema must normalize that `orderBy`;
  GraphQL order names map to camelCase record fields (`CREATED_AT` to `createdAt`).
  Include each supported sort field in the detail query; explicit `null` values
  are supported, while a missing field raises an error instead of an incorrect
  cursor. No cursor map is persisted. The required, stable
  `query({ pageSearch, cursor })` closure receives the current list search and
  the detail record's cursor separately; a list's `after`/`before` cannot stand in
  for the current record. The calculated cursor is passed only to the query closure,
  not exposed in the hook's return value. The closure
  returns `{ previous: { edges }, next: { edges } }`, with each edge containing
  `cursor` and `node.id`. It runs when the record cursor, user/page scope, filters,
  sorting, or closure changes; updating only pagination does not trigger another
  request. API-key pages supply a `useCallback` closure executing Apollo's
  `useLazyQuery` for both adjacent records in one request. GraphQL accepts one
  `$cursor`, using it as `before` with `last: 1` and as `after` with `first: 1`;
  both directions share the search query, filter, and ordering.
  The hook returns `previous`, `next`, `loading`, `error`, and `refetch()` for
  navigation and retries. It ignores obsolete responses after record/scope changes
  or retries and hides stale links during loading or errors. A missing query owner
  is an error; an empty edges array is a valid boundary.
  Pages use `backSearch` directly for both breadcrumb and footer links. While
  loading or on failure it retains `pageSearch`. After a successful query, saved
  search is positioned using the preceding cursor so the current record becomes
  the first list row, retaining filters, sorting, and page size. No predecessor
  means the filtered first page. The hook calls `setPageSearch` internally to save
  this position, including after browser back/forward; pages need no separate
  persistence effect. Without saved search, `backSearch` uses schema defaults and
  no list visit is written. `pageSearch` and `setPageSearch` remain available for
  explicit updates. Query closures use list filters and ordering; list pagination
  is retained for returning to the list and does not drive adjacent-record queries.

The list URL remains authoritative: entering a bare list URL resets its search
instead of silently restoring storage. Direct detail visits without saved search
use schema defaults. Browser history continues to restore its own URLs; no
cross-tab synchronization or frozen snapshot of changing records is provided.

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
