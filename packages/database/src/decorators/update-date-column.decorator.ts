import {
  ColumnOptions,
  UpdateDateColumn as BaseUpdateDateColumn,
} from "typeorm";

export function UpdateDateColumn(options?: ColumnOptions): PropertyDecorator {
  return BaseUpdateDateColumn({
    precision: 3,
    ...(options || {}),
  });
}
