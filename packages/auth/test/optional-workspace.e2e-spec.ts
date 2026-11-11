import { verifyAuthBootstrap } from "./fixtures/auth-workspace-bootstrap.fixture.js";
// Nest GraphQL caches external field metadata; each feature mode uses an isolated test file.
describe.each([
  { name: "default", workspace: undefined },
  { name: "empty options", workspace: {} },
  { name: "explicitly disabled", workspace: { enabled: false } },
])("workspace disabled ($name)", ({ workspace }) => {
  it.each([false, true])(
    "boots base authentication only (async: %s)",
    async (asyncOptions) => {
      await verifyAuthBootstrap(workspace, asyncOptions);
    },
    30000,
  );
});

it("uses DatabaseModule's custom schema for base-authentication owner triggers", async () => {
  await verifyAuthBootstrap(undefined, true, "tenant'auth");
}, 30000);
