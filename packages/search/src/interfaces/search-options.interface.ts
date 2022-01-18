import { FindConditions, FindManyOptions } from "typeorm";

export interface SearchOptions<T = any>
  extends Pick<
    FindManyOptions<T>,
    "where" | "order" | "skip" | "take" | "relations"
  > {
  where?: FindConditions<T> | FindConditions<T>[];
}
