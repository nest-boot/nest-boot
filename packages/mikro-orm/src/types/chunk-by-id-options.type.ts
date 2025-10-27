import type { FindOptions, PopulatePath } from "@mikro-orm/core";

export type ChunkByIdOptions<
  Entity,
  Hint extends string = never,
  Fields extends string = PopulatePath.ALL,
  Excludes extends string = never,
> = Omit<FindOptions<Entity, Hint, Fields, Excludes>, "offset" | "orderBy">;
