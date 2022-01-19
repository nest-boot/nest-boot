/* eslint-disable no-nested-ternary */
import {
  BaseEntity,
  FindConditions,
  FindManyOptions,
  LessThan,
  MoreThan,
} from "@nest-boot/database";
import { SearchableEntityService } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";
import _ from "lodash";

import { QueryConnectionArgs } from "../dtos/query-connection.args";
import { OrderDirection } from "../enums/order-direction.enum";
import { PagingType } from "../enums/paging-type.enum";
import { Connection } from "../interfaces/connection.interface";
import { Type } from "../interfaces/type.interface";
import { Cursor } from "./cursor";
import { getPagingType } from "./get-paging-type";

export interface ConnectionEntityService<T extends BaseEntity>
  extends SearchableEntityService<T> {
  getConnection(
    args: QueryConnectionArgs,
    where?: FindConditions<T>
  ): Promise<Connection<T>>;
}

export function mixinConnection<T extends BaseEntity>(
  Base: Type<SearchableEntityService<T>>
): Type<ConnectionEntityService<T>> {
  @Injectable()
  class ConnectionTrait extends Base implements ConnectionEntityService<T> {
    async getConnection(
      args: QueryConnectionArgs,
      where: FindConditions<T> = {}
    ): Promise<Connection<T>> {
      if (args.page) {
        return await this.getCursorConnection(args, where);
      }
      return await this.getOffsetConnection(args, where);
    }

    private async getCursorConnection(
      args: QueryConnectionArgs,
      where: FindConditions<T> = {}
    ): Promise<Connection<T>> {
      // 提取集合参数
      const {
        after,
        before,
        query,
        filter,
        orderBy = { field: "createdAt", direction: OrderDirection.ASC },
      } = args;
      const take = args.first || args.last || 0;
      const cursor = new Cursor(after || before);
      const pagingType = getPagingType(args);

      // 声明搜索参数
      const order: FindManyOptions<T>["order"] = {
        [orderBy.field]: (
          pagingType === PagingType.FORWARD
            ? orderBy.direction === OrderDirection.ASC
            : orderBy.direction === OrderDirection.DESC
        )
          ? "ASC"
          : "DESC",
        id: pagingType === PagingType.FORWARD ? "ASC" : "DESC",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const whereGroup: FindConditions<T>[] = [];
      if (cursor.id) {
        if (orderBy) {
          whereGroup.push(
            {
              ...where,
              [orderBy.field]: cursor.value,
              id:
                pagingType === PagingType.FORWARD
                  ? MoreThan(cursor.id)
                  : LessThan(cursor.id),
            },
            {
              ...where,
              [orderBy.field]: (
                pagingType === PagingType.FORWARD
                  ? orderBy.direction === OrderDirection.ASC
                  : orderBy.direction === OrderDirection.DESC
              )
                ? MoreThan(cursor.value)
                : LessThan(cursor.value),
            }
          );
        } else {
          whereGroup.push({
            ...where,
            id:
              pagingType === PagingType.FORWARD
                ? MoreThan(cursor.id)
                : LessThan(cursor.id),
          });
        }
      }

      // 搜索结果
      const [[results], [, totalCount]] = await Promise.all([
        this.search(query, filter, {
          where: whereGroup.length === 0 ? where : whereGroup,
          take: take + 1,
          order,
        }),
        this.search(query, filter, {
          where,
          take: 0,
        }),
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
        entities.length > take
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
                hasNextPage: entities.length > take,
                hasPreviousPage: !!after,
              }
            : {
                hasNextPage: !!before,
                hasPreviousPage: entities.length > take,
              }),
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        edges,
      };
    }

    private async getOffsetConnection(
      args: QueryConnectionArgs,
      where: FindConditions<T> = {}
    ): Promise<Connection<T>> {
      const {
        page = 1,
        pageSize = 20,
        query,
        filter,
        orderBy = { field: "createdAt", direction: OrderDirection.ASC },
      } = args;

      // 搜索结果
      const [[entities], [, totalCount]] = await Promise.all([
        this.search(query, filter, {
          where,
          skip: page * pageSize,
          take: pageSize,
          order: { [orderBy.field]: orderBy.direction },
        }),
        this.search(query, filter, {
          where,
          take: 0,
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
  }

  return ConnectionTrait;
}
