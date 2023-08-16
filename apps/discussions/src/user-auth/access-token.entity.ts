import { Entity, PrimaryKey, Property, t } from "@mikro-orm/core";
import { type AccessTokenInterface } from "@nest-boot/auth";
import { ObjectType } from "@nestjs/graphql";
import { randomUUID } from "crypto";

@ObjectType()
@Entity()
export class AccessToken implements AccessTokenInterface {
  constructor(
    data: Pick<
      AccessToken,
      | "id"
      | "name"
      | "token"
      | "entityId"
      | "entityName"
      | "lastUsedAt"
      | "expiresAt"
    > &
      Partial<Pick<AccessToken, "createdAt" | "updatedAt">>,
  ) {
    this.id = data.id;
    this.name = data.name;
    this.token = data.token;
    this.entityId = data.entityId;
    this.entityName = data.entityName;
    this.lastUsedAt = data.lastUsedAt;
    this.expiresAt = data.expiresAt;

    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
  }

  @PrimaryKey({
    type: t.uuid,
    defaultRaw: "gen_random_uuid()",
    onCreate: () => randomUUID(),
  })
  id: string;

  @Property()
  name: string;

  @Property({ unique: true })
  token: string;

  @Property()
  entityId: string;

  @Property()
  entityName: string;

  @Property()
  lastUsedAt: Date;

  @Property()
  expiresAt: Date;

  @Property({ defaultRaw: "now()" })
  createdAt: Date = new Date();

  @Property({ defaultRaw: "now()", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
