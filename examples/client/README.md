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
end-to-end tests. Keep the dialog content's viewport height limit and vertical
scrolling so long permission forms remain usable on smaller screens.

ESLint includes [@shadcn/lint](https://github.com/shadcn-ui/lint) checks for
component restyling, raw colors, arbitrary values, inline styles, dynamic
component classes, and unknown Tailwind classes. Prefer default component
styles and existing `variant`/`size` props. Use `FormLayout` with
`FormLayoutItem` for form layout and plain `div` elements for other custom
layout; do not add Card or Field styling exceptions to the lint rules.
Keep card titles and descriptions in `CardHeader`, the body in `CardContent`,
and standalone card actions in `CardFooter`.
Use `Page variant="compact"` for form pages, with full-width `PageLayoutSection`
elements so cards stay stacked within the compact page.
Use theme color tokens from `src/styles.css` in application code.

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
