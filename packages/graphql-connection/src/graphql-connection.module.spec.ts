import { GraphQLConnectionModule } from "./graphql-connection.module.js";

describe("GraphQLConnectionModule", () => {
  it("registers module options with forRoot", () => {
    const module = GraphQLConnectionModule.forRoot();

    expect(module.module).toBe(GraphQLConnectionModule);
    expect(module.providers).toEqual([
      expect.objectContaining({
        useValue: {},
      }),
    ]);
  });

  it("registers async options with forRootAsync", () => {
    const module = GraphQLConnectionModule.forRootAsync({
      useFactory: () => ({}),
    });

    expect(module.module).toBe(GraphQLConnectionModule);
    expect(module.imports).toEqual([]);
  });
});
