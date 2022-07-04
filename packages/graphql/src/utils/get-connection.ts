/* eslint-disable no-nested-ternary */
import {
  AnyEntity,
  FilterQuery,
  QueryOrder,
  QueryOrderMap,
} from "@mikro-orm/core";
import { SearchableEntityService } from "@nest-boot/search";
import _ from "lodash";

import { QueryConnectionArgs } from "../dtos/query-connection.args";
import { OrderDirection } from "../enums/order-direction.enum";
import { PagingType } from "../enums/paging-type.enum";
import { Connection } from "../interfaces/connection.interface";
import { Cursor } from "./cursor";
import { getPagingType } from "./get-paging-type";

async function getCursorConnection<T extends AnyEntity>(
  service: SearchableEntityService<T>,
  args: QueryConnectionArgs,
  where?: FilterQuery<T>
): Promise<Connection<T>> {
  // 提取集合参数
  const {
    after,
    before,
    query,
    orderBy = { field: "createdAt", direction: OrderDirection.ASC },
  } = args;
  const limit = args.first || args.last || 0;
  const cursor = new Cursor(after || before);
  const pagingType = getPagingType(args);

  // 声明搜索参数
  const order: QueryOrderMap<T> = {
    [orderBy.field]: (
      pagingType === PagingType.FORWARD
        ? orderBy.direction === OrderDirection.ASC
        : orderBy.direction === OrderDirection.DESC
    )
      ? QueryOrder.ASC
      : QueryOrder.DESC,
    id: pagingType === PagingType.FORWARD ? QueryOrder.ASC : QueryOrder.DESC,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as QueryOrderMap<T>;

  // 搜索结果
  const [[results], [, totalCount]] = await Promise.all([
    service.search(
      query,
      {
        $and: [
          where,
          ...(orderBy && cursor.value
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
                        {
                          id:
                            pagingType === PagingType.FORWARD
                              ? { $gt: cursor.id }
                              : { $lt: cursor.id },
                        },
                      ],
                    },
                  ],
                },
              ]
            : [
                {
                  id:
                    pagingType === PagingType.FORWARD
                      ? { $gt: cursor.id }
                      : { $lt: cursor.id },
                },
              ]),
        ],
      } as FilterQuery<T>,
      {
        limit: limit + 1,
        orderBy: order,
      }
    ),
    service.search(query, where, { limit: 0 }),
  ]);

  // 重新排序结果
  const entities = _.orderBy(
    results,
    [...(orderBy ? [orderBy.field] : []), "id"],
    [
      ...((orderBy
        ? [orderBy.direction === OrderDirection.ASC ? "asc" : "desc"]
        : []) as ("asc" | "desc")[]),
      "asc",
    ]
  );

  // 根据结果生成 edges
  const edges = (
    entities.length > limit
      ? pagingType === PagingType.FORWARD
        ? entities.slice(0, -1)
        : entities.slice(1)
      : entities
  ).map((node: T) => ({
    node,
    cursor: new Cursor({
      id: node.id,
      value: orderBy ? node[orderBy.field] : undefined,
    }).toString(),
  }));

  // 返回集合
  return {
    totalCount,
    pageInfo: {
      ...(pagingType === PagingType.FORWARD
        ? {
            hasNextPage: entities.length > limit,
            hasPreviousPage: !!after,
          }
        : {
            hasNextPage: !!before,
            hasPreviousPage: entities.length > limit,
          }),
      startCursor: edges[0]?.cursor || null,
      endCursor: edges[edges.length - 1]?.cursor || null,
    },
    edges,
  };
}

async function getOffsetConnection<T extends AnyEntity>(
  service: SearchableEntityService<T>,
  args: QueryConnectionArgs,
  where?: FilterQuery<T>
): Promise<Connection<T>> {
  const {
    page = 1,
    pageSize = 20,
    query,
    orderBy = { field: "createdAt", direction: OrderDirection.ASC },
  } = args;

  // 搜索结果
  const [[entities], [, totalCount]] = await Promise.all([
    service.search(query, where, {
      // where,
      // skip: page * pageSize,
      // take: pageSize,
      // order: { [orderBy.field]: orderBy.direction },
    }),
    service.search(query, where, {
      // where,
      // take: 0,
    }),
  ]);

  // 根据结果生成 edges
  const edges = entities.map((node: T) => ({
    node,
    cursor: new Cursor({
      id: node.id,
      value: orderBy ? node[orderBy.field] : undefined,
    }).toString(),
  }));

  // 返回集合
  return {
    totalCount,
    pageInfo: {
      hasNextPage: totalCount > page * pageSize + entities.length,
      hasPreviousPage: page > 1,
    },
    edges,
  };
}

export async function getConnection<T extends AnyEntity>(
  service: SearchableEntityService<T>,
  args: QueryConnectionArgs,
  where?: FilterQuery<T>
): Promise<Connection<T>> {
  if (args.page) {
    return await getOffsetConnection<T>(service, args, where);
  }

  return await getCursorConnection<T>(service, args, where);
}
