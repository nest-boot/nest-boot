import { BaseEntity, Column, Entity } from "@nest-boot/database";

@Entity()
export class Permission extends BaseEntity {
  @Column()
  name: string;
}
