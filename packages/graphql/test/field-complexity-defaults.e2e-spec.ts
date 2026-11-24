import { Test } from "@nestjs/testing";
import type { GraphQLSchema } from "graphql";
import { isObjectType } from "graphql/index.js";

import {
  Field,
  GraphQLModule,
  GraphQLSchemaHost,
  Mutation,
  ObjectType,
  Query,
  ResolveField,
  Resolver,
} from "../src/index.js";

@Resolver()
class ReportQueries {
  @Query(() => PublishedReport, { name: "published" })
  published(): Promise<PublishedReport> {
    return Promise.resolve({ title: "Report" });
  }

  @Query(() => PublishedReport, { complexity: 0 })
  freeReport(): Promise<PublishedReport> {
    return this.published();
  }

  @Query(() => [PublishedReport])
  reports(): Promise<PublishedReport[]> {
    return this.published().then((report) => [report]);
  }

  @Query(() => ReportOwner)
  owner(): Promise<ReportOwner> {
    return Promise.resolve(new ReportOwner());
  }

  @Mutation(() => PublishedReport, { mutationComplexity: 7 })
  publishReport(): Promise<PublishedReport> {
    return this.published();
  }
}

@ObjectType({ isAbstract: true })
class BaseReport {
  static readonly complexity = () => 4;

  @Field(() => String)
  title!: string;
}

@ObjectType("Report")
class PublishedReport extends BaseReport {}

@ObjectType()
class FreeReport {
  static readonly complexity = 0;

  @Field(() => String)
  title!: string;
}

@ObjectType()
class ReportOwner {
  // eslint-disable-next-line @nest-boot/graphql/field-config-from-types -- Exercise Nest's reflected return type.
  @Field()
  report!: PublishedReport;

  @Field(() => FreeReport)
  freeType!: FreeReport;

  @Field(() => PublishedReport, { complexity: 0 })
  freeField!: PublishedReport;

  @Field(() => PublishedReport, { complexity: 2 })
  overrideField!: PublishedReport;
}

@Resolver(() => ReportOwner)
class ReportOwnerResolver {
  @ResolveField()
  report(): Promise<PublishedReport> {
    return Promise.resolve(this.latestReport());
  }

  @ResolveField("latest", () => PublishedReport)
  latestReport(): PublishedReport {
    return { title: "Latest" };
  }

  @ResolveField(() => PublishedReport)
  freeField(): PublishedReport {
    return this.latestReport();
  }

  @ResolveField(() => PublishedReport, { complexity: 7 })
  overrideField(): PublishedReport {
    return this.latestReport();
  }
}

describe("field complexity defaults", () => {
  it("fills native field costs after Nest merges resolver and model metadata", async () => {
    const transformSchema = vi.fn((schema: GraphQLSchema) => {
      expect(
        schema.getQueryType()?.getFields().published.extensions.complexity,
      ).toBe(BaseReport.complexity);
      return schema;
    });
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({
          autoSchemaFile: true,
          graphiql: false,
          transformSchema,
        }),
      ],
      providers: [ReportQueries, ReportOwnerResolver],
    }).compile();
    const app = module.createNestApplication({ logger: false });

    try {
      await app.init();
      const { schema } = app.get(GraphQLSchemaHost);
      const query = schema.getQueryType()?.getFields();
      expect(query?.published.extensions.complexity).toBe(
        BaseReport.complexity,
      );
      expect(query?.freeReport.extensions.complexity).toBe(0);
      expect(query?.reports.extensions.complexity).toBeUndefined();
      expect(query?.owner.extensions.complexity).toBeUndefined();
      expect(
        schema.getMutationType()?.getFields().publishReport.extensions,
      ).toMatchObject({
        complexity: BaseReport.complexity,
        mutationComplexity: 7,
      });
      expect(transformSchema).toHaveBeenCalledOnce();

      const owner = schema.getType("ReportOwner");
      if (!isObjectType(owner)) {
        throw new Error("Expected a ReportOwner object type");
      }
      const fields = owner.getFields();
      expect(fields.report.extensions.complexity).toBe(BaseReport.complexity);
      expect(fields.freeType.extensions.complexity).toBe(0);
      expect(fields.freeField.extensions.complexity).toBe(0);
      expect(fields.overrideField.extensions.complexity).toBe(7);
      expect(fields.latest.extensions.complexity).toBe(BaseReport.complexity);
    } finally {
      await app.close();
    }
  });
});
