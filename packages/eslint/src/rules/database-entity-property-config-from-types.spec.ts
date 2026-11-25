import path from "node:path";

import { RuleTester } from "@typescript-eslint/rule-tester";

import rule from "./database-entity-property-config-from-types.js";

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

ruleTester.run("database-entity-property-config-from-types", rule, {
  valid: [
    `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
import { onFullTextCreate, onFullTextUpdate } from "@nest-boot/database";
@Entity()
class Book {
  @Property({ type: FullTextType, onCreate: onFullTextCreate("search"), onUpdate: onFullTextUpdate("search"), nullable: true })
  search!: string | null;
}`,
    `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const options = { properties: "search" as const, nullable: true };
@Entity() class Book { @SearchableProperty(options) search!: string | null; }`,
    `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
@Entity()
class Book {
  @Property({ type: FullTextType, nullable: true })
  search!: string | null;
}`,
    `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType as SearchType } from "@mikro-orm/pglite";
@Entity()
class Book {
  @Property({ type: new SearchType("simple") })
  search!: string;
}`,
    /* typescript */ `
      import { Entity } from "@mikro-orm/decorators/legacy";
      import { SearchableProperty as Search } from "@nest-boot/database";

      @Entity()
      class Book {
        @Search({ properties: ["title"], nullable: true })
        title!: string | null;
      }
    `,
    /* typescript */ `
      import { Entity } from "@mikro-orm/decorators/legacy";
      import * as database from "@nest-boot/database";

      @Entity()
      class Book {
        @database.SearchableProperty({ properties: "title" })
        title!: string;
      }
    `,
    // Import migration is outside the field configuration rule's scope.
    'import { Entity, Property } from "@mikro-orm/core";',
    'import * as orm from "@mikro-orm/postgresql"; @orm.Entity() class Thing {}',
    'import type { Opt } from "@mikro-orm/knex";',
    'export { Entity as Model, Property } from "@mikro-orm/core";',
    'export * from "@mikro-orm/core";',
    // Correct string type
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.string })
        name!: string;
      }
    `,
    // Correct nullable configuration
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.string, nullable: true })
        name?: string;
      }
    `,
    // Using Opt<T> type with initializer
    /* typescript */ `
      import { Opt } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.boolean })
        isActive: Opt<boolean> = false;
      }
    `,
    // Relation decorators don't need @Property
    /* typescript */ `
      import { Entity, ManyToOne } from "@mikro-orm/decorators/legacy";

      @Entity()
      class Post {
        @ManyToOne()
        author!: User;
      }
    `,
    // PrimaryKey needs type configuration
    /* typescript */ `
      import { t } from "@mikro-orm/core";
      import { Entity, PrimaryKey } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @PrimaryKey({ type: t.integer })
        id!: number;
      }
    `,
    // Enum type uses @Enum
    /* typescript */ `
      import { Entity, Enum } from "@mikro-orm/decorators/legacy";

      enum Role {
        Admin,
        User
      }

      @Entity()
      class User {
        @Enum({ items: () => Role })
        role!: Role;
      }
    `,
    // Array type
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.array })
        tags!: number[];
      }
    `,
    // boolean type
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.boolean })
        isActive!: boolean;
      }
    `,
    // Date type using t.datetime
    /* typescript */ `
      import { Opt } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.datetime, defaultRaw: 'now()' })
        createdAt: Opt<Date> = new Date();
      }
    `,
    // Date type using t.date (valid Date type configuration)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.date })
        birthDate!: Date;
      }
    `,
    // Date type using t.time (valid Date type configuration)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.time })
        workTime!: Date;
      }
    `,
    // Using t.text instead of t.string (valid string type configuration)
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.text })
        description!: string;
      }
    `,
    // Decimal and BigInt string storage are valid string configurations
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: new BigIntType('string') })
        externalId!: string;
      }
    `,
    // Instantiated t.bigint("string") and t.decimal("string") are valid string configurations
    /* typescript */ `
      import { t } from "@mikro-orm/core";
      import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class ApiKey {
        @PrimaryKey({ type: new t.bigint("string"), autoincrement: true })
        id!: string;

        @Property({ type: new t.decimal("string") })
        amount!: string;
      }
    `,
    // Native bigint properties accept t.bigint and BigIntType("bigint")
    /* typescript */ `
      import { BigIntType, t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class EventCursor {
        @Property({ type: new BigIntType("bigint"), default: 0 })
        lastEventMs!: bigint;

        @Property({ type: new t.bigint("bigint") })
        lastEventSeq!: bigint;

        @Property({ type: t.bigint })
        counter!: bigint;
      }
    `,
    // Heterogeneous union type aliases use t.json storage
    /* typescript */ `
      import { t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      type JobProgress = string | boolean | number | object;

      @Entity()
      class Job {
        @Property({ type: t.json, nullable: true })
        progress!: JobProgress | null;
      }
    `,
    // Custom class DTOs may explicitly opt into JSON storage
    /* typescript */ `
      import { t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      class Profile {}

      @Entity()
      class User {
        @Property({ type: t.json })
        profile!: Profile;
      }
    `,
    // Integer width variants and instantiated t.bigint("number") / t.decimal("number") are valid number configurations
    /* typescript */ `
      import { t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class Stats {
        @Property({ type: t.smallint })
        rank!: number;

        @Property({ type: new t.bigint("number") })
        total!: number;

        @Property({ type: new t.decimal("number") })
        ratio!: number;
      }
    `,
    // Constant and dynamic constructor modes are resolved via the type checker or preserved
    /* typescript */ `
      import { BigIntType, DecimalType } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      const STRING_MODE = "string";
      declare const dynamicMode: "string" | "number";

      @Entity()
      class Ledger {
        @Property({ type: new BigIntType(STRING_MODE) })
        externalId!: string;

        @Property({ type: new DecimalType(dynamicMode) })
        amount!: number;
      }
    `,
    // DateType and TimeType hydrate to strings in MikroORM
    /* typescript */ `
      import { DateType, TimeType } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class Schedule {
        @Property({ type: new DateType() })
        day!: string;

        @Property({ type: new TimeType() })
        startTime!: string;
      }
    `,
    // Unions with non-JSON-serializable members and bigint[] are skipped so custom Types are preserved
    /* typescript */ `
      import { ArrayType, Type } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      type MixedValue = string | bigint;
      type BigIntArrayUnion = string | bigint[];
      type DateUnion = boolean | Date;
      class MixedValueType extends Type<MixedValue, string> {}
      class BigIntArrayUnionType extends Type<BigIntArrayUnion, string> {}
      class DateUnionType extends Type<DateUnion, string> {}

      @Entity()
      class Custom {
        @Property({ type: MixedValueType })
        mixed!: MixedValue;

        @Property({ type: BigIntArrayUnionType })
        payload!: BigIntArrayUnion;

        @Property({ type: DateUnionType })
        dated!: DateUnion;

        @Property({ type: new ArrayType(BigInt) })
        ids!: bigint[];
      }
    `,
    // DecimalType honors runtimeType: "number" or reflection metadata when constructor mode is omitted
    /* typescript */ `
      import { DecimalType } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class Invoice {
        @Property({ type: new DecimalType(), runtimeType: "number" })
        amount!: number;

        @Property({ type: new DecimalType() })
        reflectedAmount!: number;

        @Property({ type: new DecimalType(), runtimeType: undefined })
        rawAmount!: string;
      }
    `,
    // String literal array types ("number[]" / "string[]"), inline unions, and object intersections are preserved
    /* typescript */ `
      import { Type, t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      interface BaseMeta {
        tag: string;
      }
      interface ExtraMeta {
        count: number;
      }
      type CombinedMeta = BaseMeta & ExtraMeta;
      class InlineMixedType extends Type<string | bigint, string> {}

      @Entity()
      class ArrayAndIntersectionConfig {
        @Property({ type: "number[]" })
        scores!: readonly number[];

        @Property({ type: "string[]" })
        labels!: readonly string[];

        @Property({ type: t.json, nullable: true })
        inlineUnion!: (string | number) | null;

        @Property({ type: InlineMixedType })
        inlineCustom!: string | bigint;

        @Property({ type: t.json })
        aliasedIntersection!: CombinedMeta;

        @Property({ type: t.json })
        inlineIntersection!: { a: string } & { b: number };
      }
    `,
    // Explicit JSON storage and numeric ArrayType converters are valid for readonly/mutable arrays
    /* typescript */ `
      import { ArrayType, t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class Metrics {
        @Property({ type: t.json })
        samples!: readonly number[];

        @Property({ type: new ArrayType(Number) })
        scores!: number[];
      }
    `,
    // Nullability inside a type alias is preserved on JSON-backed properties
    /* typescript */ `
      import { t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      type NullableProgress = string | number | null;

      @Entity()
      class Job {
        @Property({ type: t.json, nullable: true })
        progress!: NullableProgress;
      }
    `,
    // Resolved type aliases (unions, primitives, recursive JSON objects/tuples, interfaces) infer matching column types
    /* typescript */ `
      import { BooleanType, DateTimeType, ArrayType, t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      type StatusLiteral = "open" | "closed";
      type LevelLiteral = 1 | 2;
      type FlagUnion = true | false;
      type AlwaysTrue = true;
      type BigIntUnion = 1n | 2n;
      type NameAlias = string;
      type ScoreAlias = number;
      type ActiveAlias = boolean;
      type CursorAlias = bigint;
      type JsonValue = string | number | JsonValue[] | { [key: string]: JsonValue };
      type TupleUnion = string | [number, string];
      interface Metadata {
        tag?: string;
        counts: Record<string, number>;
      }
      type MetaOrString = string | Metadata;
      declare function parseUnknown(value: string): unknown;

      @Entity()
      class ResolvedTypes {
        @Property({ type: t.string })
        status!: StatusLiteral;

        @Property({ type: t.integer })
        level!: LevelLiteral;

        @Property({ type: BooleanType })
        flag!: FlagUnion;

        @Property({ type: t.boolean })
        alwaysTrue!: AlwaysTrue;

        @Property({ type: t.bigint })
        bigUnion!: BigIntUnion;

        @Property({ type: t.string })
        name!: NameAlias;

        @Property({ type: t.float })
        score!: ScoreAlias;

        @Property({ type: t.boolean })
        active!: ActiveAlias;

        @Property({ type: t.bigint })
        cursor!: CursorAlias;

        @Property({ type: DateTimeType })
        createdAt!: Date;

        @Property({ type: t.json })
        json!: JsonValue;

        @Property({ type: t.json })
        tuple!: TupleUnion;

        @Property({ type: t.json })
        metadata!: Metadata;

        @Property({ type: t.json })
        metaOrString!: MetaOrString;

        @Property({ type: ArrayType })
        bareArray!: string[];

        @Property({ type: new ArrayType(String) })
        labels!: string[];

        @Property({ type: new ArrayType(dynamicConverter) })
        dynamicNumbers!: number[];

        @Property({ type: new ArrayType(parseUnknown) })
        unknownNumbers!: number[];

        @Property({ type: new ArrayType((value): 0 | 1 => (value === "1" ? 1 : 0)) })
        bitFlags!: number[];
      }
    `,
    // ReadonlyArray and Array type aliases map consistently to array/vector/json column types
    /* typescript */ `
      import { ArrayType, t } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      enum Status {
        OPEN = "open",
        CLOSED = "closed",
      }
      type ReadonlyTags = readonly string[];
      type LiteralTags = readonly ("a" | "b")[];
      type BitVector = readonly (0 | 1)[];
      type StatusList = Status[];
      type StatusAlias = Status;
      type ReadonlyVector = readonly number[];
      type ReadonlyFlags = readonly boolean[];
      type ReadonlyBigIds = readonly bigint[];
      const vectorTypes = { VectorType: class {} };

      @Entity()
      class Tagged {
        @Property({ type: t.array })
        tags!: ReadonlyTags;

        @Property({ type: t.array })
        literalTags!: LiteralTags;

        @Property({ type: new vectorTypes.VectorType(3) })
        bits!: BitVector;

        @Property({ type: t.array })
        statuses!: StatusList;

        @Property({ type: t.string })
        statusAlias!: StatusAlias;

        @Property({ type: t.json })
        jsonTags!: ReadonlyTags;

        @Property({ type: new VectorType(3) })
        embedding!: ReadonlyVector;

        @Property({ type: t.json })
        flags!: ReadonlyFlags;

        @Property({ type: new ArrayType(BigInt) })
        bigIds!: ReadonlyBigIds;
      }
    `,
    // Arrays of aliased element types, inline literals, inline object/tuple types, and @Enum({ array: true })
    /* typescript */ `
      import { ArrayType, Type, t } from "@mikro-orm/core";
      import { Entity, Enum, Property } from "@mikro-orm/decorators/legacy";

      enum Role {
        ADMIN = "admin",
        USER = "user",
      }
      type Tag = string;
      type Score = number;
      type Flag = boolean;
      type BigId = bigint;
      class BadTupleType extends Type<[number, bigint], string> {}

      @Entity()
      class ElementAliasesAndLiterals {
        @Property({ type: t.array })
        readonlyAliasedTags!: readonly Tag[];

        @Property({ type: new VectorType(3) })
        readonlyAliasedScores!: readonly Score[];

        @Property({ type: t.json })
        readonlyAliasedFlags!: readonly Flag[];

        @Property({ type: new ArrayType(BigInt) })
        readonlyAliasedBigIds!: readonly BigId[];

        @Property({ type: t.array })
        boxedStrings!: String[];

        @Property({ type: t.array })
        boxedNumbers!: Number[];

        @Property({ type: t.json })
        boxedBooleans!: Boolean[];

        @Property({ type: new ArrayType(BigInt) })
        boxedBigInts!: BigInt[];

        @Property({ type: t.array })
        inlineLiteralArray!: readonly ("a" | "b")[];

        @Property({ type: t.json })
        nullableElementArray!: (string | null)[];

        @Property({ type: t.string })
        inlineStringUnion!: "open" | "closed";

        @Property({ type: t.string })
        inlineTemplate!: \`k_\${string}\`;

        @Property({ type: t.integer })
        inlineNegativeLiteral!: -1 | 1;

        @Property({ type: t.boolean })
        inlineBooleanLiteral!: true;

        @Property({ type: t.bigint })
        inlineBigIntLiteral!: 1n | 2n;

        @Property({ type: t.json })
        inlineObject!: { count: number };

        @Property({ type: t.json })
        inlineTuple!: [number, string];

        @Property({ type: BadTupleType })
        nonJsonInlineTuple!: [number, bigint];

        @Enum({ items: () => Role, array: true })
        roles!: Role[];
      }
    `,
    // Non-JSON tuples, functions, and objects with bigint/Date properties are skipped for custom Types
    /* typescript */ `
      import { Type } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      type BadTuple = string | [number, bigint];
      type BadFn = string | (() => void);
      type BadCallableObj = string | ((() => void) & { tag: string });
      type BadObj = string | { id: bigint };
      type BadIndexObj = string | Record<string, bigint>;
      type BadNumIndexObj = string | { [index: number]: Date };
      class CustomType extends Type<unknown, string> {}

      @Entity()
      class NonJsonUnions {
        @Property({ type: CustomType })
        badTuple!: BadTuple;

        @Property({ type: CustomType })
        badFn!: BadFn;

        @Property({ type: CustomType })
        badCallableObj!: BadCallableObj;

        @Property({ type: CustomType })
        badObj!: BadObj;

        @Property({ type: CustomType })
        badIndexObj!: BadIndexObj;

        @Property({ type: CustomType })
        badNumIndexObj!: BadNumIndexObj;
      }
    `,
    // Decimal and BigInt number storage are valid number configurations
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: new DecimalType('number') })
        score!: number;
      }
    `,
    // VectorType is valid for number arrays
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: new VectorType(3) })
        embedding!: number[];
      }
    `,
    // VectorType class reference is valid for number arrays
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: VectorType })
        embedding!: number[];
      }
    `,
    // Capitalized primitive wrapper names are supported
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.string })
        name!: String;

        @Property({ type: t.float })
        score!: Number;

        @Property({ type: t.boolean })
        active!: Boolean;
      }
    `,
    // DecimalType class reference is valid for strings
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: DecimalType })
        amount!: string;
      }
    `,
    // BigIntType class reference is valid for numbers
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: BigIntType })
        amount!: number;
      }
    `,
    // GraphQLJSONObject identifier maps to JSON
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property({ type: t.json })
        payload!: GraphQLJSONObject;
      }
    `,
    // Custom type arrays use t.json
    /* typescript */ `
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      class Profile {}

      @Entity()
      class User {
        @Property({ type: t.json })
        profiles!: Profile[];
      }
    `,
    // Collection<T> is skipped
    /* typescript */ `
      import { Collection } from "@mikro-orm/core";
      import { Entity, Property } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        @Property()
        posts!: Collection<Post>;
      }
    `,
    // Methods are ignored
    /* typescript */ `
      import { Entity } from "@mikro-orm/decorators/legacy";

      @Entity()
      class User {
        method() {
          return "value";
        }
      }
    `,
    // Non-Entity class is not checked
    /* typescript */ `
      class NotAnEntity {
        field: string;
      }
    `,
  ],
  invalid: [
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
@Entity() class Book { @SearchableProperty<Book>({ "properties": "title", "nullable": true, "hidden": false }) title!: string | null; }`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
@Entity() class Book { @SearchableProperty({ "properties": "title", "nullable": true, "hidden": false }) title!: string | null; }`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const option = "hidden";
@Entity() class Book { @SearchableProperty({ properties: "title", [option]: false }) title!: string | null; }`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const option = "hidden";
@Entity() class Book { @SearchableProperty({ properties: "title", [option]: false, nullable: true }) title!: string | null; }`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
@Entity() class Book { @Property<Book>({ type: t.string, /* preserve privacy */ "hidden": true, "onUpdate": book => book.title }) title!: string; }`,
      output: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
