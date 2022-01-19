import { FindConditions, FindManyOptions } from "typeorm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SearchOptions<T = any>
  extends Pick<
    FindManyOptions<T>,
    "where" | "order" | "skip" | "take" | "relations"
  > {
  where?: FindConditions<T> | FindConditions<T>[];
}
