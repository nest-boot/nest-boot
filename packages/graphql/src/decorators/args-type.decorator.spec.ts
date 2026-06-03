describe("ArgsType", () => {
  it("should register args metadata lazily and eagerly", () => {
    const store = jest.fn((callback: () => void) => {
      callback();
    });
    const addArgsMetadata = jest.fn();
    const addClassTypeMetadata = jest.fn();

    jest.isolateModules(() => {
      jest.doMock(
        "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage",
        () => ({
          LazyMetadataStorage: {
            store,
          },
        }),
      );
      jest.doMock(
        "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage",
        () => ({
          TypeMetadataStorage: {
            addArgsMetadata,
          },
        }),
      );
      jest.doMock(
        "@nestjs/graphql/dist/utils/add-class-type-metadata.util",
        () => ({
          addClassTypeMetadata,
        }),
      );

      const { ArgsType } = jest.requireActual<
        typeof import("./args-type.decorator")
      >("./args-type.decorator");
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
  });

  it("should default args metadata name to the target class name", () => {
    const addArgsMetadata = jest.fn();

    jest.isolateModules(() => {
      jest.doMock(
        "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage",
        () => ({
          LazyMetadataStorage: {
            store: jest.fn(),
          },
        }),
      );
      jest.doMock(
        "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage",
        () => ({
          TypeMetadataStorage: {
            addArgsMetadata,
          },
        }),
      );
      jest.doMock(
        "@nestjs/graphql/dist/utils/add-class-type-metadata.util",
        () => ({
          addClassTypeMetadata: jest.fn(),
        }),
      );

      const { ArgsType } = jest.requireActual<
        typeof import("./args-type.decorator")
      >("./args-type.decorator");
      class DefaultNameArgs {}

      ArgsType()(DefaultNameArgs);

      expect(addArgsMetadata).toHaveBeenCalledWith({
        name: "DefaultNameArgs",
        target: DefaultNameArgs,
      });
    });
  });
});
