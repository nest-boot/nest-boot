// Exercise the published ESM entry; test:e2e builds it before running.
import { GraphQLModule, Query, Resolver } from "@nest-boot/graphql";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { type GraphQLModuleOptions } from "../../src/graphql-module-options.interface.js";

@Resolver()
class PrefixResolver {
  @Query(() => String)
  prefixTest(): string {
    return "ok";
  }
}

describe("GraphQL global prefix", () => {
  const apps: INestApplication[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it.each([false, true])(
    "follows the global prefix by default with async registration: %s",
    async (async) => {
      const url = await createApp({}, "api", async);
      await expectQuery(`${url}/api/graphql`);
      expect((await fetch(`${url}/graphql`)).status).toBe(404);
      expect((await fetch(`${url}/api/api/graphql`)).status).toBe(404);
    },
  );

  it("uses /graphql by default without an application prefix", async () => {
    const url = await createApp({});
    await expectQuery(`${url}/graphql`);
    expect((await fetch(`${url}/api/graphql`)).status).toBe(404);
  });

  it("allows disabling the global prefix", async () => {
    const url = await createApp({ useGlobalPrefix: false }, "api");
    await expectQuery(`${url}/graphql`);
    expect((await fetch(`${url}/api/graphql`)).status).toBe(404);
  });

  it("supports a nested global prefix", async () => {
    const url = await createApp({}, "v2/nested");
    await expectQuery(`${url}/v2/nested/graphql`);
    expect((await fetch(`${url}/graphql`)).status).toBe(404);
  });

  it("prepends the global prefix to a custom GraphQL path", async () => {
    const url = await createApp({ path: "/custom/query" }, "api");
    await expectQuery(`${url}/api/custom/query`);
    expect((await fetch(`${url}/custom/query`)).status).toBe(404);
  });

  it("allows preserving a fixed path outside the global prefix", async () => {
    const url = await createApp(
      { path: "/api/graphql", useGlobalPrefix: false },
      "v2",
    );
    await expectQuery(`${url}/api/graphql`);
    expect((await fetch(`${url}/v2/api/graphql`)).status).toBe(404);
  });

  /**
   * Starts the real Apollo driver with the selected route options.
   * @param options - GraphQL route options
   * @param prefix - Optional Nest application prefix
   * @param async - Whether to register options asynchronously
   * @returns Listening application URL
   */
  async function createApp(
    options: Partial<GraphQLModuleOptions>,
    prefix?: string,
    async = false,
  ) {
    const config = { ...options, autoSchemaFile: true, graphiql: false };
    const module = await Test.createTestingModule({
      imports: [
        async
          ? GraphQLModule.forRootAsync({
              useFactory: () => Promise.resolve(config),
            })
          : GraphQLModule.forRoot(config),
      ],
      providers: [PrefixResolver],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    const app = module.createNestApplication();
    apps.push(app);
    if (prefix) {
      app.setGlobalPrefix(prefix);
    }
    await app.listen(0, "127.0.0.1");
    return await app.getUrl();
  }

  /**
   * Verifies that Apollo executes a query at the expected path.
   * @param url - GraphQL endpoint URL
   */
  async function expectQuery(url: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ prefixTest }" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { prefixTest: "ok" } });
  }
});
