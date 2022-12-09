import {
  AnyEntity,
  FilterQuery,
  QueryOrder,
  QueryOrderMap,
} from "@mikro-orm/core";
import { IdEntity } from "@nest-boot/database";
import { SearchableEntityService } from "@nest-boot/search";
import _ from "lodash";

import { OrderDirection, PagingType } from "../enums";
import { ConnectionArgsInterface, ConnectionInterface } from "../interfaces";
import { Cursor } from "./cursor";
import { getPagingType } from "./get-paging-type";

async function getCursorConnection<T extends AnyEntity>(
  service: SearchableEntityService<T>,
  args: ConnectionArgsInterface<any, any>,
  where?: FilterQuery<T>
): Promise<ConnectionInterface<T>> {
  // 提取集合参数
  const {
    first,
    last,
    after,
    before,
    query = "",
    orderBy = { field: "createdAt", direction: OrderDirection.ASC },
  } = args;
  const limit =
    typeof first !== "undefined"
      ? first
      : typeof last !== "undefined"
      ? last
      : 0;

  const cursor =
    typeof after !== "undefined"
      ? new Cursor(after)
      : typeof before !== "undefined"
      ? new Cursor(before)
      : undefined;

  const pagingType = getPagingType(args);

  // 声明搜索参数
  const order: QueryOrderMap<any> = {
    [orderBy.field]: (
      pagingType === PagingType.FORWARD
        ? orderBy.direction === OrderDirection.ASC
        : orderBy.direction === OrderDirection.DESC
    )
      ? QueryOrder.ASC
      : QueryOrder.DESC,
    id: pagingType === PagingType.FORWARD ? QueryOrder.ASC : QueryOrder.DESC,
  };

  const idWhere: Array<FilterQuery<any>> =
    typeof cursor?.id !== "undefined"
      ? [
          {
            id: {
              [pagingType === PagingType.FORWARD ? "$gt" : "$lt"]: cursor.id,
            },
          },
        ]
      : [];

  const valueWhere: Array<FilterQuery<any>> =
    typeof orderBy !== "undefined" && typeof cursor?.value !== "undefined"
      ? [
          {
            $or: [
              {
                [orderBy.field]: (
                  pagingType === PagingType.FORWARD
                    ? orderBy.direction === OrderDirection.ASC
                    : orderBy.direction === OrderDirection.DESC
                )
                  ? { $gt: cursor.value }
                  : { $lt: cursor.value },
              },
              {
                $and: [
                  {
                    [orderBy.field]: { $eq: cursor.value },
                  },
                  ...idWhere,
                ],
              },
            ],
          },
        ]
      : idWhere;

  const whereArray: FilterQuery<T> = _.compact([where, ...valueWhere]);

  // 搜索结果
  const [[results], [, totalCount]] = await Promise.all([
    service.search(query, {
      where: whereArray.length > 0 ? whereArray : undefined,
      limit: limit + 1,
      orderBy: order,
    }),
    service.search(query, {
      where: typeof where !== "undefined" ? where : undefined,
      limit: 0,
    }),
  ]);

  // 重新排序结果
  const entities = _.orderBy(
    results,
    [...(typeof orderBy !== "undefined" ? [orderBy.field] : []), "id"],
    [
      ...((typeof orderBy !== "undefined"
        ? [orderBy.direction === OrderDirection.ASC ? "asc" : "desc"]
        : []) as Array<"asc" | "desc">),
      "asc",
    ]
  );

  // // 根据结果生成 edges
  // const edges = (
  //   entities.length > limit
  //     ? pagingType === PagingType.FORWARD
  //       ? entities.slice(0, -1)
  //       : entities.slice(1)
  //     : entities
  // ).map((node: T) => ({
  //   node,
  //   cursor: new Cursor({
  //     id: node.id,
  //     value: typeof orderBy !== "undefined" ? node[orderBy.field] : undefined,
  //   }).toString(),
  // }));

  const edges: string | any[] = [];

  // 返回集合
  return {
    totalCount,
    pageInfo: {
      ...(pagingType === PagingType.FORWARD
        ? {
            hasNextPage: entities.length > limit,
            hasPreviousPage: typeof after !== "undefined",
          }
        : {
            hasNextPage: typeof before !== "undefined",
            hasPreviousPage: entities.length > limit,
          }),
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
    },
    edges,
  };
}

export async function getConnection<T extends IdEntity, P extends keyof T>(
  service: SearchableEntityService<T>,
  args: ConnectionArgsInterface<T, P>,
  where?: FilterQuery<T>
): Promise<ConnectionInterface<T>> {
  return await getCursorConnection<T>(service, args, where);
}
