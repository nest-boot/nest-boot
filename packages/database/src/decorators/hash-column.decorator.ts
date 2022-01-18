/* eslint-disable @typescript-eslint/ban-types */

import { hash } from "@nest-boot/common";
import { AfterLoad, BeforeInsert, BeforeUpdate } from "typeorm";

import { Column, ColumnOptions } from "./column.decorator";

export function HashColumn(options?: ColumnOptions): PropertyDecorator {
  return (target: Object, propertyKey: string): void => {
    let temp = null;

    const afterLoadMethodKey = Symbol(
      `__ENCRYPTED_AFTER_LOAD_${propertyKey}__`
    );

    const beforeInsertOrUpdateMethodKey = Symbol(
      `__ENCRYPTED_BEFORE_INSERT_OR_UPDATE_${propertyKey}__`
    );

    Object.defineProperty(target.constructor.prototype, afterLoadMethodKey, {
      value() {
        temp = this[propertyKey];
      },
    });

    Object.defineProperty(
      target.constructor.prototype,
      beforeInsertOrUpdateMethodKey,
      {
        async value() {
          if (temp !== this[propertyKey]) {
            this[propertyKey] = await hash.create(this[propertyKey]);
            this[afterLoadMethodKey]();
          }
        },
      }
    );

    Column(options)(target, propertyKey);
    AfterLoad()(target, afterLoadMethodKey);
    BeforeInsert()(target, beforeInsertOrUpdateMethodKey);
    BeforeUpdate()(target, beforeInsertOrUpdateMethodKey);
  };
}
