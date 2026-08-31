import { LazyMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage.js";
import { TypeMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage.js";
import { addClassTypeMetadata } from "@nestjs/graphql/dist/utils/add-class-type-metadata.util.js";

/**
 * Decorator that marks a class as a resolver arguments type.
 *
 * @param name - Optional GraphQL args type name. Use this for dynamically
 * generated classes or classes whose TypeScript names are not unique.
 *
 * @remarks
 * This extends NestJS' `ArgsType` behavior by allowing an explicit GraphQL
 * metadata name. When omitted, the class name is used, matching NestJS'
 * default behavior.
 *
 * @public
 */
export function ArgsType(name?: string): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return (target: Function) => {
    const metadata = {
      name: name ?? target.name,
      target,
    };
    LazyMetadataStorage.store(() => {
      TypeMetadataStorage.addArgsMetadata(metadata);
    });
    // This function must be called eagerly to allow resolvers
    // accessing the "name" property
    TypeMetadataStorage.addArgsMetadata(metadata);
    addClassTypeMetadata(
      target,
      "args" as Parameters<typeof addClassTypeMetadata>[1],
    );
  };
}
