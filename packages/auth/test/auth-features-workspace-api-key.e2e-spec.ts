import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it("enables workspace credentials without user credentials or administration", async () => {
  await verifyAuthFeatures(
    {
      workspace: { enabled: true },
      apiKey: { enabled: true, workspace: { enabled: true } },
    },
    { admin: false, workspace: true, owners: ["WorkspaceMember"] },
  );
}, 30000);
