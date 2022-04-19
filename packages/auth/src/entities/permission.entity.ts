import { Property, Entity } from "@nest-boot/database";

@Entity()
export class Permission {
  @Property()
  name: string;
}
