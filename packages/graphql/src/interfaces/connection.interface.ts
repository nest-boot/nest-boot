import { type PageInfo } from "../dtos";
import { type EdgeInterface } from "./edge.interface";

export interface ConnectionInterface<
  T extends { id: string | number | bigint },
> {
  edges: EdgeInterface<T>[];

  pageInfo: PageInfo;

  totalCount: number;
}
