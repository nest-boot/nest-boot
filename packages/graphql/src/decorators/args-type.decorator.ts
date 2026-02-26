import { ClassType } from "@nestjs/graphql/dist/enums/class-type.enum";
import { LazyMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage";
import { TypeMetadataStorage } from "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage";
import { addClassTypeMetadata } from "@nestjs/graphql/dist/utils/add-class-type-metadata.util";

/**
 * Decorator that marks a class as a resolver arguments type.
 *
 * @param name - The name of the arguments type.
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
    addClassTypeMetadata(target, ClassType.ARGS);
  };
}
