import { Type } from "@nestjs/common";
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import _ from "lodash";
import { Connection, getConnection } from "typeorm";

import { buildI18nMessage } from "../../utils";

export interface IsUniqueOptions {
  entity: () => Type<unknown>;
  field?: string;
  connection?: string | Connection;
}

export function IsUnique(
  entity: () => Type<unknown>,
  validationOptions?: ValidationOptions
): PropertyDecorator;

export function IsUnique(
  options: IsUniqueOptions,
  validationOptions?: ValidationOptions
): PropertyDecorator;

export function IsUnique(
  options: (() => Type<unknown>) | IsUniqueOptions,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return (target: unknown, propertyName: string) => {
    registerDecorator({
      name: "isUnique",
      async: true,
      target: target.constructor,
      propertyName,
      constraints: [
        options instanceof Function ? { entity: options } : options,
      ],
      options: validationOptions,
      validator: {
        async validate(value: unknown, args: ValidationArguments) {
          const {
            connection,
            entity,
            field = args.property,
          }: IsUniqueOptions = args.constraints[0];

          const repository = (connection instanceof Connection
            ? connection
            : getConnection(connection)
          ).getRepository(entity());

          return !(await repository.findOne({
            where: _.set({}, field, value),
          }));
        },
        defaultMessage: buildI18nMessage(() => "is-unique"),
      },
    });
  };
}
