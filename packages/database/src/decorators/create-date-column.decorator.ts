import {
  ColumnOptions,
  CreateDateColumn as BaseCreateDateColumn,
} from "typeorm";

export function CreateDateColumn(options?: ColumnOptions): PropertyDecorator {
  return BaseCreateDateColumn({
    precision: 3,
    ...(options || {}),
  });
}