@Entity() class Book { @Property({ type: t.string, /* preserve privacy */ "hidden": true, "onUpdate": book => book.title }) title!: string; }`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    {
      code: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
const shared = { hidden: true, onUpdate: (book: Book) => book.title };
@Entity() class Book { @Property<Book>({ ...shared, type: t.string }) title!: string; }`,
      output: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { t } from "@mikro-orm/core";
const shared = { hidden: true, onUpdate: (book: Book) => book.title };
@Entity() class Book { @Property({ ...shared, type: t.string }) title!: string; }`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const options = { properties: "search" as const, nullable: true };
@Entity() class Book { @SearchableProperty<Book>(options) search!: string | null; }`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const options = { properties: "search" as const, nullable: true };
@Entity() class Book { @SearchableProperty(options) search!: string | null; }`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty as Search } from "@nest-boot/database";
@Entity() class Book { @Search<Book>({ /* source */ properties: "search", nullable: true }) search!: string | null; }`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty as Search } from "@nest-boot/database";
@Entity() class Book { @Search({ /* source */ properties: "search", nullable: true }) search!: string | null; }`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity, Property as Column } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
@Entity() class Book {
  @Column<Book>({ type: FullTextType, nullable: true })
  search!: string | null;
}`,
      output: `import { Entity, Property as Column } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
@Entity() class Book {
  @Column({ type: FullTextType, nullable: true })
  search!: string | null;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty as Search } from "@nest-boot/database";
@Entity() class Book {
  @Search<Book>({ properties: "search", hidden: false })
  search!: string | null;
}`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty as Search } from "@nest-boot/database";
@Entity() class Book {
  @Search({ properties: "search", hidden: false, nullable: true })
  search!: string | null;
}`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import * as entities from "@mikro-orm/decorators/legacy";
import * as database from "@nest-boot/database";
@entities.Entity() class Book {
  @database.SearchableProperty<Book>({ properties: ["search"], nullable: true, hidden: false })
  search!: string;
}`,
      output: `import * as entities from "@mikro-orm/decorators/legacy";
import * as database from "@nest-boot/database";
@entities.Entity() class Book {
  @database.SearchableProperty({ properties: ["search"], hidden: false })
  search!: string;
}`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
@Entity() class Book {
  @SearchableProperty<Book>({ properties: "search", type: FullTextType, index: true, onCreate: () => "custom", onUpdate: () => "custom", hidden: false })
  search!: string | null;
}`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
@Entity() class Book {
  @SearchableProperty({ properties: "search", hidden: false, nullable: true })
  search!: string | null;
}`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const extras = { hidden: false };
@Entity() class Book {
  @SearchableProperty<Book>({ properties: "search", ...extras })
  search?: string;
}`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
const extras = { hidden: false };
@Entity() class Book {
  @SearchableProperty({ properties: "search", ...extras, nullable: true })
  search?: string;
}`,
      errors: [{ messageId: "alignSearchablePropertyOptions" }],
    },
    {
      code: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
import type { Opt } from "@mikro-orm/core";
@Entity() class Book {
  @SearchableProperty({ properties: "search" })
  search: string = "initial";
}`,
      output: `import { Entity } from "@mikro-orm/decorators/legacy";
import { SearchableProperty } from "@nest-boot/database";
import type { Opt } from "@mikro-orm/core";
@Entity() class Book {
  @SearchableProperty({ properties: "search" })
  search: Opt<string> = "initial";
}`,
      errors: [{ messageId: "useOptTypeForInitializedProperty" }],
    },
    {
      code: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
import { onFullTextCreate, onFullTextUpdate } from "@nest-boot/database";
@Entity() class Book {
  @Property<Book>({ type: FullTextType, onCreate: onFullTextCreate("search"), onUpdate: onFullTextUpdate("search") })
  search!: string | null;
}`,
      output: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
import { onFullTextCreate, onFullTextUpdate } from "@nest-boot/database";
@Entity() class Book {
  @Property({ type: FullTextType, onCreate: onFullTextCreate("search"), onUpdate: onFullTextUpdate("search"), nullable: true })
  search!: string | null;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    {
      code: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
@Entity()
class Book {
  @Property({ type: FullTextType })
  search!: string | null;
}`,
      output: `import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/postgresql";
@Entity()
class Book {
  @Property({ type: FullTextType, nullable: true })
  search!: string | null;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // type configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.float })
          name!: string;
        }
      `,
      output: /* typescript */ `
        import { t } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.string })
          name!: string;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // nullable configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.string })
          name?: string;
        }
      `,
      output: /* typescript */ `
        import { t } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.string, nullable: true })
          name?: string;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Has initializer but not using Opt<T>
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.boolean })
          isActive: boolean = false;
        }
      `,
      output: /* typescript */ `
        import { Opt } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.boolean })
          isActive: Opt<boolean> = false;
        }
      `,
      errors: [{ messageId: "useOptTypeForInitializedProperty" }],
    },
    // Enum type should use @Enum decorator
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Property()
          role!: Role;
        }
      `,
      output: /* typescript */ `
        import { Entity, Property, Enum } from "@mikro-orm/decorators/legacy";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Enum({ items: () => Role })
          role!: Role;
        }
      `,
      errors: [{ messageId: "useEnumDecorator" }],
    },
    // @Enum nullable configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Enum } from "@mikro-orm/decorators/legacy";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Enum({ items: () => Role })
          role?: Role;
        }
      `,
      output: /* typescript */ `
        import { Entity, Enum } from "@mikro-orm/decorators/legacy";

        enum Role {
          Admin,
          User
        }

        @Entity()
        class User {
          @Enum({ items: () => Role, nullable: true })
          role?: Role;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Array type configuration mismatch
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.string })
          tags!: number[];
        }
      `,
      output: /* typescript */ `
        import { t } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.array })
          tags!: number[];
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Empty @Property() should add type: t.boolean
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property()
          published!: boolean;
        }
      `,
      output: /* typescript */ `
        import { t } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.boolean })
          published!: boolean;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Empty @Property() should add type: t.datetime (Date type)
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property()
          createdAt!: Date;
        }
      `,
      output: /* typescript */ `
        import { t } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.datetime })
          createdAt!: Date;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Date type with wrong configuration should be fixed to t.datetime
    {
      code: /* typescript */ `
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.string })
          createdAt!: Date;
        }
      `,
      output: /* typescript */ `
        import { t } from "@mikro-orm/core";
        import { Entity, Property } from "@mikro-orm/decorators/legacy";

        @Entity()
        class User {
          @Property({ type: t.datetime })
          createdAt!: Date;
        }
      `,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Missing @Property decorator should add one from the TypeScript type
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  name!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  name!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Reuse existing decorator aliases in generated code
    {
      code: /* typescript */ `import { Entity, Property as MikroProperty } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  name!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property as MikroProperty } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @MikroProperty({ type: t.string })
  name!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Record types should use t.json
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  metadata!: Record<string, unknown>;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.json })
  metadata!: Record<string, unknown>;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Heterogeneous inline union types should use t.json
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  value!: string | number;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.json })
  value!: string | number;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Undefined unions should be nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  nickname!: string | undefined;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string, nullable: true })
  nickname!: string | undefined;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Ref<T | null> should unwrap the type and preserve nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  owner!: Ref<User | null>;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ nullable: true })
  owner!: Ref<User | null>;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Ref<T | undefined> should unwrap the type and preserve nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  owner!: Ref<User | undefined>;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ nullable: true })
  owner!: Ref<User | undefined>;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // PrimaryKey number fields should default to t.integer when missing
    {
      code: /* typescript */ `import { Entity, PrimaryKey } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @PrimaryKey()
  id!: number;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, PrimaryKey } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @PrimaryKey({ type: t.integer })
  id!: number;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Custom property-like decorators should keep their decorator name
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @EncryptedProperty({ type: t.float, length: 255 })
  secret!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @EncryptedProperty({ type: t.string, length: 255 })
  secret!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Custom class types should remove unnecessary type config
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
class Profile {}
@Entity()
class User {
  @Property({ type: t.string })
  profile!: Profile;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
class Profile {}
@Entity()
class User {
  @Property()
  profile!: Profile;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Missing decorators for custom class types should add an empty @Property()
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/decorators/legacy";
class Profile {}
@Entity()
class User {
  profile!: Profile;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
class Profile {}
@Entity()
class User {
  @Property()
  profile!: Profile;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // String arrays should use t.array
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  tags!: string[];
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.array })
  tags!: string[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Boolean arrays should use JSON storage
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.array })
  flags!: boolean[];
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.json })
  flags!: boolean[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Record arrays should use JSON storage
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.array })
  records!: Record<string, unknown>[];
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.json })
  records!: Record<string, unknown>[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Bare Array references should remove unnecessary type config
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  values!: Array;
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  values!: Array;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Nullable number arrays should keep valid vector config and add nullable
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: VectorType })
  embedding?: number[];
}`,
      output: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: VectorType, nullable: true })
  embedding?: number[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Enum types without decorators should add @Enum
    {
      code: /* typescript */ `import { Entity } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  role!: Role;
}`,
      output: /* typescript */ `import { Entity, Enum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role })
  role!: Role;
}`,
      errors: [{ messageId: "useEnumDecorator" }],
    },
    // Reuse existing Enum aliases in generated code
    {
      code: /* typescript */ `import { Entity, Enum as MikroEnum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  role!: Role;
}`,
      output: /* typescript */ `import { Entity, Enum as MikroEnum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @MikroEnum({ items: () => Role })
  role!: Role;
}`,
      errors: [{ messageId: "useEnumDecorator" }],
    },
    // Enum imports should be value imports even when @mikro-orm/core is type-only
    {
      code: /* typescript */ `import type { Ref } from "@mikro-orm/core";
