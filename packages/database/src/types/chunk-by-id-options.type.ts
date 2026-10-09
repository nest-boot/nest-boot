import type { FindOptions, PopulatePath } from "@mikro-orm/core";

/** Options for {@link EntityService.chunkById}, excluding offset and orderBy (managed internally). */
export type ChunkByIdOptions<
  Entity,
  Hint extends string = never,
  Fields extends string = PopulatePath.ALL,
  Excludes extends string = never,
> = Omit<FindOptions<Entity, Hint, Fields, Excludes>, "offset" | "orderBy">;
