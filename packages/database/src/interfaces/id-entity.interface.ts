import { AnyEntity } from "@mikro-orm/core";

export type IdEntity<T extends { id?: number | string | bigint } = any> =
  AnyEntity<T>;
