import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it("enables system credentials without enabling user or workspace credentials", async () => {
  await verifyAuthFeatures(
    { admin: { enabled: true }, apiKey: { enabled: true } },
    { admin: true, workspace: false, owners: ["SystemAccount"] },
  );
}, 30000);
