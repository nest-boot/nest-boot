import { BaseEntity, Column, Entity } from "@nest-boot/database";

@Entity({ searchable: true })
export class Blog extends BaseEntity {
  @Column()
  name: string;
}
