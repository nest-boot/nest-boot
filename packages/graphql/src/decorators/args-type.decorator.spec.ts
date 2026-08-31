describe("ArgsType", () => {
  it("should register args metadata lazily and eagerly", async () => {
    const store = vi.fn((callback: () => void) => {
      callback();
    });
    const addArgsMetadata = vi.fn();
    const addClassTypeMetadata = vi.fn();

    vi.resetModules();
    vi.doMock(
      "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage",
      () => ({
        LazyMetadataStorage: {
          store,
        },
      }),
    );
    vi.doMock(
      "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage",
      () => ({
        TypeMetadataStorage: {
          addArgsMetadata,
        },
      }),
    );
    vi.doMock(
      "@nestjs/graphql/dist/utils/add-class-type-metadata.util",
      () => ({
        addClassTypeMetadata,
      }),
    );

    const { ArgsType } = await import("./args-type.decorator.js");
    class SearchArgs {}

    ArgsType("NamedSearchArgs")(SearchArgs);

    expect(store).toHaveBeenCalledWith(expect.any(Function));
    expect(addArgsMetadata).toHaveBeenCalledTimes(2);
    expect(addArgsMetadata).toHaveBeenCalledWith({
      name: "NamedSearchArgs",
      target: SearchArgs,
    });
    expect(addClassTypeMetadata).toHaveBeenCalledWith(
      SearchArgs,
      expect.any(String),
    );
  });

  it("should default args metadata name to the target class name", async () => {
    const addArgsMetadata = vi.fn();

    vi.resetModules();
    vi.doMock(
      "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage",
      () => ({
        LazyMetadataStorage: {
          store: vi.fn(),
        },
      }),
    );
    vi.doMock(
      "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage",
      () => ({
        TypeMetadataStorage: {
          addArgsMetadata,
        },
      }),
    );
    vi.doMock(
      "@nestjs/graphql/dist/utils/add-class-type-metadata.util",
      () => ({
        addClassTypeMetadata: vi.fn(),
      }),
    );

    const { ArgsType } = await import("./args-type.decorator.js");
    class DefaultNameArgs {}

    ArgsType()(DefaultNameArgs);

    expect(addArgsMetadata).toHaveBeenCalledWith({
      name: "DefaultNameArgs",
      target: DefaultNameArgs,
    });
  });
});
