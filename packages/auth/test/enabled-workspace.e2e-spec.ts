import { verifyAuthBootstrap } from "./fixtures/auth-workspace-bootstrap.fixture.js";
describe("workspace enabled", () => {
  it.each([false, true])(
    "boots workspace authentication (async: %s)",
    async (asyncOptions) => {
      await verifyAuthBootstrap({ enabled: true }, asyncOptions);
    },
    30000,
  );
});
