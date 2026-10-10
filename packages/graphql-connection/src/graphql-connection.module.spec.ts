import { GraphQLConnectionModule } from "./graphql-connection.module.js";

describe("GraphQLConnectionModule", () => {
  it("registers module options", () => {
    const module = GraphQLConnectionModule.register({});

    expect(module.module).toBe(GraphQLConnectionModule);
    expect(module.providers).toEqual([
      expect.objectContaining({
        useValue: {},
      }),
    ]);
  });

  it("registers async options", () => {
    const module = GraphQLConnectionModule.registerAsync({
      useFactory: () => ({}),
    });

    expect(module.module).toBe(GraphQLConnectionModule);
    expect(module.imports).toEqual([]);
  });
});
