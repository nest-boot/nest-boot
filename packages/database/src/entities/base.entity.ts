import {
  CreateDateColumn,
  PrimarySnowflakeColumn,
  UpdateDateColumn,
} from "../decorators";

export class BaseEntity {
  @PrimarySnowflakeColumn()
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
