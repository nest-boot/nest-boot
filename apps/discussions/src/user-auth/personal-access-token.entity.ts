import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { AccessTokenInterface } from "@nest-boot/auth";
import { ObjectType } from "@nestjs/graphql";
import { randomUUID } from "crypto";

@ObjectType()
@Entity()
export class AccessToken implements AccessTokenInterface {
  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "uuid_generate_v4()",
    onCreate: () => randomUUID(),
  })
  id!: string;

  @Property()
  name!: string;

  @Property({ unique: true })
  token!: string;

  @Property()
  entityId!: string;

  @Property()
  entityName!: string;

  @Property()
  lastUsedAt?: Date;

  @Property()
  expiresAt?: Date;

  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
