import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it("enables only user credentials with a single-target owner union", async () => {
  await verifyAuthFeatures(
    { apiKey: { enabled: true, user: { enabled: true } } },
    { admin: false, workspace: false, owners: ["User"] },
  );
}, 30000);
