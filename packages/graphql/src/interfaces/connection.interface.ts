import { PageInfo } from "../dtos";
import { Edge } from "./edge.interface";

export interface Connection<T> {
  edges: Array<Edge<T>>;

  pageInfo: PageInfo;

  totalCount?: number;
}
