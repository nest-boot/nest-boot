/* eslint-disable @typescript-eslint/ban-types */
import {
  BeforeInsert,
  Column as BaseColumn,
  ColumnOptions as BaseColumnOptions,
} from "typeorm";

export interface ColumnOptions extends BaseColumnOptions {
  generator?: (target: Object) => unknown;
}

export function Column(options?: ColumnOptions): PropertyDecorator {
  return (target: Object, propertyKey: string): void => {
    BaseColumn(options)(target, propertyKey);

    if (options?.generator) {
      const methodKey = Symbol(`__GENERATOR__${propertyKey}__`);

      Object.defineProperty(target.constructor.prototype, methodKey, {
        value() {
          if (this[propertyKey] === undefined) {
            this[propertyKey] = options.generator(this);
          }
        },
      });

      BeforeInsert()(target, methodKey);
    }
  };
}
