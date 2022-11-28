import crypto from "crypto";
import { PrimaryKey, Property, Entity } from "@mikro-orm/core";

@Entity()
export class PersonalAccessToken {
  @PrimaryKey({
    type: "uuid",
    onCreate: () => crypto.randomBytes(32).toString("hex"),
  })
  token!: string;

  @Property()
  entity!: string;

  @Property()
  entityId!: string;
}