import { Entity } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  role!: Role;
}`,
      output: /* typescript */ `import type { Ref } from "@mikro-orm/core";
import { Entity, Enum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role })
  role!: Role;
}`,
      errors: [{ messageId: "useEnumDecorator" }],
    },
    // Empty @Enum() should be rebuilt when nullable configuration is wrong
    {
      code: /* typescript */ `import { Entity, Enum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum()
  role?: Role;
}`,
      output: /* typescript */ `import { Entity, Enum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role, nullable: true })
  role?: Role;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Non-object @Enum arguments should be rebuilt
    {
      code: /* typescript */ `import { Entity, Enum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum(() => Role)
  role?: Role;
}`,
      output: /* typescript */ `import { Entity, Enum } from "@mikro-orm/decorators/legacy";
enum Role {
  Admin,
  User
}
@Entity()
class User {
  @Enum({ items: () => Role, nullable: true })
  role?: Role;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Non-object @Property arguments should be replaced with object config
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property(() => String)
  name!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  name!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Literal initializers without annotations should add Opt<T> and align @Property
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  enabled = true;
}`,
      output: [
        /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled = true;
}`,
        /* typescript */ `import { t, Opt } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Number literal initializers without annotations should infer Opt<number>
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  score = 1;
}`,
      output: [
        /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.float })
  score = 1;
}`,
        /* typescript */ `import { t, Opt } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.float })
  score: Opt<number> = 1;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // String literal initializers without annotations should infer Opt<string>
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  title = "hello";
}`,
      output: [
        /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  title = "hello";
}`,
        /* typescript */ `import { t, Opt } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  title: Opt<string> = "hello";
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Opt import should be inserted when there is no @mikro-orm/core import
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property()
  enabled: boolean = true;
}`,
      output: [
        /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: boolean = true;
}`,
        /* typescript */ `import { t, Opt } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Opt import should be inserted into multiline @mikro-orm/core imports
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: boolean = true;
}`,
      output: /* typescript */ `import { Opt } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      errors: [{ messageId: "useOptTypeForInitializedProperty" }],
    },
    // Invalid BigInt string storage for number should be replaced
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: new BigIntType('string') })
  score!: number;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.float })
  score!: number;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Invalid BigInt number storage for string should be replaced
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: new BigIntType('number') })
  externalId!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  externalId!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Instantiated t.bigint("bigint") on string should be replaced
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: new t.bigint("bigint") })
  externalId!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class User {
  @Property({ type: t.string })
  externalId!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Instantiated BigIntType("string") on bigint should be replaced
    {
      code: /* typescript */ `import { BigIntType } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class EventCursor {
  @Property({ type: new BigIntType("string") })
  lastEventMs!: bigint;
}`,
      output: /* typescript */ `import { BigIntType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class EventCursor {
  @Property({ type: t.bigint })
  lastEventMs!: bigint;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Heterogeneous union with wrong scalar type should be fixed to t.json
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
type JobProgress = string | boolean | number | object;
@Entity()
class Job {
  @Property({ type: t.string, nullable: true })
  progress!: JobProgress | null;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
type JobProgress = string | boolean | number | object;
@Entity()
class Job {
  @Property({ type: t.json, nullable: true })
  progress!: JobProgress | null;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Nullability fix should preserve valid new t.bigint("string")
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class ApiKey {
  @Property({ type: new t.bigint("string") })
  externalId?: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class ApiKey {
  @Property({ type: new t.bigint("string"), nullable: true })
  externalId?: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Constant mismatched mode on BigIntType should still be reported
    {
      code: /* typescript */ `import { BigIntType } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
const NUMBER_MODE = "number";
@Entity()
class User {
  @Property({ type: new BigIntType(NUMBER_MODE) })
  externalId!: string;
}`,
      output: /* typescript */ `import { BigIntType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
const NUMBER_MODE = "number";
@Entity()
class User {
  @Property({ type: t.string })
  externalId!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // String-hydrating DateType constructor should be rejected on Date properties
    {
      code: /* typescript */ `import { DateType } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Event {
  @Property({ type: new DateType() })
  day!: Date;
}`,
      output: /* typescript */ `import { DateType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Event {
  @Property({ type: t.datetime })
  day!: Date;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // ArrayType with String converter should be rejected on number[]
    {
      code: /* typescript */ `import { ArrayType } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Metrics {
  @Property({ type: new ArrayType(String) })
  values!: number[];
}`,
      output: /* typescript */ `import { ArrayType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Metrics {
  @Property({ type: t.array })
  values!: number[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // IntervalType / t.interval hydrates to PostgresInterval on PostgreSQL, not string
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Timer {
  @Property({ type: new t.interval() })
  duration!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Timer {
  @Property({ type: t.string })
  duration!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Alias-declared nullability should add nullable: true rather than drop it
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
type NullableProgress = string | number | null;
@Entity()
class Job {
  @Property({ type: t.json })
  progress!: NullableProgress;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
type NullableProgress = string | number | null;
@Entity()
class Job {
  @Property({ type: t.json, nullable: true })
  progress!: NullableProgress;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // ArrayType with Number converter should be rejected on string[]
    {
      code: /* typescript */ `import { ArrayType } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Tags {
  @Property({ type: new ArrayType(Number) })
  labels!: string[];
}`,
      output: /* typescript */ `import { ArrayType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Tags {
  @Property({ type: t.array })
  labels!: string[];
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Nullability fix preserves BooleanType, BigIntType, and explicit t.json on readonly arrays
    {
      code: /* typescript */ `import { BigIntType, BooleanType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Flags {
  @Property({ type: BooleanType })
  enabled?: boolean;

  @Property({ type: new BigIntType("bigint") })
  cursor?: bigint;

  @Property({ type: t.json })
  samples?: readonly number[];
}`,
      output: /* typescript */ `import { BigIntType, BooleanType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Flags {
  @Property({ type: BooleanType, nullable: true })
  enabled?: boolean;

  @Property({ type: new BigIntType("bigint"), nullable: true })
  cursor?: bigint;

  @Property({ type: t.json, nullable: true })
  samples?: readonly number[];
}`,
      errors: [
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Unknown custom constructor expression on string falls back to t.string
    {
      code: /* typescript */ `import { Entity, Property } from "@mikro-orm/decorators/legacy";
const Custom = { Type: class {} };
@Entity()
class Item {
  @Property({ type: new Custom.Type() })
  name!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
const Custom = { Type: class {} };
@Entity()
class Item {
  @Property({ type: t.string })
  name!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // DecimalType(undefined) honors runtimeType fallback and is rejected on mismatched string property
    {
      code: /* typescript */ `import { DecimalType } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Invoice {
  @Property({ type: new DecimalType(undefined), runtimeType: "number" })
  amount!: string;
}`,
      output: /* typescript */ `import { DecimalType, t } from "@mikro-orm/core";
import { Entity, Property } from "@mikro-orm/decorators/legacy";
@Entity()
class Invoice {
  @Property({ type: t.string, runtimeType: "number" })
  amount!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    // Readonly element aliases, enum arrays, and inline literal/object types autofix cleanly
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Enum, Property } from "@mikro-orm/decorators/legacy";
enum Role {
  ADMIN = "admin",
  USER = "user",
}
type Tag = string;
@Entity()
class ElementAliasFixes {
  @Property({ type: t.string })
  tags!: readonly Tag[];

  @Enum({ items: () => Role, nativeEnumName: "role_enum" })
  roles?: Role[];

  missingEnumArray!: Role[];

  @Property({ type: t.float })
  status!: "open" | "closed";

  @Property({ type: t.string })
  meta!: { count: number };
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Enum, Property } from "@mikro-orm/decorators/legacy";
enum Role {
  ADMIN = "admin",
  USER = "user",
}
type Tag = string;
@Entity()
class ElementAliasFixes {
  @Property({ type: t.array })
  tags!: readonly Tag[];

  @Enum({ items: () => Role, array: true, nativeEnumName: "role_enum", nullable: true })
  roles?: Role[];

  @Enum({ items: () => Role, array: true })
  missingEnumArray!: Role[];

  @Property({ type: t.string })
  status!: "open" | "closed";

  @Property({ type: t.json })
  meta!: { count: number };
}`,
      errors: [
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "useEnumDecorator" },
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Promotes type-only imports and preserves aliased decorators
    {
      code: /* typescript */ `import type { t } from "@mikro-orm/core";
import { Entity, type Property as Column } from "@mikro-orm/decorators/legacy";
@Entity()
class Item {
  @Column({ type: t.string })
  title!: string;
}`,
      output: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property as Column } from "@mikro-orm/decorators/legacy";
@Entity()
class Item {
  @Column({ type: t.string })
  title!: string;
}`,
      errors: [{ messageId: "alignPropertyDecoratorWithTsType" }],
    },
    {
      code: /* typescript */ `import { t } from "@mikro-orm/core";
import { Entity, Property as Column } from "@mikro-orm/decorators/legacy";
@Entity()
class Item {
  enabled = true;
}`,
      output: [
        /* typescript */ `import { t, Opt } from "@mikro-orm/core";
import { Entity, Property as Column } from "@mikro-orm/decorators/legacy";
@Entity()
class Item {
  enabled: Opt<boolean> = true;
}`,
        /* typescript */ `import { t, Opt } from "@mikro-orm/core";
import { Entity, Property as Column } from "@mikro-orm/decorators/legacy";
@Entity()
class Item {
  @Column({ type: t.boolean })
  enabled: Opt<boolean> = true;
}`,
      ],
      errors: [
        { messageId: "useOptTypeForInitializedProperty" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Preserves computed/quoted/method options, hidden on @Enum conversion, BigIntType runtimeType, and const enum
    {
      code: /* typescript */ `import { BigIntType, t } from "@mikro-orm/core";
import { Entity, Enum, Property } from "@mikro-orm/decorators/legacy";
const enum ConstStatus {
  OPEN = "open",
  CLOSED = "closed",
}
enum LocalRole {
  ADMIN = "admin",
  USER = "user",
}
@Entity()
class DecoratorPreservation {
  @Property({ type: t.json, ["hidden"]: true, "custom-opt": true, serializer(v: unknown) { return v; } })
  settings?: { token: string };

  @Property({ type: t.array, hidden: true })
  roles!: readonly LocalRole[];

  @Property({ type: new BigIntType("bigint"), runtimeType: "string" })
  cursor!: bigint;

  status!: ConstStatus;

  @Property({ type: "number[]" })
  scores?: readonly number[];
}`,
      output: /* typescript */ `import { BigIntType, t } from "@mikro-orm/core";
import { Entity, Enum, Property } from "@mikro-orm/decorators/legacy";
const enum ConstStatus {
  OPEN = "open",
  CLOSED = "closed",
}
enum LocalRole {
  ADMIN = "admin",
  USER = "user",
}
@Entity()
class DecoratorPreservation {
  @Property({ type: t.json, ["hidden"]: true, "custom-opt": true, serializer(v: unknown) { return v; }, nullable: true })
  settings?: { token: string };

  @Enum({ items: () => LocalRole, array: true, hidden: true })
  roles!: readonly LocalRole[];

  @Property({ type: t.bigint, runtimeType: "string" })
  cursor!: bigint;

  @Property({ type: t.string })
  status!: ConstStatus;

  @Property({ type: "number[]", nullable: true })
  scores?: readonly number[];
}`,
      errors: [
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "useEnumDecorator" },
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "alignPropertyDecoratorWithTsType" },
        { messageId: "alignPropertyDecoratorWithTsType" },
      ],
    },
    // Promotes type-only enum imports when generating @Enum({ items: () => ... })
    {
      code: /* typescript */ `import type { IsolationLevel } from "@mikro-orm/core";
import { Entity } from "@mikro-orm/decorators/legacy";
@Entity()
class TxConfig {
  levels!: readonly IsolationLevel[];
}`,
      output: /* typescript */ `import { IsolationLevel } from "@mikro-orm/core";
import { Entity, Enum } from "@mikro-orm/decorators/legacy";
@Entity()
class TxConfig {
  @Enum({ items: () => IsolationLevel, array: true })
  levels!: readonly IsolationLevel[];
}`,
      errors: [{ messageId: "useEnumDecorator" }],
    },
  ],
});
