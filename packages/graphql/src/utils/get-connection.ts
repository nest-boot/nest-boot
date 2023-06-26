import {
  type EntityManager,
  type FilterQuery,
  QueryOrder,
  type QueryOrderMap,
  Reference,
} from "@mikro-orm/core";
import { type SearchableEntityService } from "@nest-boot/search";
import _ from "lodash";

import { OrderDirection, PagingType } from "../enums";
import {
  type ConnectionArgsInterface,
  type ConnectionInterface,
  type EdgeInterface,
} from "../interfaces";
import { Cursor } from "./cursor";
import { getPagingType } from "./get-paging-type";

function get(object: any, path: string): any {
  const keys = path.split(".");
  let value = object;

  // eslint-disable-next-line no-unreachable-loop
  for (const key of keys) {
    if (value[key] instanceof Reference) {
      value = value[key].getEntity();
    } else if (_.isObject(value) && key in value) {
      value = (value as any)[key];
    } else {
      break;
    }
  }

  return value;
}

export async function getConnection<
  E extends { id: number | string | bigint },
  EM extends EntityManager
>(
  service: SearchableEntityService<E, EM>,
  args: ConnectionArgsInterface<any>,
  where?: FilterQuery<E>
): Promise<ConnectionInterface<E>> {
  // 提取集合参数
  const {
    first,
    last,
    after,
    before,
    query = "",
    orderBy = { field: "createdAt", direction: OrderDirection.ASC },
  } = args;
  const limit = first != null ? first : last != null ? last : 0;

  const cursor =
    after != null
      ? new Cursor(after)
      : before != null
      ? new Cursor(before)
      : undefined;

  const pagingType = getPagingType(args);

  const idWhere = (
    typeof cursor?.id !== "undefined"
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        {
          id: {
            [pagingType === PagingType.FORWARD ? "$gt" : "$lt"]: cursor.id,
          },
        }
      : undefined
  ) as FilterQuery<E> | undefined;

  const cursorWhere = (
    typeof orderBy !== "undefined" && typeof cursor?.value !== "undefined"
      ? {
          $or: [
            _.set(
              {},
              orderBy.field,
              (
                pagingType === PagingType.FORWARD
                  ? orderBy.direction === OrderDirection.ASC
                  : orderBy.direction === OrderDirection.DESC
              )
                ? { $gt: cursor.value }
                : { $lt: cursor.value }
            ),
            typeof idWhere !== "undefined"
              ? {
                  $and: [
                    _.set({}, orderBy.field, { $eq: cursor.value }),
                    idWhere,
                  ],
                }
              : _.set({}, orderBy.field, { $eq: cursor.value }),
          ],
        }
      : idWhere
  ) as FilterQuery<E> | undefined;

  // 搜索结果
  const [[results], [, totalCount]] = await Promise.all([
    service.search(query, {
      where: (typeof cursorWhere !== "undefined"
        ? { $and: [where, cursorWhere] }
        : where) as FilterQuery<E> | undefined,
      populate: [orderBy.field as never],
      limit: limit + 1,
      orderBy: [
        _.set(
          {},
          orderBy.field,
          (
            pagingType === PagingType.FORWARD
              ? orderBy.direction === OrderDirection.ASC
              : orderBy.direction === OrderDirection.DESC
          )
            ? QueryOrder.ASC
            : QueryOrder.DESC
        ),
        {
          id: (
            pagingType === PagingType.FORWARD
              ? orderBy.direction === OrderDirection.ASC
              : orderBy.direction === OrderDirection.DESC
          )
            ? QueryOrder.ASC
            : QueryOrder.DESC,
        },
      ] as Array<QueryOrderMap<E>>,
    }),
    service.search(query, {
      where,
      limit: 0,
    }),
  ]);

  // 重新排序结果
  const entities =
    pagingType === PagingType.FORWARD ? results : results.reverse();

  // 根据结果生成 edges
  const edges = (
    entities.length > limit
      ? pagingType === PagingType.FORWARD
        ? entities.slice(0, -1)
        : entities.slice(1)
      : entities
  ).map<EdgeInterface<E>>((node: E) => ({
    node,
    cursor: new Cursor({
      id: node.id,
      value:
        typeof orderBy !== "undefined" ? get(node, orderBy.field) : undefined,
    }).toString(),
  }));

  // 返回集合
  return {
    totalCount,
    pageInfo: {
      ...(pagingType === PagingType.FORWARD
        ? {
            hasNextPage: entities.length > limit,
            hasPreviousPage: after != null,
          }
        : {
            hasNextPage: before != null,
            hasPreviousPage: entities.length > limit,
          }),
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
    },
    edges,
    nodes: edges.map((edge: any) => edge.node),
  };
}
