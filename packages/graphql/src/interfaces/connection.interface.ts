import { PageInfo } from "../dtos";
import { EdgeInterface } from "./edge.interface";

export interface ConnectionInterface<T> {
  edges: Array<EdgeInterface<T>>;

  nodes: T[];

  pageInfo: PageInfo;

  totalCount?: number;
}
