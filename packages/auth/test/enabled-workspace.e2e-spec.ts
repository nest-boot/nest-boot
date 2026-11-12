import { verifyAuthBootstrap } from "./fixtures/auth-workspace-bootstrap.fixture.js";
describe.each(["public", "auth_custom"])(
  "workspace enabled in %s",
  (schema) => {
    it.each([false, true])(
      "boots workspace authentication (async: %s)",
      async (asyncOptions) => {
        await verifyAuthBootstrap({ enabled: true }, asyncOptions, schema);
      },
      30000,
    );
  },
);

it.each([false, true])(
  "uses the DATABASE_URL schema without an explicit target (async: %s)",
  async (asyncOptions) => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres:secret@127.0.0.1:5432/memory%3A%2F%2F?schema=auth_environment",
    );
    try {
      await verifyAuthBootstrap(
        { enabled: true },
        asyncOptions,
        "auth_environment",
        {
          dbName: undefined,
          schema: undefined,
        },
      );
    } finally {
      vi.unstubAllEnvs();
    }
  },
  30000,
);

it("ignores the ambient schema when a connection target is explicit", async () => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://postgres:secret@127.0.0.1:5432/unused?schema=unexpected",
  );
  try {
    await verifyAuthBootstrap({ enabled: true }, false, "public", {
      schema: undefined,
    });
  } finally {
    vi.unstubAllEnvs();
  }
}, 30000);
