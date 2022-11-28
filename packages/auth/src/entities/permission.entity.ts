import { Property, Entity } from "@mikro-orm/core";

@Entity()
export class Permission {
  @Property()
  name!: string;
}
