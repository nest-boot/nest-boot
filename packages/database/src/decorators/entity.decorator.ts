import {
  Entity as TypeOrmColumn,
  EntityOptions as TypeOrmEntityOptions,
} from "typeorm";

export interface EntityOptions extends TypeOrmEntityOptions {
  searchable?: boolean;
}

export function Entity(options?: EntityOptions): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (target: Function) => {
    TypeOrmColumn(options)(target);
  };
}
