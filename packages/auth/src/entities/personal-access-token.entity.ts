import { BaseEntity, Column, Entity } from "@nest-boot/database";
import crypto from "crypto";

@Entity()
export class PersonalAccessToken extends BaseEntity {
  @Column({
    length: 64,
    unique: true,
    generator: () => crypto.randomBytes(32).toString("hex"),
  })
  token: string;

  @Column()
  entity: string;

  @Column()
  entityId: string;
}
