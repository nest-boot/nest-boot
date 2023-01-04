import { PageInfo } from "../dtos";
import { EdgeInterface } from "./edge.interface";

export interface ConnectionInterface<
  T extends { id: string | number | bigint }
> {
  edges: Array<EdgeInterface<T>>;

  nodes: T[];

  pageInfo: PageInfo;

  totalCount?: number;
}
