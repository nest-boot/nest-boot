import { Property, Entity } from "@mikro-orm/core";
import crypto from "crypto";

@Entity()
export class PersonalAccessToken {
  @Property({
    length: 64,
    unique: true,
    onCreate: () => crypto.randomBytes(32).toString("hex"),
  })
  token: string;

  @Property()
  entity: string;

  @Property()
  entityId: string;
}
