import { SnowflakeIdGenerator } from "snowflake-id-generator";

import { Column } from "./column.decorator";

export function PrimarySnowflakeColumn(): PropertyDecorator {
  return (target: Record<string, unknown>, propertyKey: string): void => {
    Column({
      type: "bigint",
      primary: true,
      generator: () => SnowflakeIdGenerator.next().toString(),
    })(target, propertyKey);
  };
}
