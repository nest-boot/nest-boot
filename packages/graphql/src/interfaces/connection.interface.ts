import { PageInfo } from "../dtos";
import { EdgeInterface } from "./edge.interface";

export interface ConnectionInterface<T> {
  edges: Array<EdgeInterface<T>>;

  pageInfo: PageInfo;

  totalCount?: number;
}
