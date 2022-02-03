/* eslint-disable @typescript-eslint/no-namespace */

import {
  AfterInsert,
  AfterLoad,
  AfterRemove,
  AfterUpdate,
  BeforeInsert,
  BeforeRemove,
  BeforeUpdate,
  Brackets,
  ColumnType,
  Connection,
  DeepPartial,
  EntitySubscriberInterface,
  Equal,
  EventSubscriber,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  FindOperator,
  getConnection,
  getMetadataArgsStorage,
  getRepository,
  In,
  Index,
  InsertEvent,
  IsNull,
  JoinColumn,
  JoinTable,
  LessThan,
  LessThanOrEqual,
  LoadEvent,
  ManyToMany,
  ManyToOne,
  MigrationInterface,
  MoreThan,
  MoreThanOrEqual,
  Not,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  QueryRunner,
  RelationId,
  RemoveEvent,
  Repository,
  UpdateEvent,
} from "typeorm";

declare global {
  namespace NestBootCommon {
    interface Context {
      transactionQueryRunner?: QueryRunner;
    }
  }
}

export * from "./decorators";
export * from "./entities";
export * from "./entity.data-loader";
export * from "./interceptors";
export * from "./interfaces";
export * from "./modules";
export * from "./services";
export * from "./utils";

export {
  AfterInsert,
  AfterLoad,
  AfterRemove,
  AfterUpdate,
  BeforeInsert,
  BeforeRemove,
  BeforeUpdate,
  Brackets,
  ColumnType,
  Connection,
  DeepPartial,
  EntitySubscriberInterface,
  Equal,
  EventSubscriber,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  FindOperator,
  getConnection,
  getMetadataArgsStorage,
  getRepository,
  In,
  Index,
  InsertEvent,
  IsNull,
  JoinColumn,
  JoinTable,
  LessThan,
  LessThanOrEqual,
  LoadEvent,
  ManyToMany,
  ManyToOne,
  MigrationInterface,
  MoreThan,
  MoreThanOrEqual,
  Not,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  QueryRunner,
  RelationId,
  RemoveEvent,
  Repository,
  UpdateEvent,
};
