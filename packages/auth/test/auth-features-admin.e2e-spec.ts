import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it("enables administration without registering credential models or APIs", async () => {
  await verifyAuthFeatures(
    { admin: { enabled: true } },
    { admin: true, workspace: false, owners: [] },
  );
}, 30000);
