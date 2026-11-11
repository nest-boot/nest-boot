import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it("keeps workspace membership independent of credential features", async () => {
  await verifyAuthFeatures(
    { workspace: { enabled: true } },
    { admin: false, workspace: true, owners: [] },
  );
}, 30000);
