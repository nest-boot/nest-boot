import { type PageInfo } from "../objects";
import { type EdgeInterface } from "./edge.interface";

export interface ConnectionInterface<T> {
  edges: EdgeInterface<T>[];

  pageInfo: PageInfo;

  totalCount: number;
}
