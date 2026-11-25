import path from "node:path";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./graphql-field-config-from-types.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
        defaultProject: "tsconfig.json",
      },
      tsconfigRootDir: path.resolve(import.meta.dirname, "../.."),
    },
  },
});

ruleTester.run("graphql-field-config-from-types", rule, {
  valid: [
    /* typescript */ `
      @ObjectType()
      class User {
        static readonly complexity = 4;

        @Field(() => String)
        name!: string;
      }
    `,
    // Correct string type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        name!: string;
      }
    `,
    // Correct number type (Float)
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Float)
        score!: number;
      }
    `,
    // Correct number type (Int)
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Int)
        age!: number;
      }
    `,
    // Correct boolean type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Boolean)
        isActive!: boolean;
      }
    `,
    // Correct nullable configuration
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String, { nullable: true })
        name?: string;
      }
    `,
    // Correct array type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => [String])
        tags!: string[];
      }
    `,
    // ID type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => ID)
        id!: string;
      }
    `,
    // Custom type
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => Profile)
        profile!: Profile;
      }
    `,
    // Property with @HideField decorator does not need @Field
    /* typescript */ `
      @ObjectType()
      class User {
        @HideField()
        password!: string;
      }
    `,
    // Configured decorators can be ignored
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Internal()
          @Field(() => String)
          token!: string;
        }
      `,
      options: [
        {
          decorators: {
            Internal: "ignore" as const,
          },
        },
      ],
    },
    // Non-GraphQL model class is not checked
    /* typescript */ `
      class NotAGraphQLModel {
        field: string;
      }
    `,
    // Complex config object (with spread operator and conditional expression)
    /* typescript */ `
      @ObjectType()
      class Connection {
        @Field(() => String, {
          nullable: true,
          ...(filterableFields.length > 0
            ? {
                description: \`Apply filters.\`,
              }
            : {}),
        })
        query?: string;
      }
    `,
    // Methods are ignored
    /* typescript */ `
      @ObjectType()
      class User {
        method() {
          return "value";
        }
      }
    `,
    // Properties with no usable type information are skipped
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        settings = {};
      }
    `,
    // Computed property names fall back to normal type inference
    /* typescript */ `
      @ObjectType()
      class User {
        @Field(() => String)
        ["name"]!: string;
      }
    `,
    // Dynamic enum map (Record<string, string>) matches string and string[]
    /* typescript */ `
      const UserRole: Record<string, string> = { ADMIN: "admin", USER: "user" };
      @ObjectType()
      class User {
        @Field(() => [UserRole])
        roles!: string[];
      }
    `,
    // TypeScript enum matches an identical string literal union type alias
    /* typescript */ `
      enum Status {
        ACTIVE = "ACTIVE",
        DISABLED = "DISABLED",
      }
      type StatusValue = "ACTIVE" | "DISABLED";
      @ObjectType()
      class Member {
        @Field(() => Status)
        status!: StatusValue;
      }
    `,
    // Const enum object literal matches an identical string literal union
    /* typescript */ `
      const Status = {
        ACTIVE: "ACTIVE",
        DISABLED: "DISABLED",
      } as const;
      type StatusValue = "ACTIVE" | "DISABLED";
      @ObjectType()
      class Member {
        @Field(() => Status)
        status!: StatusValue;
      }
    `,
    // Runtime constructor (Type<T>) and EntityClass<T> match interface / generic property types
    /* typescript */ `
      interface Type<T = unknown> extends Function {
        new (...args: unknown[]): T;
      }
      type EntityClass<T = unknown> = Function & { prototype: T };
      interface EdgeInterface<T> {
        node: T;
      }
      function createConnection<Entity extends object>(
        entityClass: EntityClass<Entity>,
        EdgeClass: Type<EdgeInterface<Entity>>,
      ) {
        @ObjectType()
        class Edge {
          @Field(() => entityClass)
          node!: Entity;
        }
        @ObjectType()
        class Connection {
          @Field(() => [EdgeClass])
          edges!: EdgeInterface<Entity>[];
        }
        return { Edge, Connection };
      }
    `,
    // Custom GraphQLScalarType<TInternal> matches TInternal
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      interface FilterQuery<T> {
        field?: keyof T;
      }
      function createArgs<Entity extends object>(
        FilterScalar: GraphQLScalarType<FilterQuery<Entity>>,
      ) {
        @ArgsType()
        class Args {
          @Field(() => FilterScalar, { nullable: true })
          filter?: FilterQuery<Entity> | null;
        }
        return Args;
      }
    `,
    // Generic mapped enum record matches its mapped value type
    /* typescript */ `
      type OrderFieldValue<T> = Extract<keyof T, string>;
      type OrderFieldType<T> = Record<string & keyof T, OrderFieldValue<T>>;
      function createOrder<Entity extends object>(
        OrderField: OrderFieldType<Entity>,
      ) {
        @InputType()
        class Order {
          @Field(() => OrderField as object)
          field!: OrderFieldValue<Entity>;
        }
        return Order;
      }
    `,
    // Custom scalar handling an entire array value without list brackets
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      declare const StringArrayScalar: GraphQLScalarType<string[]>;
      @ObjectType()
      class Thing {
        @Field(() => StringArrayScalar)
        values!: string[];
      }
    `,
    // Nullability inside a type alias is preserved when matching a custom scalar
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      declare const CustomTextScalar: GraphQLScalarType<string>;
      type MaybeText = string | null;
      @ObjectType()
      class Note {
        @Field(() => CustomTextScalar, { nullable: true })
        text!: MaybeText;
      }
    `,
    // Custom GraphQLScalarType still matches ID-named fields
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      declare const UuidScalar: GraphQLScalarType<string>;
      @ObjectType()
      class Account {
        @Field(() => UuidScalar)
        userId!: string;
      }
    `,
    // Readonly arrays, scalar subclasses, aliased enums, and generic Record<K, V> maps match
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      class SubScalar extends GraphQLScalarType<string, string> {}
      declare const MySubScalar: SubScalar;
      enum Status {
        ACTIVE = "ACTIVE",
        DISABLED = "DISABLED",
      }
      const StatusRef = Status;
      type UnionRole = "admin" | "user";
      declare const UnionRoleMap: Record<string, UnionRole>;
      function createGeneric<K extends string>(GenericMap: Record<K, string>) {
        @ObjectType()
        class Item {
          @Field(() => [String])
          tags!: readonly string[];

          @Field(() => MySubScalar)
          code!: string;

          @Field(() => StatusRef)
          status!: Status;

          @Field(() => UnionRoleMap)
          role!: UnionRole;

          @Field(() => GenericMap)
          dynamicVal!: string;
        }
        return Item;
      }
    `,
    // Unconstrained generics, recursive array scalars, intersection scalars, array aliases, and nullable: "items" / "itemsAndList"
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      interface Type<T = unknown> extends Function {
        new (...args: unknown[]): T;
      }
      type Tree = Tree[];
      type TreeB = TreeB[];
      declare const TreeScalar: GraphQLScalarType<Tree>;
      declare const IntersectedStringScalar: GraphQLScalarType<string> & {
        readonly tag: "custom";
      };
      enum Role {
        ADMIN = "ADMIN",
        USER = "USER",
      }
      type ReadonlyTags = readonly string[];
      type ReadonlyFlags = readonly boolean[];
      type ReadonlyScores = readonly number[];
      type ReadonlyLiterals = readonly ("x" | "y")[];
      type ReadonlyRecords = readonly Record<string, unknown>[];
      type ReadonlyRoles = readonly Role[];
      type MaybeText = string | null;
      type NullableItemsAlias = readonly (string | null)[];
      function createGenericBox<T>(ItemClass: Type<T>) {
        @ObjectType()
        class Box {
          @Field(() => ItemClass)
          item!: T;

          @Field(() => ItemClass, { nullable: true })
          maybeItem!: T | null;

          @Field(() => ItemClass)
          unionParam!: T | string extends never ? never : T;

          @Field(() => TreeScalar)
          tree!: TreeB;

          @Field(() => IntersectedStringScalar, { nullable: false })
          label!: string;

          @Field(() => [ID])
          parentId!: ReadonlyTags;

          @Field(() => [String])
          tags!: ReadonlyLiterals;

          @Field(() => [Boolean])
          flags!: ReadonlyFlags;

          @Field(() => [Float])
          scores!: ReadonlyScores;

          @Field(() => [GraphQLJSONObject])
          records!: ReadonlyRecords;

          @Field(() => [Role])
          roles!: ReadonlyRoles;

          @Field(() => [String], { nullable: "items" })
          inlineNullableItems!: (string | null)[];

          @Field(() => [IntersectedStringScalar], { nullable: "items" })
          scalarNullableItems!: MaybeText[];

          @Field(() => [String], { nullable: "itemsAndList" })
          bothNullable!: NullableItemsAlias | null;
        }
        return Box;
      }
    `,
    // Nullable array aliases with whole-value scalars, primitive/Record/Date aliases, inline literals, and structural scalar matching
    /* typescript */ `
      class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
        readonly _internal?: TInternal;
        readonly _external?: TExternal;
      }
      enum Status {
        ACTIVE = "ACTIVE",
        DISABLED = "DISABLED",
      }
      enum Priority {
        LOW = 0,
        HIGH = 1,
      }
      type NullableTags = string[] | null;
      type Tags = string[];
      type UserName = string;
      type Score = number;
      type Flag = boolean;
      type Payload = Record<string, unknown>;
      type Timestamp = Date;
      type OAuthProvider = "google" | "github";
      type SortBit = 0 | 1;
      type MaybeText = string | null;
      type JsonMapA = { [key: string]: unknown };
      type JsonMapB = { [key: string]: unknown };
      interface RecursiveNodeA {
        label: string;
        next?: RecursiveNodeA;
      }
      interface RecursiveNodeB {
        label: string;
        next?: RecursiveNodeB;
      }
      declare const NullableTagsScalar: GraphQLScalarType<string[] | null>;
      declare const JsonMapScalar: GraphQLScalarType<JsonMapA>;
      declare const RecursiveNodeScalar: GraphQLScalarType<RecursiveNodeA>;
      declare const PriorityPayloadScalar: GraphQLScalarType<{
        priority: Priority;
      }>;
      @ObjectType()
      class ExtendedTypeCoverage {
        @Field(() => NullableTagsScalar, { nullable: true })
        aliasedNullableArray!: NullableTags;

        @Field(() => NullableTagsScalar, { nullable: true })
        unionNullableArray!: Tags | null;

        @Field(() => String)
        userName!: UserName;

        @Field(() => Int)
        score!: Score;

        @Field(() => Boolean)
        flag!: Flag;

        @Field(() => GraphQLJSONObject)
        payload!: Payload;

        @Field(() => Date)
        createdAt!: Timestamp;

        @Field(() => String)
        provider!: OAuthProvider;

        @Field(() => Int)
        bit!: SortBit;

        @Field(() => [String], { nullable: "items" })
        maybeTexts!: MaybeText[];

        @Field(() => [String])
        aliasedElemTags!: UserName[];

        @Field(() => [GraphQLJSONObject])
        aliasedRecordItems!: Payload[];

        @Field(() => Status)
        inlineEnumUnion!: "ACTIVE" | "DISABLED";

        @Field(() => [Status])
        inlineEnumArray!: ("ACTIVE" | "DISABLED")[];

        @Field(() => String)
        templateLit!: \`v\${number}\`;

        @Field(() => Float)
        negativeLit!: -1;

        @Field(() => Boolean)
        boolLit!: true;

        @Field(() => PriorityPayloadScalar)
        inlinePayload!: { priority: Priority };

        @Field(() => GraphQLJSONObject)
        inlineIndexMap!: { [key: string]: unknown };

        @Field(() => JsonMapScalar)
        unknownIndex!: JsonMapB;

        @Field(() => RecursiveNodeScalar)
        recursiveNode!: RecursiveNodeB;
      }
    `,
  ],
  invalid: [
    // @Field type mismatch
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => Int)
          name!: string;
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class User {
          @Field(() => String)
          name!: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // nullable configuration mismatch
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String)
          name?: string;
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class User {
          @Field(() => String, { nullable: true })
          name?: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Should not have nullable but it is set
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String, { nullable: true })
          name!: string;
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class User {
          @Field(() => String)
          name!: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Array type mismatch
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String)
          tags!: string[];
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class User {
          @Field(() => [String])
          tags!: string[];
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Missing type function but has other config options (should be preserved)
    {
      code: /* typescript */ `
        @ObjectType()
        class PageInfo {
          @Field({
            complexity: 0,
            description: "Whether there are any pages prior to the current page.",
          })
          hasPreviousPage!: boolean;
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class PageInfo {
          @Field(() => Boolean, { complexity: 0, description: "Whether there are any pages prior to the current page." })
          hasPreviousPage!: boolean;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // nullable config should preserve other options
    {
      code: /* typescript */ `
        @ObjectType()
        class User {
          @Field(() => String, { description: "User name" })
          name?: string;
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class User {
          @Field(() => String, { nullable: true, description: "User name" })
          name?: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Complex config object (with spread operator) missing type function
    {
      code: /* typescript */ `
        @ObjectType()
        class Connection {
          @Field({
            nullable: true,
            ...(filterableFields.length > 0
              ? {
                  description: \`Apply filters.\`,
                }
              : {}),
          })
          query?: string;
        }
      `,
      output: /* typescript */ `
        import { Field } from "@nestjs/graphql";
        @ObjectType()
        class Connection {
          @Field(() => String, { nullable: true, ...(filterableFields.length > 0
              ? {
                  description: \`Apply filters.\`,
                }
              : {}) })
          query?: string;
        }
      `,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Missing @Field decorator should infer scalar type from the property type
    {
      code: /* typescript */ `@ObjectType()
class User {
  name!: string;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => String)
  name!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Missing @Field decorator should add required ID import
    {
      code: /* typescript */ `@ObjectType()
class User {
  id!: string;
}`,
      output: /* typescript */ `import { Field, ID } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => ID)
  id!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Existing scalar imports should be reused
    {
      code: /* typescript */ `import { ID } from "@nestjs/graphql";
@ObjectType()
class User {
  ownerID!: string;
}`,
      output: /* typescript */ `import { ID, Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => ID)
  ownerID!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Record types should use GraphQLJSONObject and add its import
    {
      code: /* typescript */ `@ObjectType()
class User {
  @Field(() => String)
  metadata!: Record<string, unknown>;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
import { GraphQLJSONObject } from "graphql-type-json";
@ObjectType()
class User {
  @Field(() => GraphQLJSONObject)
  metadata!: Record<string, unknown>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Existing GraphQLJSONObject imports should be reused
    {
      code: /* typescript */ `import { GraphQLJSONObject } from "graphql-type-json";
@ObjectType()
class User {
  metadata!: Record<string, unknown>;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
import { GraphQLJSONObject } from "graphql-type-json";
@ObjectType()
class User {
  @Field(() => GraphQLJSONObject)
  metadata!: Record<string, unknown>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Ref<T | null> should unwrap the type and mark the field nullable
    {
      code: /* typescript */ `@ObjectType()
class User {
  friend!: Ref<User | null>;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => User, { nullable: true })
  friend!: Ref<User | null>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Ref<T | undefined> should also mark the field nullable
    {
      code: /* typescript */ `@ObjectType()
class User {
  friend!: Ref<User | undefined>;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => User, { nullable: true })
  friend!: Ref<User | undefined>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Union types without nullish members use the first concrete type
    {
      code: /* typescript */ `@ObjectType()
class User {
  value!: string | number;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => String)
  value!: string | number;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Undefined unions should be nullable
    {
      code: /* typescript */ `@ObjectType()
class User {
  nickname!: string | undefined;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => String, { nullable: true })
  nickname!: string | undefined;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Array<T> should be emitted as a GraphQL array type
    {
      code: /* typescript */ `@ObjectType()
class User {
  tags!: Array<string>;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => [String])
  tags!: Array<string>;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Bare Array references should still be handled as identifier types
    {
      code: /* typescript */ `@ObjectType()
class User {
  values!: Array;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => Array)
  values!: Array;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Literal initializers should be used when no type annotation exists
    {
      code: /* typescript */ `@ObjectType()
class User {
  published = true;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => Boolean)
  published = true;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Number literal initializers should infer Float
    {
      code: /* typescript */ `import { Float } from "@nestjs/graphql";
@ObjectType()
class User {
  score = 1;
}`,
      output: /* typescript */ `import { Float, Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => Float)
  score = 1;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // String literal initializers should infer String
    {
      code: /* typescript */ `@ObjectType()
class User {
  title = "hello";
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
@ObjectType()
class User {
  @Field(() => String)
  title = "hello";
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Relation decorators configured for removal should remove @Field
    {
      code: /* typescript */ `@ObjectType()
class User {
  @HideField()
  @Field(() => String)
  password!: string;
}`,
      output: /* typescript */ `@ObjectType()
class User {
  @HideField()
  password!: string;
}`,
      errors: [{ messageId: "removeFieldDecorator" }],
    },
    // Nullability mismatch preserves valid dynamic enum expression
    {
      code: /* typescript */ `const UserRole: Record<string, string> = {};
@ObjectType()
class User {
  @Field(() => [UserRole])
  roles?: string[];
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
const UserRole: Record<string, string> = {};
@ObjectType()
class User {
  @Field(() => [UserRole], { nullable: true })
  roles?: string[];
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Enum whose literal values do not match the union type must report without emitting an uncompilable type-alias value
    {
      code: /* typescript */ `enum Status {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}
type PartialStatus = "ACTIVE";
@ObjectType()
class Member {
  @Field(() => Status)
  status!: PartialStatus;
}`,
      output: null,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Mapped enum record for a different type parameter must not match
    {
      code: /* typescript */ `type OrderFieldValue<T> = Extract<keyof T, string>;
type OrderFieldType<T> = Record<string & keyof T, OrderFieldValue<T>>;
function createOrder<A extends object, B extends object>(
  OrderField: OrderFieldType<A>,
) {
  @InputType()
  class Order {
    @Field(() => OrderField as object)
    field!: OrderFieldValue<B>;
  }
  return Order;
}`,
      output: null,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Whole-array custom scalar preserves non-list callback when fixing nullability
    {
      code: /* typescript */ `class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare const StringArrayScalar: GraphQLScalarType<string[]>;
@ObjectType()
class Thing {
  @Field(() => StringArrayScalar)
  values?: string[];
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare const StringArrayScalar: GraphQLScalarType<string[]>;
@ObjectType()
class Thing {
  @Field(() => StringArrayScalar, { nullable: true })
  values?: string[];
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Numeric enum map does not match string property
    {
      code: /* typescript */ `const NumericMap: Record<string, number> = {};
@ObjectType()
class Thing {
  @Field(() => NumericMap)
  label!: string;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
const NumericMap: Record<string, number> = {};
@ObjectType()
class Thing {
  @Field(() => String)
  label!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Distinct empty classes must not be conflated structurally
    {
      code: /* typescript */ `class First {}
class Second {}
@ObjectType()
class Holder {
  @Field(() => Second)
  first!: First;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
class First {}
class Second {}
@ObjectType()
class Holder {
  @Field(() => First)
  first!: First;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Built-in Number constructor is still rejected in favor of Float/Int
    {
      code: /* typescript */ `@ObjectType()
class Metrics {
  @Field(() => Number)
  score!: number;
}`,
      output: /* typescript */ `import { Field, Float } from "@nestjs/graphql";
@ObjectType()
class Metrics {
  @Field(() => Float)
  score!: number;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Finite numeric TypeScript enum must not match unconstrained number
    {
      code: /* typescript */ `enum Priority {
  LOW = 0,
  HIGH = 1,
}
@ObjectType()
class Task {
  @Field(() => Priority)
  priority!: number;
}`,
      output: /* typescript */ `import { Field, Float } from "@nestjs/graphql";
enum Priority {
  LOW = 0,
  HIGH = 1,
}
@ObjectType()
class Task {
  @Field(() => Float)
  priority!: number;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Custom scalar wrapping a numeric enum must not match unconstrained number
    {
      code: /* typescript */ `class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
enum Priority {
  LOW = 0,
  HIGH = 1,
}
declare const PriorityScalar: GraphQLScalarType<Priority>;
@ObjectType()
class Task {
  @Field(() => PriorityScalar)
  score!: number;
}`,
      output: /* typescript */ `import { Field, Float } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
enum Priority {
  LOW = 0,
  HIGH = 1,
}
declare const PriorityScalar: GraphQLScalarType<Priority>;
@ObjectType()
class Task {
  @Field(() => Float)
  score!: number;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Inline object literal inside @Field callback is rejected (no stable enum identity)
    {
      code: /* typescript */ `type State = "ready";
@ObjectType()
class Job {
  @Field(() => ({ READY: "ready" } as const))
  state!: State;
}`,
      output: null,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Record<string, string> enum map must not override ID mapping on *Id fields
    {
      code: /* typescript */ `const Roles: Record<string, string> = { ADMIN: "admin" };
@ObjectType()
class Membership {
  @Field(() => Roles)
  userId!: string;
}`,
      output: /* typescript */ `import { Field, ID } from "@nestjs/graphql";
const Roles: Record<string, string> = { ADMIN: "admin" };
@ObjectType()
class Membership {
  @Field(() => ID)
  userId!: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Alias-declared nullability should require { nullable: true } on matched scalar
    {
      code: /* typescript */ `class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare const CustomTextScalar: GraphQLScalarType<string>;
type MaybeText = string | null;
@ObjectType()
class Note {
  @Field(() => CustomTextScalar)
  text!: MaybeText;
}`,
      output: /* typescript */ `import { Field } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare const CustomTextScalar: GraphQLScalarType<string>;
type MaybeText = string | null;
@ObjectType()
class Note {
  @Field(() => CustomTextScalar, { nullable: true })
  text!: MaybeText;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Missing @Field on a type-only interface reports without invalid runtime autofix
    {
      code: /* typescript */ `interface ProfileDto {
  bio: string;
}
@ObjectType()
class Account {
  profile!: ProfileDto;
}`,
      output: null,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Non-enum values (Date, primitive, empty object, non-literal object, computed enum, wrong literal set) are rejected
    {
      code: /* typescript */ `import { Field, Float, ObjectType } from "@nestjs/graphql";
declare function compute(): number;
enum ComputedEnum {
  A = compute(),
}
const BuiltinDate = new Date();
const PrimitiveVal = 42;
const EmptyObj = {};
const PlainArray = ["a"];
const NonLiteralObj = { A: "a" };
const DisjointEnum = { OTHER: "other" } as const;
const SomeFn = (() => undefined) as (() => void) & { tag: string };
type ExpectedState = "ready";
type WideUnion = "ready" | number;
@ObjectType()
class BadEnums {
  @Field(() => ComputedEnum)
  computed!: ExpectedState;

  @Field(() => BuiltinDate)
  dateVal!: string;

  @Field(() => PrimitiveVal)
  primVal!: string;

  @Field(() => EmptyObj)
  emptyVal!: string;

  @Field(() => PlainArray)
  arrayVal!: string;

  @Field(() => SomeFn)
  fnVal!: string;

  @Field(() => NonLiteralObj)
  nonLitVal!: ExpectedState;

  @Field(() => DisjointEnum)
  disjointVal!: ExpectedState;

  @Field(() => DisjointEnum)
  wideVal!: WideUnion;

  @Field(() => String)
  wrongBuiltin!: number;

  @Field(() => UnresolvedRef)
  unknownVal!: string;
}`,
      output: /* typescript */ `import { Field, Float, ObjectType } from "@nestjs/graphql";
declare function compute(): number;
enum ComputedEnum {
  A = compute(),
}
const BuiltinDate = new Date();
const PrimitiveVal = 42;
const EmptyObj = {};
const PlainArray = ["a"];
const NonLiteralObj = { A: "a" };
const DisjointEnum = { OTHER: "other" } as const;
const SomeFn = (() => undefined) as (() => void) & { tag: string };
type ExpectedState = "ready";
type WideUnion = "ready" | number;
@ObjectType()
class BadEnums {
  @Field(() => ComputedEnum)
  computed!: ExpectedState;

  @Field(() => String)
  dateVal!: string;

  @Field(() => String)
  primVal!: string;

  @Field(() => String)
  emptyVal!: string;

  @Field(() => String)
  arrayVal!: string;

  @Field(() => String)
  fnVal!: string;

  @Field(() => NonLiteralObj)
  nonLitVal!: ExpectedState;

  @Field(() => DisjointEnum)
  disjointVal!: ExpectedState;

  @Field(() => DisjointEnum)
  wideVal!: WideUnion;

  @Field(() => Float)
  wrongBuiltin!: number;

  @Field(() => String)
  unknownVal!: string;
}`,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    // Ambient built-in Object constructor and cross-enum numeric member unions are rejected
    {
      code: /* typescript */ `import { Field, Float, ObjectType } from "@nestjs/graphql";
import { GraphQLJSONObject } from "graphql-type-json";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
enum Alpha {
  X = 0,
}
enum Beta {
  Y = 1,
}
type CrossEnum = Alpha.X | Beta.Y;
declare const CrossScalar: GraphQLScalarType<CrossEnum>;
declare const AlphaArrayScalar: GraphQLScalarType<Alpha[]>;
@ObjectType()
class BuiltinAndCrossEnum {
  @Field(() => Object)
  payload!: Record<string, unknown>;

  @Field(() => CrossScalar)
  rank!: number;

  @Field(() => AlphaArrayScalar)
  ranks!: number[];
}`,
      output: /* typescript */ `import { Field, Float, ObjectType } from "@nestjs/graphql";
import { GraphQLJSONObject } from "graphql-type-json";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
enum Alpha {
  X = 0,
}
enum Beta {
  Y = 1,
}
type CrossEnum = Alpha.X | Beta.Y;
declare const CrossScalar: GraphQLScalarType<CrossEnum>;
declare const AlphaArrayScalar: GraphQLScalarType<Alpha[]>;
@ObjectType()
class BuiltinAndCrossEnum {
  @Field(() => GraphQLJSONObject)
  payload!: Record<string, unknown>;

  @Field(() => Float)
  rank!: number;

  @Field(() => [Float])
  ranks!: number[];
}`,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    // Nullable list items must require and autofix { nullable: "items" } / { nullable: "itemsAndList" }
    {
      code: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare const CustomStringScalar: GraphQLScalarType<string>;
type MaybeText = string | null;
type ReadonlyTags = readonly string[];
@ObjectType()
class ListItemNullability {
  @Field(() => [CustomStringScalar])
  values!: MaybeText[];

  @Field(() => [String])
  optionalItems?: (string | null)[];

  aliasedTags!: ReadonlyTags;
}`,
      output: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare const CustomStringScalar: GraphQLScalarType<string>;
type MaybeText = string | null;
type ReadonlyTags = readonly string[];
@ObjectType()
class ListItemNullability {
  @Field(() => [CustomStringScalar], { nullable: "items" })
  values!: MaybeText[];

  @Field(() => [String], { nullable: "itemsAndList" })
  optionalItems?: (string | null)[];

  @Field(() => [String])
  aliasedTags!: ReadonlyTags;
}`,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    // Numeric enum inside tuple/set/record scalars and invalid nullable options are rejected
    {
      code: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
import { Opt, Ref } from "@mikro-orm/core";
import { GraphQLJSONObject } from "graphql-type-json";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
class User {}
enum Priority {
  LOW = 0,
  HIGH = 1,
}
declare const PriorityRecordScalar: GraphQLScalarType<Record<string, Priority>>;
declare const PriorityTupleScalar: GraphQLScalarType<[Priority, string]>;
declare const PrioritySetScalar: GraphQLScalarType<Set<Priority>>;
type TupleAlias = [number, string];
type SetAlias = Set<number>;
@ObjectType()
class TupleAndRecordCheck {
  @Field(() => PriorityRecordScalar)
  scores!: Record<string, number>;

  @Field(() => PriorityTupleScalar)
  pair!: TupleAlias;

  @Field(() => PrioritySetScalar)
  setVal!: SetAlias;

  @Field(() => String, { nullable: "bogus" as never })
  badNullable!: string;

  @Field(() => User)
  nestedOptRef!: Opt<Ref<User> | null>;
}`,
      output: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
import { Opt, Ref } from "@mikro-orm/core";
import { GraphQLJSONObject } from "graphql-type-json";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
class User {}
enum Priority {
  LOW = 0,
  HIGH = 1,
}
declare const PriorityRecordScalar: GraphQLScalarType<Record<string, Priority>>;
declare const PriorityTupleScalar: GraphQLScalarType<[Priority, string]>;
declare const PrioritySetScalar: GraphQLScalarType<Set<Priority>>;
type TupleAlias = [number, string];
type SetAlias = Set<number>;
@ObjectType()
class TupleAndRecordCheck {
  @Field(() => GraphQLJSONObject)
  scores!: Record<string, number>;

  @Field(() => PriorityTupleScalar)
  pair!: TupleAlias;

  @Field(() => PrioritySetScalar)
  setVal!: SetAlias;

  @Field(() => String)
  badNullable!: string;

  @Field(() => User, { nullable: true })
  nestedOptRef!: Opt<Ref<User> | null>;
}`,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    // Parenthesized sequence expression in semantic callback preserves grouping when fixing nullability
    {
      code: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare function trackUse(): void;
declare const CustomStringScalar: GraphQLScalarType<string>;
@ObjectType()
class GroupedCallback {
  @Field(() => (trackUse(), CustomStringScalar))
  text?: string;
}`,
      output: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
declare function trackUse(): void;
declare const CustomStringScalar: GraphQLScalarType<string>;
@ObjectType()
class GroupedCallback {
  @Field(() => (trackUse(), CustomStringScalar), { nullable: true })
  text?: string;
}`,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Non-matching mapped record aliases (non-primitive value, non-Record alias, mismatched alias target) are rejected
    {
      code: /* typescript */ `type NonPrimitiveMap<T> = Record<string & keyof T, { nested: T }>;
type OtherMapped<T> = { [K in keyof T]: string };
type AlphaValue<T> = Extract<keyof T, string>;
type BetaValue<T> = Extract<keyof T, string>;
type AlphaMap<T> = Record<string & keyof T, AlphaValue<T>>;
function createBad<T extends object>(
  bad1: NonPrimitiveMap<T>,
  bad2: OtherMapped<T>,
  bad3: AlphaMap<T>,
) {
  @InputType()
  class Bad {
    @Field(() => bad1 as object)
    f1!: AlphaValue<T>;

    @Field(() => bad2 as object)
    f2!: AlphaValue<T>;

    @Field(() => bad3 as object)
    f3!: BetaValue<T>;
  }
  return Bad;
}`,
      output: null,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    // Aliased/member built-in constructors and nested object/union/index/intersection numeric enum mismatches are rejected
    {
      code: /* typescript */ `import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { GraphQLJSONObject } from "graphql-type-json";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
enum Priority {
  LOW = 0,
  HIGH = 1,
}
const NativeObject = Object;
const NativeNumber = Number;
type OAuthProvider = "google" | "github";
type SortBit = 0 | 1;
type UserName = string;
interface BaseMeta {
  tag: string;
}
declare const PriorityObjScalar: GraphQLScalarType<{ priority: Priority }>;
declare const OptionalPriorityObjScalar: GraphQLScalarType<{
  priority?: Priority;
}>;
declare const UnionPriorityScalar: GraphQLScalarType<string | Priority>;
declare const UnionObjPriorityScalar: GraphQLScalarType<
  string | { priority: Priority }
>;
declare const NumIndexPriorityScalar: GraphQLScalarType<{
  [index: number]: Priority;
}>;
declare const IntersectedPriorityScalar: GraphQLScalarType<
  BaseMeta & { priority: Priority }
>;
@ObjectType()
class DeepTypeMismatches {
  @Field(() => globalThis.Object)
  globalObj!: Record<string, unknown>;

  @Field(() => NativeObject)
  aliasedObj!: Record<string, unknown>;

  @Field(() => NativeNumber)
  aliasedNum!: number;

  @Field(() => String)
  provider?: OAuthProvider;

  @Field(() => Int)
  bit?: SortBit;

  missingAlias!: UserName;

  inlineIndexMissing!: { [key: string]: unknown };

  @Field(() => PriorityObjScalar)
  badInlineObj!: { priority: number };

  @Field(() => OptionalPriorityObjScalar)
  badOptionalPropObj!: { priority?: number };

  @Field(() => UnionPriorityScalar)
  badUnion!: string | number;

  @Field(() => UnionObjPriorityScalar)
  badUnionObj!: string | { priority: number };

  @Field(() => NumIndexPriorityScalar)
  badNumIndex!: { [index: number]: number };

  @Field(() => IntersectedPriorityScalar)
  badIntersection!: BaseMeta & { priority: number };
}`,
      output: /* typescript */ `import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { GraphQLJSONObject } from "graphql-type-json";
class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  readonly _internal?: TInternal;
  readonly _external?: TExternal;
}
enum Priority {
  LOW = 0,
  HIGH = 1,
}
const NativeObject = Object;
const NativeNumber = Number;
type OAuthProvider = "google" | "github";
type SortBit = 0 | 1;
type UserName = string;
interface BaseMeta {
  tag: string;
}
declare const PriorityObjScalar: GraphQLScalarType<{ priority: Priority }>;
declare const OptionalPriorityObjScalar: GraphQLScalarType<{
  priority?: Priority;
}>;
declare const UnionPriorityScalar: GraphQLScalarType<string | Priority>;
declare const UnionObjPriorityScalar: GraphQLScalarType<
  string | { priority: Priority }
>;
declare const NumIndexPriorityScalar: GraphQLScalarType<{
  [index: number]: Priority;
}>;
declare const IntersectedPriorityScalar: GraphQLScalarType<
  BaseMeta & { priority: Priority }
>;
@ObjectType()
class DeepTypeMismatches {
  @Field(() => GraphQLJSONObject)
  globalObj!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject)
  aliasedObj!: Record<string, unknown>;

  @Field(() => Float)
  aliasedNum!: number;

  @Field(() => String, { nullable: true })
  provider?: OAuthProvider;

  @Field(() => Int, { nullable: true })
  bit?: SortBit;

  @Field(() => String)
  missingAlias!: UserName;

  @Field(() => GraphQLJSONObject)
  inlineIndexMissing!: { [key: string]: unknown };

  @Field(() => PriorityObjScalar)
  badInlineObj!: { priority: number };

  @Field(() => OptionalPriorityObjScalar)
  badOptionalPropObj!: { priority?: number };

  @Field(() => String)
  badUnion!: string | number;

  @Field(() => String)
  badUnionObj!: string | { priority: number };

  @Field(() => NumIndexPriorityScalar)
  badNumIndex!: { [index: number]: number };

  @Field(() => IntersectedPriorityScalar)
  badIntersection!: BaseMeta & { priority: number };
}`,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    {
      code: /* typescript */ `import { type Field as GqlField, type Int as GqlInt, ObjectType } from "@nest-boot/graphql";
@ObjectType()
class Metrics {
  @GqlField(() => GqlInt)
  count!: number;

  score!: number;
}`,
      output: [
        /* typescript */ `import { Field as GqlField, Int as GqlInt, ObjectType } from "@nest-boot/graphql";
@ObjectType()
class Metrics {
  @GqlField(() => GqlInt)
  count!: number;

  score!: number;
}`,
        /* typescript */ `import { Field as GqlField, Int as GqlInt, ObjectType, Float } from "@nest-boot/graphql";
@ObjectType()
class Metrics {
  @GqlField(() => GqlInt)
  count!: number;

  @GqlField(() => Float)
  score!: number;
}`,
      ],
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
    // Preserves non-object options expressions (e.g. middleware) by reporting without autofix
    {
      code: /* typescript */ `import { Field, ObjectType, type FieldOptions } from "@nestjs/graphql";
declare const protectedOptions: FieldOptions;
@ObjectType()
class ProtectedModel {
  @Field(() => [String], protectedOptions)
  secrets!: (string | null)[];
}`,
      output: null,
      errors: [{ messageId: "alignFieldDecoratorWithTsType" }],
    },
    // Skips nonpublic properties, preserves nested list depth, detects union-member nullability, and places nullable after spreads
    {
      code: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
type Matrix = string[][];
type MaybeText = "b" | null;
const shared = { description: "shared" };
@ObjectType()
class GraphqlEdgeCases {
  private credentials!: { [key: string]: string };
  protected internalFlag!: boolean;

  @Field(() => [[String]])
  validMatrix!: Matrix;

  @Field(() => [Array])
  brokenMatrix!: Matrix;

  @Field(() => [String])
  unionItems!: ("a" | MaybeText)[];

  @Field(() => String)
  unionOuter!: "a" | MaybeText;

  @Field(() => [String], { ...shared })
  spreadItems!: (string | null)[];
}`,
      output: /* typescript */ `import { Field, ObjectType } from "@nestjs/graphql";
type Matrix = string[][];
type MaybeText = "b" | null;
const shared = { description: "shared" };
@ObjectType()
class GraphqlEdgeCases {
  private credentials!: { [key: string]: string };
  protected internalFlag!: boolean;

  @Field(() => [[String]])
  validMatrix!: Matrix;

  @Field(() => [[String]])
  brokenMatrix!: Matrix;

  @Field(() => [String], { nullable: "items" })
  unionItems!: ("a" | MaybeText)[];

  @Field(() => String, { nullable: true })
  unionOuter!: "a" | MaybeText;

  @Field(() => [String], { ...shared, nullable: "items" })
  spreadItems!: (string | null)[];
}`,
      errors: [
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
        { messageId: "alignFieldDecoratorWithTsType" },
      ],
    },
  ],
});
