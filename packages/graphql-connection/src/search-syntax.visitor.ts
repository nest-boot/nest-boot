import { EntityManager, type FilterQuery } from "@mikro-orm/core";
import compact from "lodash/compact";
import intersection from "lodash/intersection";
import setWith from "lodash/setWith";

import {
  type AndQueryCstChildren,
  type AtomicQueryCstChildren,
  type EqualFieldTermCstChildren,
  type FieldCstChildren,
  type GlobalTermCstChildren,
  type ICstNodeVisitor,
  type NotQueryCstChildren,
  type OrQueryCstChildren,
  type OtherFieldTermCstChildren,
  type QueryCstChildren,
  type SubQueryCstChildren,
  type TermCstChildren,
  type ValueCstChildren,
} from "./cst";
import { ComparatorOperator } from "./enums";
import { UnknownFieldError } from "./errors";
import { type ReplacementArgs } from "./interfaces";
import { SearchSyntaxFieldOptions } from "./interfaces/search-syntax-field-options.interface";
import { searchSyntaxParser } from "./search-syntax.parser";

function filterEmpty(values: any[]): any[] {
  return values.filter((value) => value !== null);
}

const BaseCstVisitor = searchSyntaxParser.getBaseCstVisitorConstructor();

export class SearchSyntaxVisitor<Entity extends object>
  extends BaseCstVisitor
  implements ICstNodeVisitor<any, any>
{
  constructor(
    private readonly entityManager: EntityManager,
    private readonly fieldOptionsMap: Map<
      string,
      SearchSyntaxFieldOptions<Entity, any, any>
    >,
  ) {
    super();
    this.validateVisitor();
  }

  private get searchableFieldOptions(): SearchSyntaxFieldOptions<
    Entity,
    any,
    any
  >[] {
    return [...this.fieldOptionsMap.values()].filter((item) => item.searchable);
  }

  private buildComparatorOperators(
    args: Omit<ReplacementArgs<any>, "entityManager"> & {
      replacement?:
        | string
        | ((args: ReplacementArgs<any>) => FilterQuery<Entity>);
    },
  ): FilterQuery<Entity> {
    let field = args.field;
    const { replacement, operator, value } = args;

    if (typeof replacement !== "undefined") {
      if (typeof replacement === "function") {
        return replacement({ ...args, entityManager: this.entityManager });
      } else {
        field = replacement;
      }
    }

    if (operator === ComparatorOperator.EQ) {
      return setWith({}, field, value);
    }

    return setWith({}, field, { [operator]: value });
  }

  query(ctx: QueryCstChildren): FilterQuery<Entity> {
    return this.visit(ctx.orQuery);
  }

  orQuery(ctx: OrQueryCstChildren): FilterQuery<Entity> | undefined {
    const result: FilterQuery<Entity>[] = filterEmpty(
      ctx.andQuery.map((item) => this.visit(item)),
    );

    if (result.length > 1) {
      return { $or: result } as unknown as FilterQuery<Entity>;
    } else if (result.length === 1) {
      return result[0];
    }
  }

  andQuery(ctx: AndQueryCstChildren): FilterQuery<Entity> | undefined {
    const result = filterEmpty(ctx.atomicQuery.map((item) => this.visit(item)));

    if (result.length > 1) {
      return { $and: result } as unknown as FilterQuery<Entity>;
    } else if (result.length === 1) {
      return result[0];
    }
  }

  atomicQuery(ctx: AtomicQueryCstChildren): FilterQuery<Entity> | null {
    if (typeof ctx.subQuery !== "undefined") {
      return this.visit(ctx.subQuery);
    }

    if (typeof ctx.notQuery !== "undefined") {
      return this.visit(ctx.notQuery);
    }

    if (typeof ctx.term !== "undefined") {
      return this.visit(ctx.term);
    }

    return null;
  }

  subQuery(ctx: SubQueryCstChildren): FilterQuery<Entity> {
    return this.visit(ctx.query);
  }

  notQuery(ctx: NotQueryCstChildren): FilterQuery<Entity> {
    if (ctx.Not != null) {
      const subQuery = this.visit(ctx.atomicQuery);

      return {
        $not:
          typeof subQuery === "object" &&
          intersection(Object.keys(subQuery), ["$and", "$or", "$not"]).length >
            0
            ? subQuery
            : { $and: [subQuery] },
      } as unknown as FilterQuery<Entity>;
    }

    return this.visit(ctx.atomicQuery);
  }

  term(ctx: TermCstChildren): FilterQuery<Entity> | undefined {
    if (typeof ctx.equalFieldTerm !== "undefined") {
      return this.visit(ctx.equalFieldTerm);
    }

    if (typeof ctx.otherFieldTerm !== "undefined") {
      return this.visit(ctx.otherFieldTerm);
    }

    if (typeof ctx.globalTerm !== "undefined") {
      return this.visit(ctx.globalTerm);
    }
  }

  globalTerm(ctx: GlobalTermCstChildren): FilterQuery<Entity> | undefined {
    if (this.searchableFieldOptions.length > 0) {
      const filters = compact(
        this.searchableFieldOptions.map(
          ({
            field,
            replacement,
            array,
            type,
            fulltext,
          }): FilterQuery<Entity> | undefined => {
            const value = this.visit(ctx.value, type) as never;

            if (typeof value !== "undefined") {
              if (array === true) {
                return this.buildComparatorOperators({
                  type,
                  field,
                  replacement,
                  operator: ComparatorOperator.CONTAINS,
                  value: [value],
                });
              }

              if (fulltext === true) {
                return this.buildComparatorOperators({
                  type,
                  field,
                  replacement,
                  operator: ComparatorOperator.FULLTEXT,
                  value,
                });
              }

              return this.buildComparatorOperators({
                type,
                field,
                replacement,
                operator: ComparatorOperator.EQ,
                value,
              });
            }

            return undefined;
          },
        ),
      );

      if (filters.length === 0) {
        return;
      }

      return { $or: filters } as unknown as FilterQuery<Entity>;
    }
  }

  equalFieldTerm(
    children: EqualFieldTermCstChildren,
  ): FilterQuery<Entity> | undefined {
    const field = this.visit(children.field);
    const fieldOptions = this.fieldOptionsMap.get(field);

    if (typeof fieldOptions === "undefined") {
      throw new UnknownFieldError(field);
    }

    if (fieldOptions.filterable === false) {
      return;
    }

    const values = children.value.map((item) =>
      this.visit(item, fieldOptions.type),
    );

    if (values.length === 0) {
      return;
    }

    if (fieldOptions?.array === true) {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.CONTAINS,
        value: values,
      });
    }

    if (values.length > 1) {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.IN,
        value: values,
      });
    }

    const value = values[0];

    if (typeof value === "string" && value.length > 1) {
      if (value.startsWith("*")) {
        return this.buildComparatorOperators({
          type: fieldOptions.type,
          field: fieldOptions.field,
          replacement: fieldOptions.replacement,
          operator: ComparatorOperator.LIKE,
          value: `%${value.slice(1)}`,
        });
      }

      if (value.endsWith("*")) {
        return this.buildComparatorOperators({
          type: fieldOptions.type,
          field: fieldOptions.field,
          replacement: fieldOptions.replacement,
          operator: ComparatorOperator.LIKE,
          value: `${value.slice(0, -1)}%`,
        });
      }
    }

    if (fieldOptions?.fulltext === true) {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.FULLTEXT,
        value,
      });
    }

    return this.buildComparatorOperators({
      type: fieldOptions.type,
      field: fieldOptions.field,
      replacement: fieldOptions.replacement,
      operator: ComparatorOperator.EQ,
      value,
    });
  }

  otherFieldTerm(
    children: OtherFieldTermCstChildren,
  ): FilterQuery<Entity> | undefined {
    const field = this.visit(children.field);
    const fieldOptions = this.fieldOptionsMap.get(field);

    if (typeof fieldOptions === "undefined") {
      throw new UnknownFieldError(field);
    }

    if (fieldOptions.filterable === false) {
      return;
    }

    const value = this.visit(children.value, fieldOptions.type);

    if (typeof value === "undefined") {
      return;
    }

    if (typeof children.LessThan !== "undefined") {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.LT,
        value,
      });
    }

    if (typeof children.LessThanOrEqual !== "undefined") {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.LTE,
        value,
      });
    }

    if (typeof children.GreaterThan !== "undefined") {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.GT,
        value,
      });
    }

    if (typeof children.GreaterThanOrEqual !== "undefined") {
      return this.buildComparatorOperators({
        type: fieldOptions.type,
        field: fieldOptions.field,
        replacement: fieldOptions.replacement,
        operator: ComparatorOperator.GTE,
        value,
      });
    }
  }

  field(ctx: FieldCstChildren): string {
    return ctx.Field[0].image;
  }

  value(
    children: ValueCstChildren,
    type?: SearchSyntaxFieldOptions<Entity>["type"],
  ): any {
    const item = children.Value[0];

    if (typeof item === "undefined") {
      return;
    }

    if (item?.tokenType?.name === "Null") {
      return null;
    }

    if (typeof type !== "undefined") {
      try {
        switch (type) {
          case "string":
            return item.tokenType.name === "QuotedString"
              ? item.image.slice(1, -1)
              : item.image;
          case "number":
            return Number(item.image);
          case "bigint":
            return BigInt(item.image);
          case "boolean":
            return item.image === "true";
          case "date": {
            const date = new Date(item.image);
            return isNaN(date.getTime()) ? undefined : date;
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        return;
      }
    }

    switch (item.tokenType.name) {
      case "True":
        return true;
      case "False":
        return false;
      case "Number":
        // eslint-disable-next-line no-case-declarations
        const value = Number(item.image);

        return Number.isNaN(value) ||
          value > Number.MAX_SAFE_INTEGER ||
          value < Number.MIN_SAFE_INTEGER
          ? BigInt(item.image)
          : value;
      case "Date":
        return new Date(item.image);
      case "QuotedString":
        return item.image.slice(1, -1);
      default:
        return item.image;
    }
  }
}
